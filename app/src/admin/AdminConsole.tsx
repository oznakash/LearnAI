import { useState } from "react";
import { useAdmin } from "./AdminContext";
import { usePlayer } from "../store/PlayerContext";
import { AdminUsers } from "./AdminUsers";
import { AdminAnalytics } from "./AdminAnalytics";
import { AdminEmails } from "./AdminEmails";
import { AdminConfigTab } from "./AdminConfigTab";
import { AdminTuning } from "./AdminTuning";
import { AdminContent } from "./AdminContent";
import { AdminPromptStudio } from "./AdminPromptStudio";
import { Mascot } from "../visuals/Mascot";

type Tab = "users" | "analytics" | "emails" | "config" | "tuning" | "content" | "prompt";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "users", label: "Users", emoji: "👥" },
  { id: "analytics", label: "Analytics", emoji: "📊" },
  { id: "emails", label: "Emails", emoji: "📧" },
  { id: "tuning", label: "Tuning", emoji: "🎮" },
  { id: "content", label: "Content", emoji: "📚" },
  { id: "prompt", label: "Prompt Studio", emoji: "📝" },
  { id: "config", label: "Config", emoji: "⚙️" },
];

export function AdminConsole({ onExit }: { onExit: () => void }) {
  const { isAdmin } = useAdmin();
  const { state: player } = usePlayer();
  const [tab, setTab] = useState<Tab>("users");

  if (!isAdmin) {
    return (
      <div className="card p-8 text-center max-w-xl mx-auto">
        <Mascot mood="thinking" size={120} />
        <h1 className="h1 mt-2">Not an admin</h1>
        <p className="muted">Ask an existing admin to add your Gmail, or bootstrap from Settings if you're the first one.</p>
        <button className="btn-primary mt-3" onClick={onExit}>← Back</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={onExit} className="text-xs text-white/50 hover:text-white">← Back to app</button>
          <h1 className="h1 mt-1">Admin Console</h1>
          <p className="muted text-sm">
            Run BuilderQuest like a product. Every variable is editable, content is hot-reloadable, emails actually send.
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pill text-sm transition ${
                active
                  ? "bg-accent/20 border border-accent text-white shadow-glow"
                  : "bg-white/5 border border-white/10 text-white/70 hover:text-white"
              }`}
            >
              <span className="mr-1">{t.emoji}</span>
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "users" && <AdminUsers />}
      {tab === "analytics" && <AdminAnalytics />}
      {tab === "emails" && <AdminEmails />}
      {tab === "config" && <AdminConfigTab />}
      {tab === "tuning" && <AdminTuning />}
      {tab === "content" && <AdminContent />}
      {tab === "prompt" && <AdminPromptStudio apiKey={player.apiKey} apiProvider={player.apiProvider} />}
    </div>
  );
}
