import { useEffect, useState } from "react";
import { useMemory } from "../memory/MemoryContext";
import { useAdmin } from "../admin/AdminContext";
import type { MemoryCategory, MemoryItem } from "../memory/types";
import { Mascot } from "../visuals/Mascot";

const CATS: { id: MemoryCategory | "all"; label: string; emoji: string }[] = [
  { id: "all", label: "All", emoji: "📚" },
  { id: "goal", label: "Goals", emoji: "🎯" },
  { id: "strength", label: "Strengths", emoji: "💪" },
  { id: "gap", label: "Gaps", emoji: "🪤" },
  { id: "preference", label: "Preferences", emoji: "👍" },
  { id: "history", label: "History", emoji: "🗓️" },
  { id: "calibration", label: "Calibration", emoji: "🎚️" },
  { id: "system", label: "System", emoji: "⚙️" },
];

export function Memory({ onExit }: { onExit: () => void }) {
  const { backend, status, list, update, forget, wipe, refreshHealth } = useMemory();
  const { config: adminCfg } = useAdmin();
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [filter, setFilter] = useState<MemoryCategory | "all">("all");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const reload = async () => {
    setLoading(true);
    const all = await list({ limit: 500 });
    setItems(all);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    refreshHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend]);

  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);
  const counts: Record<string, number> = { all: items.length };
  for (const i of items) {
    const k = i.category ?? "other";
    counts[k] = (counts[k] ?? 0) + 1;
  }

  const onWipe = async () => {
    if (!confirm(`Forget everything ${adminCfg.branding.appName} knows about you? (${items.length} memories)`)) return;
    await wipe();
    setItems([]);
  };

  const onForget = async (id: string) => {
    await forget(id);
    setItems((arr) => arr.filter((x) => x.id !== id));
  };

  const startEdit = (m: MemoryItem) => {
    setEditingId(m.id);
    setEditText(m.text);
  };

  const saveEdit = async (m: MemoryItem) => {
    if (!editText.trim()) return;
    const next = await update(m.id, { text: editText.trim() });
    if (next) {
      setItems((arr) => arr.map((x) => (x.id === m.id ? next : x)));
    }
    setEditingId(null);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${adminCfg.branding.appName.toLowerCase().replace(/\s+/g, "-")}-my-memory.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={onExit} className="text-xs text-white/50 hover:text-white">← Back</button>
          <h1 className="h1 mt-1">Your Memory</h1>
          <p className="muted text-sm">
            What {adminCfg.branding.appName} remembers about you. You can edit, forget, export, or wipe everything.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`pill text-xs ${
            backend === "mem0" && status?.ok ? "bg-good/10 text-good border-good/30" :
            backend === "mem0" ? "bg-warn/10 text-warn border-warn/30" :
            "bg-white/5 text-white/70 border-white/10"
          } border`}>
            {backend === "mem0" && status?.ok ? "🧠 mem0 connected" : backend === "mem0" ? "🟡 mem0 paused" : "📴 Offline mode"}
          </span>
          <button className="btn-ghost text-sm" onClick={exportJson}>⬇ Export</button>
          <button className="btn-bad text-sm" onClick={onWipe} disabled={items.length === 0}>🗑 Wipe everything</button>
        </div>
      </header>

      {backend === "offline" && (
        <div className="card p-4 border border-white/5 text-sm text-white/70">
          <strong className="text-white">Offline mode is on.</strong> Memories live in this browser only. The full
          cognition layer (mem0) is disabled by your admin — heuristic recommendations remain.
        </div>
      )}
      {backend === "mem0" && status && !status.ok && (
        <div className="card p-4 border border-warn/30 text-sm text-warn">
          <strong>Memory paused.</strong> Couldn't reach mem0 — {status.reason ?? "no details"}. Retrying.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`pill text-xs ${filter === c.id ? "bg-accent/20 text-white border border-accent" : "bg-white/5 text-white/70 border border-white/10"}`}
          >
            <span className="mr-1">{c.emoji}</span>{c.label}
            {counts[c.id] !== undefined && <span className="ml-1 text-white/40">· {counts[c.id]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-white/50">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <Mascot mood="thinking" size={88} />
          <h2 className="h2 mt-2">Nothing remembered yet</h2>
          <p className="muted">Complete a few Sparks and memories will start showing up here.</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {filtered.map((m) => (
            <li key={m.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">{categoryEmoji(m.category)}</span>
                <div className="flex-1">
                  {editingId === m.id ? (
                    <textarea
                      className="input text-sm"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                    />
                  ) : (
                    <div className="text-white text-sm">{m.text}</div>
                  )}
                  <div className="text-[11px] text-white/40 mt-1">
                    {m.category ?? "other"} · created {timeAgo(m.createdAt)}
                    {m.updatedAt !== m.createdAt && <> · updated {timeAgo(m.updatedAt)}</>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  {editingId === m.id ? (
                    <>
                      <button className="btn-primary text-xs" onClick={() => saveEdit(m)}>Save</button>
                      <button className="btn-ghost text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-ghost text-xs" onClick={() => startEdit(m)}>Edit</button>
                      <button className="btn-bad text-xs" onClick={() => onForget(m.id)}>Forget</button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function categoryEmoji(c?: string): string {
  switch (c) {
    case "goal": return "🎯";
    case "strength": return "💪";
    case "gap": return "🪤";
    case "preference": return "👍";
    case "history": return "🗓️";
    case "calibration": return "🎚️";
    case "system": return "⚙️";
    default: return "💡";
  }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
