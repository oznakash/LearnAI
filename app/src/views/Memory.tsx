import { useEffect, useState } from "react";
import { useMemory } from "../memory/MemoryContext";
import { useAdmin } from "../admin/AdminContext";
import type { MemoryCategory, MemoryItem } from "../memory/types";
import { Mascot } from "../visuals/Mascot";

// Player-facing memory view. Read + forget + wipe only. Editing and
// exporting are admin-only operations and live in Admin → Memory →
// Per-user inspector. Players cannot rewrite what the cognition layer
// has learned about them — that would let them launder the model into
// saying things they didn't actually demonstrate. The privacy promise
// stays intact via Forget (one) and Wipe (all): the player can always
// remove anything the system thinks it knows.

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
  const { backend, status, list, forget, wipe, refreshHealth } = useMemory();
  const { config: adminCfg } = useAdmin();
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [filter, setFilter] = useState<MemoryCategory | "all">("all");
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={onExit} className="text-xs text-white/50 hover:text-white">← Back</button>
          <h1 className="h1 mt-1">Your Memory</h1>
          <p className="muted text-sm">
            What {adminCfg.branding.appName} remembers about you. Forget anything you don't want kept,
            or wipe everything.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-bad text-sm" onClick={onWipe} disabled={items.length === 0}>🗑 Wipe everything</button>
        </div>
      </header>

      {backend === "offline" && (
        <div className="card p-4 border border-white/5 text-sm text-white/70">
          <strong className="text-white">This browser is in offline mode.</strong> Anything {adminCfg.branding.appName} learns about you stays on this device — it won't sync to your other devices until you turn the memory layer back on.
        </div>
      )}
      {backend === "mem0" && status && !status.ok && (
        <div className="card p-4 border border-warn/30 text-sm text-warn">
          <strong>Memory paused.</strong> We can't reach the memory layer right now. Retrying.
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
                  <div className="text-white text-sm">{m.text}</div>
                  <div className="text-[11px] text-white/40 mt-1">
                    {m.category ?? "other"} · created {timeAgo(m.createdAt)}
                    {m.updatedAt !== m.createdAt && <> · updated {timeAgo(m.updatedAt)}</>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <button className="btn-bad text-xs" onClick={() => onForget(m.id)}>Forget</button>
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
