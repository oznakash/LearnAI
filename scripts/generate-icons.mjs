#!/usr/bin/env node
/**
 * Rasterize app/public/icon.svg → multiple PNGs for app icons.
 *
 * Use cases:
 *   - LinkedIn OAuth app-submission logo (400×400 sweet spot)
 *   - Apple touch icon (180×180)
 *   - Android home-screen / PWA (192×192, 512×512)
 *   - High-DPI favicon fallback (32×32, 64×64, 128×128, 256×256)
 *
 * The `@resvg/resvg-js` binding is pure-Rust, doesn't need a system
 * rasterizer (rsvg-convert / cairo / ImageMagick), and is small. We
 * install it on demand here without committing to package.json — this
 * script runs occasionally, not in CI.
 *
 * Setup (one-time, before first run):
 *
 *   cd app && npm install --no-save @resvg/resvg-js
 *
 * Run (from repo root):
 *
 *   cd app && node ../scripts/generate-icons.mjs
 *
 * Outputs land in app/public/ and get bundled by Vite into dist/ at
 * the same paths. The dynamic import below resolves @resvg/resvg-js
 * from the SPA workspace's node_modules — that's why the script must
 * be invoked with cwd=app.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC_SVG = resolve(ROOT, "app", "public", "icon.svg");
const OUT_DIR = resolve(ROOT, "app", "public");

// Sizes to emit. The 400 size is what LinkedIn's OAuth app submission
// expects; 192 / 512 are the PWA standards; 180 is iOS touch-icon.
const SIZES = [32, 64, 128, 180, 192, 256, 400, 512];

let Resvg;
try {
  ({ Resvg } = await import("@resvg/resvg-js"));
} catch {
  console.error(
    "Missing @resvg/resvg-js. Run `npm install --no-save @resvg/resvg-js` first.",
  );
  process.exit(1);
}

const svg = readFileSync(SRC_SVG, "utf8");
mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  const png = r.render().asPng();
  const out = resolve(OUT_DIR, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}

console.log("\nDone. Use icon-400.png for the LinkedIn submission.");
