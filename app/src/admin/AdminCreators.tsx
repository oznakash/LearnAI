import { useMemo, useState } from "react";
import { useAdmin } from "./AdminContext";
import { SEED_TOPICS } from "../content";
import { SEED_CREATORS } from "../content/creators";
import { usePlayer } from "../store/PlayerContext";
import type {
  Creator,
  CreatorId,
  CreatorKind,
  MicroRead,
  Spark,
  SparkCategory,
  Topic,
  TopicId,
} from "../types";

/**
 * Admin → Creators.
 *
 * The creator registry is the source of truth for *who is being credited*
 * inside Sparks (podcasts, newsletters, channels, blogs, books). This tab
 * lets the operator add a new creator, edit an existing one, and see at
 * a glance which Sparks reference each creator.
 *
 * The merge model is the same as content overrides: we render `SEED_CREATORS`
 * (built into the bundle) as a baseline plus any overrides the operator has
 * saved. Operator edits to a seed creator overwrite that creator's fields;
 * resetting clears the override and falls back to the seed.
 *
 * Deletion is blocked while any Spark in the merged topic list still
 * references the creator id — if a creator goes away, the chip would lose
 * its label and link. The operator gets a count + the list of referencing
 * Sparks so they can either edit those Sparks or stop pointing at this
 * creator before deleting.
 */

type Mode = "view" | "edit" | "create";

const KIND_OPTIONS: { id: CreatorKind; label: string }[] = [
  { id: "podcast", label: "🎙️ Podcast" },
  { id: "newsletter", label: "📬 Newsletter" },
  { id: "channel", label: "📺 Channel" },
  { id: "blog", label: "📝 Blog" },
  { id: "book", label: "📚 Book" },
  { id: "other", label: "✨ Other" },
];

interface SparkRef {
  spark: Spark;
  topicId: TopicId;
  topicName: string;
  levelIndex: number;
}

function isValidId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-_]*$/.test(id);
}

function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function AdminCreators() {
  const { config, setConfig } = useAdmin();

  const merged = useMemo<Record<CreatorId, Creator>>(
    () => ({ ...SEED_CREATORS, ...(config.creators ?? {}) }),
    [config.creators]
  );

  const sparksByCreator = useMemo<Record<CreatorId, SparkRef[]>>(() => {
    const out: Record<CreatorId, SparkRef[]> = {};
    // Walk the merged topic list (seeds + admin overrides + extras) so a
    // freshly-drafted Spark appears under its creator immediately. The
    // helper does the same merging the player runtime does.
    const overrides = config.contentOverrides;
    const map: Record<string, Topic> = {};
    for (const t of SEED_TOPICS) map[t.id] = t;
    for (const [id, t] of Object.entries(overrides.topics)) {
      if (t) map[id] = t;
    }
    for (const t of overrides.extras) map[t.id] = t;
    const live = Object.values(map);

    const matchByName = (name: string | undefined, c: Creator): boolean => {
      if (!name) return false;
      return name.trim().toLowerCase() === c.name.trim().toLowerCase();
    };
    const matchByUrl = (url: string | undefined, c: Creator): boolean => {
      if (!url) return false;
      return url.trim() === c.creditUrl.trim();
    };

    const push = (creatorId: CreatorId, sp: Spark, t: Topic, lvlIndex: number) => {
      if (!out[creatorId]) out[creatorId] = [];
      out[creatorId].push({
        spark: sp,
        topicId: t.id,
        topicName: t.name,
        levelIndex: lvlIndex,
      });
    };

    for (const t of live) {
      for (const lvl of t.levels) {
        for (const sp of lvl.sparks) {
          const ex = sp.exercise;
          // PodcastNugget: explicit creatorId is the canonical link.
          if (ex.type === "podcastnugget") {
            if (ex.creatorId) {
              push(ex.creatorId, sp, t, lvl.index);
              continue;
            }
            // Back-compat: try to fuzzy-match against creator names.
            for (const c of Object.values(merged)) {
              if (
                matchByName(ex.source?.podcast, c) ||
                matchByUrl(ex.source?.podcastUrl, c)
              ) {
                push(c.id, sp, t, lvl.index);
                break;
              }
            }
            continue;
          }
          // YoutubeNugget: source.channelName / videoUrl match channel-kind creators.
          if (ex.type === "youtubenugget") {
            for (const c of Object.values(merged)) {
              if (
                matchByName(ex.source.channelName, c) ||
                matchByUrl(ex.source.videoUrl, c)
              ) {
                push(c.id, sp, t, lvl.index);
                break;
              }
            }
            continue;
          }
          // MicroRead / Tip: optional `source` chip on the Spark.
          if (ex.type === "microread" || ex.type === "tip") {
            const src = ex.source;
            if (!src) continue;
            for (const c of Object.values(merged)) {
              if (matchByName(src.name, c) || matchByUrl(src.url, c)) {
                push(c.id, sp, t, lvl.index);
                break;
              }
            }
          }
        }
      }
    }
    return out;
  }, [config.contentOverrides, merged]);

  const ids = Object.keys(merged).sort();
  const [activeId, setActiveId] = useState<CreatorId | null>(ids[0] ?? null);
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<Creator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [sparkModalFor, setSparkModalFor] = useState<CreatorId | null>(null);

  const active = activeId ? merged[activeId] : null;
  const isSeed = (id: CreatorId): boolean => Boolean(SEED_CREATORS[id]);
  const isOverridden = (id: CreatorId): boolean =>
    isSeed(id) && Boolean(config.creators[id]);
  const isCustom = (id: CreatorId): boolean =>
    !isSeed(id) && Boolean(config.creators[id]);

  const referencingSparks = (id: CreatorId): SparkRef[] => sparksByCreator[id] ?? [];

  const startEdit = () => {
    if (!active) return;
    setDraft({ ...active });
    setMode("edit");
    setError(null);
    setSavedFlash(false);
  };

  const startCreate = () => {
    setDraft({
      id: "",
      name: "",
      kind: "podcast",
      avatarEmoji: "🎙️",
      creditUrl: "",
      creditLabel: "",
    });
    setMode("create");
    setError(null);
    setSavedFlash(false);
  };

  const cancel = () => {
    setMode("view");
    setDraft(null);
    setError(null);
  };

  const validate = (c: Creator, isNew: boolean): string | null => {
    if (!c.id) return "ID is required.";
    if (!isValidId(c.id))
      return "ID must be lowercase letters, digits, hyphens, or underscores (start with a letter or digit).";
    if (isNew && merged[c.id])
      return `Creator id "${c.id}" already exists. Pick a different id, or edit the existing one.`;
    if (!c.name.trim()) return "Name is required.";
    if (!c.creditUrl) return "Credit URL is required.";
    if (!isValidUrl(c.creditUrl)) return "Credit URL must be a valid http(s) URL.";
    if (!c.creditLabel.trim()) return "Credit label is required.";
    if (c.avatarUrl && !isValidUrl(c.avatarUrl))
      return "Avatar URL must be a valid http(s) URL.";
    if (!c.avatarUrl && !(c.avatarEmoji ?? "").trim())
      return "Provide an avatar URL or an emoji fallback.";
    return null;
  };

  const save = () => {
    if (!draft) return;
    const err = validate(draft, mode === "create");
    if (err) {
      setError(err);
      return;
    }
    const cleaned: Creator = {
      ...draft,
      id: draft.id.trim(),
      name: draft.name.trim(),
      handle: draft.handle?.trim() || undefined,
      avatarUrl: draft.avatarUrl?.trim() || undefined,
      avatarEmoji: draft.avatarEmoji?.trim() || undefined,
      accentColor: draft.accentColor?.trim() || undefined,
      creditUrl: draft.creditUrl.trim(),
      creditLabel: draft.creditLabel.trim(),
      bio: draft.bio?.trim() || undefined,
    };
    setConfig((cfg) => ({
      ...cfg,
      creators: { ...cfg.creators, [cleaned.id]: cleaned },
    }));
    setActiveId(cleaned.id);
    setMode("view");
    setDraft(null);
    setError(null);
    setSavedFlash(true);
  };

  const removeOrReset = () => {
    if (!active) return;
    const refs = referencingSparks(active.id);
    if (refs.length > 0) {
      setError(
        `Can't remove "${active.name}" — ${refs.length} Spark${refs.length === 1 ? "" : "s"} still reference this creator. Reassign or delete those Sparks first.`
      );
      return;
    }
    setConfig((cfg) => {
      const next = { ...cfg.creators };
      delete next[active.id];
      return { ...cfg, creators: next };
    });
    if (isSeed(active.id)) {
      // Override removed; seed remains active.
      setSavedFlash(true);
    } else {
      // Custom creator — drop it from the registry, switch focus.
      const remaining = Object.keys({ ...SEED_CREATORS, ...{} }).sort();
      setActiveId(remaining[0] ?? null);
    }
    setError(null);
  };

  const Field = ({
    label,
    children,
    hint,
  }: {
    label: string;
    children: React.ReactNode;
    hint?: string;
  }) => (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-white/45 mt-1 block">{hint}</span>}
    </label>
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="h2">🎨 Creators</h2>
          <p className="muted text-sm max-w-3xl">
            External content sources we credit inside Sparks — podcasts, newsletters,
            channels, blogs, books. Open a creator and paste source content to draft
            a new Spark attributed to them. Sparks reference creators by id, so
            changing a credit URL or avatar here updates every Spark that points at
            it. Delete is blocked while Sparks still reference a creator.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary text-sm" onClick={startCreate}>
            + New creator
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <nav className="card p-3 max-h-[60vh] overflow-y-auto space-y-1">
          {ids.length === 0 && (
            <div className="text-white/50 text-sm px-2 py-3">No creators yet.</div>
          )}
          {ids.map((id) => {
            const c = merged[id];
            const refs = referencingSparks(id);
            const activeBtn = activeId === id;
            return (
              <button
                key={id}
                onClick={() => {
                  setActiveId(id);
                  setMode("view");
                  setDraft(null);
                  setError(null);
                  setSavedFlash(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
                  activeBtn
                    ? "bg-accent/15 border-accent shadow-glow"
                    : "bg-white/5 border-white/10 hover:border-white/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  {c.avatarUrl ? (
                    <img
                      src={c.avatarUrl}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-lg leading-none">{c.avatarEmoji ?? "✨"}</span>
                  )}
                  <span className="text-white font-semibold truncate">{c.name}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="chip text-[10px]">{c.kind}</span>
                  {isSeed(id) && !isOverridden(id) && (
                    <span className="chip text-[10px]">seed</span>
                  )}
                  {isOverridden(id) && (
                    <span className="chip text-[10px] bg-warn/10 text-warn border-warn/30">
                      overridden
                    </span>
                  )}
                  {isCustom(id) && (
                    <span className="chip text-[10px] bg-accent2/10 text-accent2 border-accent2/30">
                      custom
                    </span>
                  )}
                  <span className="chip text-[10px]">
                    {refs.length} spark{refs.length === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="card p-4 space-y-4">
          {mode === "view" && active && (
            <>
              <div className="flex flex-wrap items-start gap-3">
                {active.avatarUrl ? (
                  <img
                    src={active.avatarUrl}
                    alt=""
                    className="w-14 h-14 rounded-2xl object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                    {active.avatarEmoji ?? "✨"}
                  </div>
                )}
                <div className="flex-1 min-w-[200px]">
                  <div className="font-display text-white font-semibold text-lg">
                    {active.name}
                  </div>
                  <div className="text-xs text-white/50">
                    {active.id} · {active.kind}
                    {active.handle ? ` · ${active.handle}` : ""}
                  </div>
                  {active.bio && (
                    <p className="text-white/75 text-sm mt-2">{active.bio}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-primary text-xs"
                    data-testid="add-spark"
                    onClick={() => setSparkModalFor(active.id)}
                    title="Paste source content and draft a Spark attributed to this creator."
                  >
                    + Add Spark
                  </button>
                  <button className="btn-ghost text-xs" onClick={startEdit}>
                    ✎ Edit
                  </button>
                  <button
                    className="btn-ghost text-xs text-bad"
                    onClick={removeOrReset}
                    title={
                      isSeed(active.id) && !isOverridden(active.id)
                        ? "Built-in creator — can't be removed."
                        : isSeed(active.id)
                          ? "Reset this creator to its seed values"
                          : "Delete this creator"
                    }
                    disabled={isSeed(active.id) && !isOverridden(active.id)}
                  >
                    {isSeed(active.id)
                      ? isOverridden(active.id)
                        ? "↺ Reset to seed"
                        : "🔒 Built-in"
                      : "✕ Delete"}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="label mb-1">Credit URL</div>
                  <a
                    href={active.creditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-warn hover:underline break-all"
                  >
                    {active.creditUrl}
                  </a>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="label mb-1">Credit label</div>
                  <div className="text-white">{active.creditLabel}</div>
                </div>
              </div>

              {error && <div className="text-bad text-xs">{error}</div>}
              {savedFlash && !error && (
                <div className="text-good text-xs">✓ Saved.</div>
              )}

              <CreatorSparkList
                refs={referencingSparks(active.id)}
                creatorName={active.name}
              />
            </>
          )}

          {(mode === "edit" || mode === "create") && draft && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-semibold text-white">
                  {mode === "create" ? "New creator" : `Editing: ${draft.name || draft.id}`}
                </h3>
                <div className="flex gap-2">
                  <button className="btn-ghost text-xs" onClick={cancel}>
                    Cancel
                  </button>
                  <button className="btn-primary text-xs" onClick={save}>
                    Save
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label="ID"
                  hint="Stable kebab-case key. Sparks reference this id."
                >
                  <input
                    className="input"
                    value={draft.id}
                    disabled={mode === "edit"}
                    placeholder="e.g. lenny, hard-fork, stratechery"
                    onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                  />
                </Field>
                <Field label="Name">
                  <input
                    className="input"
                    value={draft.name}
                    placeholder="e.g. Lenny's Podcast"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </Field>
                <Field label="Kind">
                  <select
                    className="input"
                    value={draft.kind}
                    onChange={(e) =>
                      setDraft({ ...draft, kind: e.target.value as CreatorKind })
                    }
                  >
                    {KIND_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Handle"
                  hint="Optional secondary line under the name (e.g. @lennysan)."
                >
                  <input
                    className="input"
                    value={draft.handle ?? ""}
                    placeholder="@handle (optional)"
                    onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
                  />
                </Field>
                <Field
                  label="Avatar URL"
                  hint="Hosted image. Falls back to emoji when empty."
                >
                  <input
                    className="input"
                    value={draft.avatarUrl ?? ""}
                    placeholder="https://… (optional)"
                    onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
                  />
                </Field>
                <Field
                  label="Avatar emoji"
                  hint="Used when no avatar URL is set."
                >
                  <input
                    className="input"
                    value={draft.avatarEmoji ?? ""}
                    placeholder="🎙️"
                    onChange={(e) =>
                      setDraft({ ...draft, avatarEmoji: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Credit URL"
                  hint="Where the credit chip + 'Listen / Read' link lands. Use the source's home URL."
                >
                  <input
                    className="input"
                    value={draft.creditUrl}
                    placeholder="https://www.lennysnewsletter.com/podcast"
                    onChange={(e) => setDraft({ ...draft, creditUrl: e.target.value })}
                  />
                </Field>
                <Field
                  label="Credit label"
                  hint="Action text on the link (e.g. 'Listen on Lenny's Podcast')."
                >
                  <input
                    className="input"
                    value={draft.creditLabel}
                    placeholder="Listen on Lenny's Podcast"
                    onChange={(e) => setDraft({ ...draft, creditLabel: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Bio" hint="Optional one-paragraph blurb shown on this card.">
                <textarea
                  className="input min-h-[80px]"
                  value={draft.bio ?? ""}
                  onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                  placeholder="Conversations with the world's top product, growth, and AI builders."
                />
              </Field>

              {error && <div className="text-bad text-xs">{error}</div>}
            </div>
          )}

          {!active && mode === "view" && (
            <div className="text-white/60">
              No creator selected. Use <strong>+ New creator</strong> above to add one.
            </div>
          )}
        </div>
      </div>

      {sparkModalFor && merged[sparkModalFor] && (
        <AddSparkModal
          creator={merged[sparkModalFor]}
          onClose={() => setSparkModalFor(null)}
          onSaved={() => {
            setSparkModalFor(null);
            setSavedFlash(true);
          }}
        />
      )}
    </div>
  );
}

function CreatorSparkList({
  refs,
  creatorName,
}: {
  refs: SparkRef[];
  creatorName: string;
}) {
  if (refs.length === 0) {
    return (
      <section className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white/60">
        No Sparks reference <strong className="text-white/80">{creatorName}</strong> yet.
        Click <strong className="text-white/80">+ Add Spark</strong> above to paste
        source content and draft one — it'll be attributed to this creator
        automatically.
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <div className="label">Sparks crediting {creatorName} ({refs.length})</div>
      <ul className="space-y-1.5">
        {refs.map((r) => (
          <li
            key={r.spark.id}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm flex flex-wrap items-center gap-2"
          >
            <span className="text-white font-semibold">{r.spark.title}</span>
            <span className="text-white/55 text-xs">
              · {r.topicName} · L{r.levelIndex}
            </span>
            <span className="ml-auto chip text-[10px]">{r.spark.exercise.type}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-white/45">
        Sparks are still edited under <strong>Admin → Content</strong> (whole-topic JSON).
        Editing a creator here updates every Spark's chip + link in one go.
      </p>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// AddSparkModal
//
// Paste-and-draft UI. Operator picks a topic + level + category, pastes raw
// source content (e.g. a podcast transcript chunk, newsletter excerpt, blog
// paragraph), and either has Claude distill it into a Spark or fills the
// fields by hand. The resulting MicroRead Spark is appended to the chosen
// topic via `AdminConfig.contentOverrides.topics[topicId]` — the same store
// AdminContent + AdminPromptStudio use, so the Spark surfaces immediately
// in player Topic / Play views.
//
// CORS: the Anthropic Messages API supports browser calls when the
// `anthropic-dangerous-direct-browser-access` header is set (same approach
// AdminPromptStudio uses via `generateSparks`). If the operator hasn't set
// an Anthropic key in Settings, the AI button is disabled and the form is
// fully hand-fillable — the paste→edit→save loop is the load-bearing part.
// ───────────────────────────────────────────────────────────────────────────

const TOPIC_CHOICES: { id: TopicId; label: string }[] = [
  { id: "ai-foundations", label: "AI Foundations" },
  { id: "llms-cognition", label: "LLMs & Cognition" },
  { id: "memory-safety", label: "Memory & Safety" },
  { id: "ai-pm", label: "AI PM" },
  { id: "ai-builder", label: "AI Builder" },
  { id: "cybersecurity", label: "Cybersecurity" },
  { id: "cloud", label: "Cloud" },
  { id: "ai-devtools", label: "AI DevTools" },
  { id: "ai-trends", label: "AI Trends" },
  { id: "frontier-companies", label: "Frontier Companies" },
  { id: "ai-news", label: "AI News" },
  { id: "open-source", label: "Open Source" },
];

const CATEGORY_CHOICES: { id: SparkCategory; label: string }[] = [
  { id: "principle", label: "Principle (2-year shelf)" },
  { id: "pattern", label: "Pattern (6-month shelf)" },
  { id: "tooling", label: "Tooling (3-month shelf)" },
  { id: "company", label: "Company (30-day shelf)" },
  { id: "news", label: "News (14-day shelf)" },
  { id: "frontier", label: "Frontier (7-day shelf)" },
];

interface DraftedSpark {
  title: string;
  body: string;
  takeaway: string;
  sourceName: string;
  sourceUrl: string;
}

const SYSTEM_PROMPT =
  "You are a content distiller for LearnAI. Take pasted source content and produce ONE high-signal MicroRead Spark in JSON. Schema: { type:\"microread\", title, body, takeaway, source:{name,url}, category, addedAt }. Rules: body ≤ 120 words, takeaway ≤ 90 chars, action-shaped, named products only, no hedging, no academic register, quote ≤ 15 words from the source. Return strict JSON only.";

function AddSparkModal({
  creator,
  onClose,
  onSaved,
}: {
  creator: Creator;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { config, setConfig } = useAdmin();
  const { state: player } = usePlayer();
  const apiKey = player.apiKey;
  const apiProvider = player.apiProvider ?? "anthropic";

  const [pasted, setPasted] = useState("");
  const [sourceUrl, setSourceUrl] = useState(creator.creditUrl);
  const [topicId, setTopicId] = useState<TopicId>("ai-foundations");
  const [level, setLevel] = useState(1);
  const [category, setCategory] = useState<SparkCategory>("pattern");
  const [drafted, setDrafted] = useState<DraftedSpark | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const canDraft = pasted.trim().length > 20 && Boolean(apiKey) && apiProvider === "anthropic";

  const draftWithAI = async () => {
    if (!apiKey) {
      setError("Set your Anthropic API key in Settings first.");
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      const userMsg = JSON.stringify({
        creator: creator.name,
        topic: topicId,
        level,
        category,
        addedAt: today,
        sourceUrl,
        pastedContent: pasted,
      });
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`);
      }
      const data = (await res.json()) as { content?: { text?: string }[] };
      const text = data?.content?.[0]?.text ?? "";
      const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/```\s*$/, "");
      const parsed = JSON.parse(cleaned) as {
        title?: string;
        body?: string;
        takeaway?: string;
        source?: { name?: string; url?: string };
      };
      setDrafted({
        title: parsed.title ?? "",
        body: parsed.body ?? "",
        takeaway: parsed.takeaway ?? "",
        sourceName: parsed.source?.name ?? creator.name,
        sourceUrl: parsed.source?.url ?? sourceUrl,
      });
    } catch (e) {
      setError("Couldn't draft via AI: " + (e as Error).message + ". Fill the form by hand and save.");
    } finally {
      setDrafting(false);
    }
  };

  const startManualDraft = () => {
    setDrafted({
      title: "",
      body: "",
      takeaway: "",
      sourceName: creator.name,
      sourceUrl,
    });
    setError(null);
  };

  const updateDraft = (patch: Partial<DraftedSpark>) => {
    setDrafted((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const save = () => {
    if (!drafted) return;
    if (!drafted.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!drafted.body.trim()) {
      setError("Body is required.");
      return;
    }
    if (!drafted.takeaway.trim()) {
      setError("Takeaway is required.");
      return;
    }
    const exercise: MicroRead = {
      type: "microread",
      title: drafted.title.trim(),
      body: drafted.body.trim(),
      takeaway: drafted.takeaway.trim(),
      source: {
        name: drafted.sourceName.trim() || creator.name,
        url: drafted.sourceUrl.trim() || creator.creditUrl,
      },
      category,
      addedAt: today,
    };
    const newSpark: Spark = {
      id: `creator-${creator.id}-${Date.now()}`,
      title: drafted.title.trim(),
      exercise,
    };
    setConfig((cfg) => {
      // Source the topic from any existing override, then any extra,
      // then fall back to the seed. We need a mutable base or the
      // overrides won't reach the player runtime (see SEED-only path).
      const fromOverrides = cfg.contentOverrides.topics[topicId];
      const fromExtras = cfg.contentOverrides.extras.find((t) => t.id === topicId);
      const seed = SEED_TOPICS.find((t) => t.id === topicId);
      const base: Topic | undefined = fromOverrides ?? fromExtras ?? seed;
      if (!base) return cfg;
      const targetLevel = base.levels.find((l) => l.index === level);
      if (!targetLevel) return cfg;
      const nextLevels = base.levels.map((l) =>
        l.index === level ? { ...l, sparks: [...l.sparks, newSpark] } : l
      );
      return {
        ...cfg,
        contentOverrides: {
          ...cfg.contentOverrides,
          topics: {
            ...cfg.contentOverrides.topics,
            [topicId]: { ...base, levels: nextLevels },
          },
        },
      };
    });
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add Spark"
      onClick={onClose}
    >
      <div
        className="card p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-white text-lg">
              Add Spark — {creator.name}
            </h3>
            <p className="text-white/55 text-xs mt-1">
              Paste source content from {creator.name}. We draft a MicroRead
              Spark, you edit, you save. The Spark lands in the chosen topic +
              level via content overrides.
            </p>
          </div>
          <button
            className="btn-ghost text-xs"
            onClick={onClose}
            aria-label="Close"
            data-testid="close-modal"
          >
            ✕
          </button>
        </header>

        <section className="space-y-2">
          <div className="label">1. Source content</div>
          <textarea
            data-testid="paste-content"
            className="input min-h-[140px] font-mono text-[12px]"
            placeholder="Paste a transcript chunk, newsletter excerpt, blog paragraph…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block">
              <span className="label mb-1 block">Source URL</span>
              <input
                data-testid="source-url"
                className="input"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={creator.creditUrl}
              />
            </label>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-2">
          <label className="block">
            <span className="label mb-1 block">Topic</span>
            <select
              data-testid="topic-select"
              className="input"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value as TopicId)}
            >
              {TOPIC_CHOICES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label mb-1 block">Level</span>
            <select
              data-testid="level-select"
              className="input"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  L{n}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label mb-1 block">Category</span>
            <select
              data-testid="category-select"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as SparkCategory)}
            >
              {CATEGORY_CHOICES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="flex flex-wrap items-center gap-2">
          <button
            data-testid="draft-with-ai"
            className="btn-primary text-sm"
            onClick={draftWithAI}
            disabled={!canDraft || drafting}
            title={
              !apiKey
                ? "Set your Anthropic API key in Admin → Config first."
                : apiProvider !== "anthropic"
                  ? "AI distillation uses the Anthropic API. Switch your provider in Settings."
                  : pasted.trim().length <= 20
                    ? "Paste at least 20 chars of source content first."
                    : "Distill the pasted content into a MicroRead Spark."
            }
          >
            {drafting ? "Drafting…" : "⚡ Draft Spark with AI"}
          </button>
          <button
            data-testid="manual-draft"
            className="btn-ghost text-sm"
            onClick={startManualDraft}
          >
            ✎ Or fill by hand
          </button>
          {!apiKey && (
            <span
              data-testid="missing-key-hint"
              className="text-[11px] text-white/55"
            >
              Set your Anthropic API key in Admin → Config first.
            </span>
          )}
        </section>

        {drafted && (
          <section className="space-y-2 border-t border-white/10 pt-3">
            <div className="label">Preview · edit before saving</div>
            <label className="block">
              <span className="text-[11px] text-white/55">Title</span>
              <input
                data-testid="draft-title"
                className="input"
                value={drafted.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-white/55">Body (≤ 120 words)</span>
              <textarea
                data-testid="draft-body"
                className="input min-h-[120px]"
                value={drafted.body}
                onChange={(e) => updateDraft({ body: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-white/55">Takeaway (≤ 90 chars)</span>
              <input
                data-testid="draft-takeaway"
                className="input"
                value={drafted.takeaway}
                onChange={(e) => updateDraft({ takeaway: e.target.value })}
              />
            </label>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-white/55">Source name</span>
                <input
                  className="input"
                  value={drafted.sourceName}
                  onChange={(e) => updateDraft({ sourceName: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-white/55">Source URL</span>
                <input
                  className="input"
                  value={drafted.sourceUrl}
                  onChange={(e) => updateDraft({ sourceUrl: e.target.value })}
                />
              </label>
            </div>
          </section>
        )}

        {error && <div className="text-bad text-xs" data-testid="error">{error}</div>}

        <footer className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
          <button className="btn-ghost text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            data-testid="save-spark"
            className="btn-primary text-sm"
            onClick={save}
            disabled={!drafted}
            title={drafted ? "Append the Spark to the chosen topic + level." : "Draft a Spark first."}
          >
            Add to seed
          </button>
        </footer>
        {/*
          Note: total seed-write happens via `setConfig` ↦
          `contentOverrides.topics[topicId]`. The persistence layer
          (`saveAdminConfig`) runs on the next render. config.creators
          is read-only on this screen — we never mutate creator records
          in this modal.
        */}
        <div className="hidden" aria-hidden>
          {/* Surface live-saved-Sparks count for tests; cheap & local. */}
          <span data-testid="seed-count">
            {Object.values(config.contentOverrides.topics).reduce(
              (acc, t) => acc + (t?.levels.reduce((a, l) => a + l.sparks.length, 0) ?? 0),
              0
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
