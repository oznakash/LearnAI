import { useEffect, useState } from "react";
import { useAdmin, useAnalytics } from "./AdminContext";
import { Bars, Ring, Sparkline } from "../visuals/Charts";
import { TOPIC_MAP } from "../content";
import { usePlayer } from "../store/PlayerContext";

interface TrafficStats {
  totalVisits: number;
  visits24h: number;
  visits7d: number;
  visits30d: number;
  topReferrers7d: Array<{ refDomain: string; visits: number }>;
  topSources7d: Array<{ source: string; visits: number }>;
  daily7d: Array<{ date: string; visits: number }>;
}

interface SocialStats {
  profileCount: number;
  openProfiles: number;
  closedProfiles: number;
  kidProfiles: number;
  followCount: number;
  approvedFollows: number;
  pendingFollows: number;
  blockCount: number;
  reportCount: number;
  openReports: number;
  resolvedReports: number;
  eventCount: number;
  events24h: number;
  eventsByKind: Record<string, number>;
  signalsByTopic: Record<string, number>;
  /** Optional — older sidecars without the traffic rollup omit this. */
  traffic?: TrafficStats;
  generatedAt: number;
}

export function AdminAnalytics() {
  const a = useAnalytics();
  const { mockUsers, config, realUserCount, realUsersError } = useAdmin();
  const { state: player } = usePlayer();
  const [social, setSocial] = useState<SocialStats | null>(null);
  const [socialErr, setSocialErr] = useState<string | null>(null);

  // Pull social telemetry when the social flag is on.
  useEffect(() => {
    if (!config.flags.socialEnabled) {
      setSocial(null);
      return;
    }
    let cancelled = false;
    const url = (config.socialConfig.serverUrl || "") + "/v1/social/admin/analytics";
    fetch(url, {
      headers: {
        "x-user-email": player.identity?.email ?? "",
        ...(player.serverSession?.token
          ? { authorization: `Bearer ${player.serverSession.token}` }
          : {}),
      },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setSocial(data as SocialStats);
      })
      .catch((e) => {
        if (!cancelled) setSocialErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [config.flags.socialEnabled, config.socialConfig.serverUrl, player.identity?.email, player.serverSession?.token]);

  // mem0-sourced real-user count is the authoritative "total users" when
  // available. Now that AdminContext folds the same list into mockUsers,
  // a.totalUsers below already reflects mem0 + demo + self too; we keep
  // realUserCount for the "Showing N real users" hint card so the admin
  // can tell at a glance whether the dashboard is live or fallback.
  const totalUsersDisplay = a.totalUsers;
  const realUserOnly =
    realUserCount === null && mockUsers.length <= 1 && !config.flags.showDemoData;

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
      {realUserCount !== null && realUserCount > 1 && (
        <div className="card p-4 border-good/30 bg-good/[0.05]">
          <div className="text-sm text-white/80">
            Showing the <strong>{realUserCount}</strong> real signed-in
            users from mem0's <span className="font-mono">user_state</span>.
            Funnel + retention charts below still derive from the local cohort
            (mockUsers + you) — flip on
            <span className="font-mono"> Demo data </span>
            for populated charts.
          </div>
        </div>
      )}
      <section className="grid sm:grid-cols-4 gap-3">
        <Stat
          label="Total users"
          value={totalUsersDisplay}
          hint={
            realUserCount !== null
              ? "real signed-ups (mem0)"
              : a.totalUsers <= 1
              ? "local cohort only"
              : undefined
          }
        />
        <Stat label="DAU" value={a.dau} hint={`${a.totalUsers === 0 ? 0 : Math.round((a.dau / a.totalUsers) * 100)}% of total`} />
        <Stat label="WAU" value={a.wau} />
        <Stat label="MAU" value={a.mau} />
      </section>

      {realUsersError && realUserCount === null && (
        <div className="text-xs text-bad/80">
          Couldn't load mem0 user list: {realUsersError}.
          {realUsersError === "not_admin" && (
            <> Make sure your account is in mem0's <span className="font-mono">ADMIN_EMAILS</span>.</>
          )}
        </div>
      )}

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

      {config.flags.socialEnabled && (
        <section className="card p-5 space-y-4">
          <header className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="h2">Social telemetry</h2>
              <p className="muted text-xs">
                Live from <code className="text-white/70">/v1/social/admin/analytics</code>. Refreshes on tab open.
              </p>
            </div>
            {social && (
              <span className="text-[11px] text-white/40">
                generated {new Date(social.generatedAt).toLocaleTimeString()}
              </span>
            )}
          </header>

          {socialErr ? (
            <div className="text-xs text-bad">Couldn't reach social-svc analytics: {socialErr}</div>
          ) : !social ? (
            <div className="text-xs text-white/50">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Profiles" value={social.profileCount} hint={`${social.openProfiles} open · ${social.closedProfiles} closed`} />
                <Stat label="Follow edges" value={social.followCount} hint={`${social.approvedFollows} approved · ${social.pendingFollows} pending`} />
                <Stat label="Stream events (24h)" value={social.events24h} hint={`${social.eventCount} total in store`} />
                <Stat label="Open reports" value={social.openReports} hint={`${social.resolvedReports} resolved`} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="label mb-2">Stream events by kind</div>
                  {Object.keys(social.eventsByKind).length === 0 ? (
                    <div className="text-xs text-white/40 italic">No events yet.</div>
                  ) : (
                    <Bars
                      data={Object.entries(social.eventsByKind).map(([k, v]) => ({
                        label: k.replace("_", " "),
                        value: v,
                      }))}
                      width={400}
                      height={120}
                    />
                  )}
                </div>
                <div>
                  <div className="label mb-2">Signals distribution (top 8 Topics)</div>
                  {Object.keys(social.signalsByTopic).length === 0 ? (
                    <div className="text-xs text-white/40 italic">No Signals set yet.</div>
                  ) : (
                    <Bars
                      data={Object.entries(social.signalsByTopic)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 8)
                        .map(([k, v]) => ({
                          label: TOPIC_MAP[k as keyof typeof TOPIC_MAP]?.emoji ?? "?",
                          value: v,
                        }))}
                      width={400}
                      height={120}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Stat label="Kid profiles" value={social.kidProfiles} hint="auto-Closed" />
                <Stat label="Blocks" value={social.blockCount} />
                <Stat label="Total reports" value={social.reportCount} />
                <Stat label="Stream events total" value={social.eventCount} />
              </div>
            </>
          )}
        </section>
      )}

      {config.flags.socialEnabled && social?.traffic && (
        <TrafficSection traffic={social.traffic} />
      )}
    </div>
  );
}

function TrafficSection({ traffic }: { traffic: TrafficStats }) {
  const dailyBars = traffic.daily7d.map((d) => ({
    label: d.date.slice(5), // MM-DD
    value: d.visits,
  }));
  const totalSourceAttributed = traffic.topSources7d.reduce((acc, s) => acc + s.visits, 0);
  return (
    <section className="card p-5 space-y-4">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="h2">Traffic & sources</h2>
          <p className="muted text-xs">
            Anonymous SPA-load beacons. Tag your share URLs with{" "}
            <code className="text-white/70">?ref=…</code> or{" "}
            <code className="text-white/70">?utm_source=…</code> to see which posts brought visits.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Visits (24h)" value={traffic.visits24h} />
        <Stat label="Visits (7d)" value={traffic.visits7d} />
        <Stat label="Visits (30d)" value={traffic.visits30d} />
        <Stat label="Total recorded" value={traffic.totalVisits} hint="capped at 50k" />
      </div>

      <div>
        <div className="label mb-1">Last 7 days</div>
        {traffic.visits7d === 0 ? (
          <div className="text-xs text-white/40 italic">No visits recorded in the last 7 days yet.</div>
        ) : (
          <Bars data={dailyBars} width={520} height={120} color="#28e0b3" />
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="label mb-2">Top referrers (7d)</div>
          {traffic.topReferrers7d.length === 0 ? (
            <div className="text-xs text-white/40 italic">No referrers yet.</div>
          ) : (
            <ul className="text-sm space-y-1">
              {traffic.topReferrers7d.map((r) => (
                <li key={r.refDomain} className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-white truncate">{r.refDomain}</span>
                  <span className="text-white/60 tabular-nums ml-2">{r.visits}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="text-[11px] text-white/40 mt-2">
            <code>(direct)</code> = no referrer (paste / bookmark / app handoff).{" "}
            <code>(internal)</code> = SPA-internal nav.
          </div>
        </div>

        <div>
          <div className="label mb-2">
            Top sources (7d){" "}
            <span className="text-white/40 font-normal">
              · {totalSourceAttributed} attributed
            </span>
          </div>
          {traffic.topSources7d.length === 0 ? (
            <div className="text-xs text-white/40 italic">
              No tagged sources yet. Try sharing{" "}
              <code className="text-white/70">https://learnai.cloud-claude.com/?ref=ozs_blog</code>{" "}
              to see this populate.
            </div>
          ) : (
            <ul className="text-sm space-y-1">
              {traffic.topSources7d.map((s) => (
                <li key={s.source} className="flex items-center justify-between border-b border-white/5 pb-1">
                  <span className="text-white truncate">{s.source}</span>
                  <span className="text-white/60 tabular-nums ml-2">{s.visits}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
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
