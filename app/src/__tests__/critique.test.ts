import { describe, expect, it } from "vitest";
import { aggregateCritiques, critiquePatternToPromptStanza } from "../store/critique";
import type { MemoryItem } from "../memory/types";

function mkCritique(
  metadata: Record<string, unknown>,
  i = 0,
): MemoryItem {
  return {
    id: `c-${i}`,
    text: `User critiqued Spark X with chip ${metadata.chip}`,
    category: "critique",
    metadata,
    createdAt: i,
    updatedAt: i,
  };
}

describe("aggregateCritiques", () => {
  it("returns an empty pattern for zero memories", () => {
    const p = aggregateCritiques([]);
    expect(p.total).toBe(0);
    expect(p.byChip["too-theoretical"]).toBe(0);
    expect(p.byContentCategory).toEqual({});
    expect(p.byTeachingShape).toEqual({});
    expect(p.byVocabAtom).toEqual({});
  });

  it("ignores non-critique memories", () => {
    const memories: MemoryItem[] = [
      {
        id: "g-1",
        text: "Goal memory",
        category: "goal",
        metadata: { chip: "too-theoretical" },
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const p = aggregateCritiques(memories);
    expect(p.total).toBe(0);
    expect(p.byChip["too-theoretical"]).toBe(0);
  });

  it("counts chips, categories, shapes, and vocab atoms across memories", () => {
    const memories = [
      mkCritique({
        chip: "too-theoretical",
        sparkCategory: "principle",
        sparkType: "microread",
        vocabAtoms: ["pgvector", "embedding"],
      }, 1),
      mkCritique({
        chip: "too-theoretical",
        sparkCategory: "principle",
        sparkType: "microread",
        vocabAtoms: ["pgvector"],
      }, 2),
      mkCritique({
        chip: "outdated",
        sparkCategory: "tooling",
        sparkType: "tip",
      }, 3),
    ];

    const p = aggregateCritiques(memories);
    expect(p.total).toBe(3);
    expect(p.byChip["too-theoretical"]).toBe(2);
    expect(p.byChip["outdated"]).toBe(1);
    expect(p.byChip["wrong-examples"]).toBe(0);
    expect(p.byContentCategory.principle).toBe(2);
    expect(p.byContentCategory.tooling).toBe(1);
    expect(p.byTeachingShape.microread).toBe(2);
    expect(p.byTeachingShape.tip).toBe(1);
    expect(p.byVocabAtom.pgvector).toBe(2);
    expect(p.byVocabAtom.embedding).toBe(1);
  });

  it("ignores unknown chip ids without throwing", () => {
    const p = aggregateCritiques([
      mkCritique({ chip: "totally-fake-chip" } as Record<string, unknown>, 1),
    ]);
    expect(p.total).toBe(1);
    // Unknown chips do not get a counter but the memory is still counted in `total`.
    expect(Object.values(p.byChip).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("ignores malformed vocabAtoms entries", () => {
    const p = aggregateCritiques([
      mkCritique({
        chip: "too-jargon",
        vocabAtoms: ["RAG", 42, null, undefined, "RAG"],
      } as Record<string, unknown>, 1),
    ]);
    expect(p.total).toBe(1);
    // "RAG" appears twice; only string entries counted.
    expect(p.byVocabAtom.RAG).toBe(2);
    expect(p.byVocabAtom["42"]).toBeUndefined();
  });

  it("handles memories without metadata at all", () => {
    const m: MemoryItem = {
      id: "c-1",
      text: "Critique with no metadata",
      category: "critique",
      createdAt: 1,
      updatedAt: 1,
    };
    const p = aggregateCritiques([m]);
    expect(p.total).toBe(1);
    expect(Object.values(p.byChip).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("critiquePatternToPromptStanza", () => {
  it("returns the empty string when there are zero signals", () => {
    const stanza = critiquePatternToPromptStanza(aggregateCritiques([]));
    expect(stanza).toBe("");
  });

  it("renders a stanza with top chips, categories, shapes, and vocab", () => {
    const memories = [
      mkCritique({
        chip: "too-theoretical",
        sparkCategory: "principle",
        sparkType: "microread",
        vocabAtoms: ["pgvector"],
      }, 1),
      mkCritique({
        chip: "too-theoretical",
        sparkCategory: "principle",
        sparkType: "microread",
        vocabAtoms: ["pgvector"],
      }, 2),
      mkCritique({
        chip: "outdated",
        sparkCategory: "tooling",
        sparkType: "tip",
      }, 3),
    ];
    const stanza = critiquePatternToPromptStanza(aggregateCritiques(memories));
    expect(stanza).toContain("Critique pattern (n=3 signals)");
    expect(stanza).toContain("too-theoretical (2)");
    expect(stanza).toContain("outdated (1)");
    expect(stanza).toContain("principle (2)");
    expect(stanza).toContain("microread (2)");
    expect(stanza).toContain("pgvector (2)");
    expect(stanza).toContain("Prefer concrete, brand-named examples");
  });

  it("ranks chips by frequency descending and caps to top 3", () => {
    const memories = [
      mkCritique({ chip: "too-theoretical" }, 1),
      mkCritique({ chip: "outdated" }, 2),
      mkCritique({ chip: "outdated" }, 3),
      mkCritique({ chip: "too-jargon" }, 4),
      mkCritique({ chip: "too-jargon" }, 5),
      mkCritique({ chip: "too-jargon" }, 6),
      mkCritique({ chip: "wrong-examples" }, 7),
    ];
    const stanza = critiquePatternToPromptStanza(aggregateCritiques(memories));
    const idx = (needle: string) => stanza.indexOf(needle);
    // top-3 line should mention the three winners in descending order.
    expect(idx("too-jargon (3)")).toBeGreaterThan(-1);
    expect(idx("outdated (2)")).toBeGreaterThan(-1);
    expect(idx("too-theoretical (1)")).toBeGreaterThan(-1);
    // wrong-examples (1) should be excluded — only top-3 chips render.
    expect(stanza).not.toContain("wrong-examples (1)");
    expect(idx("too-jargon (3)")).toBeLessThan(idx("outdated (2)"));
    expect(idx("outdated (2)")).toBeLessThan(idx("too-theoretical (1)"));
  });
});
