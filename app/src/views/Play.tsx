import { useEffect, useMemo, useRef, useState } from "react";
import { getTopic, TOPICS } from "../content";
import { usePlayer } from "../store/PlayerContext";
import { useMemory } from "../memory/MemoryContext";
import { useAdmin } from "../admin/AdminContext";
import type { MemoryItem } from "../memory/types";
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
  const { remember, recall } = useMemory();
  const { config: adminCfg } = useAdmin();
  const [nudge, setNudge] = useState<MemoryItem | null>(null);
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
  // Stable ref to onContinue so the passive-Spark auto-advance in onAnswer
  // doesn't depend on a closure over the latest definition (onContinue is
  // declared further down). Set in the useEffect below `onContinue`.
  const onContinueRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setActiveLevelId(initialLevel?.id ?? null);
    setIdx(startIdx === -1 ? 0 : startIdx);
    setSessionLog([]);
    setFeedback(null);
    setCompletedThisSession([]);
    setDone(false);
    setNudge(null);
    sessionStart.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, initialLevel?.id]);

  // In-session memory nudge: after every 6th completed Spark, surface
  // a memory-tied suggestion. Fire-and-forget; failures degrade silently.
  useEffect(() => {
    const count = completedThisSession.length;
    if (count === 0 || count % 6 !== 0) return;
    let cancelled = false;
    const query = topic?.name
      ? `What does the user know or want about ${topic.name}?`
      : "What does the user want to learn next?";
    void recall(query, { topK: 1 }).then((items) => {
      if (cancelled) return;
      setNudge(items[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [completedThisSession.length, recall, topic?.name]);

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
  const alreadyDone = !!spark && completedSet.has(spark.id);

  const onAnswer = (correct: boolean, explain?: string) => {
    if (!spark) return;
    // Lock: each Spark can only award XP once. Subsequent clicks on
    // the same Spark (e.g. spamming "I got it" on a MicroRead/Tip) are
    // ignored until Continue advances to the next Spark.
    if (feedback) return;
    const { result, newBadges } = completeSpark(topicId, activeLevel.id, spark, correct);
    setSessionLog((arr) => {
      const next = [...arr, { sparkId: spark.id, correct }];
      // Inferred strength: 3 correct in a row in this topic+level.
      const tail = next.slice(-3);
      if (correct && tail.length === 3 && tail.every((l) => l.correct)) {
        void remember({
          text: `Strong on ${topic?.name ?? topicId} L${activeLevel.index} (3 correct in a row).`,
          category: "strength",
          metadata: { topicId, levelId: activeLevel.id, levelIndex: activeLevel.index },
        });
      }
      // Inferred gap: 2 wrong in a row in this topic+level.
      const tail2 = next.slice(-2);
      if (!correct && tail2.length === 2 && tail2.every((l) => !l.correct)) {
        void remember({
          text: `Struggling on ${topic?.name ?? topicId} L${activeLevel.index} (2 wrong in a row).`,
          category: "gap",
          metadata: { topicId, levelId: activeLevel.id, levelIndex: activeLevel.index },
        });
      }
      return next;
    });
    setCompletedThisSession((arr) => Array.from(new Set([...arr, spark.id])));
    if (correct) setConfettiTrigger((n) => n + 1);
    if (newBadges.length > 0) {
      setConfettiTrigger((n) => n + 1);
      void remember({
        text: `Earned badge: ${newBadges[0].name}.`,
        category: "history",
        metadata: { badgeId: newBadges[0].id },
      });
    }
    // Always log a small history memory on every Spark completion. Without
    // this the cognition layer felt empty until the user crossed a
    // milestone (3-streak, level clear, badge), which made the Memory tab
    // look broken on a fresh account. Tight one-liner format keeps mem0
    // happy when it dedupes / extracts.
    void remember({
      text: `Completed Spark: ${spark.title} (${topic?.name ?? topicId} L${activeLevel.index})${correct ? "" : " — got it wrong on first try"}.`,
      category: "history",
      metadata: {
        topicId,
        levelId: activeLevel.id,
        levelIndex: activeLevel.index,
        sparkId: spark.id,
        sparkType: spark.exercise.type,
        correct,
      },
    });
    // Passive content (MicroRead, Tip) has no right/wrong answer — there's
    // nothing meaningful to surface in a feedback card and showing one
    // forced the user to find a "Next →" button below the fold. Skip the
    // feedback dance and advance to the next Spark immediately. The XP
    // bump is still visible in the TopBar pill, and the badge celebration
    // (if any) still fires via newBadges → confetti.
    const isPassive = spark.exercise.type === "microread" || spark.exercise.type === "tip";
    if (isPassive) {
      // Defer the actual advance to a microtask so React commits the
      // setState batch (taken=true on the child, completedThisSession on
      // the parent) before the next render swaps the Spark in.
      queueMicrotask(() => onContinueRef.current?.());
      return;
    }

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
      void remember({
        text: `Beat Boss Cell: ${topic?.name ?? topicId} Level ${activeLevel.index}.`,
        category: "history",
        metadata: { topicId, levelId: activeLevel.id, levelIndex: activeLevel.index },
      });
    }
    if (completed.pct >= 100 && correct >= Math.ceil(sessionLog.length * 0.66)) {
      void remember({
        text: `Cleared ${topic?.name ?? topicId} Level ${activeLevel.index} (${correct}/${sessionLog.length} correct).`,
        category: "history",
        metadata: { topicId, levelId: activeLevel.id, levelIndex: activeLevel.index, accuracy: sessionLog.length ? correct / sessionLog.length : 0 },
      });
    }
    setDone(true);
  };

  // Keep the ref in sync so onAnswer's passive-Spark fast-path can call
  // the latest onContinue without taking a closure over the function.
  onContinueRef.current = onContinue;

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
            <div className="card p-3"><div className="label">{adminCfg.branding.xpUnit} ⚡</div><div className="text-2xl font-bold text-accent">{sessionLog.reduce((a, l) => a + (l.correct ? 12 : 4), 0)}</div></div>
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
        {alreadyDone ? (
          <ReviewSparkView
            spark={spark}
            isLast={idx + 1 >= activeLevel.sparks.length}
            onContinue={onContinue}
          />
        ) : (
          <ExerciseSparkView spark={spark} topicVisual={topic.visual} locked={feedback !== null} onAnswer={onAnswer} />
        )}
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

      {!feedback && nudge && (
        <div
          className="card p-3 text-sm flex items-start gap-3 border border-accent/30 bg-accent/5"
          role="status"
        >
          <span className="text-lg">💡</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-accent font-semibold">Reminder from your memory</div>
            <div className="text-white/85 mt-0.5">{nudge.text}</div>
          </div>
          <button className="btn-ghost text-xs" onClick={() => setNudge(null)} aria-label="Dismiss reminder">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function ExerciseSparkView({
  spark,
  topicVisual,
  locked,
  onAnswer,
}: {
  spark: Spark;
  topicVisual?: import("../types").VisualKey;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
}) {
  return (
    <ExerciseRenderer
      exercise={spark.exercise as Exercise}
      title={spark.title}
      topicVisual={topicVisual}
      locked={locked}
      onAnswer={onAnswer}
    />
  );
}

function ReviewSparkView({
  spark,
  isLast,
  onContinue,
}: {
  spark: Spark;
  isLast: boolean;
  onContinue: () => void;
}) {
  const ex = spark.exercise;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="chip bg-good/15 border-good/30 text-good">✓ Already mastered</span>
        <span className="chip text-[10px] uppercase tracking-wider">{ex.type}</span>
      </div>
      <h2 className="h2 mb-3">{spark.title}</h2>

      {ex.type === "microread" && (
        <>
          <p className="text-white/85 leading-relaxed text-[15px]">{ex.body}</p>
          <div className="mt-3 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
            💡 <span className="text-white">Takeaway:</span> {ex.takeaway}
          </div>
        </>
      )}

      {ex.type === "tip" && (
        <p className="text-white/85 leading-relaxed text-[15px]">{ex.body}</p>
      )}

      {ex.type === "quickpick" && (
        <>
          <div className="text-white font-semibold mb-2">{ex.prompt}</div>
          <div className="rounded-xl bg-good/15 border border-good/40 p-3 text-white">
            ✓ {ex.options[ex.answer]}
          </div>
          <div className="mt-3 text-sm text-white/70">{ex.explain}</div>
        </>
      )}

      {ex.type === "fillstack" && (
        <>
          <div className="text-white font-semibold mb-2">{ex.prompt}</div>
          <div className="rounded-xl bg-good/15 border border-good/40 p-3 text-white">
            ✓ {ex.options[ex.answer]}
          </div>
          <div className="mt-3 text-sm text-white/70">{ex.explain}</div>
        </>
      )}

      {ex.type === "scenario" && (
        <>
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 mb-3 text-white/80 italic">{ex.setup}</div>
          <div className="text-white font-semibold mb-2">{ex.prompt}</div>
          <div className="rounded-xl bg-good/15 border border-good/40 p-3 text-white">
            ✓ {ex.options[ex.answer]}
          </div>
          <div className="mt-3 text-sm text-white/70">{ex.explain}</div>
        </>
      )}

      {ex.type === "patternmatch" && (
        <>
          <div className="text-white font-semibold mb-2">{ex.prompt}</div>
          <ul className="space-y-1.5">
            {ex.pairs.map((p, i) => (
              <li key={i} className="rounded-xl bg-white/5 border border-white/10 p-2.5 text-sm">
                <span className="text-white/70">{p.left}</span>
                <span className="text-white/40 mx-2">→</span>
                <span className="text-good">{p.right}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-sm text-white/70">{ex.explain}</div>
        </>
      )}

      {ex.type === "buildcard" && (
        <>
          <p className="text-white/80 text-sm">{ex.pitch}</p>
          <pre className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs whitespace-pre-wrap text-white/85">{ex.promptToCopy}</pre>
          <div className="mt-3 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
            🎯 <span className="text-white">Success when:</span> {ex.successCriteria}
          </div>
        </>
      )}

      {ex.type === "boss" && (
        <p className="text-white/80 text-sm">Boss Cell already cleared — onward.</p>
      )}

      <button className="btn-primary mt-4" onClick={onContinue}>
        {isLast ? "Finish" : "Next →"}
      </button>
    </div>
  );
}
