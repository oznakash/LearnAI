import { OfflineMemoryService } from "./offline";
import { Mem0MemoryService } from "./mem0";
import type { MemoryService } from "./types";
import { getRuntimeMemoryConfig, isOfflineMode } from "../admin/runtime";

export type { MemoryService, MemoryItem, MemoryStatus, MemoryAddInput, MemoryCategory } from "./types";
export { OfflineMemoryService } from "./offline";
export { Mem0MemoryService } from "./mem0";

export interface SelectMemoryOverrides {
  /** Production server-auth: the player's session JWT, sourced from React state. */
  bearerToken?: string;
}

/**
 * Resolve the active MemoryService for the given user. The choice is made
 * fresh on every call so the offline-flag toggle takes effect immediately
 * without a reload.
 *
 * `overrides.bearerToken` (when provided) wins over the admin-config
 * `apiKey`. Callers in production server-auth mode pass the player's
 * session JWT here instead of reading it from localStorage, so the service
 * is constructed with the correct bearer in the same React render that
 * produced the new session.
 */
export function selectMemoryService(
  userId: string | undefined | null,
  overrides: SelectMemoryOverrides = {}
): MemoryService {
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
    apiKey: overrides.bearerToken || cfg.apiKey,
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
