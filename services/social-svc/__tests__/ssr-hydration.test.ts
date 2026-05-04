import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  _resetSpaAssetsCache,
  injectSpaHydration,
  renderNotFoundHtml,
  renderProfileHtml,
} from "../src/ssr.js";
import type { AggregateRecord, ProfileRecord } from "../src/types.js";

/**
 * SPA-hydration regression — entity-wiring audit Issues 4a / 4b / 5.
 *
 * Without this, refreshing on `/u/<handle>` while signed in landed the
 * user on a bare-bones SSR page: no SPA bundle, no TopBar, no follow
 * button, no pushState history. The browser's back button stopped
 * working, the previously-recorded follow looked unset, and the page
 * felt frozen. The fix injects the SPA's hashed bundle tags from
 * `dist/index.html` into every SSR response so React hydrates over
 * the SSR DOM and takes over.
 *
 * Bots that don't run JS still index the SSR content directly, so
 * there's no SEO regression — pinned by `ssr.test.ts`.
 */

const SPA_HTML = `<!doctype html>
<html><head>
  <meta charset="utf-8">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/index-abc123.css">
  <script type="module" src="/assets/index-def456.js"></script>
</head><body><div id="root"></div></body></html>`;

let tmpIndexPath: string;

beforeEach(() => {
  // Write a fake SPA index.html for the helper to read.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ssr-hydration-"));
  tmpIndexPath = path.join(dir, "index.html");
  fs.writeFileSync(tmpIndexPath, SPA_HTML, "utf8");
  process.env.LEARNAI_SPA_INDEX = tmpIndexPath;
  _resetSpaAssetsCache();
});

afterEach(() => {
  delete process.env.LEARNAI_SPA_INDEX;
  _resetSpaAssetsCache();
});

function profile(): ProfileRecord {
  return {
    email: "danshtr@gmail.com",
    handle: "danshtr",
    displayFirst: "Danshtr",
    ageBand: "adult",
    profileMode: "open",
    showFullName: true,
    showCurrent: true,
    showMap: true,
    showActivity: true,
    showBadges: true,
    showSignup: true,
    signalsGlobal: true,
    signals: [],
    banned: false,
    bannedSocial: false,
    createdAt: 1_730_000_000_000,
    updatedAt: 1_730_000_000_000,
  };
}

function aggregate(): AggregateRecord {
  return {
    email: "danshtr@gmail.com",
    xpTotal: 70,
    streak: 1,
    guildTier: "Builder",
    totalSparks: 3,
    badges: [],
    activity14d: [],
    topicXp: {},
    updatedAt: 1_730_000_000_000,
  };
}

describe("SSR profile page injects SPA bundle for hydration", () => {
  it("includes the SPA's hashed JS module script before </body>", () => {
    const html = renderProfileHtml({ profile: profile(), aggregate: aggregate() });
    expect(html).toContain('type="module"');
    expect(html).toContain("/assets/index-def456.js");
    // And it lives BEFORE the closing body tag, not after.
    const jsAt = html.indexOf("/assets/index-def456.js");
    const bodyCloseAt = html.indexOf("</body>");
    expect(jsAt).toBeGreaterThan(0);
    expect(jsAt).toBeLessThan(bodyCloseAt);
  });

  it("includes the SPA's hashed CSS link in <head>", () => {
    const html = renderProfileHtml({ profile: profile(), aggregate: aggregate() });
    expect(html).toContain("/assets/index-abc123.css");
    const cssAt = html.indexOf("/assets/index-abc123.css");
    const headCloseAt = html.indexOf("</head>");
    expect(cssAt).toBeLessThan(headCloseAt);
  });

  it('wraps the SSR body content in <div id="root"> so React can mount', () => {
    const html = renderProfileHtml({ profile: profile(), aggregate: aggregate() });
    expect(html).toMatch(/<body[^>]*>\s*<div id="root">/);
    expect(html).toMatch(/<\/div>\s*<script[^>]*type="module"[\s\S]*?<\/body>/);
  });

  it("preserves the existing SSR content inside #root (bots still see real keywords)", () => {
    const html = renderProfileHtml({ profile: profile(), aggregate: aggregate() });
    expect(html).toContain("@danshtr");
    expect(html).toContain("Danshtr");
    expect(html).toContain('rel="canonical"');
    expect(html).toContain("application/ld+json");
  });

  it("not-found page also gets the bundle so a 404 → SPA navigation works", () => {
    const html = renderNotFoundHtml("nobody", "https://learnai.cloud-claude.com");
    expect(html).toContain("/assets/index-def456.js");
    expect(html).toContain('<div id="root">');
  });
});

describe("SSR is a no-op when the SPA index.html is missing", () => {
  it("falls back to the bare SSR shape when LEARNAI_SPA_INDEX points at nothing", () => {
    process.env.LEARNAI_SPA_INDEX = "/tmp/does-not-exist-XXX.html";
    _resetSpaAssetsCache();
    const html = renderProfileHtml({ profile: profile(), aggregate: aggregate() });
    // No bundle injected, but the #root wrap still happens so the SPA
    // could be loaded later via a different mechanism.
    expect(html).not.toContain("/assets/");
    expect(html).toContain('<div id="root">');
  });
});

describe("injectSpaHydration is idempotent", () => {
  it("doesn't double-wrap #root if called twice", () => {
    const assets = { cssTags: '<link rel="stylesheet" href="/assets/x.css">', jsTags: '<script type="module" src="/assets/x.js"></script>' };
    const once = injectSpaHydration(
      `<!doctype html><html><head></head><body>hi</body></html>`,
      assets,
    );
    const twice = injectSpaHydration(once, assets);
    // Exactly one #root div.
    const rootMatches = twice.match(/<div id="root"/g) ?? [];
    expect(rootMatches.length).toBe(1);
    // Exactly one bundle script.
    const scriptMatches = twice.match(/\/assets\/x\.js/g) ?? [];
    expect(scriptMatches.length).toBe(1);
    // Exactly one CSS link.
    const cssMatches = twice.match(/\/assets\/x\.css/g) ?? [];
    expect(cssMatches.length).toBe(1);
  });
});
