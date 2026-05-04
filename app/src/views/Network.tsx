import { useEffect, useState } from "react";
import { useSocial } from "../social/SocialContext";
import { baseHandleFromEmail } from "../social/handles";
import { useAdmin } from "../admin/AdminContext";
import { usePlayer } from "../store/PlayerContext";
import { TOPICS } from "../content";
import type { FollowEdge, ProfileLinks, PublicProfile, ProfileMode } from "../social/types";
import type { SkillLevel, TopicId } from "../types";
import type { View } from "../App";
import { profileCompleteness, profileCompletenessSlots } from "../profile/completeness";
import { ImageCropDialog } from "../components/ImageCropDialog";

/**
 * Escape characters that would let an attacker break out of a CSS
 * `url(...)` literal. Only relevant for hero URLs the user pastes;
 * uploaded URLs are server-controlled or `data:image/...;base64,...`
 * which can't carry single-quote / paren bytes.
 */
function escapeCssUrl(raw: string): string {
  return raw.replace(/[)(\\'"]/g, (c) => `\\${c}`);
}

const SKILL_LABELS: { id: SkillLevel; label: string; emoji: string }[] = [
  { id: "starter", label: "Curious starter", emoji: "🌱" },
  { id: "explorer", label: "Hobby explorer", emoji: "🔭" },
  { id: "builder", label: "Active builder", emoji: "🛠️" },
  { id: "architect", label: "Senior architect", emoji: "🏛️" },
  { id: "visionary", label: "Frontier visionary", emoji: "🌌" },
];

type PeopleTab = "summary" | "following" | "followers" | "pending" | "blocked";

/**
 * Settings → Network — the privacy + discoverability cockpit.
 *
 * Layout (top → bottom, by priority):
 *  1. Completeness ring (a small celebratory nudge).
 *  2. Profile editor — banner + avatar live preview, then the
 *     few fields that actually matter (name, bio, skill,
 *     pronouns, location) and your links.
 *  3. Signals — the topics you want to be discoverable for.
 *  4. People — followers, following, pending, blocked.
 *  5. Profile visibility (PUBLIC / PRIVATE) — at the BOTTOM
 *     because the operator wants this to be the *last* thing a
 *     fresh user worries about. The 13 field-level toggles live
 *     inside a collapsed disclosure so they don't crowd the
 *     page.
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
    key:
      | "showFullName"
      | "showCurrent"
      | "showMap"
      | "showActivity"
      | "showBadges"
      | "showSignup"
      | "signalsGlobal"
      | "showBio"
      | "showPronouns"
      | "showLocation"
      | "showHero"
      | "showSkillLevel"
      | "showLinks",
    value: boolean,
  ) => {
    const next = await social.updateProfile({ [key]: value });
    if (next) setMe(next);
  };

  const saveDetails = async (patch: {
    fullName?: string;
    bio?: string;
    pronouns?: string;
    location?: string;
    heroUrl?: string;
    skillLevel?: SkillLevel;
    links?: ProfileLinks;
  }) => {
    const next = await social.updateProfile(patch);
    setMe(next);
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
    if (!confirm("Switch to Private and pause discoverability? You can flip back any time.")) return;
    await setMode("closed");
  };

  const isKid = me.ageBandIsKid;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <button onClick={() => onNav({ name: "settings" })} className="text-xs text-white/50 hover:text-white">
            ← Settings
          </button>
          <h1 className="h1 mt-1">Network</h1>
          <p className="muted text-sm">
            What other builders see — and the people in your network.
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

      <ProfileDetailsEditor
        profile={me}
        fallbackPicture={player.identity?.picture}
        onSave={saveDetails}
        onImageUpload={async (kind, dataUrl) => {
          const result = await social.uploadImage(kind, dataUrl);
          if (!result) return null;
          // The server has already updated pictureUrl/heroUrl on the
          // profile record (offline mode writes the data URL straight to
          // local profile state); refetch so the live-preview hero
          // refreshes immediately.
          await refresh();
          return result.url;
        }}
      />

      <SignalsCard
        signalsDraft={signalsDraft}
        max={config.socialConfig.signalsMaxPerUser}
        onToggle={toggleSignal}
        onSave={saveSignals}
      />

      <PeopleSection counts={counts} onChanged={refresh} onNav={onNav} />

      <VisibilityCard
        profile={me}
        isKid={isKid}
        busy={busy}
        onSetMode={setMode}
        onFlipFlag={flipFlag}
        onTakeMeDown={takeMeDown}
      />
    </div>
  );
}

// -- Visibility (privacy + advanced toggles, last on the page) ----------

function VisibilityCard({
  profile,
  isKid,
  busy,
  onSetMode,
  onFlipFlag,
  onTakeMeDown,
}: {
  profile: PublicProfile;
  isKid: boolean;
  busy: boolean;
  onSetMode: (m: ProfileMode) => void;
  onFlipFlag: (
    key:
      | "showFullName"
      | "showCurrent"
      | "showMap"
      | "showActivity"
      | "showBadges"
      | "showSignup"
      | "signalsGlobal"
      | "showBio"
      | "showPronouns"
      | "showLocation"
      | "showHero"
      | "showSkillLevel"
      | "showLinks",
    value: boolean,
  ) => void;
  onTakeMeDown: () => void;
}) {
  const isOpen = profile.profileMode === "open";
  return (
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
            className={`btn ${isOpen ? "btn-good" : "btn-ghost"} text-sm`}
            disabled={isKid || busy}
            onClick={() => onSetMode("open")}
          >
            🌐 Public
          </button>
          <button
            className={`btn ${!isOpen ? "btn-good" : "btn-ghost"} text-sm`}
            disabled={busy}
            onClick={() => onSetMode("closed")}
          >
            🔒 Private
          </button>
        </div>
      </div>
      <div className="text-xs text-white/50">
        Currently: <strong className="text-white">{isOpen ? "Public" : "Private"}</strong>
        {isKid && <span className="ml-2">(kids profiles are always private)</span>}
      </div>

      {isOpen && profile.ownerPrefs && (
        <details className="pt-2 border-t border-white/5 group">
          <summary className="cursor-pointer text-sm text-white/70 hover:text-white list-none flex items-center gap-2">
            <span className="text-white/40 group-open:rotate-90 transition-transform inline-block">▸</span>
            Show me what visitors can see (advanced)
          </summary>
          <div className="space-y-2 mt-3">
            <FieldToggle
              label="My current Topic + level (what I'm working on)"
              checked={profile.ownerPrefs.showCurrent}
              onChange={(v) => onFlipFlag("showCurrent", v)}
            />
            <FieldToggle
              label="My Topic map (topic affinities)"
              checked={profile.ownerPrefs.showMap}
              onChange={(v) => onFlipFlag("showMap", v)}
            />
            <FieldToggle
              label="My 14-day activity sparkline"
              checked={profile.ownerPrefs.showActivity}
              onChange={(v) => onFlipFlag("showActivity", v)}
            />
            <FieldToggle
              label="My badges"
              checked={profile.ownerPrefs.showBadges}
              onChange={(v) => onFlipFlag("showBadges", v)}
            />
            <FieldToggle
              label="My full name (otherwise first-name only)"
              checked={profile.ownerPrefs.showFullName}
              onChange={(v) => onFlipFlag("showFullName", v)}
            />
            <FieldToggle
              label="Sign-up month"
              checked={profile.ownerPrefs.showSignup}
              onChange={(v) => onFlipFlag("showSignup", v)}
            />
            <FieldToggle
              label="Show me on the Global Leaderboard"
              checked={profile.ownerPrefs.signalsGlobal}
              onChange={(v) => onFlipFlag("signalsGlobal", v)}
            />
            <FieldToggle
              label="My bio"
              checked={profile.ownerPrefs.showBio}
              onChange={(v) => onFlipFlag("showBio", v)}
            />
            <FieldToggle
              label="My pronouns"
              checked={profile.ownerPrefs.showPronouns}
              onChange={(v) => onFlipFlag("showPronouns", v)}
            />
            <FieldToggle
              label="My location"
              checked={profile.ownerPrefs.showLocation}
              onChange={(v) => onFlipFlag("showLocation", v)}
            />
            <FieldToggle
              label="My hero banner"
              checked={profile.ownerPrefs.showHero}
              onChange={(v) => onFlipFlag("showHero", v)}
            />
            <FieldToggle
              label="My skill level"
              checked={profile.ownerPrefs.showSkillLevel}
              onChange={(v) => onFlipFlag("showSkillLevel", v)}
            />
            <FieldToggle
              label="My external links"
              checked={profile.ownerPrefs.showLinks}
              onChange={(v) => onFlipFlag("showLinks", v)}
            />
            <p className="text-[11px] text-white/40 pt-1">
              We never show your email, age, location, or your specific Spark answers. Those are
              never collected for the social layer.
            </p>
          </div>
        </details>
      )}

      {isOpen && !isKid && (
        <div className="pt-2">
          <button className="btn-bad text-xs" onClick={onTakeMeDown} disabled={busy}>
            ⏸ Take me down (panic switch)
          </button>
          <p className="text-[11px] text-white/40 mt-1">
            Flips you to Private and pauses discoverability immediately. Reversible.
          </p>
        </div>
      )}
    </section>
  );
}

// -- Signals (lift to its own card so the main render reads cleanly) ----

function SignalsCard({
  signalsDraft,
  max,
  onToggle,
  onSave,
}: {
  signalsDraft: TopicId[];
  max: number;
  onToggle: (id: TopicId) => void;
  onSave: () => void;
}) {
  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="h2">Signals</h2>
          <p className="muted text-xs">
            Pick up to {max} Topics you want to be discoverable for. You'll appear on those Topic Leaderboards.
          </p>
        </div>
        <div className="text-xs text-white/50">
          {signalsDraft.length} / {max}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {TOPICS.map((t) => {
          const on = signalsDraft.includes(t.id);
          const disabled = !on && signalsDraft.length >= max;
          return (
            <button
              key={t.id}
              onClick={() => onToggle(t.id)}
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
      <button className="btn-primary text-sm" onClick={onSave}>
        Save Signals
      </button>
    </section>
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

// -- Profile details editor ---------------------------------------------

interface DraftState {
  fullName: string;
  bio: string;
  pronouns: string;
  location: string;
  heroUrl: string;
  skillLevel: SkillLevel | "";
  linkedin: string;
  github: string;
  twitter: string;
  website: string;
}

function draftFromProfile(p: PublicProfile): DraftState {
  return {
    fullName: p.ownerPrefs?.fullName ?? "",
    bio: p.bio ?? "",
    pronouns: p.pronouns ?? "",
    location: p.location ?? "",
    heroUrl: p.heroUrl ?? "",
    skillLevel: p.skillLevel ?? "",
    linkedin: p.links?.linkedin ?? "",
    github: p.links?.github ?? "",
    twitter: p.links?.twitter ?? "",
    website: p.links?.website ?? "",
  };
}

function ProfileDetailsEditor({
  profile,
  fallbackPicture,
  onSave,
  onImageUpload,
}: {
  profile: PublicProfile;
  /** Google avatar URL from `state.identity.picture` — used when the
   *  user hasn't uploaded a custom image yet. */
  fallbackPicture?: string;
  onSave: (patch: {
    fullName?: string;
    bio?: string;
    pronouns?: string;
    location?: string;
    heroUrl?: string;
    skillLevel?: SkillLevel;
    links?: ProfileLinks;
  }) => Promise<void>;
  /** Crop-and-upload handler. Resolves with the persisted URL, or
   *  null if the upload failed. */
  onImageUpload: (kind: "avatar" | "hero", dataUrl: string) => Promise<string | null>;
}) {
  const seed = draftFromProfile(profile);
  const [draft, setDraft] = useState<DraftState>(seed);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [cropOpen, setCropOpen] = useState<null | "avatar" | "hero">(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Re-seed when the upstream profile changes (after a save round-trip,
  // or after a parallel write from another surface).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(draftFromProfile(profile)), [
    profile.handle,
    profile.bio,
    profile.pronouns,
    profile.location,
    profile.heroUrl,
    profile.skillLevel,
    profile.ownerPrefs?.fullName,
    profile.links?.linkedin,
    profile.links?.github,
    profile.links?.twitter,
    profile.links?.website,
  ]);

  const dirty =
    draft.fullName !== seed.fullName ||
    draft.bio !== seed.bio ||
    draft.pronouns !== seed.pronouns ||
    draft.location !== seed.location ||
    draft.heroUrl !== seed.heroUrl ||
    draft.skillLevel !== seed.skillLevel ||
    draft.linkedin !== seed.linkedin ||
    draft.github !== seed.github ||
    draft.twitter !== seed.twitter ||
    draft.website !== seed.website;

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      await onSave({
        fullName: draft.fullName.trim() || undefined,
        bio: draft.bio.trim() || undefined,
        pronouns: draft.pronouns.trim() || undefined,
        location: draft.location.trim() || undefined,
        heroUrl: draft.heroUrl.trim() || undefined,
        skillLevel: draft.skillLevel || undefined,
        links: {
          linkedin: draft.linkedin.trim() || undefined,
          github: draft.github.trim() || undefined,
          twitter: draft.twitter.trim() || undefined,
          website: draft.website.trim() || undefined,
        },
      });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
    } finally {
      setBusy(false);
    }
  };

  const initials = (profile.displayName || profile.handle).charAt(0).toUpperCase();
  const avatarSrc = profile.pictureUrl || fallbackPicture || "";
  const previewName = (draft.fullName.trim() || profile.displayName).trim();
  const heroBg = draft.heroUrl
    ? `center / cover no-repeat url(${escapeCssUrl(draft.heroUrl)})`
    : "linear-gradient(135deg, rgba(124,92,255,0.35), rgba(40,224,179,0.25))";

  return (
    <section className="card overflow-hidden" data-testid="network-profile-details">
      {/* Live preview hero — banner across the top with the avatar overlapping
          the lower edge. Mirrors what visitors see on /u/<handle>, so the
          editor feels like you're decorating your own page rather than
          filling out a form. */}
      <div
        className="relative h-32 sm:h-40"
        style={{ background: heroBg }}
      >
        {!draft.heroUrl && (
          <div className="absolute inset-0 grid place-items-center text-white/55 text-xs italic px-4 text-center">
            No banner yet — we'll show a soft gradient on your page.
          </div>
        )}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {draft.heroUrl && (
            <button
              type="button"
              className="text-[11px] text-white/80 hover:text-white px-2 py-1.5 rounded-full bg-black/55 backdrop-blur-sm border border-white/20"
              onClick={() => setDraft((d) => ({ ...d, heroUrl: "" }))}
            >
              Remove
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-sm text-xs font-semibold text-white border border-white/20 hover:bg-black/75 active:scale-[0.98] transition"
            onClick={() => {
              setUploadError(null);
              setCropOpen("hero");
            }}
          >
            🖼 {draft.heroUrl ? "Change banner" : "Add a banner"}
          </button>
        </div>
      </div>

      {/* Avatar overlapping the banner edge — same visual rhythm as the
          public Profile header so the user gets a real preview of how
          their page looks. */}
      <div className="px-4 sm:px-6 -mt-12 sm:-mt-14 relative">
        <div className="flex items-end gap-3">
          <div className="relative shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-accent to-accent2 grid place-items-center text-white font-bold text-2xl sm:text-3xl ring-4 ring-ink shadow-card overflow-hidden">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <button
              type="button"
              aria-label="Change photo"
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-accent text-white grid place-items-center text-base shadow-card border-2 border-ink hover:brightness-110 active:scale-95 transition"
              onClick={() => {
                setUploadError(null);
                setCropOpen("avatar");
              }}
            >
              📷
            </button>
          </div>
          <div className="pb-2 flex-1 min-w-0">
            <div className="text-white font-display font-semibold text-base sm:text-lg leading-tight truncate">
              {previewName || "Your name"}
            </div>
            <div className="text-xs text-white/50 truncate">@{profile.handle}</div>
          </div>
        </div>
        {uploadError && (
          <p className="text-[11px] text-bad mt-2">{uploadError}</p>
        )}
      </div>

      {/* The actual editing fields — bio + name first because they shape
          the preview directly above. Everything else is secondary. */}
      <div className="p-4 sm:p-6 pt-5 space-y-4">
        <div>
          <h2 className="h2">About you</h2>
          <p className="muted text-xs mt-1">
            What other people see on your public page. Fill in what you want to share.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Full name"
            placeholder={profile.displayName}
            value={draft.fullName}
            onChange={(v) => setDraft((d) => ({ ...d, fullName: v }))}
            maxLength={64}
          />
          <div>
            <div className="label">Skill level</div>
            <select
              className="input"
              value={draft.skillLevel}
              onChange={(e) =>
                setDraft((d) => ({ ...d, skillLevel: e.target.value as SkillLevel | "" }))
              }
            >
              <option value="">— pick one —</option>
              {SKILL_LABELS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="label">Bio (one sentence)</div>
            <span className="text-[11px] text-white/40 tabular-nums">{draft.bio.length}/160</span>
          </div>
          <textarea
            className="input min-h-[64px]"
            placeholder="What you're building or curious about. One sentence."
            value={draft.bio}
            onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
            maxLength={200}
          />
          {draft.bio.length > 160 && (
            <p className="text-[11px] text-bad mt-1">Keep it under 160 characters.</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Pronouns"
            placeholder="she/her"
            value={draft.pronouns}
            onChange={(v) => setDraft((d) => ({ ...d, pronouns: v }))}
            maxLength={30}
          />
          <Field
            label="Location"
            placeholder="Tel Aviv"
            value={draft.location}
            onChange={(v) => setDraft((d) => ({ ...d, location: v }))}
            maxLength={60}
          />
        </div>

        <div>
          <div className="label">Your links</div>
          <p className="text-[11px] text-white/40 mb-2">
            Add the places you want people to find you. Paste a full URL — we'll tidy it up before saving.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Field
              label="LinkedIn"
              placeholder="https://linkedin.com/in/…"
              value={draft.linkedin}
              onChange={(v) => setDraft((d) => ({ ...d, linkedin: v }))}
            />
            <Field
              label="GitHub"
              placeholder="https://github.com/…"
              value={draft.github}
              onChange={(v) => setDraft((d) => ({ ...d, github: v }))}
            />
            <Field
              label="X / Twitter"
              placeholder="https://x.com/…"
              value={draft.twitter}
              onChange={(v) => setDraft((d) => ({ ...d, twitter: v }))}
            />
            <Field
              label="Personal website"
              placeholder="https://…"
              value={draft.website}
              onChange={(v) => setDraft((d) => ({ ...d, website: v }))}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button className="btn-primary text-sm" disabled={!dirty || busy} onClick={save}>
            {busy ? "Saving…" : "Save your details"}
          </button>
          {savedAt && <span className="text-xs text-good">✓ Saved</span>}
        </div>
      </div>

      <ImageCropDialog
        open={cropOpen !== null}
        kind={cropOpen ?? "avatar"}
        onClose={() => setCropOpen(null)}
        onSave={async (dataUrl) => {
          if (!cropOpen) return;
          const url = await onImageUpload(cropOpen, dataUrl);
          if (!url) {
            setUploadError("That upload didn't go through — check your connection and try again.");
            return;
          }
          if (cropOpen === "hero") {
            setDraft((d) => ({ ...d, heroUrl: url }));
          }
          setCropOpen(null);
        }}
      />
    </section>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <input
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
      />
    </div>
  );
}
