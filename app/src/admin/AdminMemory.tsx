import { useState } from "react";
import { useAdmin } from "./AdminContext";
import { useMemory } from "../memory/MemoryContext";
import { Mem0MemoryService } from "../memory";

export function AdminMemory() {
  const { config, setConfig } = useAdmin();
  const { backend, status, refreshHealth } = useMemory();
  const cfg = config.memoryConfig;
  const flags = config.flags;

  const [serverUrl, setServerUrl] = useState(cfg.serverUrl);
  const [apiKey, setApiKey] = useState(cfg.apiKey ?? "");
  const [cap, setCap] = useState(cfg.perUserDailyCap);

  const setFlag = (key: keyof typeof flags, v: boolean) =>
    setConfig((c) => ({ ...c, flags: { ...c.flags, [key]: v } }));

  const save = () =>
    setConfig((c) => ({
      ...c,
      memoryConfig: { ...c.memoryConfig, serverUrl: serverUrl.trim(), apiKey: apiKey.trim(), perUserDailyCap: cap },
    }));

  const [pingStatus, setPingStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pinging, setPinging] = useState(false);

  const ping = async () => {
    setPinging(true);
    setPingStatus(null);
    try {
      const svc = new Mem0MemoryService({
        serverUrl: serverUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        userId: "admin-health-check",
      });
      const r = await svc.health();
      setPingStatus({ ok: r.ok, msg: r.ok ? `OK · ${JSON.stringify(r.details ?? {})}` : `Failed: ${r.reason ?? ""}` });
    } catch (e) {
      setPingStatus({ ok: false, msg: (e as Error).message });
    } finally {
      setPinging(false);
      refreshHealth();
    }
  };

  // Per-user inspector
  const [inspectEmail, setInspectEmail] = useState("");
  const [inspectResult, setInspectResult] = useState<string>("");
  const [inspectBusy, setInspectBusy] = useState(false);
  const inspect = async () => {
    if (!inspectEmail.trim()) return;
    setInspectBusy(true);
    try {
      const svc = new Mem0MemoryService({
        serverUrl: serverUrl.trim(),
        apiKey: apiKey.trim() || undefined,
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
      serverUrl: serverUrl.trim(),
      apiKey: apiKey.trim() || undefined,
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
          The cognition layer is powered by <strong>self-hosted mem0</strong>. Below: the master kill switch, the
          server config, health, and a per-user inspector. See <code>docs/mem0.md</code> for the architecture.
        </p>
      </header>

      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display font-semibold text-white">Master switch</h3>
            <p className="text-xs text-white/60">
              Turn off the cognition layer for everyone. The app still works — just without memory-derived insights.
            </p>
          </div>
          <span className={`pill text-xs border ${
            flags.offlineMode ? "bg-white/5 text-white border-white/10" : status?.ok ? "bg-good/10 text-good border-good/30" : "bg-warn/10 text-warn border-warn/30"
          }`}>
            {flags.offlineMode ? "📴 Offline mode" : status?.ok ? "🧠 Online" : "🟡 Configured but unreachable"}
          </span>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={!flags.offlineMode}
            onChange={(e) => setFlag("offlineMode", !e.target.checked)}
          />
          Enable cognition layer (mem0)
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={flags.memoryPlayerOptIn}
            onChange={(e) => setFlag("memoryPlayerOptIn", e.target.checked)}
          />
          Allow players to override the global setting (per-user opt-in/opt-out)
        </label>
      </section>

      <section className="card p-5 space-y-3">
        <h3 className="font-display font-semibold text-white">mem0 server</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <div className="label">Server URL</div>
            <input
              className="input"
              placeholder="https://mem0.your-domain.com"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value.trim())}
            />
          </div>
          <div>
            <div className="label">Bearer API key</div>
            <input
              className="input"
              type="password"
              placeholder="MEM0_API_KEY"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
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
          <button className="btn-primary text-sm" onClick={save}>Save</button>
          <button className="btn-ghost text-sm" onClick={ping} disabled={!serverUrl.trim() || pinging}>
            {pinging ? "Pinging…" : "Health check"}
          </button>
          {pingStatus && (
            <span className={`text-xs ${pingStatus.ok ? "text-good" : "text-bad"}`}>{pingStatus.msg}</span>
          )}
        </div>
        <p className="text-[11px] text-white/40">
          Looking for setup? Run <code>docker compose -f docker-compose.mem0.yml up -d</code> at the repo root.
        </p>
      </section>

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
