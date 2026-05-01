import type { SkillLevel } from "../types";
import type { SelectedQuestion } from "./select";

export interface AnswerOutcome {
  questionId: string;
  level: number;
  correct: boolean;
  slot: SelectedQuestion["slot"];
}

export interface CalibrationResult {
  outcomes: AnswerOutcome[];
  /** Numeric 1..10 — what level we recommend the player start fresh topics at. */
  calibratedLevel: number;
  /** SkillLevel band that contains `calibratedLevel`. */
  suggestedSkillLevel: SkillLevel;
  /** Number correct out of total — for the existing UX copy ("4/5 correct"). */
  correct: number;
  total: number;
}

const MIN_LEVEL = 1;
const MAX_LEVEL = 10;

/**
 * Map a numeric level (1..10) to the SkillLevel band the player profile
 * uses elsewhere in the app.
 *
 * Bands are intentionally narrow at the bottom (1-2 = starter) and wider
 * in the middle (5-7 = builder) — that matches how players self-describe
 * in onboarding and keeps "builder" the most common landing band.
 */
export function skillLevelForNumeric(n: number): SkillLevel {
  const lvl = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(n)));
  if (lvl <= 2) return "starter";
  if (lvl <= 4) return "explorer";
  if (lvl <= 7) return "builder";
  if (lvl <= 9) return "architect";
  return "visionary";
}

/**
 * Score a calibration session.
 *
 * Algorithm:
 *   1. Compute outcomes per question (correct/wrong + level + slot).
 *   2. The new calibrated level is the *highest level the player got
 *      right*, capped one below the lowest level they got wrong (if
 *      that's lower than their highest correct +1). This way:
 *        - A player who passes anchor + up1 + up2 lands at up2's level.
 *        - A player who passes anchor but fails up1 lands at anchor.
 *        - A player who fails everything lands at MIN_LEVEL.
 *   3. The cross-area outcome contributes to highest-correct just like
 *      the others, so a player who's strong outside their primary
 *      interest still gets credit.
 *
 * If the player got *nothing* right, calibratedLevel = MIN_LEVEL and the
 * suggested skill band is "starter" — the safest default.
 */
export function scoreCalibration(
  selected: SelectedQuestion[],
  answers: (number | null)[]
): CalibrationResult {
  const outcomes: AnswerOutcome[] = selected.map((sq, i) => {
    const picked = answers[i];
    const correct = picked !== null && picked === sq.question.answer;
    return {
      questionId: sq.question.id,
      level: sq.question.level,
      correct,
      slot: sq.slot,
    };
  });

  const correctLevels = outcomes.filter((o) => o.correct).map((o) => o.level);
  const wrongLevels = outcomes.filter((o) => !o.correct).map((o) => o.level);

  let calibratedLevel: number;
  if (correctLevels.length === 0) {
    calibratedLevel = MIN_LEVEL;
  } else {
    const highestCorrect = Math.max(...correctLevels);
    if (wrongLevels.length === 0) {
      // Aced everything — give one extra level of confidence, capped.
      calibratedLevel = Math.min(MAX_LEVEL, highestCorrect + 1);
    } else {
      // Cap the calibrated level at "one below the lowest miss" — that's
      // the boundary of demonstrated competence. A player can't skip past
      // a level they don't know.
      const lowestWrong = Math.min(...wrongLevels);
      calibratedLevel = Math.max(
        MIN_LEVEL,
        Math.min(highestCorrect, lowestWrong - 1)
      );
    }
  }

  const correct = outcomes.filter((o) => o.correct).length;
  return {
    outcomes,
    calibratedLevel,
    suggestedSkillLevel: skillLevelForNumeric(calibratedLevel),
    correct,
    total: outcomes.length,
  };
}
