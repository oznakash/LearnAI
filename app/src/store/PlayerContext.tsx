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
  SparkVote,
  Task,
  TopicId,
} from "../types";
import {
  applySparkResult,
  clearForNewIdentity,
  defaultState,
  loadState,
  passBoss,
  recordSession,
  regenFocus,
  saveState,
  type SparkResult,
  voteOnSpark,
  xpForExercise,
} from "./game";
import { evaluateBadges } from "./badges";
import { isSessionExpired, serverSignOut } from "../auth/server";
import { loadRemoteState, mergeRemoteIntoLocal, pickSyncedFields, saveRemoteState } from "./sync";

const SYNC_DEBOUNCE_MS = 1_000;

/** Read mem0 URL straight from admin localStorage. The PlayerContext
 *  doesn't import AdminContext to avoid a provider-cycle dependency. */
function readMem0Url(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("builderquest:admin:v1");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { serverAuth?: { mem0Url?: string } };
    return parsed?.serverAuth?.mem0Url ?? "";
  } catch {
    return "";
  }
}

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
  /**
   * Record (or flip) the user's 👍 / 👎 vote on a Spark. Idempotent on a
   * repeat of the same value; flipping overwrites the prior vote and
   * bumps the timestamp. The optional `reason` is the one-line "why"
   * the user can attach to a 👎.
   *
   * Note: this only writes the vote into PlayerState. The cognition-layer
   * (`MemoryContext.remember`) write on a 👎 is the caller's job (see
   * `views/Play.tsx`) — we keep the Player ↔ Memory boundary clean here.
   */
  voteSpark: (
    sparkId: string,
    vote: SparkVote,
    opts?: { reason?: string; topicId?: TopicId; levelId?: string }
  ) => void;
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
    let loaded = loadState();
    // Drop any expired server session on hydrate so we don't try to call
    // mem0 with a dead JWT. We also wipe progress fields here — once the
    // session has expired we no longer trust *whose* progress this is.
    // Without this wipe, leftover XP / history / sparks from the prior
    // signed-in user would leak to whoever signs in next on this device.
    if (loaded.serverSession && isSessionExpired(loaded.serverSession)) {
      loaded = clearForNewIdentity(loaded);
    }
    dispatch({ type: "init", state: loaded });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState(state);
  }, [state, hydrated]);

  // Cross-device sync: when there's a live server session, debounced PUT
  // /v1/state on every state change. Per-device fields (identity,
  // serverSession, googleClientId, apiKey) are stripped before send.
  // Fire-and-forget — the local save above is the source of truth on this
  // device; the remote write is best-effort.
  useEffect(() => {
    if (!hydrated) return;
    const token = state.serverSession?.token;
    if (!token) return;
    const url = readMem0Url();
    if (!url) return;
    const handle = setTimeout(() => {
      void saveRemoteState(url, token, pickSyncedFields(state));
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [state, hydrated]);

  // Cross-device sync: on hydrate, if there's a live session, fetch the
  // server snapshot and merge over local. Server wins for synced fields,
  // local wins for per-device fields. One-shot; subsequent updates flow
  // through the debounced save effect above.
  useEffect(() => {
    if (!hydrated) return;
    const token = state.serverSession?.token;
    if (!token) return;
    const url = readMem0Url();
    if (!url) return;
    let cancelled = false;
    void loadRemoteState(url, token).then((env) => {
      if (cancelled || !env) return;
      // Skip if the server has nothing yet — preserve local progress.
      if (!env.blob || Object.keys(env.blob).length === 0) return;
      dispatch({
        type: "set",
        mutate: (s) => mergeRemoteIntoLocal(s, env.blob),
      });
    });
    return () => {
      cancelled = true;
    };
    // We deliberately don't depend on `state.serverSession?.token` here:
    // we only want to pull on first hydrate / new sign-in, not on every
    // state mutation. signInWithSession also triggers a fresh load below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, state.serverSession?.token]);

  // periodic focus regen
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: "regen" }), 60_000);
    return () => clearInterval(id);
  }, []);

  const setState = useCallback((mutate: (s: PlayerState) => PlayerState) => {
    dispatch({ type: "set", mutate });
  }, []);

  const signIn: Ctx["signIn"] = useCallback((identity) => {
    const newEmail = identity.email.trim().toLowerCase();
    setState((s) => {
      // Wipe progress whenever (a) the new email differs from the prior
      // identity, OR (b) there is no prior identity — meaning the prior
      // user signed out, or hydrate cleared an expired JWT, leaving
      // their progress stranded in localStorage. In both cases the
      // safe default is "treat the device as a fresh slate." Cross-device
      // sync then restores the new user's own state from the server.
      const prevEmail = s.identity?.email?.trim().toLowerCase();
      const shouldWipe = !prevEmail || prevEmail !== newEmail;
      const base = shouldWipe ? clearForNewIdentity(s) : s;
      return {
        ...base,
        identity: { ...identity, provider: "google" },
      };
    });
  }, [setState]);

  const signInWithSession: Ctx["signInWithSession"] = useCallback(
    (session) => {
      const newEmail = session.email.trim().toLowerCase();
      setState((s) => {
        const prevEmail = s.identity?.email?.trim().toLowerCase();
        const shouldWipe = !prevEmail || prevEmail !== newEmail;
        const base = shouldWipe ? clearForNewIdentity(s) : s;
        return {
          ...base,
          identity: {
            email: session.email,
            name: session.name,
            picture: session.picture,
            provider: "google",
          },
          serverSession: session,
        };
      });
    },
    [setState]
  );

  const signOut: Ctx["signOut"] = useCallback(() => {
    // Snapshot the server-side bits before we mutate so the network call has
    // the URL and token; we don't await it (sessions are stateless JWTs, the
    // client-side discard is the real act of signing out).
    //
    // We also wipe progress fields here (via `clearForNewIdentity`). This is
    // a security boundary, not a UX nicety: without it, a different user
    // signing in on the same device after sign-out would inherit the prior
    // user's XP / history / sparks / tasks, because `signIn` only wipes
    // when there's a prior identity to compare against. Same-user re-sign-in
    // is harmless: the cross-device sync effect restores their state from
    // the server immediately.
    let mem0Url = "";
    let token = "";
    setState((s) => {
      mem0Url = ""; // resolved below from admin config via runtime
      token = s.serverSession?.token ?? "";
      return clearForNewIdentity(s);
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
      // Defense-in-depth: a task tied to a specific Spark
      // (source.sparkId) is unique per player. Repeated `addTask`
      // calls for the same Spark return the existing task instead of
      // creating duplicates. The "+ Task" button in the UI also
      // dedups, but a fast double-click or any future programmatic
      // path can hit this code multiple times before React state
      // settles. This guard makes the second call a no-op.
      let resolved: Task = created;
      setState((s) => {
        if (created.source?.sparkId) {
          const existing = s.tasks.find((t) => t.source?.sparkId === created.source!.sparkId);
          if (existing) {
            resolved = existing;
            return s;
          }
        }
        return { ...s, tasks: [created, ...s.tasks] };
      });
      return resolved;
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

  const voteSpark: Ctx["voteSpark"] = useCallback(
    (sparkId, vote, opts) =>
      setState((s) => voteOnSpark(s, sparkId, vote, opts ?? {})),
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
      voteSpark,
    }),
    [state, setState, signIn, signInWithSession, signOut, setProfile, completeSpark, passBossCb, recordSessionCb, setApiKey, setGoogleClientId, addTask, updateTask, removeTask, voteSpark]
  );

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
