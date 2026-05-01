import { useMemo, useState } from "react";
import type { VocabAtom } from "../types";

/**
 * Renders Spark body text with each {@link VocabAtom.term} occurrence
 * wrapped as a tappable underline. Tapping reveals an inline
 * definition strip directly below the body, with an optional
 * "🔍 Zoom in on this →" link that fires the `zoom` signal carrying
 * the term as the reason.
 *
 * Behavior:
 *   - First occurrence of each term is tappable; subsequent ones in the
 *     same body are not (avoids visual noise; one entry-point per term).
 *   - Match is case-insensitive but the rendered text preserves the
 *     original casing in the body.
 *   - Match is word-boundary aware (no partial-token underlines, e.g.
 *     "RAG" won't match inside "garage").
 *   - When `vocab` is empty / undefined, body renders identical to a
 *     plain `<p>` — fully back-compat for the 480 existing Sparks.
 */
export function VocabBody({
  body,
  vocab,
  className = "",
  onTermTap,
  onZoom,
}: {
  body: string;
  vocab?: VocabAtom[];
  className?: string;
  /**
   * Fires when the user opens a term's definition. Lets the parent
   * write a `vocabulary`-category memory.
   */
  onTermTap?: (term: string, definition: string) => void;
  /**
   * Fires when the user taps "🔍 Zoom in on this →" inside the
   * inline definition strip. The parent typically forwards to
   * `signalSpark(spark.id, "zoom", { reason: \`Wants more on: ${term}\` })`.
   */
  onZoom?: (term: string) => void;
}) {
  const [activeTerm, setActiveTerm] = useState<string | null>(null);

  const segments = useMemo(() => splitBodyByVocab(body, vocab ?? []), [body, vocab]);

  const onTap = (term: string, definition: string) => {
    if (activeTerm === term) {
      setActiveTerm(null);
      return;
    }
    setActiveTerm(term);
    onTermTap?.(term, definition);
  };

  const activeAtom =
    activeTerm && vocab
      ? vocab.find((v) => v.term.toLowerCase() === activeTerm.toLowerCase()) ?? null
      : null;

  return (
    <div>
      <p className={`text-white/85 leading-relaxed text-[15px] ${className}`}>
        {segments.map((seg, i) =>
          seg.kind === "text" ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => onTap(seg.term, seg.definition)}
              aria-expanded={activeTerm === seg.term}
              aria-label={`Define ${seg.term}`}
              className={`underline decoration-dotted decoration-accent/70 underline-offset-4 transition px-0.5 ${
                activeTerm === seg.term
                  ? "text-accent decoration-accent"
                  : "text-white hover:text-accent hover:decoration-solid"
              }`}
            >
              {seg.text}
            </button>
          ),
        )}
      </p>
      {activeAtom && (
        <div className="mt-3 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-semibold text-accent">{activeAtom.term}</span>
            <span className="text-white/85">— {activeAtom.definition}</span>
          </div>
          {onZoom && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onZoom(activeAtom.term)}
                className="text-xs text-accent hover:underline"
                aria-label={`Zoom in on ${activeAtom.term}`}
              >
                🔍 Zoom in on this →
              </button>
              <button
                type="button"
                onClick={() => setActiveTerm(null)}
                className="text-xs text-white/40 hover:text-white/70"
              >
                close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- pure helpers (exported for tests) -------------------------------------

export type BodySegment =
  | { kind: "text"; text: string }
  | { kind: "term"; term: string; definition: string; text: string };

/**
 * Splits a Spark body into a flat list of text and term segments. Each
 * vocabulary term is matched at most once (its first occurrence). The
 * matcher is word-boundary aware (no partial matches) and case-
 * insensitive, but the matched substring keeps its original casing.
 *
 * Pure — no globals, no DOM. Trivially testable.
 */
export function splitBodyByVocab(body: string, vocab: VocabAtom[]): BodySegment[] {
  if (!vocab.length) return [{ kind: "text", text: body }];

  // Build a map keyed by lowercased term → atom; longest first so multi-
  // word terms beat their substrings.
  const sortedVocab = [...vocab].sort((a, b) => b.term.length - a.term.length);
  const remaining = new Set(sortedVocab.map((v) => v.term.toLowerCase()));
  const out: BodySegment[] = [];

  let cursor = 0;
  while (cursor < body.length && remaining.size > 0) {
    let earliest: { idx: number; atom: VocabAtom; len: number } | null = null;
    for (const atom of sortedVocab) {
      if (!remaining.has(atom.term.toLowerCase())) continue;
      const idx = findWordBoundary(body, atom.term, cursor);
      if (idx === -1) continue;
      if (!earliest || idx < earliest.idx) {
        earliest = { idx, atom, len: atom.term.length };
      }
    }
    if (!earliest) break;
    if (earliest.idx > cursor) {
      out.push({ kind: "text", text: body.slice(cursor, earliest.idx) });
    }
    out.push({
      kind: "term",
      term: earliest.atom.term,
      definition: earliest.atom.definition,
      text: body.slice(earliest.idx, earliest.idx + earliest.len),
    });
    remaining.delete(earliest.atom.term.toLowerCase());
    cursor = earliest.idx + earliest.len;
  }
  if (cursor < body.length) {
    out.push({ kind: "text", text: body.slice(cursor) });
  }
  return out;
}

function findWordBoundary(body: string, term: string, fromIdx: number): number {
  const lowerBody = body.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let i = lowerBody.indexOf(lowerTerm, fromIdx);
  while (i !== -1) {
    const before = i === 0 ? "" : body[i - 1];
    const after = body[i + lowerTerm.length] ?? "";
    const beforeOk = before === "" || !/[\w]/.test(before);
    const afterOk = after === "" || !/[\w]/.test(after);
    if (beforeOk && afterOk) return i;
    i = lowerBody.indexOf(lowerTerm, i + 1);
  }
  return -1;
}
