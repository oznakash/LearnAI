/**
 * Critique aggregation — the meta-implicit refinement loop.
 *
 * At small N (< 1k users), per-Spark vote counts are statistical noise.
 * Eight-up / three-down on a single Spark tells us almost nothing. The
 * fix isn't "wait for scale." The fix is to **collect the *why* in
 * structured chips** and **apply it generically** — so 50 users worth
 * of critique signal can shape thousands of future Sparks via the
 * generation prompt bias.
 *
 * See `docs/content-freshness.md` §5 for the full doctrine. This module
 * is the pure aggregation layer; the prompt-bias renderer that consumes
 * it lives next to the future content engine.
 */

import type { MemoryItem } from "../memory/types";
import type { CritiqueChipId } from "../components/SparkThumbsRow";
import type { ExerciseType, SparkCategory } from "../types";

export interface CritiquePattern {
  /** Total number of critique signals aggregated. */
  total: number;
  /** Counts grouped by chip — `too-theoretical: 12`, `outdated: 8`, … */
  byChip: Record<CritiqueChipId, number>;
  /**
   * Counts grouped by content category — `tooling: 14, principle: 3`.
   * Reveals which categories age fastest in user perception.
   */
  byContentCategory: Partial<Record<SparkCategory, number>>;
  /**
   * Counts grouped by Spark type — `microread: 9, podcastnugget: 4`.
   * Reveals which teaching shapes the user has been critical of.
   */
  byTeachingShape: Partial<Record<ExerciseType, number>>;
  /**
   * Counts grouped by individual vocab atom (when present in metadata).
   * Reveals jargon hot-spots — terms that recur in critiqued Sparks.
   */
  byVocabAtom: Record<string, number>;
}

const EMPTY_PATTERN: CritiquePattern = {
  total: 0,
  byChip: {
    "too-theoretical": 0,
    "wrong-examples": 0,
    outdated: 0,
    "too-jargon": 0,
    "watered-down": 0,
    "wrong-level": 0,
    "too-long": 0,
  },
  byContentCategory: {},
  byTeachingShape: {},
  byVocabAtom: {},
};

/**
 * Aggregate `critique`-category memories into a `CritiquePattern` that
 * can be folded into the next content-generation prompt. Pure — no
 * globals, no DOM. The caller is responsible for passing only memories
 * with `category === "critique"`.
 */
export function aggregateCritiques(memories: MemoryItem[]): CritiquePattern {
  const out: CritiquePattern = {
    total: 0,
    byChip: { ...EMPTY_PATTERN.byChip },
    byContentCategory: {},
    byTeachingShape: {},
    byVocabAtom: {},
  };

  for (const m of memories) {
    if (m.category !== "critique") continue;
    out.total += 1;

    const meta = m.metadata ?? {};
    const chip = meta.chip as CritiqueChipId | undefined;
    if (chip && chip in out.byChip) {
      out.byChip[chip] = (out.byChip[chip] ?? 0) + 1;
    }

    const sparkCategory = meta.sparkCategory as SparkCategory | undefined;
    if (sparkCategory) {
      out.byContentCategory[sparkCategory] =
        (out.byContentCategory[sparkCategory] ?? 0) + 1;
    }

    const sparkType = meta.sparkType as ExerciseType | undefined;
    if (sparkType) {
      out.byTeachingShape[sparkType] =
        (out.byTeachingShape[sparkType] ?? 0) + 1;
    }

    const vocab = meta.vocabAtoms;
    if (Array.isArray(vocab)) {
      for (const term of vocab) {
        if (typeof term === "string") {
          out.byVocabAtom[term] = (out.byVocabAtom[term] ?? 0) + 1;
        }
      }
    }
  }

  return out;
}

/**
 * Render the pattern as a prompt-stanza text that future content
 * generation can append to its system prompt. Returns empty string when
 * `total === 0` (don't pollute the prompt with "no critiques observed").
 *
 * The format is intentionally short — a few hundred tokens at most —
 * because every generation call pays for it.
 */
export function critiquePatternToPromptStanza(p: CritiquePattern): string {
  if (p.total === 0) return "";
  const topChips = Object.entries(p.byChip)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => `${id} (${n})`);
  const topCategories = Object.entries(p.byContentCategory)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2)
    .map(([cat, n]) => `${cat} (${n})`);
  const topShapes = Object.entries(p.byTeachingShape)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2)
    .map(([t, n]) => `${t} (${n})`);
  const topVocab = Object.entries(p.byVocabAtom)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term, n]) => `${term} (${n})`);

  const lines: string[] = [
    `\n--- Critique pattern (n=${p.total} signals) ---`,
    `Avoid:`,
  ];
  if (topChips.length) lines.push(`  - top critiques: ${topChips.join(", ")}`);
  if (topCategories.length) lines.push(`  - critiques cluster on categories: ${topCategories.join(", ")}`);
  if (topShapes.length) lines.push(`  - teaching shapes critiqued recently: ${topShapes.join(", ")}`);
  if (topVocab.length) lines.push(`  - vocab atoms in critiqued Sparks: ${topVocab.join(", ")}`);
  lines.push(
    `Prefer concrete, brand-named examples. Cite a real source. Keep body under 120 words. Match the user's age band when authoring tonally-charged sections.`,
  );
  return lines.join("\n");
}
