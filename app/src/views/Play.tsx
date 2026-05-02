import { useEffect, useMemo, useRef, useState } from "react";
import { getTopic, TOPICS } from "../content";
import { getCreator } from "../admin/runtime";
import { usePlayer } from "../store/PlayerContext";
import { useMemory } from "../memory/MemoryContext";
import { useAdmin } from "../admin/AdminContext";
import type { MemoryItem } from "../memory/types";
import {
  completedSparkIds,
  dislikedSparkIds,
  getSparkVote,
  isLevelUnlocked,
  levelCompletion,
  nextRecommendedSpark,
  suggestSwitchTopic,
  uxStage,
} from "../store/game";
import { pickNextSparkIdx } from "../store/sequencer";
import { pickIntentCTA } from "../store/intent";
import type { Exercise, Spark, TopicId } from "../types";
import { Mascot, type MascotMood } from "../visuals/Mascot";
import { Confetti } from "../visuals/Confetti";
import { Illustration } from "../visuals/Illustrations";
import { ExerciseRenderer } from "../components/Exercise";
import { AddToTaskButton } from "../components/AddToTaskButton";
import { SparkThumbsRow } from "../components/SparkThumbsRow";

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
  const { state, completeSpark, passBoss, recordSession, voteSpark, signalSpark } = usePlayer();
  const { remember, recall } = useMemory();
  const { config: adminCfg } = useAdmin();
  // FTUE progressive disclosure — `fresh` users see only the primary
  // CTA on a Spark; `engaged` reveals the quality row + `+ Task`;
  // `returning` reveals the state-of-mind row + memory nudge. See
  // `docs/aha-and-network.md` §5.
  const stage = uxStage(state);
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

  // sparks queue: start from the first incomplete, non-disliked spark in the level
  const completedSet = new Set(completedSparkIds(state, activeLevel?.id ?? ""));
  const dislikedSet = dislikedSparkIds(state);
  const startIdx = activeLevel
    ? Math.max(
        0,
        activeLevel.sparks.findIndex((s) => !completedSet.has(s.id) && !dislikedSet.has(s.id))
      )
    : 0;
  const [idx, setIdx] = useState<number>(startIdx === -1 ? 0 : startIdx);
  const [sessionLog, setSessionLog] = useState<PlayedSparkLog[]>([]);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; explain?: string; xp: number; mood: MascotMood; msg: string } | null>(null);
  const [completedThisSession, setCompletedThisSession] = useState<string[]>([]);
  // Spark IDs the user has soft-skipped (⏭ "not now") *during this
  // session*. Distinct from `dislikedSparkIds(state)` which is a
  // permanent filter (👎). Resets on level/topic switch and on remount.
  const [softSkippedThisSession, setSoftSkippedThisSession] = useState<Set<string>>(new Set());
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
    setSoftSkippedThisSession(new Set());
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
    // Sequencer picks the next idx — skips disliked Sparks (👎 = permanent
    // skip) AND soft-skipped Sparks (⏭ = "not now" — see content-model.md
    // §2.3). Also avoids two passive Sparks back-to-back so the session
    // doesn't fatigue. See `store/sequencer.ts`.
    const dislikedNow = dislikedSparkIds(state);
    const skipIds = new Set<string>([...dislikedNow, ...softSkippedThisSession]);
    const lastShownType = spark?.exercise.type ?? null;
    const nextIdx = pickNextSparkIdx(
      activeLevel.sparks,
      idx,
      skipIds,
      lastShownType,
    );
    if (nextIdx >= 0) {
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
            {(() => {
              // Intent-aware secondary CTA — picks a next step aligned
              // with the *mode* the user told us they're in at onboarding.
              // Falls back to the universal switch-topic suggestion when
              // no intent applies.
              const cta = pickIntentCTA(state.profile?.intents, topicId);
              if (cta) {
                if (cta.externalUrl) {
                  return (
                    <a
                      href={cta.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost"
                    >
                      {cta.label}
                    </a>
                  );
                }
                return (
                  <button
                    className="btn-ghost"
                    onClick={() => cta.topicId && onSwitchTopic(cta.topicId)}
                  >
                    {cta.label}
                  </button>
                );
              }
              if (switchTopic) {
                return (
                  <button
                    className="btn-ghost"
                    onClick={() => onSwitchTopic(switchTopic.id)}
                  >
                    ↔ Try {switchTopic.emoji} {switchTopic.name}
                  </button>
                );
              }
              return null;
            })()}
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
          {stage !== "fresh" && (
            <AddToTaskButton spark={spark} topicId={topicId} levelId={activeLevel.id} />
          )}
          <button className="btn-ghost text-xs" onClick={onDone}>✕ Exit</button>
        </div>
      </div>
      <div className="progress">
        <div style={{ width: `${((idx + 1) / activeLevel.sparks.length) * 100}%` }} />
      </div>

      <div className="card p-4 sm:p-6 relative overflow-hidden">
        {/* Decorative corner illustration. Prefer the Spark's own visual
            (concept-tied) over the Topic-level fallback so a `rocket` Spark
            shows a rocket and a `tokens` Spark shows tokens — the box is
            content, not chrome. Mobile-first sizing keeps the badge from
            crowding small viewports. */}
        <div
          aria-hidden="true"
          className="absolute -right-4 -top-4 sm:-right-6 sm:-top-6 w-20 h-20 sm:w-32 sm:h-32 opacity-20 pointer-events-none"
        >
          <Illustration
            k={
              ("visual" in spark.exercise && spark.exercise.visual)
                ? spark.exercise.visual
                : (topic.visual ?? "spark")
            }
          />
        </div>
        {alreadyDone && !feedback ? (
          <ReviewSparkView
            spark={spark}
            isLast={idx + 1 >= activeLevel.sparks.length}
            onContinue={onContinue}
          />
        ) : (
          <ExerciseSparkView
            spark={spark}
            topicVisual={topic.visual}
            locked={feedback !== null}
            onAnswer={onAnswer}
            ageBand={state.profile?.ageBand}
            onVocabTap={(term, definition) => {
              // The user tapped an inline vocab term to see its inline
              // definition. Record a `vocabulary` memory so the
              // recommender knows this user has been exposed to (and
              // engaged with) the term — fuels both "skip the inline
              // definition next time" and "bias toward Sparks that
              // build on this concept" decisions.
              void remember({
                text: `Saw vocab term "${term}" in Spark "${spark.title}" (${topic.name} L${activeLevel.index}): ${definition}`,
                category: "vocabulary",
                metadata: {
                  term,
                  definition,
                  sparkId: spark.id,
                  topicId,
                  levelId: activeLevel.id,
                },
              });
            }}
            onVocabZoom={(term) => {
              // The user clicked "🔍 Zoom in on this →" inside the
              // term's inline definition. Forwards to the standard
              // zoom signal, with the term as the reason — the
              // gold-standard signal for "build a deeper Spark on X."
              signalSpark(spark.id, "zoom", {
                reason: `Wants more on: ${term}`,
                topicId,
                levelId: activeLevel.id,
              });
              void remember({
                text: `User wants to zoom in on vocab term "${term}" from Spark "${spark.title}".`,
                category: "goal",
                metadata: {
                  signal: "zoom",
                  vocabTerm: term,
                  sparkId: spark.id,
                  topicId,
                  levelId: activeLevel.id,
                },
              });
            }}
          />
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

      {(feedback || alreadyDone) && spark && stage !== "fresh" && (
        <SparkThumbsRow
          key={spark.id}
          sparkId={spark.id}
          sparkTitle={spark.title}
          topicId={topicId}
          levelId={activeLevel.id}
          currentVote={getSparkVote(state, spark.id)}
          hideSignalRow={stage === "engaged"}
          sourceUrl={
            spark.exercise.type === "podcastnugget"
              ? (getCreator(spark.exercise.creatorId)?.creditUrl ??
                  spark.exercise.source.podcastUrl)
              : undefined
          }
          sourceLabel={
            spark.exercise.type === "podcastnugget"
              ? (getCreator(spark.exercise.creatorId)?.creditLabel ??
                  `Listen on ${spark.exercise.source.podcast}`)
              : undefined
          }
          onVote={(vote, reason) => {
            voteSpark(spark.id, vote, { reason, topicId, levelId: activeLevel.id });
            if (vote === "down") {
              const why = reason ? ` Reason: ${reason}.` : "";
              void remember({
                text: `User disliked Spark "${spark.title}" in ${topic.name} L${activeLevel.index}.${why}`,
                category: "preference",
                metadata: {
                  sparkId: spark.id,
                  topicId,
                  levelId: activeLevel.id,
                  reason: reason ?? null,
                },
              });
            }
          }}
          onCritique={(chip) => {
            // Structured critique signal — aggregates across Sparks of
            // the same shape and biases future content generation, not
            // just future ranking of the disliked Spark. See
            // `docs/content-freshness.md` §5.
            const ex = spark.exercise;
            const vocabAtoms =
              ex.type === "microread" || ex.type === "tip"
                ? (ex.vocab ?? []).map((v) => v.term)
                : undefined;
            const sparkCategory =
              "category" in ex ? ex.category : undefined;
            void remember({
              text: `User critiqued Spark "${spark.title}" as "${chip}" in ${topic.name} L${activeLevel.index}.`,
              category: "critique",
              metadata: {
                sparkId: spark.id,
                topicId,
                levelId: activeLevel.id,
                chip,
                sparkType: ex.type,
                sparkCategory,
                vocabAtoms,
              },
            });
          }}
          onSignal={(signal, reason) => {
            signalSpark(spark.id, signal, { reason, topicId, levelId: activeLevel.id });
            if (signal === "zoom") {
              // Captures intent: this user wants more on this concept.
              // The cognition layer reads this category as a deeper-
              // interest signal for the recommender. The free-text
              // reason (when present) is gold-standard signal for
              // future content authoring — store it verbatim.
              const why = reason ? ` They want to know more about: ${reason}.` : "";
              void remember({
                text: `User asked to zoom in on Spark "${spark.title}" in ${topic.name} L${activeLevel.index}.${why}`,
                category: "goal",
                metadata: {
                  signal: "zoom",
                  sparkId: spark.id,
                  topicId,
                  levelId: activeLevel.id,
                  sparkTitle: spark.title,
                  reason: reason ?? null,
                },
              });
            } else if (signal === "skip-not-now") {
              // Soft-skip — current session moves on, but the Spark
              // can resurface later. Distinct from 👎 which permanently
              // filters. Records a `preference` memory hint at low
              // weight; the cognition layer's recommender deboosts
              // similar shapes for *this session*.
              setSoftSkippedThisSession((s) => {
                const next = new Set(s);
                next.add(spark.id);
                return next;
              });
              void remember({
                text: `User soft-skipped Spark "${spark.title}" in ${topic.name} L${activeLevel.index} for this session.`,
                category: "preference",
                metadata: {
                  signal: "skip-not-now",
                  sparkId: spark.id,
                  topicId,
                  levelId: activeLevel.id,
                  ts: Date.now(),
                },
              });
              // Advance the queue so the user is moved on. Same path
              // the "Next →" button takes after a normal Spark.
              onContinue();
            }
          }}
        />
      )}

      {!feedback && stage === "returning" && switchTopic && idx > 0 && idx % 4 === 0 && (
        <div className="card p-3 text-sm flex items-center gap-3">
          <span>🌀</span>
          <span className="flex-1">Switch it up? Try a quick {switchTopic.emoji} {switchTopic.name} Spark to keep your brain fresh.</span>
          <button className="btn-ghost text-xs" onClick={() => onSwitchTopic(switchTopic.id)}>Switch</button>
        </div>
      )}

      {!feedback && stage === "returning" && nudge && (
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
  onVocabTap,
  onVocabZoom,
  ageBand,
}: {
  spark: Spark;
  topicVisual?: import("../types").VisualKey;
  locked?: boolean;
  onAnswer: (correct: boolean, explain?: string) => void;
  onVocabTap?: (term: string, definition: string) => void;
  onVocabZoom?: (term: string) => void;
  ageBand?: import("../types").AgeBand;
}) {
  return (
    <ExerciseRenderer
      exercise={spark.exercise as Exercise}
      title={spark.title}
      topicVisual={topicVisual}
      locked={locked}
      onAnswer={onAnswer}
      onVocabTap={onVocabTap}
      onVocabZoom={onVocabZoom}
      ageBand={ageBand}
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

      {ex.type === "podcastnugget" && (() => {
        const creator = getCreator(ex.creatorId);
        const creditName = creator?.name ?? ex.source.podcast;
        const creditUrl = creator?.creditUrl ?? ex.source.podcastUrl;
        const creditEmoji = creator?.avatarEmoji ?? "🎙️";
        return (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <a
                href={creditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="chip bg-warn/10 border-warn/30 text-warn hover:bg-warn/20 transition"
              >
                {creator?.avatarUrl ? (
                  <img
                    src={creator.avatarUrl}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover -ml-0.5 mr-1 inline-block"
                  />
                ) : (
                  <span className="mr-1">{creditEmoji}</span>
                )}
                {creditName}
              </a>
              <span className="text-[11px] uppercase tracking-wider text-white/50">
                {ex.source.guestRole ? `${ex.source.guest} · ${ex.source.guestRole}` : ex.source.guest}
              </span>
            </div>
            <blockquote className="border-l-4 border-warn/60 pl-3 italic text-white/90 text-[15px] leading-relaxed break-words">
              “{ex.quote}”
            </blockquote>
            <div className="mt-3 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
              💡 <span className="text-white">Takeaway:</span> {ex.takeaway}
            </div>
          </>
        );
      })()}

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
