<div align="center">

![BuilderQuest — the second brain that teaches you AI](./docs/hero.svg)

# BuilderQuest

### The second brain that teaches you AI.

**5-minute bites · personalized to your goals · social by design · open source · forever free.**

[![Tests](https://img.shields.io/badge/tests-100%2F100-success)](./app/src/__tests__) [![Build](https://img.shields.io/badge/build-passing-success)](./.github/workflows/build-and-publish-dist.yml) [![License](https://img.shields.io/badge/license-MIT-blue)](#license) [![Stack](https://img.shields.io/badge/stack-React%20%C2%B7%20Vite%20%C2%B7%20mem0-7c5cff)](#-tech) [![Vibe](https://img.shields.io/badge/vibe-shipping-ff5d8f)](./docs/vision.md)

**Live demo →** [`learnai-b94d78.cloud-claude.com`](https://learnai-b94d78.cloud-claude.com) · **Wiki →** [`docs/INDEX.md`](./docs/INDEX.md) · **Pitch →** [`docs/pitch-deck.md`](./docs/pitch-deck.md)

</div>

---

## 💡 What this is

**BuilderQuest is a second brain that teaches you AI.** It learns your goals, evolves with the field, and connects you with the people learning beside you — five minutes at a time.

Open the app, complete a few **Sparks** (60-second micro-lessons that teach + test + invite you to build). The system *remembers you* — your goals, your gaps, your strengths — and bends the path toward what *you* are trying to build. Every Spark you author is a teaching post for someone else. The curriculum isn't a course; it's a living graph the community grows together.

- **Bite-size by default** — fits the cracks of a working day.
- **Personal, not generic** — a cognition layer (mem0) learns *you*.
- **Always current** — the curriculum is alive, not a 12-week course rotting on week 4.
- **Built for doing** — every level has a Build Card you can paste into Claude Code.
- **Social by design** — your build is a Spark. Your mistake is a Tip. The graph teaches the graph.
- **Open source** — fork it for any domain. The engine is yours.

> *Not a course, not a feed, not a bootcamp. The missing daily habit none of those are shaped to be.*

---

## 🧱 The problem we're solving

AI is reshaping every knowledge job, but every existing way to keep up is broken. People feel guilty, scroll Twitter, save 50 articles, abandon a $300 cohort. Net knowledge gained: low. Net anxiety: high.

| The option | Why it doesn't work |
|---|---|
| **Twitter / LinkedIn feed** | Infinite firehose. Optimized for engagement, not learning. |
| **YouTube** | 60-minute videos when you have 7. No state across sessions. |
| **Coursera / Udemy** | Stale by week 4 in AI. <10% completion rate. |
| **Bootcamps** | $1k–$10k. Cohort-paced. Can't fit a day job. |
| **Vendor academies** | Vendor-locked. No personalization. No social. |
| **Newsletters** | Linear, no path, no progress, no doing. |
| **Duolingo** | Right shape, wrong domain. Languages don't change weekly. AI does. |

Education for fast-moving fields needs four things at once: **bite-size delivery · personalized path · real-time content · practical doing.** Every existing product picks one or two. Until AI made the unit economics work, no one could ship all four.

→ Full breakdown: [`docs/problem.md`](./docs/problem.md).

---

## 🎯 Mission

**Make every builder confident, current, and shipping** — from a 12-year-old asking their first question to a researcher tracking the frontier — regardless of where they started.

We do this with a learning experience that is:

- **Bite-size by default.** 5–10 minutes is the unit. Anything longer is the wrong shape for how AI moves.
- **Personal, not generic.** A cognition layer learns *you* — your goals, your gaps, your stack — and bends the path toward what *you* are building.
- **Always current.** The curriculum is a living, evolving body of knowledge that the community + the AI grow together.
- **Built for doing.** Every chunk ends with something you can paste into Claude Code, run, and feel.
- **Social by design.** What you learn is something other people can learn from. Your build is a Spark. Your mistake is a Tip. Your weekly digest is a teaching post.

---

## 🌌 Vision

> **The social network of education for AI builders.** Where the curriculum is a graph, the teachers are the community, and the brain that recommends what you should learn next is *yours, evolved by your own use.*

LinkedIn was the social graph of jobs. Duolingo was the gym of language. **BuilderQuest is the gym + social graph + memory of building in AI** — the place you go every day to stay sharp, to ship, and to find the next people you'll work with.

→ Full vision: [`docs/vision.md`](./docs/vision.md).

---

## ✨ What's in the box (today's MVP)

- 🌌 **12 Constellations × 10 Levels** — ~480 hand-authored micro-lessons across AI Foundations, LLMs & Cognition, Memory & Safety, AI PM, AI Builder mindset, Cybersecurity, Cloud, AI Dev Tools, AI Trends, Frontier Companies, AI News, Open Source AI.
- ⚡ **8 Spark formats** — MicroRead · Tip & Trick · Quick Pick · Pattern Match · Fill the Stack · Field Scenario · Build Card · Boss Cell.
- 🎯 **Personalized onboarding** — age band (kid/teen/adult), skill (starter → researcher), interests, daily minutes, goal.
- 🔥 **Game mechanics** — Synapses (XP) · Focus (regenerating lives) · Build Streak · Guild Tiers · 14 Badges.
- 🧠 **Cognition layer (mem0)** — opt-in, self-hosted, inspectable. Default-off; flip the Offline Mode flag in admin to turn it on.
- 📚 **"Your Memory" tab** — see, edit, forget, wipe, export. Read-write parity is the privacy ethic.
- 📊 **Per-topic + global dashboards** — sparkline, radar, ring, bars, 12-week heatmap.
- ✅ **Tasks tab** — capture YouTube watches, articles, Build Cards. Auto-add from any Spark.
- 🛠 **Admin Console (7 tabs)** — Users · Analytics · Memory · Emails (real send via Resend / SMTP-relay / EmailJS) · Tuning (every game variable live-editable) · Content (edit/import/export topics) · Prompt Studio (the long content-generation prompt) · Config (flags, branding, allowlist).
- 🔐 **Gmail-only sign-in** via Google Identity Services.
- 📦 **Static SPA** that auto-rebuilds on every push to `main`. Deploys anywhere with zero config.

Honest list of what's shipped vs. coming: [`docs/mvp.md`](./docs/mvp.md).

---

## 👥 Who it's for

Builders at every level. The cognition layer adapts so the same product fits a curious 12-year-old, a working PM, and a frontier researcher.

| If you are… | …it works because… |
|---|---|
| **A working PM** who wants to be a builder | 10 min/day fits between your meetings. Build Cards make you a builder, not a reader. |
| **A senior engineer** tracking the frontier | Skip the basics, daily 5-minute "Pulse" of fresh signal. |
| **A curious starter (any age)** | Onboarding adapts. Mascot doesn't condescend. The 12-year-old and the 58-year-old both get traction. |
| **A researcher** who wants to be discoverable | Public profile (coming Sprint 2) shows what you've shipped + taught — better signal than any resume. |
| **A hiring manager** | Talent Match (coming Sprint 4) lets you search the behavioral graph: *"shipped a RAG agent with eval suite in last 90 days."* |
| **An educator** in any fast-moving domain | Fork the engine. 30 minutes from clone to your own community-driven micro-learning app. |

Full personas: [`docs/use-cases.md`](./docs/use-cases.md).

---

## 🚀 Try it

### In a browser, right now

[`https://learnai-b94d78.cloud-claude.com`](https://learnai-b94d78.cloud-claude.com)

(Demo mode is on by default — type any `@gmail.com` address to enter. Real Google sign-in needs an OAuth Client ID; setup in 2 minutes via [`docs/mem0.md`](./docs/mem0.md).)

### Locally

```bash
git clone https://github.com/oznakash/learnai
cd learnai
npm install     # delegates to ./app
npm run dev     # local dev at http://localhost:5173
npm test        # vitest, 100 / 100
npm run build   # static SPA → ./dist
```

> The project lives in `./app`. The root `package.json` proxies every script there. The built output lands in `/dist/` at the repo root and is **auto-committed by GitHub Actions** so static-mirror deployers serve a working SPA immediately.

### Self-host the cognition layer

```bash
# Local (Docker):
cp .env.example .env             # set MEM0_API_KEY + OPENAI_API_KEY
docker compose -f docker-compose.mem0.yml up -d

# Or one-command Fly deploy:
OPENAI_API_KEY=sk-... npm run deploy:mem0
npm run smoke:memory -- https://builderquest-mem0.fly.dev <bearerKey>
```

Full guide: [`docs/mem0.md`](./docs/mem0.md).

---

## 📚 Documentation library — the wiki

Everything is Markdown in [`docs/`](./docs). Strategy, technical, operator. Nothing's hidden in a Notion.

| 🧭 Strategy | 🛠 Technical | 🌍 Community |
|---|---|---|
| [`vision.md`](./docs/vision.md) — mission, end game | [`architecture.md`](./docs/architecture.md) — system diagram | [`contributing.md`](./docs/contributing.md) — how to PR |
| [`problem.md`](./docs/problem.md) — what we're solving | [`technical.md`](./docs/technical.md) — services + types | [`fork-recipe.md`](./docs/fork-recipe.md) — fork for your domain |
| [`use-cases.md`](./docs/use-cases.md) — 7 personas | [`mem0.md`](./docs/mem0.md) — cognition layer | |
| [`competitors.md`](./docs/competitors.md) — landscape | [`ux.md`](./docs/ux.md) — UX of memory | |
| [`pitch-deck.md`](./docs/pitch-deck.md) — 12 slides | | |
| [`mvp.md`](./docs/mvp.md) — what's shipped | | |
| [`roadmap.md`](./docs/roadmap.md) — what's next | | |

→ Full index: [`docs/INDEX.md`](./docs/INDEX.md)

---

## 🏗 Tech

**React 19 · Vite 8 · TypeScript · Tailwind 3 · Vitest** for the SPA.
**mem0 · Postgres + pgvector · Fly.io** for the (optional) cognition layer.
**Google Identity Services** for Gmail-only auth.
No backend at the SPA tier — state persists to `localStorage` until you opt into mem0.

478 KB JS / 29 KB CSS gzipped, 75 modules. 100 / 100 tests across 13 files.

---

## 🤝 Contributing

> _Built for the community of builders, by the community of builders._

Open a PR. Add a Spark. Fix a bug. Improve the brain. Fork the engine for your domain.

**Five flavors of contribution → [`docs/contributing.md`](./docs/contributing.md).**

The 30-second pitch:
- 🐛 Bug fix → PR with a test.
- 📚 New Spark → edit a topic file in `app/src/content/topics/*.ts`, or use the Admin Prompt Studio to generate one.
- 🛠 New Build Card → same. Test it end-to-end first.
- 🌐 New Constellation → open an issue first.
- 🧠 Engine work → standard PR. Tests required.

Every Spark you author is credited to you. When Talent Match ships, your contributions become a search axis recruiters use.

---

## 🏁 The end game

The five-year arc, in one paragraph:

> *Year 1 — first 10k weekly active builders. Year 2 — public profiles + cohort leaderboards. Year 3 — Talent Match: companies search the behavioral graph for "people who shipped X with Y last month" — the **new LinkedIn for AI roles**. Year 4 — forks emerge for kids-AI, on-call drills, sales enablement, climate-tech. Year 5 — the category is named, and BuilderQuest is its default.*

→ Long version: [`docs/vision.md`](./docs/vision.md) · [`docs/roadmap.md`](./docs/roadmap.md).

---

## 🔧 Project layout

```
learnai/
├── README.md                       ← you are here
├── CLAUDE.md                       ← operator manual for AI agents
├── docs/                           ← the wiki (strategy + technical)
│   ├── INDEX.md                    ← documentation table of contents
│   ├── hero.svg                    ← README hero banner
│   ├── vision.md
│   ├── problem.md
│   ├── use-cases.md
│   ├── competitors.md
│   ├── pitch-deck.md
│   ├── architecture.md
│   ├── mvp.md
│   ├── roadmap.md
│   ├── contributing.md
│   ├── fork-recipe.md
│   ├── ux.md                       (cognition-layer UX)
│   ├── technical.md                (engineer's view)
│   └── mem0.md                     (cognition layer in depth)
├── app/                            ← the SPA (React + Vite + Tailwind)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── auth/                   ← Gmail-only sign-in
│   │   ├── content/                ← 12 topic seed files + prompt builder
│   │   ├── store/                  ← PlayerContext, game logic, badges
│   │   ├── memory/                 ← MemoryService (offline + mem0 client)
│   │   ├── admin/                  ← Admin Console (7 tabs)
│   │   ├── views/                  ← Home, TopicView, Play, Tasks, Memory, …
│   │   ├── components/             ← TopBar, TabBar, Exercise renderer
│   │   ├── visuals/                ← Mascot, Illustrations, Charts, Confetti
│   │   └── __tests__/              ← Vitest
│   └── package.json
├── dist/                           ← auto-built static SPA (GitHub Actions)
├── docker-compose.mem0.yml         ← self-host the cognition layer
├── fly.toml                        ← one-command Fly deploy
├── scripts/
│   ├── deploy-mem0.sh              ← idempotent Fly deploy
│   └── smoke-memory.mjs            ← end-to-end smoke test
├── Dockerfile                      ← multi-stage SPA → nginx
├── nginx.conf                      ← gzip, cache, SPA fallback
├── vercel.json · netlify.toml · static.json
└── package.json                    ← root, delegates to ./app
```

---

## 🪪 License

[MIT](./LICENSE) — for the engine *and* every fork. Contribute back.

---

<div align="center">

**Built by builders, for builders. The brain you build by using it.**

→ [Open the live demo](https://learnai-b94d78.cloud-claude.com) · [Read the vision](./docs/vision.md) · [Open a PR](./docs/contributing.md)

</div>
