import { useEffect, useState } from "react";
import { PlayerProvider, usePlayer } from "./store/PlayerContext";
import { pathForView, sameView, viewFromPath } from "./store/router";
import { AdminProvider } from "./admin/AdminContext";
import { MemoryProvider } from "./memory/MemoryContext";
import { SocialProvider } from "./social/SocialContext";
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
import { Profile } from "./views/Profile";
import { Network } from "./views/Network";
import { SparkStream } from "./views/SparkStream";
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
  | { name: "admin" }
  | { name: "profile"; handle: string }
  | { name: "network" }
  | { name: "stream" };

function Shell() {
  const { state } = usePlayer();
  const [view, setView] = useState<View>(() =>
    typeof window === "undefined" ? { name: "home" } : viewFromPath(window.location.pathname)
  );

  // Browser back / forward and any direct address-bar edit reseats the view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => setView(viewFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (!state.identity) return <SignIn />;
  if (!state.profile) return <Onboarding />;

  const go = (next: View) => {
    setView(next);
    if (typeof window === "undefined") return;
    if (sameView(next, viewFromPath(window.location.pathname))) return;
    window.history.pushState(null, "", pathForView(next));
  };

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
        {view.name === "leaderboard" && <Leaderboard onNav={go} />}
        {view.name === "calibration" && <Calibration onDone={() => go({ name: "home" })} />}
        {view.name === "memory" && <Memory onExit={() => go({ name: "home" })} />}
        {view.name === "profile" && <Profile handle={view.handle} onNav={go} />}
        {view.name === "network" && <Network onNav={go} />}
        {view.name === "stream" && <SparkStream onNav={go} />}
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
          <SocialProvider>
            <Shell />
          </SocialProvider>
        </MemoryProvider>
      </AdminProvider>
    </PlayerProvider>
  );
}
