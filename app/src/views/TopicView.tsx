import { useMemo } from "react";
import { getTopic } from "../content";
import { usePlayer } from "../store/PlayerContext";
import {
  activityByDay,
  isLevelUnlocked,
  levelCompletion,
  nextRecommendedLevel,
  timeOnTopic,
  topicAccuracy,
  topicCompletion,
} from "../store/game";
import type { TopicId } from "../types";
import type { View } from "../App";
import { Illustration } from "../visuals/Illustrations";
import { Bars, Ring, Sparkline } from "../visuals/Charts";

export function TopicView({ topicId, onNav }: { topicId: TopicId; onNav: (v: View) => void }) {
  const { state } = usePlayer();
  const topic = getTopic(topicId);
  if (!topic) return <div>Topic not found.</div>;
  const completion = topicCompletion(state, topic.id);
  const next = nextRecommendedLevel(state, topic.id);
  const acc = topicAccuracy(state, topic.id);
  const minutes = timeOnTopic(state, topic.id);
  const sparksByLevel = useMemo(
    () =>
      topic.levels.map((l) => ({
        label: `L${l.index}`,
        value: levelCompletion(state, topic.id, l.id).done,
      })),
    [state, topic]
  );
  const activity = activityByDay(state, 14)
    .map((d, _i, arr) => {
      // count per day for this topic only
      const day = state.history
        .filter((h) => h.topicId === topic.id && new Date(h.ts).toISOString().slice(0, 10) === d.date)
        .reduce((a, h) => a + h.sparkIds.length, 0);
      return day || (arr.length ? 0 : 0);
    });

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-48 h-48 opacity-30 pointer-events-none">
          <Illustration k={topic.visual ?? "spark"} />
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl grid place-items-center text-3xl" style={{ background: `${topic.color}22`, color: topic.color }}>
            {topic.emoji}
          </div>
          <div className="flex-1">
            <button onClick={() => onNav({ name: "home" })} className="text-xs text-white/50 hover:text-white">
              ← Home
            </button>
            <h1 className="h1 mt-1">{topic.name}</h1>
            <p className="muted">{topic.tagline}</p>
          </div>
          <div className="hidden sm:block">
            <Ring pct={completion.pct} size={92} stroke={10} sublabel="complete" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={!next}
            onClick={() => next && onNav({ name: "play", topicId: topic.id, levelId: next.id })}
          >
            ▶ Continue (Level {next?.index ?? "—"})
          </button>
          <button className="btn-ghost" onClick={() => onNav({ name: "calibration" })}>
            🎯 Quick check-in
          </button>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="label">Levels done</div>
          <div className="text-3xl font-display font-bold text-white">{completion.levelsDone}/{topic.levels.length}</div>
          <div className="text-xs text-white/50 mt-1">{completion.done} of {completion.total} sparks</div>
        </div>
        <div className="card p-4">
          <div className="label">Accuracy</div>
          <div className="text-3xl font-display font-bold text-white">{acc !== null ? `${acc}%` : "—"}</div>
          <div className="text-xs text-white/50 mt-1">across this Constellation</div>
        </div>
        <div className="card p-4">
          <div className="label">Time invested</div>
          <div className="text-3xl font-display font-bold text-white">{minutes}m</div>
          <div className="text-xs text-white/50 mt-1">last 14 days streak below</div>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="label mb-2">Sparks per level</div>
          <Bars data={sparksByLevel} width={400} height={120} color={topic.color} />
        </div>
        <div className="card p-4">
          <div className="label mb-2">Activity (14d)</div>
          <Sparkline data={activity} width={360} height={100} color={topic.color} fill={`${topic.color}22`} />
        </div>
      </section>

      <section>
        <h2 className="h2 mb-3">The Path</h2>
        <ol className="relative border-l border-white/10 ml-2 sm:ml-4 space-y-3">
          {topic.levels.map((lvl) => {
            const unlocked = isLevelUnlocked(state, topic.id, lvl.index);
            const c = levelCompletion(state, topic.id, lvl.id);
            const passedBoss = state.progress.bossPassed[lvl.id];
            const status = passedBoss ? "completed" : c.pct >= 100 ? "completed" : c.done > 0 ? "current" : unlocked ? "unlocked" : "locked";
            return (
              <li key={lvl.id} className="ml-3">
                <span className={`absolute -left-3 mt-3 w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold ${
                  status === "completed" ? "bg-good text-ink2" :
                  status === "current" ? "bg-accent text-white" :
                  status === "unlocked" ? "bg-accent2/30 text-accent2" :
                  "bg-white/5 text-white/40"
                }`}>{status === "completed" ? "✓" : lvl.index}</span>
                <button
                  disabled={!unlocked}
                  onClick={() => onNav({ name: "play", topicId: topic.id, levelId: lvl.id })}
                  className={`card p-4 w-full text-left transition ${unlocked ? "hover:shadow-glow" : "opacity-50 cursor-not-allowed"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/50">Level {lvl.index} · {lvl.estMinutes} min</div>
                      <div className="font-display font-semibold text-white text-lg">{lvl.title}</div>
                      <div className="text-sm text-white/60 mt-0.5">{lvl.goal}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/50">{c.done}/{lvl.sparks.length} sparks</div>
                      {passedBoss && <div className="chip bg-good/20 text-good border-good/30 mt-1">👾 Boss beaten</div>}
                    </div>
                  </div>
                  <div className="mt-3 progress">
                    <div style={{ width: `${c.pct}%` }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
