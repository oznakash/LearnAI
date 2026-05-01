import { useMemo, useState } from "react";
import { TOPICS } from "../content";
import { CALIBRATION_POOL } from "../content/calibrationQuestions";
import { selectCalibrationQuiz, type SelectedQuestion } from "../calibration/select";
import { scoreCalibration } from "../calibration/score";
import { usePlayer } from "../store/PlayerContext";
import { useMemory } from "../memory/MemoryContext";
import type { TopicId } from "../types";
import { Mascot } from "../visuals/Mascot";
import { Confetti } from "../visuals/Confetti";

const INTEREST_PROMPTS = TOPICS.map((t) => ({ id: t.id, label: `${t.emoji} ${t.name}` }));

const SLOT_LABELS: Record<SelectedQuestion["slot"], { hint: string; tone: string }> = {
  anchor: { hint: "Where you said you are", tone: "bg-white/5 border-white/10 text-white/60" },
  up1: { hint: "One level up", tone: "bg-accent/10 border-accent/30 text-accent" },
  up2: { hint: "Two levels up", tone: "bg-accent/15 border-accent/40 text-accent" },
  down1: { hint: "Quick foundation check", tone: "bg-white/5 border-white/10 text-white/60" },
  cross: { hint: "Different area", tone: "bg-accent2/10 border-accent2/30 text-accent2" },
};

export function Calibration({ onDone }: { onDone: () => void }) {
  const { state, setProfile, setSeenCalibrationIds } = usePlayer();
  const { remember } = useMemory();
  const [stage, setStage] = useState<"intro" | "quiz" | "interests" | "result">("intro");
  const [interests, setInterests] = useState<TopicId[]>(state.profile?.interests ?? []);
  const [confetti, setConfetti] = useState(0);

  // Build the quiz once on mount. Selector is pure (modulo Math.random)
  // so we keep the same 5 questions across re-renders within a session.
  const quiz = useMemo<SelectedQuestion[]>(
    () =>
      selectCalibrationQuiz({
        pool: CALIBRATION_POOL,
        claimedSkillLevel: state.profile?.skillLevel ?? "explorer",
        calibratedLevel: state.profile?.calibratedLevel,
        interests: state.profile?.interests ?? [],
        seenIds: state.seenCalibrationQuestionIds ?? [],
      }),
    // Re-run only on profile identity changes; we deliberately don't
    // include the live `interests` editor state because the quiz is
    // built on entry, before the user re-picks their interests.
    [
      state.profile?.skillLevel,
      state.profile?.calibratedLevel,
      state.profile?.interests,
      state.seenCalibrationQuestionIds,
    ]
  );

  const [picks, setPicks] = useState<(number | null)[]>(() =>
    Array(quiz.length).fill(null)
  );

  const result = useMemo(() => scoreCalibration(quiz, picks), [quiz, picks]);
  const correct = result.correct;
  const suggested = result.suggestedSkillLevel;
  const calibratedLevel = result.calibratedLevel;

  const finish = () => {
    if (state.profile) {
      setProfile({
        ...state.profile,
        skillLevel: suggested,
        calibratedLevel,
        interests: interests.length > 0 ? interests : state.profile.interests,
      });
    }
    // Persist seen ids so the next calibration draws fresh probes.
    const seen = new Set(state.seenCalibrationQuestionIds ?? []);
    for (const sq of quiz) seen.add(sq.question.id);
    // Cap at 200 to keep storage bounded; oldest-first eviction.
    const seenList = Array.from(seen).slice(-200);
    setSeenCalibrationIds(seenList);

    void remember({
      text: `Recalibration result: ${correct}/${quiz.length} correct → level "${suggested}" (numeric ${calibratedLevel}). Probes covered levels ${quiz
        .map((q) => q.question.level)
        .join(", ")}.`,
      category: "calibration",
      metadata: {
        source: "calibration",
        correct,
        suggested,
        calibratedLevel,
        total: quiz.length,
        questionIds: quiz.map((q) => q.question.id),
      },
    });
    if (interests.length > 0) {
      const interestNames = interests
        .map((id) => TOPICS.find((t) => t.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      void remember({
        text: `Wants more of: ${interestNames}`,
        category: "preference",
        metadata: { source: "calibration", interests },
      });
    }
    setConfetti((n) => n + 1);
    setTimeout(onDone, 900);
  };

  if (stage === "intro") {
    return (
      <div className="card p-6 sm:p-8 max-w-xl mx-auto text-center space-y-3">
        <Mascot mood="thinking" size={120} />
        <h1 className="h1">Quick check-in</h1>
        <p className="muted">
          {quiz.length} short questions + a 1-minute interest check. We pick fresh ones each time —
          a couple at your level, a couple a step up, and one in a different area — so the next Sparks land just right.
        </p>
        <button className="btn-primary" onClick={() => setStage("quiz")}>Let's go</button>
      </div>
    );
  }

  if (stage === "quiz") {
    if (quiz.length === 0) {
      return (
        <div className="card p-6 max-w-xl mx-auto text-center space-y-3">
          <h1 className="h2">Out of fresh questions</h1>
          <p className="muted">You've already seen everything in the pool. Reset your seen-questions history in Settings to retake.</p>
          <button className="btn-primary" onClick={onDone}>← Back</button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="h2">Calibration · {quiz.length} questions</h1>
          <div className="text-xs text-white/50">Score: {correct}/{picks.filter((p) => p !== null).length}</div>
        </header>
        {quiz.map((sq, i) => {
          const q = sq.question;
          const slot = SLOT_LABELS[sq.slot];
          return (
            <div key={q.id} className="card p-4">
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span>Q{i + 1}</span>
                <span className={`chip text-[10px] ${slot.tone}`}>
                  L{q.level} · {slot.hint}
                </span>
              </div>
              <div className="font-semibold text-white mt-1">{q.prompt}</div>
              <div className="space-y-2 mt-2">
                {q.options.map((o, oi) => {
                  const picked = picks[i] === oi;
                  const ok = picks[i] !== null && oi === q.answer;
                  const wrong = picks[i] !== null && picked && oi !== q.answer;
                  return (
                    <button
                      key={oi}
                      onClick={() => {
                        if (picks[i] !== null) return;
                        setPicks((p) => p.map((x, j) => (i === j ? oi : x)));
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl border ${
                        picks[i] === null
                          ? "bg-white/5 border-white/10 hover:border-white/30"
                          : ok
                          ? "bg-good/15 border-good"
                          : wrong
                          ? "bg-bad/15 border-bad"
                          : "bg-white/5 border-white/10 opacity-60"
                      }`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              {q.explain && picks[i] !== null && (
                <div className="text-xs text-white/55 mt-2">{q.explain}</div>
              )}
            </div>
          );
        })}
        <button className="btn-primary" disabled={picks.some((p) => p === null)} onClick={() => setStage("interests")}>
          Continue →
        </button>
      </div>
    );
  }

  if (stage === "interests") {
    return (
      <div className="space-y-4">
        <h1 className="h2">What's on your mind right now?</h1>
        <p className="muted text-sm">Pick the topics you want more of this week. We'll feature them on Home.</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {INTEREST_PROMPTS.map((it) => {
            const on = interests.includes(it.id);
            return (
              <button
                key={it.id}
                onClick={() =>
                  setInterests((arr) => (arr.includes(it.id) ? arr.filter((x) => x !== it.id) : [...arr, it.id]))
                }
                className={`p-3 rounded-xl border text-left ${on ? "bg-accent/15 border-accent" : "bg-white/5 border-white/10 hover:border-white/30"}`}
              >
                {it.label}
              </button>
            );
          })}
        </div>
        <button className="btn-primary" onClick={() => setStage("result")}>Show me my level →</button>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8 max-w-xl mx-auto text-center space-y-3">
      <Confetti trigger={confetti} />
      <Mascot mood="happy" size={120} />
      <h1 className="h1">You're at: {suggested.toUpperCase()}</h1>
      <p className="muted">
        {correct}/{quiz.length} correct. Calibrated at <strong>Level {calibratedLevel}</strong> — that's where new Sparks will start when you open a fresh topic.
      </p>
      <button className="btn-primary" onClick={finish}>Apply &amp; continue</button>
    </div>
  );
}
