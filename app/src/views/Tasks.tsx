import { useMemo, useState } from "react";
import { usePlayer } from "../store/PlayerContext";
import type { Task, TaskKind, TaskStatus } from "../types";
import { Mascot } from "../visuals/Mascot";
import { TOPIC_MAP } from "../content";

const KIND_META: Record<TaskKind, { emoji: string; label: string; color: string }> = {
  watch: { emoji: "▶️", label: "Watch", color: "#ff5d8f" },
  read: { emoji: "📖", label: "Read", color: "#7c5cff" },
  build: { emoji: "🛠️", label: "Build (Claude Code)", color: "#28e0b3" },
  explore: { emoji: "🧭", label: "Explore", color: "#ffb547" },
  custom: { emoji: "⭐", label: "Custom", color: "#9ad3ff" },
};

const STATUS_ORDER: TaskStatus[] = ["doing", "todo", "done"];

export function Tasks() {
  const { state, addTask, updateTask, removeTask } = usePlayer();
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ kind: TaskKind; title: string; url: string; notes: string; promptToCopy: string }>({
    kind: "custom",
    title: "",
    url: "",
    notes: "",
    promptToCopy: "",
  });

  const filtered = useMemo(() => {
    const list = filter === "all" ? state.tasks : state.tasks.filter((t) => t.status === filter);
    return [...list].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.updatedAt - a.updatedAt
    );
  }, [state.tasks, filter]);

  const counts = useMemo(() => {
    return {
      all: state.tasks.length,
      todo: state.tasks.filter((t) => t.status === "todo").length,
      doing: state.tasks.filter((t) => t.status === "doing").length,
      done: state.tasks.filter((t) => t.status === "done").length,
    };
  }, [state.tasks]);

  const submit = () => {
    if (!draft.title.trim()) return;
    addTask({
      kind: draft.kind,
      title: draft.title.trim(),
      url: draft.url.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      promptToCopy: draft.promptToCopy.trim() || undefined,
    });
    setDraft({ kind: "custom", title: "", url: "", notes: "", promptToCopy: "" });
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="h1">Tasks</h1>
          <p className="muted text-sm">From your sessions or anything you want to remember to do.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen((x) => !x)}>＋ New task</button>
      </header>

      {open && (
        <div className="card p-4 sm:p-5 space-y-3">
          <div className="grid sm:grid-cols-5 gap-2">
            {(Object.keys(KIND_META) as TaskKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setDraft((d) => ({ ...d, kind: k }))}
                className={`p-3 rounded-xl border ${draft.kind === k ? "bg-accent/15 border-accent" : "bg-white/5 border-white/10 hover:border-white/30"}`}
              >
                <div className="text-2xl">{KIND_META[k].emoji}</div>
                <div className="text-xs font-semibold text-white">{KIND_META[k].label}</div>
              </button>
            ))}
          </div>
          <input className="input" placeholder="Task title (e.g. Watch Karpathy on tokenization)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          {draft.kind === "watch" && (
            <input className="input" placeholder="YouTube URL" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          )}
          {draft.kind === "read" && (
            <input className="input" placeholder="Article URL" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          )}
          {draft.kind === "build" && (
            <textarea className="input min-h-[80px]" placeholder="Prompt to paste in Claude Code" value={draft.promptToCopy} onChange={(e) => setDraft({ ...draft, promptToCopy: e.target.value })} />
          )}
          <textarea className="input min-h-[60px]" placeholder="Notes (optional)" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={submit} disabled={!draft.title.trim()}>Save task</button>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "doing", "todo", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`pill text-xs ${filter === f ? "bg-accent/20 border border-accent text-white" : "bg-white/5 border border-white/10 text-white/70"}`}
          >
            {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)} · {counts[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <Mascot mood="happy" size={88} />
          <h2 className="h2 mt-2">No tasks yet</h2>
          <p className="muted">Add some from your Sparks or write your own. Watch a YouTube. Read an article. Try a Build Card.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onUpdate={(patch) => updateTask(t.id, patch)}
              onRemove={() => removeTask(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onUpdate,
  onRemove,
}: {
  task: Task;
  onUpdate: (patch: Partial<Task>) => void;
  onRemove: () => void;
}) {
  const meta = KIND_META[task.kind];
  const topic = task.source?.topicId ? TOPIC_MAP[task.source.topicId] : undefined;
  const [copied, setCopied] = useState(false);
  return (
    <div className={`card p-4 sm:p-5 transition ${task.status === "done" ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          aria-label="toggle"
          onClick={() => onUpdate({ status: task.status === "done" ? "todo" : "done" })}
          className={`w-7 h-7 rounded-md border grid place-items-center mt-0.5 transition ${
            task.status === "done" ? "bg-good border-good text-ink2" : "bg-white/5 border-white/20 hover:border-white"
          }`}
          title="Toggle done"
        >
          {task.status === "done" ? "✓" : ""}
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip" style={{ background: meta.color + "22", color: meta.color, borderColor: meta.color + "55" }}>
              {meta.emoji} {meta.label}
            </span>
            {topic && (
              <span className="chip">
                {topic.emoji} {topic.name}
              </span>
            )}
            <span className="chip text-[10px]">{new Date(task.createdAt).toLocaleDateString()}</span>
          </div>
          <div className={`mt-1 font-display font-semibold text-white text-base ${task.status === "done" ? "line-through" : ""}`}>{task.title}</div>
          {task.notes && <div className="text-sm text-white/70 mt-1">{task.notes}</div>}
          {task.url && (
            <a href={task.url} target="_blank" rel="noreferrer" className="text-accent text-sm hover:underline mt-1 inline-block">
              ↗ Open link
            </a>
          )}
          {task.promptToCopy && (
            <div className="mt-2">
              <pre className="rounded-lg bg-black/40 border border-white/10 p-2 font-mono text-xs whitespace-pre-wrap text-white/80">{task.promptToCopy}</pre>
              <button
                className="btn-ghost text-xs mt-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(task.promptToCopy ?? "").catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "✓ Copied" : "📋 Copy prompt"}
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <select
            className="input py-1.5 text-xs w-28"
            value={task.status}
            onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
          >
            <option value="todo">Todo</option>
            <option value="doing">Doing</option>
            <option value="done">Done</option>
          </select>
          <button className="text-xs text-white/40 hover:text-bad" onClick={onRemove}>delete</button>
        </div>
      </div>
    </div>
  );
}
