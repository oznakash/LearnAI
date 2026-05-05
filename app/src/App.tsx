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
import { Unsubscribe } from "./views/Unsubscribe";
import { Legal, type LegalKind } from "./views/Legal";

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
  | { name: "stream" }
  | { name: "unsubscribe" }
  | { name: "legal"; kind: LegalKind };

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
  if (view.name === "unsubscribe") return <Unsubscribe />;

  // Public profile (`/u/<handle>`) is the one route an anonymous visitor
  // can land on without bouncing through sign-in — that's the contract
  // for SEO + share-link unfurls + recruiter / collaborator drive-bys.
  // The hard SSR version is served by social-svc at the same URL on a
  // cold load (nginx routes `/u/*` there); this branch covers the case
  // where a signed-in user signs out while parked on a profile, or any
  // SPA-internal navigation that lands on a profile without identity.
  // `/privacy` + `/terms` are also public — required for LinkedIn's
  // OAuth review submission and for cold-link visitors reading the legal
  // docs before signing in.
  const isPublicView = view.name === "profile" || view.name === "legal";

  if (!isPublicView && !state.identity) return <SignIn />;
  if (!isPublicView && state.identity && !state.profile) return <Onboarding />;

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

  const isAnonymous = !state.identity;

  return (
    <div className="min-h-screen flex flex-col">
      {isAnonymous ? <AnonymousHeader onNav={go} /> : <TopBar onNav={go} />}
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
        {view.name === "legal" && <Legal kind={view.kind} />}
      </main>
      {!isAnonymous && <TabBar view={view} onNav={go} />}
      <LegalFooter onNav={go} />
    </div>
  );
}

/**
 * Site-wide legal footer. Visible at the bottom of every screen.
 * Required by the LinkedIn OAuth review submission (must surface
 * privacy + terms reachably from anywhere on the app) and also a basic
 * trust signal for everyone else. Sits *below* the TabBar's
 * `pb-28` zone so signed-in users don't see it overlapping the bar;
 * anonymous users get it visible at the bottom of the page.
 */
function LegalFooter({ onNav }: { onNav: (v: View) => void }) {
  return (
    <footer
      className="w-full border-t border-white/5 mt-auto pb-32 sm:pb-28"
      data-testid="legal-footer"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/40">
        <span className="text-white/50 font-semibold">LearnAI</span>
        <a
          href="/privacy"
          onClick={(e) => {
            e.preventDefault();
            onNav({ name: "legal", kind: "privacy" });
          }}
          className="hover:text-white"
        >
          Privacy
        </a>
        <a
          href="/terms"
          onClick={(e) => {
            e.preventDefault();
            onNav({ name: "legal", kind: "terms" });
          }}
          className="hover:text-white"
        >
          Terms
        </a>
        <a
          href="https://github.com/oznakash/learnai"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white"
        >
          Source
        </a>
        <span className="ml-auto text-white/30 text-[10px]">
          © {new Date().getFullYear()} LearnAI
        </span>
      </div>
    </footer>
  );
}

/**
 * Stripped-down header for the anonymous /u/<handle> case. Drops the
 * TopBar's XP / streak / focus pills (which assume signed-in state) in
 * favor of a brand mark + a "Sign in" CTA that routes back to home — which
 * the gate then renders as <SignIn />.
 */
function AnonymousHeader({ onNav }: { onNav: (v: View) => void }) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-ink/70 border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNav({ name: "home" });
          }}
          className="flex items-center gap-2 hover:opacity-90"
        >
          <div className="w-9 h-9 rounded-xl grid place-items-center text-white font-bold shadow-glow bg-gradient-to-br from-accent to-accent2">
            🚀
          </div>
          <div className="hidden sm:block">
            <div className="font-display font-bold text-white leading-none">LearnAI</div>
            <div className="text-[11px] uppercase tracking-wider text-white/40 leading-none mt-0.5">
              The AI-native learning network
            </div>
          </div>
        </a>
        <button className="btn-primary text-sm" onClick={() => onNav({ name: "home" })}>
          Sign in to start
        </button>
      </div>
    </header>
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
