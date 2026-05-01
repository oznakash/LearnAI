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
import { ErrorBoundary } from "./components/ErrorBoundary";

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
  const { state, hydrated } = usePlayer();
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

  // Suppress first-paint flicker. Until the localStorage hydrate effect
  // runs, `state.identity` is `undefined` and we'd otherwise flash <SignIn />
  // for one frame before re-rendering as the real signed-in user.
  if (!hydrated) return null;
  if (!state.identity) return <SignIn />;
  if (!state.profile) return <Onboarding />;

  const go = (next: View) => {
    setView(next);
    if (typeof window === "undefined") return;
    if (sameView(next, viewFromPath(window.location.pathname))) return;
    window.history.pushState(null, "", pathForView(next));
    // SPA nav should land at the top of the new screen — without this,
    // a long page (e.g. Settings) leaves the next view (e.g. Admin) scrolled
    // partway down. Native back/forward (popstate) is intentionally not
    // affected here so the browser can restore its remembered scroll.
    window.scrollTo({ top: 0, left: 0 });
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
    <ErrorBoundary>
      <PlayerProvider>
        <AdminProvider>
          <MemoryProvider>
            <SocialProvider>
              <Shell />
            </SocialProvider>
          </MemoryProvider>
        </AdminProvider>
      </PlayerProvider>
    </ErrorBoundary>
  );
}
