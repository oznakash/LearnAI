// Server-side image storage for user-uploaded avatars + hero banners.
//
// Why this lives in social-svc and not on a CDN: the operator asked
// for upload + crop NOW, before the CDN sprint ships. The volume
// mounted at `/data` (where the JSON-file persistence lives) has
// plenty of room for a few KB per user, so we land uploads alongside
// the social store. nginx serves them as static files via
// `location /i/ { alias /data/uploads/; ... }` — same origin, no
// CORS, no extra service.
//
// When the CDN sprint ships, the swap is one module: replace the
// `saveImage` body to PUT to S3/Cloudflare and return the CDN URL;
// the rest of the codebase reads the URL from `pictureUrl` /
// `heroUrl` unchanged.
//
// Privacy + safety:
//   - Auth-gated: only the user themselves can write their own files
//     (the route handler uses `requireUser`).
//   - Hard byte cap (raw): 1 MB. Anything larger → 413.
//   - MIME-sniffed from the magic bytes (NOT the client-claimed
//     content-type), only `image/jpeg`, `image/png`, and `image/webp`
//     are accepted. SVG is explicitly refused (XSS surface).
//   - Filenames are deterministic per (user, kind) so a fresh upload
//     overwrites the previous file — no orphaned bytes accumulating
//     across edits.
//   - The on-disk path uses `emailHash` (the same SHA-256-derived
//     value used in logs), never raw email, so `ls /data/uploads`
//     leaks no PII.

import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

export type ImageKind = "avatar" | "hero";

export interface SaveOpts {
  /** Server-side root for uploads. Falls back to `/data/uploads`. */
  uploadsRoot?: string;
  /** Origin used to build the public URL. Falls back to learnai. */
  origin?: string;
  /** Email of the owner (lowercased). Used to derive the per-user dir. */
  email: string;
  /** Which slot. `avatar` → square, `hero` → wide banner. */
  kind: ImageKind;
  /** Raw bytes (already base64-decoded by the caller). */
  bytes: Uint8Array;
  /**
   * Client-claimed mime, used as a hint only — we cross-check by
   * sniffing the magic bytes and refuse if they disagree.
   */
  claimedMime?: string;
}

export interface SaveResult {
  /** Same-origin URL — served by nginx via `location /i/`. */
  url: string;
  /** Resolved on-disk file path. Useful in tests. */
  filePath: string;
  /** Sniffed MIME type. */
  mime: string;
  /** Bytes written. */
  bytes: number;
}

/** 1 MB max raw body. Anything larger → caller should 413. */
export const MAX_BYTES = 1_048_576;

const ALLOWED: Record<string, { ext: string; magic: (b: Uint8Array) => boolean }> = {
  "image/jpeg": {
    ext: "jpg",
    // FF D8 FF
    magic: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  "image/png": {
    ext: "png",
    // 89 50 4E 47 0D 0A 1A 0A
    magic: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  "image/webp": {
    ext: "webp",
    // RIFF....WEBP
    magic: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
};

export class UploadError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Hash an email to a 12-char hex string for the on-disk path. Never
 * a security boundary — just a non-PII directory name. SHA-256 +
 * truncate is fine; collisions are vanishingly unlikely at this scale
 * and the email is recoverable from the ProfileRecord anyway.
 */
export function emailDir(email: string): string {
  const h = createHash("sha256").update(email.toLowerCase()).digest("hex");
  return h.slice(0, 12);
}

/**
 * Sniff MIME type from the magic bytes. Returns null if the buffer
 * doesn't match any allowed image format.
 */
export function sniffMime(bytes: Uint8Array): string | null {
  for (const [mime, { magic }] of Object.entries(ALLOWED)) {
    if (magic(bytes)) return mime;
  }
  return null;
}

/**
 * Decode a `data:image/...;base64,...` URI to raw bytes + claimed mime.
 * Callers MUST cross-check the claimed MIME against `sniffMime`.
 */
export function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; claimedMime: string } | null {
  const m = /^data:([\w/+.\-]+);base64,(.*)$/.exec(dataUrl.trim());
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[2], "base64");
    return { bytes: new Uint8Array(bytes), claimedMime: m[1].toLowerCase() };
  } catch {
    return null;
  }
}

export function saveImage(opts: SaveOpts): SaveResult {
  const root = opts.uploadsRoot || "/data/uploads";
  const origin = opts.origin || "https://learnai.cloud-claude.com";
  const email = (opts.email || "").trim().toLowerCase();
  if (!email) throw new UploadError(400, "missing_email");

  if (opts.bytes.length === 0) throw new UploadError(400, "empty_image");
  if (opts.bytes.length > MAX_BYTES) {
    throw new UploadError(413, `payload_too_large_max_${MAX_BYTES}_bytes`);
  }

  const mime = sniffMime(opts.bytes);
  if (!mime) {
    throw new UploadError(415, "unsupported_image_format_use_jpeg_png_or_webp");
  }
  if (
    opts.claimedMime &&
    opts.claimedMime !== mime &&
    // Allow the claim to be missing or generic, but if they claim a
    // specific format that disagrees with the magic bytes, refuse.
    /^image\//.test(opts.claimedMime)
  ) {
    throw new UploadError(415, "claimed_mime_mismatch");
  }
  const ext = ALLOWED[mime].ext;

  const dir = path.join(root, emailDir(email));
  fs.mkdirSync(dir, { recursive: true });

  // Deterministic filename per (user, kind). A new upload overwrites
  // the previous file — no orphans, no manual cleanup.
  const filePath = path.join(dir, `${opts.kind}.${ext}`);

  // If the user previously uploaded a different format (e.g. jpeg →
  // png), purge the stale extension so it doesn't survive.
  for (const otherExt of ["jpg", "png", "webp"]) {
    if (otherExt === ext) continue;
    const stale = path.join(dir, `${opts.kind}.${otherExt}`);
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }

  fs.writeFileSync(filePath, opts.bytes);

  // Cache-buster in the URL so a re-upload invalidates downstream
  // caches (Slack, Twitter, browser disk cache). The `?v=<ts>` is
  // ignored by `safeUrl` (which only checks the scheme).
  const v = Date.now().toString(36);
  const url = `${origin}/i/${emailDir(email)}/${opts.kind}.${ext}?v=${v}`;

  return { url, filePath, mime, bytes: opts.bytes.length };
}
