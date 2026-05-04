import { useState } from "react";
import { TOPICS } from "../content";
import { usePlayer } from "../store/PlayerContext";
import { activityByDay, nextRecommendedSpark, nextTierThreshold, suggestSwitchTopic, topicCompletion, uxStage } from "../store/game";
import { useTodayInsight } from "../memory/insight";
import { useAdmin } from "../admin/AdminContext";
import { ROLE_LABEL } from "../store/role";
import { pulseForAudience } from "../store/pulse";
import { PulseStrip } from "../components/PulseStrip";
import type { View } from "../App";
import { Mascot } from "../visuals/Mascot";
import { Sparkline, Ring } from "../visuals/Charts";
import { Illustration } from "../visuals/Illustrations";
import type { Role, TopicId } from "../types";

export function Home({ onNav }: { onNav: (v: View) => void }) {
  const { state } = usePlayer();
  const { config: adminCfg } = useAdmin();
  const { insight } = useTodayInsight(state);
  const [whyOpen, setWhyOpen] = useState(false);
  const interests: TopicId[] = state.profile?.interests?.length ? state.profile.interests : TOPICS.map((t) => t.id);
  const featured = TOPICS.filter((t) => interests.includes(t.id));
  const others = TOPICS.filter((t) => !interests.includes(t.id));
  const activity = activityByDay(state, 14).map((d) => d.sparks);

  // Pick a "today" target topic. If the cognition layer has an insight,
  // prefer its topic; otherwise fall back to the heuristic of the
  // least-recently-touched interest. Either way, the existing "Today's
  // quest" UI keeps working.
  const heuristicTarget =
    featured.sort(
      (a, b) => (state.progress.topicLastTouched[a.id] ?? 0) - (state.progress.topicLastTouched[b.id] ?? 0)
    )[0] ?? TOPICS[0];
  const target = insight
    ? TOPICS.find((t) => t.id === insight.topicId) ?? heuristicTarget
    : heuristicTarget;
  const insightTopic = insight ? TOPICS.find((t) => t.id === insight.topicId) ?? null : null;

  const next = nextRecommendedSpark(state, target.id);
  const switchSuggestion = suggestSwitchTopic(state, target.id);
  const switchTopic = switchSuggestion ? TOPICS.find((t) => t.id === switchSuggestion) : null;

  // Progressive disclosure: a fresh user shouldn't see an empty 14-day
  // sparkline, an empty stats grid, or a "0-day Streak" tile. The
  // primary CTA (Start a Spark) is the only thing they need on Home.
  // See `docs/aha-and-network.md` §5.
  const stage = uxStage(state);
  const nextTier = nextTierThreshold(state.xp);

  // "Today in AI" Pulse — admin-curated daily-trend strip. Filtered by
  // the player's age band (kids / teens see kid-tagged items, adults
  // see adult-tagged items, "all" → everyone). Hidden if the operator
  // has flipped the `pulse.enabled` master switch off OR the visible
  // list ends up empty for this audience.
  const pulseItems = adminCfg.pulse?.enabled
    ? pulseForAudience(adminCfg.pulse.items, state.profile?.ageBand)
    : [];

  return (
    <div className="space-y-6">
      {pulseItems.length > 0 && (
        <PulseStrip
          items={pulseItems}
          onOpenTopic={(topicId) => onNav({ name: "play", topicId })}
        />
      )}
      {insight && insightTopic && (
        <section
          className="card p-4 sm:p-5 border border-accent/30 bg-accent/5 relative overflow-hidden"
          aria-label="Today, for you"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">✨</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-accent font-semibold">
                For you, today
              </div>
              <div className="font-display font-semibold text-white text-lg leading-tight mt-1">
                Pick up your {insightTopic.emoji} {insightTopic.name} thread
              </div>
              <div className="text-sm text-white/70 mt-1">{insight.reason}</div>
              {whyOpen && (
                <div className="mt-3 text-xs bg-white/5 border border-white/10 rounded-lg p-3 text-white/70 space-y-1">
                  <div>
                    <span className="text-white/50">Memory text:</span>{" "}
                    <span className="text-white">{insight.memory.text}</span>
                  </div>
                  {insight.memory.category && (
                    <div>
                      <span className="text-white/50">Category:</span>{" "}
                      <span className="text-white">{insight.memory.category}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-white/50">Recorded:</span>{" "}
                    <span className="text-white">
                      {new Date(insight.memory.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    className="text-accent hover:underline mt-1"
                    onClick={() => onNav({ name: "memory" })}
                  >
                    Open Your Memory →
                  </button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn-primary text-sm"
                  onClick={() => onNav({ name: "play", topicId: insightTopic.id })}
                >
                  ▶ Continue this thread
                </button>
                <button
                  className="btn-ghost text-sm"
                  onClick={() => setWhyOpen((v) => !v)}
                  aria-expanded={whyOpen}
                >
                  {whyOpen ? "Hide why" : "Why?"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

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

      {stage === "fresh" ? (
        <FreshStageHeader playerRole={state.profile?.role} dailyMinutes={state.profile?.dailyMinutes ?? 10} target={target.name} />
      ) : (
        <section className="grid sm:grid-cols-3 gap-4">
          <div className="card p-4 flex items-center gap-4">
            {nextTier ? (
              <Ring
                pct={Math.min(100, Math.round((state.xp / nextTier.xp) * 100))}
                size={84}
                stroke={10}
                sublabel={`to ${nextTier.name}`}
                label={`${state.xp}`}
              />
            ) : (
              <Ring pct={100} size={84} stroke={10} sublabel="Top tier" label={`${state.xp}`} />
            )}
            <div>
              <div className="font-semibold text-white">{adminCfg.branding.xpUnit}</div>
              <div className="muted text-sm">Tier: {state.guildTier}</div>
              {nextTier && (
                <div className="text-[11px] text-white/50 mt-0.5">
                  {Math.max(0, nextTier.xp - state.xp)} {adminCfg.branding.xpUnit} to {nextTier.name}
                </div>
              )}
            </div>
          </div>
          <div className="card p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-warn/20 grid place-items-center text-warn text-3xl">🔥</div>
            <div>
              <div className="font-semibold text-white">{state.streak}-day Streak</div>
              <div className="muted text-sm">Show up tomorrow to keep it.</div>
            </div>
          </div>
          {stage === "returning" ? (
            <div className="card p-4">
              <div className="text-xs text-white/50 mb-1">Last 14 days</div>
              <Sparkline data={activity} width={240} height={56} />
              <div className="text-xs text-white/50 mt-1">
                {activity.reduce((a, b) => a + b, 0)} Sparks
              </div>
            </div>
          ) : (
            // `engaged` users get a sparkline-shaped *placeholder* with
            // a forward-looking message — not 14 grey dots. The
            // sparkline appears in full on the next session ("returning").
            <div className="card p-4 flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-accent/15 grid place-items-center text-2xl">📈</div>
              <div className="text-sm text-white/75">
                <div className="text-white font-semibold">Your rhythm starts forming tomorrow.</div>
                <div className="muted text-xs mt-0.5">
                  Come back to begin a 14-day streak chart.
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="h2">Your Topics</h2>
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

      {/* Discover-more grid kept below */}
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

/**
 * The fresh-user welcome card. Replaces the empty stats grid with an
 * "I see you" moment that references the role + daily-minutes the user
 * just gave us during onboarding. Drops back to a generic hint when the
 * profile is too sparse to personalize (back-compat with profiles
 * created before the role field shipped).
 */
function FreshStageHeader({
  playerRole,
  dailyMinutes,
  target,
}: {
  playerRole: Role | undefined;
  dailyMinutes: number;
  target: string;
}) {
  const role = playerRole ? ROLE_LABEL[playerRole] : null;
  return (
    <section
      className="card p-4 sm:p-5 flex items-start gap-3 border border-white/5 bg-white/[0.03]"
      aria-label="First steps"
    >
      <div className="text-2xl">{role?.emoji ?? "🌱"}</div>
      <div className="flex-1 text-sm text-white/75">
        {role ? (
          <>
            <div className="text-white font-semibold">
              Set up for a {role.label.toLowerCase()}: {dailyMinutes} min · {target} first.
            </div>
            <div className="muted text-xs mt-0.5">
              Tap Start above for your first Spark — stats and a 14-day sparkline appear after a couple plays.
            </div>
          </>
        ) : (
          <>
            <div className="text-white font-semibold">Your first Spark plants your first dot.</div>
            <div className="muted text-xs mt-0.5">
              Stats, streaks, and your 14-day rhythm appear once you've completed a Spark or two.
            </div>
          </>
        )}
      </div>
    </section>
  );
}
