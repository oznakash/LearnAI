import { OfflineMemoryService } from "./offline";
import { Mem0MemoryService } from "./mem0";
import type { MemoryService } from "./types";

export type { MemoryService, MemoryItem, MemoryStatus, MemoryAddInput, MemoryCategory } from "./types";
export { OfflineMemoryService } from "./offline";
export { Mem0MemoryService } from "./mem0";

export interface SelectMemoryOpts {
  /** Player email; "" or missing → OfflineMemoryService("anon"). */
  userId: string;
  /** mem0 base URL. Empty → degrade to OfflineMemoryService. */
  serverUrl: string;
  /** Bearer for /v1/memories — session JWT in production, admin key in demo. */
  bearerToken?: string;
  /**
   * Per-call kill switch. The MemoryProvider sets this when the player
   * has opted out of the cognition layer (and the admin has allowed
   * per-user opt-out).
   */
  forceOffline?: boolean;
}

/**
 * Resolve the active MemoryService for the given user.
 *
 * **All inputs are explicit args** — this function never reads localStorage
 * or runtime caches. The previous "read from runtime cache" version had
 * a race where MemoryContext's useMemo saw the new React state but the
 * runtime cache hadn't caught up to localStorage yet, so the service
 * silently fell back to OfflineMemoryService and stayed there. The
 * caller (MemoryProvider) now derives every input from React state,
 * which is the single source of truth.
 */
export function selectMemoryService(opts: SelectMemoryOpts): MemoryService {
  const id = (opts.userId ?? "").trim();
  if (!id) return new OfflineMemoryService("anon");
  if (opts.forceOffline) return new OfflineMemoryService(id);
  if (!opts.serverUrl) {
    // Cognition is "on" but no URL is configured — degrade silently.
    return new OfflineMemoryService(id);
  }
  return new Mem0MemoryService({
    serverUrl: opts.serverUrl,
    apiKey: opts.bearerToken,
    userId: id,
  });
}

/** Fail-soft wrapper. Useful inside fire-and-forget event handlers. */
export async function withMemoryGuard<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (typeof console !== "undefined") {
      console.warn("[memory]", (e as Error).message);
    }
    return fallback;
  }
}
