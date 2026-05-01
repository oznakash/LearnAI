import { useState } from "react";
import { usePlayer } from "../store/PlayerContext";
import { useAdmin } from "../admin/AdminContext";
import { TOPICS } from "../content";
import type { TopicId } from "../types";
import { eraseAllLocalData } from "../store/reset";
import type { View } from "../App";

export function Settings({ onNav }: { onNav?: (v: View) => void } = {}) {
  const { state, signOut, setState, setApiKey, setGoogleClientId, setProfile } = usePlayer();
  const { config: adminCfg, isAdmin, bootstrapAdmin } = useAdmin();
  const [apiKeyDraft, setApiKeyDraft] = useState(state.apiKey ?? "");
  const [provider, setProvider] = useState<"anthropic" | "openai">(state.apiProvider ?? "anthropic");
  const [clientIdDraft, setClientIdDraft] = useState(state.googleClientId ?? "");
  const [interestsDraft, setInterestsDraft] = useState<TopicId[]>(state.profile?.interests ?? []);
  const [dailyMins, setDailyMins] = useState(state.profile?.dailyMinutes ?? 10);

  const toggle = (id: TopicId) =>
    setInterestsDraft((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  const saveInterests = () => {
    if (!state.profile) return;
    setProfile({ ...state.profile, interests: interestsDraft, dailyMinutes: dailyMins });
  };

  const reset = () => {
    if (!confirm("Erase all local progress? This cannot be undone.")) return;
    eraseAllLocalData();
    location.reload();
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

      <section className="card p-5 space-y-3 border-bad/30">
        <h2 className="h2 text-bad">Account</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={signOut}>Sign out</button>
          <button className="btn-bad" onClick={reset}>Erase all local data</button>
        </div>
      </section>
    </div>
  );
}
