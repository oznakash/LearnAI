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
  /** Optional override of the default From: name (e.g. "LearnAI Support"). */
  fromName?: string;
  /** Optional Reply-To. */
  replyTo?: string;
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

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = configFromEnv();
  if (!cfg) {
    return {
      ok: false,
      reason: "smtp_not_configured (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD)",
    };
  }
  const fromName = input.fromName ?? cfg.fromName;
  try {
    const info = await transporter(cfg).sendMail({
      from: `${fromName} <${cfg.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    log.info("email_sent", { to_domain: input.to.split("@")[1] ?? "?", subject_len: input.subject.length });
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
