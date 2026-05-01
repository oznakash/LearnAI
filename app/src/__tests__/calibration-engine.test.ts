import { describe, expect, it } from "vitest";
import { applySparkResult, defaultState, nextRecommendedLevel } from "../store/game";
import { TOPICS } from "../content";
import type { PlayerProfile, PlayerState, TopicId } from "../types";

const sampleProfile: PlayerProfile = {
  name: "Test",
  ageBand: "adult",
  skillLevel: "builder",
  interests: [],
  dailyMinutes: 10,
  goal: "",
  experience: "",
  createdAt: Date.now(),
};

function withCalibration(level: number | undefined): PlayerState {
  return {
    ...defaultState(),
    profile: { ...sampleProfile, calibratedLevel: level },
  };
}

describe("nextRecommendedLevel — calibrated start", () => {
  const topic = TOPICS[0];
  const topicId: TopicId = topic.id;

  it("when profile.calibratedLevel is undefined, falls back to L1", () => {
    const s = withCalibration(undefined);
    expect(nextRecommendedLevel(s, topicId)?.index).toBe(1);
  });

  it("with a fresh topic and a calibrated level of N, recommends L_N", () => {
    const s = withCalibration(4);
    expect(nextRecommendedLevel(s, topicId)?.index).toBe(4);
  });

  it("clamps to the topic's max level when calibrated above it", () => {
    const s = withCalibration(99);
    expect(nextRecommendedLevel(s, topicId)?.index).toBe(topic.levels.length);
  });

  it("once the player makes any progress on the topic, calibrated jump no longer applies", () => {
    let s = withCalibration(7);
    // Player does a single spark in L1.
    const firstSpark = topic.levels[0].sparks[0];
    s = applySparkResult(s, topicId, topic.levels[0].id, {
      sparkId: firstSpark.id,
      correct: true,
      awardedXP: 10,
    });
    // L1 still has remaining sparks so the next recommendation is L1, not L7.
    expect(nextRecommendedLevel(s, topicId)?.index).toBe(1);
  });

  it("a calibrated level below 1 (somehow) falls back to linear progression", () => {
    const s = withCalibration(0);
    expect(nextRecommendedLevel(s, topicId)?.index).toBe(1);
  });

  it("calibrated jump is per-topic — fresh topics get the jump independently", () => {
    let s = withCalibration(3);
    // Make progress in topic 0 (any spark).
    const t0 = TOPICS[0];
    const firstSpark = t0.levels[0].sparks[0];
    s = applySparkResult(s, t0.id, t0.levels[0].id, {
      sparkId: firstSpark.id,
      correct: true,
      awardedXP: 10,
    });
    // Topic 1 is still untouched — should jump to L3.
    const t1 = TOPICS[1];
    expect(nextRecommendedLevel(s, t1.id)?.index).toBe(3);
  });
});

describe("PlayerState — seenCalibrationQuestionIds back-compat", () => {
  it("default state does not include the field — older states still work", () => {
    const s = defaultState();
    expect(s.seenCalibrationQuestionIds).toBeUndefined();
  });

  it("calibratedLevel on profile is optional — older profiles still work", () => {
    const s = withCalibration(undefined);
    expect(s.profile?.calibratedLevel).toBeUndefined();
    expect(nextRecommendedLevel(s, TOPICS[0].id)?.index).toBe(1);
  });
});
