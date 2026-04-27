# BuilderQuest 🚀

> A gamified, micro-dosed AI playbook for builders — Duolingo-style.

BuilderQuest helps active AI builders **stay sharp in 5–10 minute bursts**, and helps curious starters **ramp up without fear**. Pick a topic, run a Spark, watch your Build Streak climb. 12 topics, 10 levels each, hundreds of bite-sized exercises — plus optional API-key-driven dynamic content.

📘 Docs:
- **[HOW_IT_WORKS.md](./HOW_IT_WORKS.md)** — install, configure, mechanics, UX, architecture.
- **[DESIGN_DOC.md](./DESIGN_DOC.md)** — full game design rationale.
- **[SPRINTS.md](./SPRINTS.md)** — the next 5 sprints (starter → deep researcher).

## Highlights

- 🧠 12 Constellations × 10 Levels: AI Foundations, LLMs, Memory & Safety, AI PM, Builder mindset, Cybersecurity, Cloud, AI Dev Tools, AI Trends, Frontier Companies, AI News, Open Source AI.
- ⚡ 8 Spark formats: MicroRead, Tip & Trick, Quick Pick, Pattern Match, Fill the Stack, Field Scenario, Build Card (try in Claude Code), Boss Cell.
- 🎯 Personalized: age band (kid/teen/adult) + skill level + interests + daily time.
- 🔥 Build Streaks, Synapses (XP), Focus (lives), Badges, Guild Tiers (Builder → Singularity).
- 📊 Per-topic + global dashboard with stats, sparklines, radar, heatmap, rings, bars.
- ✅ Tasks tab — capture YouTube watches, articles to read, Build Cards to try.
- 🎯 Recalibration — quick check-ins to keep difficulty honest.
- 🎨 Vivid mascot, confetti, 20+ illustrations, glowing UI.
- 🔐 **Gmail-only sign-in** via Google Identity Services.
- 🤖 Optional Anthropic / OpenAI API key for unlimited fresh content.
- 🛠 **Admin Console** — Users management, Analytics, Lifecycle Emails (with template editor + live preview), Branding & Config. Gated by Gmail allowlist.

## Quick start

```bash
# from the repo root
npm install     # installs the app workspace under ./app
npm run dev     # dev server
npm test        # vitest (39 tests)
npm run build   # production build → ./dist (repo root)
```

> The real project lives in `./app`. The root `package.json` delegates every script there, so most cloud deployers ("`npm install && npm run build`") just work without configuration. The built output lands in `/dist/` at the repo root and is **committed + kept fresh by GitHub Actions** so static-mirror deployers serve a working SPA immediately.

## Deploy

The output is a static SPA — works on any static host.

| Host | How |
|---|---|
| **Static-mirror deployers** (cloud-claude.com, etc.) | Point the web root at `/dist/`. The repo ships a prebuilt SPA there, kept fresh by GitHub Actions. No build step required. |
| **Docker / generic nginx** | `docker build -t builderquest .` → `docker run -p 80:80 builderquest`. Multi-stage build → nginx alpine, gzipped, hashed-asset caching, SPA fallback to `index.html`. |
| **Vercel** | Push the repo. `vercel.json` already points the build to `./dist`. |
| **Netlify** | Push the repo. `netlify.toml` already publishes `./dist`. |
| **Cloudflare Pages / Render / Railway** | Build command `npm run build`, output `dist`. |
| **GitHub Pages / S3 / CloudFront** | The committed `/dist/` can be served directly. |

If your host shows the **default nginx welcome page**, point its web root at `/dist/`. The repo now ships a prebuilt SPA there, so a build step at the host is no longer required.

## Sign-in setup

BuilderQuest uses Google Identity Services for Gmail-only auth.

1. Open [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create an **OAuth client ID** (Web application).
3. Add your deployment URL (e.g. `https://builderquest.app`) under **Authorized JavaScript origins**.
4. Copy the client ID — paste it on the BuilderQuest sign-in screen.

Or use **Demo mode** to skip OAuth setup and just enter a Gmail address (still rejects non-Gmail). Useful for local trial.

## Optional: dynamic content

Settings → API key → paste an Anthropic or OpenAI key. The app can then generate fresh Sparks calibrated to your topic + level + audience. Keys are stored in your browser only.

## Admin Console

Settings → **Bootstrap me as admin** (first time, the signed-in Gmail becomes the seed admin) → **Open Admin Console**.

The console has four tabs:
- **👥 Users** — search, filter, sort; ban/unban, reset progress, send any enabled lifecycle template to a user (queues outbound).
- **📊 Analytics** — onboarding funnel (signup → onboarded → first Spark → 1d streak → 7d streak), DAU/WAU/MAU, signup sparkline, topic popularity, cohort retention table, power users.
- **📧 Emails** — choose a provider (Resend, Postmark, SendGrid, SES, generic SMTP, or queue-only) + edit any of the 8 lifecycle templates with **live HTML preview** and `{{placeholder}}` substitution.
- **⚙️ Config** — branding (app name, accent colors, logo), feature flags, default daily minutes, per-user token cap, admin allowlist.

All admin state is stored in `localStorage` under `builderquest:admin:v1`. In a production deployment with a backend, the same UI would talk to admin endpoints — the layout and types are designed to be portable.

## Tech

React 19 · Vite 8 · TypeScript · Tailwind 3 · Vitest · Google Identity Services. No backend. State persists to `localStorage`.

## Project layout

```
app/
├── src/
│   ├── App.tsx                    # routing shell
│   ├── auth/google.ts             # Gmail-only sign-in
│   ├── content/                   # 12 topic seed files
│   │   ├── topics/
│   │   ├── helpers.ts
│   │   ├── index.ts
│   │   └── generate.ts            # dynamic generation utility
│   ├── store/
│   │   ├── PlayerContext.tsx      # state container
│   │   ├── game.ts                # XP, streak, focus, completion logic
│   │   └── badges.ts
│   ├── views/                     # Sign-in, Onboarding, Home, TopicView,
│   │                              # Play, Tasks, Dashboard, Settings,
│   │                              # Leaderboard, Calibration
│   ├── components/                # TopBar, TabBar, Exercise, AddToTaskButton
│   ├── visuals/                   # Mascot, Illustrations, Charts, Confetti
│   ├── admin/                     # Admin Console + types + mock data + store
│   ├── types.ts
│   └── __tests__/                 # Vitest
└── ...
```

## License

MIT.
