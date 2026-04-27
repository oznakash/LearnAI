import { useEffect, useMemo, useRef, useState } from "react";
import { getTopic, TOPICS } from "../content";
import { usePlayer } from "../store/PlayerContext";
import {
  completedSparkIds,
  isLevelUnlocked,
  levelCompletion,
  nextRecommendedSpark,
  suggestSwitchTopic,
} from "../store/game";
import type { Exercise, Spark, TopicId } from "../types";
import { Mascot, type MascotMood } from "../visuals/Mascot";
import { Confetti } from "../visuals/Confetti";
import { Illustration } from "../visuals/Illustrations";
import { ExerciseRenderer } from "../components/Exercise";
import { AddToTaskButton } from "../components/AddToTaskButton";

interface Props {
  topicId: TopicId;
  levelId?: string;
  onDone: () => void;
  onSwitchTopic: (id: TopicId) => void;
}

interface PlayedSparkLog {
  sparkId: string;
  correct: boolean;
}

export function Play({ topicId, levelId, onDone, onSwitchTopic }: Props) {
  const { state, completeSpark, passBoss, recordSession } = usePlayer();
  const topic = getTopic(topicId);

  // Pick the level: explicit, otherwise next recommended
  const initialLevel = useMemo(() => {
    if (!topic) return null;
    if (levelId) return topic.levels.find((l) => l.id === levelId) ?? null;
    const next = nextRecommendedSpark(state, topicId);
    if (next) return topic.levels.find((l) => l.id === next.levelId) ?? null;
    return topic.levels[0];
  }, [topic, levelId, state, topicId]);

  const [activeLevelId, setActiveLevelId] = useState<string | null>(initialLevel?.id ?? null);
  const activeLevel = topic?.levels.find((l) => l.id === activeLevelId) ?? initialLevel ?? null;

  // sparks queue: start from the first incomplete spark in the level
  const completedSet = new Set(completedSparkIds(state, activeLevel?.id ?? ""));
  const startIdx = activeLevel ? Math.max(0, activeLevel.sparks.findIndex((s) => !completedSet.has(s.id))) : 0;
  const [idx, setIdx] = useState<number>(startIdx === -1 ? 0 : startIdx);
  const [sessionLog, setSessionLog] = useState<PlayedSparkLog[]>([]);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; explain?: string; xp: number; mood: MascotMood; msg: string } | null>(null);
  const [completedThisSession, setCompletedThisSession] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const sessionStart = useRef<number>(Date.now());

  useEffect(() => {
    setActiveLevelId(initialLevel?.id ?? null);
    setIdx(startIdx === -1 ? 0 : startIdx);
    setSessionLog([]);
    setFeedback(null);
    setCompletedThisSession([]);
    setDone(false);
    sessionStart.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, initialLevel?.id]);

  if (!topic || !activeLevel) {
    return <div>Topic not found.</div>;
  }
  if (!isLevelUnlocked(state, topicId, activeLevel.index)) {
    return (
      <div className="card p-6">
        <h2 className="h2">This level is locked</h2>
        <p className="muted">Finish the previous level first.</p>
        <button className="btn-primary mt-3" onClick={onDone}>← Back to topic</button>
      </div>
    );
  }

  const spark: Spark | undefined = activeLevel.sparks[idx];

  const onAnswer = (correct: boolean, explain?: string) => {
    if (!spark) return;
    const { result, newBadges } = completeSpark(topicId, activeLevel.id, spark, correct);
    setSessionLog((arr) => [...arr, { sparkId: spark.id, correct }]);
    setCompletedThisSession((arr) => Array.from(new Set([...arr, spark.id])));
    if (correct) setConfettiTrigger((n) => n + 1);
    if (newBadges.length > 0) setConfettiTrigger((n) => n + 1);
    const moodPick: MascotMood = correct ? (Math.random() > 0.5 ? "happy" : "wow") : "thinking";
    const msg = correct
      ? newBadges.length > 0
        ? `🏅 New badge: ${newBadges[0].name}!`
        : "Nailed it!"
      : "Worth a re-read — onward.";
    setFeedback({ correct, explain, xp: result.awardedXP, mood: moodPick, msg });
  };

  const onContinue = () => {
    setFeedback(null);
    if (!activeLevel) return;
    const nextIdx = idx + 1;
    if (nextIdx < activeLevel.sparks.length) {
      setIdx(nextIdx);
      return;
    }
    // level complete: record session
    const minutes = Math.max(1, Math.round((Date.now() - sessionStart.current) / 60000));
    const correct = sessionLog.filter((l) => l.correct).length;
    recordSession({
      ts: Date.now(),
      topicId,
      levelId: activeLevel.id,
      sparkIds: completedThisSession,
      correct,
      total: sessionLog.length,
      minutes,
    });

    // mark boss passed if completed and last spark was a boss
    const last = activeLevel.sparks[activeLevel.sparks.length - 1];
    const completed = levelCompletion(state, topicId, activeLevel.id);
    if (last?.exercise.type === "boss" && completed.pct >= 100) {
      passBoss(activeLevel.id);
    }
    setDone(true);
  };

  const switchSuggestion = suggestSwitchTopic(state, topicId);
  const switchTopic = switchSuggestion ? TOPICS.find((t) => t.id === switchSuggestion) : null;

  if (done) {
    const correct = sessionLog.filter((l) => l.correct).length;
    return (
      <div className="space-y-4">
        <Confetti trigger={confettiTrigger} />
        <div className="card p-6 sm:p-8 text-center">
          <Mascot mood="wow" size={120} />
          <h1 className="h1 mt-3">Level cleared!</h1>
          <p className="muted">{topic.name} · Level {activeLevel.index} — {activeLevel.title}</p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="card p-3"><div className="label">Sparks</div><div className="text-2xl font-bold text-white">{sessionLog.length}</div></div>
            <div className="card p-3"><div className="label">Correct</div><div className="text-2xl font-bold text-good">{correct}</div></div>
            <div className="card p-3"><div className="label">Synapses ⚡</div><div className="text-2xl font-bold text-accent">{sessionLog.reduce((a, l) => a + (l.correct ? 12 : 4), 0)}</div></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <button className="btn-primary" onClick={onDone}>Continue path →</button>
            {switchTopic && (
              <button
                className="btn-ghost"
                onClick={() => onSwitchTopic(switchTopic.id)}
              >
                ↔ Try {switchTopic.emoji} {switchTopic.name}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!spark) {
    return (
      <div className="card p-6">
        <h2 className="h2">All done here.</h2>
        <button className="btn-primary mt-3" onClick={onDone}>← Back</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Confetti trigger={confettiTrigger} />
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">
          {topic.emoji} <span className="text-white">{topic.name}</span> · Level {activeLevel.index} ·
          Spark {idx + 1}/{activeLevel.sparks.length}
        </div>
        <div className="flex items-center gap-2">
          <AddToTaskButton spark={spark} topicId={topicId} levelId={activeLevel.id} />
          <button className="btn-ghost text-xs" onClick={onDone}>✕ Exit</button>
        </div>
      </div>
      <div className="progress">
        <div style={{ width: `${((idx + 1) / activeLevel.sparks.length) * 100}%` }} />
      </div>

      <div className="card p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 opacity-20 pointer-events-none">
          <Illustration k={topic.visual ?? "spark"} />
        </div>
        <ExerciseSparkView spark={spark} topicVisual={topic.visual} onAnswer={onAnswer} />
      </div>

      {feedback && (
        <div className={`card p-4 sm:p-5 flex items-center gap-3 animate-pop border ${feedback.correct ? "border-good/40" : "border-bad/40"}`}>
          <Mascot mood={feedback.mood} size={64} />
          <div className="flex-1">
            <div className={`font-semibold ${feedback.correct ? "text-good" : "text-bad"}`}>
              {feedback.correct ? "✓ " : "✗ "}{feedback.msg} <span className="text-white/60 text-xs ml-2">+{feedback.xp} ⚡</span>
            </div>
            {feedback.explain && <div className="text-sm text-white/70 mt-1">{feedback.explain}</div>}
          </div>
          <button className="btn-primary" onClick={onContinue}>
            {idx + 1 < activeLevel.sparks.length ? "Next →" : "Finish"}
          </button>
        </div>
      )}

      {!feedback && switchTopic && idx > 0 && idx % 4 === 0 && (
        <div className="card p-3 text-sm flex items-center gap-3">
          <span>🌀</span>
          <span className="flex-1">Switch it up? Try a quick {switchTopic.emoji} {switchTopic.name} Spark to keep your brain fresh.</span>
          <button className="btn-ghost text-xs" onClick={() => onSwitchTopic(switchTopic.id)}>Switch</button>
        </div>
      )}
    </div>
  );
}

function ExerciseSparkView({
  spark,
  topicVisual,
  onAnswer,
}: {
  spark: Spark;
  topicVisual?: import("../types").VisualKey;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  return (
    <ExerciseRenderer
      exercise={spark.exercise as Exercise}
      title={spark.title}
      topicVisual={topicVisual}
      onAnswer={onAnswer}
    />
  );
}
