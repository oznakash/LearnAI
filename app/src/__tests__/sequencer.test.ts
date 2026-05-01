import { describe, it, expect } from "vitest";
import { isDoing, isPassive, pickNextSparkIdx } from "../store/sequencer";
import type { Exercise, Spark } from "../types";

let _id = 0;
function s(type: Exercise["type"], extra: Partial<Exercise> = {}): Spark {
  _id += 1;
  // Build a minimally-valid exercise per type so the union narrows.
  let exercise: Exercise;
  switch (type) {
    case "microread":
      exercise = { type, title: "M", body: "b", takeaway: "t", ...extra } as Exercise;
      break;
    case "tip":
      exercise = { type, title: "T", body: "b", ...extra } as Exercise;
      break;
    case "podcastnugget":
      exercise = {
        type,
        quote: "q",
        takeaway: "t",
        source: { podcast: "Lenny's Podcast", podcastUrl: "https://x", guest: "G" },
        ...extra,
      } as Exercise;
      break;
    case "quickpick":
      exercise = { type, prompt: "p", options: ["a", "b"], answer: 0, explain: "" } as Exercise;
      break;
    case "fillstack":
      exercise = { type, prompt: "x ___ y", options: ["a", "b"], answer: 0, explain: "" } as Exercise;
      break;
    case "patternmatch":
      exercise = { type, prompt: "p", pairs: [{ left: "a", right: "b" }], explain: "" } as Exercise;
      break;
    case "scenario":
      exercise = { type, setup: "s", prompt: "p", options: ["a"], answer: 0, explain: "" } as Exercise;
      break;
    case "buildcard":
      exercise = { type, title: "T", pitch: "p", promptToCopy: "x", successCriteria: "y" } as Exercise;
      break;
    case "boss":
      exercise = {
        type,
        title: "B",
        questions: [{ type: "quickpick", prompt: "p", options: ["a"], answer: 0, explain: "" }],
      } as Exercise;
      break;
    default:
      throw new Error(`unknown type ${type as string}`);
  }
  return { id: `s-${_id}`, title: `Spark ${_id}`, exercise };
}

describe("type classifiers", () => {
  it("isPassive recognises microread / tip / podcastnugget", () => {
    expect(isPassive("microread")).toBe(true);
    expect(isPassive("tip")).toBe(true);
    expect(isPassive("podcastnugget")).toBe(true);
  });

  it("isDoing recognises quickpick / fillstack / patternmatch / scenario / buildcard", () => {
    expect(isDoing("quickpick")).toBe(true);
    expect(isDoing("fillstack")).toBe(true);
    expect(isDoing("patternmatch")).toBe(true);
    expect(isDoing("scenario")).toBe(true);
    expect(isDoing("buildcard")).toBe(true);
  });

  it("boss is neither passive nor doing (its own category)", () => {
    expect(isPassive("boss")).toBe(false);
    expect(isDoing("boss")).toBe(false);
  });
});

describe("pickNextSparkIdx — empty + edge", () => {
  it("returns -1 when there are no sparks left", () => {
    const sparks = [s("microread"), s("quickpick")];
    const idx = pickNextSparkIdx(sparks, 1, new Set(), null);
    expect(idx).toBe(-1);
  });

  it("returns -1 when every remaining spark is in skipIds", () => {
    const a = s("microread");
    const b = s("quickpick");
    const idx = pickNextSparkIdx([a, b], -1, new Set([a.id, b.id]), null);
    expect(idx).toBe(-1);
  });

  it("starts at idx 0 when currentIdx = -1", () => {
    const sparks = [s("microread"), s("quickpick")];
    const idx = pickNextSparkIdx(sparks, -1, new Set(), null);
    expect(idx).toBe(0);
  });
});

describe("pickNextSparkIdx — soft anti-fatigue rule", () => {
  it("preserves original order when last shown was a doing-Spark", () => {
    const sparks = [s("quickpick"), s("microread"), s("tip")];
    // Just showed quickpick at idx 0; next-in-line is microread at idx 1.
    // No two-passive risk yet — return idx 1.
    const idx = pickNextSparkIdx(sparks, 0, new Set(), "quickpick");
    expect(idx).toBe(1);
  });

  it("preserves original order when next is passive but last was passive AND no doing-Spark exists ahead", () => {
    // Two passives in a row are unavoidable here — sequencer can't invent content.
    const sparks = [s("microread"), s("tip"), s("podcastnugget")];
    const idx = pickNextSparkIdx(sparks, 0, new Set(), "microread");
    // Falls back to original order — idx 1 (tip).
    expect(idx).toBe(1);
  });

  it("swaps a doing-Spark forward to break a passive-passive sequence", () => {
    // Order: microread, tip, quickpick. Just showed microread → next-in-line
    // (tip) would be the second passive in a row → swap quickpick forward.
    const sparks = [s("microread"), s("tip"), s("quickpick")];
    const idx = pickNextSparkIdx(sparks, 0, new Set(), "microread");
    expect(sparks[idx].exercise.type).toBe("quickpick");
    expect(idx).toBe(2);
  });

  it("uses the *first* doing-Spark it encounters, even if multiple are downstream", () => {
    const sparks = [
      s("microread"),
      s("tip"),
      s("scenario"),
      s("buildcard"),
    ];
    const idx = pickNextSparkIdx(sparks, 0, new Set(), "microread");
    expect(sparks[idx].exercise.type).toBe("scenario");
    expect(idx).toBe(2);
  });

  it("respects skipIds — won't swap forward to a disliked Spark", () => {
    const sparks = [
      s("microread"),
      s("tip"),
      s("quickpick"),
      s("scenario"),
    ];
    // QuickPick is disliked → skip past it to scenario when swapping.
    const idx = pickNextSparkIdx(sparks, 0, new Set([sparks[2].id]), "microread");
    expect(sparks[idx].exercise.type).toBe("scenario");
    expect(idx).toBe(3);
  });
});

describe("pickNextSparkIdx — Boss is sacred", () => {
  it("never swaps past a Boss to find a doing-Spark", () => {
    // Order: microread, boss, quickpick — Boss must stay last in the level,
    // so the sequencer falls back to the first non-skip candidate (the boss),
    // even though that creates a passive→boss transition (which is fine).
    const sparks = [s("microread"), s("boss"), s("quickpick")];
    const idx = pickNextSparkIdx(sparks, 0, new Set(), "microread");
    expect(sparks[idx].exercise.type).toBe("boss");
    expect(idx).toBe(1);
  });

  it("returns the Boss directly when it's the only candidate", () => {
    const sparks = [s("microread"), s("boss")];
    const idx = pickNextSparkIdx(sparks, 0, new Set(), "microread");
    expect(idx).toBe(1);
  });
});
