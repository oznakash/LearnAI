import { OfflineMemoryService } from "./offline";
import { Mem0MemoryService } from "./mem0";
import type { MemoryService } from "./types";
import { getRuntimeMemoryConfig, isOfflineMode } from "../admin/runtime";

export type { MemoryService, MemoryItem, MemoryStatus, MemoryAddInput, MemoryCategory } from "./types";
export { OfflineMemoryService } from "./offline";
export { Mem0MemoryService } from "./mem0";

/**
 * Resolve the active MemoryService for the given user. The choice is made
 * fresh on every call so the offline-flag toggle takes effect immediately
 * without a reload.
 */
export function selectMemoryService(userId: string | undefined | null): MemoryService {
  const id = (userId ?? "").trim();
  if (!id) return new OfflineMemoryService("anon");
  if (isOfflineMode()) return new OfflineMemoryService(id);
  const cfg = getRuntimeMemoryConfig();
  if (!cfg.serverUrl) {
    // Cognition is "on" but nothing is configured — degrade.
    return new OfflineMemoryService(id);
  }
  return new Mem0MemoryService({
    serverUrl: cfg.serverUrl,
    apiKey: cfg.apiKey,
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
