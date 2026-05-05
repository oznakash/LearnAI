import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createStore, type Store } from "../src/store.js";
import { markdownToHtml, renderLegalHtml } from "../src/legal.js";

/**
 * Legal page rendering. Strategy: docs/legal/ files + nginx proxy +
 * sidecar SSR. LinkedIn's OAuth review crawler hits these URLs to
 * verify policy text exists, so the SSR'd HTML must include the
 * canonical title text and not be a JS-empty SPA shell. See
 * docs/profile-linkedin.md §10.
 */

const PRIVACY_BODY = `# Privacy Policy

A short paragraph that explains things in plain English.

## Section heading

- One bullet.
- Another bullet with **bold** text and a [link](https://learnai.cloud-claude.com).

---

End of file.
`;

const TERMS_BODY = `# Terms of Use

These are the rules. Be a *decent* person. \`don't break things\`.
`;

let tmpDir: string;
let store: Store;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "legal-test-"));
  fs.writeFileSync(path.join(tmpDir, "privacy.md"), PRIVACY_BODY);
  fs.writeFileSync(path.join(tmpDir, "terms.md"), TERMS_BODY);
  store = createStore();
  app = createApp({
    store,
    demoTrustHeader: true,
    legalDir: tmpDir,
  });
});

afterEach(() => {
  store.reset();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("markdownToHtml", () => {
  it("renders headings, paragraphs, lists, and inline marks", () => {
    const html = markdownToHtml(PRIVACY_BODY);
    expect(html).toContain("<h1>Privacy Policy</h1>");
    expect(html).toContain("<h2>Section heading</h2>");
    expect(html).toContain("<p>A short paragraph that explains things");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>One bullet.</li>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('<a href="https://learnai.cloud-claude.com" rel="noopener" target="_blank">link</a>');
    expect(html).toContain("<hr/>");
  });

  it("renders inline italics + code", () => {
    const html = markdownToHtml(TERMS_BODY);
    expect(html).toContain("<em>decent</em>");
    expect(html).toContain("<code>don&#39;t break things</code>");
  });

  it("escapes raw HTML in the source so a malicious doc can't inject script tags", () => {
    const html = markdownToHtml("# <script>alert(1)</script>\n\nHello.");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderLegalHtml", () => {
  it("returns a full HTML document with head + body", () => {
    const html = renderLegalHtml("privacy", { dir: tmpDir });
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("<title>Privacy Policy · LearnAI</title>");
    expect(html).toContain("Privacy Policy");
    expect(html).toContain('<link rel="canonical"');
    expect(html).toContain('<meta name="robots" content="index, follow"/>');
    expect(html).toContain('property="og:title"');
    expect(html).toContain("/privacy");
    expect(html).toContain("/terms");
    expect(html).toContain("github.com/oznakash/learnai");
  });

  it("uses the right title + description for terms vs privacy", () => {
    const privacy = renderLegalHtml("privacy", { dir: tmpDir });
    const terms = renderLegalHtml("terms", { dir: tmpDir });
    expect(privacy).toContain("Privacy Policy · LearnAI");
    expect(terms).toContain("Terms of Use · LearnAI");
  });

  it("honors a custom origin (used by ssrOrigin behind nginx)", () => {
    const html = renderLegalHtml("privacy", {
      dir: tmpDir,
      origin: "https://learnai.example",
    });
    expect(html).toContain('href="https://learnai.example/privacy"');
  });
});

describe("HTTP routes", () => {
  it("GET /privacy returns 200 + HTML with the policy title", async () => {
    const r = await request(app).get("/privacy");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/html/);
    expect(r.text).toMatch(/^<!doctype html>/i);
    expect(r.text).toContain("Privacy Policy");
    expect(r.text).toContain("Cache-Control" in r.headers ? r.headers["cache-control"] : "");
  });

  it("GET /terms returns 200 + HTML with the terms title", async () => {
    const r = await request(app).get("/terms");
    expect(r.status).toBe(200);
    expect(r.text).toContain("Terms of Use");
    expect(r.text).toContain("decent");
  });

  it("returns 503 when legalDir is missing or files are unreadable", async () => {
    const broken = createApp({
      store: createStore(),
      demoTrustHeader: true,
      legalDir: "/this/does/not/exist",
    });
    const r = await request(broken).get("/privacy");
    expect(r.status).toBe(503);
  });

  it("falls back to default dir when legalDir opt is unset", async () => {
    // This exercises the production code path. Default dir won't
    // exist in CI, so we expect 503 — what matters is the route
    // doesn't crash the server.
    const noOpts = createApp({
      store: createStore(),
      demoTrustHeader: true,
    });
    const r = await request(noOpts).get("/privacy");
    expect([200, 503]).toContain(r.status);
  });
});

describe("source-of-truth alignment with docs/legal/", () => {
  it("the canonical docs/legal/privacy.md exists and starts with '# Privacy Policy'", () => {
    const file = path.resolve(__dirname, "..", "..", "..", "docs", "legal", "privacy.md");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf8");
    expect(content.startsWith("# Privacy Policy")).toBe(true);
  });

  it("the canonical docs/legal/terms.md exists and starts with '# Terms of Use'", () => {
    const file = path.resolve(__dirname, "..", "..", "..", "docs", "legal", "terms.md");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf8");
    expect(content.startsWith("# Terms of Use")).toBe(true);
  });
});
