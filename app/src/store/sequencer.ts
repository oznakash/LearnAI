/**
 * Session sequencer — workstream (a) of the content-experience plan.
 *
 * Today the level fires its 4–6 Sparks in fixed order. That sometimes
 * lands two passive Sparks (📖 MicroRead / 💡 Tip / 🎙️ PodcastNugget)
 * back-to-back, which fatigues the user faster than necessary. The
 * sequencer enforces a single, soft rule:
 *
 *    **No two passive Sparks back-to-back inside a session.**
 *
 * If the next-in-original-order Spark would be the *second* passive
 * Spark in a row, we look ahead in the remaining queue for a doing-Spark
 * (🎯 QuickPick / 🧩 FillStack / 🔗 PatternMatch / 🧪 Scenario / 🛠️
 * BuildCard) and swap it forward. If none is available (the rest of the
 * level is all passive), we fall back to the original order — the
 * sequencer never *creates* a Spark or skips one.
 *
 * Boss Sparks (👾) are always last in their level — the sequencer never
 * reorders them. Disliked Sparks are filtered upstream via
 * `dislikedSparkIds()`.
 *
 * **Aggressiveness — signed off:** start soft (this single rule),
 * measure, then turn up. mem0-driven re-ranking is intentionally
 * deferred. See `docs/content-experience-plan.md`.
 */

import type { ExerciseType, Spark } from "../types";

/** Spark types that *don't* require user input — the "fatigue" risks. */
const PASSIVE_TYPES: ReadonlySet<ExerciseType> = new Set([
  "microread",
  "tip",
  "podcastnugget",
]);

/** Spark types that *do* require user input — the "engagement" rewards. */
const DOING_TYPES: ReadonlySet<ExerciseType> = new Set([
  "quickpick",
  "fillstack",
  "patternmatch",
  "scenario",
  "buildcard",
]);

export function isPassive(t: ExerciseType): boolean {
  return PASSIVE_TYPES.has(t);
}

export function isDoing(t: ExerciseType): boolean {
  return DOING_TYPES.has(t);
}

/**
 * Pick the index of the next Spark to show. Pure — given the same inputs
 * always returns the same output.
 *
 * @param sparks       The level's full Spark array, in original order.
 * @param currentIdx   The index of the Spark just shown (or -1 at session start).
 * @param skipIds      Spark ids to skip entirely (completed and/or disliked).
 * @param lastShown    The exercise type of the Spark just shown (or null).
 * @returns            The next idx to render, or -1 if none remain.
 */
export function pickNextSparkIdx(
  sparks: readonly Spark[],
  currentIdx: number,
  skipIds: ReadonlySet<string>,
  lastShown: ExerciseType | null,
): number {
  const candidates: number[] = [];
  for (let i = currentIdx + 1; i < sparks.length; i++) {
    if (skipIds.has(sparks[i].id)) continue;
    candidates.push(i);
  }
  if (candidates.length === 0) return -1;

  // Default = first candidate (preserves original level order).
  const firstIdx = candidates[0];
  const firstType = sparks[firstIdx].exercise.type;

  // Boss is always last — never reorder past or around it.
  if (firstType === "boss") return firstIdx;

  // The single soft rule: avoid two passive Sparks back-to-back.
  if (lastShown && isPassive(lastShown) && isPassive(firstType)) {
    // Look ahead for a doing-Spark we can swap forward. We don't reorder
    // past a Boss Spark (Boss must remain last).
    for (const candIdx of candidates) {
      const cand = sparks[candIdx];
      if (cand.exercise.type === "boss") break;
      if (isDoing(cand.exercise.type)) return candIdx;
    }
    // No doing-Spark available — fall back to original order. The
    // sequencer never invents content.
    return firstIdx;
  }

  return firstIdx;
}
