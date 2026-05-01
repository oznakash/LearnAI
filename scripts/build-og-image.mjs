#!/usr/bin/env node
// Rasterize app/public/og.svg → app/public/og.png at 1200×630.
//
// Why we do this: og:image must be PNG/JPG/GIF/WebP. Twitter, Facebook,
// LinkedIn, Slack, iMessage, Discord all silently refuse SVG og:images,
// which is why earlier link-share previews on https://learnai.cloud-claude.com
// rendered as a bare URL with no card.
//
// Run manually after editing og.svg:
//   npm run og:build
//
// Output: app/public/og.png (committed) — Vite picks up app/public/* into
// dist/ during `npm run build`, so the PNG ships with the SPA.
//
// Tooling: @resvg/resvg-js. Pure native binding, no Cairo / no headless
// browser. Imports system fonts; we pin Space Grotesk + Inter via
// `font.loadSystemFonts: true` and let the binding pick the closest match.
// Custom @font-face would need files bundled — system fallback is fine
// for an OG image where pixel-perfect kerning isn't a deal breaker.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const svgPath = resolve(repoRoot, "app/public/og.svg");
const pngPath = resolve(repoRoot, "app/public/og.png");

const svg = await readFile(svgPath, "utf8");

const resvg = new Resvg(svg, {
  background: "#0b1020",                  // matches the SVG bg fallback
  fitTo: { mode: "width", value: 1200 },  // 1200×630 baked into the SVG
  font: {
    loadSystemFonts: true,
    defaultFontFamily: "Inter",
  },
});

const png = resvg.render().asPng();
await writeFile(pngPath, png);

const sizeKb = Math.round(png.byteLength / 1024);
console.log(`✔ wrote ${pngPath} (${sizeKb} KB, ${resvg.width}×${resvg.height})`);
