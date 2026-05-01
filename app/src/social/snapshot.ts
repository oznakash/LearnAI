// Build a `PlayerSnapshot` from two consecutive `PlayerState` values.
//
// The SPA owns the source of truth for game state (XP, streak, tier,
// progress). `social-svc` only sees a public-safe projection of it,
// fed via fire-and-forget `pushSnapshot` calls. This helper is the
// diff: given prev + next, what fields changed and what new
// stream-worthy events happened?
//
// Idempotency: every event row carries a stable `clientId` (UUID-ish)
// derived from `email + kind + topicId + level + timestamp` so that
// React StrictMode's double-fire (or any retry) doesn't multiply
// rows on the server.
//
// Critical UX-path rule: this helper must be cheap to call on every
// state change. No expensive recomputation; no awaits inside; no
// allocations beyond the snapshot object itself.

import type { PlayerState, TopicId, GuildTier } from "../types";
import type { PlayerSnapshot } from "./types";
import { tierForXP } from "../store/game";

export interface SnapshotContext {
  /** ms-resolution clock; injected for tests. */
  now?: number;
  /** Previous player state, or null on first call after sign-in. */
  prev: PlayerState | null;
  next: PlayerState;
}

const STREAK_MILESTONES = new Set([7, 30, 100]);

/** Hash-stable clientId so retries collapse server-side. */
function clientId(parts: (string | number | undefined)[]): string {
  return parts.filter((p) => p !== undefined && p !== "").join("|");
}

/**
 * Compute a snapshot. Returns null when there's nothing to send (e.g.,
 * before sign-in). Caller should guard the resulting `pushSnapshot`
 * with `withSocialGuard`.
 */
export function buildSnapshot(ctx: SnapshotContext): PlayerSnapshot | null {
  const { prev, next, now = Date.now() } = ctx;
  if (!next.identity?.email) return null;

  const xpTotal = next.xp ?? 0;
  const guildTier = next.guildTier ?? tierForXP(xpTotal);

  // Aggregated topic XP: sum from progress.topicXP.
  const topicXp: Partial<Record<TopicId, number>> =
    next.progress?.topicXP ?? {};

  // 14-day activity: count Sparks per day from history (oldest first).
  const activity14d: number[] = computeActivity14d(next, now);

  // Pick the most recently-touched topic + the level the player is at.
  const lastTopic = mostRecentTopic(next);
  const currentTopicId: TopicId | undefined = lastTopic?.topicId;
  const currentLevel = lastTopic?.levelIndex;

  // Window bound on `to` for idempotent server upsert.
  const fromTs = prev?.history?.[prev.history.length - 1]?.ts ?? 0;
  const clientWindow = { from: fromTs, to: now };

  // Stream events: diff of meaningful state changes.
  const events: PlayerSnapshot["events"] = [];
  const email = next.identity.email;

  // Level-up: did `currentLevel` advance vs. prev?
  if (
    prev &&
    currentTopicId &&
    currentLevel != null &&
    prevLevelFor(prev, currentTopicId) < currentLevel
  ) {
    events.push({
      kind: "level_up",
      topicId: currentTopicId,
      level: currentLevel,
      clientId: clientId([email, "level_up", currentTopicId, currentLevel]),
    });
  }

  // Boss beaten: scan recent history.
  if (prev) {
    const prevBosses = countBossPasses(prev);
    const nextBosses = countBossPasses(next);
    if (nextBosses > prevBosses) {
      const last = next.history?.[next.history.length - 1];
      events.push({
        kind: "boss_beaten",
        topicId: last?.topicId,
        level: last?.levelId ? parseInt(last.levelId.split("-").pop() ?? "0", 10) : undefined,
        clientId: clientId([email, "boss_beaten", last?.topicId, last?.levelId]),
      });
    }
  }

  // Streak milestone.
  if (prev && STREAK_MILESTONES.has(next.streak ?? 0) && (prev.streak ?? 0) < (next.streak ?? 0)) {
    events.push({
      kind: "streak_milestone",
      detail: { streak: next.streak },
      clientId: clientId([email, "streak", next.streak]),
    });
  }

  return {
    xpTotal,
    xpWeek: computeXpWindow(next, now, 7),
    xpMonth: computeXpWindow(next, now, 30),
    streak: next.streak ?? 0,
    guildTier,
    currentTopicId,
    currentLevel,
    badges: next.badges ?? [],
    topicXp,
    activity14d,
    events,
    clientWindow,
  };
}

// -- helpers --------------------------------------------------------------

function computeActivity14d(state: PlayerState, now: number): number[] {
  const days = new Array(14).fill(0);
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  for (const session of state.history ?? []) {
    // Bucket the session into its own day-start, then compute the
    // whole-day offset back to today. offset 0 = today, 1 = yesterday.
    const sessionDay = new Date(session.ts);
    sessionDay.setHours(0, 0, 0, 0);
    const offset = Math.round((todayMs - sessionDay.getTime()) / dayMs);
    if (offset >= 0 && offset < 14) {
      // Index 0 = oldest (13 days ago), 13 = today.
      days[13 - offset] += session.sparkIds?.length ?? 0;
    }
  }
  return days;
}

function computeXpWindow(state: PlayerState, now: number, days: number): number {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  let xp = 0;
  for (const session of state.history ?? []) {
    if (session.ts >= cutoff) xp += session.correct * 12; // rough — exact tuning lives in admin
  }
  return xp;
}

function mostRecentTopic(state: PlayerState):
  | { topicId: TopicId; levelIndex: number }
  | null {
  const last = state.history?.[state.history.length - 1];
  if (!last) return null;
  // levelId looks like `<topicId>-<n>`; extract the trailing integer.
  const parts = last.levelId?.split("-") ?? [];
  const levelIndex = parseInt(parts[parts.length - 1] ?? "0", 10) || 0;
  return { topicId: last.topicId, levelIndex };
}

function prevLevelFor(state: PlayerState, topicId: TopicId): number {
  let max = 0;
  for (const s of state.history ?? []) {
    if (s.topicId !== topicId) continue;
    const parts = s.levelId?.split("-") ?? [];
    const level = parseInt(parts[parts.length - 1] ?? "0", 10) || 0;
    if (level > max) max = level;
  }
  return max;
}

function countBossPasses(state: PlayerState): number {
  return Object.values(state.progress?.bossPassed ?? {}).filter(Boolean).length;
}

/**
 * Test helper: produces a guild tier from XP. Re-exported here so the
 * snapshot module is the single import for the snapshot pipeline.
 */
export function tierFromXp(xp: number): GuildTier {
  return tierForXP(xp);
}

/**
 * Stable, content-only signature of the aggregate fields a snapshot
 * upserts on the server. Used by the push pipeline to skip redundant
 * `pushSnapshot` calls when the player hasn't actually changed —
 * e.g. when the 60s focus-regen tick produces a new state ref but the
 * same XP/streak/tier/topic-XP. Excludes `clientWindow` and `activity14d`
 * (both monotonic with wall-clock — would defeat dedup) and `events`
 * (caller decides whether new events force a send).
 *
 * Privacy: derived from local fields only — never includes email, JWT,
 * or any cross-user data. Safe to keep in a React ref between renders.
 */
export function snapshotSignature(snap: PlayerSnapshot): string {
  // Sort topicXp keys so two snapshots with the same data but different
  // insertion order produce the same signature.
  const topicXpEntries = Object.entries(snap.topicXp ?? {})
    .filter(([, v]) => typeof v === "number")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
  const badges = [...(snap.badges ?? [])].sort().join(",");
  return [
    `xp:${snap.xpTotal}`,
    `streak:${snap.streak}`,
    `tier:${snap.guildTier}`,
    `topic:${snap.currentTopicId ?? ""}`,
    `lvl:${snap.currentLevel ?? ""}`,
    `topicXp:${topicXpEntries}`,
    `badges:${badges}`,
  ].join("|");
}
