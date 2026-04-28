import { useState } from "react";
import { PlayerProvider, usePlayer } from "./store/PlayerContext";
import { AdminProvider } from "./admin/AdminContext";
import { MemoryProvider } from "./memory/MemoryContext";
import { SignIn } from "./views/SignIn";
import { Onboarding } from "./views/Onboarding";
import { Home } from "./views/Home";
import { TopicView } from "./views/TopicView";
import { Play } from "./views/Play";
import { Tasks } from "./views/Tasks";
import { Dashboard } from "./views/Dashboard";
import { Settings } from "./views/Settings";
import { Leaderboard } from "./views/Leaderboard";
import { Calibration } from "./views/Calibration";
import { Memory } from "./views/Memory";
import { AdminConsole } from "./admin/AdminConsole";
import type { TopicId } from "./types";
import { TopBar } from "./components/TopBar";
import { TabBar } from "./components/TabBar";

export type View =
  | { name: "home" }
  | { name: "topic"; topicId: TopicId }
  | { name: "play"; topicId: TopicId; levelId?: string }
  | { name: "tasks" }
  | { name: "dashboard" }
  | { name: "settings" }
  | { name: "leaderboard" }
  | { name: "calibration" }
  | { name: "memory" }
  | { name: "admin" };

function Shell() {
  const { state } = usePlayer();
  const [view, setView] = useState<View>({ name: "home" });

  if (!state.identity) return <SignIn />;
  if (!state.profile) return <Onboarding />;

  const go = (v: View) => setView(v);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onNav={go} />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28">
        {view.name === "home" && <Home onNav={go} />}
        {view.name === "topic" && <TopicView topicId={view.topicId} onNav={go} />}
        {view.name === "play" && (
          <Play
            topicId={view.topicId}
            levelId={view.levelId}
            onDone={() => go({ name: "topic", topicId: view.topicId })}
            onSwitchTopic={(id) => go({ name: "topic", topicId: id })}
          />
        )}
        {view.name === "tasks" && <Tasks />}
        {view.name === "dashboard" && <Dashboard onNav={go} />}
        {view.name === "settings" && <Settings onNav={go} />}
        {view.name === "leaderboard" && <Leaderboard />}
        {view.name === "calibration" && <Calibration onDone={() => go({ name: "home" })} />}
        {view.name === "memory" && <Memory onExit={() => go({ name: "home" })} />}
        {view.name === "admin" && <AdminConsole onExit={() => go({ name: "home" })} />}
      </main>
      <TabBar view={view} onNav={go} />
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <AdminProvider>
        <MemoryProvider>
          <Shell />
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>
  );
}
