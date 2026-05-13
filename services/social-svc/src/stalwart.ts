// Stalwart Mail Server admin-API client.
//
// The upstream SMTP server at mail.cloud-claude.com runs Stalwart, which
// exposes a REST admin API at /api/queue/* (in-flight queue) and
// /api/telemetry/* (historical traces). After we hand a message to the
// relay via nodemailer, this module lets `/v1/email/log/:id/status`
// answer the "what actually happened to this message?" question:
//
//   scheduled    — in the queue waiting for next attempt
//   in_progress  — actively being delivered
//   completed    — Stalwart confirms remote MX accepted it
//   temp_fail    — soft failure, will retry until expiry
//   perm_fail    — hard bounce, no more retries
//
// Feature flag: both STALWART_ADMIN_URL and STALWART_ADMIN_TOKEN must be
// set. Either missing → stalwartConfigFromEnv() returns null and the
// caller short-circuits with a "local_only" response. This means the
// log endpoint works the day this module ships (before cloud-claude
// issues us the admin token) and flips to live data the moment both
// env vars are set, without a code change.
//
// Auth: Stalwart accepts both Basic and Bearer on the admin API. We use
// Bearer with the raw token, which matches the token format cloud-claude
// hands out (`stl_*`). For Basic auth, set STALWART_ADMIN_TOKEN to
// `basic:user:password`.

export interface StalwartConfig {
  /** Origin without trailing slash, e.g. `https://mail.cloud-claude.com`. */
  adminUrl: string;
  /** Raw Bearer token, OR `basic:user:password` for Basic auth. */
  adminToken: string;
}

export function stalwartConfigFromEnv(): StalwartConfig | null {
  const adminUrl = process.env.STALWART_ADMIN_URL?.trim();
  const adminToken = process.env.STALWART_ADMIN_TOKEN?.trim();
  if (!adminUrl || !adminToken) return null;
  return { adminUrl: adminUrl.replace(/\/+$/, ""), adminToken };
}

function authHeader(cfg: StalwartConfig): string {
  if (cfg.adminToken.startsWith("basic:")) {
    const creds = cfg.adminToken.slice("basic:".length);
    return `Basic ${Buffer.from(creds).toString("base64")}`;
  }
  return `Bearer ${cfg.adminToken}`;
}

/** Per-recipient delivery status as returned by Stalwart. */
export interface StalwartRecipient {
  address: string;
  /** `scheduled` | `in_progress` | `completed` | `temp_fail` | `perm_fail`. */
  status: string;
  /** When `temp_fail`/`perm_fail`: error category (`dns`, `tls`, ...). */
  errorCategory?: string;
  /** Optional human-readable detail. */
  message?: string;
}

/** Per-domain bucket; aggregates one or more recipients. */
export interface StalwartDomain {
  name: string;
  status: string;
  recipients: StalwartRecipient[];
  retryNum?: number;
  nextRetry?: string;
  expires?: string;
}

export type StalwartLookupResult =
  | { kind: "found"; domains: StalwartDomain[]; created?: string; size?: number; raw: unknown }
  | { kind: "not_found" }
  | { kind: "error"; reason: string; status?: number };

/**
 * Fetch a single message from `/api/queue/messages/{queueId}`.
 *
 * Stalwart removes the queue entry once delivery completes successfully,
 * so a 404 here is ambiguous: either the message was never enqueued (very
 * unlikely if we have a queueId from the 250 response), or it delivered
 * and was reaped. The caller decides how to surface that — see the
 * `completed_aged_out` handling in app.ts.
 */
export async function fetchQueueMessage(
  cfg: StalwartConfig,
  queueId: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<StalwartLookupResult> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `${cfg.adminUrl}/api/queue/messages/${encodeURIComponent(queueId)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { authorization: authHeader(cfg), accept: "application/json" },
      signal: ctrl.signal,
    });
    if (res.status === 404) return { kind: "not_found" };
    if (!res.ok) {
      // Don't propagate response body — could leak adjacent queue data
      // if the token is over-scoped. Caller logs the status code.
      return { kind: "error", reason: `stalwart_http_${res.status}`, status: res.status };
    }
    const body = (await res.json()) as unknown;
    const parsed = parseQueueMessageBody(body);
    return { kind: "found", ...parsed, raw: body };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { kind: "error", reason: "stalwart_timeout" };
    return { kind: "error", reason: (e as Error).message ?? "stalwart_fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

interface ParsedQueueBody {
  domains: StalwartDomain[];
  created?: string;
  size?: number;
}

/**
 * Defensive parser. Stalwart's response shape is stable, but we accept
 * mild deviation (missing fields, snake_case vs camelCase) to avoid
 * exposing the admin tab to a refactor we can't redeploy synchronously.
 */
export function parseQueueMessageBody(body: unknown): ParsedQueueBody {
  if (!body || typeof body !== "object") return { domains: [] };
  const b = body as Record<string, unknown>;
  const created = typeof b.created === "string" ? b.created : undefined;
  const size = typeof b.size === "number" ? b.size : undefined;
  const rawDomains = Array.isArray(b.domains) ? b.domains : [];
  const domains: StalwartDomain[] = [];
  for (const d of rawDomains) {
    if (!d || typeof d !== "object") continue;
    const dd = d as Record<string, unknown>;
    const name = typeof dd.name === "string" ? dd.name : "?";
    const status = typeof dd.status === "string" ? dd.status : "unknown";
    const retryNum = typeof dd.retry_num === "number" ? dd.retry_num : undefined;
    const nextRetry = typeof dd.next_retry === "string" ? dd.next_retry : undefined;
    const expires = typeof dd.expires === "string" ? dd.expires : undefined;
    const rcptArr = Array.isArray(dd.recipients) ? dd.recipients : [];
    const recipients: StalwartRecipient[] = [];
    for (const r of rcptArr) {
      if (!r || typeof r !== "object") continue;
      const rr = r as Record<string, unknown>;
      recipients.push({
        address: typeof rr.address === "string" ? rr.address : "?",
        status: typeof rr.status === "string" ? rr.status : "unknown",
        errorCategory:
          typeof rr.error_category === "string"
            ? rr.error_category
            : typeof rr.errorCategory === "string"
              ? (rr.errorCategory as string)
              : undefined,
        message: typeof rr.message === "string" ? rr.message : undefined,
      });
    }
    domains.push({ name, status, recipients, retryNum, nextRetry, expires });
  }
  return { domains, created, size };
}

/**
 * Roll up per-domain / per-recipient statuses to a single message-level
 * state. The order matters: any perm_fail wins (most actionable signal),
 * then temp_fail, then in_progress, then scheduled, then completed.
 * Unknown values fall through to `unknown`.
 */
export function summariseStatus(domains: StalwartDomain[]): {
  state: "scheduled" | "in_progress" | "completed" | "temp_fail" | "perm_fail" | "unknown";
  worstErrorCategory?: string;
} {
  const order = ["perm_fail", "temp_fail", "in_progress", "scheduled", "completed"] as const;
  type Known = (typeof order)[number];
  let worst: Known | null = null;
  let worstErrorCategory: string | undefined;
  const consider = (s: string, errCat?: string) => {
    const k = order.find((o) => o === s);
    if (!k) return;
    if (worst === null || order.indexOf(k) < order.indexOf(worst)) {
      worst = k;
      worstErrorCategory = errCat;
    } else if (k === worst && errCat && !worstErrorCategory) {
      // Equal-rank observation that carries an error category — take
      // it. Stalwart aggregates the per-domain status by rolling up its
      // recipients, so the domain row often lacks the category while
      // the recipient row has it. We want the more specific signal.
      worstErrorCategory = errCat;
    }
  };
  for (const d of domains) {
    consider(d.status);
    for (const r of d.recipients) {
      consider(r.status, r.errorCategory);
    }
  }
  return { state: worst ?? "unknown", worstErrorCategory };
}
