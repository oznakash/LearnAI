// Server-side HTML for the public-profile page at `/u/:handle`.
//
// Why this module exists:
//   - The SPA at `/` is a client-rendered React app. Crawlers (Googlebot,
//     GPTBot, ClaudeBot, Twitterbot) and link-unfurlers (Slack, Twitter)
//     don't reliably execute JS, and even when they do they don't pick
//     up dynamic OG meta tags. Without a server-rendered page, every
//     `/u/<handle>` URL shared off-platform looks identical and indexes
//     nothing.
//   - This module produces a self-contained HTML page per profile with
//     real keyword content (display name, tier, currently-working-on,
//     topic snippets, sample sparks) plus the OG / Twitter card / JSON-LD
//     stack. Crawlers can index it. Slack / Twitter can unfurl it. Real
//     browsers see it instantly on cold load and click "Sign in" to
//     enter the SPA experience.
//
// Privacy + safety:
//   - Closed profiles render a minimal gate (no data exposed to crawlers).
//   - Kid profiles are forced Closed regardless of mode.
//   - Banned / banned_social profiles return 404 (the visitor sees the
//     "Couldn't find @<handle>" page, the same as a non-existent handle).
//   - Email is NEVER in the rendered HTML.
//   - All user-supplied strings (handle, fullName, pictureUrl) flow
//     through `escape()` / `escapeAttr()`. The CSP is restrictive.
//
// SEO posture:
//   - `<title>` uses real name + tagline.
//   - `<meta name="description">` summarizes the player.
//   - `<meta name="robots">` explicitly invites indexing.
//   - OG tags + Twitter card + JSON-LD `Person` schema for rich unfurls.
//   - `<details>` collapsibles keep the layout tight while still
//     surfacing keyword-rich content to bots that read the full DOM.

import type { ProfileRecord, AggregateRecord } from "./types.js";
import { getTopicSnippet, TOPIC_SNIPPETS } from "./topic-snippets.js";

const SITE_NAME = "LearnAI";
const SITE_TAGLINE = "The AI-native learning network for builders.";
const DEFAULT_OG_IMAGE = "https://learnai.cloud-claude.com/og.png";

export interface RenderOpts {
  profile: ProfileRecord;
  aggregate: AggregateRecord | null;
  origin?: string;
}

// -- HTML escapes --------------------------------------------------------

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escape(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

/** Attribute-context escape — same map but tighter intent. */
export function escapeAttr(value: string | number | undefined | null): string {
  return escape(value);
}

/** Best-effort URL safety — only http/https/data: image URLs survive. */
export function safeUrl(url: string | undefined | null): string {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "";
}

// -- Page renderers ------------------------------------------------------

/**
 * Render the canonical public profile HTML. Caller is responsible for
 * setting Content-Type and status.
 */
export function renderProfileHtml(opts: RenderOpts): string {
  const { profile, aggregate } = opts;
  const origin = opts.origin || "https://learnai.cloud-claude.com";
  const profileUrl = `${origin}/u/${profile.handle}`;
  const handle = profile.handle;
  const isClosed = profile.profileMode === "closed" || profile.ageBand === "kid";

  // Display name resolution mirrors the SPA: visitors see the first
  // name unless the owner opted to show their full name.
  const displayName = profile.showFullName && profile.fullName
    ? profile.fullName
    : (profile.displayFirst || handle);
  const safeName = escape(displayName);
  const safeHandle = escape(handle);

  // Picture: only render if it survives the URL safelist.
  const picture = safeUrl(profile.pictureUrl);
  const ogImage = picture || DEFAULT_OG_IMAGE;

  const tier = aggregate?.guildTier ?? "Builder";
  const xp = aggregate?.xpTotal ?? 0;
  const streak = aggregate?.streak ?? 0;

  // SEO description — short, keyword-rich, no email.
  const description = isClosed
    ? `${safeName} is a builder on ${SITE_NAME}. This profile is closed — sign in and request to follow to see their progress.`
    : buildDescription(displayName, tier, xp, streak, profile.signals, aggregate);

  const head = renderHead({
    title: `${displayName} (@${handle}) — ${SITE_NAME}`,
    description,
    canonical: profileUrl,
    ogImage,
    profileUrl,
    handle,
    displayName,
  });

  const body = isClosed
    ? renderClosedGate({ handle: safeHandle, displayName: safeName, picture })
    : renderOpenProfile({
        handle: safeHandle,
        displayName: safeName,
        picture,
        tier,
        xp,
        streak,
        aggregate,
        signals: profile.signals,
      });

  return `<!doctype html>
<html lang="en">
${head}
${body}
</html>`;
}

/** Empty/404 page when the handle is unknown or banned. Still SEO-correct. */
export function renderNotFoundHtml(handle: string, origin?: string): string {
  const o = origin || "https://learnai.cloud-claude.com";
  const safeHandle = escape(handle);
  return `<!doctype html>
<html lang="en">
${renderHead({
  title: `@${handle} — not found · ${SITE_NAME}`,
  description: `No public profile for @${handle} on ${SITE_NAME}. Maybe they haven't joined yet — start your own AI learning journey at ${o}.`,
  canonical: `${o}/u/${handle}`,
  ogImage: DEFAULT_OG_IMAGE,
  profileUrl: `${o}/u/${handle}`,
  handle,
  displayName: handle,
  noindex: true,
})}
<body class="bg-ink text-white" style="background:#0b1020;color:#fff;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:grid;place-items:center;padding:2rem;">
  <main style="max-width:480px;text-align:center;">
    <div style="font-size:48px;">🤖</div>
    <h1 style="font-size:24px;margin:1rem 0;">No one named <code>@${safeHandle}</code> here yet</h1>
    <p style="opacity:0.7;line-height:1.6;">Maybe they haven't joined ${SITE_NAME} yet — or they've made their profile private.</p>
    <p style="margin-top:1.5rem;"><a href="${o}/" style="color:#7c5cff;font-weight:600;text-decoration:none;">← Start your own learning journey</a></p>
  </main>
</body>
</html>`;
}

// -- Section renderers ---------------------------------------------------

function renderHead(opts: {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  profileUrl: string;
  handle: string;
  displayName: string;
  noindex?: boolean;
}): string {
  const safeTitle = escape(opts.title);
  const safeDesc = escape(opts.description);
  const safeCanonical = escapeAttr(opts.canonical);
  const safeOg = escapeAttr(opts.ogImage);
  const robotsContent = opts.noindex ? "noindex, follow" : "index, follow, max-image-preview:large";

  // JSON-LD Person + ProfilePage. Crawlers (especially Google rich results
  // and AI ingestion bots) prefer structured data over scraping the body.
  //
  // Security: `JSON.stringify` does NOT escape HTML, so a hostile
  // `displayName = "</script><script>alert(1)"` would close the JSON-LD
  // `<script>` block and execute arbitrary code. Replace the `</` byte
  // pair with `<\/` — JSON parsers ignore the backslash, browsers no
  // longer see a closing tag. Same defense as React, Express helmet, etc.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: opts.displayName,
      alternateName: `@${opts.handle}`,
      url: opts.profileUrl,
      image: opts.ogImage,
      memberOf: {
        "@type": "Organization",
        name: SITE_NAME,
        url: "https://learnai.cloud-claude.com",
      },
    },
  })
    // Escape any `<` in the JSON payload to its `<` form. Pure
    // defense-in-depth: this also kills the `</script>` breakout vector
    // and any future browser parser quirks around `<!--`. JSON parsers
    // accept the unicode escape transparently.
    .replace(/</g, "\\u003c")
    .replace(/-->/g, "--\\u003e");

  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">
  <meta name="robots" content="${robotsContent}">
  <link rel="canonical" href="${safeCanonical}">

  <!-- Open Graph (Facebook / LinkedIn / Slack unfurls) -->
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:image" content="${safeOg}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="profile:username" content="${escapeAttr(opts.handle)}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@learnai">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeOg}">

  <!-- Favicon (kept in sync with the SPA shell) -->
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">

  <script type="application/ld+json">${jsonLd}</script>

  <style>
    :root { color-scheme: dark; }
    *,*::before,*::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: #0b1020; color: #fff; line-height: 1.5;
    }
    a { color: #7c5cff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    main { max-width: 760px; margin: 0 auto; padding: 2rem 1rem 4rem; }
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(11,16,32,0.7); backdrop-filter: blur(8px);
      position: sticky; top: 0; z-index: 10;
    }
    .topbar a.brand { color: #fff; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
    .topbar .logo { width: 36px; height: 36px; border-radius: 12px;
      background: linear-gradient(135deg, #7c5cff, #28e0b3); display: grid; place-items: center; }
    .cta {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.6rem 1.1rem; border-radius: 999px;
      background: linear-gradient(135deg, #7c5cff, #28e0b3); color: #fff;
      font-weight: 600; font-size: 0.9rem; box-shadow: 0 8px 24px rgba(124,92,255,0.3);
    }
    .card {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 1.25rem 1.5rem; margin: 1rem 0;
    }
    .header-card { display: flex; gap: 1.25rem; align-items: flex-start; }
    .avatar {
      width: 80px; height: 80px; border-radius: 50%;
      background: linear-gradient(135deg, #7c5cff, #28e0b3);
      display: grid; place-items: center; font-weight: 700; font-size: 1.75rem;
      color: #fff; flex-shrink: 0; overflow: hidden;
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    h1 { margin: 0; font-size: 1.85rem; line-height: 1.15; }
    h2 { margin: 0 0 0.75rem; font-size: 1.1rem; }
    .handle { color: rgba(255,255,255,0.5); margin-top: 0.25rem; }
    .pills { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.85rem; }
    .pill {
      padding: 0.25rem 0.7rem; border-radius: 999px; font-size: 0.78rem;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    }
    .pill.tier { background: rgba(40,224,179,0.1); color: #28e0b3; border-color: rgba(40,224,179,0.3); }
    .pill.xp { background: rgba(124,92,255,0.1); color: #7c5cff; border-color: rgba(124,92,255,0.3); }
    .pill.streak { background: rgba(255,181,71,0.1); color: #ffb547; border-color: rgba(255,181,71,0.3); }
    details {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px; padding: 0.85rem 1.1rem; margin: 0.6rem 0;
    }
    details summary { cursor: pointer; font-weight: 600; outline: none; list-style: none; }
    details summary::-webkit-details-marker { display: none; }
    details summary::after { content: " ▾"; opacity: 0.5; }
    details[open] summary::after { content: " ▴"; }
    details p { margin: 0.6rem 0 0; opacity: 0.85; }
    .spark { margin: 0.5rem 0 0 0.75rem; padding: 0.5rem 0.75rem; border-left: 2px solid rgba(255,255,255,0.15); }
    .spark-title { font-weight: 600; color: #fff; }
    .spark-teaser { font-size: 0.92rem; opacity: 0.75; margin-top: 0.2rem; }
    .activity { display: flex; gap: 2px; align-items: flex-end; height: 32px; }
    .activity .bar { flex: 1; background: rgba(124,92,255,0.6); border-radius: 2px; min-height: 2px; }
    footer { margin: 2.5rem 0 0; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05);
      text-align: center; opacity: 0.5; font-size: 0.85rem; }
    @media (max-width: 540px) {
      .header-card { flex-direction: column; }
      h1 { font-size: 1.5rem; }
    }
  </style>
</head>`;
}

function renderOpenProfile(opts: {
  handle: string;
  displayName: string;
  picture: string;
  tier: string;
  xp: number;
  streak: number;
  aggregate: AggregateRecord | null;
  signals: string[];
}): string {
  const initials = computeInitials(opts.displayName);
  const avatar = opts.picture
    ? `<img src="${escapeAttr(opts.picture)}" alt="" loading="lazy">`
    : `<span>${escape(initials)}</span>`;

  // Currently working on
  const currentTopicId = opts.aggregate?.currentTopicId;
  const currentLevel = opts.aggregate?.currentLevel;
  const currentSnippet = currentTopicId ? getTopicSnippet(currentTopicId) : null;
  const currentBlock = currentSnippet && currentLevel != null && currentLevel > 0
    ? `<section class="card">
        <h2>Currently working on</h2>
        <p style="margin:0;font-size:1.05rem;">
          ${escape(currentSnippet.emoji)} <strong>${escape(currentSnippet.name)}</strong>
          — Level ${escape(currentLevel)}
        </p>
        <p style="margin-top:0.6rem;opacity:0.7;font-size:0.92rem;">${escape(currentSnippet.intro)}</p>
      </section>`
    : "";

  // Topic map (Signals)
  const signalSnippets = opts.signals
    .map((id) => getTopicSnippet(id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  const signalsBlock = signalSnippets.length > 0
    ? `<section class="card">
        <h2>Signals — topics @${opts.handle} is learning</h2>
        ${signalSnippets.map((s) => `
          <details>
            <summary>${escape(s.emoji)} ${escape(s.name)} — ${escape(s.tagline)}</summary>
            <p>${escape(s.intro)}</p>
            ${s.sampleSparks.map((sp) => `
              <div class="spark">
                <div class="spark-title">${escape(sp.title)}</div>
                <div class="spark-teaser">${escape(sp.teaser)}</div>
              </div>
            `).join("")}
          </details>
        `).join("")}
      </section>`
    : "";

  // 14-day activity sparkline (inline SVG). Rendered as an HTML/CSS bar
  // chart instead of SVG because it survives email-style stripping bots
  // and uses zero JS.
  const activity = opts.aggregate?.activity14d ?? [];
  const activityBlock = activity.length === 14 && activity.some((v) => v > 0)
    ? `<section class="card">
        <h2>Last 14 days</h2>
        <p style="margin:0 0 0.6rem;opacity:0.7;font-size:0.92rem;">${activity.reduce((a, b) => a + b, 0)} Sparks completed</p>
        <div class="activity" aria-label="14-day activity sparkline">
          ${activity.map((v) => {
            const pct = Math.min(100, (v / Math.max(...activity, 1)) * 100);
            return `<div class="bar" style="height:${pct}%" title="${v} Sparks"></div>`;
          }).join("")}
        </div>
      </section>`
    : "";

  return `<body>
  <header class="topbar">
    <a class="brand" href="/">
      <div class="logo">🚀</div>
      <span>${SITE_NAME}</span>
    </a>
    <a class="cta" href="/">Sign in to start</a>
  </header>
  <main>
    <article>
      <section class="card header-card">
        <div class="avatar">${avatar}</div>
        <div style="flex:1;min-width:0;">
          <h1>${opts.displayName}</h1>
          <div class="handle">@${opts.handle}</div>
          <div class="pills">
            <span class="pill xp">⚡ ${escape(opts.xp)}</span>
            ${opts.streak > 0 ? `<span class="pill streak">🔥 ${escape(opts.streak)}-day streak</span>` : ""}
            <span class="pill tier">🏅 ${escape(opts.tier)}</span>
          </div>
        </div>
      </section>

      ${currentBlock}
      ${signalsBlock}
      ${activityBlock}

      <section class="card" style="text-align:center;">
        <h2>Build your own learning résumé</h2>
        <p style="opacity:0.75;margin:0 0 1rem;">Sign in with Google. Pick the AI topics you want to grow in. Get personalized 5-minute Sparks every day.</p>
        <a class="cta" href="/">Start with ${SITE_NAME} →</a>
      </section>
    </article>

    <footer>
      <p>${SITE_NAME} · ${SITE_TAGLINE}</p>
    </footer>
  </main>
</body>`;
}

function renderClosedGate(opts: {
  handle: string;
  displayName: string;
  picture: string;
}): string {
  const initials = computeInitials(opts.displayName);
  const avatar = opts.picture
    ? `<img src="${escapeAttr(opts.picture)}" alt="" loading="lazy">`
    : `<span>${escape(initials)}</span>`;
  return `<body>
  <header class="topbar">
    <a class="brand" href="/">
      <div class="logo">🚀</div>
      <span>${SITE_NAME}</span>
    </a>
    <a class="cta" href="/">Sign in</a>
  </header>
  <main>
    <section class="card" style="text-align:center;">
      <div class="avatar" style="margin:0 auto 1rem;">${avatar}</div>
      <h1>${opts.displayName}</h1>
      <div class="handle">@${opts.handle}</div>
      <p style="margin-top:1.5rem;opacity:0.8;">🔒 This profile is closed. Sign in and request to follow to see their progress.</p>
      <p style="margin-top:1.5rem;"><a class="cta" href="/">Sign in</a></p>
    </section>
    <footer><p>${SITE_NAME} · ${SITE_TAGLINE}</p></footer>
  </main>
</body>`;
}

// -- Helpers -------------------------------------------------------------

function computeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function buildDescription(
  displayName: string,
  tier: string,
  xp: number,
  streak: number,
  signals: string[],
  aggregate: AggregateRecord | null,
): string {
  const parts: string[] = [];
  parts.push(`${displayName} on ${SITE_NAME}: ${tier} tier, ${xp} XP`);
  if (streak >= 3) parts.push(`${streak}-day learning streak`);
  if (aggregate?.currentTopicId) {
    const t = getTopicSnippet(aggregate.currentTopicId);
    if (t) parts.push(`currently learning ${t.name}`);
  }
  if (signals.length > 0) {
    const names = signals
      .map((id) => getTopicSnippet(id)?.name)
      .filter((n): n is string => !!n)
      .slice(0, 4);
    if (names.length > 0) parts.push(`focused on ${names.join(", ")}`);
  }
  return parts.join(" · ") + ".";
}

// -- robots.txt ----------------------------------------------------------

/**
 * `robots.txt` — explicit `Allow` for the public profile namespace plus
 * a friendly welcome to the AI ingestion bots that increasingly drive
 * discovery (ChatGPT search, Claude search, Perplexity, Gemini grounding).
 *
 * The non-AI half is conservative: we ALLOW classic crawl, BLOCK the
 * private SPA routes (`/admin`, `/settings`, etc.) which would just be
 * an empty SPA shell from a bot's perspective.
 */
export function renderRobotsTxt(origin?: string): string {
  const sitemap = `${origin || "https://learnai.cloud-claude.com"}/sitemap.xml`;
  return `# ${SITE_NAME} robots.txt — public profiles are open for indexing.
# AI ingestion bots are explicitly welcomed. Private SPA routes are
# blocked because they're empty client-rendered shells from a bot's
# perspective.

User-agent: *
Allow: /
Allow: /u/
Disallow: /admin
Disallow: /settings
Disallow: /memory
Disallow: /tasks
Disallow: /dashboard
Disallow: /play

# AI ingestion bots — welcomed explicitly.
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: cohere-ai
Allow: /

# Classic search + unfurl bots.
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: DuckDuckBot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: Slackbot
Allow: /

User-agent: LinkedInBot
Allow: /

Sitemap: ${sitemap}
`;
}

// -- sitemap.xml --------------------------------------------------------

/**
 * Build a sitemap from the in-memory profile list. Only profileMode=open
 * adult profiles are surfaced; closed and kid profiles never appear.
 */
export function renderSitemapXml(
  profiles: ProfileRecord[],
  origin?: string,
): string {
  const o = origin || "https://learnai.cloud-claude.com";
  const eligible = profiles.filter(
    (p) =>
      !p.banned &&
      !p.bannedSocial &&
      p.profileMode === "open" &&
      p.ageBand !== "kid",
  );
  const urls = [
    `<url><loc>${o}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...eligible.map(
      (p) => `<url><loc>${o}/u/${escape(p.handle)}</loc><lastmod>${new Date(p.updatedAt).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ),
  ];
  // Topic-level pages aren't a thing yet; sitemap stays profile-focused.
  // When topic landing pages ship, they slot in here at priority 0.8.
  const topicCount = Object.keys(TOPIC_SNIPPETS).length;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${SITE_NAME} sitemap. ${eligible.length} public profiles, ${topicCount} topics curated. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join("\n  ")}
</urlset>
`;
}
