// Legal pages (Privacy Policy + Terms of Use) — server-side rendering.
//
// Source-of-truth lives in `docs/legal/{privacy,terms}.md`. The SPA
// imports those via Vite's `?raw` for the in-app view; the sidecar
// loads the same files at startup from the `legalDir` (production:
// `/opt/social-svc/legal`, copied in by the Dockerfile) and renders
// them as full HTML pages.
//
// LinkedIn's OAuth app-review crawler hits these URLs as part of
// approving "Sign In with LinkedIn using OpenID Connect" — so they
// need to return real HTML with the policy text, not a JS-empty SPA
// shell. Search-engine indexing and Slack / Twitter unfurls also benefit.
//
// Renderer scope: only the markdown subset our two docs actually use
// (h1 / h2 / h3 · paragraphs · - bullets · --- hr · **bold** · *italic*
// · `code` · [text](url)). No markdown library — input is the repo,
// output is read-only, ~80 lines of code is plenty.

import * as fs from "node:fs";
import * as path from "node:path";

export type LegalKind = "privacy" | "terms";

const DEFAULT_LEGAL_DIR = "/opt/social-svc/legal";

const TITLES: Record<LegalKind, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Use",
};

const DESCRIPTIONS: Record<LegalKind, string> = {
  privacy:
    "How LearnAI handles your data on learnai.cloud-claude.com. Plain English, three questions, no dark patterns.",
  terms:
    "Terms of use for LearnAI on learnai.cloud-claude.com. Be a decent person, don't break things — the deal in plain English.",
};

/** Resolve the absolute path to a legal MD file. */
export function legalFilePath(kind: LegalKind, dir = DEFAULT_LEGAL_DIR): string {
  return path.join(dir, `${kind}.md`);
}

/** Read raw markdown for a given doc. Throws if the file is missing. */
export function loadLegalMarkdown(kind: LegalKind, dir = DEFAULT_LEGAL_DIR): string {
  return fs.readFileSync(legalFilePath(kind, dir), "utf8");
}

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Render the inline markdown of a single line to HTML. */
function renderInline(text: string): string {
  let out = escape(text);
  // `code`
  out = out.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  // [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const u = String(url);
    const isExternal = /^https?:\/\//.test(u);
    const safeUrl = u.replace(/"/g, "%22");
    return `<a href="${safeUrl}"${isExternal ? ' rel="noopener" target="_blank"' : ""}>${label}</a>`;
  });
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // *italic* / _italic_
  out = out.replace(
    /(^|[\s(\-])\*([^*\n]+)\*(?=[\s.,;:!?)\-]|$)/g,
    (_m, pre, body) => `${pre}<em>${body}</em>`,
  );
  out = out.replace(
    /(^|[\s(\-])_([^_\n]+)_(?=[\s.,;:!?)\-]|$)/g,
    (_m, pre, body) => `${pre}<em>${body}</em>`,
  );
  return out;
}

/**
 * Convert a small markdown subset to HTML. Block-level handling:
 * headings, bullet lists (consecutive `- ` lines), horizontal rules,
 * paragraphs.
 */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (/^-{3,}$/.test(trimmed)) {
      out.push("<hr/>");
      i++;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      const level = Math.min(h[1]!.length, 3);
      out.push(`<h${level}>${renderInline(h[2]!)}</h${level}>`);
      i++;
      continue;
    }
    if (/^- /.test(trimmed)) {
      out.push("<ul>");
      while (i < lines.length && /^- /.test((lines[i] ?? "").trim())) {
        const item = (lines[i] ?? "").trim().replace(/^-\s+/, "");
        out.push(`<li>${renderInline(item)}</li>`);
        i++;
      }
      out.push("</ul>");
      continue;
    }
    if (trimmed === "") {
      i++;
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^- /.test((lines[i] ?? "").trim()) &&
      !/^#{1,6}\s/.test((lines[i] ?? "").trim()) &&
      !/^-{3,}$/.test((lines[i] ?? "").trim())
    ) {
      para.push((lines[i] ?? "").trim());
      i++;
    }
    out.push(`<p>${renderInline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}

/**
 * Render a full HTML page for the given legal doc. Includes minimal
 * inlined CSS (consistent with the dark theme of the rest of the app
 * but completely standalone — these pages can be read offline / in a
 * crawler with no JS / CSS access).
 */
export function renderLegalHtml(
  kind: LegalKind,
  opts: { dir?: string; origin?: string } = {},
): string {
  const md = loadLegalMarkdown(kind, opts.dir);
  const body = markdownToHtml(md);
  const origin = opts.origin || "https://learnai.cloud-claude.com";
  const title = `${TITLES[kind]} · LearnAI`;
  const desc = DESCRIPTIONS[kind];
  const canonical = `${origin}/${kind}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(desc)}"/>
  <link rel="canonical" href="${escape(canonical)}"/>
  <meta name="robots" content="index, follow"/>
  <meta property="og:title" content="${escape(title)}"/>
  <meta property="og:description" content="${escape(desc)}"/>
  <meta property="og:url" content="${escape(canonical)}"/>
  <meta property="og:type" content="article"/>
  <meta name="twitter:card" content="summary"/>
  <style>
    :root { color-scheme: dark; }
    body {
      background: #0b1020;
      color: #e6e8f2;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.55;
      max-width: 760px;
      margin: 2rem auto;
      padding: 1.25rem;
    }
    h1 { font-size: 28px; margin: 0.25rem 0 0.5rem; color: #fff; }
    h2 { font-size: 18px; margin: 1.75rem 0 0.5rem; color: #fff; }
    h3 { font-size: 15px; margin: 1.25rem 0 0.4rem; color: #fff; }
    p { margin: 0.65rem 0; color: rgba(230,232,242,0.85); }
    ul { margin: 0.5rem 0 0.5rem 1.25rem; padding: 0; }
    li { margin: 0.2rem 0; color: rgba(230,232,242,0.85); }
    a { color: #a78bfa; }
    a:hover { text-decoration: underline; }
    hr { border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5rem 0; }
    code { background: rgba(255,255,255,0.08); padding: 0 4px; border-radius: 4px; font-size: 12.5px; }
    strong { color: #fff; }
    em { color: rgba(230,232,242,0.95); }
    nav.legal-footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 12px;
      color: rgba(230,232,242,0.5);
    }
    nav.legal-footer a { margin-right: 1rem; color: rgba(230,232,242,0.5); }
    nav.legal-footer a:hover { color: #fff; }
  </style>
</head>
<body>
${body}
<nav class="legal-footer">
  <a href="/">← LearnAI</a>
  <a href="/privacy">Privacy Policy</a>
  <a href="/terms">Terms of Use</a>
  <a href="https://github.com/oznakash/learnai" target="_blank" rel="noopener">Source code</a>
</nav>
</body>
</html>`;
}
