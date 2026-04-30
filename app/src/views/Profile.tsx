import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "../store/PlayerContext";
import { useSocial } from "../social/SocialContext";
import { useAdmin } from "../admin/AdminContext";
import { getTopic } from "../content";
import { tierForXP } from "../store/game";
import { Mascot } from "../visuals/Mascot";
import { Sparkline } from "../visuals/Charts";
import type { PublicProfile, ReportReason } from "../social/types";
import type { TopicId } from "../types";
import type { View } from "../App";

/**
 * Public Profile view — `/u/<handle>`.
 *
 * Behavioral résumé. No bio, no employer, no email, no age. Everything is
 * derived from what the player did in LearnAI and capped to what's safe
 * to expose. Owner sees an extra strip with a "View as visitor" preview
 * + a link to Settings → Network for editing.
 *
 * Closed-mode profiles render a single gated card to non-followers.
 *
 * This PR ships the read-only view; Follow / Unfollow / Block / Mute /
 * Report buttons land in PR 4. The kebab placeholder shows "Coming soon".
 */

interface Props {
  handle: string;
  onNav: (v: View) => void;
}

export function Profile({ handle, onNav }: Props) {
  const { state: player } = usePlayer();
  const { config } = useAdmin();
  const social = useSocial();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);

  const myHandle = useMemo(() => {
    // Derived offline. Once the online service ships, /me handles this.
    const local = (player.identity?.email ?? "").split("@")[0]?.toLowerCase() ?? "";
    return local;
  }, [player.identity?.email]);

  const isOwner = !previewing && handle.toLowerCase() === myHandle.toLowerCase();
  const socialOff = !config.flags.socialEnabled;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const fetcher = isOwner ? social.getMyProfile() : social.getProfile(handle);
      const got = await fetcher;
      if (!cancelled) {
        setProfile(got);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, isOwner, social]);

  if (loading) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="h1">@{handle}</h1>
          <p className="muted text-sm">Loading…</p>
        </header>
      </div>
    );
  }

  if (!profile) {
    return <ProfileNotFound handle={handle} onNav={onNav} />;
  }

  // A Closed profile shows only the gate card to non-followers.
  if (!isOwner && profile.profileMode === "closed") {
    return (
      <ClosedProfileGate
        profile={profile}
        onNav={onNav}
        onRequestFollow={async () => {
          await social.follow(profile.handle);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => onNav({ name: "home" })}
        className="text-xs text-white/50 hover:text-white"
      >
        ← Home
      </button>

      {isOwner && (
        <div className="card p-3 sm:p-4 border-accent/30 bg-accent/5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-accent uppercase tracking-wider font-semibold">
            This is your profile
          </span>
          <span className="text-xs text-white/60">
            What others see when they open <code className="text-white/80">/u/{profile.handle}</code>.
          </span>
          <div className="flex-1" />
          <button
            className="btn-ghost text-xs"
            onClick={() => setPreviewing((p) => !p)}
          >
            {previewing ? "← Back to owner view" : "👁 View as visitor"}
          </button>
          <button className="btn-ghost text-xs" onClick={copyShareLink(profile)}>
            🔗 Copy share link
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => onNav({ name: "settings" })}
          >
            ✎ Edit profile
          </button>
        </div>
      )}

      {socialOff && isOwner && (
        <div className="card p-3 text-xs text-white/60 bg-white/5">
          Social network is currently <strong className="text-white">offline</strong> for this
          deployment. Your profile is saved locally and will sync once the operator turns
          social on in Admin → Config.
        </div>
      )}

      <ProfileHeader profile={profile} />

      {!isOwner && <FollowActionCluster handle={profile.handle} />}

      {profile.signals.length > 0 && (
        <SignalsSection signals={profile.signals} />
      )}

      {profile.currentWork && (
        <CurrentWorkSection currentWork={profile.currentWork} />
      )}

      {profile.topicMap && profile.topicMap.length > 0 && (
        <TopicMapSection topicMap={profile.topicMap} />
      )}

      {profile.activity14d && (
        <ActivitySection activity={profile.activity14d} />
      )}

      {profile.badges.length > 0 && (
        <BadgesSection badges={profile.badges} />
      )}

      <ProfileFooter profile={profile} />
    </div>
  );
}

// -- Header --------------------------------------------------------------

function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const tier = tierForXP(profile.xpTotal);

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-accent to-accent2 grid place-items-center text-white font-bold text-2xl ring-2 ring-white/10">
          {profile.pictureUrl ? (
            <img src={profile.pictureUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="h1 leading-none">{profile.displayName}</h1>
          <div className="text-sm text-white/50 mt-1">@{profile.handle}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="pill bg-accent/10 text-accent border border-accent/30">⚡ {profile.xpTotal}</span>
            {profile.streak > 0 && (
              <span className="pill bg-warn/10 text-warn border border-warn/30">🔥 {profile.streak}-day streak</span>
            )}
            <span className="pill bg-good/10 text-good border border-good/30">🏅 {tier}</span>
            {profile.profileMode === "closed" && (
              <span className="pill bg-white/5 text-white/60 border-white/10">🔒 Closed</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// -- Sections ------------------------------------------------------------

function SignalsSection({ signals }: { signals: TopicId[] }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="h2 mb-3">Signals</h2>
      <p className="muted text-xs mb-3">Topics this player chose to be findable for.</p>
      <div className="flex flex-wrap gap-2">
        {signals.map((id) => {
          const t = getTopic(id);
          return (
            <span
              key={id}
              className="pill border"
              style={{
                background: `${t?.color ?? "#7c5cff"}1a`,
                color: t?.color ?? "#7c5cff",
                borderColor: `${t?.color ?? "#7c5cff"}33`,
              }}
            >
              {t?.emoji} {t?.name ?? id}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function CurrentWorkSection({
  currentWork,
}: {
  currentWork: NonNullable<PublicProfile["currentWork"]>;
}) {
  const t = getTopic(currentWork.topicId);
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="h2 mb-1">Currently working on</h2>
      <p className="text-white">
        {t?.emoji ?? "📚"} <span className="font-semibold">{t?.name ?? currentWork.topicId}</span> —{" "}
        Level {currentWork.level}
      </p>
    </section>
  );
}

function TopicMapSection({
  topicMap,
}: {
  topicMap: NonNullable<PublicProfile["topicMap"]>;
}) {
  const sorted = [...topicMap].sort((a, b) => b.xp - a.xp);
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="h2 mb-3">Topic map</h2>
      <div className="flex flex-wrap gap-2">
        {sorted.map(({ topicId, xp }) => {
          const t = getTopic(topicId);
          if (!t) return null;
          return (
            <span
              key={topicId}
              className="pill border"
              style={{
                background: `${t.color}1a`,
                color: t.color,
                borderColor: `${t.color}33`,
              }}
              title={`${xp} ⚡`}
            >
              {t.emoji} {t.name} <span className="text-white/50 ml-1">⚡{xp}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}

function ActivitySection({ activity }: { activity: number[] }) {
  const total = activity.reduce((a, b) => a + b, 0);
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="h2">Last 14 days</h2>
        <div className="text-xs text-white/50">{total} Sparks</div>
      </div>
      <Sparkline data={activity} width={400} height={56} />
    </section>
  );
}

function BadgesSection({ badges }: { badges: string[] }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="h2 mb-3">Badges</h2>
      <div className="flex flex-wrap gap-2">
        {badges.map((id) => (
          <span key={id} className="pill bg-white/5 border-white/10 text-white/80">
            🏷 {id}
          </span>
        ))}
      </div>
    </section>
  );
}

function ProfileFooter({ profile }: { profile: PublicProfile }) {
  const month = new Date(profile.signupAt).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  return (
    <section className="text-xs text-white/40 flex items-center justify-between">
      <div>@{profile.handle} · Joined {month}</div>
    </section>
  );
}

// -- Closed gate ---------------------------------------------------------

function ClosedProfileGate({
  profile,
  onNav,
  onRequestFollow,
}: {
  profile: PublicProfile;
  onNav: (v: View) => void;
  onRequestFollow: () => Promise<void>;
}) {
  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy || requested) return;
    setBusy(true);
    try {
      await onRequestFollow();
      setRequested(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <button
        onClick={() => onNav({ name: "home" })}
        className="text-xs text-white/50 hover:text-white"
      >
        ← Home
      </button>
      <section className="card p-6 text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-accent2 grid place-items-center text-white font-bold text-2xl ring-2 ring-white/10 mx-auto">
          {profile.pictureUrl ? (
            <img src={profile.pictureUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <h1 className="h2 mt-4">{profile.displayName}</h1>
        <div className="text-xs text-white/50 mt-1">@{profile.handle}</div>
        <p className="text-sm text-white/70 mt-4">
          🔒 This profile is closed. Send a follow request to see their progress.
        </p>
        <button
          className="btn-primary mt-4 text-sm"
          onClick={onClick}
          disabled={busy || requested}
        >
          {requested ? "✓ Follow request sent" : busy ? "Sending…" : "Send follow request"}
        </button>
      </section>
    </div>
  );
}

// -- Follow / Mute / Block / Report cluster ------------------------------

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "off-topic", label: "Off-topic" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

function FollowActionCluster({ handle }: { handle: string }) {
  const social = useSocial();
  const [following, setFollowing] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [blocked, setBlocked] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the kebab menu on outside-click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Refresh follow/mute/block state on mount and when the handle changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [follow, blocks] = await Promise.all([
        social.listFollowing(),
        social.listBlocked(),
      ]);
      if (cancelled) return;
      const edge = follow.find((e) => e.target.toLowerCase() === handle.toLowerCase());
      setFollowing(!!edge);
      setMuted(!!edge?.muted);
      setBlocked(blocks.some((b) => b.toLowerCase() === handle.toLowerCase()));
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, social]);

  const onFollow = async () => {
    if (busy || blocked) return;
    setBusy(true);
    try {
      if (following) {
        await social.unfollow(handle);
        setFollowing(false);
        setMuted(false);
      } else {
        const edge = await social.follow(handle);
        setFollowing(!!edge);
      }
    } finally {
      setBusy(false);
    }
  };

  const onToggleMute = async () => {
    if (!following) return;
    const next = !muted;
    setMuted(next);
    setMenuOpen(false);
    await social.setMuted(handle, next);
  };

  const onBlock = async () => {
    if (!confirm(`Block @${handle}? They won't be able to find you, and you won't see their activity.`)) return;
    setBusy(true);
    setMenuOpen(false);
    try {
      await social.block(handle);
      setBlocked(true);
      setFollowing(false);
      setMuted(false);
    } finally {
      setBusy(false);
    }
  };

  const onUnblock = async () => {
    setBusy(true);
    try {
      await social.unblock(handle);
      setBlocked(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-3 sm:p-4 flex flex-wrap items-center gap-2">
      {blocked ? (
        <>
          <span className="pill bg-bad/10 text-bad border border-bad/30">🚫 Blocked</span>
          <button className="btn-ghost text-xs" onClick={onUnblock} disabled={busy}>
            Unblock
          </button>
        </>
      ) : (
        <button
          className={`btn ${following ? "btn-ghost" : "btn-primary"} text-sm`}
          onClick={onFollow}
          disabled={busy}
        >
          {following ? "✓ Following" : "+ Follow"}
        </button>
      )}
      <div className="relative" ref={menuRef}>
        <button
          className="btn-ghost text-sm"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-1 w-44 rounded-xl bg-ink2 border border-white/10 shadow-card p-1 z-20"
          >
            {following && (
              <MenuItem onClick={onToggleMute}>
                {muted ? "🔊 Unmute" : "🔇 Mute"}
              </MenuItem>
            )}
            {!blocked && (
              <MenuItem onClick={onBlock} variant="bad">
                🚫 Block
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              variant="bad"
            >
              ⚠ Report
            </MenuItem>
          </div>
        )}
      </div>
      {reportOpen && (
        <ReportDialog
          handle={handle}
          onClose={() => setReportOpen(false)}
          onSubmit={async (reason, note) => {
            await social.report(handle, reason, note, { kind: "profile" });
            setReportOpen(false);
            // Reports auto-mute; refresh local state.
            const follow = await social.listFollowing();
            const edge = follow.find((e) => e.target.toLowerCase() === handle.toLowerCase());
            setMuted(!!edge?.muted);
          }}
        />
      )}
    </section>
  );
}

function MenuItem({
  onClick,
  children,
  variant,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "bad";
}) {
  const cls =
    variant === "bad"
      ? "text-bad hover:bg-bad/10"
      : "text-white/80 hover:bg-white/5";
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={`w-full text-left px-3 py-2 text-sm rounded-md ${cls}`}
    >
      {children}
    </button>
  );
}

function ReportDialog({
  handle,
  onClose,
  onSubmit,
}: {
  handle: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, note?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(reason, note.trim() || undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={`Report @${handle}`}
      className="fixed inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="card p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="h2">Report @{handle}</h2>
        <p className="muted text-xs">
          Reports go to a moderation queue. We auto-mute the reported account from your feed.
        </p>
        <div>
          <div className="label">Reason</div>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`p-2 rounded-lg border text-sm text-left ${
                  reason === r.value
                    ? "bg-accent/15 border-accent text-white"
                    : "bg-white/5 border-white/10 text-white/70 hover:border-white/30"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">Note (optional, ≤280)</div>
          <textarea
            className="input"
            rows={3}
            maxLength={280}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn-ghost text-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-bad text-sm" onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Not-found ----------------------------------------------------------

function ProfileNotFound({ handle, onNav }: { handle: string; onNav: (v: View) => void }) {
  return (
    <div className="space-y-5">
      <button onClick={() => onNav({ name: "home" })} className="text-xs text-white/50 hover:text-white">
        ← Home
      </button>
      <section className="card p-6 text-center max-w-md mx-auto">
        <Mascot mood="thinking" size={88} />
        <h1 className="h1 mt-3">Couldn't find @{handle}</h1>
        <p className="muted mt-2">
          Either no one with that handle, or they aren't visible to you. Try searching again.
        </p>
        <button className="btn-primary mt-4 text-sm" onClick={() => onNav({ name: "home" })}>
          Back to home
        </button>
      </section>
    </div>
  );
}

// -- Helpers ------------------------------------------------------------

function copyShareLink(profile: PublicProfile) {
  return () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/u/${profile.handle}`;
    try {
      void navigator.clipboard?.writeText(url);
    } catch {
      // Fallback: nothing to do — the user can copy from the URL bar.
    }
  };
}
