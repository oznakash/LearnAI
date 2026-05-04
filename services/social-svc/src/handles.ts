// Handle generation + display-name helpers. Mirrors
// app/src/social/handles.ts and app/src/social/sanitize.ts. Kept
// duplicated so the service compiles independently. Both sides must
// stay in sync — the SPA-side test cross-reads this file in CI to
// catch drift.

const MAX_LEN = 24;

/**
 * Handles that no user may register under, regardless of email local-part.
 * Mirrors `RESERVED_HANDLES` in `app/src/social/sanitize.ts`. Without
 * skipping these here, an email like `admin@gmail.com` would auto-create
 * with handle `admin` server-side, then the SPA would refuse to render it
 * as `isValidHandle("admin") === false`. Public-profile + leaderboard rows
 * would silently break for that user.
 */
const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "root",
  "mod",
  "moderator",
  "staff",
  "support",
  "help",
  "system",
  "sysop",
  "sudo",
  "learnai",
  "learn-ai",
  "builderquest",
  "claude",
  "claude_official",
  "anthropic",
  "openai",
  "gpt",
  "mem0",
]);

function isReservedHandle(h: string): boolean {
  return RESERVED_HANDLES.has(h.toLowerCase());
}

export function baseHandleFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").toLowerCase().replace(/\./g, "");
  let out = "";
  for (const ch of local) {
    if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ch === "_" || ch === "-") out += ch;
    else if (out && out[out.length - 1] !== "-") out += "-";
  }
  out = out.replace(/[-_]{2,}/g, "-");
  out = out.replace(/^[-_]+|[-_]+$/g, "");
  if (out.length > MAX_LEN) out = out.slice(0, MAX_LEN);
  if (!out) out = "user";
  return out;
}

/**
 * Pick a free handle by trying `base`, `base2`, ..., up to 9999. Skips
 * reserved handles AND clamps the suffixed candidate to MAX_LEN so we
 * never emit a handle longer than the SPA's `isValidHandle` would accept.
 * Mirrors the SPA-side disambiguator (`app/src/social/handles.ts`) — the
 * cross-service parity test pins this contract.
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

export function firstNameFrom(fullName: string | undefined, email: string): string {
  const n = (fullName ?? "").trim();
  if (n) {
    const first = n.split(/\s+/)[0];
    if (first) return first;
  }
  const base = baseHandleFromEmail(email);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function resolveDisplayName(opts: {
  fullName?: string;
  showFullName: boolean;
  email: string;
}): string {
  if (opts.showFullName && opts.fullName?.trim()) return opts.fullName.trim();
  return firstNameFrom(opts.fullName, opts.email);
}
