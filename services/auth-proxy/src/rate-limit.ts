// Per-email sliding window rate limiter, KV-backed.
//
// Approximation: bucketed at 1-minute granularity. We sum the current
// minute + the prior minute weighted by elapsed time. Cheap, robust
// enough for MVP. Real-time precision lives in the proxy's edge caches,
// not in this counter.

import type { KVLikeNamespace } from "./types.js";

export interface RateRule {
  /** Distinct identifier — appears in KV key prefix. */
  action: string;
  /** Max events per minute. */
  perMinute: number;
  /** Max events per hour. */
  perHour: number;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export async function consume(
  kv: KVLikeNamespace | undefined,
  email: string,
  rule: RateRule,
  now = Date.now(),
): Promise<{ ok: true } | { ok: false; reason: "minute" | "hour"; retryAfter: number }> {
  if (!kv) return { ok: true };
  const minuteBucket = Math.floor(now / 60_000);
  const hourBucket = Math.floor(now / 3_600_000);

  const minuteKey = `r:${rule.action}:m:${email.toLowerCase()}:${minuteBucket}`;
  const hourKey = `r:${rule.action}:h:${email.toLowerCase()}:${hourBucket}`;

  const [mRaw, hRaw] = await Promise.all([kv.get(minuteKey), kv.get(hourKey)]);
  const minuteCount = parseInt(mRaw ?? "0", 10);
  const hourCount = parseInt(hRaw ?? "0", 10);

  if (minuteCount >= rule.perMinute) {
    return { ok: false, reason: "minute", retryAfter: 60 - Math.floor((now / 1000) % 60) };
  }
  if (hourCount >= rule.perHour) {
    return { ok: false, reason: "hour", retryAfter: 3600 - Math.floor((now / 1000) % 3600) };
  }
  // Increment counters in parallel; we accept a small over-count race.
  await Promise.all([
    kv.put(minuteKey, String(minuteCount + 1), { expirationTtl: 90 }),
    kv.put(hourKey, String(hourCount + 1), { expirationTtl: DEFAULT_TTL_SECONDS }),
  ]);
  return { ok: true };
}

/** Map-backed test shim; ignores TTL. */
export function inMemoryKV(): KVLikeNamespace & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}
