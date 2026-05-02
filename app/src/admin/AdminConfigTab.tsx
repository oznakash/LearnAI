import { useState } from "react";
import { useAdmin } from "./AdminContext";
import { isGmail } from "../auth/google";

export function AdminConfigTab() {
  const { config, setConfig, addAdmin, removeAdmin, resetAdminConfig } = useAdmin();
  const [newAdmin, setNewAdmin] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const onAdd = () => {
    setAddError(null);
    const e = newAdmin.trim().toLowerCase();
    if (!isGmail(e)) {
      setAddError("Admins must use a @gmail.com address.");
      return;
    }
    if (!addAdmin(e)) setAddError("Could not add (maybe already an admin).");
    else setNewAdmin("");
  };

  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <h3 className="h2">Branding</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field
            label="App name"
            value={config.branding.appName}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, branding: { ...cfg.branding, appName: v } }))}
          />
          <Field
            label="Tagline"
            value={config.branding.tagline}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, branding: { ...cfg.branding, tagline: v } }))}
          />
          <Field
            label="Logo emoji / 2-letter mark"
            value={config.branding.logoEmoji}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, branding: { ...cfg.branding, logoEmoji: v.slice(0, 4) } }))}
          />
          <Field
            label="Buddy / mascot name"
            value={config.branding.mascotName}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, branding: { ...cfg.branding, mascotName: v.slice(0, 20) } }))}
          />
          <Field
            label="XP unit name"
            value={config.branding.xpUnit}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, branding: { ...cfg.branding, xpUnit: v.slice(0, 20) } }))}
          />
          <div>
            <div className="label">Accent color</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.branding.accentColor}
                onChange={(e) => setConfig((cfg) => ({ ...cfg, branding: { ...cfg.branding, accentColor: e.target.value } }))}
                className="w-12 h-10 rounded-lg border border-white/10 bg-transparent"
              />
              <input
                className="input"
                value={config.branding.accentColor}
                onChange={(e) => setConfig((cfg) => ({ ...cfg, branding: { ...cfg.branding, accentColor: e.target.value } }))}
              />
            </div>
          </div>
          <div>
            <div className="label">Secondary color</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.branding.accent2Color}
                onChange={(e) => setConfig((cfg) => ({ ...cfg, branding: { ...cfg.branding, accent2Color: e.target.value } }))}
                className="w-12 h-10 rounded-lg border border-white/10 bg-transparent"
              />
              <input
                className="input"
                value={config.branding.accent2Color}
                onChange={(e) => setConfig((cfg) => ({ ...cfg, branding: { ...cfg.branding, accent2Color: e.target.value } }))}
              />
            </div>
          </div>
        </div>
        <BrandPreview />
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="h2">Authentication</h3>
        <p className="muted text-xs">
          Production mode verifies Google sign-in on the mem0 server, mints a 7-day session,
          and gates admin-only UI by the server's <span className="font-mono">ADMIN_EMAILS</span> allowlist.
          Demo mode is local-only — useful for forks running without any server.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <ModeToggle
            label="Sign-in mode"
            value={config.serverAuth.mode}
            onChange={(v) =>
              setConfig((cfg) => ({ ...cfg, serverAuth: { ...cfg.serverAuth, mode: v } }))
            }
          />
          <Field
            label="Google OAuth Client ID"
            value={config.serverAuth.googleClientId}
            onChange={(v) =>
              setConfig((cfg) => ({ ...cfg, serverAuth: { ...cfg.serverAuth, googleClientId: v.trim() } }))
            }
          />
          <Field
            label="mem0 server URL"
            value={config.serverAuth.mem0Url}
            onChange={(v) =>
              setConfig((cfg) => ({ ...cfg, serverAuth: { ...cfg.serverAuth, mem0Url: v.trim().replace(/\/+$/, "") } }))
            }
          />
        </div>
        {config.serverAuth.mode === "production" && (!config.serverAuth.mem0Url || !config.serverAuth.googleClientId) && (
          <div className="text-xs text-bad bg-bad/10 border border-bad/30 rounded-lg p-2">
            Production mode needs both a mem0 URL and a Google Client ID. Sign-in will fail until both are set.
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="h2">Feature flags</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <Toggle
            label="Allow demo (no-OAuth) sign-in"
            value={config.flags.allowDemoMode}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, allowDemoMode: v } }))}
          />
          <Toggle
            label="Allow players to bring their own AI key"
            value={config.flags.allowPlayerApiKeys}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, allowPlayerApiKeys: v } }))}
          />
          <Toggle
            label="Public leaderboard"
            value={config.flags.publicLeaderboard}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, publicLeaderboard: v } }))}
          />
          <Toggle
            label="Live Mode (unlimited content for key holders)"
            value={config.flags.liveModeForApiKeyHolders}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, liveModeForApiKeyHolders: v } }))}
          />
          <Toggle
            label="Voice mode (sprint 5 preview)"
            value={config.flags.voiceMode}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, voiceMode: v } }))}
          />
          <Toggle
            label="Build Card verification (sprint 5 preview)"
            value={config.flags.buildCardVerification}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, buildCardVerification: v } }))}
          />
          <Toggle
            label="🎙️ Lenny's Podcast nuggets (curated quotes inside Sparks)"
            value={config.flags.lennyContentEnabled}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, lennyContentEnabled: v } }))}
          />
        </div>
        <p className="muted text-xs">
          When the Lenny's Podcast toggle is off, the topic loader strips every PodcastNugget Spark
          before topics reach the player. See <code className="text-white/70">docs/lenny-archive.md</code>.
        </p>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="h2">Social network</h3>
        <p className="muted text-xs">
          Three flags gate the social MVP — Profile, Network settings, Topic Leaderboards, Spark Stream, Admin → Moderation.
          Backed by the social-svc sidecar bundled in this container.
          See <code className="text-white/70">docs/operator-checklist.md</code> for the deploy + monitoring runbook.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Toggle
            label="Social enabled (master switch — Profile, Network, Boards, Stream, Moderation)"
            value={config.flags.socialEnabled}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, socialEnabled: v } }))}
          />
          <Toggle
            label="Spark Stream tab (requires Social enabled)"
            value={config.flags.streamEnabled}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, streamEnabled: v } }))}
          />
          <Toggle
            label="Topic Leaderboards (Boards) view (requires Social enabled)"
            value={config.flags.boardsEnabled}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, boardsEnabled: v } }))}
          />
        </div>
        <div>
          <div className="label">Default profile mode for new players</div>
          <div className="flex gap-2 mt-1">
            {(["open", "closed"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() =>
                  setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, defaultProfileMode: mode } }))
                }
                className={`pill text-sm transition ${
                  config.flags.defaultProfileMode === mode
                    ? "bg-accent/20 border border-accent text-white"
                    : "bg-white/5 border border-white/10 text-white/70 hover:text-white"
                }`}
              >
                {mode === "open" ? "🌐 Public (discoverable)" : "🔒 Private (approval required)"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">social-svc URL</div>
          <input
            className="input"
            placeholder="leave empty for same-origin (production default)"
            value={config.socialConfig.serverUrl}
            onChange={(e) =>
              setConfig((cfg) => ({ ...cfg, socialConfig: { ...cfg.socialConfig, serverUrl: e.target.value } }))
            }
          />
          <p className="text-[11px] text-white/40 mt-1">
            Empty = same-origin. The sidecar lives in this container and nginx proxies <code>/v1/social/*</code> to it on
            <code> localhost:8787</code>. Only set this when running social-svc on a separate host (fork / dev).
          </p>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="h2">Demo data</h3>
        <p className="muted text-xs">
          A deterministic cohort of ~30 fake users used for screenshots, demos, and UI-glitch hunting.
          When off, only real signed-in users appear in Users / Analytics / Memory / everywhere.
          You can flip this on anytime to see how a populated dashboard looks, then off again.
        </p>
        <Toggle
          label={`Show demo cohort in Users + Analytics ${config.flags.showDemoData ? "(currently visible)" : "(hidden — production-clean)"}`}
          value={config.flags.showDemoData}
          onChange={(v) => setConfig((cfg) => ({ ...cfg, flags: { ...cfg.flags, showDemoData: v } }))}
        />
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="h2">Defaults & limits</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field
            label="Default daily minutes for new users"
            value={String(config.defaultDailyMinutes)}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, defaultDailyMinutes: Math.max(1, Math.min(120, Number(v) || 10)) }))}
            type="number"
          />
          <Field
            label="Per-user daily token cap (0 = unlimited)"
            value={String(config.perUserDailyTokenCap)}
            onChange={(v) => setConfig((cfg) => ({ ...cfg, perUserDailyTokenCap: Math.max(0, Number(v) || 0) }))}
            type="number"
          />
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="h2">Admin allowlist</h3>
        <p className="muted text-xs">Only admins (Gmail) can open this console. Add or remove freely.</p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="another-admin@gmail.com"
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
          />
          <button className="btn-primary" onClick={onAdd}>Add</button>
        </div>
        {addError && <div className="text-xs text-bad">{addError}</div>}
        <ul className="divide-y divide-white/5 text-sm">
          {config.admins.length === 0 && <li className="text-white/40 py-2 text-xs">No admins yet.</li>}
          {config.admins.map((a) => (
            <li key={a} className="flex items-center justify-between py-2">
              <span className="text-white">{a}</span>
              <button
                className="text-xs text-bad hover:underline"
                onClick={() => {
                  if (confirm(`Remove ${a} from admin allowlist?`)) removeAdmin(a);
                }}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4 space-y-2 border-bad/30">
        <h3 className="h2 text-bad">Danger zone</h3>
        <button
          className="btn-bad"
          onClick={() => {
            if (confirm("Reset ALL admin config (branding, flags, templates, allowlist)?")) resetAdminConfig();
          }}
        >
          Reset admin config to defaults
        </button>
        <p className="text-[11px] text-white/50">This does not affect player data — only the admin-side config.</p>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ModeToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "demo" | "production";
  onChange: (v: "demo" | "production") => void;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex gap-2 rounded-xl border border-white/10 p-1">
        {(["demo", "production"] as const).map((m) => {
          const active = value === m;
          return (
            <button
              key={m}
              onClick={() => onChange(m)}
              className={`flex-1 rounded-lg py-2 text-sm capitalize transition ${
                active ? "bg-accent/20 text-white border border-accent" : "text-white/60 hover:text-white"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`p-3 rounded-xl border text-left transition ${value ? "bg-accent/15 border-accent" : "bg-white/5 border-white/10 hover:border-white/30"}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm text-white">{label}</div>
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${value ? "bg-good/20 text-good" : "bg-white/10 text-white/60"}`}>
          {value ? "ON" : "off"}
        </div>
      </div>
    </button>
  );
}

function BrandPreview() {
  const { config } = useAdmin();
  return (
    <div className="rounded-xl border border-white/10 p-4 flex items-center gap-3 bg-ink2/40">
      <div
        className="w-12 h-12 rounded-2xl grid place-items-center text-white font-bold"
        style={{ background: `linear-gradient(135deg, ${config.branding.accentColor}, ${config.branding.accent2Color})` }}
      >
        {config.branding.logoEmoji}
      </div>
      <div>
        <div className="font-display font-bold text-white">{config.branding.appName}</div>
        <div className="text-xs text-white/60">{config.branding.tagline}</div>
      </div>
    </div>
  );
}
