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
      }),
    [email, ageBandIsKid, config.flags.socialEnabled, serverUrl, bearerToken],
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
