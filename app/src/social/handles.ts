/**
 * Handle generation + display-name helpers.
 *
 * A handle is the public identifier in URLs (`/u/<handle>`) and on
 * leaderboards / stream cards. It's derived from the local-part of the
 * player's Gmail, lowercased and disambiguated when needed. Immutable in
 * MVP — we may allow a one-time rename later.
 */

import { isReservedHandle } from "./sanitize";

const MAX_LEN = 24;
const VALID = /^[a-z0-9_-]+$/;

/**
 * Strip the local part of a Gmail to a URL-safe base handle. Drops the
 * Gmail dot-insensitivity (`m.aya@…` and `maya@…` collide on purpose).
 *
 *   - lowercase
 *   - allow `[a-z0-9_-]`; collapse runs of `_` or `-`
 *   - trim leading/trailing `_` `-`
 *   - cap to 24 chars
 *   - if result is empty, fall back to `user`
 */
export function baseHandleFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").toLowerCase().replace(/\./g, "");
  let out = "";
  for (const ch of local) {
    if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ch === "_" || ch === "-") out += ch;
    else if (out && out[out.length - 1] !== "-") out += "-";
  }
  // collapse runs of separators
  out = out.replace(/[-_]{2,}/g, "-");
  // trim leading/trailing separators
  out = out.replace(/^[-_]+|[-_]+$/g, "");
  if (out.length > MAX_LEN) out = out.slice(0, MAX_LEN);
  if (!out) out = "user";
  return out;
}

/**
 * Pick a free handle by trying `base`, `base2`, `base3`, ... up to 9999.
 * Reserved handles (admin, claude_official, …) are skipped at every step.
 * Suffixes are clamped so the candidate never exceeds MAX_LEN.
 * Returns null if everything is taken (caller can escalate).
 */
export function disambiguateHandle(
  base: string,
  isTaken: (candidate: string) => boolean,
): string | null {
  if (!isTaken(base) && !isReservedHandle(base)) return base;
  for (let n = 2; n <= 9999; n++) {
    const suffix = String(n);
    const trimmedBase =
      base.length + suffix.length > MAX_LEN
        ? base.slice(0, MAX_LEN - suffix.length)
        : base;
    const candidate = `${trimmedBase}${suffix}`;
    if (!isTaken(candidate) && !isReservedHandle(candidate)) return candidate;
  }
  return null;
}

/** True if `h` is a syntactically valid handle (post-disambiguation). */
export function isValidHandle(h: string): boolean {
  if (!h) return false;
  if (h.length < 1 || h.length > MAX_LEN) return false;
  if (!VALID.test(h)) return false;
  if (h.startsWith("-") || h.startsWith("_")) return false;
  if (h.endsWith("-") || h.endsWith("_")) return false;
  if (isReservedHandle(h)) return false;
  return true;
}

/** First-name only — the default safe display name. */
export function firstNameFrom(fullName: string | undefined, email: string): string {
  const n = (fullName ?? "").trim();
  if (n) {
    const first = n.split(/\s+/)[0];
    if (first) return first;
  }
  // Fallback: capitalize the base handle.
  const base = baseHandleFromEmail(email);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Resolve the display name a viewer should see.
 *
 *  - if `showFullName` is true and a `fullName` is stored, return it
 *  - else return the first name only
 */
export function resolveDisplayName(opts: {
  fullName?: string;
  showFullName: boolean;
  email: string;
}): string {
  const first = firstNameFrom(opts.fullName, opts.email);
  if (opts.showFullName && opts.fullName?.trim()) return opts.fullName.trim();
  return first;
}
