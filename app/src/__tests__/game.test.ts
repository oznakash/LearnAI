import { describe, it, expect } from "vitest";
import {
  applySparkResult,
  bumpStreak,
  defaultState,
  inferredStartingLevel,
  isLevelUnlocked,
  levelCompletion,
  nextRecommendedLevel,
  nextRecommendedSpark,
  passBoss,
  recordSession,
  regenFocus,
  startingLevelFromSkill,
  suggestSwitchTopic,
  tierForXP,
  topicAccuracy,
  topicCompletion,
  xpForExercise,
  MAX_FOCUS,
  FOCUS_REGEN_MIN,
} from "../store/game";
import { TOPICS, getTopic } from "../content";
import type { PlayerProfile, Spark } from "../types";

function testProfile(over: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    name: "T",
    ageBand: "adult",
    skillLevel: "starter",
    interests: [],
    dailyMinutes: 10,
    goal: "",
    experience: "",
    createdAt: 0,
    ...over,
  };
}

describe("tierForXP", () => {
  it("returns the right tier for each XP threshold", () => {
    expect(tierForXP(0)).toBe("Builder");
    expect(tierForXP(99)).toBe("Builder");
    expect(tierForXP(100)).toBe("Architect");
    expect(tierForXP(499)).toBe("Architect");
    expect(tierForXP(500)).toBe("Visionary");
    expect(tierForXP(1500)).toBe("Founder");
    expect(tierForXP(5000)).toBe("Singularity");
  });
});

describe("xpForExercise", () => {
  const microread: Spark["exercise"] = { type: "microread", title: "t", body: "b", takeaway: "x" };
  const tip: Spark["exercise"] = { type: "tip", title: "💡", body: "x" };
  const quickpick: Spark["exercise"] = {
    type: "quickpick",
    prompt: "p",
    options: ["a", "b"],
    answer: 0,
    explain: "e",
  };
  const buildcard: Spark["exercise"] = {
    type: "buildcard",
    title: "Build",
    pitch: "p",
    promptToCopy: "x",
    successCriteria: "s",
  };
  const boss: Spark["exercise"] = {
    type: "boss",
    title: "Boss",
    questions: [{ type: "quickpick", prompt: "q", options: ["a", "b"], answer: 0, explain: "e" }],
  };

  it("awards different XP per type", () => {
    expect(xpForExercise(microread, true)).toBe(8);
    expect(xpForExercise(tip, true)).toBe(5);
    expect(xpForExercise(buildcard, true)).toBe(20);
    expect(xpForExercise(quickpick, true)).toBe(12);
    expect(xpForExercise(quickpick, false)).toBe(4);
    expect(xpForExercise(boss, true)).toBe(60);
    expect(xpForExercise(boss, false)).toBe(10);
  });
});

describe("regenFocus", () => {
  it("regenerates focus over time", () => {
    const s = { ...defaultState(), focus: 2, focusUpdatedAt: 0 };
    const after = regenFocus(s, FOCUS_REGEN_MIN * 60 * 1000 * 2);
    expect(after.focus).toBe(4);
  });
  it("caps at MAX_FOCUS", () => {
    const s = { ...defaultState(), focus: 4, focusUpdatedAt: 0 };
    const after = regenFocus(s, FOCUS_REGEN_MIN * 60 * 1000 * 100);
    expect(after.focus).toBe(MAX_FOCUS);
  });
  it("does not regen when full", () => {
    const s = { ...defaultState(), focus: MAX_FOCUS, focusUpdatedAt: 0 };
    const after = regenFocus(s, 1_000_000_000);
    expect(after.focus).toBe(MAX_FOCUS);
  });
});

describe("bumpStreak", () => {
  it("starts streak at 1 on first day", () => {
    const s = { ...defaultState(), streak: 0, streakUpdatedAt: 0 };
    const after = bumpStreak(s, Date.now());
    expect(after.streak).toBe(1);
  });
  it("does not double-count today", () => {
    // Pin to a midday timestamp so a +5min jump never crosses a day
    // boundary on a CI machine that happens to run this near midnight.
    // (`Date.now()` was flaky for this case.)
    const now = new Date("2026-05-01T12:00:00Z").getTime();
    const s = { ...defaultState(), streak: 3, streakUpdatedAt: now };
    const after = bumpStreak(s, now + 5 * 60 * 1000);
    expect(after.streak).toBe(3);
  });
  it("increments after a day", () => {
    const today = new Date("2026-05-01T12:00:00Z").getTime();
    const yesterday = today - 24 * 3600 * 1000;
    const s = { ...defaultState(), streak: 4, streakUpdatedAt: yesterday };
    const after = bumpStreak(s, today);
    expect(after.streak).toBe(5);
  });
  it("resets if a day was missed", () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 3600 * 1000;
    const s = { ...defaultState(), streak: 8, streakUpdatedAt: threeDaysAgo };
    const after = bumpStreak(s, Date.now());
    expect(after.streak).toBe(1);
  });
});

describe("applySparkResult", () => {
  it("awards XP, drains focus on incorrect, marks completion", () => {
    const s = defaultState();
    const topic = TOPICS[0];
    const lvl = topic.levels[0];
    const spark = lvl.sparks.find((sp) => sp.exercise.type === "quickpick")!;
    const after = applySparkResult(s, topic.id, lvl.id, {
      sparkId: spark.id,
      correct: false,
      awardedXP: xpForExercise(spark.exercise, false),
    });
    expect(after.xp).toBeGreaterThan(0);
    expect(after.focus).toBe(MAX_FOCUS - 1);
    expect(after.progress.completed[lvl.id]).toContain(spark.id);
    expect(after.progress.topicXP[topic.id]).toBeGreaterThan(0);
  });

  it("does not drain focus on correct", () => {
    const s = defaultState();
    const topic = TOPICS[0];
    const lvl = topic.levels[0];
    const spark = lvl.sparks[0];
    const after = applySparkResult(s, topic.id, lvl.id, {
      sparkId: spark.id,
      correct: true,
      awardedXP: 10,
    });
    expect(after.focus).toBe(MAX_FOCUS);
  });

  it("is a no-op on replay of an already-completed spark", () => {
    const s = defaultState();
    const topic = TOPICS[0];
    const lvl = topic.levels[0];
    const spark = lvl.sparks.find((sp) => sp.exercise.type === "quickpick")!;
    const first = applySparkResult(s, topic.id, lvl.id, {
      sparkId: spark.id,
      correct: true,
      awardedXP: 10,
    });
    const replay = applySparkResult(first, topic.id, lvl.id, {
      sparkId: spark.id,
      correct: false,
      awardedXP: 4,
    });
    expect(replay.xp).toBe(first.xp);
    expect(replay.focus).toBe(first.focus);
    expect(replay.progress.topicXP[topic.id]).toBe(first.progress.topicXP[topic.id]);
    expect(replay.progress.completed[lvl.id]).toEqual([spark.id]);
  });
});

describe("level unlocking", () => {
  it("unlocks level 1 by default", () => {
    const s = defaultState();
    const topic = TOPICS[0];
    expect(isLevelUnlocked(s, topic.id, 1)).toBe(true);
    expect(isLevelUnlocked(s, topic.id, 2)).toBe(false);
  });
  it("unlocks next level after previous boss is passed", () => {
    let s = defaultState();
    const topic = TOPICS[0];
    const lvl1 = topic.levels[0];
    s = passBoss(s, lvl1.id);
    expect(isLevelUnlocked(s, topic.id, 2)).toBe(true);
  });
});

describe("topicCompletion + nextRecommended", () => {
  it("computes completion percentages", () => {
    const s = defaultState();
    const topic = TOPICS[0];
    expect(topicCompletion(s, topic.id).pct).toBe(0);
    expect(nextRecommendedLevel(s, topic.id)?.index).toBe(1);
    expect(nextRecommendedSpark(s, topic.id)?.spark.id).toBe(topic.levels[0].sparks[0].id);
  });
  it("level completion advances as sparks complete", () => {
    let s = defaultState();
    const topic = TOPICS[0];
    const lvl = topic.levels[0];
    for (const spark of lvl.sparks) {
      s = applySparkResult(s, topic.id, lvl.id, {
        sparkId: spark.id,
        correct: true,
        awardedXP: 10,
      });
    }
    expect(levelCompletion(s, topic.id, lvl.id).pct).toBe(100);
  });
});

describe("topicAccuracy + recordSession", () => {
  it("records sessions and computes accuracy", () => {
    let s = defaultState();
    s = recordSession(s, {
      ts: Date.now(),
      topicId: TOPICS[0].id,
      levelId: TOPICS[0].levels[0].id,
      sparkIds: ["x"],
      correct: 3,
      total: 4,
      minutes: 5,
    });
    expect(topicAccuracy(s, TOPICS[0].id)).toBe(75);
  });
});

describe("suggestSwitchTopic", () => {
  it("suggests a different topic", () => {
    const s = defaultState();
    s.profile = {
      name: "T",
      ageBand: "adult",
      skillLevel: "explorer",
      interests: [TOPICS[0].id, TOPICS[1].id, TOPICS[2].id],
      dailyMinutes: 10,
      goal: "x",
      experience: "",
      createdAt: Date.now(),
    };
    const out = suggestSwitchTopic(s, TOPICS[0].id);
    expect(out).not.toBe(TOPICS[0].id);
    expect([TOPICS[1].id, TOPICS[2].id]).toContain(out);
  });
});

describe("startingLevelFromSkill / inferredStartingLevel", () => {
  it("maps each SkillLevel to its conservative one-step-down anchor", () => {
    expect(startingLevelFromSkill("starter")).toBe(1);
    expect(startingLevelFromSkill("explorer")).toBe(2);
    expect(startingLevelFromSkill("builder")).toBe(3);
    expect(startingLevelFromSkill("architect")).toBe(4);
    expect(startingLevelFromSkill("visionary")).toBe(5);
    expect(startingLevelFromSkill(undefined)).toBe(1);
  });

  it("calibratedLevel always wins over skill", () => {
    expect(
      inferredStartingLevel(
        testProfile({ skillLevel: "starter", calibratedLevel: 7 }),
      ),
    ).toBe(7);
    expect(
      inferredStartingLevel(
        testProfile({ skillLevel: "visionary", calibratedLevel: 2 }),
      ),
    ).toBe(2);
  });

  it("falls back to skill when calibratedLevel is missing", () => {
    expect(
      inferredStartingLevel(testProfile({ skillLevel: "explorer" })),
    ).toBe(2);
    expect(
      inferredStartingLevel(testProfile({ skillLevel: "builder" })),
    ).toBe(3);
  });

  it("returns 1 for an undefined profile", () => {
    expect(inferredStartingLevel(undefined)).toBe(1);
  });
});

describe("isLevelUnlocked + skill-derived floor", () => {
  it("unlocks L1..L<skill> for a fresh topic when calibration hasn't run", () => {
    const s = defaultState();
    s.profile = testProfile({ skillLevel: "explorer" });
    const topic = TOPICS[0];
    expect(isLevelUnlocked(s, topic.id, 1)).toBe(true);
    expect(isLevelUnlocked(s, topic.id, 2)).toBe(true); // skill floor
    expect(isLevelUnlocked(s, topic.id, 3)).toBe(false);
  });

  it("unlocks up to calibratedLevel when set, ignoring the skill default", () => {
    const s = defaultState();
    s.profile = testProfile({ skillLevel: "starter", calibratedLevel: 4 });
    const topic = TOPICS[0];
    expect(isLevelUnlocked(s, topic.id, 4)).toBe(true);
    expect(isLevelUnlocked(s, topic.id, 5)).toBe(false);
  });

  it("nextRecommendedSpark for an explorer on a fresh topic returns L2 S1", () => {
    const s = defaultState();
    s.profile = testProfile({ skillLevel: "explorer" });
    const topic = TOPICS[0];
    const next = nextRecommendedSpark(s, topic.id);
    expect(next?.spark.id).toBe(topic.levels[1].sparks[0].id); // L2 S1
  });

  it("nextRecommendedSpark for a starter still returns L1 S1", () => {
    const s = defaultState();
    s.profile = testProfile({ skillLevel: "starter" });
    const topic = TOPICS[0];
    const next = nextRecommendedSpark(s, topic.id);
    expect(next?.spark.id).toBe(topic.levels[0].sparks[0].id);
  });

  it("nextRecommendedSpark resumes from progress once the player has touched the topic", () => {
    let s = defaultState();
    s.profile = testProfile({ skillLevel: "explorer" });
    const topic = TOPICS[0];
    const lvl1 = topic.levels[0];
    // Touch L1 — pass one spark. The "no progress" branch no longer fires;
    // recommender should walk linearly from L1's first incomplete spark.
    s = applySparkResult(s, topic.id, lvl1.id, {
      sparkId: lvl1.sparks[0].id,
      correct: true,
      awardedXP: 10,
    });
    const next = nextRecommendedSpark(s, topic.id);
    expect(next?.levelId).toBe(lvl1.id);
    expect(next?.spark.id).toBe(lvl1.sparks[1].id);
  });
});

describe("content shape integrity", () => {
  it("each topic has 10 levels", () => {
    for (const t of TOPICS) {
      expect(t.levels.length).toBe(10);
    }
  });
  it("each level has at least one spark", () => {
    for (const t of TOPICS) {
      for (const lvl of t.levels) {
        expect(lvl.sparks.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it("level indexes are 1..10", () => {
    for (const t of TOPICS) {
      const ids = t.levels.map((l) => l.index).sort((a, b) => a - b);
      expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });
  it("getTopic returns the right topic", () => {
    expect(getTopic(TOPICS[0].id)?.id).toBe(TOPICS[0].id);
  });
  it("every quickpick option index is valid", () => {
    for (const t of TOPICS) {
      for (const lvl of t.levels) {
        for (const sp of lvl.sparks) {
          const ex = sp.exercise;
          if (ex.type === "quickpick" || ex.type === "fillstack" || ex.type === "scenario") {
            expect(ex.answer).toBeGreaterThanOrEqual(0);
            expect(ex.answer).toBeLessThan(ex.options.length);
          }
          if (ex.type === "boss") {
            for (const q of ex.questions) {
              expect(q.answer).toBeGreaterThanOrEqual(0);
              expect(q.answer).toBeLessThan(q.options.length);
            }
          }
        }
      }
    }
  });
});
