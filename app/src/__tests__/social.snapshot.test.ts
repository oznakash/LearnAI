import { describe, expect, it } from "vitest";
import { buildSnapshot, parseLevelIndex, snapshotSignature } from "../social/snapshot";
import type { PlayerState } from "../types";
import type { PlayerSnapshot } from "../social/types";

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
          levelId: "ai-pm-l1",
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
          levelId: "ai-pm-l2",
          sparkIds: ["s2"],
          correct: 1,
          total: 1,
          minutes: 1,
        },
      ],
    });
    const snap = buildSnapshot({ prev, next });
    expect(snap!.events.some((e) => e.kind === "level_up")).toBe(true);
    // Pin the actual level value so the parser regression can't sneak
    // back in: with the old `parseInt(parts[parts.length-1])` parser,
    // both `ai-pm-l1` and `ai-pm-l2` resolved to `0`, so the level_up
    // event silently fired with `level: 0` (or never fired at all
    // because `0 < 0`).
    const ev = snap!.events.find((e) => e.kind === "level_up")!;
    expect(ev.level).toBe(2);
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
        bossPassed: { "ai-pm-l3": true },
        topicXP: {},
        topicLastTouched: {},
      },
      history: [
        {
          ts: Date.now(),
          topicId: "ai-pm",
          levelId: "ai-pm-l3",
          sparkIds: ["boss"],
          correct: 4,
          total: 4,
          minutes: 2,
        },
      ],
    });
    const snap = buildSnapshot({ prev, next });
    const ev = snap!.events.find((e) => e.kind === "boss_beaten");
    expect(ev).toBeDefined();
    // Same regression pin as the level_up case — previously this was 0.
    expect(ev!.level).toBe(3);
  });

  it("currentLevel reflects the canonical -l<n> levelId format produced by content/helpers.ts", () => {
    // Reproduces the user-reported "Currently working on ... — Level 0" bug.
    // The content `level()` helper builds ids like `ai-builder-l3`. The
    // pre-fix parser called `parseInt(parts[parts.length-1])` which read
    // "l3" → NaN → 0, so every signed-in player's public profile pinned
    // their currently-working-on level at 0.
    const snap = buildSnapshot({
      prev: null,
      next: makeState({
        history: [
          {
            ts: Date.now(),
            topicId: "ai-builder",
            levelId: "ai-builder-l3",
            sparkIds: ["s1"],
            correct: 1,
            total: 1,
            minutes: 1,
          },
        ],
      }),
    });
    expect(snap!.currentTopicId).toBe("ai-builder");
    expect(snap!.currentLevel).toBe(3);
  });

  it("activity14d has 14 entries with today at the end", () => {
    const now = Date.parse("2026-04-30T12:00:00Z");
    const next = makeState({
      history: [
        {
          ts: now - 1000,
          topicId: "ai-pm",
          levelId: "ai-pm-l1",
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

describe("snapshotSignature", () => {
  function makeSnap(patch: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
    return {
      xpTotal: 0,
      xpWeek: 0,
      xpMonth: 0,
      streak: 0,
      guildTier: "Builder",
      currentTopicId: undefined,
      currentLevel: undefined,
      badges: [],
      topicXp: {},
      activity14d: new Array(14).fill(0),
      events: [],
      clientWindow: { from: 0, to: 0 },
      ...patch,
    };
  }

  it("produces an identical signature for two identical aggregates", () => {
    const a = makeSnap({ xpTotal: 1234, streak: 7, guildTier: "Architect" });
    const b = makeSnap({ xpTotal: 1234, streak: 7, guildTier: "Architect" });
    expect(snapshotSignature(a)).toBe(snapshotSignature(b));
  });

  it("ignores activity14d wall-clock drift (would defeat dedup)", () => {
    const a = makeSnap({ xpTotal: 100, activity14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] });
    const b = makeSnap({ xpTotal: 100, activity14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2] });
    expect(snapshotSignature(a)).toBe(snapshotSignature(b));
  });

  it("ignores clientWindow (always changes due to Date.now())", () => {
    const a = makeSnap({ xpTotal: 100, clientWindow: { from: 1000, to: 2000 } });
    const b = makeSnap({ xpTotal: 100, clientWindow: { from: 9999, to: 10000 } });
    expect(snapshotSignature(a)).toBe(snapshotSignature(b));
  });

  it("ignores events array (caller decides whether events force a send)", () => {
    const a = makeSnap({ xpTotal: 100, events: [] });
    const b = makeSnap({
      xpTotal: 100,
      events: [{ kind: "level_up", topicId: "ai-pm", level: 2, clientId: "x" }],
    });
    expect(snapshotSignature(a)).toBe(snapshotSignature(b));
  });

  it("changes when xpTotal changes", () => {
    const a = makeSnap({ xpTotal: 100 });
    const b = makeSnap({ xpTotal: 101 });
    expect(snapshotSignature(a)).not.toBe(snapshotSignature(b));
  });

  it("changes when streak changes", () => {
    const a = makeSnap({ streak: 6 });
    const b = makeSnap({ streak: 7 });
    expect(snapshotSignature(a)).not.toBe(snapshotSignature(b));
  });

  it("changes when guildTier changes", () => {
    const a = makeSnap({ guildTier: "Builder" });
    const b = makeSnap({ guildTier: "Architect" });
    expect(snapshotSignature(a)).not.toBe(snapshotSignature(b));
  });

  it("changes when currentTopicId or currentLevel changes", () => {
    const a = makeSnap({ currentTopicId: "ai-pm", currentLevel: 1 });
    const b = makeSnap({ currentTopicId: "ai-pm", currentLevel: 2 });
    const c = makeSnap({ currentTopicId: "cloud", currentLevel: 1 });
    expect(snapshotSignature(a)).not.toBe(snapshotSignature(b));
    expect(snapshotSignature(a)).not.toBe(snapshotSignature(c));
  });

  it("is stable under topicXp key reorder (insertion-order independent)", () => {
    const a = makeSnap({ topicXp: { "ai-pm": 100, cloud: 200 } });
    const b = makeSnap({ topicXp: { cloud: 200, "ai-pm": 100 } });
    expect(snapshotSignature(a)).toBe(snapshotSignature(b));
  });

  it("changes when topicXp values change", () => {
    const a = makeSnap({ topicXp: { "ai-pm": 100 } });
    const b = makeSnap({ topicXp: { "ai-pm": 101 } });
    expect(snapshotSignature(a)).not.toBe(snapshotSignature(b));
  });

  it("is stable under badge reorder", () => {
    const a = makeSnap({ badges: ["streaker", "explorer"] });
    const b = makeSnap({ badges: ["explorer", "streaker"] });
    expect(snapshotSignature(a)).toBe(snapshotSignature(b));
  });

  it("changes when a new badge is added", () => {
    const a = makeSnap({ badges: ["streaker"] });
    const b = makeSnap({ badges: ["streaker", "explorer"] });
    expect(snapshotSignature(a)).not.toBe(snapshotSignature(b));
  });

  it("handles undefined/missing optional fields without throwing", () => {
    const a = makeSnap();
    expect(() => snapshotSignature(a)).not.toThrow();
    expect(snapshotSignature(a)).toContain("xp:0");
    expect(snapshotSignature(a)).toContain("streak:0");
  });

  it("regression: 60s focus-regen tick produces matching signature", () => {
    // Simulates the production pattern where the focus-regen interval
    // bumps a state ref every minute without changing any aggregate
    // field — used to fire a 1/min pushSnapshot per signed-in tab.
    const before = makeSnap({
      xpTotal: 5000,
      streak: 12,
      guildTier: "Architect",
      currentTopicId: "ai-pm",
      currentLevel: 4,
      topicXp: { "ai-pm": 3000, cloud: 2000 },
      badges: ["streaker"],
    });
    const afterRegen: PlayerSnapshot = {
      ...before,
      // Regen ticks bump these but should NOT trigger a re-push.
      activity14d: before.activity14d.map((v, i) => (i === 13 ? v + 1 : v)),
      clientWindow: { from: before.clientWindow.from + 1000, to: before.clientWindow.to + 60_000 },
    };
    expect(snapshotSignature(before)).toBe(snapshotSignature(afterRegen));
  });
});

describe("parseLevelIndex", () => {
  // Regression unit-tests for the "Currently working on … — Level 0" bug.
  // The content `level()` helper produces ids of the form
  // `<topicId>-l<index>` and the topicId itself can contain dashes.
  it("parses the canonical -l<n> suffix produced by content/helpers.ts", () => {
    expect(parseLevelIndex("ai-pm-l1")).toBe(1);
    expect(parseLevelIndex("ai-pm-l9")).toBe(9);
    expect(parseLevelIndex("ai-pm-l10")).toBe(10);
  });

  it("handles topicIds that themselves contain dashes (the actual prod case)", () => {
    expect(parseLevelIndex("ai-builder-l3")).toBe(3);
    expect(parseLevelIndex("memory-safety-l7")).toBe(7);
  });

  it("returns 0 when the levelId is missing or shape-broken", () => {
    expect(parseLevelIndex(undefined)).toBe(0);
    expect(parseLevelIndex(null)).toBe(0);
    expect(parseLevelIndex("")).toBe(0);
    expect(parseLevelIndex("ai-pm")).toBe(0); // no level suffix
    expect(parseLevelIndex("ai-pm-foo")).toBe(0); // unknown suffix
  });

  it("is case-insensitive on the `l` prefix", () => {
    expect(parseLevelIndex("ai-pm-L4")).toBe(4);
  });

  it("does NOT silently accept the legacy bare-number suffix (forces canonical format)", () => {
    // `ai-pm-2` was the format used by the old (broken) test fixtures;
    // it is NOT what the runtime helper produces. Treating it as 2
    // would mask the real bug, so we explicitly fall through to 0.
    expect(parseLevelIndex("ai-pm-2")).toBe(0);
  });
});
