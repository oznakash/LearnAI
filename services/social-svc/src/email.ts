// SMTP sender. Wraps nodemailer with the env vars cloud-claude
// injects, exposes a simple sendEmail() that the /v1/email/send
// route hands user-supplied {to, subject, html} to.
//
// Required env vars (production):
//   SMTP_HOST       e.g. mail.cloud-claude.com
//   SMTP_USER       e.g. learnai@useyl.com
//   SMTP_PASSWORD   account password OR app-password
//   SMTP_FROM_EMAIL the From: address (must equal SMTP_USER on
//                   most servers — Stalwart enforces this)
//
// Optional:
//   SMTP_PORT       default 587 (STARTTLS)
//   SMTP_SECURE     "1" → use implicit TLS on 465; default "0"
//                   (STARTTLS upgrade on 587)
//   SMTP_FROM_NAME  default "LearnAI"
//
// All values are read once at module load via configFromEnv() below.
// We refuse to construct a transporter if any required var is missing
// — sendEmail() returns ok:false with a clear reason instead, so the
// /v1/email/send endpoint can return 503 with that reason.

import nodemailer, { type Transporter } from "nodemailer";
import { log } from "./log.js";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  /** HTML body — pre-rendered by the SPA's template renderer. */
  html: string;
  /**
   * Optional plain-text alternative. If omitted, we auto-derive a sane
   * fallback by stripping tags from `html` so the message ships as
   * multipart/alternative. Spam filters reward having a text part even
   * when it's never displayed.
   */
  text?: string;
  /** Optional override of the default From: name (e.g. "LearnAI Support"). */
  fromName?: string;
  /** Optional Reply-To. */
  replyTo?: string;
  /**
   * Optional one-click unsubscribe URL (RFC 8058). When provided, must
   * be HTTPS — we then emit both `List-Unsubscribe` (with the URL +
   * mailto fallback) and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
   * so Gmail / Outlook / Yahoo render the native one-click button.
   *
   * For transactional / admin sends with no opt-out flow (test emails,
   * password reset, etc.) leave this undefined — we still emit a
   * mailto-only `List-Unsubscribe` header pointing at the From address,
   * which is enough to satisfy bulk-sender heuristics without surfacing
   * an unsubscribe affordance in the recipient's client.
   */
  unsubscribeUrl?: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  reason?: string;
}

let cachedTransporter: Transporter | null = null;
let cachedConfig: SmtpConfig | null = null;

/** Read SMTP env vars; null if any required field is missing. */
export function configFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;
  return {
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "1",
    user,
    password,
    fromEmail: (process.env.SMTP_FROM_EMAIL ?? user).trim(),
    fromName: process.env.SMTP_FROM_NAME ?? "LearnAI",
  };
}

function transporter(cfg: SmtpConfig): Transporter {
  if (cachedTransporter && cachedConfig?.host === cfg.host && cachedConfig?.user === cfg.user) {
    return cachedTransporter;
  }
  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure, // false → STARTTLS upgrade on 587
    requireTLS: !cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
  });
  cachedConfig = cfg;
  return cachedTransporter;
}

/**
 * Best-effort HTML → plain-text. Not a perfect renderer — it just
 * needs to give spam filters and text-only mail clients something
 * readable so the message qualifies as multipart/alternative. We
 * deliberately avoid pulling in `html-to-text` to keep the sidecar
 * dependency footprint flat.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*div\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<\/\s*h[1-6]\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Build the `List-Unsubscribe` and (optionally) `List-Unsubscribe-Post`
 * headers per RFC 2369 + RFC 8058. The mailto fallback is always
 * present — Gmail's bulk-sender requirements treat its absence as a
 * red flag even for transactional volume. The one-click POST header
 * is only emitted when `unsubscribeUrl` is HTTPS (RFC 8058 §3 forbids
 * non-HTTPS for one-click).
 */
export function buildListUnsubHeaders(
  fromEmail: string,
  unsubscribeUrl?: string,
): Record<string, string> {
  const mailto = `mailto:${fromEmail}?subject=unsubscribe`;
  const httpsOk = !!unsubscribeUrl && /^https:\/\//i.test(unsubscribeUrl);
  const headers: Record<string, string> = {
    "List-Unsubscribe": httpsOk
      ? `<${unsubscribeUrl}>, <${mailto}>`
      : `<${mailto}>`,
  };
  if (httpsOk) {
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  return headers;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = configFromEnv();
  if (!cfg) {
    return {
      ok: false,
      reason: "smtp_not_configured (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD)",
    };
  }
  const fromName = input.fromName ?? cfg.fromName;
  const text = input.text ?? htmlToText(input.html);
  const headers = buildListUnsubHeaders(cfg.fromEmail, input.unsubscribeUrl);
  try {
    const info = await transporter(cfg).sendMail({
      from: `${fromName} <${cfg.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text,
      replyTo: input.replyTo,
      headers,
    });
    log.info("email_sent", {
      to_domain: input.to.split("@")[1] ?? "?",
      subject_len: input.subject.length,
      has_unsub_url: !!input.unsubscribeUrl,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const msg = (e as Error).message;
    log.error("email_send_failed", { reason: msg });
    return { ok: false, reason: msg };
  }
}

/** Health check — surfaced on /health.email so admins can confirm config. */
export function smtpStatus(): { configured: boolean; host?: string; from?: string } {
  const cfg = configFromEnv();
  if (!cfg) return { configured: false };
  return { configured: true, host: cfg.host, from: cfg.fromEmail };
}
