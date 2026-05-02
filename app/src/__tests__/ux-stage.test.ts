import { describe, it, expect } from "vitest";
import { defaultState, nextTierThreshold, uxStage } from "../store/game";
import type { PlayerState, SessionRecord } from "../types";

function withCompleted(s: PlayerState, levelToSparks: Record<string, string[]>): PlayerState {
  return {
    ...s,
    progress: {
      ...s.progress,
      completed: { ...s.progress.completed, ...levelToSparks },
    },
  };
}

function withHistory(s: PlayerState, recs: SessionRecord[]): PlayerState {
  return { ...s, history: [...recs, ...s.history] };
}

describe("uxStage — progressive-disclosure trigger", () => {
  it("`fresh` for a brand-new player (0 Sparks completed)", () => {
    expect(uxStage(defaultState())).toBe("fresh");
  });

  it("`fresh` while < 3 Sparks completed", () => {
    const s = withCompleted(defaultState(), { "ai-pm-l1": ["s-1", "s-2"] });
    expect(uxStage(s)).toBe("fresh");
  });

  it("`engaged` once 3+ Sparks completed in a single level (no multi-day history)", () => {
    const s = withCompleted(defaultState(), { "ai-pm-l1": ["s-1", "s-2", "s-3"] });
    expect(uxStage(s)).toBe("engaged");
  });

  it("`returning` once 2+ levels have any completed Sparks", () => {
    const s = withCompleted(defaultState(), {
      "ai-pm-l1": ["s-1", "s-2", "s-3"],
      "ai-builder-l1": ["s-7"],
    });
    expect(uxStage(s)).toBe("returning");
  });

  it("`returning` when history spans more than one calendar day, even with one level", () => {
    const yesterday = Date.now() - 1000 * 60 * 60 * 24;
    const today = Date.now();
    const s = withHistory(
      withCompleted(defaultState(), { "ai-pm-l1": ["s-1", "s-2", "s-3"] }),
      [
        { ts: yesterday, topicId: "ai-pm", levelId: "ai-pm-l1", sparkIds: ["s-1"], correct: 1, total: 1, minutes: 1 },
        { ts: today, topicId: "ai-pm", levelId: "ai-pm-l1", sparkIds: ["s-3"], correct: 1, total: 1, minutes: 1 },
      ],
    );
    expect(uxStage(s, today)).toBe("returning");
  });

  it("`engaged` when history is in-day-only (single calendar date)", () => {
    const t = Date.now();
    const s = withHistory(
      withCompleted(defaultState(), { "ai-pm-l1": ["s-1", "s-2", "s-3"] }),
      [
        { ts: t - 1000 * 60 * 30, topicId: "ai-pm", levelId: "ai-pm-l1", sparkIds: ["s-1"], correct: 1, total: 1, minutes: 1 },
        { ts: t - 1000 * 60 * 10, topicId: "ai-pm", levelId: "ai-pm-l1", sparkIds: ["s-3"], correct: 1, total: 1, minutes: 1 },
      ],
    );
    expect(uxStage(s, t)).toBe("engaged");
  });

  it("ignores empty `completed` arrays — empty doesn't count as a touched level", () => {
    const s = withCompleted(defaultState(), {
      "ai-pm-l1": ["s-1", "s-2", "s-3"],
      "ai-builder-l1": [], // never completed any spark in this level
    });
    expect(uxStage(s)).toBe("engaged");
  });
});

describe("nextTierThreshold — pure helper", () => {
  it("returns the Architect threshold for a brand-new player", () => {
    const t = nextTierThreshold(0);
    expect(t).not.toBeNull();
    expect(t!.name).toBe("Architect");
    expect(t!.xp).toBeGreaterThan(0);
  });

  it("advances by tier as the player crosses each threshold", () => {
    const arch = nextTierThreshold(50)!;
    expect(arch.name).toBe("Architect");
    const vis = nextTierThreshold(arch.xp)!;
    expect(vis.name).toBe("Visionary");
    const found = nextTierThreshold(vis.xp)!;
    expect(found.name).toBe("Founder");
    const sing = nextTierThreshold(found.xp)!;
    expect(sing.name).toBe("Singularity");
  });

  it("returns null at and above the top tier (Singularity)", () => {
    expect(nextTierThreshold(100_000)).toBeNull();
  });
});
