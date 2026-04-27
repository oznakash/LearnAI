import { useMemo, useState } from "react";
import { useAdmin } from "./AdminContext";
import { SEED_TOPICS } from "../content";
import type { Topic, TopicId } from "../types";

/**
 * Read-only browser + bulk JSON edit for game content.
 *
 * Editing strategy: each topic loaded as a JSON blob in a textarea.
 * Save validates shape and writes to `contentOverrides.topics[id]`.
 * Reset removes the override (restores the seed).
 *
 * Whole-corpus export/import lets the admin version-control content
 * outside the browser.
 */
export function AdminContent() {
  const { config, setConfig } = useAdmin();
  const overrides = config.contentOverrides;

  const allIds = useMemo(() => {
    const ids = new Set<string>(SEED_TOPICS.map((t) => t.id));
    for (const t of overrides.extras) ids.add(t.id);
    return Array.from(ids);
  }, [overrides.extras]);

  const [activeId, setActiveId] = useState<string | null>(allIds[0] ?? null);

  const liveTopic = (id: string): Topic | undefined => {
    if (overrides.topics[id as TopicId]) return overrides.topics[id as TopicId];
    const seed = SEED_TOPICS.find((t) => t.id === id);
    if (seed) return seed;
    return overrides.extras.find((t) => t.id === id);
  };

  const isOverridden = (id: string) => Boolean(overrides.topics[id as TopicId]);
  const isExtra = (id: string) => overrides.extras.some((t) => t.id === id);

  const [draft, setDraft] = useState<string>(() => JSON.stringify(activeId ? liveTopic(activeId) : null, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const select = (id: string) => {
    setActiveId(id);
    setDraft(JSON.stringify(liveTopic(id), null, 2));
    setError(null);
    setSaved(false);
  };

  const validate = (raw: string): { ok: true; topic: Topic } | { ok: false; error: string } => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { ok: false, error: "Invalid JSON: " + (e as Error).message };
    }
    if (!parsed || typeof parsed !== "object") return { ok: false, error: "Topic must be an object." };
    const required = ["id", "name", "emoji", "color", "levels"];
    for (const k of required) if (!(k in parsed)) return { ok: false, error: `Missing field: ${k}` };
    if (!Array.isArray(parsed.levels)) return { ok: false, error: "`levels` must be an array." };
    return { ok: true, topic: parsed as unknown as Topic };
  };

  const save = () => {
    if (!activeId) return;
    const v = validate(draft);
    if (!v.ok) {
      setError(v.error);
      setSaved(false);
      return;
    }
    setConfig((cfg) => ({
      ...cfg,
      contentOverrides: {
        ...cfg.contentOverrides,
        topics: { ...cfg.contentOverrides.topics, [activeId]: v.topic },
      },
    }));
    setError(null);
    setSaved(true);
  };

  const resetTopic = () => {
    if (!activeId) return;
    setConfig((cfg) => {
      const nextTopics = { ...cfg.contentOverrides.topics };
      delete nextTopics[activeId as TopicId];
      const nextExtras = cfg.contentOverrides.extras.filter((t) => t.id !== activeId);
      return {
        ...cfg,
        contentOverrides: { ...cfg.contentOverrides, topics: nextTopics, extras: nextExtras },
      };
    });
    const seed = SEED_TOPICS.find((t) => t.id === activeId);
    setDraft(JSON.stringify(seed ?? null, null, 2));
    setError(null);
    setSaved(false);
  };

  const exportAll = () => {
    const payload = {
      seedSnapshot: false,
      overrides,
      seedIds: SEED_TOPICS.map((t) => t.id),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "builderquest-content-overrides.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSeed = () => {
    const blob = new Blob([JSON.stringify(SEED_TOPICS, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "builderquest-seed-content.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Two accepted shapes: an overrides bundle, or a Topic[] array.
      if (Array.isArray(parsed)) {
        const topicsMap: Partial<Record<TopicId, Topic>> = {};
        const extras: Topic[] = [];
        for (const t of parsed) {
          if (!t?.id) continue;
          if (SEED_TOPICS.some((s) => s.id === t.id)) {
            topicsMap[t.id as TopicId] = t;
          } else {
            extras.push(t);
          }
        }
        setConfig((cfg) => ({
          ...cfg,
          contentOverrides: { topics: topicsMap, extras },
        }));
      } else if (parsed?.overrides) {
        setConfig((cfg) => ({ ...cfg, contentOverrides: parsed.overrides }));
      } else {
        setError("Unrecognized JSON shape. Expected Topic[] or an exported overrides bundle.");
        return;
      }
      setError(null);
      setSaved(true);
    } catch (e) {
      setError("Import failed: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="h2">📚 Content</h2>
          <p className="muted text-sm">Browse, edit, import, and export the curriculum. Overrides are applied at runtime — refresh the player view to see changes.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={exportSeed}>⬇ Export seed</button>
          <button className="btn-ghost text-sm" onClick={exportAll}>⬇ Export overrides</button>
          <label className="btn-primary text-sm cursor-pointer">
            ⬆ Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>

      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        <nav className="card p-3 max-h-[60vh] overflow-y-auto space-y-1">
          {allIds.map((id) => {
            const t = liveTopic(id);
            const active = activeId === id;
            return (
              <button
                key={id}
                onClick={() => select(id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
                  active ? "bg-accent/15 border-accent shadow-glow" : "bg-white/5 border-white/10 hover:border-white/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{t?.emoji ?? "❓"}</span>
                  <span className="text-white font-semibold">{t?.name ?? id}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {isOverridden(id) && <span className="chip text-[10px] bg-warn/10 text-warn border-warn/30">overridden</span>}
                  {isExtra(id) && <span className="chip text-[10px] bg-accent2/10 text-accent2 border-accent2/30">extra</span>}
                  {!isOverridden(id) && !isExtra(id) && <span className="chip text-[10px]">seed</span>}
                  <span className="chip text-[10px]">{t?.levels?.length ?? 0} lvl</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="card p-4 space-y-3">
          {activeId ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display font-semibold text-white">{liveTopic(activeId)?.name}</h3>
                <span className="text-xs text-white/50">({activeId})</span>
                <span className="ml-auto" />
                <button className="btn-ghost text-xs" onClick={resetTopic}>↺ Reset to seed</button>
                <button className="btn-primary text-xs" onClick={save}>Save</button>
              </div>
              <textarea
                className="input font-mono text-[11px] min-h-[55vh]"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(null);
                  setSaved(false);
                }}
              />
              {error && <div className="text-bad text-xs">{error}</div>}
              {saved && !error && <div className="text-good text-xs">✓ Saved. Refresh the player view to see changes.</div>}
              <details>
                <summary className="text-xs text-white/50 cursor-pointer hover:text-white/80">Schema reference</summary>
                <pre className="mt-2 text-[11px] bg-black/40 rounded-lg p-3 border border-white/10 font-mono whitespace-pre-wrap">{`type Topic = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  color: string;          // hex
  visual?: VisualKey;     // optional illustration key
  levels: Level[];        // 1..N levels (default seed has 10)
};

type Level = {
  id: string;             // e.g. "ai-foundations-l1"
  index: number;          // 1..N (level number)
  title: string;
  goal: string;
  estMinutes: number;
  sparks: Spark[];
};

type Spark = { id: string; title: string; exercise: Exercise };

type Exercise =
  | { type: "microread"; title; body; takeaway; visual? }
  | { type: "tip"; title; body; bonusXP?; visual? }
  | { type: "quickpick"; prompt; options[]; answer; explain }
  | { type: "fillstack"; prompt; options[]; answer; explain }
  | { type: "scenario"; setup; prompt; options[]; answer; explain }
  | { type: "patternmatch"; prompt; pairs[]; explain }
  | { type: "buildcard"; title; pitch; promptToCopy; successCriteria }
  | { type: "boss"; title; questions: QuickPick[] };`}
                </pre>
              </details>
            </>
          ) : (
            <div className="text-white/60">Pick a topic on the left.</div>
          )}
        </div>
      </div>
    </div>
  );
}
