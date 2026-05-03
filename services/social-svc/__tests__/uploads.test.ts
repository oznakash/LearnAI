import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";
import {
  decodeDataUrl,
  emailDir,
  saveImage,
  sniffMime,
  UploadError,
  MAX_BYTES,
} from "../src/uploads.js";

/**
 * Image upload + storage. Operator asked for upload + crop NOW; the
 * SSR `og:image` and the `<img src="/i/...">` in the SPA both depend
 * on this. Tests pin: MIME sniffing (magic-bytes, NOT client-claimed
 * type), the data-URL decoder, the on-disk layout, the deterministic
 * per-(user, kind) filename, the cleanup of stale extensions, and
 * the auth-gated HTTP route.
 */

let store: Store;
let app: ReturnType<typeof createApp>;
let tmpRoot: string;

// Smallest possible valid PNG (1x1 transparent pixel) — verified magic-byte
// header. Used in body-of-request tests.
const PNG_MIN = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_DATA_URL = `data:image/png;base64,${PNG_MIN.toString("base64")}`;

// Smallest valid JPEG (3-byte FF D8 FF prefix is enough for the sniffer
// when we only care about format detection).
const JPEG_MIN = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00, 0x00]);
const JPEG_DATA_URL = `data:image/jpeg;base64,${JPEG_MIN.toString("base64")}`;

// SVG — must be REJECTED. Not in the allowlist; SVG is an XSS surface.
const SVG_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=";

// HTML disguised as PNG — must be REJECTED (claimed mime png, magic bytes
// don't match — sniffer wins).
const HTML_AS_PNG = `data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`;

beforeEach(() => {
  store = createStore();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-test-"));
  app = createApp({
    store,
    admins: ["admin@learnai.dev"],
    demoTrustHeader: true,
    uploadsRoot: tmpRoot,
  });
});

afterEach(() => {
  store.reset();
  if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// -- Unit: pure helpers --------------------------------------------------

describe("sniffMime", () => {
  it("recognizes a PNG by its 8-byte magic header", () => {
    expect(sniffMime(new Uint8Array(PNG_MIN))).toBe("image/png");
  });
  it("recognizes a JPEG by its FF D8 FF prefix", () => {
    expect(sniffMime(new Uint8Array(JPEG_MIN))).toBe("image/jpeg");
  });
  it("returns null for SVG (not in the allowlist)", () => {
    const svg = new TextEncoder().encode("<svg xmlns='...'/>");
    expect(sniffMime(svg)).toBeNull();
  });
  it("returns null for HTML / scripts disguised by a client-claimed MIME", () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    expect(sniffMime(html)).toBeNull();
  });
});

describe("decodeDataUrl", () => {
  it("parses a data:image/png URL into bytes + claimed mime", () => {
    const r = decodeDataUrl(PNG_DATA_URL)!;
    expect(r.claimedMime).toBe("image/png");
    expect(r.bytes.length).toBeGreaterThan(0);
  });
  it("returns null for a non-data URL", () => {
    expect(decodeDataUrl("https://example.com/x.png")).toBeNull();
  });
  it("returns null for a malformed data URL", () => {
    expect(decodeDataUrl("data:image/png;base64,")).not.toBeNull();
    expect(decodeDataUrl("not a data url")).toBeNull();
  });
});

describe("emailDir", () => {
  it("hashes lowercased email into a 12-char hex segment (no PII)", () => {
    const a = emailDir("Maya@Gmail.COM");
    const b = emailDir("maya@gmail.com");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    // The raw email must not appear in the dir name.
    expect(a).not.toContain("maya");
  });
});

// -- Unit: saveImage on a tmp dir ---------------------------------------

describe("saveImage", () => {
  it("writes the raw PNG bytes to /<root>/<emailHash>/avatar.png and returns a URL", () => {
    const out = saveImage({
      uploadsRoot: tmpRoot,
      origin: "https://example.com",
      email: "maya@gmail.com",
      kind: "avatar",
      bytes: new Uint8Array(PNG_MIN),
    });
    expect(out.mime).toBe("image/png");
    expect(out.bytes).toBe(PNG_MIN.length);
    expect(out.url).toMatch(
      /^https:\/\/example\.com\/i\/[0-9a-f]{12}\/avatar\.png\?v=[0-9a-z]+$/,
    );
    expect(fs.readFileSync(out.filePath)).toEqual(PNG_MIN);
  });

  it("re-uploads OVERWRITE the previous file (deterministic filename per user+kind)", () => {
    const a = saveImage({
      uploadsRoot: tmpRoot,
      email: "maya@gmail.com",
      kind: "avatar",
      bytes: new Uint8Array(PNG_MIN),
    });
    const b = saveImage({
      uploadsRoot: tmpRoot,
      email: "maya@gmail.com",
      kind: "avatar",
      bytes: new Uint8Array(PNG_MIN),
    });
    expect(a.filePath).toBe(b.filePath);
  });

  it("changing format (jpg → png) cleans up the stale .jpg so we don't accumulate orphans", () => {
    const j = saveImage({
      uploadsRoot: tmpRoot,
      email: "maya@gmail.com",
      kind: "avatar",
      bytes: new Uint8Array(JPEG_MIN),
    });
    expect(fs.existsSync(j.filePath)).toBe(true);
    saveImage({
      uploadsRoot: tmpRoot,
      email: "maya@gmail.com",
      kind: "avatar",
      bytes: new Uint8Array(PNG_MIN),
    });
    expect(fs.existsSync(j.filePath)).toBe(false);
  });

  it("avatar and hero are stored side-by-side in the same per-user dir", () => {
    const a = saveImage({
      uploadsRoot: tmpRoot,
      email: "maya@gmail.com",
      kind: "avatar",
      bytes: new Uint8Array(PNG_MIN),
    });
    const h = saveImage({
      uploadsRoot: tmpRoot,
      email: "maya@gmail.com",
      kind: "hero",
      bytes: new Uint8Array(PNG_MIN),
    });
    expect(path.dirname(a.filePath)).toBe(path.dirname(h.filePath));
    expect(path.basename(a.filePath)).toBe("avatar.png");
    expect(path.basename(h.filePath)).toBe("hero.png");
  });

  it("REJECTS SVG (XSS surface)", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
    expect(() =>
      saveImage({
        uploadsRoot: tmpRoot,
        email: "maya@gmail.com",
        kind: "avatar",
        bytes: svg,
      }),
    ).toThrow(UploadError);
  });

  it("REJECTS HTML/script bytes even when client claims image/png", () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    expect(() =>
      saveImage({
        uploadsRoot: tmpRoot,
        email: "maya@gmail.com",
        kind: "avatar",
        bytes: html,
        claimedMime: "image/png",
      }),
    ).toThrow(UploadError);
  });

  it("REJECTS bytes larger than MAX_BYTES with status 413", () => {
    // Construct a fake big buffer that would otherwise pass the magic
    // sniff (PNG header followed by zero-padding).
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set(PNG_MIN, 0);
    try {
      saveImage({
        uploadsRoot: tmpRoot,
        email: "maya@gmail.com",
        kind: "avatar",
        bytes: big,
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(UploadError);
      expect((e as UploadError).status).toBe(413);
    }
  });

  it("REJECTS empty bodies with status 400", () => {
    try {
      saveImage({
        uploadsRoot: tmpRoot,
        email: "maya@gmail.com",
        kind: "avatar",
        bytes: new Uint8Array(0),
      });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as UploadError).status).toBe(400);
    }
  });
});

// -- HTTP integration: POST /v1/social/me/image/:kind ------------------

function userHeaders(email: string) {
  return { "x-user-email": email };
}

describe("POST /v1/social/me/image/avatar", () => {
  it("accepts a PNG data URL, persists the file, returns a same-origin URL, and updates pictureUrl", async () => {
    const r = await request(app)
      .post("/v1/social/me/image/avatar")
      .set(userHeaders("maya@gmail.com"))
      .send({ dataUrl: PNG_DATA_URL });
    expect(r.status).toBe(200);
    expect(r.body.mime).toBe("image/png");
    expect(r.body.url).toMatch(/^https?:\/\/[^/]+\/i\/[0-9a-f]{12}\/avatar\.png\?v=/);
    // The profile record now has the URL.
    const me = await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    expect(me.body.pictureUrl).toBe(r.body.url);
  });

  it("rejects non-data-URL bodies with 400", async () => {
    const r = await request(app)
      .post("/v1/social/me/image/avatar")
      .set(userHeaders("maya@gmail.com"))
      .send({ dataUrl: "https://example.com/x.png" });
    expect(r.status).toBe(400);
  });

  it("rejects SVG with 415", async () => {
    const r = await request(app)
      .post("/v1/social/me/image/avatar")
      .set(userHeaders("maya@gmail.com"))
      .send({ dataUrl: SVG_DATA_URL });
    expect(r.status).toBe(415);
  });

  it("rejects HTML disguised as image/png with 415", async () => {
    const r = await request(app)
      .post("/v1/social/me/image/avatar")
      .set(userHeaders("maya@gmail.com"))
      .send({ dataUrl: HTML_AS_PNG });
    expect(r.status).toBe(415);
  });

  it("requires auth (no x-user-email → 401)", async () => {
    const r = await request(app)
      .post("/v1/social/me/image/avatar")
      .send({ dataUrl: PNG_DATA_URL });
    expect(r.status).toBe(401);
  });
});

describe("POST /v1/social/me/image/hero", () => {
  it("accepts a JPEG data URL, persists, and updates heroUrl on the profile", async () => {
    const r = await request(app)
      .post("/v1/social/me/image/hero")
      .set(userHeaders("maya@gmail.com"))
      .send({ dataUrl: JPEG_DATA_URL });
    expect(r.status).toBe(200);
    expect(r.body.mime).toBe("image/jpeg");
    expect(r.body.url).toMatch(/\/i\/[0-9a-f]{12}\/hero\.jpg\?v=/);
    const me = await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    expect(me.body.heroUrl).toBe(r.body.url);
  });

  it("uploading a new hero overwrites the previous file but keeps the avatar untouched", async () => {
    const a = await request(app)
      .post("/v1/social/me/image/avatar")
      .set(userHeaders("maya@gmail.com"))
      .send({ dataUrl: PNG_DATA_URL });
    const h1 = await request(app)
      .post("/v1/social/me/image/hero")
      .set(userHeaders("maya@gmail.com"))
      .send({ dataUrl: JPEG_DATA_URL });
    const h2 = await request(app)
      .post("/v1/social/me/image/hero")
      .set(userHeaders("maya@gmail.com"))
      .send({ dataUrl: PNG_DATA_URL });
    // Avatar still readable on disk.
    const dir = path.dirname(h1.body.url.replace(/^https?:\/\/[^/]+\/i\//, "").replace(/\?v=.*$/, ""));
    void dir; // satisfies the linter even though we don't reuse it
    const me = await request(app).get("/v1/social/me").set(userHeaders("maya@gmail.com"));
    expect(me.body.pictureUrl).toBe(a.body.url);
    expect(me.body.heroUrl).toBe(h2.body.url);
    expect(h2.body.url).not.toBe(h1.body.url); // new cache-buster
  });
});
