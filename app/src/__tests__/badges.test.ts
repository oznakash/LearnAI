import { describe, it, expect } from "vitest";
import { BADGES, evaluateBadges } from "../store/badges";
import { defaultState, applySparkResult, passBoss } from "../store/game";
import { TOPICS } from "../content";

describe("badges", () => {
  it("BADGES has stable ids and unique names", () => {
    const ids = BADGES.map((b) => b.id);
    const names = BADGES.map((b) => b.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("awards 'first-spark' after first spark", () => {
    let s = defaultState();
    const topic = TOPICS[0];
    const lvl = topic.levels[0];
    const sp = lvl.sparks[0];
    s = applySparkResult(s, topic.id, lvl.id, { sparkId: sp.id, correct: true, awardedXP: 10 });
    s = {
      ...s,
      history: [
        { ts: Date.now(), topicId: topic.id, levelId: lvl.id, sparkIds: [sp.id], correct: 1, total: 1, minutes: 1 },
      ],
    };
    const earned = evaluateBadges(s);
    expect(earned.find((b) => b.id === "first-spark")).toBeTruthy();
  });

  it("awards 'boss-1' after first boss passed", () => {
    let s = defaultState();
    s = passBoss(s, TOPICS[0].levels[0].id);
    const earned = evaluateBadges(s);
    expect(earned.find((b) => b.id === "boss-1")).toBeTruthy();
  });

  it("awards XP-tier badges at thresholds", () => {
    const s = { ...defaultState(), xp: 600 };
    const earned = evaluateBadges(s);
    expect(earned.find((b) => b.id === "xp-100")).toBeTruthy();
    expect(earned.find((b) => b.id === "xp-500")).toBeTruthy();
    expect(earned.find((b) => b.id === "xp-1500")).toBeFalsy();
  });

  it("does not double-award already-earned badges", () => {
    const s = { ...defaultState(), xp: 600, badges: ["xp-100", "xp-500"] };
    const earned = evaluateBadges(s);
    expect(earned.find((b) => b.id === "xp-100")).toBeFalsy();
    expect(earned.find((b) => b.id === "xp-500")).toBeFalsy();
  });
});
