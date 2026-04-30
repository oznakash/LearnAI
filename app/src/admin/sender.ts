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
 *    LearnAI sends the SMTP details in the request body so the
 *    relay can use them, BUT for production you should keep the
 *    password server-side and ignore it here.
 * 3. **EmailJS** — purpose-built for browser → SMTP delivery using
 *    EmailJS's hosted service + your SMTP creds.
 * 4. **none** — no-op, leaves the message in the local queue (admin
 *    can hand-deliver).
 *
 * Postmark / SendGrid / SES are accepted in the type but not yet wired
 * — they need backend mediation in production setups.
 */
export async function sendEmail(cfg: EmailConfig, q: QueuedEmail): Promise<SendResult> {
  switch (cfg.provider) {
    case "none":
      return { ok: false, error: "No provider configured." };

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
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          return { ok: false, error: data?.message ?? `HTTP ${r.status}` };
        }
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
            // The relay decides how to use these. For production keep
            // SMTP creds server-side and ignore the smtp block here.
            from: { name: cfg.fromName, email: cfg.fromEmail },
            replyTo: cfg.replyTo,
            to: q.to,
            subject: q.subjectRendered,
            html: q.bodyRendered,
            smtp: cfg.smtp,
            templateId: q.templateId,
            queuedAt: q.queuedAt,
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
        error: `Provider "${cfg.provider}" needs server-side wiring. Use "Resend", "EmailJS", or your own SMTP relay (smtp-relay) from the browser.`,
      };
  }
}
