import { useEffect, useRef, useState } from "react";
import { usePlayer } from "../store/PlayerContext";
import { useAdmin } from "../admin/AdminContext";
import { useSocial } from "../social/SocialContext";
import { TOPICS } from "../content";
import type { TopicId } from "../types";
import type { PublicProfile } from "../social/types";
import { eraseAllLocalData } from "../store/reset";
import type { View } from "../App";
import { profileCompleteness } from "../profile/completeness";

/** Window in which a second "Erase" click commits. After this, the prompt resets. */
const ERASE_CONFIRM_WINDOW_MS = 5000;

export function Settings({ onNav }: { onNav?: (v: View) => void } = {}) {
  const { state, signOut, setState, setApiKey, setGoogleClientId, setProfile } = usePlayer();
  const { config: adminCfg, isAdmin, bootstrapAdmin } = useAdmin();
  const social = useSocial();
  const [apiKeyDraft, setApiKeyDraft] = useState(state.apiKey ?? "");
  const [provider, setProvider] = useState<"anthropic" | "openai">(state.apiProvider ?? "anthropic");
  const [clientIdDraft, setClientIdDraft] = useState(state.googleClientId ?? "");
  const [interestsDraft, setInterestsDraft] = useState<TopicId[]>(state.profile?.interests ?? []);
  const [dailyMins, setDailyMins] = useState(state.profile?.dailyMinutes ?? 10);
  const [eraseArmed, setEraseArmed] = useState(false);
  const eraseTimerRef = useRef<number | null>(null);
  const [myProfile, setMyProfile] = useState<PublicProfile | null>(null);

  // Load the social profile (best-effort) so we can show the Finish-your-
  // profile nudge. Failures are silent — the nudge is purely additive.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const got = await social.getMyProfile();
        if (!cancelled) setMyProfile(got);
      } catch {
        // Social-svc unavailable; we just don't render the nudge.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [social.service]);

  const completeness = profileCompleteness(myProfile, state.identity?.picture);
  const showCompletenessNudge = !!myProfile && completeness < 100;

  // Cancel the "click again to erase" prompt if the user navigates away
  // before the window elapses.
  useEffect(() => {
    return () => {
      if (eraseTimerRef.current !== null) {
        window.clearTimeout(eraseTimerRef.current);
      }
    };
  }, []);

  const toggle = (id: TopicId) =>
    setInterestsDraft((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const saveInterests = () => {
    if (!state.profile) return;
    setProfile({ ...state.profile, interests: interestsDraft, dailyMinutes: dailyMins });
  };

  const onErase = () => {
    if (eraseArmed) {
      // Second click within the window — commit.
      if (eraseTimerRef.current !== null) {
        window.clearTimeout(eraseTimerRef.current);
        eraseTimerRef.current = null;
      }
      eraseAllLocalData();
      window.location.reload();
      return;
    }
    // First click — arm the action and auto-disarm after the window.
    setEraseArmed(true);
    eraseTimerRef.current = window.setTimeout(() => {
      setEraseArmed(false);
      eraseTimerRef.current = null;
    }, ERASE_CONFIRM_WINDOW_MS);
  };

  const onSignOut = () => {
    signOut();
    onNav?.({ name: "home" });
  };

  const onBootstrap = () => {
    if (!state.identity?.email) return;
    bootstrapAdmin(state.identity.email);
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="h1">Settings</h1>
        <p className="muted">Profile, API keys, sign-in, preferences.</p>
      </header>

      {showCompletenessNudge && (
        <button
          type="button"
          className="card p-4 w-full text-left flex items-center gap-3 hover:border-accent/40 border border-white/10 transition"
          onClick={() => onNav?.({ name: "network" })}
          data-testid="settings-completeness-nudge"
        >
          <div className="w-10 h-10 rounded-full bg-accent/15 grid place-items-center text-sm font-semibold text-accent tabular-nums shrink-0">
            {completeness}%
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm">Finish your profile</div>
            <div className="text-xs text-white/60">
              A few more clicks unlock a profile worth sharing.
            </div>
          </div>
          <span className="text-white/40 text-xs">→</span>
        </button>
      )}

      <section className="card p-5 space-y-3">
        <h2 className="h2">Profile</h2>
        <div className="text-sm text-white/70">
          {state.identity ? (
            <>
              Signed in as <span className="text-white">{state.identity.name ?? state.identity.email}</span>
              <div className="text-xs text-white/50">{state.identity.email}</div>
            </>
          ) : (
            "Not signed in"
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <div className="label">Daily minutes</div>
            <input type="number" className="input" value={dailyMins} min={1} max={120} onChange={(e) => setDailyMins(Number(e.target.value))} />
          </div>
          <div>
            <div className="label">Skill level</div>
            <select
              className="input"
              value={state.profile?.skillLevel ?? "explorer"}
              onChange={(e) =>
                state.profile && setProfile({ ...state.profile, skillLevel: e.target.value as never })
              }
            >
              <option value="starter">Curious starter</option>
              <option value="explorer">Hobby explorer</option>
              <option value="builder">Active builder</option>
              <option value="architect">Senior architect</option>
              <option value="visionary">Frontier visionary</option>
            </select>
          </div>
        </div>
        <div>
          <div className="label">Interests</div>
          <div className="grid sm:grid-cols-2 gap-2 mt-1">
            {TOPICS.map((t) => {
              const on = interestsDraft.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={`p-2 rounded-xl border text-left ${on ? "bg-accent/15 border-accent" : "bg-white/5 border-white/10 hover:border-white/30"}`}
                >
                  <span className="mr-2">{t.emoji}</span>
                  <span className="text-white">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <button className="btn-primary" onClick={saveInterests}>Save profile</button>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="h2">API key (for dynamic content)</h2>
        <p className="muted text-xs">
          Optional. With an Anthropic or OpenAI key, {adminCfg.branding.appName} can generate fresh Sparks + tips on demand.
          Your key is stored in this browser only and used to call the provider directly.
        </p>
        <p className="text-[11px] text-bad">
          ⚠ Stored unencrypted in localStorage and used directly from this browser. Use a low-spend, scoped key. Any browser extension or XSS bug on this domain could read it. Erasing local data wipes it.
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value as never)}>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>
          <input
            className="input sm:col-span-2"
            type="password"
            placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-…"}
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={() => setApiKey(apiKeyDraft.trim(), provider)}>
          Save API key
        </button>
        {state.apiKey && (
          <div className="text-xs text-good">✓ Key set ({state.apiProvider})</div>
        )}
      </section>

      {adminCfg.serverAuth.mode === "demo" && (
        <section className="card p-5 space-y-3">
          <h2 className="h2">Google OAuth Client ID</h2>
          <p className="muted text-xs">
            Used for Gmail-only sign-in. You can replace it any time. Get one at console.cloud.google.com → APIs &amp; Services → Credentials.
          </p>
          <input
            className="input"
            placeholder="123-xxxxxx.apps.googleusercontent.com"
            value={clientIdDraft}
            onChange={(e) => setClientIdDraft(e.target.value.trim())}
          />
          <button className="btn-primary" onClick={() => setGoogleClientId(clientIdDraft)}>
            Save Client ID
          </button>
        </section>
      )}

      {adminCfg.flags.socialEnabled && (
        <section className="card p-5 space-y-3">
          <h2 className="h2">Network</h2>
          <p className="muted text-xs">
            Manage your public profile, privacy mode, who you follow, and the Topics you want to be discoverable for.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary text-sm"
              onClick={() => onNav?.({ name: "network" })}
            >
              👥 Open Network settings
            </button>
            {state.identity?.email && (
              <button
                className="btn-ghost text-sm"
                onClick={() => {
                  // P0-4 fix: use baseHandleFromEmail for the canonical handle.
                  // (kept inline since this is the only Settings.tsx usage.)
                  const local = state.identity!.email.toLowerCase().split("@")[0] ?? "";
                  const handle = local
                    .replace(/\./g, "")
                    .replace(/[^a-z0-9_-]/g, "")
                    .slice(0, 24) || "user";
                  onNav?.({ name: "profile", handle });
                }}
              >
                👁 View my public profile
              </button>
            )}
          </div>
        </section>
      )}

      <section className="card p-5 space-y-3">
        <h2 className="h2">Your memory</h2>
        <p className="muted text-xs">
          See, edit, and forget anything {adminCfg.branding.appName} remembers about you.
        </p>
        <button
          className="btn-primary"
          onClick={() => onNav?.({ name: "memory" })}
        >
          🧠 Open Your Memory
        </button>
        {adminCfg.flags.memoryPlayerOptIn && (
          <label className="flex items-start gap-3 text-sm pt-2 border-t border-white/5">
            <input
              type="checkbox"
              className="mt-1"
              checked={!state.memoryOptOut}
              onChange={(e) =>
                setState((s) => ({ ...s, memoryOptOut: !e.target.checked }))
              }
            />
            <div>
              <div className="text-white">Let {adminCfg.branding.appName} remember things about me</div>
              <div className="text-[11px] text-white/50 mt-0.5">
                When off, the cognition layer is paused for your account. We won't write new memories on your behalf, and existing ones stop influencing what you see. (You can flip this back on any time.)
              </div>
            </div>
          </label>
        )}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="h2">Preferences</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.prefs.sound}
            onChange={(e) => setState((s) => ({ ...s, prefs: { ...s.prefs, sound: e.target.checked } }))}
          />
          Play sounds (coming soon)
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={state.prefs.haptics}
            onChange={(e) => setState((s) => ({ ...s, prefs: { ...s.prefs, haptics: e.target.checked } }))}
          />
          Haptic feedback (mobile)
        </label>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="h2">Admin</h2>
        {isAdmin ? (
          <>
            <p className="muted text-xs">You're an admin. Open the console to manage users, analytics, emails, and config.</p>
            <button
              className="btn-primary"
              onClick={() => onNav?.({ name: "admin" })}
            >
              🛠 Open Admin Console
            </button>
            <p className="text-[11px] text-white/50">Allowlist: {adminCfg.admins.length} admin{adminCfg.admins.length === 1 ? "" : "s"}.</p>
          </>
        ) : adminCfg.serverAuth.mode === "production" ? (
          // Production sign-in: admin is server-side only (mem0's
          // ADMIN_EMAILS env var via the JWT `is_admin` claim). Any local
          // bootstrap is a no-op, so we don't expose the affordance.
          <p className="text-xs text-white/60">
            Admins are managed server-side on this deployment. Ask an existing admin if you need access.
          </p>
        ) : adminCfg.bootstrapped ? (
          <p className="text-xs text-white/60">Admin allowlist already initialized. Ask an existing admin to add your Gmail.</p>
        ) : (
          <>
            <p className="muted text-xs">No admin yet — bootstrap yourself ({state.identity?.email}) as the first admin.</p>
            <button className="btn-primary" onClick={onBootstrap} disabled={!state.identity?.email}>
              Bootstrap me as admin
            </button>
          </>
        )}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="h2">Account</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-ghost" onClick={onSignOut}>Sign out</button>
          <button
            type="button"
            onClick={onErase}
            aria-pressed={eraseArmed}
            className={`text-xs underline-offset-2 hover:underline transition ${
              eraseArmed ? "text-bad font-semibold" : "text-white/40 hover:text-white/70"
            }`}
          >
            {eraseArmed ? "🗑 Click again to erase" : "Erase all local data"}
          </button>
          {eraseArmed && (
            <span className="text-[11px] text-white/40">
              wipes XP, streak, sparks, tasks, feedback, and memory on this device
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
