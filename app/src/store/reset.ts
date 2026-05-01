import { STORAGE_KEY } from "./game";
import { ADMIN_STORAGE_KEY } from "../admin/store";

const USER_SCOPED_PREFIXES = [
  "builderquest:memory:offline:",
  "learnai:social:offline:",
];

/**
 * Removes player state, admin config, and every per-user offline-memory /
 * offline-social blob from localStorage. Keep this aligned with new storage
 * keys as they are added — anything user-scoped that should not survive an
 * "Erase all local data" click must be enumerated in USER_SCOPED_PREFIXES.
 */
export function eraseAllLocalData(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (USER_SCOPED_PREFIXES.some((p) => key.startsWith(p))) toRemove.push(key);
    }
    for (const key of toRemove) window.localStorage.removeItem(key);
  } catch {
    // ignore — reload will give the user a clean slate either way
  }
}
