import type { EmailConfig, QueuedEmail } from "./types";

export interface SendResult {
  ok: boolean;
  error?: string;
  providerMessageId?: string;
}

/**
 * Real outbound email sender for the Admin Console.
 *
 * Browser-side JavaScript cannot open raw SMTP sockets, so we expose
 * three browser-compatible paths plus a manual queue:
 *
 * 1. **Resend** — REST API, takes a single API key.
 * 2. **smtp-relay** — POST to a URL of your choice (your own backend,
 *    a Cloudflare Worker, n8n, Make, Zapier, etc.) which then speaks
 *    raw SMTP using the credentials you configured server-side.
 * 3. **EmailJS** — purpose-built for browser → SMTP delivery using
 *    EmailJS's hosted service + your SMTP creds.
 * 4. **smtp-our-server** — POST to social-svc's /v1/email/send.
 * 5. **none** — no-op, leaves the message in the local queue.
 *
 * Postmark / SendGrid / SES are accepted in the type but not yet wired.
 *
 * RFC 8058 one-click unsubscribe: when q.unsubscribeUrl is set,
 * `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
 * are emitted (Resend takes a `headers` map; smtp-our-server has its
 * own `unsubscribeUrl` field that social-svc converts; smtp-relay
 * passes the raw URL through for the relay to translate).
 */
export async function sendEmail(
  cfg: EmailConfig,
  q: QueuedEmail,
  bearerToken?: string,
): Promise<SendResult> {
  switch (cfg.provider) {
    case "none":
      return { ok: false, error: "No provider configured." };

    case "smtp-our-server": {
      if (!bearerToken) {
        return { ok: false, error: "Sign-in required (admin session JWT)." };
      }
      try {
        const r = await fetch("/v1/email/send", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${bearerToken}`,
          },
          body: JSON.stringify({
            to: q.to,
            subject: q.subjectRendered,
            html: q.bodyRendered,
            fromName: cfg.fromName,
            replyTo: cfg.replyTo,
            unsubscribeUrl: q.unsubscribeUrl,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, error: data?.reason ?? data?.error ?? `HTTP ${r.status}` };
        return { ok: true, providerMessageId: data?.messageId };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    case "resend": {
      if (!cfg.apiKey) return { ok: false, error: "Resend API key missing." };
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            from: `${cfg.fromName} <${cfg.fromEmail}>`,
            to: [q.to],
            subject: q.subjectRendered,
            html: q.bodyRendered,
            reply_to: cfg.replyTo,
            headers: q.unsubscribeUrl
              ? {
                  "List-Unsubscribe": `<${q.unsubscribeUrl}>, <mailto:${cfg.fromEmail}?subject=unsubscribe>`,
                  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                }
              : undefined,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, error: data?.message ?? `HTTP ${r.status}` };
        return { ok: true, providerMessageId: data?.id };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    case "smtp-relay": {
      if (!cfg.webhookUrl) return { ok: false, error: "Webhook URL missing." };
      try {
        const r = await fetch(cfg.webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(cfg.webhookAuth ? { authorization: `Bearer ${cfg.webhookAuth}` } : {}),
          },
          body: JSON.stringify({
            from: { name: cfg.fromName, email: cfg.fromEmail },
            replyTo: cfg.replyTo,
            to: q.to,
            subject: q.subjectRendered,
            html: q.bodyRendered,
            smtp: cfg.smtp,
            templateId: q.templateId,
            queuedAt: q.queuedAt,
            unsubscribeUrl: q.unsubscribeUrl,
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, error: data?.message ?? `HTTP ${r.status}` };
        return { ok: true, providerMessageId: data?.id };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    case "emailjs": {
      const js = cfg.emailjs;
      if (!js?.serviceId || !js?.templateId || !js?.userId) {
        return { ok: false, error: "EmailJS service / template / user id missing." };
      }
      try {
        const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            service_id: js.serviceId,
            template_id: js.templateId,
            user_id: js.userId,
            template_params: {
              to_email: q.to,
              subject: q.subjectRendered,
              body: q.bodyRendered,
              from_name: cfg.fromName,
              from_email: cfg.fromEmail,
              reply_to: cfg.replyTo ?? cfg.fromEmail,
            },
          }),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          return { ok: false, error: txt || `HTTP ${r.status}` };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    case "postmark":
    case "sendgrid":
    case "ses":
      return {
        ok: false,
        error: `Provider "${cfg.provider}" needs server-side wiring. Use Resend, EmailJS, or smtp-relay from the browser.`,
      };
  }
}
