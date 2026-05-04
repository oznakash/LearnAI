import type { PulseItem } from "../admin/types";
import type { AgeBand } from "../types";

/**
 * Filter a list of Pulse items down to what's appropriate for an
 * audience band.
 *
 *   - kids / teens get items tagged `audience: "kid"` or `"all"`.
 *   - adults get items tagged `audience: "adult"` or `"all"`.
 *   - items with no `audience` field default to `"all"`.
 *
 * Pure — no DOM, no globals. The Home strip uses this so a 12-year-old
 * doesn't see "your stack just shipped Anthropic-grade RAG" trend cards
 * while a frontier engineer doesn't get the kid-tone evergreens.
 */
export function pulseForAudience(
  items: readonly PulseItem[],
  ageBand: AgeBand | undefined
): PulseItem[] {
  if (!items?.length) return [];
  const isKid = ageBand === "kid" || ageBand === "teen";
  return items.filter((item) => {
    const aud = item.audience ?? "all";
    if (aud === "all") return true;
    if (aud === "kid") return isKid;
    if (aud === "adult") return !isKid;
    return true;
  });
}

/**
 * Coarse freshness label for a Pulse item, derived from `addedAt`. The
 * goal is a quiet credibility chip — "Added today" / "Recent" / "Older"
 * — without forcing the operator to manually re-stamp.
 *
 * Pulse items are *intended* to age out quickly (the whole point is
 * "what's hot today"). When the operator cares less about absolute
 * freshness, this still gracefully handles items several months old.
 */
export function pulseFreshness(addedAt: string, now = Date.now()): {
  label: string;
  tone: "fresh" | "recent" | "stale";
} {
  const ts = Date.parse(addedAt);
  if (!Number.isFinite(ts)) return { label: "Recent", tone: "recent" };
  const days = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
  if (days < 1) return { label: "Added today", tone: "fresh" };
  if (days <= 7) return { label: `${days}d ago`, tone: "fresh" };
  if (days <= 30) return { label: `${days}d ago`, tone: "recent" };
  return { label: `${days}d ago`, tone: "stale" };
}
