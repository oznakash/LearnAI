/**
 * Email policy engine — sits between `queueEmail` (drops items into
 * the local queue) and `sendEmail` (fires the provider).
 *
 * Three jobs:
 *
 *   1. Group queued emails by recipient and pick at most one per
 *      `capPerWindowHours` window using `priorityOrder`. Losers are
 *      `superseded`. Recipients with a recent `sent` row in the same
 *      window get `rate-limited` for everything new.
 *
 *   2. Skip recipients flagged `unsubscribed` or under a `paused`
 *      cooldown (data sourced from mem0's `/v1/state/admin/users`).
 *
 *   3. For sends that survive, call mem0's `/v1/email/admin/prepare`
 *      to mint signed unsubscribe + open-pixel tokens, then auto-
 *      inject them into the body before the provider call.
 *
 * Pure-ish: takes inputs, returns plans. The actual provider call +
 * state mutation lives in `flushQueue` so this module stays testable
 * without faking React/AdminContext.
 */
import type {
  AdminConfig,
  EmailPolicy,
  EmailTemplateId,
  QueuedEmail,
} from "./types";

/** Templates that fire on a player event rather than a schedule. The
 *  policy can be configured to bypass the cap for these (off by
 *  default — operator-side caution beats operator-side trust). */
export const TRANSACTIONAL_TEMPLATES = new Set<EmailTemplateId>([
  "welcome",
  "first-spark",
  "level-up",
  "boss-beaten",
  "streak-save",
]);

/** What mem0's `/v1/state/admin/users` returns for each user (subset).
 *  The policy reads only these fields. */
export interface RecipientPolicyState {
  email: string;
  email_unsubscribed_at?: number | null;
  email_pause_until?: number | null;
  email_log?: Array<{
    id?: string;
    tpl?: string;
    sent_at?: number | null;
    opened_at?: number | null;
    is_transactional?: boolean;
  }>;
}

export interface PlanEntry {
  /** Always set: which queued email this plan refers to. */
  queued: QueuedEmail;
  /** What to do with it. */
  outcome:
    | "send"
    | "superseded"
    | "rate-limited"
    | "unsubscribed"
    | "paused";
  /** Why, when the outcome blocks the send. Surfaced to the queue UI. */
  reason?: string;
}

export interface PlanInput {
  policy: EmailPolicy;
  /** All queued (status: "queued") emails in admin config. */
  queued: QueuedEmail[];
  /** Already-sent rows from admin config — used for the cap window
   *  check when there's no fresh server state for a recipient. */
  sentHistory: QueuedEmail[];
  /** Per-recipient state from mem0. Keyed by lowercased email. */
  recipientState: Record<string, RecipientPolicyState>;
  /** Injected for tests. */
  now?: number;
}

/**
 * Plan a flush. Pure: returns one PlanEntry per input queued row.
 *
 * Order of decisions per recipient:
 *   1. unsubscribed → all queued for them get `unsubscribed`
 *   2. paused (within window) → `paused`
 *   3. has a `sent` for them inside the cap window AND the queued row
 *      isn't bypassed-transactional → `rate-limited`
 *   4. otherwise: pick the highest-priority queued row, mark the rest
 *      `superseded`, the winner gets `send`
 */
export function planEmailFlush(input: PlanInput): PlanEntry[] {
  const { policy, queued, sentHistory, recipientState, now = Date.now() } = input;
  if (!policy.enabled) {
    return queued.map((q) => ({ queued: q, outcome: "send" }));
  }
  const windowMs = Math.max(1, policy.capPerWindowHours) * 60 * 60 * 1000;
  const priorityIndex = new Map(
    policy.priorityOrder.map((id, i) => [id, i] as const),
  );
  const rank = (id: EmailTemplateId): number =>
    priorityIndex.has(id) ? (priorityIndex.get(id) as number) : Number.POSITIVE_INFINITY;

  // Group queued by recipient (lowercased so policy state lookups match).
  const byRecipient = new Map<string, QueuedEmail[]>();
  for (const q of queued) {
    const key = q.to.trim().toLowerCase();
    const arr = byRecipient.get(key) ?? [];
    arr.push(q);
    byRecipient.set(key, arr);
  }

  // For each recipient, when was their most recent sent?
  const lastSentByRecipient = new Map<string, number>();
  for (const r of sentHistory) {
    if (r.status !== "sent") continue;
    const key = r.to.trim().toLowerCase();
    const ts = r.queuedAt ?? 0;
    const prev = lastSentByRecipient.get(key) ?? 0;
    if (ts > prev) lastSentByRecipient.set(key, ts);
  }

  const plan: PlanEntry[] = [];
  for (const [key, items] of byRecipient.entries()) {
    const state = recipientState[key];

    // 1. Unsubscribed.
    if (state?.email_unsubscribed_at) {
      for (const q of items) {
        plan.push({ queued: q, outcome: "unsubscribed", reason: "user opted out" });
      }
      continue;
    }

    // 2. Paused.
    if (
      typeof state?.email_pause_until === "number" &&
      state.email_pause_until > now
    ) {
      const days = Math.ceil((state.email_pause_until - now) / (24 * 60 * 60 * 1000));
      for (const q of items) {
        plan.push({
          queued: q,
          outcome: "paused",
          reason: `cooldown — ~${days}d remaining`,
        });
      }
      continue;
    }

    // 3. Rate-limit window — agree with mem0 by taking the latest of
    //    (local sent history, server-side log).
    const localLastSent = lastSentByRecipient.get(key) ?? 0;
    const serverLastSent = (state?.email_log ?? []).reduce<number>((acc, e) => {
      const ts = typeof e.sent_at === "number" ? e.sent_at : 0;
      return ts > acc ? ts : acc;
    }, 0);
    const lastSent = Math.max(localLastSent, serverLastSent);
    const insideCap = lastSent > 0 && now - lastSent < windowMs;

    // 4. Pick the winner.
    const sortedByPriority = [...items].sort(
      (a, b) => rank(a.templateId) - rank(b.templateId),
    );
    let winner: QueuedEmail | null = null;
    let winnerBypasses = false;
    for (const q of sortedByPriority) {
      const isTx = TRANSACTIONAL_TEMPLATES.has(q.templateId);
      const bypass = policy.transactionalBypass && isTx;
      if (insideCap && !bypass) continue;
      winner = q;
      winnerBypasses = bypass;
      break;
    }

    for (const q of items) {
      if (q === winner) {
        plan.push({ queued: q, outcome: "send" });
      } else if (winner === null) {
        const isTx = TRANSACTIONAL_TEMPLATES.has(q.templateId);
        if (insideCap && !(policy.transactionalBypass && isTx)) {
          plan.push({
            queued: q,
            outcome: "rate-limited",
            reason: `< ${policy.capPerWindowHours}h since last send`,
          });
        } else {
          // Defensive — shouldn't reach here.
          plan.push({ queued: q, outcome: "superseded" });
        }
      } else {
        plan.push({
          queued: q,
          outcome: "superseded",
          reason: winnerBypasses
            ? `transactional ${winner.templateId} bypassed cap`
            : `${winner.templateId} won priority`,
        });
      }
    }
  }
  return plan;
}

/**
 * Should we set a pause on this recipient? Reads the last N entries
 * of their `email_log`; returns the new `email_pause_until` value if
 * the policy says yes, else null.
 */
export function maybePauseFromUnreads(
  state: RecipientPolicyState | undefined,
  policy: EmailPolicy,
  now = Date.now(),
): number | null {
  if (!policy.pauseOnUnreadEnabled) return null;
  const log = state?.email_log ?? [];
  if (log.length < policy.pauseOnUnreadCount) return null;
  const recent = log.slice(0, policy.pauseOnUnreadCount);
  const allUnread = recent.every((e) => !e.opened_at);
  if (!allUnread) return null;
  const oldest = recent[recent.length - 1];
  const oldestTs = typeof oldest?.sent_at === "number" ? oldest.sent_at : 0;
  if (oldestTs === 0 || now - oldestTs < 24 * 60 * 60 * 1000) return null;
  return now + policy.pauseDurationDays * 24 * 60 * 60 * 1000;
}

/**
 * Inject the unsubscribe footer + open-tracking pixel into a rendered
 * HTML email body. Used post-prepare in flushQueue. No-ops if the
 * relevant policy flag is off, or if the URL is empty.
 */
export function injectEmailExtras(
  body: string,
  opts: {
    unsubscribeUrl?: string | null;
    openPixelUrl?: string | null;
    appendUnsubscribe: boolean;
    appendOpenPixel: boolean;
    appName: string;
    fromAddress: string;
  },
): string {
  let out = body;
  if (opts.appendOpenPixel && opts.openPixelUrl) {
    const pixel = `<img src="${escapeAttr(opts.openPixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
    out = appendBeforeBodyClose(out, pixel);
  }
  if (opts.appendUnsubscribe && opts.unsubscribeUrl) {
    const footer = `\n<table width="100%" style="font-family: Inter, system-ui, sans-serif; padding: 18px 0;"><tr><td align="center">
<div style="font-size:11px; color:#9ba3c7; line-height:1.6;">
  Sent by <strong>${escapeText(opts.appName)}</strong> · ${escapeText(opts.fromAddress)}<br/>
  Don't want these emails? <a href="${escapeAttr(opts.unsubscribeUrl)}" style="color:#9ba3c7; text-decoration:underline;">Unsubscribe with one click</a>.
</div>
</td></tr></table>`;
    out = appendBeforeBodyClose(out, footer);
  }
  return out;
}

function appendBeforeBodyClose(html: string, snippet: string): string {
  const idx = html.lastIndexOf("</body>");
  if (idx < 0) return html + snippet;
  return html.slice(0, idx) + snippet + html.slice(idx);
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "%22").replace(/</g, "%3C").replace(/>/g, "%3E");
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Patch a config-shaped slice with the result of a flush plan: queue
 * statuses + reasons + serverDecision get applied. Pure — caller
 * passes through `setConfig` to commit.
 */
export function applyPlanToQueue(
  queue: QueuedEmail[],
  plan: PlanEntry[],
  prepareResultsById: Record<
    string,
    {
      logId?: string;
      serverDecision?: string;
      unsubscribeUrl?: string;
      openPixelUrl?: string;
    }
  > = {},
): QueuedEmail[] {
  const planById = new Map(plan.map((p) => [p.queued.id, p] as const));
  return queue.map((q) => {
    const p = planById.get(q.id);
    if (!p) return q;
    const prep = prepareResultsById[q.id];
    if (p.outcome === "send") {
      return {
        ...q,
        prepareLogId: prep?.logId,
        serverDecision: prep?.serverDecision,
      };
    }
    return {
      ...q,
      status: p.outcome,
      error: p.reason,
      serverDecision: prep?.serverDecision,
    };
  });
}

// ---- mem0 prepare wrapper -------------------------------------------------

export interface PrepareResult {
  decision:
    | "send"
    | "skip-unsubscribed"
    | "skip-paused"
    | "skip-rate-limit";
  log_id?: string | null;
  unsubscribe_url?: string | null;
  open_pixel_url?: string | null;
  user: {
    email_unsubscribed_at?: number | null;
    email_pause_until?: number | null;
    recent_emails?: Array<{
      id?: string;
      tpl?: string;
      sent_at?: number | null;
      opened_at?: number | null;
      is_transactional?: boolean;
    }>;
  };
}

/** Hit mem0's `/v1/email/admin/prepare`. Returns null on transport
 *  failure so the caller falls back to "send anyway, no tokens". */
export async function callPrepareSend(input: {
  base: string;
  token: string;
  to: string;
  templateId: EmailTemplateId;
  isTransactional: boolean;
}): Promise<PrepareResult | null> {
  try {
    const r = await fetch(`${input.base}/v1/email/admin/prepare`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: input.to,
        template_id: input.templateId,
        is_transactional: input.isTransactional,
      }),
    });
    if (!r.ok) return null;
    return (await r.json()) as PrepareResult;
  } catch {
    return null;
  }
}

export function isPolicyOn(cfg: AdminConfig): boolean {
  return cfg.emailPolicy?.enabled === true;
}
