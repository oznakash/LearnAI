import { useMemo, useState } from "react";
import { useAdmin } from "./AdminContext";
import { SEED_TOPICS } from "../content";
import { SEED_CREATORS } from "../content/creators";
import type { Creator, CreatorId, CreatorKind, Spark, TopicId } from "../types";

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
    for (const t of SEED_TOPICS) {
      for (const lvl of t.levels) {
        for (const sp of lvl.sparks) {
          if (sp.exercise.type !== "podcastnugget") continue;
          const id = sp.exercise.creatorId;
          if (!id) continue;
          if (!out[id]) out[id] = [];
          out[id].push({
            spark: sp,
            topicId: t.id,
            topicName: t.name,
            levelIndex: lvl.index,
          });
        }
      }
    }
    return out;
  }, []);

  const ids = Object.keys(merged).sort();
  const [activeId, setActiveId] = useState<CreatorId | null>(ids[0] ?? null);
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<Creator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

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
            channels, blogs, books. Sparks reference creators by id, so changing a
            credit URL or avatar here updates every Spark that points at it. Delete
            is blocked while Sparks still reference a creator.
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
                <div className="flex gap-2">
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
        Set the <code className="text-white/70">creatorId</code> field on a
        PodcastNugget Spark in the Content tab to start crediting this creator.
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
