import { TOPICS } from "../content";
import { usePlayer } from "../store/PlayerContext";
import { activityByDay, nextRecommendedSpark, suggestSwitchTopic, topicCompletion } from "../store/game";
import type { View } from "../App";
import { Mascot } from "../visuals/Mascot";
import { Sparkline, Ring } from "../visuals/Charts";
import { Illustration } from "../visuals/Illustrations";
import type { TopicId } from "../types";

export function Home({ onNav }: { onNav: (v: View) => void }) {
  const { state } = usePlayer();
  const interests: TopicId[] = state.profile?.interests?.length ? state.profile.interests : TOPICS.map((t) => t.id);
  const featured = TOPICS.filter((t) => interests.includes(t.id));
  const others = TOPICS.filter((t) => !interests.includes(t.id));
  const activity = activityByDay(state, 14).map((d) => d.sparks);

  // Pick a "today" target topic = least recently touched among interests
  const target =
    featured.sort(
      (a, b) => (state.progress.topicLastTouched[a.id] ?? 0) - (state.progress.topicLastTouched[b.id] ?? 0)
    )[0] ?? TOPICS[0];

  const next = nextRecommendedSpark(state, target.id);
  const switchSuggestion = suggestSwitchTopic(state, target.id);
  const switchTopic = switchSuggestion ? TOPICS.find((t) => t.id === switchSuggestion) : null;

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-44 h-44 opacity-30 pointer-events-none">
          <Illustration k={target.visual ?? "spark"} />
        </div>
        <div className="flex items-start gap-4">
          <Mascot mood="happy" size={88} />
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-wider text-accent2 font-semibold">
              Today's quest
            </div>
            <h1 className="h1 mb-1">
              Hey {state.profile?.name?.split(" ")[0] ?? "Builder"} 👋
            </h1>
            <p className="muted">
              {state.profile?.dailyMinutes ?? 10} min today · land 1–3 Sparks in <span className="text-white">{target.name}</span>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="btn-primary"
                onClick={() => onNav({ name: "play", topicId: target.id })}
                disabled={!next}
              >
                ▶ Start a {target.emoji} Spark
              </button>
              {switchTopic && (
                <button
                  className="btn-ghost"
                  onClick={() => onNav({ name: "topic", topicId: switchTopic.id })}
                >
                  ↔ Try {switchTopic.emoji} {switchTopic.name}
                </button>
              )}
              <button className="btn-ghost" onClick={() => onNav({ name: "calibration" })}>
                🎯 Recalibrate
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <Ring pct={Math.min(100, Math.round((state.xp % 500) / 5))} size={84} stroke={10} sublabel="Tier ⚡" label={`${state.xp}`} />
          <div>
            <div className="font-semibold text-white">Synapses</div>
            <div className="muted text-sm">Tier: {state.guildTier}</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-warn/20 grid place-items-center text-warn text-3xl">🔥</div>
          <div>
            <div className="font-semibold text-white">{state.streak}-day Streak</div>
            <div className="muted text-sm">Show up tomorrow to keep it.</div>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-white/50 mb-1">Last 14 days</div>
          <Sparkline data={activity} width={240} height={56} />
          <div className="text-xs text-white/50 mt-1">
            {activity.reduce((a, b) => a + b, 0)} Sparks
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="h2">Your Constellations</h2>
          <button className="text-xs text-accent hover:underline" onClick={() => onNav({ name: "dashboard" })}>
            See all progress →
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {featured.map((t) => {
            const c = topicCompletion(state, t.id);
            return (
              <button
                key={t.id}
                onClick={() => onNav({ name: "topic", topicId: t.id })}
                className="card p-4 text-left hover:shadow-glow transition group relative overflow-hidden"
              >
                <div className="absolute right-0 top-0 w-28 h-28 opacity-25 pointer-events-none group-hover:opacity-40 transition">
                  <Illustration k={t.visual ?? "spark"} />
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl grid place-items-center text-2xl"
                    style={{ background: `${t.color}22`, color: t.color }}
                  >
                    {t.emoji}
                  </div>
                  <div>
                    <div className="font-display font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-white/50">{c.levelsDone}/{t.levels.length} levels</div>
                  </div>
                </div>
                <p className="text-sm text-white/60 mt-2 line-clamp-2">{t.tagline}</p>
                <div className="mt-3">
                  <div className="progress">
                    <div style={{ width: `${c.pct}%` }} />
                  </div>
                  <div className="text-[11px] text-white/50 mt-1">{c.pct}% complete</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Discover more</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {others.map((t) => (
              <button
                key={t.id}
                onClick={() => onNav({ name: "topic", topicId: t.id })}
                className="card p-4 text-left opacity-80 hover:opacity-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl grid place-items-center text-xl"
                    style={{ background: `${t.color}1a`, color: t.color }}
                  >
                    {t.emoji}
                  </div>
                  <div className="font-semibold text-white">{t.name}</div>
                </div>
                <p className="text-xs text-white/50 mt-2">{t.tagline}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
