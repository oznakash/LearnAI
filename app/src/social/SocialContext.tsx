import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAdmin } from "../admin/AdminContext";
import { usePlayer } from "../store/PlayerContext";
import { selectSocialService, withSocialGuard } from "./index";
import { buildSnapshot, snapshotSignature } from "./snapshot";
import type { PlayerState } from "../types";
import type {
  BoardPeriod,
  BoardScope,
  FollowEdge,
  PlayerSnapshot,
  ProfilePatch,
  PublicProfile,
  ReportReason,
  SocialService,
  SocialStatus,
  StreamCard,
} from "./types";
import type { TopicId } from "../types";

/**
 * SocialProvider — single React context that exposes a `SocialService`
 * (offline or online), a status object, and a small set of fail-soft
 * helpers. Mirrors `MemoryProvider`.
 *
 * Resolution rules live in `selectSocialService(...)`. The provider just
 * keeps the inputs in sync with React state, refreshes the health probe,
 * and wraps every call in `withSocialGuard()` so the UI never throws on
 * a network blip.
 */

interface Ctx {
  service: SocialService;
  backend: "offline" | "online";
  status: SocialStatus | null;
  /** Fire-and-forget health refresh. */
  refreshHealth(): Promise<void>;
  /** All write helpers swallow errors and return a sensible fallback. */
  follow(handle: string): Promise<FollowEdge | null>;
  unfollow(handle: string): Promise<void>;
  block(handle: string): Promise<void>;
  unblock(email: string): Promise<void>;
  setMuted(handle: string, muted: boolean): Promise<void>;
  report(handle: string, reason: ReportReason, note?: string, ctx?: Record<string, unknown>): Promise<void>;
  approveFollowRequest(email: string): Promise<void>;
  declineFollowRequest(email: string): Promise<void>;
  cancelMyPendingRequest(handle: string): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<PublicProfile | null>;
  setSignals(topics: TopicId[]): Promise<TopicId[]>;
  pushSnapshot(snapshot: PlayerSnapshot): Promise<void>;
  // Read helpers that fall back to safe sentinels.
  getMyProfile(): Promise<PublicProfile | null>;
  getProfile(handle: string): Promise<PublicProfile | null>;
  listFollowing(opts?: { status?: import("./types").FollowStatus }): Promise<FollowEdge[]>;
  listFollowers(opts?: { status?: import("./types").FollowStatus }): Promise<FollowEdge[]>;
  listPendingIncoming(): Promise<FollowEdge[]>;
  listPendingOutgoing(): Promise<FollowEdge[]>;
  listBlocked(): Promise<string[]>;
  getBoard(scope: BoardScope, period: BoardPeriod): Promise<PublicProfile[]>;
  getStream(opts?: { limit?: number; before?: number }): Promise<StreamCard[]>;
}

const SocialCtx = createContext<Ctx | null>(null);

export function SocialProvider({ children }: { children: ReactNode }) {
  const { state: player } = usePlayer();
  const { config } = useAdmin();

  const email = player.identity?.email ?? "";
  const ageBandIsKid = player.profile?.ageBand === "kid";
  // Identity-sync: pass the live Google identity through to the offline
  // service so the public profile auto-syncs to the latest name + picture
  // until the user explicitly customizes it. Without this, a freshly
  // signed-in user's `/u/<handle>` shows email-derived initials instead
  // of their actual Google avatar — the bug fixed here.
  const identityName = player.identity?.name ?? "";
  const identityPicture = player.identity?.picture ?? "";

  // Operator-level public-profile defaults from /admin → Public Profile.
  // Applied only when a fresh user's offline state is created — existing
  // users keep their saved Network-view toggles untouched.
  const ppDefaults = config.socialConfig.publicProfile;
  const profileDefaults = useMemo(
    () => ({
      defaultProfileMode: ppDefaults.defaultProfileMode,
      showFullName: ppDefaults.defaults.showFullName,
      showCurrent: ppDefaults.defaults.showCurrent,
      showMap: ppDefaults.defaults.showMap,
      showActivity: ppDefaults.defaults.showActivity,
      showBadges: ppDefaults.defaults.showBadges,
      showSignup: ppDefaults.defaults.showSignup,
      signalsGlobal: ppDefaults.defaults.signalsGlobal,
    }),
    [
      ppDefaults.defaultProfileMode,
      ppDefaults.defaults.showFullName,
      ppDefaults.defaults.showCurrent,
      ppDefaults.defaults.showMap,
      ppDefaults.defaults.showActivity,
      ppDefaults.defaults.showBadges,
      ppDefaults.defaults.showSignup,
      ppDefaults.defaults.signalsGlobal,
    ],
  );

  // Socials live behind the same server-auth shape as memories. In
  // production we point at the social-svc URL via the upstream proxy; in
  // demo / fork mode the operator can configure their own URL. For now
  // (PR 1) we only have `socialConfig.serverUrl` — the proxy URL lands
  // in PR 8.
  const serverUrl = config.socialConfig.serverUrl;
  const bearerToken =
    config.serverAuth.mode === "production"
      ? player.serverSession?.token
      : config.socialConfig.apiKey;

  const service = useMemo(
    () =>
      selectSocialService({
        email,
        ageBandIsKid,
        socialEnabled: !!config.flags.socialEnabled,
        serverUrl,
        bearerToken,
        identityName,
        identityPicture,
        profileDefaults,
      }),
    [
      email,
      ageBandIsKid,
      config.flags.socialEnabled,
      serverUrl,
      bearerToken,
      identityName,
      identityPicture,
      profileDefaults,
    ],
  );

  // Keep a ref so callbacks don't capture a stale service after a flag
  // flip. Update the ref *synchronously* during render — not in a
  // useEffect — because child useEffects fire before parent useEffects
  // in React updates, and a stale ref at that moment causes children
  // (e.g. the Network view's refresh) to call the previous service and
  // get pre-flip data.
  const serviceRef = useRef(service);
  serviceRef.current = service;

  const [status, setStatus] = useState<SocialStatus | null>(null);

  const fallbackBackend: "offline" | "online" =
    config.flags.socialEnabled && serverUrl ? "online" : "offline";

  const refreshHealth = useCallback(async () => {
    try {
      const s = await serviceRef.current.health();
      setStatus(s);
    } catch (e) {
      setStatus({ ok: false, backend: fallbackBackend, reason: (e as Error).message });
    }
  }, [fallbackBackend]);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth, service]);

  // ---- identity sync to the online social server ------------------------
  // PR #94 fixed the offline projection: when the user has no explicit
  // fullName / pictureUrl set, the offline service falls back to the
  // values from `player.identity`. The online server has no such
  // fallback — its `pictureUrl` field stays empty until *something*
  // calls `updateProfile`. Without a push, the SSR public profile's
  // `og:image` falls back to the brand default, social-link unfurls
  // never show the user's real avatar, and the "Hey {name}" copy is
  // missing on every signed-in screen the operator hasn't manually
  // edited.
  //
  // Strategy: track the last-pushed identity values per email in a
  // ref; whenever they change (new sign-in, new Google name / avatar),
  // fire a single fire-and-forget `updateProfile` patch carrying the
  // delta. `withSocialGuard` swallows network blips; the server's
  // PUT /v1/social/me is idempotent.
  const lastPushedIdentityRef = useRef<{
    email?: string;
    name?: string;
    picture?: string;
  }>({});
  useEffect(() => {
    const id = player.identity;
    if (!id?.email) {
      lastPushedIdentityRef.current = {};
      return;
    }
    const last = lastPushedIdentityRef.current;
    if (
      last.email === id.email &&
      last.name === id.name &&
      last.picture === id.picture
    ) {
      return;
    }
    lastPushedIdentityRef.current = {
      email: id.email,
      name: id.name,
      picture: id.picture,
    };
    const patch: ProfilePatch = {};
    if (id.name && id.name.trim()) patch.fullName = id.name.trim();
    if (id.picture && id.picture.trim()) patch.pictureUrl = id.picture.trim();
    if (Object.keys(patch).length === 0) return;
    void withSocialGuard(() => serviceRef.current.updateProfile(patch), null);
  }, [player.identity?.email, player.identity?.name, player.identity?.picture]);

  // ---- snapshot pipeline (P0-1 fix) -------------------------------------
  // Watch player state. After hydrate, every meaningful state change
  // diffs prev → next via buildSnapshot and fires a fire-and-forget
  // pushSnapshot. Wrapped in withSocialGuard so a network blip never
  // throws into the UI; events carry stable clientIds so server-side
  // upsert is idempotent across StrictMode double-fires.
  //
  // P1 dedup: PlayerContext's 60s focus-regen tick produces a new state
  // ref on every minute regardless of whether anything actually changed,
  // which used to fire a no-op pushSnapshot every minute per signed-in
  // tab. On the server side this generated a 1/min "req" log and — for
  // any tab whose local XP had drifted below the server aggregate —
  // a 409 "implausible_xp" response per minute. Skip pushes whose
  // aggregate signature matches the last-pushed signature AND carry
  // no new stream events. Events always force a send because each new
  // event row is the entire reason that batch exists.
  const prevPlayerRef = useRef<PlayerState | null>(null);
  const lastPushedSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!player.identity?.email) return;
    const snap = buildSnapshot({ prev: prevPlayerRef.current, next: player });
    prevPlayerRef.current = player;
    if (!snap) return;
    const sig = snapshotSignature(snap);
    if (sig === lastPushedSignatureRef.current && snap.events.length === 0) {
      return;
    }
    lastPushedSignatureRef.current = sig;
    void withSocialGuard(() => serviceRef.current.pushSnapshot(snap), undefined);
  }, [player]);

  // ---- write helpers -----------------------------------------------------
  const follow = useCallback(
    (h: string) => withSocialGuard(() => serviceRef.current.follow(h), null),
    [],
  );
  const unfollow = useCallback(async (h: string) => {
    await withSocialGuard(() => serviceRef.current.unfollow(h), undefined);
  }, []);
  const block = useCallback(async (h: string) => {
    await withSocialGuard(() => serviceRef.current.block(h), undefined);
  }, []);
  const unblock = useCallback(async (e: string) => {
    await withSocialGuard(() => serviceRef.current.unblock(e), undefined);
  }, []);
  const setMuted = useCallback(async (h: string, muted: boolean) => {
    await withSocialGuard(() => serviceRef.current.setMuted(h, muted), undefined);
  }, []);
  const report = useCallback(
    async (h: string, reason: ReportReason, note?: string, ctx?: Record<string, unknown>) => {
      await withSocialGuard(() => serviceRef.current.report(h, reason, note, ctx), undefined);
    },
    [],
  );
  const approveFollowRequest = useCallback(async (e: string) => {
    await withSocialGuard(() => serviceRef.current.approveFollowRequest(e), undefined);
  }, []);
  const declineFollowRequest = useCallback(async (e: string) => {
    await withSocialGuard(() => serviceRef.current.declineFollowRequest(e), undefined);
  }, []);
  const cancelMyPendingRequest = useCallback(async (h: string) => {
    await withSocialGuard(() => serviceRef.current.cancelMyPendingRequest(h), undefined);
  }, []);
  const updateProfile = useCallback(
    (patch: ProfilePatch) => withSocialGuard(() => serviceRef.current.updateProfile(patch), null),
    [],
  );
  const setSignals = useCallback(
    (topics: TopicId[]) =>
      withSocialGuard(() => serviceRef.current.setSignals(topics), [] as TopicId[]),
    [],
  );
  const pushSnapshot = useCallback(async (snapshot: PlayerSnapshot) => {
    await withSocialGuard(() => serviceRef.current.pushSnapshot(snapshot), undefined);
  }, []);

  // ---- read helpers ------------------------------------------------------
  const getMyProfile = useCallback(
    () => withSocialGuard(() => serviceRef.current.getMyProfile(), null),
    [],
  );
  const getProfile = useCallback(
    (h: string) => withSocialGuard(() => serviceRef.current.getProfile(h), null),
    [],
  );
  const listFollowing = useCallback(
    (opts?: { status?: import("./types").FollowStatus }) =>
      withSocialGuard(() => serviceRef.current.listFollowing(opts), [] as FollowEdge[]),
    [],
  );
  const listFollowers = useCallback(
    (opts?: { status?: import("./types").FollowStatus }) =>
      withSocialGuard(() => serviceRef.current.listFollowers(opts), [] as FollowEdge[]),
    [],
  );
  const listPendingIncoming = useCallback(
    () => withSocialGuard(() => serviceRef.current.listPendingIncoming(), [] as FollowEdge[]),
    [],
  );
  const listPendingOutgoing = useCallback(
    () => withSocialGuard(() => serviceRef.current.listPendingOutgoing(), [] as FollowEdge[]),
    [],
  );
  const listBlocked = useCallback(
    () => withSocialGuard(() => serviceRef.current.listBlocked(), [] as string[]),
    [],
  );
  const getBoard = useCallback(
    (scope: BoardScope, period: BoardPeriod) =>
      withSocialGuard(() => serviceRef.current.getBoard(scope, period), [] as PublicProfile[]),
    [],
  );
  const getStream = useCallback(
    (opts?: { limit?: number; before?: number }) =>
      withSocialGuard(() => serviceRef.current.getStream(opts), [] as StreamCard[]),
    [],
  );

  const backend: "offline" | "online" = status?.backend ?? fallbackBackend;

  const value = useMemo<Ctx>(
    () => ({
      service,
      backend,
      status,
      refreshHealth,
      follow,
      unfollow,
      block,
      unblock,
      setMuted,
      report,
      approveFollowRequest,
      declineFollowRequest,
      cancelMyPendingRequest,
      updateProfile,
      setSignals,
      pushSnapshot,
      getMyProfile,
      getProfile,
      listFollowing,
      listFollowers,
      listPendingIncoming,
      listPendingOutgoing,
      listBlocked,
      getBoard,
      getStream,
    }),
    [
      service,
      backend,
      status,
      refreshHealth,
      follow,
      unfollow,
      block,
      unblock,
      setMuted,
      report,
      approveFollowRequest,
      declineFollowRequest,
      cancelMyPendingRequest,
      updateProfile,
      setSignals,
      pushSnapshot,
      getMyProfile,
      getProfile,
      listFollowing,
      listFollowers,
      listPendingIncoming,
      listPendingOutgoing,
      listBlocked,
      getBoard,
      getStream,
    ],
  );

  return <SocialCtx.Provider value={value}>{children}</SocialCtx.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialCtx);
  if (!ctx) throw new Error("useSocial must be used inside SocialProvider");
  return ctx;
}
