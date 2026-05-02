import { useEffect, useState } from "react";
import { useSocial } from "../social/SocialContext";
import { baseHandleFromEmail } from "../social/handles";
import { useAdmin } from "../admin/AdminContext";
import { usePlayer } from "../store/PlayerContext";
import { TOPICS } from "../content";
import type { FollowEdge, PublicProfile, ProfileMode } from "../social/types";
import type { TopicId } from "../types";
import type { View } from "../App";
import { profileCompleteness, profileCompletenessSlots } from "../profile/completeness";

type PeopleTab = "summary" | "following" | "followers" | "pending" | "blocked";

/**
 * Settings → Network — the privacy + discoverability cockpit.
 *
 * One screen, owner-only. The five blocks:
 *  1. Profile visibility (Public ↔ Private) + a panic switch.
 *  2. Field-level visibility checkboxes (only meaningful when Open).
 *  3. Signals picker (max 5 Topics this profile is discoverable for).
 *  4. People summary (Following / Followers / Pending / Blocked counts) —
 *     the manage-each-list flows land in PR 4.
 *  5. The "View my public profile" CTA.
 *
 * Backed entirely by the offline `SocialService` until PR 7. Edits persist
 * to localStorage and are reflected on the Profile view immediately.
 */

interface Props {
  onNav: (v: View) => void;
}

export function Network({ onNav }: Props) {
  const social = useSocial();
  const { config } = useAdmin();
  const { state: player } = usePlayer();
  const [me, setMe] = useState<PublicProfile | null>(null);
  const [counts, setCounts] = useState({
    following: 0,
    followers: 0,
    pendingIn: 0,
    pendingOut: 0,
    blocked: 0,
  });
  const [signalsDraft, setSignalsDraft] = useState<TopicId[]>([]);
  const [busy, setBusy] = useState(false);

  // Load my profile + counts.
  const refresh = async () => {
    const [profile, following, followers, pendingIn, pendingOut, blocked] =
      await Promise.all([
        social.getMyProfile(),
        social.listFollowing(),
        social.listFollowers(),
        social.listPendingIncoming(),
        social.listPendingOutgoing(),
        social.listBlocked(),
      ]);
    setMe(profile);
    setSignalsDraft(profile?.signals ?? []);
    setCounts({
      following: following.length,
      followers: followers.length,
      pendingIn: pendingIn.length,
      pendingOut: pendingOut.length,
      blocked: blocked.length,
    });
  };

  useEffect(() => {
    void refresh();
    // Re-fetch when the underlying SocialService identity changes (e.g.
    // sign-in, profile hydrates, social flag flips). Stale closures over
    // `social` are fine because we capture `social.service` directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [social.service]);

  if (!me) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="h1">Network</h1>
          <p className="muted text-sm">Loading…</p>
        </header>
      </div>
    );
  }

  const setMode = async (mode: ProfileMode) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await social.updateProfile({ profileMode: mode });
      setMe(next);
    } finally {
      setBusy(false);
    }
  };

  const flipFlag = async (
    key: "showFullName" | "showCurrent" | "showMap" | "showActivity" | "showBadges" | "showSignup" | "signalsGlobal",
    value: boolean,
  ) => {
    const next = await social.updateProfile({ [key]: value });
    if (next) setMe(next);
  };

  const toggleSignal = (id: TopicId) => {
    setSignalsDraft((arr) => {
      if (arr.includes(id)) return arr.filter((x) => x !== id);
      if (arr.length >= config.socialConfig.signalsMaxPerUser) return arr;
      return [...arr, id];
    });
  };

  const saveSignals = async () => {
    const got = await social.setSignals(signalsDraft);
    setSignalsDraft(got);
    void refresh();
  };

  const takeMeDown = async () => {
    if (!confirm("Switch to Closed mode and pause discoverability? You can flip back any time.")) return;
    await setMode("closed");
  };

  const isKid = me.ageBandIsKid;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <button onClick={() => onNav({ name: "settings" })} className="text-xs text-white/50 hover:text-white">
            ← Settings
          </button>
          <h1 className="h1 mt-1">Network</h1>
          <p className="muted text-sm">
            Who can see you, what they see, and the people you've followed.
          </p>
        </div>
        <button
          className="btn-ghost text-sm"
          onClick={() => onNav({ name: "profile", handle: me.handle })}
        >
          👁 View my public profile
        </button>
      </header>

      <CompletenessCard profile={me} fallbackPicture={player.identity?.picture} />

      {/* 1. Profile visibility + panic switch */}
      <section className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="h2">Profile visibility</h2>
            <p className="muted text-xs mt-1">
              {isKid
                ? "Your profile is private by default — kids' profiles are not discoverable."
                : "Public profiles are discoverable. Private profiles require approval before someone can follow you."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={`btn ${me.profileMode === "open" ? "btn-good" : "btn-ghost"} text-sm`}
              disabled={isKid || busy}
              onClick={() => setMode("open")}
            >
              🌐 Public
            </button>
            <button
              className={`btn ${me.profileMode === "closed" ? "btn-good" : "btn-ghost"} text-sm`}
              disabled={busy}
              onClick={() => setMode("closed")}
            >
              🔒 Private
            </button>
          </div>
        </div>
        <div className="text-xs text-white/50">
          Currently: <strong className="text-white">{me.profileMode === "open" ? "Public" : "Private"}</strong>
          {isKid && <span className="ml-2">(kids profiles are always private)</span>}
        </div>
        {me.profileMode === "open" && !isKid && (
          <div className="pt-2 border-t border-white/5">
            <button className="btn-bad text-xs" onClick={takeMeDown} disabled={busy}>
              ⏸ Take me down (panic switch)
            </button>
            <p className="text-[11px] text-white/40 mt-1">
              Flips you to Private and pauses discoverability immediately. Reversible.
            </p>
          </div>
        )}
      </section>

      {/* 2. Field-level visibility */}
      {me.profileMode === "open" && me.ownerPrefs && (
        <section className="card p-5 space-y-3">
          <h2 className="h2">When my profile is Open, also show:</h2>
          <div className="space-y-2">
            <FieldToggle
              label="My current Topic + level (what I'm working on)"
              checked={me.ownerPrefs.showCurrent}
              onChange={(v) => flipFlag("showCurrent", v)}
            />
            <FieldToggle
              label="My Topic map (topic affinities)"
              checked={me.ownerPrefs.showMap}
              onChange={(v) => flipFlag("showMap", v)}
            />
            <FieldToggle
              label="My 14-day activity sparkline"
              checked={me.ownerPrefs.showActivity}
              onChange={(v) => flipFlag("showActivity", v)}
            />
            <FieldToggle
              label="My badges"
              checked={me.ownerPrefs.showBadges}
              onChange={(v) => flipFlag("showBadges", v)}
            />
            <FieldToggle
              label="My full name (otherwise first-name only)"
              checked={me.ownerPrefs.showFullName}
              onChange={(v) => flipFlag("showFullName", v)}
            />
            <FieldToggle
              label="Sign-up month"
              checked={me.ownerPrefs.showSignup}
              onChange={(v) => flipFlag("showSignup", v)}
            />
            <FieldToggle
              label="Show me on the Global Leaderboard"
              checked={me.ownerPrefs.signalsGlobal}
              onChange={(v) => flipFlag("signalsGlobal", v)}
            />
          </div>
          <p className="text-[11px] text-white/40">
            We never show your email, age, location, or your specific Spark answers. Those are
            never collected for the social layer.
          </p>
        </section>
      )}

      {/* 3. Signals */}
      <section className="card p-5 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="h2">Signals</h2>
            <p className="muted text-xs">
              Pick up to {config.socialConfig.signalsMaxPerUser} Topics you want to be discoverable for. You'll appear on those Topic Leaderboards.
            </p>
          </div>
          <div className="text-xs text-white/50">
            {signalsDraft.length} / {config.socialConfig.signalsMaxPerUser}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {TOPICS.map((t) => {
            const on = signalsDraft.includes(t.id);
            const disabled =
              !on && signalsDraft.length >= config.socialConfig.signalsMaxPerUser;
            return (
              <button
                key={t.id}
                onClick={() => toggleSignal(t.id)}
                disabled={disabled}
                className={`p-2 rounded-xl border text-left transition ${
                  on
                    ? "bg-accent/15 border-accent"
                    : disabled
                      ? "bg-white/5 border-white/5 opacity-40"
                      : "bg-white/5 border-white/10 hover:border-white/30"
                }`}
              >
                <span className="mr-2">{t.emoji}</span>
                <span className="text-white">{t.name}</span>
              </button>
            );
          })}
        </div>
        <button className="btn-primary text-sm" onClick={saveSignals}>
          Save Signals
        </button>
      </section>

      {/* 4. People — tabbed list management */}
      <PeopleSection counts={counts} onChanged={refresh} onNav={onNav} />
    </div>
  );
}

// -- People (tabbed lists) -----------------------------------------------

function PeopleSection({
  counts,
  onChanged,
  onNav,
}: {
  counts: {
    following: number;
    followers: number;
    pendingIn: number;
    pendingOut: number;
    blocked: number;
  };
  onChanged: () => Promise<void>;
  onNav: (v: View) => void;
}) {
  const social = useSocial();
  const [tab, setTab] = useState<PeopleTab>("summary");
  const [following, setFollowing] = useState<FollowEdge[]>([]);
  const [followers, setFollowers] = useState<FollowEdge[]>([]);
  const [pendingIn, setPendingIn] = useState<FollowEdge[]>([]);
  const [pendingOut, setPendingOut] = useState<FollowEdge[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);

  const reload = async () => {
    const [fEdges, fEdges2, pIn, pOut, blocks] = await Promise.all([
      social.listFollowing({ status: "approved" }),
      social.listFollowers({ status: "approved" }),
      social.listPendingIncoming(),
      social.listPendingOutgoing(),
      social.listBlocked(),
    ]);
    setFollowing(fEdges);
    setFollowers(fEdges2);
    setPendingIn(pIn);
    setPendingOut(pOut);
    setBlocked(blocks);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [social.service]);

  const after = async () => {
    await reload();
    await onChanged();
  };

  return (
    <section className="card p-5 space-y-3">
      <h2 className="h2">People</h2>
      <div className="flex flex-wrap gap-1.5">
        <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>
          Summary
        </TabButton>
        <TabButton active={tab === "following"} onClick={() => setTab("following")}>
          Following ({counts.following})
        </TabButton>
        <TabButton active={tab === "followers"} onClick={() => setTab("followers")}>
          Followers ({counts.followers})
        </TabButton>
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
          Pending ({counts.pendingIn + counts.pendingOut})
        </TabButton>
        <TabButton active={tab === "blocked"} onClick={() => setTab("blocked")}>
          Blocked ({counts.blocked})
        </TabButton>
      </div>

      {tab === "summary" && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="Following" value={counts.following} />
          <Stat label="Followers" value={counts.followers} />
          <Stat label="Pending in" value={counts.pendingIn} />
          <Stat label="Pending out" value={counts.pendingOut} />
          <Stat label="Blocked" value={counts.blocked} />
        </div>
      )}

      {tab === "following" && (
        <PeopleList
          empty="You're not following anyone yet. Tap a profile to follow."
          rows={following.map((e) => ({
            label: `@${e.target}`,
            sublabel: e.muted ? "Muted" : undefined,
            actions: [
              {
                label: e.muted ? "Unmute" : "Mute",
                onClick: async () => {
                  await social.setMuted(e.target, !e.muted);
                  await after();
                },
              },
              {
                label: "Unfollow",
                variant: "ghost" as const,
                onClick: async () => {
                  await social.unfollow(e.target);
                  await after();
                },
              },
              {
                label: "Profile",
                onClick: () => onNav({ name: "profile", handle: e.target }),
              },
            ],
          }))}
        />
      )}

      {tab === "followers" && (
        <PeopleList
          empty="No one's following you yet. Share your profile link."
          rows={followers.map((e) => ({
            label: `@${baseHandleFromEmail(e.follower)}`,
            sublabel: undefined,
            actions: [
              {
                label: "Profile",
                onClick: () =>
                  onNav({ name: "profile", handle: baseHandleFromEmail(e.follower) }),
              },
            ],
          }))}
        />
      )}

      {tab === "pending" && (
        <div className="space-y-3">
          <div>
            <div className="label">Incoming follow requests</div>
            <PeopleList
              empty="No incoming requests."
              rows={pendingIn.map((e) => ({
                label: `@${baseHandleFromEmail(e.follower)}`,
                actions: [
                  {
                    label: "Approve",
                    variant: "good" as const,
                    onClick: async () => {
                      await social.approveFollowRequest(e.follower);
                      await after();
                    },
                  },
                  {
                    label: "Decline",
                    variant: "bad" as const,
                    onClick: async () => {
                      await social.declineFollowRequest(e.follower);
                      await after();
                    },
                  },
                ],
              }))}
            />
          </div>
          <div>
            <div className="label">Outgoing follow requests</div>
            <PeopleList
              empty="No outgoing requests."
              rows={pendingOut.map((e) => ({
                label: `@${e.target}`,
                actions: [
                  {
                    label: "Cancel",
                    variant: "ghost" as const,
                    onClick: async () => {
                      await social.cancelMyPendingRequest(e.target);
                      await after();
                    },
                  },
                ],
              }))}
            />
          </div>
        </div>
      )}

      {tab === "blocked" && (
        <PeopleList
          empty="Nobody's blocked. (Block from a profile's ⋯ menu.)"
          rows={blocked.map((b) => ({
            label: b.startsWith("@") ? b : `@${b}`,
            actions: [
              {
                label: "Unblock",
                variant: "ghost" as const,
                onClick: async () => {
                  await social.unblock(b);
                  await after();
                },
              },
            ],
          }))}
        />
      )}
    </section>
  );
}

function TabButton({
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

interface PeopleRow {
  label: string;
  sublabel?: string;
  actions: {
    label: string;
    onClick: () => void | Promise<void>;
    variant?: "ghost" | "good" | "bad";
  }[];
}

function PeopleList({ rows, empty }: { rows: PeopleRow[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-xs text-white/40 italic">{empty}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li
          key={`${r.label}-${i}`}
          className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate">{r.label}</div>
            {r.sublabel && (
              <div className="text-[11px] text-white/50">{r.sublabel}</div>
            )}
          </div>
          <div className="flex gap-1.5">
            {r.actions.map((a) => (
              <button
                key={a.label}
                onClick={() => void a.onClick()}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                  a.variant === "good"
                    ? "bg-good/15 text-good hover:bg-good/25"
                    : a.variant === "bad"
                      ? "bg-bad/15 text-bad hover:bg-bad/25"
                      : a.variant === "ghost"
                        ? "bg-white/5 text-white/70 hover:bg-white/10"
                        : "bg-accent/15 text-accent hover:bg-accent/25"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

// -- Helpers ------------------------------------------------------------

function FieldToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-white/80">{label}</span>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
      <div className="text-2xl font-display font-bold text-white tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-white/50 mt-1">{label}</div>
    </div>
  );
}

function CompletenessCard({
  profile,
  fallbackPicture,
}: {
  profile: PublicProfile;
  fallbackPicture?: string;
}) {
  const slots = profileCompletenessSlots(profile, fallbackPicture);
  const score = profileCompleteness(profile, fallbackPicture);
  const missing = slots.filter((s) => !s.done);
  if (score >= 100) return null;

  // Stroke-dasharray math for an r=28 ring → circumference ≈ 175.93.
  const dash = (score / 100) * 175.93;

  return (
    <section
      className="card p-4 sm:p-5 space-y-3"
      data-testid="profile-completeness-card"
    >
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="6"
              fill="none"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="url(#__lai_completeness_g)"
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${dash} 175.93`}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="__lai_completeness_g" x1="0" x2="1">
                <stop offset="0%" stopColor="#7c5cff" />
                <stop offset="100%" stopColor="#28e0b3" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-white tabular-nums">
            {score}%
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white">Finish your profile</div>
          <div className="text-xs text-white/60">
            {missing.length === 1
              ? "1 small thing left."
              : `${missing.length} small things left.`}
          </div>
        </div>
      </div>
      <ul className="text-xs text-white/70 space-y-1">
        {missing.slice(0, 5).map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-warn" /> {s.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
