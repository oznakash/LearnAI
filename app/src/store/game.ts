import type {
  Exercise,
  GuildTier,
  PlayerState,
  SessionRecord,
  Spark,
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
    prefs: { sound: true, haptics: true },
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

export function xpForExercise(ex: Exercise, correct: boolean): number {
  const t = tuning().xp;
  switch (ex.type) {
    case "microread":
      return t.microread;
    case "tip":
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

export function levelCompletion(
  s: PlayerState,
  topicId: TopicId,
  levelId: string
): { done: number; total: number; pct: number } {
  const t = getTopic(topicId);
  const lvl = t?.levels.find((l) => l.id === levelId);
  const total = lvl?.sparks.length ?? 0;
  const done = completedSparkIds(s, levelId).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function topicCompletion(s: PlayerState, topicId: TopicId) {
  const t = getTopic(topicId);
  if (!t) return { done: 0, total: 0, pct: 0, levelsDone: 0 };
  let done = 0;
  let total = 0;
  let levelsDone = 0;
  for (const lvl of t.levels) {
    total += lvl.sparks.length;
    const d = completedSparkIds(s, lvl.id).length;
    done += d;
    if (d >= lvl.sparks.length) levelsDone += 1;
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

export function nextRecommendedLevel(s: PlayerState, topicId: TopicId) {
  const t = getTopic(topicId);
  if (!t) return null;
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
  for (const lvl of t.levels) {
    if (!isLevelUnlocked(s, topicId, lvl.index)) break;
    const done = new Set(completedSparkIds(s, lvl.id));
    const spark = lvl.sparks.find((sp) => !done.has(sp.id));
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
