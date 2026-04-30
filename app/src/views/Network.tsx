import { useEffect, useState } from "react";
import { useSocial } from "../social/SocialContext";
import { useAdmin } from "../admin/AdminContext";
import { TOPICS } from "../content";
import type { PublicProfile, ProfileMode } from "../social/types";
import type { TopicId } from "../types";
import type { View } from "../App";

/**
 * Settings → Network — the privacy + discoverability cockpit.
 *
 * One screen, owner-only. The five blocks:
 *  1. Profile mode (Open ↔ Closed) + a panic switch.
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

      {/* 1. Profile mode + panic switch */}
      <section className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="h2">Profile mode</h2>
            <p className="muted text-xs mt-1">
              {isKid
                ? "Your profile is closed by default — kids' profiles are not discoverable."
                : "Open profiles are discoverable. Closed profiles require approval before someone can follow you."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={`btn ${me.profileMode === "open" ? "btn-good" : "btn-ghost"} text-sm`}
              disabled={isKid || busy}
              onClick={() => setMode("open")}
            >
              🌐 Open
            </button>
            <button
              className={`btn ${me.profileMode === "closed" ? "btn-good" : "btn-ghost"} text-sm`}
              disabled={busy}
              onClick={() => setMode("closed")}
            >
              🔒 Closed
            </button>
          </div>
        </div>
        <div className="text-xs text-white/50">
          Currently: <strong className="text-white">{me.profileMode === "open" ? "Open" : "Closed"}</strong>
          {isKid && <span className="ml-2">(kids profiles are always closed)</span>}
        </div>
        {me.profileMode === "open" && !isKid && (
          <div className="pt-2 border-t border-white/5">
            <button className="btn-bad text-xs" onClick={takeMeDown} disabled={busy}>
              ⏸ Take me down (panic switch)
            </button>
            <p className="text-[11px] text-white/40 mt-1">
              Flips you to Closed and pauses discoverability immediately. Reversible.
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

      {/* 4. People summary */}
      <section className="card p-5 space-y-3">
        <h2 className="h2">People</h2>
        <p className="muted text-xs">
          Manage who you follow, who follows you, pending follow requests, and blocks.
          (Detailed list management lands in PR 4.)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="Following" value={counts.following} />
          <Stat label="Followers" value={counts.followers} />
          <Stat label="Pending in" value={counts.pendingIn} />
          <Stat label="Pending out" value={counts.pendingOut} />
          <Stat label="Blocked" value={counts.blocked} />
        </div>
      </section>
    </div>
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
