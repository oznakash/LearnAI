import { useAdmin, useAnalytics } from "./AdminContext";
import { Bars, Ring, Sparkline } from "../visuals/Charts";
import { TOPIC_MAP } from "../content";

export function AdminAnalytics() {
  const a = useAnalytics();
  const { mockUsers, config } = useAdmin();

  // The cohort either has only the real signed-in user (the production
  // default) or the real user plus the seeded demo cohort. With one or
  // zero users the charts render mostly empty — surface a hint instead.
  const realUserOnly = mockUsers.length <= 1 && !config.flags.showDemoData;

  const signupSparks = a.newSignupsByDay.map((d) => d.count);
  const signupBars = a.newSignupsByDay.slice(-14).map((d) => ({
    label: d.date.slice(5),
    value: d.count,
  }));
  const popularityBars = a.topicPopularity.slice(0, 8).map((p) => ({
    label: TOPIC_MAP[p.topicId]?.emoji ?? "?",
    value: p.sparks,
  }));

  const conversionFromSignup = (n: number) =>
    a.funnel.signedUp === 0 ? 0 : Math.round((n / a.funnel.signedUp) * 100);

  return (
    <div className="space-y-4">
      {realUserOnly && (
        <div className="card p-4 border-white/10 bg-white/[0.02]">
          <div className="text-sm text-white/70">
            Real-data only mode — analytics are based on the {a.totalUsers} signed-in user{a.totalUsers === 1 ? "" : "s"}.
            Want to see how a populated dashboard looks? Flip on
            <span className="font-mono"> Demo data </span>
            in <span className="font-mono">Config → Demo data</span>.
          </div>
        </div>
      )}
      <section className="grid sm:grid-cols-4 gap-3">
        <Stat label="Total users" value={a.totalUsers} />
        <Stat label="DAU" value={a.dau} hint={`${a.totalUsers === 0 ? 0 : Math.round((a.dau / a.totalUsers) * 100)}% of total`} />
        <Stat label="WAU" value={a.wau} />
        <Stat label="MAU" value={a.mau} />
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <Stat label="Avg ⚡ Sparks / user" value={a.avgSparksPerUser} />
        <Stat label="Avg minutes / user" value={a.avgMinutesPerUser} />
        <Stat label="📧 sent (7d)" value={a.emailsSentLast7Days} />
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="h2">Signups</h3>
          <span className="text-xs text-white/50">last 30 days</span>
        </div>
        <Sparkline data={signupSparks} width={520} height={100} />
        <div className="mt-3">
          <div className="label mb-1">Last 14 days</div>
          <Bars data={signupBars} width={520} height={120} color="#28e0b3" />
        </div>
      </section>

      <section className="card p-4">
        <h3 className="h2">Onboarding funnel</h3>
        <div className="mt-2 space-y-2">
          {[
            { label: "Signed up", value: a.funnel.signedUp },
            { label: "Completed onboarding", value: a.funnel.onboarded },
            { label: "Did first Spark", value: a.funnel.firstSpark },
            { label: "Hit 1-day streak", value: a.funnel.streak1 },
            { label: "Hit 7-day streak", value: a.funnel.streak7 },
          ].map((row, i) => {
            const pct = conversionFromSignup(row.value);
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-white">{row.label}</div>
                  <div className="text-white/60 tabular-nums">{row.value} <span className="text-white/40">({pct}%)</span></div>
                </div>
                <div className="progress mt-1">
                  <div style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-3">
        <div className="card p-4">
          <h3 className="h2 mb-2">Topic popularity</h3>
          <Bars data={popularityBars} width={500} height={140} color="#7c5cff" />
          <ul className="mt-3 text-xs space-y-1">
            {a.topicPopularity.slice(0, 6).map((p) => {
              const t = TOPIC_MAP[p.topicId];
              return (
                <li key={p.topicId} className="flex items-center justify-between">
                  <span>{t?.emoji} {t?.name}</span>
                  <span className="text-white/60 tabular-nums">{p.sparks} sparks</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card p-4">
          <h3 className="h2 mb-2">Cohort retention</h3>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-white/50">
              <tr><th className="text-left p-1">Cohort</th><th className="text-right p-1">Size</th><th className="text-right p-1">D1</th><th className="text-right p-1">D7</th><th className="text-right p-1">D30</th></tr>
            </thead>
            <tbody>
              {a.retention.map((row) => (
                <tr key={row.cohort} className="border-t border-white/5">
                  <td className="p-1">{row.cohort}</td>
                  <td className="p-1 text-right tabular-nums">{row.size}</td>
                  <td className="p-1 text-right tabular-nums">{row.d1}%</td>
                  <td className="p-1 text-right tabular-nums">{row.d7}%</td>
                  <td className="p-1 text-right tabular-nums">{row.d30}%</td>
                </tr>
              ))}
              {a.retention.length === 0 && (
                <tr><td colSpan={5} className="p-2 text-center text-white/50">No cohort data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <Ring pct={conversionFromSignup(a.funnel.firstSpark)} size={88} stroke={10} sublabel="first spark" />
          <div>
            <div className="font-semibold text-white">Activation</div>
            <div className="muted text-xs">Of signups, % who tried at least one Spark.</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <Ring pct={conversionFromSignup(a.funnel.streak1)} size={88} stroke={10} color="#ffb547" sublabel="day-2 retain" />
          <div>
            <div className="font-semibold text-white">D2 retention</div>
            <div className="muted text-xs">Of signups, % who returned for day 2.</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <Ring pct={conversionFromSignup(a.funnel.streak7)} size={88} stroke={10} color="#ff5d8f" sublabel="d7 streak" />
          <div>
            <div className="font-semibold text-white">D7 streakers</div>
            <div className="muted text-xs">Of signups, % at 7-day streak.</div>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="h2 mb-2">Power users (top 5)</h3>
        <ul className="text-sm space-y-1.5">
          {[...mockUsers].sort((a, b) => b.xp - a.xp).slice(0, 5).map((u) => (
            <li key={u.id} className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <span className="text-white">{u.name}</span>
              <span className="text-white/60 tabular-nums">⚡ {u.xp} · 🔥 {u.streak}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="text-3xl font-display font-bold text-white tabular-nums mt-1">{value}</div>
      {hint && <div className="text-xs text-white/50 mt-0.5">{hint}</div>}
    </div>
  );
}
