/**
 * Defensive sanitizers for owner-supplied social fields.
 *
 * Anything that flows back into a public profile (pictureUrl, fullName) or
 * the public handle namespace passes through here. The functions are
 * idempotent and safe to call on output too — the offline service applies
 * them on both write and read so old data with bad values can't poison the
 * UI.
 */

/**
 * Handles that no user may register or display under, regardless of email
 * local-part. The list is intentionally narrow — it covers system-y names
 * and obvious impersonation targets, not general profanity.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
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

const FULLNAME_MAX = 64;
const PICTURE_URL_MAX = 2048;

/**
 * Returns the input URL only if it's a syntactically valid `https:` URL.
 * Falls through to `undefined` for anything else: data:, javascript:, http:,
 * blob:, file:, garbage strings, or strings longer than 2 KB.
 *
 * Why this matters: pictureUrl renders into <img src="..."> on every viewer
 * of /u/<handle>. Without scheme validation, an owner can set their picture
 * to an attacker-controlled URL and turn every profile-view into a tracking
 * pixel that leaks IP, UA, and Referer to a third party.
 */
export function safePictureUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.length > PICTURE_URL_MAX) return undefined;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/**
 * Strips control characters, RTL overrides, zero-width and BOM codepoints,
 * NFKC-normalizes, trims, and caps length. Returns `undefined` if the
 * cleaned value is empty.
 *
 * Used for fullName and any other free-text owner-supplied display field.
 * Without this, an owner can paste a 5000-char zero-width string that
 * breaks every card layout that renders their name.
 */
const STRIP_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x001f], // C0 controls
  [0x007f, 0x009f], // DEL + C1 controls
  [0x200b, 0x200f], // zero-width + LRM/RLM
  [0x2028, 0x2029], // line / paragraph separators
  [0x202a, 0x202e], // bidi embedding / overrides
  [0x2066, 0x2069], // bidi isolates
  [0xfeff, 0xfeff], // BOM / zero-width no-break space
];

function stripFormatChars(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    let drop = false;
    for (const [lo, hi] of STRIP_RANGES) {
      if (cp >= lo && cp <= hi) {
        drop = true;
        break;
      }
    }
    if (!drop) out += ch;
  }
  return out;
}

export function safeDisplayName(raw?: string | null): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  let s = String(raw).normalize("NFKC");
  s = stripFormatChars(s);
  s = s.trim();
  if (!s) return undefined;
  if (s.length > FULLNAME_MAX) s = s.slice(0, FULLNAME_MAX);
  return s;
}

/** True if the candidate is in the reserved list (case-insensitive). */
export function isReservedHandle(candidate: string): boolean {
  return RESERVED_HANDLES.has(candidate.toLowerCase());
}
