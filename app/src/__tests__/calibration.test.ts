import { describe, expect, it } from "vitest";
import {
  anchorLevel,
  selectCalibrationQuiz,
  slotTargets,
  type SelectedQuestion,
} from "../calibration/select";
import {
  scoreCalibration,
  skillLevelForNumeric,
} from "../calibration/score";
import {
  CALIBRATION_POOL,
  type CalibrationQuestion,
} from "../content/calibrationQuestions";

/** Deterministic RNG for tests — Mulberry32. */
function seededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("anchorLevel", () => {
  it("maps each SkillLevel band to a representative numeric anchor", () => {
    expect(anchorLevel("starter", undefined)).toBe(2);
    expect(anchorLevel("explorer", undefined)).toBe(4);
    expect(anchorLevel("builder", undefined)).toBe(6);
    expect(anchorLevel("architect", undefined)).toBe(8);
    expect(anchorLevel("visionary", undefined)).toBe(9);
  });

  it("prefers a calibrated numeric level when present", () => {
    expect(anchorLevel("starter", 7)).toBe(7);
    expect(anchorLevel("visionary", 3)).toBe(3);
  });

  it("rounds non-integer calibrated levels", () => {
    expect(anchorLevel("starter", 5.6)).toBe(6);
  });

  it("ignores out-of-range calibrated values and falls back to the band", () => {
    expect(anchorLevel("builder", 0)).toBe(6);
    expect(anchorLevel("builder", 99)).toBe(6);
    expect(anchorLevel("builder", Number.NaN)).toBe(6);
  });
});

describe("slotTargets", () => {
  it("clamps to the 1..10 range at boundaries", () => {
    const low = slotTargets(1);
    expect(low.down1).toBe(1);
    expect(low.up2).toBe(3);
    const high = slotTargets(10);
    expect(high.up1).toBe(10);
    expect(high.up2).toBe(10);
  });

  it("returns the expected stair-step around a mid anchor", () => {
    const t = slotTargets(6);
    expect(t.down1).toBe(5);
    expect(t.anchor).toBe(6);
    expect(t.up1).toBe(7);
    expect(t.up2).toBe(8);
    expect(t.cross).toBe(6);
  });
});

describe("selectCalibrationQuiz — slot coverage", () => {
  it("returns 5 questions in the canonical anchor/up1/up2/down1/cross order", () => {
    const quiz = selectCalibrationQuiz({
      pool: CALIBRATION_POOL,
      claimedSkillLevel: "builder",
      interests: ["ai-builder"],
      rng: seededRng(42),
    });
    expect(quiz.length).toBe(5);
    expect(quiz.map((q) => q.slot)).toEqual([
      "anchor",
      "up1",
      "up2",
      "down1",
      "cross",
    ]);
  });

  it("each slot's question level is within ±2 of its target", () => {
    const quiz = selectCalibrationQuiz({
      pool: CALIBRATION_POOL,
      claimedSkillLevel: "builder",
      interests: ["ai-builder"],
      rng: seededRng(7),
    });
    const targets = slotTargets(6);
    for (const sq of quiz) {
      const target = targets[sq.slot];
      const drift = Math.abs(sq.question.level - target);
      expect(drift).toBeLessThanOrEqual(2);
    }
  });

  it("the cross probe is in a different topic from the player's primary interest", () => {
    const quiz = selectCalibrationQuiz({
      pool: CALIBRATION_POOL,
      claimedSkillLevel: "builder",
      interests: ["ai-builder"],
      rng: seededRng(11),
    });
    const cross = quiz.find((q) => q.slot === "cross");
    expect(cross).toBeDefined();
    expect(cross?.question.topic).not.toBe("ai-builder");
  });

  it("never repeats a question id within a single quiz", () => {
    const quiz = selectCalibrationQuiz({
      pool: CALIBRATION_POOL,
      claimedSkillLevel: "explorer",
      interests: ["ai-pm"],
      rng: seededRng(99),
    });
    const ids = quiz.map((q) => q.question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("selectCalibrationQuiz — variety + seen-id avoidance", () => {
  it("two consecutive sessions with seen ids honored produce different question sets", () => {
    const first = selectCalibrationQuiz({
      pool: CALIBRATION_POOL,
      claimedSkillLevel: "builder",
      interests: ["ai-builder"],
      rng: seededRng(1),
    });
    const firstIds = first.map((q) => q.question.id);
    const second = selectCalibrationQuiz({
      pool: CALIBRATION_POOL,
      claimedSkillLevel: "builder",
      interests: ["ai-builder"],
      seenIds: firstIds,
      rng: seededRng(2),
    });
    const overlap = second
      .map((q) => q.question.id)
      .filter((id) => firstIds.includes(id));
    expect(overlap.length).toBe(0);
  });

  it("over many sessions, the player encounters varied ids", () => {
    const seen = new Set<string>();
    let rngSeed = 100;
    for (let i = 0; i < 4; i++) {
      const quiz = selectCalibrationQuiz({
        pool: CALIBRATION_POOL,
        claimedSkillLevel: "explorer",
        interests: ["ai-foundations"],
        seenIds: Array.from(seen),
        rng: seededRng(rngSeed++),
      });
      for (const sq of quiz) seen.add(sq.question.id);
    }
    // 4 sessions × 5 questions each → expect well over 10 distinct ids
    // (would be 20 in the perfect-case, but small pools force some reuse).
    expect(seen.size).toBeGreaterThan(10);
  });

  it("falls back gracefully when the pool is exhausted", () => {
    const seen = CALIBRATION_POOL.map((q) => q.id);
    const quiz = selectCalibrationQuiz({
      pool: CALIBRATION_POOL,
      claimedSkillLevel: "builder",
      interests: ["ai-builder"],
      seenIds: seen,
      rng: seededRng(0),
    });
    // Selector relaxes the seen filter as a last resort, so we still get
    // questions rather than an empty quiz.
    expect(quiz.length).toBe(5);
  });

  it("returns empty when the pool itself is empty", () => {
    const quiz = selectCalibrationQuiz({
      pool: [],
      claimedSkillLevel: "builder",
      interests: ["ai-builder"],
    });
    expect(quiz).toEqual([]);
  });
});

describe("selectCalibrationQuiz — calibrated level overrides skill band", () => {
  it("uses calibratedLevel as the anchor when set, ignoring skillLevel band", () => {
    const quiz = selectCalibrationQuiz({
      pool: CALIBRATION_POOL,
      claimedSkillLevel: "starter", // would map to anchor 2
      calibratedLevel: 8, // but this should win
      interests: ["ai-builder"],
      rng: seededRng(7),
    });
    const anchorQ = quiz.find((q) => q.slot === "anchor");
    expect(anchorQ).toBeDefined();
    // Anchor target = 8; allow ±2 fallback.
    expect(Math.abs((anchorQ?.question.level ?? 0) - 8)).toBeLessThanOrEqual(2);
  });
});

describe("scoreCalibration", () => {
  function fakeQuestion(id: string, level: number, answer = 0): CalibrationQuestion {
    return {
      id,
      level,
      topic: "ai-builder",
      prompt: id,
      options: ["a", "b"],
      answer,
    };
  }
  function selected(qs: CalibrationQuestion[], slots: SelectedQuestion["slot"][]): SelectedQuestion[] {
    return qs.map((q, i) => ({ question: q, slot: slots[i] }));
  }

  it("a perfect run boosts calibratedLevel by +1 (capped)", () => {
    const sel = selected(
      [fakeQuestion("a", 6), fakeQuestion("b", 7), fakeQuestion("c", 8), fakeQuestion("d", 5), fakeQuestion("e", 6)],
      ["anchor", "up1", "up2", "down1", "cross"]
    );
    // All correct: pick index 0 on every question.
    const r = scoreCalibration(sel, [0, 0, 0, 0, 0]);
    expect(r.correct).toBe(5);
    expect(r.calibratedLevel).toBe(9); // 8 + 1
  });

  it("perfect run at level 10 stays capped at 10", () => {
    const sel = selected(
      [fakeQuestion("a", 10), fakeQuestion("b", 10), fakeQuestion("c", 10)],
      ["anchor", "up1", "up2"]
    );
    const r = scoreCalibration(sel, [0, 0, 0]);
    expect(r.calibratedLevel).toBe(10);
  });

  it("anchor pass + all higher fails lands at anchor level", () => {
    const sel = selected(
      [
        fakeQuestion("a", 6),
        fakeQuestion("b", 7),
        fakeQuestion("c", 8),
        fakeQuestion("d", 5),
        // cross is at a level *above* anchor here so the same-level
        // demotion case is exercised separately.
        fakeQuestion("e", 7),
      ],
      ["anchor", "up1", "up2", "down1", "cross"]
    );
    // Correct: a (L6), d (L5); wrong: b (L7), c (L8), e (L7).
    // highestCorrect = 6, lowestWrong = 7 → calibratedLevel = min(6, 6) = 6.
    const r = scoreCalibration(sel, [0, 1, 1, 0, 1]);
    expect(r.calibratedLevel).toBe(6);
  });

  it("a same-level failure (e.g. cross probe miss at anchor) demotes by one", () => {
    const sel = selected(
      [fakeQuestion("a", 6), fakeQuestion("b", 7), fakeQuestion("c", 8), fakeQuestion("d", 5), fakeQuestion("e", 6)],
      ["anchor", "up1", "up2", "down1", "cross"]
    );
    // Correct: a (L6), d (L5); wrong: b, c, e (L6).
    // lowestWrong = 6, highestCorrect = 6 → calibratedLevel = min(6, 5) = 5.
    const r = scoreCalibration(sel, [0, 1, 1, 0, 1]);
    expect(r.calibratedLevel).toBe(5);
  });

  it("a single down-probe pass with everything else failing lands at the down level", () => {
    const sel = selected(
      [fakeQuestion("a", 6), fakeQuestion("b", 7), fakeQuestion("c", 8), fakeQuestion("d", 5), fakeQuestion("e", 6)],
      ["anchor", "up1", "up2", "down1", "cross"]
    );
    const r = scoreCalibration(sel, [1, 1, 1, 0, 1]);
    expect(r.calibratedLevel).toBe(5);
  });

  it("nothing right → calibrate at level 1 / starter", () => {
    const sel = selected(
      [fakeQuestion("a", 6), fakeQuestion("b", 7)],
      ["anchor", "up1"]
    );
    const r = scoreCalibration(sel, [1, 1]);
    expect(r.calibratedLevel).toBe(1);
    expect(r.suggestedSkillLevel).toBe("starter");
  });

  it("null answers count as wrong", () => {
    const sel = selected(
      [fakeQuestion("a", 6), fakeQuestion("b", 7)],
      ["anchor", "up1"]
    );
    const r = scoreCalibration(sel, [null, null]);
    expect(r.correct).toBe(0);
    expect(r.calibratedLevel).toBe(1);
  });

  it("inconsistency (failed below + passed above) caps at one-below the lowest miss", () => {
    const sel = selected(
      [fakeQuestion("a", 6), fakeQuestion("b", 7), fakeQuestion("c", 8), fakeQuestion("d", 5), fakeQuestion("e", 6)],
      ["anchor", "up1", "up2", "down1", "cross"]
    );
    // Pass: a (L6), b (L7); Fail: c (L8), d (L5), e (L6)
    const r = scoreCalibration(sel, [0, 0, 1, 1, 1]);
    // lowestWrong = 5 → calibratedLevel ≤ 4; highestCorrect = 7 → min(7, 4) = 4
    expect(r.calibratedLevel).toBe(4);
  });
});

describe("skillLevelForNumeric", () => {
  it("maps numeric levels to bands", () => {
    expect(skillLevelForNumeric(1)).toBe("starter");
    expect(skillLevelForNumeric(2)).toBe("starter");
    expect(skillLevelForNumeric(3)).toBe("explorer");
    expect(skillLevelForNumeric(4)).toBe("explorer");
    expect(skillLevelForNumeric(5)).toBe("builder");
    expect(skillLevelForNumeric(7)).toBe("builder");
    expect(skillLevelForNumeric(8)).toBe("architect");
    expect(skillLevelForNumeric(9)).toBe("architect");
    expect(skillLevelForNumeric(10)).toBe("visionary");
  });

  it("clamps out-of-range values", () => {
    expect(skillLevelForNumeric(-3)).toBe("starter");
    expect(skillLevelForNumeric(99)).toBe("visionary");
  });
});
