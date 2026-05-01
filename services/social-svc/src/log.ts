// Structured JSON logging for the sidecar.
//
// One line per log event. JSON-parseable so cloud-claude (or any
// log aggregator) can grep / filter / alert. Fields are stable so
// dashboards survive code changes.
//
// Convention:
//   { ts, level, svc, msg, ...fields }
//   level: "info" | "warn" | "error"
//   svc:   "social-svc" — fixed.
//   msg:   short human-readable. Keep < 80 chars.
//   fields: arbitrary; reserved keys: req_id, email_hash, route, status, ms.
//
// PII rule: never log raw email. Use email_hash (sha-256, first 8 chars).

import { createHash } from "node:crypto";

export type Level = "info" | "warn" | "error";

const SVC = "social-svc";

function emit(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    svc: SVC,
    msg,
    ...fields,
  });
  // stdout for info/warn, stderr for error — matches standard 12-factor.
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};

/** Privacy-safe email handle for logs. */
export function emailHash(email: string | undefined): string {
  if (!email) return "anon";
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 8);
}
