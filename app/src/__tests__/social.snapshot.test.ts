import { describe, expect, it } from "vitest";
import { buildSnapshot } from "../social/snapshot";
import type { PlayerState } from "../types";

function makeState(patch: Partial<PlayerState> = {}): PlayerState {
  return {
    profile: null,
    identity: { email: "maya@gmail.com", provider: "google" },
    xp: 0,
    focus: 5,
    focusUpdatedAt: 0,
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
    ...patch,
  };
}

describe("buildSnapshot", () => {
  it("returns null when there's no signed-in identity", () => {
    expect(
      buildSnapshot({
        prev: null,
        next: makeState({ identity: undefined }),
      }),
    ).toBeNull();
  });

  it("emits no events on first call (prev is null)", () => {
    const snap = buildSnapshot({ prev: null, next: makeState({ xp: 100 }) });
    expect(snap).not.toBeNull();
    expect(snap!.events).toEqual([]);
    expect(snap!.xpTotal).toBe(100);
  });

  it("emits a level_up event when the topic level advances", () => {
    const prev = makeState({
      history: [
        {
          ts: Date.now() - 1000,
          topicId: "ai-pm",
          levelId: "ai-pm-1",
          sparkIds: ["s1"],
          correct: 1,
          total: 1,
          minutes: 1,
        },
      ],
      progress: {
        completed: {},
        bossPassed: {},
        topicXP: {},
        topicLastTouched: {},
      },
    });
    const next = makeState({
      history: [
        ...prev.history,
        {
          ts: Date.now(),
          topicId: "ai-pm",
          levelId: "ai-pm-2",
          sparkIds: ["s2"],
          correct: 1,
          total: 1,
          minutes: 1,
        },
      ],
    });
    const snap = buildSnapshot({ prev, next });
    expect(snap!.events.some((e) => e.kind === "level_up")).toBe(true);
  });

  it("emits a streak_milestone at 7/30/100, idempotent across re-runs", () => {
    const prev = makeState({ streak: 6 });
    const next = makeState({ streak: 7 });
    const snap = buildSnapshot({ prev, next });
    const milestone = snap!.events.find((e) => e.kind === "streak_milestone");
    expect(milestone).toBeDefined();
    // Second build with the same prev/next produces the same clientId
    // (idempotency contract — server upsert dedupes).
    const snap2 = buildSnapshot({ prev, next });
    expect(snap2!.events[0]?.clientId).toBe(milestone!.clientId);
  });

  it("does not emit a streak_milestone for non-milestone numbers", () => {
    const snap = buildSnapshot({
      prev: makeState({ streak: 3 }),
      next: makeState({ streak: 4 }),
    });
    expect(snap!.events.find((e) => e.kind === "streak_milestone")).toBeUndefined();
  });

  it("emits a boss_beaten event when the bossPassed count increases", () => {
    const prev = makeState({ progress: { completed: {}, bossPassed: {}, topicXP: {}, topicLastTouched: {} } });
    const next = makeState({
      progress: {
        completed: {},
        bossPassed: { "ai-pm-3": true },
        topicXP: {},
        topicLastTouched: {},
      },
      history: [
        {
          ts: Date.now(),
          topicId: "ai-pm",
          levelId: "ai-pm-3",
          sparkIds: ["boss"],
          correct: 4,
          total: 4,
          minutes: 2,
        },
      ],
    });
    const snap = buildSnapshot({ prev, next });
    expect(snap!.events.some((e) => e.kind === "boss_beaten")).toBe(true);
  });

  it("activity14d has 14 entries with today at the end", () => {
    const now = Date.parse("2026-04-30T12:00:00Z");
    const next = makeState({
      history: [
        {
          ts: now - 1000,
          topicId: "ai-pm",
          levelId: "ai-pm-1",
          sparkIds: ["a", "b", "c"],
          correct: 3,
          total: 3,
          minutes: 1,
        },
      ],
    });
    const snap = buildSnapshot({ prev: null, next, now });
    expect(snap!.activity14d.length).toBe(14);
    expect(snap!.activity14d[13]).toBe(3); // today
  });
});
