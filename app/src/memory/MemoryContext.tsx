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
import { usePlayer } from "../store/PlayerContext";
import { useAdmin } from "../admin/AdminContext";
import {
  selectMemoryService,
  withMemoryGuard,
  type MemoryAddInput,
  type MemoryItem,
  type MemoryService,
  type MemoryStatus,
} from "./index";

type Backend = MemoryStatus["backend"];

interface Ctx {
  service: MemoryService;
  backend: Backend;
  status: MemoryStatus | null;
  /** Fire-and-forget add. Never throws; errors are logged. */
  remember(input: MemoryAddInput): Promise<MemoryItem | null>;
  /** Fire-and-forget search. Returns [] on error. */
  recall(query: string, opts?: { topK?: number; category?: MemoryItem["category"] }): Promise<MemoryItem[]>;
  list(opts?: { category?: MemoryItem["category"]; limit?: number }): Promise<MemoryItem[]>;
  update(id: string, patch: Partial<Pick<MemoryItem, "text" | "metadata" | "category">>): Promise<MemoryItem | null>;
  forget(id: string): Promise<void>;
  wipe(): Promise<void>;
  refreshHealth(): Promise<void>;
}

const MemoryCtx = createContext<Ctx | null>(null);

export function MemoryProvider({ children }: { children: ReactNode }) {
  const { state: player } = usePlayer();
  const { config: adminCfg } = useAdmin();

  // Cognition is on by default for everyone. The player can only opt
  // out when the admin has flipped `flags.memoryPlayerOptIn` on.
  const userOptedOut = !!(adminCfg.flags.memoryPlayerOptIn && player.memoryOptOut);

  // Production server-auth: bearer is the player's session JWT, URL is
  // the operator's mem0. Demo / fallback: legacy memoryConfig fields.
  const isProduction = adminCfg.serverAuth.mode === "production";
  const serverUrl = isProduction
    ? adminCfg.serverAuth.mem0Url || adminCfg.memoryConfig.serverUrl
    : adminCfg.memoryConfig.serverUrl;
  const bearerToken = isProduction
    ? player.serverSession?.token
    : adminCfg.memoryConfig.apiKey;

  const userId = player.identity?.email ?? "";
  const service = useMemo(
    () =>
      selectMemoryService({
        userId,
        serverUrl,
        bearerToken,
        forceOffline: userOptedOut,
      }),
    [userId, serverUrl, bearerToken, userOptedOut]
  );
  const serviceRef = useRef(service);
  useEffect(() => {
    serviceRef.current = service;
  }, [service]);

  const [status, setStatus] = useState<MemoryStatus | null>(null);

  // Backend label is derived from the live service, not from a stale
  // localStorage cache (the source of the original race-condition bug).
  const fallbackBackend: Backend = userOptedOut || !serverUrl ? "offline" : "mem0";

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

  const remember = useCallback(
    (input: MemoryAddInput) =>
      withMemoryGuard(async () => serviceRef.current.add(input), null),
    []
  );

  const recall = useCallback(
    (query: string, opts?: { topK?: number; category?: MemoryItem["category"] }) =>
      withMemoryGuard(async () => serviceRef.current.search(query, opts), [] as MemoryItem[]),
    []
  );

  const list = useCallback(
    (opts?: { category?: MemoryItem["category"]; limit?: number }) =>
      withMemoryGuard(async () => serviceRef.current.list(opts), [] as MemoryItem[]),
    []
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<MemoryItem, "text" | "metadata" | "category">>) =>
      withMemoryGuard(async () => serviceRef.current.update(id, patch), null),
    []
  );

  const forget = useCallback(async (id: string) => {
    await withMemoryGuard(async () => serviceRef.current.forget(id), undefined);
  }, []);

  const wipe = useCallback(async () => {
    await withMemoryGuard(async () => serviceRef.current.wipe(), undefined);
  }, []);

  const backend: Backend = status?.backend ?? fallbackBackend;

  const value = useMemo<Ctx>(
    () => ({ service, backend, status, remember, recall, list, update, forget, wipe, refreshHealth }),
    [service, backend, status, remember, recall, list, update, forget, wipe, refreshHealth]
  );

  return <MemoryCtx.Provider value={value}>{children}</MemoryCtx.Provider>;
}

export function useMemory() {
  const ctx = useContext(MemoryCtx);
  if (!ctx) throw new Error("useMemory must be used inside MemoryProvider");
  return ctx;
}
