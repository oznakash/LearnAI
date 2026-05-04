# MVP — what works today

> _Honest list of what's shipped and what's not. Updated on every PR._

Live at: **`https://learnai-b94d78.cloud-claude.com`** (cognition layer off by default until you provision mem0).

Source: **`https://github.com/oznakash/learnai`**.

---

## ✅ Shipped (MVP)

### Core game loop

- 12 Topics × 10 Levels × 4–6 Sparks per level = **1,150 hand-authored micro-lessons** (2.36× growth from the ~487-Spark seed corpus, via Sprint #4's 6-agent expansion).
- 8 Spark formats: 📖 MicroRead, 💡 Tip & Trick, 🎯 Quick Pick, 🧩 Fill the Stack, 🔗 Pattern Match, 🧪 Field Scenario, 🛠️ Build Card, 👾 Boss Cell.
- Game mechanics: XP (display name configurable in admin → Branding; default just "XP"), Focus (lives that regen every 18 min), Build Streak (daily), Guild Tiers (Builder → Architect → Visionary → Founder → Singularity), 14 Badges.
- Anti-spam lock: each Spark can only award XP once (regression-tested).

### "Today in AI" Pulse strip

- Daily-trend strip on Home above the fold — admin-curated `PulseConfig` with up to 6 items.
- Each item: 1-line headline, 2-3 line zoom-in body, optional source credit, optional Constellation deep-link.
- **Tap-to-zoom** affordance (collapsed by default, expands on click), with "Start a Spark on this →" CTA that hands off to Play and writes a `preference` memory so the cognition layer picks up the interest.
- **Audience-aware**: `audience: "kid" | "adult" | "all"` shapes who sees what — kids/teens skip adult-only frontier cards, adults skip kid-tone evergreens.
- Coarse freshness chip (`Added today` / `Nd ago` / stale-grey) derived from `addedAt`.
- Ships with 3 evergreen-but-current seed items so a fresh install isn't empty before the operator curates.
- 100% offline — items live in admin localStorage; no network calls, no third-party trackers.

### Onboarding & personalization

- **Role-aware 8-step wizard** (~90–120 seconds): name, **role**, age, **AI-fluency probe**, interests, daily minutes, goal, **first-Spark preview**.
- Role step (Student/Kid · PM · Engineer · Designer · Creator · Exec · Researcher · Curious · Other) drives topic pre-selection, suggested skill, and downstream tone.
- AI-fluency probe — two soft questions ("Used ChatGPT or Claude?" / "Written code or a prompt?") yield a 0–4 fluency score that suggests the right starting skill instead of asking the user to label themselves.
- First-Spark preview — the final wizard step shows the exact Spark the user will start with (title, format, level, ETA), computed by the same `nextRecommendedSpark` selector Play uses.
- Personalized fresh-stage Home header — references role + daily minutes + first topic before the user has any stats.
- Age-band shaping (kid / teen / adult).
- Skill-level shaping (5 tiers from "Curious starter" to "Frontier visionary").
- **Adaptive recalibration** — 5-question quiz with smart probes (anchor at the player's level + one and two levels up + one level down + one cross-area probe), drawn from a tagged pool that excludes ids the player has already seen. Records `profile.calibratedLevel` (1-10) — when the player opens a *fresh* topic, recommendations start at that level instead of always at L1. Plus the existing interest re-pick.

### Identity

- Gmail-only sign-in via Google Identity Services (browser flow, ID-token decoded client-side).
- Demo mode (typed Gmail address) for trials without OAuth setup.
- Hydration race fixed — saved Client ID is honored after refresh.

### Tasks

- Tasks tab — capture YouTube videos, articles, Build Cards. Auto-add from any Spark via the "+ Task" button.
- Statuses (todo / doing / done), filters, counts.
- Build tasks include a 1-tap "Copy prompt" for Claude Code.

### Progress dashboards

- **Per-topic page** — completion ring, levels done, accuracy, time invested, sparks-per-level bars, 14-day activity sparkline, the Path (vertical timeline of all 10 levels).
- **Global dashboard** — XP / Streak / Sparks / Accuracy stat tiles, 14-day sparkline, radar across 8 Topics, Sparks-per-Topic bars, 12-week heatmap, badges grid.

### Cognition layer (opt-in)

- `MemoryService` interface with two implementations: `OfflineMemoryService` (per-user `localStorage`) and `Mem0MemoryService` (HTTP client for self-hosted mem0).
- **Offline-mode kill switch** in admin (default ON). When ON, the SPA runs entirely on the device.
- Event hooks seed memory: onboarding goals, calibration, inferred strengths (3 correct in a row), gaps (2 wrong), level/Boss/badge history.
- **Your Memory** player tab — list / filter / edit / forget / wipe / export.
- TopBar status badge: 📴 / 🧠 / 🟡.

### Admin Console (11 tabs)

- 👥 **Users** — list, search, sort, filter; ban/reset/send-template (mock cohort + the local user).
- 📊 **Analytics** — onboarding funnel, DAU/WAU/MAU, sparks/user, topic popularity, retention table.
- 🧠 **Memory** — master switch, mem0 server config, health-check ping, per-user inspector, daily token cap.
- 📧 **Emails** — provider tiles (Resend / SMTP-relay-webhook / EmailJS / Postmark / SendGrid / SES / none), 8 lifecycle templates with live HTML preview, send-queue + per-message status, "Send test email" form, **Email policy** sub-panel (24 h cap per recipient, debounced auto-flush, RFC 8058 unsubscribe header, open-tracking pixel, pause-on-N-unreads cooldown — see "Email policy" below).
- 🎮 **Tuning** — every XP value, focus max + regen, tier thresholds, Boss pass ratio. Live-applied.
- 📚 **Content** — read/edit any topic as JSON, override the seed, reset, export + import (Topic[] or overrides bundle).
- 📝 **Prompt Studio** — assembles the long content-generation prompt with topic / level / count / audience / custom note. With or without an API key — copy + paste-back works either way.
- 🛡️ **Moderation** — social-report queue with resolution actions (no-action / warn / ban-from-social / global-ban).
- 🪪 **Public Profile** — operator policy for `/u/<handle>`: default profile mode for new sign-ups, master switch for the SSR personalized-learnings section, default per-field visibility for new users (`showFullName`, `showCurrent`, `showMap`, `showActivity`, `showBadges`, `showSignup`, `signalsGlobal`), and a preview link. Settings live in `admin.socialConfig.publicProfile` and flow through `SocialProvider` → `OfflineSocialService`.
- ✍️ **Creators** — list creators with attached-Sparks count and most-recent `addedAt`. The `+ Add Spark` modal accepts pasted source content, calls `claude-haiku-4-5` via the admin `apiKey` to draft a MicroRead, lets the operator edit, then persists to `contentOverrides`. Closes the user-reported "creators created but 0 Sparks visible / no paste-content UI" gap.
- ⚙️ **Config** — feature flags, branding, defaults, admin allowlist.

### Deployability

- Static SPA at `/dist/`, auto-rebuilt + auto-committed by GitHub Actions on every push to `main`.
- Multi-stage `Dockerfile` (node → nginx-alpine) with tuned `nginx.conf` (gzip, hashed-asset caching, SPA fallback).
- Platform configs: `vercel.json`, `netlify.toml`, `static.json`, root `package.json`.
- Self-hosted mem0 via `docker-compose.mem0.yml` + `.env.example`.
- One-command Fly deploy: `OPENAI_API_KEY=... npm run deploy:mem0` + `npm run smoke:memory`.

### SSR + SEO public profiles

- **`/u/<handle>` is now server-rendered before the SPA hydrates.** A new social-svc module (`services/social-svc/src/ssr.ts`) emits real per-user HTML — `<title>`, `<meta description>`, OpenGraph + Twitter card, JSON-LD `@graph` (`ProfilePage` → `Person` → `knowsAbout` → one `Course` per Signal → `hasPart[]` of `LearningResource` per sample spark) — plus a semantic body with display name + tier + XP + streak chips, "Currently working on", and Signals as `<details>` collapsibles. nginx routes `/u/*`, `/robots.txt`, and `/sitemap.xml` straight through to the sidecar; signed-in SPA users still navigate between profiles via `pushState` (no server round-trip). Signed-out visitors see the rendered page with an `AnonymousHeader` and a sign-in CTA — every other route still requires auth. Closed / kid / banned / banned_social profiles fall through to a polite minimal gate that emits no `Course` / `LearningResource` leakage. (PR #98)
- **Personalized topic learnings.** A `topic-snippets.ts` module duplicates a tight slice of the 12 Constellations: emoji, tagline, 3-4-sentence keyword-dense `whatYoudLearn` rundown, and **5 sample-spark titles + teasers** marked up with `Schema.org/LearningResource` microdata. A typical multi-Signal profile renders ~600 indexable words. When `aggregate.topicXp[signal] > 0`, an `⚡ N earned here` chip per Signal makes every profile uniquely deduplication-safe for Google + AI bots. (PR #103)
- **Hardening.** og:image now uses the user's Google avatar (square Twitter `summary` card) so Slack / LinkedIn / Twitter unfurls show a real face. Canonical URL honors `X-Forwarded-Proto` from the outer LB, so `<link rel="canonical">` and og:url are `https://`. Avatar `<img>` tags carry `referrerpolicy="no-referrer"` + `crossorigin="anonymous"` (and a page-level `<meta name="referrer" content="strict-origin-when-cross-origin">`) to keep iOS Safari "Reduce Protections" off. The `/v1/social/me/snapshot` endpoint logs + accepts >10% XP drops instead of returning `409 implausible_xp`, fixing the "TopBar shows 165, public profile shows 248" drift. A new `SocialContext` effect calls `updateProfile({ fullName, pictureUrl })` once per identity change so the online server's projection stays in sync with Google. (PR #101)
- **`robots.txt`** explicitly allows the AI-ingestion bots (GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-Web, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, CCBot, cohere-ai) plus the classic search + unfurl set (Googlebot, Bingbot, DuckDuckBot, Twitterbot, facebookexternalhit, Slackbot, LinkedInBot). Disallows `/admin`, `/settings`, `/memory`, `/tasks`, `/dashboard`, `/play`. **`sitemap.xml`** lists every `profileMode=open` adult profile with `<lastmod>` from `updatedAt`; closed / kid / banned profiles are skipped. (PR #98)
- **Anonymous-profile fallback** — visiting `/u/<handle>` for a handle that doesn't exist renders a polite empty state with sign-up CTA rather than a 404. (PR #98)

### Email policy (24 h cap, RFC 8058 unsubscribe, pause-on-unread)

- **24-hour cap per recipient** with a debounced auto-flush (default 30 s window). Competing transactionals collapse to the highest-priority survivor; blocked rows surface their reason as a status badge (`superseded` / `rate-limited` / `paused` / `unsubscribed`) so the admin sees why each one moved. Priority order: streak-save › boss-beaten › level-up › first-spark › welcome › weekly-digest › re-engagement › daily-reminder.
- **RFC 8058 one-click unsubscribe** — sends emit `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers, lighting up Gmail's native pill. Resend gets the pair via its `headers` field; smtp-our-server passes `unsubscribeUrl` to social-svc's existing `buildListUnsubHeaders`; smtp-relay forwards to the relay. Only emitted on non-transactional sends.
- **Open-tracking pixel + pause-on-unread** — after N unread sends (default 2, configurable) a recipient is paused for `pauseDurationDays` (default 30). Threshold check is recency-windowed (24 h).
- **Branded `/unsubscribe` SPA route** — public, no sign-in needed. Lands with `?token=...`, POSTs to mem0's unsubscribe endpoint, renders one of `submitting / ok / expired / error` states with the EmDash mascot.
- All knobs live in `app/src/admin/emailPolicy.ts` and surface in **Admin → Emails → Email policy**: master switch, cap-hours, auto-flush toggle + debounce, transactional-bypasses-cap, append-unsubscribe-link, append-open-tracking-pixel, pause-on-N-unreads, pause-duration-days, priority order. (PR #93)

### Social layer (Sprint 2 — shipped behind feature flags)

- **Public Profile** at `/u/<handle>` — behavioral résumé: Topic map, Signals, currently-working-on, 14-day activity, badges. No bio, no employer, no email displayed. Closed-mode profiles render a single gated card to non-followers. Display name and avatar auto-sync from the player's Google identity until the user explicitly customizes the profile (the offline service falls back to `identity.name` / `identity.picture` in its viewer projection — explicit `updateProfile` patches still win, and the `SocialProvider` mirrors identity-deltas into `social-svc` via a fire-and-forget `updateProfile` so unfurls + the SSR `og:image` carry the real avatar).
- **`/u/<handle>` SSR + SEO surface (`services/social-svc/src/ssr.ts`)** — anonymous, no-JS, no-auth HTML rendered server-side by the social-svc sidecar. Carries `<title>`, `<meta description>`, OpenGraph, Twitter card, `Schema.org` JSON-LD `@graph` (`ProfilePage` → `Person` → `knowsAbout` → one `Course` per Signal → `hasPart[]` of `LearningResource` per sample spark). Renders the player's currently-working-on, achievement chips, 14-day activity sparkline (CSS bars, no JS), and a "What @&lt;handle&gt; is learning" section with a `<details>` collapsible per Signal containing topic intro + a 3-4 sentence "what you'd learn" rundown + 5 sample spark titles & teasers (each marked up with `Schema.org/LearningResource` microdata). Per-topic XP chip personalizes each profile so two users with the same Signals don't render byte-identical content. Closed / kid / banned profiles fall through to a minimal gate. Anonymous viewers see the SSR page on cold load via nginx route `/u/<handle> → social-svc`; signed-in SPA users still navigate client-side via `history.pushState` and get the React `Profile.tsx` interactive view.
- **`/robots.txt` + `/sitemap.xml`** — served by `social-svc`. `robots.txt` welcomes the AI ingestion bots explicitly (GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, OAI-SearchBot, Google-Extended, Applebot-Extended, CCBot, cohere-ai) plus the classic crawl + unfurl set (Googlebot, Bingbot, DuckDuckBot, Twitterbot, facebookexternalhit, Slackbot, LinkedInBot). Disallows the private SPA-only routes (`/admin`, `/settings`, `/memory`, `/tasks`, `/dashboard`, `/play`). `sitemap.xml` lists every open adult profile with `<lastmod>`; closed / kid / banned profiles never appear.
- **Snapshot levelId parser** correctly extracts the level from canonical `<topicId>-l<n>` ids (was `parseInt("l3") = NaN → 0`, which made every profile read "Level 0"). The fix also unblocks `level_up` Stream events, which previously never fired. (PR #97)
- **Boards endpoint** now returns real ranked users — `/v1/social/boards/:scope` was a hard-coded `[]` placeholder; replaced with real ranking logic (Global / Topic / Following) over `profileMode=open` profiles, filtered for self / banned / banned_social / blocked-either-way / kid-vs-adult mismatch, sorted by `xpTotal` desc, top 20. Period (`week | month | all`) is accepted but the aggregate doesn't track per-period XP yet — swap the sort key when it does. PR #96 (with diagnostic logging follow-up in PR #105).
- **Hardening (PR #101).** og:image switched to the user's Google avatar (square Twitter `summary` card). `<link rel="canonical">` and og:url honor `X-Forwarded-Proto` from the outer LB (so they render `https://`). Avatar `<img>` tags carry `referrerpolicy="no-referrer"` + `crossorigin="anonymous"` and a page-level `<meta name="referrer" content="strict-origin-when-cross-origin">` to keep iOS Safari "Reduce Protections" off. The `/v1/social/me/snapshot` endpoint logs + accepts >10% XP drops instead of returning `409 implausible_xp`, fixing the "TopBar shows 165, public profile shows 248" drift.
- **Settings → Network** — top-down: completeness gauge, then a live-preview profile editor (banner + overlapping avatar with an inline 📷 camera badge that opens the crop dialog directly), then Signals (max 5 Topics), People, then **Profile visibility at the bottom** (Public / Private — internal `profileMode: "open" | "closed"` enum unchanged) with the 13 field-level toggles (full name, current Topic, Topic map, activity, badges, sign-up month, Global Leaderboard, bio, pronouns, location, hero, skill, links) tucked inside a `<details>` disclosure ("Show me what visitors can see (advanced)") so a first-time user isn't asked to make 13 micro-decisions before they've uploaded a photo. Take-me-down panic switch lives in the visibility card. A "Finish your profile" nudge surfaces in `Settings` when completeness < 100. The owner banner on `Profile.tsx` uses `navigator.share` (with clipboard fallback + toast). Open profiles set `<title>`, OG / Twitter card, and a `Person` JSON-LD block on mount and revert on unmount.
- **Profile photo + banner upload (with crop)** — `📷 Change photo` and `🖼 Add a banner / Change banner` buttons in the Network editor open `app/src/components/ImageCropDialog.tsx`. v2 (PR #121) is Instagram / Cropper.js-style: source image fills the stage, a darkened scrim covers everything except a clearly-shaped cutout (true circle for avatars, rounded rect for banners) so what's bright IS what gets saved. Mobile-first (responsive `aspect-ratio` stage, pinch + drag via Pointer Events, `touch-action: none`). Source images are pre-downsampled to ≤ 1600 px on the longest side so 12 MP phone shots stay snappy on drag. Output is WebP q=0.82 (JPEG fallback) at 400×400 / 1280×432 — typical 20–35 KB avatar, 60–90 KB banner. Wire pipeline: SPA `social.uploadImage(kind, dataUrl)` → `POST /v1/social/me/image/<avatar|hero>` → `services/social-svc/src/uploads.ts` writes to `/data/uploads/<emailHash>/<kind>.<ext>` with magic-byte MIME sniffing (JPEG / PNG / WebP only — SVG refused as XSS surface), 1 MB raw cap, deterministic per-(user, kind) filename + stale-extension cleanup. nginx serves `/i/<emailHash>/<kind>.<ext>` immutable-static from the same `/data` volume. Same-origin URL persists to `pictureUrl` / `heroUrl` and feeds the SSR `og:image` so Slack / Twitter / LinkedIn unfurls show the user's real avatar. `safePictureUrl` whitelists `data:image/(jpeg|png|webp);base64,…` so the offline service can preview uploads without a server (still rejects `data:image/svg+xml` and `data:text/*`).
- **Follow / Unfollow / Mute / Block / Report** — every Profile (and inline on Stream cards). Asymmetric graph; report auto-mutes; block precedence removes existing edges. 5-reason picker on reports, 280-char note.
- **Topic Leaderboards (Boards)** — replaces the single Guild leaderboard with tabbed Global / per-Topic / Following + Week/Month/All-time pills. Per-Topic tabs only appear for the player's active Signals (max 5); `+ Topic` button opens an ad-hoc picker for any of the 12 Topics. Mock filler ("sample" tag) below real rows when sparse.
- **Spark Stream** — auto-derived feed (level-up / boss-beaten / streak-milestone / spotlight cards). Per-card actions: Follow, Try this Topic, Mute author. "All / Only people I follow" filter. **No engagement-feedback term in ranking** (vision §4).
- **Admin → Moderation tab** — report queue (Open / Resolved). Resolution actions: ✓ No action / ⚠ Warn / 🚫 Ban from social / 🚷 Global ban. Optimistic removal + audit on resolve.
- **Admin → 🪪 Public Profile tab** — operator-level policy for `/u/<handle>`. Sets the *default* `profileMode` for new sign-ups (Public / Private — internal `"open" | "closed"`; kid-band still forced Private), the *default* per-field visibility toggles new users start from (`showFullName`, `showCurrent`, `showMap`, `showActivity`, `showBadges`, `showSignup`, `signalsGlobal`), a master switch for the SSR personalized-learnings section, and a preview link to the operator's own `/u/<handle>` SSR page. Existing users keep their saved Network-view toggles; this is policy-for-new-users, not retroactive. Stored in `admin.socialConfig.publicProfile`; flows through `SocialProvider → selectSocialService → OfflineSocialService` so a fresh user's offline state is created from the policy. Server-side enforcement + per-field force-overrides queued for v2.
- **`services/social-svc/`** — Node + Express + TypeScript social-graph backend. 21 endpoints (19 REST + the new `GET /u/:handle` SSR endpoint and `GET /sitemap.xml` for SEO), in-memory store with optional JSON-file persistence, viewer-aware projection. **Bundled inside the SPA container as a sidecar** (single deploy unit on cloud-claude); nginx reverse-proxies `/v1/social/*` to `localhost:8787`. Auth: verifies the mem0-issued session JWT locally with the shared `JWT_SECRET` — no separate proxy, no Cloudflare account, no bearer-in-browser issue. Production migration to Postgres-2 is one module swap (documented in the service README).
- **All flags default OFF** in `defaults.ts` so a fork pulling main today sees zero behavior change. Live deploy flips them on via admin localStorage.

→ Sprint changelog + open punch list: [`social-mvp-status.md`](./social-mvp-status.md).

### Content engine — Sprint #2 foundation (shipped)

- **Spark categories + freshness chip** — Six categories (`principle` / `pattern` / `tooling` / `company` / `news` / `frontier`) with per-category shelf life. Sparks that set `addedAt` + `category` render a quiet provenance line — `📅 Added <date>` — without any "Aging" or "May be stale" warnings to end users (PR #102 flattened the three-state warning to neutral). Operator tools still read the full age signal: the daily content steward picks stale-first refresh candidates, and the Admin → Creators tab surfaces "most recent `addedAt`" per creator. Doctrine: [`content-freshness.md`](./content-freshness.md). PR #92, refined by #102.
- **Empty-illustration-slot rule** — when a Spark has no `visual` field, the renderer hides the illustration slot entirely instead of falling back to the generic topic-level shape (which on dark theme read as visual noise rather than illustration). Sparks that deliberately picked a shape — `"robot"`, `"shield"`, `"build"`, `"embed"`, `"lock"`, … — keep their content-tied illustration. PR #104.
- **Full-corpus freshness coverage** — every MicroRead/Tip Spark across all 12 topic files carries `category` + `addedAt`; the freshness chip renders everywhere; the daily content steward has a real audit population. PR #95 backfilled 144 Sparks; PR #99 carried the convention through the 2.36× expansion.
- **Critique chips loop** — A 👎 vote opens 7 structured chips (too-theoretical · wrong-examples · outdated · too-jargon · watered-down · wrong-level · too-long). Each tap writes a `critique`-category memory whose metadata records `chip`, `sparkCategory`, `sparkType`, and `vocabAtoms`; aggregation across the user (or, in admin, across users) produces a small **prompt stanza** that biases the next generation cycle ("avoid principle Sparks; users find them theoretical") even at N = 50 where per-Spark vote stats are still noise. PR #92.
- **Age-band tone** — MicroRead and Tip Sparks may carry `bodyByAgeBand: { kid?, teen?, adult? }`. The renderer picks the right body for the user's profile band, falls back to default `body` otherwise. First seeded on the "AI is pattern, not magic" Spark in **AI Foundations**.
- **YouTube nugget Spark** — Second source-anchored variant after PodcastNugget. Renders with channel name, video title, duration, "watch on YouTube" CTA. Pilot constraint: ≥ 5 min, ≤ 60 d old, 10 max in seed.
- **External-source creators registry** — 8 new creators (AlphaSignal, Hacker News / YC, Anthropic news, Simon Willison, Hugging Face, Latent Space, DeepMind, Y Combinator). Sparks reference creator id; renderer surfaces avatar + "via X" without inlining attribution.
- **Critique chips → meta-implicit refinement** — A 👎 vote opens 7 chips (too-theoretical · wrong-examples · outdated · too-jargon · watered-down · wrong-level · too-long). Each tap writes a `critique`-category memory whose aggregation (`app/src/store/critique.ts`) folds into a prompt-bias stanza. Designed to shape generation at small N, where per-Spark vote stats are still noisy.

### Quality bar

- **728 tests passing**: 591 SPA (Vitest) + 137 social-svc (supertest+vitest). Recent sprints added: SSR public-profile surface (`/u/<handle>`, robots, sitemap), JSON-LD `@graph` ingestion-friendly structured data, the `/admin → 🪪 Public Profile` policy tab, identity-sync into social-svc, the XP `xp_drop_accepted` log path, the `parseLevelIndex` snapshot fix, the boards real-ranking endpoint, profile picture + banner upload (with crop) via `social-svc /v1/social/me/image/<kind>` + nginx `/i/` static surface, the refined Instagram-style `ImageCropDialog`, PR-time CI gating across both workspaces, and Sprint 2.5 PR 12's close-out polish (`/health` startup state, Stream Signal-overlap + spotlight cron, telemetry endpoint, admin telemetry panel).
- Build: ~352 KB JS / ~7 KB CSS gzipped, ~106 modules.
- Pinch-zoom + double-tap-zoom blocked (mobile + desktop trackpad). Keyboard zoom intentionally preserved.
- Overscroll bounce stopped.
- Confetti, mascot moods, illustrations, animated transitions.

### Documentation library (`docs/`)

- Strategy: [`vision.md`](./vision.md) · [`problem.md`](./problem.md) · [`use-cases.md`](./use-cases.md) · [`competitors.md`](./competitors.md) · [`pitch-deck.md`](./pitch-deck.md) · [`manifesto.md`](./manifesto.md).
- Technical: [`architecture.md`](./architecture.md) · [`technical.md`](./technical.md) · [`mem0.md`](./mem0.md) · [`ux.md`](./ux.md) · [`design-language.md`](./design-language.md).
- Social MVP: [`social-mvp-product.md`](./social-mvp-product.md) (PRD) · [`social-mvp-engineering.md`](./social-mvp-engineering.md) (eng plan) · [`social-mvp-status.md`](./social-mvp-status.md) (changelog).
- Sprint planning: [`mvp.md`](./mvp.md) (this) · [`roadmap.md`](./roadmap.md).
- Community: [`contributing.md`](./contributing.md) · [`fork-recipe.md`](./fork-recipe.md).
- Service README: [`../services/social-svc/README.md`](../services/social-svc/README.md).
- Operator runbook: [`operator-checklist.md`](./operator-checklist.md) — env vars, deploy steps, monitoring, log keys to alert on.

---

## 🟡 Half-shipped / known-limited

- **Leaderboard** — local + bot Guild members. Real cohort sync requires the auth-verifying proxy + a public-profile schema (Sprint 2).
- **Analytics** — overlay the local user's real history on a deterministic mock cohort. Real cross-user analytics need a backend.
- **Email send** — the queue actually sends through Resend / SMTP-relay-webhook / EmailJS. Postmark / SendGrid / SES require a server-side relay (intentional).

---

## ⚠️ Not yet shipped

| Capability | Why we don't have it yet | When |
|---|---|---|
| `PodcastNugget` Spark variant + first ~12 nuggets from [Lenny's Podcast](https://www.lennysnewsletter.com/podcast) (Boris Cherny, Simon Willison, Benjamin Mann, April Dunford, …), gated by `flags.lennyContentEnabled` (default ON) | Reference doc and seed nuggets are staged in [`lenny-archive.md`](./lenny-archive.md). Engine work + topic-file integration land in the active content-experience sprint. See [`content-experience-plan.md`](./content-experience-plan.md). | Active sprint (PR (b)) |
| 👍 / 👎 feedback on every Spark + permanent skip on 👎 (per-user) + admin roll-up of best/worst Sparks | Schema and UX outlined in [`content-experience-plan.md`](./content-experience-plan.md). Cognition-layer hook writes a `preference` memory on 👎 so mem0 stops surfacing similar shapes. | Active sprint (PR (c)) |
| mem0-driven session sequencer + visual-box redesign (concept-tied diagrams, mobile-first sizing) | Today the mem0 layer observes but doesn't drive sequencing; the animation slot shows the same generic illustration regardless of concept. See [`content-experience-plan.md`](./content-experience-plan.md). | Active sprint (PR (a)) |
| **Three-choice row on every Spark** — *✅ Got it · 🔍 Zoom in · ⏭ Skip-not-now* alongside the existing 👍/👎. The Zoom-in path spawns a child Spark that links back to the parent. The Skip-not-now path is distinct from 👎 (which is permanent). Roadmap defined in [`content-model.md`](./content-model.md) §8 #1 | The user's three responses to any Spark are first-class in the model but only ✅ ships today. Zoom-in / Skip are the highest-leverage gaps for *Memory acceptance ≥ 45%* and *"felt made for me" ≥ 80%*. | Active content sprint |
| **`intent` memory at onboarding + intent-aware Level-Cleared CTA** — multi-select *Curious / Applied / Decision / Researcher / Forker* on the wizard last step, stored as a `goal`-category memory; the secondary CTA on the Level-Cleared screen picks per-mode (Build Card for *Applied*, Go Deeper for *Curious*, etc.). [`content-model.md`](./content-model.md) §8 #2–3 | Today the daily-quest topic shifts after a clear, but the secondary nudge is universal ("Try a different topic") — a hard miss for the WAB conversion moment | Active content sprint |
| **`vocabulary` memory category + inline term tap-to-define** — every Spark declares the vocab atoms it uses; on completion the user's vocab is updated; new Sparks check before assuming. Atoms render as subtle underlines; tap → mini popover → optional zoom-in Spark. [`content-model.md`](./content-model.md) §2.4, §8 #4–5 | Just-in-time vocabulary is the third pillar of the content model and has zero implementation today | Next content sprint |
| **Source-anchored Spark variants beyond `PodcastNugget`** — `VideoNugget`, `PaperNugget`, `ReleaseNote`, `EssayNugget`, `NewsletterNugget`. Each inherits the `PodcastNugget` shape from [`lenny-archive.md`](./lenny-archive.md) and is rendered through the same source-anchor template | The thesis in [`content-model.md`](./content-model.md) §2.2 — *any source can become a Spark* — currently has one (1) implementation. Scaling source variety is the natural next move | Next content sprint |
| **AI-assisted compression pipeline (the "engine")** — daily cron picks one source per Topic, drafts 3 candidate Sparks via the existing PromptStudio shape, queues for human approval. [`content-model.md`](./content-model.md) §3 step 2 + §8 #7 | Steps 3, 4, 5 of the compression pipeline are pure software (already running). Step 2 — the actual compression — is fully manual. Scaling step 2 with model-assist is the unlock for 5× content velocity | Sprint 3 |
| Production hardening of the social layer (Postgres-2 swap, snapshot pipeline wiring, server-side upstream-bearer enforcement) | The Sprint-2 PRs shipped the surface; Sprint 2.5 closes the open P0/P1 punch list before flipping flags on in production. See [`social-mvp-status.md`](./social-mvp-status.md). | Sprint 2.5 |
| Contribution flow (community-authored Sparks with AI-assisted review) | Needs review pipeline + maintainer queue | Sprint 3 |
| Talent Match (recruiters search the behavioral graph) | Needs public profiles (✅ Sprint 2) + skills index | Sprint 4 |
| Audio / voice mode (listen + answer) | Demand-gated — no users have asked yet | Sprint 5 |
| Native mobile shell | Web works great on mobile; revisit when retention proves it | Sprint 5–6 |
| Multi-admin sync (admin config in mem0 system-scope) | One admin per deploy is enough today | Sprint 3 |
| Stripe / billing | No revenue feature gated yet | Whenever we decide to monetize |

---

## How to verify any claim above

```sh
# Source on disk, not screenshots:
npm test                              # SPA: 591 / 591
npm test --prefix services/social-svc # 137 / 137
npm run build                         # green
npm run dev                           # play it
```

---

## See also

- [`roadmap.md`](./roadmap.md) — what ships next.
- [`vision.md`](./vision.md) — why each next item matters.
- [`architecture.md`](./architecture.md) — how each new capability fits.
