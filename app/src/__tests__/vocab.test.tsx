import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VocabBody, splitBodyByVocab } from "../components/VocabBody";
import { SEED_TOPICS } from "../content";
import type { VocabAtom } from "../types";

describe("splitBodyByVocab — pure helper", () => {
  it("returns the body as a single text segment when vocab is empty", () => {
    const segs = splitBodyByVocab("hello world", []);
    expect(segs).toEqual([{ kind: "text", text: "hello world" }]);
  });

  it("splits around a single term, preserving original casing", () => {
    const vocab: VocabAtom[] = [{ term: "Pinecone", definition: "A vector DB" }];
    const segs = splitBodyByVocab("Use Pinecone or pgvector.", vocab);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ kind: "text", text: "Use " });
    expect(segs[1]).toMatchObject({ kind: "term", term: "Pinecone", text: "Pinecone" });
    expect(segs[2]).toEqual({ kind: "text", text: " or pgvector." });
  });

  it("matches case-insensitively but keeps the body's casing", () => {
    const vocab: VocabAtom[] = [{ term: "PINECONE", definition: "A vector DB" }];
    const segs = splitBodyByVocab("We tried Pinecone in prod.", vocab);
    expect(segs[1]).toMatchObject({ kind: "term", text: "Pinecone" });
  });

  it("only matches the FIRST occurrence of each term (avoids visual noise)", () => {
    const vocab: VocabAtom[] = [{ term: "RAG", definition: "Retrieval-augmented generation" }];
    const segs = splitBodyByVocab("RAG is great. We love RAG.", vocab);
    const termSegs = segs.filter((s) => s.kind === "term");
    expect(termSegs).toHaveLength(1);
  });

  it("respects word boundaries — won't match inside another word", () => {
    const vocab: VocabAtom[] = [{ term: "RAG", definition: "Retrieval-augmented generation" }];
    const segs = splitBodyByVocab("We park in the garage.", vocab);
    expect(segs.filter((s) => s.kind === "term")).toHaveLength(0);
  });

  it("handles multiple distinct terms, in body order", () => {
    const vocab: VocabAtom[] = [
      { term: "router pattern", definition: "..." },
      { term: "prompt caching", definition: "..." },
    ];
    const segs = splitBodyByVocab(
      "Use the router pattern, then layer prompt caching on top.",
      vocab,
    );
    const terms = segs.filter((s) => s.kind === "term").map((s) => s.term);
    expect(terms).toEqual(["router pattern", "prompt caching"]);
  });

  it("longest-term-wins when terms overlap (e.g. 'router pattern' beats 'router')", () => {
    const vocab: VocabAtom[] = [
      { term: "router", definition: "..." },
      { term: "router pattern", definition: "..." },
    ];
    const segs = splitBodyByVocab("Use the router pattern.", vocab);
    expect(segs[1]).toMatchObject({ kind: "term", term: "router pattern" });
  });
});

describe("VocabBody — interactive renderer", () => {
  const vocab: VocabAtom[] = [
    { term: "Pinecone", definition: "A managed vector database." },
    { term: "pgvector", definition: "A Postgres extension for vector search." },
  ];

  it("renders plain body when no vocab is provided (full back-compat)", () => {
    render(<VocabBody body="Use Pinecone or pgvector." vocab={undefined} />);
    expect(screen.getByText(/Use Pinecone or pgvector\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Define/i })).toBeNull();
  });

  it("renders each vocab term as a tappable button with aria-label", () => {
    render(<VocabBody body="Use Pinecone or pgvector." vocab={vocab} />);
    expect(screen.getByRole("button", { name: /Define Pinecone/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Define pgvector/i })).toBeTruthy();
  });

  it("tap opens an inline definition strip showing term + definition", () => {
    render(<VocabBody body="Use Pinecone or pgvector." vocab={vocab} />);
    expect(screen.queryByText(/A managed vector database/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Define Pinecone/i }));
    expect(screen.getByText(/A managed vector database/)).toBeTruthy();
  });

  it("tapping the active term again closes the definition", () => {
    render(<VocabBody body="Use Pinecone or pgvector." vocab={vocab} />);
    fireEvent.click(screen.getByRole("button", { name: /Define Pinecone/i }));
    fireEvent.click(screen.getByRole("button", { name: /Define Pinecone/i }));
    expect(screen.queryByText(/A managed vector database/)).toBeNull();
  });

  it("fires onTermTap with the term and definition", () => {
    const onTermTap = vi.fn();
    render(<VocabBody body="Use Pinecone." vocab={vocab} onTermTap={onTermTap} />);
    fireEvent.click(screen.getByRole("button", { name: /Define Pinecone/i }));
    expect(onTermTap).toHaveBeenCalledWith("Pinecone", "A managed vector database.");
  });

  it("renders a 🔍 Zoom in link inside the definition strip when onZoom is set", () => {
    const onZoom = vi.fn();
    render(<VocabBody body="Use Pinecone." vocab={vocab} onZoom={onZoom} />);
    fireEvent.click(screen.getByRole("button", { name: /Define Pinecone/i }));
    fireEvent.click(screen.getByRole("button", { name: /Zoom in on Pinecone/i }));
    expect(onZoom).toHaveBeenCalledWith("Pinecone");
  });

  it("hides the Zoom-in link when onZoom is not provided", () => {
    render(<VocabBody body="Use Pinecone." vocab={vocab} />);
    fireEvent.click(screen.getByRole("button", { name: /Define Pinecone/i }));
    expect(screen.queryByRole("button", { name: /Zoom in/i })).toBeNull();
  });
});

describe("vocab seed corpus — schema + body integrity", () => {
  it("every authored vocab term appears in its parent Spark's body (case-insensitive, word-boundary)", () => {
    let totalChecked = 0;
    for (const t of SEED_TOPICS) {
      for (const lvl of t.levels) {
        for (const sp of lvl.sparks) {
          if (sp.exercise.type !== "microread" && sp.exercise.type !== "tip") continue;
          if (!sp.exercise.vocab) continue;
          for (const atom of sp.exercise.vocab) {
            totalChecked += 1;
            const segs = splitBodyByVocab(sp.exercise.body, [atom]);
            const found = segs.some((s) => s.kind === "term");
            expect(
              found,
              `Vocab atom "${atom.term}" not found in body of Spark "${sp.title}" (${t.id} L${lvl.index})`,
            ).toBe(true);
          }
        }
      }
    }
    // Confirm we actually have seed coverage — not zero.
    expect(totalChecked).toBeGreaterThan(0);
  });

  it("every authored vocab definition is non-empty and ≤ 60 words (curation rubric)", () => {
    for (const t of SEED_TOPICS) {
      for (const lvl of t.levels) {
        for (const sp of lvl.sparks) {
          if (sp.exercise.type !== "microread" && sp.exercise.type !== "tip") continue;
          if (!sp.exercise.vocab) continue;
          for (const atom of sp.exercise.vocab) {
            expect(atom.definition.trim().length).toBeGreaterThan(0);
            const wc = atom.definition.trim().split(/\s+/).filter(Boolean).length;
            expect(
              wc,
              `Vocab definition for "${atom.term}" is ${wc} words — over budget`,
            ).toBeLessThanOrEqual(60);
          }
        }
      }
    }
  });
});
