import type { SkillLevel, TopicId } from "../types";
import type { CalibrationQuestion } from "../content/calibrationQuestions";

/**
 * The five "slots" a calibration quiz fills, in order. Together they
 * give us a level diagnosis (does the player know level N? N+1? N+2? do
 * they know N-1?) plus a cross-area probe to detect when the player is
 * stronger / weaker outside their primary interest.
 *
 * Each slot is exposed in the result so the scorer can weight the
 * answers — a passed `up2` is much stronger evidence of competence than
 * a passed `down1`.
 */
export type CalibrationSlot = "anchor" | "up1" | "up2" | "down1" | "cross";

export interface SelectedQuestion {
  question: CalibrationQuestion;
  slot: CalibrationSlot;
}

export interface SelectInput {
  pool: CalibrationQuestion[];
  claimedSkillLevel: SkillLevel;
  /**
   * Numeric calibrated level from a previous calibration, if any. When
   * present, takes precedence over `claimedSkillLevel` as the anchor.
   * This makes repeat calibrations sharper — we probe around the latest
   * known level, not the original onboarding claim.
   */
  calibratedLevel?: number;
  /** Topics the player tagged as interests. First one is primary. */
  interests: TopicId[];
  /** Question ids the player has already seen — excluded when possible. */
  seenIds?: string[];
  /** Total questions to include. Defaults to 5. */
  size?: number;
  /** Deterministic RNG for tests. Defaults to Math.random. */
  rng?: () => number;
}

const SKILL_TO_LEVEL: Record<SkillLevel, number> = {
  starter: 2,
  explorer: 4,
  builder: 6,
  architect: 8,
  visionary: 9,
};

const MIN_LEVEL = 1;
const MAX_LEVEL = 10;

/** Internal: clamp helper. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Resolve the player's anchor level. Prefers the latest calibrated
 * level (if any); otherwise maps the onboarding `SkillLevel` band to a
 * representative numeric level.
 */
export function anchorLevel(
  claimed: SkillLevel,
  calibrated: number | undefined
): number {
  if (
    typeof calibrated === "number" &&
    Number.isFinite(calibrated) &&
    calibrated >= MIN_LEVEL &&
    calibrated <= MAX_LEVEL
  ) {
    return Math.round(calibrated);
  }
  return SKILL_TO_LEVEL[claimed] ?? 4;
}

/** Levels each slot targets, given an anchor. */
export function slotTargets(anchor: number): Record<CalibrationSlot, number> {
  return {
    down1: clamp(anchor - 1, MIN_LEVEL, MAX_LEVEL),
    anchor: clamp(anchor, MIN_LEVEL, MAX_LEVEL),
    up1: clamp(anchor + 1, MIN_LEVEL, MAX_LEVEL),
    up2: clamp(anchor + 2, MIN_LEVEL, MAX_LEVEL),
    cross: clamp(anchor, MIN_LEVEL, MAX_LEVEL),
  };
}

/** Fisher-Yates shuffle — pure, RNG-driven so tests can pin a seed. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * Pick one question for a slot, given a target level + topic constraint.
 *
 * Relaxation ladder (each step happens only if the prior pool was empty):
 *   1. Exact level + matching topic constraint, unseen, not already picked.
 *   2. Same as (1) but allow ±1 level.
 *   3. Same as (2) but allow ±2 levels.
 *   4. Drop the topic constraint, keep the seen + ±2 level filter.
 *   5. Drop the seen filter (let the player see a familiar question rather
 *      than fail to fill the slot).
 *
 * Returns `undefined` only if the entire pool is empty.
 */
function pickForSlot(
  pool: CalibrationQuestion[],
  targetLevel: number,
  topicFilter: ((q: CalibrationQuestion) => boolean) | null,
  alreadyPicked: Set<string>,
  seenIds: Set<string>,
  rng: () => number
): CalibrationQuestion | undefined {
  const layers: ((q: CalibrationQuestion) => boolean)[] = [
    (q) => Math.abs(q.level - targetLevel) === 0 && (topicFilter ? topicFilter(q) : true),
    (q) => Math.abs(q.level - targetLevel) <= 1 && (topicFilter ? topicFilter(q) : true),
    (q) => Math.abs(q.level - targetLevel) <= 2 && (topicFilter ? topicFilter(q) : true),
    (q) => Math.abs(q.level - targetLevel) <= 2,
    () => true,
  ];

  for (let i = 0; i < layers.length; i++) {
    const dropSeen = i >= layers.length - 1;
    const candidates = pool.filter(
      (q) =>
        !alreadyPicked.has(q.id) &&
        (dropSeen || !seenIds.has(q.id)) &&
        layers[i](q)
    );
    if (candidates.length > 0) {
      const sorted = candidates.slice().sort((a, b) => {
        const da = Math.abs(a.level - targetLevel);
        const db = Math.abs(b.level - targetLevel);
        return da - db;
      });
      // Among ties on level distance, randomise so repeat sessions vary.
      const minDist = Math.abs(sorted[0].level - targetLevel);
      const tied = sorted.filter(
        (q) => Math.abs(q.level - targetLevel) === minDist
      );
      const shuffled = shuffle(tied, rng);
      return shuffled[0];
    }
  }
  return undefined;
}

/**
 * Build the 5-question calibration quiz: anchor + up1 + up2 + down1 +
 * cross-area probe. Avoids ids the player has already seen, prefers
 * their primary interest for the level probes, and forces the cross
 * probe to a *different* topic. Pure (modulo `rng`) — safe to test.
 */
export function selectCalibrationQuiz(input: SelectInput): SelectedQuestion[] {
  const {
    pool,
    claimedSkillLevel,
    calibratedLevel,
    interests,
    seenIds = [],
    size = 5,
    rng = Math.random,
  } = input;

  if (pool.length === 0) return [];

  const anchor = anchorLevel(claimedSkillLevel, calibratedLevel);
  const targets = slotTargets(anchor);
  const primary = interests[0];
  const seen = new Set(seenIds);
  const picked = new Set<string>();
  const out: SelectedQuestion[] = [];

  // The order matters: we fill the cheapest-to-satisfy slots first
  // (anchor, level probes) before the more constrained cross-area probe.
  const order: { slot: CalibrationSlot; level: number; topicFilter: ((q: CalibrationQuestion) => boolean) | null }[] = [
    {
      slot: "anchor",
      level: targets.anchor,
      topicFilter: primary ? (q) => q.topic === primary : null,
    },
    {
      slot: "up1",
      level: targets.up1,
      topicFilter: primary ? (q) => q.topic === primary : null,
    },
    {
      slot: "up2",
      level: targets.up2,
      topicFilter: primary ? (q) => q.topic === primary : null,
    },
    {
      slot: "down1",
      level: targets.down1,
      topicFilter: primary ? (q) => q.topic === primary : null,
    },
    {
      slot: "cross",
      level: targets.cross,
      topicFilter: primary ? (q) => q.topic !== primary : null,
    },
  ];

  for (const step of order.slice(0, size)) {
    const q = pickForSlot(pool, step.level, step.topicFilter, picked, seen, rng);
    if (q) {
      picked.add(q.id);
      out.push({ question: q, slot: step.slot });
    }
  }

  // Defensive: if any slot couldn't fill (small pool), top up with anything fresh.
  while (out.length < size) {
    const q = pickForSlot(pool, anchor, null, picked, seen, rng);
    if (!q) break;
    picked.add(q.id);
    out.push({ question: q, slot: "anchor" });
  }

  return out;
}
