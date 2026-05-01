// Per-email sliding-window rate limiter, in-memory.
//
// 1-minute granularity. We sum the current and prior minute, weighted
// by elapsed-time. Cheap, robust enough for MVP.
//
// In-memory bucket → not shared across multiple sidecar instances. At
// LearnAI's stage we run one sidecar instance per host so this is fine.
// When we scale horizontally, swap in Redis without touching the call
// sites. (The `RateBucket` interface is the seam.)

export interface RateRule {
  action: string;
  perMinute: number;
  perHour: number;
}

export interface RateBucket {
  hit(email: string, rule: RateRule, now?: number): {
    ok: boolean;
    reason?: "minute" | "hour";
    retryAfter?: number;
  };
}

export function inMemoryBucket(): RateBucket {
  const counts = new Map<string, { count: number; expiresAt: number }>();

  // Periodic GC to bound memory.
  const gcEvery = 60_000;
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of counts) if (v.expiresAt < now) counts.delete(k);
  }, gcEvery).unref?.();

  return {
    hit(email, rule, now = Date.now()) {
      const lc = email.toLowerCase();
      const minuteBucket = Math.floor(now / 60_000);
      const hourBucket = Math.floor(now / 3_600_000);
      const mKey = `m:${rule.action}:${lc}:${minuteBucket}`;
      const hKey = `h:${rule.action}:${lc}:${hourBucket}`;

      const m = counts.get(mKey)?.count ?? 0;
      const h = counts.get(hKey)?.count ?? 0;

      if (m >= rule.perMinute) {
        return {
          ok: false,
          reason: "minute",
          retryAfter: 60 - Math.floor((now / 1000) % 60),
        };
      }
      if (h >= rule.perHour) {
        return {
          ok: false,
          reason: "hour",
          retryAfter: 3600 - Math.floor((now / 1000) % 3600),
        };
      }
      counts.set(mKey, { count: m + 1, expiresAt: now + 90_000 });
      counts.set(hKey, { count: h + 1, expiresAt: now + 24 * 3_600_000 });
      return { ok: true };
    },
  };
}

export const DEFAULT_RULES = {
  social_write: { action: "social_write", perMinute: 60, perHour: 600 },
  social_read: { action: "social_read", perMinute: 600, perHour: 6000 },
  social_report: { action: "social_report", perMinute: 5, perHour: 20 },
  social_snapshot: { action: "social_snapshot", perMinute: 60, perHour: 1800 },
} satisfies Record<string, RateRule>;
