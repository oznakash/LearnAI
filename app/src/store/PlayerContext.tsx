import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type {
  PlayerProfile,
  PlayerState,
  ServerSessionState,
  Spark,
  SessionRecord,
  Task,
  TopicId,
} from "../types";
import {
  applySparkResult,
  defaultState,
  loadState,
  passBoss,
  recordSession,
  regenFocus,
  saveState,
  type SparkResult,
  xpForExercise,
} from "./game";
import { evaluateBadges } from "./badges";
import { isSessionExpired, serverSignOut } from "../auth/server";

type Action =
  | { type: "init"; state: PlayerState }
  | { type: "set"; mutate: (s: PlayerState) => PlayerState }
  | { type: "regen" };

function reducer(state: PlayerState, action: Action): PlayerState {
  switch (action.type) {
    case "init":
      return action.state;
    case "set":
      return action.mutate(state);
    case "regen":
      return regenFocus(state);
  }
}

interface Ctx {
  state: PlayerState;
  setState: (mutate: (s: PlayerState) => PlayerState) => void;
  signIn: (
    identity: { email: string; name?: string; picture?: string; sub?: string }
  ) => void;
  signInWithSession: (session: ServerSessionState) => void;
  signOut: () => void;
  setProfile: (p: PlayerProfile) => void;
  completeSpark: (
    topicId: TopicId,
    levelId: string,
    spark: Spark,
    correct: boolean
  ) => { result: SparkResult; newBadges: ReturnType<typeof evaluateBadges> };
  passBoss: (levelId: string) => void;
  recordSession: (rec: SessionRecord) => void;
  setApiKey: (key: string, provider?: "anthropic" | "openai") => void;
  setGoogleClientId: (clientId: string) => void;
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt" | "status"> & { status?: Task["status"] }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
}

const PlayerCtx = createContext<Ctx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState());
  // Tracks whether the hydrate-from-localStorage effect has run.
  // The save effect MUST be gated on this — otherwise on first mount it
  // fires once with the (still default) state and clobbers whatever's in
  // localStorage before the hydrate dispatch is processed. Concretely:
  // saved googleClientId / apiKey / profile gets wiped on every refresh
  // until the next state change writes them back. Under StrictMode the
  // second invocation re-reads the now-wiped storage and the wipe sticks.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadState();
    // Drop any expired server session on hydrate so we don't try to call
    // mem0 with a dead JWT. The user falls back to the sign-in screen.
    if (loaded.serverSession && isSessionExpired(loaded.serverSession)) {
      loaded.serverSession = undefined;
      loaded.identity = undefined;
    }
    dispatch({ type: "init", state: loaded });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  // periodic focus regen
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "regen" }), 60_000);
    return () => clearInterval(id);
  }, []);

  const setState = useCallback((mutate: (s: PlayerState) => PlayerState) => {
    dispatch({ type: "set", mutate });
  }, []);

  const signIn: Ctx["signIn"] = useCallback((identity) => {
    setState((s) => ({
      ...s,
      identity: { ...identity, provider: "google" },
    }));
  }, [setState]);

  const signInWithSession: Ctx["signInWithSession"] = useCallback(
    (session) => {
      setState((s) => ({
        ...s,
        identity: {
          email: session.email,
          name: session.name,
          picture: session.picture,
          provider: "google",
        },
        serverSession: session,
      }));
    },
    [setState]
  );

  const signOut: Ctx["signOut"] = useCallback(() => {
    // Snapshot the server-side bits before we mutate so the network call has
    // the URL and token; we don't await it (sessions are stateless JWTs, the
    // client-side discard is the real act of signing out).
    let mem0Url = "";
    let token = "";
    setState((s) => {
      mem0Url = ""; // resolved below from admin config via runtime
      token = s.serverSession?.token ?? "";
      return { ...s, identity: undefined, serverSession: undefined };
    });
    // Ask the server to acknowledge the signout (best effort).
    if (token) {
      try {
        // Read mem0 URL lazily to avoid an admin-context import cycle.
        const adminRaw =
          typeof window !== "undefined"
            ? window.localStorage.getItem("builderquest:admin:v1")
            : null;
        if (adminRaw) {
          const parsed = JSON.parse(adminRaw);
          mem0Url = parsed?.serverAuth?.mem0Url ?? "";
        }
      } catch {
        /* ignore */
      }
      if (mem0Url) void serverSignOut(mem0Url, token);
    }
  }, [setState]);

  const setProfile: Ctx["setProfile"] = useCallback(
    (p) => setState((s) => ({ ...s, profile: p })),
    [setState]
  );

  const completeSpark: Ctx["completeSpark"] = useCallback(
    (topicId, levelId, spark, correct) => {
      const award = xpForExercise(spark.exercise, correct);
      const result: SparkResult = {
        sparkId: spark.id,
        correct,
        awardedXP: award,
      };
      let newBadges: ReturnType<typeof evaluateBadges> = [];
      setState((s) => {
        const next = applySparkResult(s, topicId, levelId, result);
        newBadges = evaluateBadges(next);
        return {
          ...next,
          badges: [...next.badges, ...newBadges.map((b) => b.id)],
        };
      });
      return { result, newBadges };
    },
    [setState]
  );

  const passBossCb: Ctx["passBoss"] = useCallback(
    (levelId) => setState((s) => passBoss(s, levelId)),
    [setState]
  );

  const recordSessionCb: Ctx["recordSession"] = useCallback(
    (rec) => setState((s) => recordSession(s, rec)),
    [setState]
  );

  const setApiKey: Ctx["setApiKey"] = useCallback(
    (key, provider = "anthropic") =>
      setState((s) => ({ ...s, apiKey: key, apiProvider: provider })),
    [setState]
  );

  const setGoogleClientId: Ctx["setGoogleClientId"] = useCallback(
    (clientId) => setState((s) => ({ ...s, googleClientId: clientId })),
    [setState]
  );

  const addTask: Ctx["addTask"] = useCallback(
    (task) => {
      const now = Date.now();
      const created: Task = {
        id: `t-${now}-${Math.random().toString(36).slice(2, 7)}`,
        status: "todo",
        createdAt: now,
        updatedAt: now,
        ...task,
      };
      setState((s) => ({ ...s, tasks: [created, ...s.tasks] }));
      return created;
    },
    [setState]
  );

  const updateTask: Ctx["updateTask"] = useCallback(
    (id, patch) =>
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
        ),
      })),
    [setState]
  );

  const removeTask: Ctx["removeTask"] = useCallback(
    (id) => setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),
    [setState]
  );

  const value = useMemo<Ctx>(
    () => ({
      state,
      setState,
      signIn,
      signInWithSession,
      signOut,
      setProfile,
      completeSpark,
      passBoss: passBossCb,
      recordSession: recordSessionCb,
      setApiKey,
      setGoogleClientId,
      addTask,
      updateTask,
      removeTask,
    }),
    [state, setState, signIn, signInWithSession, signOut, setProfile, completeSpark, passBossCb, recordSessionCb, setApiKey, setGoogleClientId, addTask, updateTask, removeTask]
  );

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
