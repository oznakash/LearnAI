import { useEffect, useMemo, useState } from "react";
import { usePlayer } from "../store/PlayerContext";
import { useSocial } from "../social/SocialContext";
import { useAdmin } from "../admin/AdminContext";
import { getTopic } from "../content";
import { tierForXP } from "../store/game";
import { Mascot } from "../visuals/Mascot";
import { Sparkline } from "../visuals/Charts";
import type { PublicProfile } from "../social/types";
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
  // (PR 4 will replace the placeholder button with the real follow flow.)
  if (!isOwner && profile.profileMode === "closed") {
    return (
      <ClosedProfileGate
        profile={profile}
        onNav={onNav}
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
      <button className="text-white/40 hover:text-white" disabled title="Report — coming in PR 4">
        ⋯
      </button>
    </section>
  );
}

// -- Closed gate ---------------------------------------------------------

function ClosedProfileGate({ profile, onNav }: { profile: PublicProfile; onNav: (v: View) => void }) {
  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

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
        <button className="btn-primary mt-4 text-sm" disabled title="Follow flow lands in PR 4">
          Send follow request (PR 4)
        </button>
      </section>
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
