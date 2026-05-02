import type {
  Exercise,
  GuildTier,
  PlayerState,
  SessionRecord,
  Spark,
  SparkFeedback,
  SparkSignal,
  SparkSignalRecord,
  SparkVote,
  TopicId,
} from "../types";
import { TOPICS, getTopic } from "../content";
import { getRuntimeTuning } from "../admin/runtime";

export const STORAGE_KEY = "builderquest:v1";
/** Default; admin-tuning overrides at runtime via {@link getRuntimeTuning}. */
export const MAX_FOCUS = 5;
/** Default; admin-tuning overrides at runtime via {@link getRuntimeTuning}. */
export const FOCUS_REGEN_MIN = 18;

function tuning() {
  return getRuntimeTuning();
}
export function maxFocus(): number {
  return tuning().focus.max;
}
export function focusRegenMin(): number {
  return tuning().focus.regenMinutes;
}

export function defaultState(): PlayerState {
  return {
    profile: null,
    xp: 0,
    focus: MAX_FOCUS,
    focusUpdatedAt: Date.now(),
    streak: 0,
    streakUpdatedAt: 0,
    badges: [],
    guildTier: "Builder",
    progress: {
      completed: {},
      bossPassed: {},
      topicXP: {},
      topicLastTouched: {},
    },
    history: [],
    tasks: [],
    feedback: [],
    signals: [],
    prefs: { sound: true, haptics: true },
  };
}

/**
 * Reset every progress / personal field on an identity change. Used when
 * a *different* user signs in on a device that already has another user's
 * localStorage from a prior session — without this, the new user would
 * inherit the prior user's XP / streak / sparks / feedback / tasks
 * because the cross-device sync's "server has nothing yet → preserve
 * local" early-return takes effect for first-time signers (see
 * `PlayerContext` hydrate effect).
 *
 * **What we keep:** per-device fields the new user inherits from the
 * device, not from the prior account — `apiKey`, `apiProvider`,
 * `googleClientId`, and `prefs`. Everything else (profile, xp, streak,
 * focus, badges, guildTier, progress, history, tasks, feedback,
 * memoryOptOut) is reset to defaults.
 *
 * The new identity itself is set by the caller; this helper just clears
 * the slate.
 */
export function clearForNewIdentity(prev: PlayerState): PlayerState {
  const fresh = defaultState();
  return {
    ...fresh,
    // Per-device carry-overs:
    apiKey: prev.apiKey,
    apiProvider: prev.apiProvider,
    googleClientId: prev.googleClientId,
    prefs: prev.prefs,
  };
}

export function loadState(): PlayerState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as PlayerState;
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

export function saveState(s: PlayerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function regenFocus(s: PlayerState, now = Date.now()): PlayerState {
  const max = maxFocus();
  const regen = focusRegenMin();
  if (s.focus >= max) return { ...s, focusUpdatedAt: now };
  const elapsedMin = (now - s.focusUpdatedAt) / 1000 / 60;
  const gain = Math.floor(elapsedMin / regen);
  if (gain <= 0) return s;
  return {
    ...s,
    focus: Math.min(max, s.focus + gain),
    focusUpdatedAt: s.focusUpdatedAt + gain * regen * 60 * 1000,
  };
}

export function tierForXP(xp: number): GuildTier {
  const t = tuning().tiers;
  if (xp >= t.singularity) return "Singularity";
  if (xp >= t.founder) return "Founder";
  if (xp >= t.visionary) return "Visionary";
  if (xp >= t.architect) return "Architect";
  return "Builder";
}

/**
 * The XP threshold for the *next* tier above the user's current XP, plus
 * the human-readable tier name. Returns `null` once the user has hit the
 * top tier ("Singularity"). Used by Home / Progress to show a useful
 * scale alongside the Tier ring instead of a bare zero.
 */
export function nextTierThreshold(xp: number): { xp: number; name: GuildTier } | null {
  const t = tuning().tiers;
  if (xp < t.architect) return { xp: t.architect, name: "Architect" };
  if (xp < t.visionary) return { xp: t.visionary, name: "Visionary" };
  if (xp < t.founder) return { xp: t.founder, name: "Founder" };
  if (xp < t.singularity) return { xp: t.singularity, name: "Singularity" };
  return null;
}

/**
 * The user's UX maturity stage. Drives **progressive disclosure** — we
 * don't show a control until the user has earned a need for it.
 *
 *   - `fresh`     : 0–2 Sparks completed. Show only the primary CTA on
 *                   a Spark; hide 👍/👎, 🔍/⏭, `+ Task`, memory nudge,
 *                   the 14-day sparkline (empty anyway), and the cohort
 *                   signal banner.
 *   - `engaged`   : 3+ Sparks completed, ≤ 1 level cleared, single-day
 *                   history. Reveal 👍/👎 + `+ Task`. Still hide 🔍/⏭
 *                   + memory nudge.
 *   - `returning` : 2+ levels cleared OR multi-day history. Full UI.
 *
 * Pure — no globals, no DOM. Only input is `PlayerState`. Trivially
 * testable. See `docs/aha-and-network.md` §5 for the rationale and full
 * disclosure table.
 */
export type UxStage = "fresh" | "engaged" | "returning";

export function uxStage(s: PlayerState, now = Date.now()): UxStage {
  const totalSparks = Object.values(s.progress.completed).reduce(
    (a, ids) => a + ids.length,
    0,
  );
  if (totalSparks < 3) return "fresh";

  const levelsTouched = Object.keys(s.progress.completed).filter(
    (lvl) => (s.progress.completed[lvl] ?? []).length > 0,
  ).length;
  if (levelsTouched >= 2) return "returning";

  if (s.history.length >= 2) {
    const days = new Set(s.history.map((h) => new Date(h.ts).toDateString()));
    days.add(new Date(now).toDateString());
    if (days.size >= 2) return "returning";
  }

  return "engaged";
}

export function xpForExercise(ex: Exercise, correct: boolean): number {
  const t = tuning().xp;
  switch (ex.type) {
    case "microread":
      return t.microread;
    case "tip":
      return ex.bonusXP ?? t.tip;
    case "podcastnugget":
      // Same passive-read shape as Tip — a single, attributed quote +
      // takeaway. Reuse tip-tier XP so we don't bloat GameTuning with
      // a new knob. Per-nugget bonusXP override stays available.
      return ex.bonusXP ?? t.tip;
    case "buildcard":
      return t.buildcard;
    case "quickpick":
      return correct ? t.quickpickCorrect : t.quickpickWrong;
    case "fillstack":
      return correct ? t.fillstackCorrect : t.fillstackWrong;
    case "scenario":
      return correct ? t.scenarioCorrect : t.scenarioWrong;
    case "patternmatch":
      return correct ? t.patternmatchCorrect : t.patternmatchWrong;
    case "boss":
      return correct ? t.bossPass : t.bossFail;
  }
}

export function isCorrectness(ex: Exercise): boolean {
  return (
    ex.type === "quickpick" ||
    ex.type === "fillstack" ||
    ex.type === "scenario" ||
    ex.type === "patternmatch" ||
    ex.type === "boss"
  );
}

export function isToday(ts: number, now = Date.now()) {
  const d1 = new Date(ts);
  const d2 = new Date(now);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isYesterday(ts: number, now = Date.now()) {
  const oneDay = 24 * 60 * 60 * 1000;
  return isToday(ts, now - oneDay);
}

export function bumpStreak(s: PlayerState, now = Date.now()): PlayerState {
  if (isToday(s.streakUpdatedAt, now)) return s;
  if (isYesterday(s.streakUpdatedAt, now)) {
    return { ...s, streak: s.streak + 1, streakUpdatedAt: now };
  }
  // missed: reset
  return { ...s, streak: 1, streakUpdatedAt: now };
}

export interface SparkResult {
  sparkId: string;
  correct: boolean;
  awardedXP: number;
}

export function applySparkResult(
  s: PlayerState,
  topicId: TopicId,
  levelId: string,
  result: SparkResult,
  now = Date.now()
): PlayerState {
  // Replay guard: a Spark can only score once. Re-answering one that is
  // already in the completed set for this level is a no-op — no XP, no
  // focus drain, no streak bump.
  if ((s.progress.completed[levelId] ?? []).includes(result.sparkId)) {
    return s;
  }

  const next = { ...s };
  next.xp = s.xp + result.awardedXP;
  next.guildTier = tierForXP(next.xp);

  // focus drain only on incorrect, only for assessment exercises
  if (!result.correct) {
    next.focus = Math.max(0, s.focus - 1);
    next.focusUpdatedAt = now;
  }

  // mark spark completed
  const completed = { ...s.progress.completed };
  const list = new Set(completed[levelId] ?? []);
  list.add(result.sparkId);
  completed[levelId] = Array.from(list);

  // bump per-topic XP
  const topicXP = { ...s.progress.topicXP };
  topicXP[topicId] = (topicXP[topicId] ?? 0) + result.awardedXP;

  const topicLastTouched = { ...s.progress.topicLastTouched };
  topicLastTouched[topicId] = now;

  next.progress = {
    ...s.progress,
    completed,
    topicXP,
    topicLastTouched,
  };

  return bumpStreak(next, now);
}

export function passBoss(s: PlayerState, levelId: string): PlayerState {
  const bossPassed = { ...s.progress.bossPassed, [levelId]: true };
  return { ...s, progress: { ...s.progress, bossPassed } };
}

export function completedSparkIds(s: PlayerState, levelId: string): string[] {
  return s.progress.completed[levelId] ?? [];
}

/**
 * Set of Spark IDs the user has thumbed-down. These are permanently
 * skipped — never shown again by `nextRecommendedSpark`, and excluded
 * from level/topic completion totals.
 */
export function dislikedSparkIds(s: PlayerState): Set<string> {
  const out = new Set<string>();
  for (const f of s.feedback ?? []) {
    if (f.vote === "down") out.add(f.sparkId);
  }
  return out;
}

/** The user's current vote on a Spark, or null if none. */
export function getSparkVote(s: PlayerState, sparkId: string): SparkVote | null {
  const f = (s.feedback ?? []).find((x) => x.sparkId === sparkId);
  return f ? f.vote : null;
}

/**
 * Set of Spark IDs the user has soft-skipped (`skip-not-now`) within the
 * given timestamp window. Used to filter the *current session's* queue
 * without permanently filtering the Spark — calling code typically
 * passes `Date.now() - <session_start>` as the window.
 *
 * Distinct from {@link dislikedSparkIds}: 👎 is permanent, ⏭ is per-session.
 */
export function softSkippedSparkIds(s: PlayerState, sinceTs = 0): Set<string> {
  const out = new Set<string>();
  for (const sig of s.signals ?? []) {
    if (sig.signal === "skip-not-now" && sig.ts >= sinceTs) {
      out.add(sig.sparkId);
    }
  }
  return out;
}

/**
 * Append a state-of-mind signal record. Multiple records per Spark are
 * allowed (e.g. user zooms in across multiple sessions). Idempotent
 * within the same call only — repeat-callers add a fresh row.
 */
export function recordSparkSignal(
  s: PlayerState,
  sparkId: string,
  signal: SparkSignal,
  opts: { reason?: string; topicId?: TopicId; levelId?: string; ts?: number } = {}
): PlayerState {
  const ts = opts.ts ?? Date.now();
  const next: SparkSignalRecord = {
    sparkId,
    signal,
    reason: opts.reason,
    topicId: opts.topicId,
    levelId: opts.levelId,
    ts,
  };
  return { ...s, signals: [next, ...(s.signals ?? [])] };
}

/**
 * Idempotent vote write: if the user has already cast the same vote on
 * the same spark, returns the state unchanged. Flipping up → down (or
 * vice-versa) overwrites the prior vote and bumps the timestamp.
 */
export function voteOnSpark(
  s: PlayerState,
  sparkId: string,
  vote: SparkVote,
  opts: { reason?: string; topicId?: TopicId; levelId?: string; ts?: number } = {}
): PlayerState {
  const ts = opts.ts ?? Date.now();
  const prior = (s.feedback ?? []).find((f) => f.sparkId === sparkId);
  if (prior && prior.vote === vote && (opts.reason ?? prior.reason) === prior.reason) {
    // No-op when nothing meaningful changes.
    return s;
  }
  const others = (s.feedback ?? []).filter((f) => f.sparkId !== sparkId);
  const next: SparkFeedback = {
    sparkId,
    vote,
    reason: opts.reason ?? prior?.reason,
    topicId: opts.topicId ?? prior?.topicId,
    levelId: opts.levelId ?? prior?.levelId,
    ts,
  };
  return { ...s, feedback: [next, ...others] };
}

export function levelCompletion(
  s: PlayerState,
  topicId: TopicId,
  levelId: string
): { done: number; total: number; pct: number } {
  const t = getTopic(topicId);
  const lvl = t?.levels.find((l) => l.id === levelId);
  // Disliked Sparks are permanently skipped for this user, so they
  // come out of the denominator — a user who dislikes one Spark in a
  // 5-Spark level can still 100%-clear it by completing the other 4.
  const disliked = dislikedSparkIds(s);
  const playable = lvl?.sparks.filter((sp) => !disliked.has(sp.id)) ?? [];
  const total = playable.length;
  const done = completedSparkIds(s, levelId).filter((id) => !disliked.has(id)).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function topicCompletion(s: PlayerState, topicId: TopicId) {
  const t = getTopic(topicId);
  if (!t) return { done: 0, total: 0, pct: 0, levelsDone: 0 };
  const disliked = dislikedSparkIds(s);
  let done = 0;
  let total = 0;
  let levelsDone = 0;
  for (const lvl of t.levels) {
    const playable = lvl.sparks.filter((sp) => !disliked.has(sp.id));
    total += playable.length;
    const d = completedSparkIds(s, lvl.id).filter((id) => !disliked.has(id)).length;
    done += d;
    if (playable.length > 0 && d >= playable.length) levelsDone += 1;
  }
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100), levelsDone };
}

export function isLevelUnlocked(
  s: PlayerState,
  topicId: TopicId,
  levelIndex: number
): boolean {
  if (levelIndex === 1) return true;
  const t = getTopic(topicId);
  if (!t) return false;
  const prev = t.levels.find((l) => l.index === levelIndex - 1);
  if (!prev) return true;
  return s.progress.bossPassed[prev.id] === true || levelCompletion(s, topicId, prev.id).pct >= 100;
}

/**
 * Pick the level the player should land on for `topicId`.
 *
 * Default: linear progression — return the lowest level that isn't 100%
 * complete.
 *
 * Calibrated start: when the player has a `profile.calibratedLevel` and
 * has *no progress at all* on this topic, jump them to the calibrated
 * level (capped at the topic's max) instead of forcing them through L1
 * for content they've already shown they know. As soon as they make any
 * progress in the topic, we resume linear progression — the calibrated
 * jump only fires for fresh topics.
 */
export function nextRecommendedLevel(s: PlayerState, topicId: TopicId) {
  const t = getTopic(topicId);
  if (!t) return null;
  const calibrated = s.profile?.calibratedLevel;
  const hasNoProgress =
    !Object.entries(s.progress.completed).some(([levelId, ids]) => {
      if (ids.length === 0) return false;
      return t.levels.some((l) => l.id === levelId);
    }) &&
    !t.levels.some((l) => s.progress.bossPassed[l.id]);

  if (
    typeof calibrated === "number" &&
    calibrated >= 1 &&
    hasNoProgress &&
    t.levels.length > 0
  ) {
    const target = Math.min(calibrated, t.levels.length);
    const match = t.levels.find((l) => l.index === target);
    if (match) return match;
  }
  for (const lvl of t.levels) {
    const c = levelCompletion(s, topicId, lvl.id);
    if (c.pct < 100) return lvl;
  }
  return null;
}

export function nextRecommendedSpark(
  s: PlayerState,
  topicId: TopicId
): { levelId: string; spark: Spark } | null {
  const t = getTopic(topicId);
  if (!t) return null;
  const disliked = dislikedSparkIds(s);
  for (const lvl of t.levels) {
    if (!isLevelUnlocked(s, topicId, lvl.index)) break;
    const done = new Set(completedSparkIds(s, lvl.id));
    const spark = lvl.sparks.find((sp) => !done.has(sp.id) && !disliked.has(sp.id));
    if (spark) return { levelId: lvl.id, spark };
  }
  return null;
}

export function suggestSwitchTopic(s: PlayerState, currentTopic: TopicId): TopicId | null {
  // Suggest the topic with highest interest match that has been least recently touched
  const interests = s.profile?.interests ?? [];
  const candidates = interests.length > 0 ? interests : TOPICS.map((t) => t.id);
  const others = candidates.filter((id) => id !== currentTopic);
  if (others.length === 0) return null;
  const sorted = [...others].sort(
    (a, b) =>
      (s.progress.topicLastTouched[a] ?? 0) - (s.progress.topicLastTouched[b] ?? 0)
  );
  return sorted[0];
}

export function recordSession(s: PlayerState, rec: SessionRecord): PlayerState {
  const history = [rec, ...s.history].slice(0, 200);
  return { ...s, history };
}

export function activityByDay(s: PlayerState, days = 14) {
  const out: { date: string; sparks: number; minutes: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, sparks: 0, minutes: 0 });
  }
  for (const h of s.history) {
    const key = new Date(h.ts).toISOString().slice(0, 10);
    const day = out.find((d) => d.date === key);
    if (day) {
      day.sparks += h.sparkIds.length;
      day.minutes += h.minutes;
    }
  }
  return out;
}

export function topicAccuracy(s: PlayerState, topicId: TopicId) {
  const recs = s.history.filter((h) => h.topicId === topicId);
  const total = recs.reduce((a, r) => a + r.total, 0);
  const correct = recs.reduce((a, r) => a + r.correct, 0);
  return total === 0 ? null : Math.round((correct / total) * 100);
}

export function timeOnTopic(s: PlayerState, topicId: TopicId) {
  return s.history
    .filter((h) => h.topicId === topicId)
    .reduce((a, r) => a + r.minutes, 0);
}
