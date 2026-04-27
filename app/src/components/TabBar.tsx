import type { View } from "../App";

interface Tab {
  id: View["name"];
  label: string;
  icon: string;
  view: View;
}

const TABS: Tab[] = [
  { id: "home", label: "Home", icon: "🏠", view: { name: "home" } },
  { id: "tasks", label: "Tasks", icon: "✅", view: { name: "tasks" } },
  { id: "dashboard", label: "Progress", icon: "📊", view: { name: "dashboard" } },
  { id: "leaderboard", label: "Guild", icon: "🏆", view: { name: "leaderboard" } },
];

export function TabBar({ view, onNav }: { view: View; onNav: (v: View) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-md bg-ink/85 border-t border-white/5">
      <div className="max-w-5xl mx-auto px-2 grid grid-cols-4">
        {TABS.map((t) => {
          const active = view.name === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onNav(t.view)}
              className={`py-3 flex flex-col items-center gap-0.5 text-[11px] transition ${
                active ? "text-accent" : "text-white/60 hover:text-white"
              }`}
            >
              <span className={`text-xl ${active ? "drop-shadow-[0_0_10px_rgba(124,92,255,0.6)]" : ""}`}>
                {t.icon}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom,0)]" />
    </nav>
  );
}
