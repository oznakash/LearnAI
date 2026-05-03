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
// Bumped from 2 KB so inline `data:image/*;base64,…` URLs (the
// offline-mode upload preview) survive the length cap. A 256×256
// JPEG at q≈80 is ~30 KB raw → ~40 KB base64; cap at 1 MB to keep
// localStorage from blowing up if a fork starts uploading 4K images.
const PICTURE_URL_MAX = 1_048_576;

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
/**
 * Inline data URLs are permitted ONLY for the three raster image
 * formats. SVG is rejected (it's an XSS surface — `<svg>` parses as
 * markup and can carry `<script>` or `onload` handlers). Used by the
 * offline service to keep `<img src=...>` working without a server
 * round-trip when the user crops a profile picture / hero in-app.
 */
const DATA_IMAGE_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function safePictureUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.length > PICTURE_URL_MAX) return undefined;
  // Inline image data URLs (offline upload preview).
  if (trimmed.startsWith("data:")) {
    return DATA_IMAGE_RE.test(trimmed) ? trimmed : undefined;
  }
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

// ---- Extended profile metadata sanitizers (PR #111) -----------------------

const BIO_MAX = 160;
const PRONOUNS_MAX = 30;
const LOCATION_MAX = 60;
const LINK_URL_MAX = 2048;

/**
 * Bio: ≤160 chars (one sentence), no HTML, no control chars. Same NFKC +
 * format-char strip as fullName, plus a defensive HTML-tag check.
 */
export function safeBio(raw?: string | null): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  let s = String(raw).normalize("NFKC");
  s = stripFormatChars(s);
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  if (/<\s*\/?\s*[a-z]/i.test(s)) return undefined;
  if (s.length > BIO_MAX) s = s.slice(0, BIO_MAX);
  return s;
}

export function safePronouns(raw?: string | null): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  let s = String(raw).normalize("NFKC");
  s = stripFormatChars(s);
  s = s.trim();
  if (!s) return undefined;
  if (/<|>|"/.test(s)) return undefined;
  if (s.length > PRONOUNS_MAX) s = s.slice(0, PRONOUNS_MAX);
  return s;
}

export function safeLocation(raw?: string | null): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  let s = String(raw).normalize("NFKC");
  s = stripFormatChars(s);
  s = s.trim();
  if (!s) return undefined;
  if (/<|>|"/.test(s)) return undefined;
  if (s.length > LOCATION_MAX) s = s.slice(0, LOCATION_MAX);
  return s;
}

/** Hero / banner image — same rules as `safePictureUrl` (https only, ≤2 KB). */
export function safeHeroUrl(raw?: string | null): string | undefined {
  return safePictureUrl(raw);
}

export type LinkKind = "linkedin" | "github" | "twitter" | "website";

const LINK_HOST_RULES: Record<LinkKind, (host: string, path: string) => boolean> = {
  linkedin: (h, p) =>
    (h === "linkedin.com" || h === "www.linkedin.com") &&
    /^\/(in|company|pub|school)\//i.test(p),
  github: (h) => h === "github.com" || h === "www.github.com",
  twitter: (h) =>
    h === "x.com" || h === "www.x.com" || h === "twitter.com" || h === "www.twitter.com",
  website: () => true,
};

/**
 * Validates and normalizes one external profile link.
 * - Must be https.
 * - Per-kind host whitelist (LinkedIn, GitHub, X/Twitter — anything for website).
 * - Strips query + fragment so saved values are clean (no UTM tags leaking
 *   into share previews / JSON-LD sameAs).
 * Returns `undefined` for anything that fails validation; never throws.
 */
export function safeLink(raw: string | null | undefined, kind: LinkKind): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;
  if (trimmed.length > LINK_URL_MAX) return undefined;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:") return undefined;
  const host = u.hostname.toLowerCase();
  if (!LINK_HOST_RULES[kind](host, u.pathname)) return undefined;
  // Drop trailing slash; drop query + fragment.
  const path = u.pathname.replace(/\/+$/, "") || "/";
  return `${u.protocol}//${host}${path}`;
}
