import { useMemo } from "react";
import { TOPICS } from "../content";
import { usePlayer } from "../store/PlayerContext";
import { useAdmin } from "../admin/AdminContext";
import {
  activityByDay,
  timeOnTopic,
  topicAccuracy,
  topicCompletion,
} from "../store/game";
import type { View } from "../App";
import { Bars, Heat, Radar, Ring, Sparkline } from "../visuals/Charts";
import { BADGES } from "../store/badges";

export function Dashboard({ onNav }: { onNav: (v: View) => void }) {
  const { state } = usePlayer();
  const { config: adminCfg } = useAdmin();
  const activity = activityByDay(state, 14).map((d) => d.sparks);
  const totalSparks = state.history.reduce((a, h) => a + h.sparkIds.length, 0);
  const totalMinutes = state.history.reduce((a, h) => a + h.minutes, 0);
  const totalCorrect = state.history.reduce((a, h) => a + h.correct, 0);
  const totalAttempted = state.history.reduce((a, h) => a + h.total, 0);
  const overallAcc = totalAttempted === 0 ? null : Math.round((totalCorrect / totalAttempted) * 100);

  const radar = useMemo(
    () =>
      TOPICS.slice(0, 8).map((t) => ({
        label: t.emoji,
        value: topicCompletion(state, t.id).pct,
      })),
    [state]
  );

  // Build a heat map of per-day activity intensity (last 12 weeks)
  const heatValues = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of state.history) {
      const k = new Date(h.ts).toISOString().slice(0, 10);
      map.set(k, (map.get(k) ?? 0) + h.sparkIds.length);
    }
    const max = Math.max(1, ...Array.from(map.values()));
    const norm = new Map<string, number>();
    for (const [k, v] of map) norm.set(k, v / max);
    return norm;
  }, [state.history]);

  const earned = new Set(state.badges);

  const sparksPerTopic = TOPICS.map((t) => ({
    label: t.emoji,
    value: state.history.filter((h) => h.topicId === t.id).reduce((a, h) => a + h.sparkIds.length, 0),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Your progress</h1>
        <p className="muted">Numbers, stats, and pretty graphs. Built for short check-ins.</p>
      </header>

      <section className="grid sm:grid-cols-4 gap-3">
        <Stat label={`${adminCfg.branding.xpUnit} ⚡`} value={state.xp} hint={state.guildTier} />
        <Stat label="Streak 🔥" value={`${state.streak}d`} hint="Daily build streak" />
        <Stat label="Sparks ✨" value={totalSparks} hint={`${totalMinutes}m total`} />
        <Stat label="Accuracy 🎯" value={overallAcc !== null ? `${overallAcc}%` : "—"} hint={`${totalCorrect}/${totalAttempted} correct`} />
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="label mb-2">Activity (14 days)</div>
          <Sparkline data={activity} width={520} height={120} />
        </div>
        <div className="card p-4 flex items-center justify-center">
          <Radar axes={radar} size={220} />
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="label mb-2">Sparks per Topic</div>
          <Bars data={sparksPerTopic} width={520} height={140} color="#28e0b3" />
        </div>
        <div className="card p-4">
          <div className="label mb-2">12-week heat</div>
          <Heat weeks={12} values={heatValues} />
        </div>
      </section>

      <section>
        <h2 className="h2 mb-3">Per-Topic</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOPICS.map((t) => {
            const c = topicCompletion(state, t.id);
            const acc = topicAccuracy(state, t.id);
            const mins = timeOnTopic(state, t.id);
            return (
              <button
                key={t.id}
                onClick={() => onNav({ name: "topic", topicId: t.id })}
                className="card p-4 text-left hover:shadow-glow transition"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg grid place-items-center text-xl" style={{ background: `${t.color}22`, color: t.color }}>{t.emoji}</div>
                  <div className="font-semibold text-white">{t.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Ring pct={c.pct} size={84} stroke={9} color={t.color} sublabel="complete" />
                  <div className="text-xs space-y-1 flex-1">
                    <div>Levels: <span className="text-white">{c.levelsDone}/{t.levels.length}</span></div>
                    <div>Sparks: <span className="text-white">{c.done}/{c.total}</span></div>
                    <div>Accuracy: <span className="text-white">{acc !== null ? `${acc}%` : "—"}</span></div>
                    <div>Time: <span className="text-white">{mins}m</span></div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="h2 mb-3">Badges</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
          {BADGES.map((b) => {
            const got = earned.has(b.id);
            return (
              <div key={b.id} className={`card p-3 text-center transition ${got ? "" : "opacity-40"}`}>
                <div className="text-3xl">{b.emoji}</div>
                <div className="text-xs font-semibold text-white mt-1">{b.name}</div>
                <div className="text-[10px] text-white/50 mt-0.5 line-clamp-2">{b.description}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="text-3xl font-display font-bold text-white mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-white/50 mt-0.5">{hint}</div>}
    </div>
  );
}
