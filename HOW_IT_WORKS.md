# BuilderQuest — How it works

Everything you need to install, configure, and understand BuilderQuest. For the deep design rationale (terminology, content philosophy, roadmap), see [DESIGN_DOC.md](./DESIGN_DOC.md).

## Table of contents

1. [What it is](#1-what-it-is)
2. [Quick install](#2-quick-install)
3. [Configuration checklist](#3-configuration-checklist)
4. [How a player uses it (UX walk-through)](#4-how-a-player-uses-it-ux-walk-through)
5. [Game mechanics in one page](#5-game-mechanics-in-one-page)
6. [Content model](#6-content-model)
7. [Architecture](#7-architecture)
8. [Data, persistence, and privacy](#8-data-persistence-and-privacy)
9. [Dynamic content (API key)](#9-dynamic-content-api-key)
10. [Admin Console](#10-admin-console)
11. [Deployment](#11-deployment)
12. [Testing](#12-testing)
13. [Extending the app](#13-extending-the-app)
14. [FAQ / Troubleshooting](#14-faq--troubleshooting)

---

## 1. What it is

**BuilderQuest** is a gamified, micro-dosed AI learning platform inspired by Duolingo. It serves two audiences with one experience:

- **Curious starters** — gentle ramp into AI as literacy, no fear required.
- **Active builders** — sharp, current, opinionated knowledge in 5–10 minute bursts to keep their edge.

The product is a single-page web app. No backend is required for v1. State persists per device in `localStorage`. Identity uses Gmail-only sign-in via Google Identity Services.

## 2. Quick install

Prereqs: Node 20+ (Node 22 tested), npm 10+.

```bash
git clone https://github.com/oznakash/learnai.git
cd learnai
npm install      # delegates to ./app
npm run dev      # local dev at http://localhost:5173
npm test         # vitest (39 tests)
npm run build    # production build → ./dist (repo root)
npm run preview  # preview production build locally
```

That's it. The built `./dist/` directory at the repo root is a static site you can drop on any host. Output is committed to the repo and kept in sync by GitHub Actions on every push to `main`, so static-mirror deployers (e.g. an nginx PaaS that doesn't run a build step) serve a working SPA immediately without any build configuration.

## 3. Configuration checklist

BuilderQuest works with zero configuration in **demo mode**. For real Gmail auth and dynamic content, do the following:

### 3a. Google OAuth Client ID (required for real Gmail sign-in)

1. Open [console.cloud.google.com](https://console.cloud.google.com).
2. Create a project (or pick an existing one) → APIs & Services → Credentials.
3. Create an **OAuth client ID** with type **Web application**.
4. Under **Authorized JavaScript origins**, add every URL where the app runs:
   - `http://localhost:5173` for local dev
   - your deployment URL (e.g. `https://builderquest.app`)
5. Copy the client ID — it ends in `.apps.googleusercontent.com`.
6. Paste it on the BuilderQuest sign-in screen, or pre-fill via Settings.

The client ID is stored locally in `localStorage`. Players can update it any time from Settings.

### 3b. AI provider key (optional — unlocks unlimited fresh content)

To let the app generate fresh Sparks on demand, players can paste an **Anthropic** or **OpenAI** key into Settings. The key is stored client-side and used to call the provider directly from the browser.

> For multi-tenant production deployments you should proxy AI calls through your own backend so keys are never exposed.

### 3c. Admin allowlist (for the Admin Console)

The Admin Console is gated by an allowlist of Gmail addresses. The first time you visit Settings → Admin → Bootstrap, the currently signed-in email is added as the seed admin. From there, admins can add or remove other admin emails.

### 3d. Brand & defaults (optional)

In the Admin Console → Config tab, set:
- App name, accent color, hero copy
- Default daily minutes for new users
- Whether demo mode and API keys are allowed for end users
- Public leaderboard on/off

## 4. How a player uses it (UX walk-through)

### First-time visit

1. **Sign-in screen** — paste Google Client ID (or use demo mode) and continue with Google. Only `@gmail.com` addresses are accepted.
2. **Onboarding wizard** (6 steps, ~90 seconds total):
   - Name
   - Age (kid / teen / adult — content tone adapts)
   - Skill level (Curious starter → Frontier visionary)
   - Interests (pick at least one Constellation)
   - Daily minutes (5 / 10 / 20 / 45)
   - Goal (preset or freeform)
3. **Home** — "Today's quest" card points at the least-recently-touched Constellation in your interests. Animated mascot greets you by name.

### Returning player loop

1. Open the app → **Home** computes today's target Constellation and how many Sparks fit your daily minutes.
2. Tap **▶ Start Spark**.
3. **Play screen** serves Sparks one at a time. Each is 30 sec – 2 min.
4. Mixed exercise types keep the brain fresh: read, pick, match, fill, scenario, build, tip, boss.
5. Wrong answer → mascot turns thoughtful, focus drops by 1, an explanation appears.
6. Right answer → confetti, mascot celebrates, XP awarded.
7. Every ~4 Sparks the system suggests switching to another Constellation for variety.
8. End of level → celebration screen with stats summary, prompt to continue path or jump topics.

### Tabs (bottom bar)

- 🏠 **Home** — Today's Quest, Constellation grid, stats trio.
- ✅ **Tasks** — capture YouTube videos, articles, Build Cards. Auto-add from Sparks.
- 📊 **Progress** — global dashboard with sparkline, radar, ring, bars, heatmap, badges.
- 🏆 **Guild** — leaderboard with bot Guild members + your tier.

### Other entry points

- **TopBar** chips — Streak, XP, Focus, Tier always visible.
- **Avatar** in TopBar → Settings (profile, API key, OAuth client, prefs, admin entry, sign-out, erase data).
- **Recalibrate** button — 5-question check-in that retunes your level + interests.

## 5. Game mechanics in one page

| System | Currency / state | Who awards | Effect |
|---|---|---|---|
| **Synapses ⚡** | XP integer | Every Spark | Drives Guild Tier |
| **Focus 🧠** | 0–5 hearts | Drains 1 on wrong answer; regens 1 / ~18 min | Soft pacing — at 0, only no-fail Sparks (read/tip) earn XP |
| **Build Streak 🔥** | days in a row | One Spark / day | Resets if a day is missed |
| **Guild Tier 🏅** | Builder → Singularity | Calculated from XP | Pride + leaderboard rank |
| **Mastery Core 💎** | Per Constellation | All 10 levels complete | Visible on profile |
| **Boss Cell 👾** | Pass/fail | End of every level | Unlocks next level |
| **Badge** | Unlockable | Rule-based on state | Surprise + delight |

### Tiers
- < 100 ⚡ Builder
- 100+ Architect
- 500+ Visionary
- 1500+ Founder
- 5000+ Singularity

### XP table
| Action | XP |
|---|---|
| MicroRead | +8 |
| Tip & Trick | +5 |
| Quick Pick correct / wrong | +12 / +4 |
| Pattern Match correct / wrong | +12 / +4 |
| Fill the Stack correct / wrong | +12 / +4 |
| Field Scenario correct / wrong | +12 / +4 |
| Build Card "tried" | +20 |
| Boss Cell pass / fail | +60 / +10 |

### Level unlocking
Level 1 of every Constellation is unlocked from start. Level N+1 unlocks when level N is fully complete (or its Boss Cell is passed).

## 6. Content model

12 **Constellations** (topics) × 10 **Levels** each, ~4–6 **Sparks** per level.

```
Topic
└── Level (1..10)
    └── Spark (4..6 per level)
        └── Exercise (one of 8 types)
```

Eight Spark formats:
- 📖 **MicroRead** — 60–120 word concept card with explicit takeaway, plus an illustration.
- 💡 **Tip & Trick** — 30–60 word pro-tip ("apply this today").
- 🎯 **Quick Pick** — multi-choice with instant feedback + explanation.
- 🧩 **Fill the Stack** — cloze (pick the right word for the blank).
- 🔗 **Pattern Match** — match concepts to examples.
- 🧪 **Field Scenario** — real-world setup + "what would you do?"
- 🛠️ **Build Card** — try this in Claude Code (copy-paste a prompt).
- 👾 **Boss Cell** — 3-question end-of-level gate (66% to pass).

The 12 Constellations:
🧠 AI Foundations · 🤖 LLMs & Cognition · 🧬 Memory & Safety · 🎯 AI Product Management · 🛠️ Being an AI Builder · 🛡️ Cybersecurity for AI · ☁️ Cloud Computing · ⚙️ AI Dev Tools · 📈 AI Trends · 🚀 AI Frontier Companies · 📰 AI News & Pulse · 🌐 Open Source AI.

## 7. Architecture

### Layers

```
┌─────────────────────────────────────────────────────────────┐
│  React 19 + Vite 8 SPA                                      │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ App.tsx                                                │ │
│  │ ├── PlayerProvider (Context + useReducer)              │ │
│  │ │     └── PlayerState in localStorage                  │ │
│  │ │                                                      │ │
│  │ ├── Auth: Google Identity Services (Gmail-only)        │ │
│  │ │                                                      │ │
│  │ ├── Views (route-as-state in App.tsx)                  │ │
│  │ │     SignIn · Onboarding · Home · TopicView · Play   │ │
│  │ │     · Tasks · Dashboard · Settings · Leaderboard     │ │
│  │ │     · Calibration · Admin Console                    │ │
│  │ │                                                      │ │
│  │ ├── Game logic (pure functions in src/store/game.ts)   │ │
│  │ │     XP · Focus · Streak · Levels · Recommendations   │ │
│  │ │                                                      │ │
│  │ ├── Content (TS modules in src/content/topics/*.ts)    │ │
│  │ │     12 Constellations × 10 Levels                    │ │
│  │ │                                                      │ │
│  │ └── Visuals (SVG components)                           │ │
│  │       Mascot · Illustrations · Charts · Confetti       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  Optional outbound:                                         │
│  ├── Google Identity Services (sign-in)                     │
│  └── Anthropic / OpenAI API (dynamic Spark generation)      │
└─────────────────────────────────────────────────────────────┘
```

### Routing

There is no react-router. The current view is a tagged union (`type View = { name: "home" } | { name: "topic", topicId } | …`) held in the top-level `Shell` component. This keeps the bundle tiny and the navigation purely functional.

### State management

A single `PlayerProvider` wraps the app. It exposes a typed `usePlayer()` hook with:
- `state` — full PlayerState
- `setState(mutate)` — generic mutator
- `signIn / signOut / setProfile`
- `completeSpark(topicId, levelId, spark, correct)` — applies XP, focus, streak, badges, returns the result + any newly earned badges
- `passBoss / recordSession`
- `setApiKey / setGoogleClientId`
- `addTask / updateTask / removeTask`
- `admin` accessors (when admin)

The reducer auto-persists to `localStorage` after every change.

### File map

```
app/
├── DESIGN_DOC.md       # full game design (root of repo)
├── HOW_IT_WORKS.md     # this file (root of repo)
├── SPRINTS.md          # roadmap (root of repo)
└── app/
    ├── index.html
    ├── tailwind.config.js
    ├── vite.config.ts
    └── src/
        ├── App.tsx                # routing shell
        ├── auth/google.ts         # Gmail-only sign-in
        ├── content/
        │   ├── topics/*.ts        # 12 Constellation seed files
        │   ├── helpers.ts
        │   ├── index.ts
        │   └── generate.ts        # API-key dynamic generation
        ├── store/
        │   ├── PlayerContext.tsx  # state container
        │   ├── game.ts            # pure game logic
        │   └── badges.ts
        ├── views/                 # all top-level pages
        ├── components/            # reusable bits (TopBar, Exercise, …)
        ├── visuals/               # Mascot, Illustrations, Charts, Confetti
        ├── admin/                 # admin console + mock data + store
        ├── types.ts
        └── __tests__/             # Vitest specs
```

## 8. Data, persistence, and privacy

- All player progress lives in `localStorage` under one key (`builderquest:v1`).
- The signed-in identity (email, name, picture) is decoded from Google's ID token client-side and stored in the same blob.
- API keys (if entered) are stored locally and used to call providers directly from the browser. They are never sent anywhere we control.
- Erase everything from Settings → "Erase all local data".

For production multi-user deployments you'd add a backend that:
- Verifies the Google ID token signature server-side.
- Stores `PlayerState` per user in a real database.
- Proxies AI provider calls so user keys aren't exposed.

The whole shape of the app is friendly to that upgrade — the `PlayerContext` would just talk to your API instead of `localStorage`.

## 9. Dynamic content (API key)

When a player has an API key set, the helper at `src/content/generate.ts` can produce fresh Sparks:

```ts
import { generateSparks } from "./content/generate";

const sparks = await generateSparks({
  apiKey,
  provider: "anthropic",        // or "openai"
  topicName: "AI Foundations",
  topicTagline: "What AI is, how it learns…",
  level: 4,
  audience: "active builder, adult",
  count: 3,
});
```

It returns Sparks that match the schema (`microread`, `tip`, `quickpick`) calibrated to topic + level + audience. With a key, the content stream is effectively unlimited. The Admin Console exposes a generation playground for admins to validate prompts before they ship to users.

## 10. Admin Console

The Admin Console is reachable from Settings (visible only to admins). It has **seven tabs**, exposing every variable and editable artifact in the product:

- **👥 Users** — list, search, sort, filter (active, banned, by tier). Mock cohort + the current local user; in production talks to admin endpoints. Ban/unban, reset progress, send template email.
- **📊 Analytics** — onboarding funnel (signup → onboarded → first Spark → 1-day streak → 7-day streak), DAU/WAU/MAU, sparks per user, topic popularity, retention table.
- **📧 Emails** — provider + SMTP/credentials + lifecycle template editor with live preview + send-queue. **Real send paths** (browser-safe):
  - **Resend** — paste API key, calls `https://api.resend.com/emails` directly.
  - **SMTP relay** — POST endpoint URL of your own (your backend, n8n, Make, Cloudflare Worker) which receives `{from, to, subject, html, smtp, …}` and opens the SMTP socket on its end. Optional bearer auth. SMTP host/port/user/pass fields are still here for the relay to read.
  - **EmailJS** — service id + template id + public user id, browser-safe by design.
  - Postmark / SendGrid / SES — accepted in the type, but the UI warns to wire them through a server-side relay.
  - **none** — leaves messages in the local queue.
  Default templates: Welcome, First Spark, Daily reminder, Streak save, Weekly digest, Re-engagement, Level up, Boss beaten. The "Send queue" button actually flushes the queue using the configured provider; per-message status (queued / sent / failed + error) is shown.
- **🎮 Tuning** — every variable in the game. XP table per Spark type, Focus regen, max focus, Guild Tier thresholds, Boss pass ratio. Changes apply immediately at runtime.
- **📚 Content** — read/write the entire curriculum. Pick any topic, edit it as JSON, save → it overrides the seed. Reset to seed any time. Export + import the whole override bundle (or a Topic[] array) for version control.
- **📝 Prompt Studio** — assembles the **long content-generation prompt** with topic / level / count / audience / custom note.
  - With an API key (Anthropic or OpenAI, in Settings): one-click generation, validates JSON, lets you append the new Sparks straight into a chosen topic + level.
  - Without an API key: copy the prompt, paste it into Claude/ChatGPT/Gemini/etc., paste the JSON response back. Same insertion path.
  - The same prompt is used by the `generateSparks()` library function, so both flows produce identical content.
- **⚙️ Config** — feature flags (allow demo mode, allow API keys, public leaderboard, voice mode, Build Card verification), default daily minutes, brand name, accent color, logo emoji, admin email allowlist, per-user daily token cap.

All admin settings are stored in `localStorage` under `builderquest:admin:v1`. In a production deployment with a backend, this same UI would talk to admin endpoints — the layout and types are designed to be portable.

To bootstrap admin access on first run, sign in with the email you want to be the seed admin, then open Settings → Admin → "Bootstrap me as admin". After that you can manage the full allowlist from the Config tab.

## 11. Deployment

The app builds to a static directory. The repo is structured so that **running `npm install && npm run build` at the root works on any cloud deployer** — the root `package.json` delegates to `./app`. Output is in `app/dist/`.

### Easiest paths

- **Docker / nginx** (most universal): `docker build -t builderquest .` then `docker run -p 80:80 builderquest`. The included `Dockerfile` is a multi-stage build (Node → nginx alpine) with a tuned `nginx.conf` that enables gzip, long-cache hashed assets, and SPA fallback (`try_files … /index.html`).
- **Vercel**: connect the repo. `vercel.json` already points the build to `app/`.
- **Netlify**: connect the repo. `netlify.toml` already sets `base = "app"`.
- **Cloudflare Pages**: build command `npm run build`, output `app/dist`.
- **Render / Railway / Fly**: a Docker deployment using the included `Dockerfile` is the fastest path.
- **GitHub Pages**: run `npm run build` locally, push `app/dist/` to a `gh-pages` branch.
- **S3 / CloudFront**: `aws s3 sync app/dist/ s3://your-bucket --delete`.

### Got the nginx welcome page?

That means the host is up but no build was placed in the web root. The repo now ships with a **prebuilt `/dist/`** at the root, kept fresh by GitHub Actions on every push to `main`. So most static-mirror deployers will serve a working SPA immediately without any build step.

If your platform still serves the welcome page:

1. **Point its web root at `/dist/`** (not the repo root).
2. Or use the included `Dockerfile` — it builds + swaps nginx's content for you.
3. Or set its build command to `npm run build` and its output directory to `dist`.

The `vercel.json`, `netlify.toml`, and `static.json` files at the repo root already do this for those platforms.

### After deployment

**Add the deployed URL** to your Google OAuth client's Authorized JavaScript origins so sign-in works. The Client ID is per-origin — `localhost:5173`, `your-staging.example.com`, and `your-prod.example.com` all need to be listed there.

## 12. Testing

Vitest with jsdom. Run all tests:

```bash
npm test
```

Current suite (33+ tests) covers:
- XP, focus, streak, recommendations
- Level unlocking + per-topic completion
- Badge rules + idempotency
- Content shape integrity (every level has the right index, every quickpick answer is in range, etc.)
- Auth helpers (`isGmail`, JWT decoding)
- Admin allowlist + email template substitution

Add a new test for any new game logic or content rule — the suite is fast (< 2 sec).

## 13. Extending the app

### Add a Constellation

1. Create `src/content/topics/your-topic.ts` exporting a `Topic` object.
2. Add the file to the imports + `TOPICS` array in `src/content/index.ts`.
3. Add the new id to the `TopicId` union in `src/types.ts`.
4. Run `npm test` — content shape tests will guard you.

### Add a Spark format

1. Add the new variant to `Exercise` in `src/types.ts` plus a discriminator string.
2. Handle XP scoring in `xpForExercise` (`src/store/game.ts`).
3. Add a renderer in `src/components/Exercise.tsx`.
4. Add validation in `isValidSpark` in `src/content/generate.ts` if the generator should produce it.

### Add a Badge

Add an entry to `BADGES` in `src/store/badges.ts`. Each badge is `{ id, name, emoji, description, rule(state) → boolean }`. Awards are evaluated automatically after every Spark.

### Add an admin tab

1. Add a view module under `src/admin/`.
2. Register the tab in `src/admin/AdminConsole.tsx`.

## 14. FAQ / Troubleshooting

**Sign-in popup says "OAuth client not found".**
The Google Client ID is wrong, or its Authorized JavaScript origins doesn't include the URL you're using. Open the cloud console and add the URL.

**"This origin is not allowed for the OAuth client."**
Same fix as above. After saving the change, hard-refresh the page.

**My streak reset overnight.**
A day was missed. Streaks reset to 1 if you skip a calendar day. (Streak freezes are on the v3 roadmap.)

**Focus stuck at 0.**
It regenerates 1 every ~18 minutes. Read MicroReads or Tips while you wait — they don't drain Focus and still earn XP.

**The dashboard is empty.**
You have no completed Sparks yet — finish a few from the Home page and the charts will fill in.

**I want to wipe everything and start over.**
Settings → Erase all local data → confirm. This clears `localStorage` for the app and reloads.

**Where do I file bugs / requests?**
Open a GitHub issue at `oznakash/learnai`.

---

That's everything. For deep design, head to [DESIGN_DOC.md](./DESIGN_DOC.md). For the next chunks of work, see [SPRINTS.md](./SPRINTS.md).
