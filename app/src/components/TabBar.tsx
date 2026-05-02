import { useAdmin } from "../admin/AdminContext";
import type { View } from "../App";

interface Tab {
  id: View["name"];
  label: string;
  icon: string;
  view: View;
}

const HOME_TAB: Tab = { id: "home", label: "Home", icon: "🏠", view: { name: "home" } };
const TASKS_TAB: Tab = { id: "tasks", label: "Tasks", icon: "✅", view: { name: "tasks" } };
const PROGRESS_TAB: Tab = { id: "dashboard", label: "Progress", icon: "📊", view: { name: "dashboard" } };
const BOARDS_TAB: Tab = { id: "leaderboard", label: "Boards", icon: "🏆", view: { name: "leaderboard" } };
const STREAM_TAB: Tab = { id: "stream", label: "Stream", icon: "🌊", view: { name: "stream" } };

export function TabBar({ view, onNav }: { view: View; onNav: (v: View) => void }) {
  const { config } = useAdmin();

  // Build the tab set from the flags rather than hard-coding it. **Both
  // Stream and Boards are gated:** clicking a tab whose backing surface
  // doesn't render is a dead-link and the worst kind of FTUE friction
  // (see docs/first-time-builder-findings.md #41 + docs/aha-and-network.md
  // §5.3). Forks pulling main with all flags off see a clean 3-tab nav
  // (Home · Tasks · Progress).
  const tabs: Tab[] = [HOME_TAB];
  if (config.flags.socialEnabled && config.flags.streamEnabled) {
    tabs.push(STREAM_TAB);
  }
  tabs.push(TASKS_TAB);
  tabs.push(PROGRESS_TAB);
  if (config.flags.socialEnabled && config.flags.boardsEnabled) {
    tabs.push(BOARDS_TAB);
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-md bg-ink/85 border-t border-white/5">
      <div
        className="max-w-5xl mx-auto px-2 grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => {
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
