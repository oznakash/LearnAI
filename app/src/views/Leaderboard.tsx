import { useEffect, useMemo, useState } from "react";
import { usePlayer } from "../store/PlayerContext";
import { useAdmin } from "../admin/AdminContext";
import { useSocial } from "../social/SocialContext";
import { baseHandleFromEmail } from "../social/handles";
import { tierForXP } from "../store/game";
import { isHiddenAccount, isHiddenHandle } from "../lib/hidden-accounts";
import { TOPICS } from "../content";
import { Mascot } from "../visuals/Mascot";
import type { BoardPeriod, BoardScope, PublicProfile } from "../social/types";
import type { TopicId } from "../types";
import type { View } from "../App";

type ScopeKey = "global" | "following" | TopicId;

/**
 * Leaderboards view — three modes per the engineering plan:
 *  - Global Leaderboard (all-Topics, real Open profiles + a labelled mock filler).
 *  - Per-Topic boards: one tab per Signal the player is opted into,
 *    plus a `+` to add ad-hoc Topic tabs.
 *  - Following: same as Global but filtered to people I follow.
 *
 * Backed by `social.getBoard(scope, period)`. Offline mode returns [];
 * we fold in the mock cohort below 10 real rows so the screen is alive
 * even on a brand-new install.
 */

interface Props {
  onNav?: (v: View) => void;
}

const FAKE_GUILD: { nameKey: "mascotBot" | "ada" | "marcus" | "priya" | "diego" | "yuki" | "sam" | "rae"; xp: number; emoji: string }[] = [
  { nameKey: "mascotBot", xp: 1240, emoji: "🤖" },
  { nameKey: "ada", xp: 980, emoji: "🦊" },
  { nameKey: "marcus", xp: 740, emoji: "🐯" },
  { nameKey: "priya", xp: 620, emoji: "🦋" },
  { nameKey: "diego", xp: 410, emoji: "🐻" },
  { nameKey: "yuki", xp: 270, emoji: "🐰" },
  { nameKey: "sam", xp: 140, emoji: "🐧" },
  { nameKey: "rae", xp: 60, emoji: "🐢" },
];

const FAKE_NAMES: Record<typeof FAKE_GUILD[number]["nameKey"], string> = {
  mascotBot: "BOT",
  ada: "Ada (Architect)",
  marcus: "Marcus",
  priya: "Priya",
  diego: "Diego",
  yuki: "Yuki",
  sam: "Sam",
  rae: "Rae",
};

const PERIODS: { id: BoardPeriod; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export function Leaderboard({ onNav }: Props = {}) {
  const { state } = usePlayer();
  const { config } = useAdmin();
  const social = useSocial();
  const [scope, setScope] = useState<ScopeKey>("global");
  const [period, setPeriod] = useState<BoardPeriod>("week");
  const [rows, setRows] = useState<PublicProfile[]>([]);
  const [mySignals, setMySignals] = useState<TopicId[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  // Load my signals once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await social.getMyProfile();
      if (!cancelled && me) setMySignals(me.signals);
    })();
    return () => {
      cancelled = true;
    };
  }, [social.service]);

  // Load the active board.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const apiScope: BoardScope =
        scope === "global" || scope === "following"
          ? scope
          : { topicId: scope as TopicId };
      const got = await social.getBoard(apiScope, period);
      if (!cancelled) {
        setRows(got);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, period, social.service]);

  const me = useMemo(
    () => ({
      // P0-4 fix: canonical handle (matches what the social-svc returns).
      handle: state.identity?.email
        ? baseHandleFromEmail(state.identity.email)
        : "you",
      name: state.identity?.name ?? state.identity?.email ?? "You",
      xp: state.xp,
    }),
    [state],
  );

  const tier = tierForXP(state.xp);

  // Build the rendered roster: real rows first, then mock filler if sparse,
  // then `me` mixed in by xp.
  const players = useMemo(() => {
    // Strip internal QA personas before any layout work happens, so the
    // dedupe + sort logic below never sees them. See
    // `app/src/lib/hidden-accounts.ts` and `docs/test-personas.md`.
    const real = rows
      .filter((p) => !isHiddenHandle(p.handle))
      .map((p, i) => ({
        key: `r-${p.handle}-${i}`,
        handle: p.handle,
        name: p.displayName,
        xp: p.xpTotal,
        emoji: "👤",
        isMe: p.handle.toLowerCase() === me.handle.toLowerCase(),
        isMock: false,
        tier: p.guildTier,
      }));
    // Mock filler is gated behind the admin `showDemoData` flag (default
    // false in production). Without the flag, real users see only real
    // peers + themselves; the cohort never includes synthetic accounts.
    // With the flag (dev / screenshots / demos), it fills below 10 real
    // rows on Global / Topic scopes — never Following.
    const filler =
      config.flags.showDemoData && scope !== "following" && real.length < 10
        ? FAKE_GUILD.map((p, i) => ({
            key: `m-${p.nameKey}-${i}`,
            handle: p.nameKey,
            name:
              p.nameKey === "mascotBot"
                ? `${config.branding.mascotName} Bot`
                : FAKE_NAMES[p.nameKey],
            xp: p.xp,
            emoji: p.emoji,
            isMe: false,
            isMock: true,
            tier: tierForXP(p.xp),
          }))
        : [];
    // Internal QA personas (see `app/src/lib/hidden-accounts.ts` +
    // `docs/test-personas.md`) are filtered from every leaderboard row so
    // dogfood traffic never pollutes the public cohort.
    const iAmHidden = isHiddenAccount(state.identity?.email);
    const meRow = scope === "following" || iAmHidden
      ? null
      : {
          key: "me",
          handle: me.handle,
          name: me.name,
          xp: me.xp,
          emoji: "🌟",
          isMe: true,
          isMock: false,
          tier,
        };
    const all = [...real, ...filler, ...(meRow ? [meRow] : [])];
    return all
      .sort((a, b) => b.xp - a.xp)
      .filter((row, idx, arr) => {
        // Dedupe consecutive rows representing the same handle (e.g. real
        // me + tile me when the offline service returns my own row).
        if (idx === 0) return true;
        return row.handle.toLowerCase() !== arr[idx - 1].handle.toLowerCase();
      });
  }, [rows, me.handle, me.name, me.xp, tier, scope, config.branding.mascotName, config.flags.showDemoData, state.identity?.email]);

  const scopeIsTopic = scope !== "global" && scope !== "following";
  const scopeTopic = scopeIsTopic ? TOPICS.find((t) => t.id === scope) : null;
  const visibleTopicTabs = useMemo(() => {
    const ids = new Set<TopicId>(mySignals);
    if (scopeIsTopic) ids.add(scope as TopicId);
    return TOPICS.filter((t) => ids.has(t.id));
  }, [mySignals, scope, scopeIsTopic]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="h1">Leaderboards</h1>
          <p className="muted text-sm">
            Where you stand. Pick a Topic above to see that Topic's board.
          </p>
        </div>
        <div className="hidden sm:block">
          <div className="pill bg-good/10 text-good border border-good/30">🏅 You: {tier}</div>
        </div>
      </header>

      {/* Scope tabs */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <ScopeTab active={scope === "global"} onClick={() => setScope("global")}>
          🌐 Global
        </ScopeTab>
        {visibleTopicTabs.map((t) => (
          <ScopeTab
            key={t.id}
            active={scope === t.id}
            onClick={() => setScope(t.id)}
          >
            {t.emoji} {t.name}
          </ScopeTab>
        ))}
        <ScopeTab active={scope === "following"} onClick={() => setScope("following")}>
          ✓ Following
        </ScopeTab>
        <button
          onClick={() => setShowTopicPicker((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-white/60 hover:bg-white/10"
        >
          + Topic
        </button>
      </div>

      {showTopicPicker && (
        <div className="card p-3 grid sm:grid-cols-3 gap-2">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setScope(t.id);
                setShowTopicPicker(false);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 text-sm"
            >
              <span>{t.emoji}</span>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Period pills */}
      <div className="flex gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              period === p.id
                ? "bg-accent text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-3">
          <Mascot mood="wow" size={64} />
          <div>
            <div className="font-display font-semibold text-white">
              {scope === "global"
                ? "Global Leaderboard"
                : scope === "following"
                  ? "Following"
                  : `${scopeTopic?.emoji ?? ""} ${scopeTopic?.name ?? ""} Leaderboard`}
            </div>
            <div className="text-xs text-white/50">
              {scope === "following" && rows.length === 0 && players.length === 0
                ? "Follow some builders to see them here."
                : `Climb tiers by earning ${config.branding.xpUnit} (⚡) and beating Boss Cells.`}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-white/50">Loading…</p>
        ) : players.length === 0 ? (
          <p className="text-xs text-white/50">No one's on this board yet.</p>
        ) : players.length === 1 && players[0].isMe ? (
          <div className="space-y-3">
            <ol className="space-y-2">
              <li className="flex items-center gap-3 p-3 rounded-xl border bg-accent/15 border-accent shadow-glow">
                <div className="w-8 h-8 grid place-items-center rounded-full text-sm font-bold bg-warn text-ink2">1</div>
                <div className="text-2xl">{players[0].emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {players[0].name}
                    <span className="chip ml-2">you</span>
                  </div>
                  <div className="text-xs text-white/50">{players[0].tier}</div>
                </div>
                <div className="font-display tabular-nums text-white">⚡ {players[0].xp}</div>
              </li>
            </ol>
            <div className="text-xs text-white/55 px-1">
              You're the first builder on this board. Share your profile to invite peers — your cohort grows as more people sign in.
            </div>
          </div>
        ) : (
          <ol className="space-y-2">
            {players.slice(0, 100).map((p, i) => (
              <li
                key={p.key}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  p.isMe
                    ? "bg-accent/15 border-accent shadow-glow"
                    : p.isMock
                      ? "bg-white/3 border-white/5"
                      : "bg-white/5 border-white/10"
                }`}
              >
                <div
                  className={`w-8 h-8 grid place-items-center rounded-full text-sm font-bold ${
                    i === 0
                      ? "bg-warn text-ink2"
                      : i === 1
                        ? "bg-white/20 text-white"
                        : i === 2
                          ? "bg-accent2/40 text-ink2"
                          : "bg-white/10 text-white/60"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="text-2xl">{p.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">
                    {p.name}
                    {p.isMe && <span className="chip ml-2">you</span>}
                    {p.isMock && (
                      <span className="text-[10px] text-white/40 ml-2 uppercase tracking-wider">
                        sample
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/50">{p.tier}</div>
                </div>
                {!p.isMe && !p.isMock && onNav && (
                  <button
                    className="text-xs text-white/50 hover:text-white px-2"
                    onClick={() => onNav({ name: "profile", handle: p.handle })}
                    title="View profile"
                  >
                    profile
                  </button>
                )}
                <div className="font-display tabular-nums text-white">⚡ {p.xp}</div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="card p-4 sm:p-5">
        <h2 className="h2">Tiers</h2>
        <ul className="text-sm text-white/70 mt-2 space-y-1.5">
          <li><span className="chip bg-white/5">Builder</span> &lt; 100 ⚡</li>
          <li><span className="chip bg-accent2/10 text-accent2 border-accent2/30">Architect</span> 100+ ⚡</li>
          <li><span className="chip bg-warn/10 text-warn border-warn/30">Visionary</span> 500+ ⚡</li>
          <li><span className="chip bg-bad/10 text-bad border-bad/30">Founder</span> 1500+ ⚡</li>
          <li><span className="chip bg-accent/10 text-accent border-accent/30">Singularity</span> 5000+ ⚡</li>
        </ul>
      </div>
    </div>
  );
}

function ScopeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
        active
          ? "bg-accent text-white"
          : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
