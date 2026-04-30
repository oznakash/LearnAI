import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "./AdminContext";
import { useMemory } from "../memory/MemoryContext";
import { Mem0MemoryService } from "../memory";
import { usePlayer } from "../store/PlayerContext";
import { fetchAdminServerStatus, type AdminServerStatus } from "../auth/server";

/**
 * Admin → Memory tab.
 *
 * Two distinct config layers:
 *
 *   * Production server-auth (the live deployment) — `serverAuth.mem0Url`
 *     baked at build time, and the bearer is each player's session JWT.
 *     The operator edits the URL here and saves it to admin config.
 *   * Demo / fallback (forks running without a backend) — legacy
 *     `memoryConfig.serverUrl` + `memoryConfig.apiKey`. Hidden in
 *     production mode to keep the UI honest about what's actually
 *     being used.
 *
 * We also fetch `/auth/admin/status` from mem0 so the operator can see
 * which env-driven knobs are set on the server (OpenAI key present?
 * ADMIN_EMAILS list, CORS_ORIGINS, etc.) without leaving the SPA.
 */
export function AdminMemory() {
  const { config, setConfig } = useAdmin();
  const { state: player } = usePlayer();
  const { backend, status, refreshHealth } = useMemory();

  const isProduction = config.serverAuth.mode === "production";
  // Effective values — what the SPA actually uses for memory calls right now.
  const effectiveUrl = isProduction
    ? config.serverAuth.mem0Url
    : config.memoryConfig.serverUrl;
  const effectiveBearerLabel = isProduction
    ? player.serverSession?.token
      ? "Player session JWT (signed by mem0 with JWT_SECRET)"
      : "No live session — sign in to issue one"
    : config.memoryConfig.apiKey
      ? "Admin Bearer key (from this admin config)"
      : "No bearer set — calls will be unauthenticated";

  // Production-mode editable URL (writes to serverAuth.mem0Url)
  const [prodUrl, setProdUrl] = useState(config.serverAuth.mem0Url);
  useEffect(() => {
    setProdUrl(config.serverAuth.mem0Url);
  }, [config.serverAuth.mem0Url]);

  // Demo-mode editable fields (writes to memoryConfig)
  const [demoUrl, setDemoUrl] = useState(config.memoryConfig.serverUrl);
  const [demoKey, setDemoKey] = useState(config.memoryConfig.apiKey ?? "");
  const [cap, setCap] = useState(config.memoryConfig.perUserDailyCap);

  const setFlag = (key: keyof typeof config.flags, v: boolean) =>
    setConfig((c) => ({ ...c, flags: { ...c.flags, [key]: v } }));

  const saveProd = () =>
    setConfig((c) => ({
      ...c,
      serverAuth: { ...c.serverAuth, mem0Url: prodUrl.trim().replace(/\/+$/, "") },
      memoryConfig: { ...c.memoryConfig, perUserDailyCap: cap },
    }));

  const saveDemo = () =>
    setConfig((c) => ({
      ...c,
      memoryConfig: {
        ...c.memoryConfig,
        serverUrl: demoUrl.trim().replace(/\/+$/, ""),
        apiKey: demoKey.trim(),
        perUserDailyCap: cap,
      },
    }));

  const [pingStatus, setPingStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pinging, setPinging] = useState(false);

  const ping = async () => {
    setPinging(true);
    setPingStatus(null);
    try {
      const svc = new Mem0MemoryService({
        serverUrl: effectiveUrl,
        apiKey: isProduction
          ? player.serverSession?.token
          : config.memoryConfig.apiKey || undefined,
        userId: "admin-health-check",
      });
      const r = await svc.health();
      setPingStatus({
        ok: r.ok,
        msg: r.ok ? `OK · ${JSON.stringify(r.details ?? {})}` : `Failed: ${r.reason ?? ""}`,
      });
    } catch (e) {
      setPingStatus({ ok: false, msg: (e as Error).message });
    } finally {
      setPinging(false);
      refreshHealth();
    }
  };

  // Server-side env snapshot (admin-only). Populates the "Server config" card.
  const sessionToken = player.serverSession?.token;
  const [serverStatus, setServerStatus] = useState<AdminServerStatus | null>(null);
  const [serverStatusBusy, setServerStatusBusy] = useState(false);
  const [serverStatusErr, setServerStatusErr] = useState<string | null>(null);
  const reloadServerStatus = useMemo(
    () => async () => {
      if (!effectiveUrl || !sessionToken) {
        setServerStatusErr("Need a live session + a configured mem0 URL.");
        return;
      }
      setServerStatusBusy(true);
      setServerStatusErr(null);
      const s = await fetchAdminServerStatus(effectiveUrl, sessionToken);
      if (!s) {
        setServerStatusErr("Couldn't reach /auth/admin/status (older mem0 build, network, or non-admin session).");
      } else {
        setServerStatus(s);
      }
      setServerStatusBusy(false);
    },
    [effectiveUrl, sessionToken]
  );
  useEffect(() => {
    void reloadServerStatus();
  }, [reloadServerStatus]);

  // Per-user inspector
  const [inspectEmail, setInspectEmail] = useState("");
  const [inspectResult, setInspectResult] = useState<string>("");
  const [inspectBusy, setInspectBusy] = useState(false);
  const inspect = async () => {
    if (!inspectEmail.trim()) return;
    setInspectBusy(true);
    try {
      const svc = new Mem0MemoryService({
        serverUrl: effectiveUrl,
        apiKey: isProduction ? sessionToken : config.memoryConfig.apiKey || undefined,
        userId: inspectEmail.trim(),
      });
      const items = await svc.list({ limit: 200 });
      setInspectResult(JSON.stringify(items, null, 2));
    } catch (e) {
      setInspectResult(`/* ${(e as Error).message} */`);
    } finally {
      setInspectBusy(false);
    }
  };
  const wipeUser = async () => {
    if (!inspectEmail.trim()) return;
    if (!confirm(`Forget every memory for ${inspectEmail.trim()}? This cannot be undone.`)) return;
    const svc = new Mem0MemoryService({
      serverUrl: effectiveUrl,
      apiKey: isProduction ? sessionToken : config.memoryConfig.apiKey || undefined,
      userId: inspectEmail.trim(),
    });
    await svc.wipe();
    setInspectResult(`/* wiped ${inspectEmail.trim()} */`);
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="h2">🧠 Memory & Cognition</h2>
        <p className="muted text-sm">
          The cognition layer is powered by <strong>self-hosted mem0</strong>. Master switch, the live config
          actually being used by the SPA, server-side env snapshot, and a per-user inspector.
          See <code>docs/mem0.md</code> for the architecture.
        </p>
      </header>

      {/* Live status — what the SPA is using right now */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display font-semibold text-white">Currently active</h3>
          <span className={`pill text-xs border ${
            config.flags.offlineMode
              ? "bg-white/5 text-white border-white/10"
              : status?.ok
                ? "bg-good/10 text-good border-good/30"
                : "bg-warn/10 text-warn border-warn/30"
          }`}>
            {config.flags.offlineMode ? "📴 Offline mode" : status?.ok ? "🧠 Online" : "🟡 Configured but unreachable"}
          </span>
        </div>
        <div className="grid sm:grid-cols-[140px_1fr] gap-y-1.5 gap-x-3 text-sm">
          <div className="text-white/50">Sign-in mode</div>
          <div className="text-white">
            <span className="font-mono">{config.serverAuth.mode}</span>
            {isProduction && <span className="muted ml-2">— bearer = player session JWT</span>}
            {!isProduction && <span className="muted ml-2">— bearer = admin key in this admin config</span>}
          </div>
          <div className="text-white/50">mem0 URL</div>
          <div className="text-white">
            {effectiveUrl ? (
              <span className="font-mono">{effectiveUrl}</span>
            ) : (
              <span className="text-bad">— not configured —</span>
            )}
          </div>
          <div className="text-white/50">Bearer source</div>
          <div className="text-white/80 text-[13px]">{effectiveBearerLabel}</div>
        </div>
      </section>

      {/* Master kill switch */}
      <section className="card p-5 space-y-3">
        <div>
          <h3 className="font-display font-semibold text-white">Master switch</h3>
          <p className="text-xs text-white/60">
            Turn off the cognition layer for everyone. The app still works — just without memory-derived insights.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={!config.flags.offlineMode}
            onChange={(e) => setFlag("offlineMode", !e.target.checked)}
          />
          Enable cognition layer (mem0)
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={config.flags.memoryPlayerOptIn}
            onChange={(e) => setFlag("memoryPlayerOptIn", e.target.checked)}
          />
          Allow players to override the global setting (per-user opt-in/opt-out)
        </label>
      </section>

      {/* Editor — production OR demo, branched */}
      {isProduction ? (
        <section className="card p-5 space-y-3">
          <h3 className="font-display font-semibold text-white">mem0 server (production)</h3>
          <p className="text-xs text-white/60">
            URL is baked into the bundle as a fallback (<code>FALLBACK_MEM0_URL</code> in <code>app/src/admin/defaults.ts</code>) and overridable here. Bearer is the player's session JWT — never an admin key — so changing the URL alone is enough; no key entry needed.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <div className="label">mem0 URL (current deployment)</div>
              <input
                className="input"
                placeholder="https://mem0.your-domain.com"
                value={prodUrl}
                onChange={(e) => setProdUrl(e.target.value.trim())}
              />
            </div>
            <div>
              <div className="label">Per-user daily write cap (0 = unlimited)</div>
              <input
                type="number"
                min={0}
                className="input tabular-nums"
                value={cap}
                onChange={(e) => setCap(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary text-sm" onClick={saveProd}>Save</button>
            <button className="btn-ghost text-sm" onClick={ping} disabled={!effectiveUrl || pinging}>
              {pinging ? "Pinging…" : "Health check"}
            </button>
            {pingStatus && (
              <span className={`text-xs ${pingStatus.ok ? "text-good" : "text-bad"}`}>{pingStatus.msg}</span>
            )}
          </div>
          <p className="text-[11px] text-white/40">
            Want to flip back to demo mode (per-browser admin key, no server verification)? <code>/admin → Config → Authentication</code>.
          </p>
        </section>
      ) : (
        <section className="card p-5 space-y-3">
          <h3 className="font-display font-semibold text-white">mem0 server (demo / fork mode)</h3>
          <p className="text-xs text-white/60">
            Demo mode uses a per-deployment Bearer key entered here. (Production mode uses the player's session JWT and ignores these fields.)
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <div className="label">Server URL</div>
              <input
                className="input"
                placeholder="https://mem0.your-domain.com"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value.trim())}
              />
            </div>
            <div>
              <div className="label">Bearer API key</div>
              <input
                className="input"
                type="password"
                placeholder="MEM0_API_KEY"
                value={demoKey}
                onChange={(e) => setDemoKey(e.target.value)}
              />
            </div>
            <div>
              <div className="label">Per-user daily write cap (0 = unlimited)</div>
              <input
                type="number"
                min={0}
                className="input tabular-nums"
                value={cap}
                onChange={(e) => setCap(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary text-sm" onClick={saveDemo}>Save</button>
            <button className="btn-ghost text-sm" onClick={ping} disabled={!demoUrl.trim() || pinging}>
              {pinging ? "Pinging…" : "Health check"}
            </button>
            {pingStatus && (
              <span className={`text-xs ${pingStatus.ok ? "text-good" : "text-bad"}`}>{pingStatus.msg}</span>
            )}
          </div>
        </section>
      )}

      {/* Server-side env snapshot — admin-only */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display font-semibold text-white">Server config (live)</h3>
            <p className="text-xs text-white/60">
              What the mem0 server reports about its own env vars right now. Booleans only for secrets — values never transmit.
            </p>
          </div>
          <button className="btn-ghost text-xs" onClick={() => void reloadServerStatus()} disabled={serverStatusBusy}>
            {serverStatusBusy ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
        {serverStatusErr && <div className="text-xs text-bad">{serverStatusErr}</div>}
        {serverStatus && (
          <div className="grid sm:grid-cols-[200px_1fr] gap-y-1.5 gap-x-3 text-sm">
            <div className="text-white/50">GOOGLE_OAUTH_CLIENT_ID</div>
            <div className="font-mono text-white text-[13px] break-all">{serverStatus.googleOauthClientId || "(unset)"}</div>
            <div className="text-white/50">ADMIN_EMAILS</div>
            <div className="text-white text-[13px]">
              {serverStatus.adminEmails.length === 0 ? (
                <span className="text-bad">(unset — no one will get is_admin)</span>
              ) : (
                serverStatus.adminEmails.map((e) => <span key={e} className="chip mr-1 text-[11px]">{e}</span>)
              )}
            </div>
            <div className="text-white/50">CORS_ORIGINS</div>
            <div className="text-white text-[13px]">
              {serverStatus.corsOrigins.length === 0 ? (
                <span className="text-bad">(unset — only DASHBOARD_URL allowed)</span>
              ) : (
                serverStatus.corsOrigins.map((o) => (
                  <span key={o} className="chip mr-1 text-[11px] font-mono">{o}</span>
                ))
              )}
            </div>
            <div className="text-white/50">SESSION_TTL_DAYS</div>
            <div className="text-white text-[13px] font-mono">{serverStatus.sessionTtlDays}</div>
            <div className="text-white/50">HISTORY_DB_PATH</div>
            <div className="text-white text-[13px] font-mono break-all">
              {serverStatus.historyDbPath}
              {serverStatus.historyDbPath.startsWith("/tmp") && (
                <span className="ml-2 text-warn text-[11px]">⚠ ephemeral — mount /app/data + unset to persist</span>
              )}
            </div>
            <div className="text-white/50">OPENAI_API_KEY</div>
            <div className={serverStatus.openaiApiKeySet ? "text-good text-[13px]" : "text-bad text-[13px]"}>
              {serverStatus.openaiApiKeySet ? "✅ set" : "❌ unset (memory writes will fail)"}
            </div>
            <div className="text-white/50">JWT_SECRET</div>
            <div className={serverStatus.jwtSecretSet ? "text-good text-[13px]" : "text-bad text-[13px]"}>
              {serverStatus.jwtSecretSet ? "✅ set" : "❌ unset (sessions ephemeral)"}
            </div>
            <div className="text-white/50">ADMIN_API_KEY</div>
            <div className={serverStatus.adminApiKeySet ? "text-good text-[13px]" : "text-warn text-[13px]"}>
              {serverStatus.adminApiKeySet ? "✅ set" : "(unset — operator break-glass disabled)"}
            </div>
          </div>
        )}
      </section>

      {/* Per-user inspector */}
      <section className="card p-5 space-y-3">
        <h3 className="font-display font-semibold text-white">Per-user inspector</h3>
        <p className="muted text-xs">View or wipe memories for a specific Gmail. Useful for debugging + GDPR.</p>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
          <input
            className="input"
            placeholder="user@gmail.com"
            value={inspectEmail}
            onChange={(e) => setInspectEmail(e.target.value)}
          />
          <button className="btn-primary text-sm" onClick={inspect} disabled={!inspectEmail.trim() || inspectBusy}>
            {inspectBusy ? "Loading…" : "Inspect"}
          </button>
          <button className="btn-bad text-sm" onClick={wipeUser} disabled={!inspectEmail.trim()}>
            Forget all
          </button>
        </div>
        {inspectResult && (
          <pre className="text-[11px] bg-black/40 border border-white/10 rounded-lg p-3 max-h-[60vh] overflow-y-auto whitespace-pre-wrap font-mono">
            {inspectResult}
          </pre>
        )}
      </section>

      {/* Backend / runtime sanity at the bottom */}
      <section className="card p-4 text-xs text-white/60">
        Backend: <span className="text-white">{backend}</span>
        {status?.details && (
          <pre className="mt-2 text-[11px] bg-black/40 border border-white/10 rounded p-2 font-mono">
            {JSON.stringify(status.details, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
