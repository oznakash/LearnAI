# BuilderQuest 🚀

> A gamified, micro-dosed AI playbook for builders — Duolingo-style.

BuilderQuest helps active AI builders **stay sharp in 5–10 minute bursts**, and helps curious starters **ramp up without fear**. Pick a topic, run a Spark, watch your Build Streak climb. 12 topics, 10 levels each, hundreds of bite-sized exercises — plus optional API-key-driven dynamic content.

📘 See **[DESIGN_DOC.md](./DESIGN_DOC.md)** for the full game design (terminology, mechanics, onboarding, registration, leaderboard, content).

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

## Quick start

```bash
cd app
npm install
npm run dev    # dev server
npm test       # vitest (31 tests)
npm run build  # production build → app/dist
```

The `app/dist` folder is a static site — deploy to Vercel, Netlify, Cloudflare Pages, or any static host.

## Sign-in setup

BuilderQuest uses Google Identity Services for Gmail-only auth.

1. Open [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials.
2. Create an **OAuth client ID** (Web application).
3. Add your deployment URL (e.g. `https://builderquest.app`) under **Authorized JavaScript origins**.
4. Copy the client ID — paste it on the BuilderQuest sign-in screen.

Or use **Demo mode** to skip OAuth setup and just enter a Gmail address (still rejects non-Gmail). Useful for local trial.

## Optional: dynamic content

Settings → API key → paste an Anthropic or OpenAI key. The app can then generate fresh Sparks calibrated to your topic + level + audience. Keys are stored in your browser only.

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
│   ├── types.ts
│   └── __tests__/                 # Vitest
└── ...
```

## License

MIT.
