# LearnAI — Design Document

> A gamified, micro-dosed AI playbook for builders.
> Inspired by Duolingo. Built for short bursts, deep over time.

---

## Table of contents

1. [Why this exists](#1-why-this-exists)
2. [Why we borrow from Duolingo](#2-why-we-borrow-from-duolingo)
3. [Players & personas](#3-players--personas)
4. [Game terminology](#4-game-terminology)
5. [Topics (Constellations) and curricula](#5-topics-constellations-and-curricula)
6. [Mechanics](#6-mechanics)
7. [Spark formats (exercise types)](#7-spark-formats-exercise-types)
8. [Registration & sign-in (Gmail-only)](#8-registration--sign-in-gmail-only)
9. [Onboarding](#9-onboarding)
10. [Daily session loop](#10-daily-session-loop)
11. [Recalibration](#11-recalibration)
12. [Tasks (light task manager)](#12-tasks-light-task-manager)
13. [Progress, stats, and visuals](#13-progress-stats-and-visuals)
14. [Leaderboard / Guild Tier](#14-leaderboard--guild-tier)
15. [Badges](#15-badges)
16. [Personalization](#16-personalization)
17. [Dynamic content generation](#17-dynamic-content-generation)
18. [Visual design](#18-visual-design)
19. [Tech stack](#19-tech-stack)
20. [Data model](#20-data-model)
21. [Privacy & data](#21-privacy--data)
22. [Roadmap](#22-roadmap)

---

## 1. Why this exists

The AI field moves fast. The standard ways to learn it are bad for builders:

- **Long courses** are too slow and too generic.
- **Twitter / news** is firehose noise.
- **Cookbooks** teach syntax but not judgment.

Active AI builders need a way to **drip-feed sharp, current, opinionated knowledge** into 5–10 minute windows — and stay engaged long enough to compound real expertise. Curious starters need an on-ramp that doesn't feel intimidating.

LearnAI is built for both: ramp up beginners gently, sharpen seasoned builders weekly, and **push them to actually try things in Claude Code** (not just read).

## 2. Why we borrow from Duolingo

Duolingo nailed habit-forming education by combining a few simple things:

| Mechanic | Why it works |
|---|---|
| 5–10 min lessons | Low friction → daily use → compounding learning |
| Streaks + XP + hearts | Loss-aversion + variable reward |
| Skill tree / path | Visible progress, "I can see what's next" |
| Mixed exercise formats | Variety beats monotony, stays fresh |
| Instant feedback + sound + delight | Dopamine loop |
| League / leaderboard | Social pressure + identity |
| Daily quests | Fresh goal every day |

We adapt every one of these for AI builders.

## 3. Players & personas

The game adjusts to two core dimensions:

- **Age band:** `kid` (<13), `teen` (13–17), `adult` (18+) — affects language, examples, depth, and visuals.
- **Skill level:** Curious starter → Hobby explorer → Active builder → Senior architect → Frontier visionary.

Personas we serve:

- **The Curious Starter** (any age) — never built with AI, wants to start without fear.
- **The Working PM / Engineer** — building AI features but knows there are gaps.
- **The Senior Architect** — wants to stay current on frontier shifts.
- **The Kid** — wants a gentle, fun on-ramp to AI as literacy.

## 4. Game terminology

| Term | What it means |
|---|---|
| **Constellation** | A topic (e.g. AI Foundations, Cybersecurity) — a curriculum cluster of 10 levels. |
| **Spark** ⚡ | A single bite-sized exercise (~30s–2 min). 4–6 sparks per level. |
| **Synapses** ⚡ | XP. Earned per spark. Drives Guild Tier. |
| **Focus** 🧠 | Lives / hearts. 5 max. Drains 1 on a wrong answer. Refills 1 every ~18 min. |
| **Build Streak** 🔥 | Days in a row you completed at least one spark. |
| **Mastery Core** 💎 | Awarded for finishing all 10 levels of a Constellation. |
| **Build Card** 🛠️ | A "try this in Claude Code" challenge with a copy-paste prompt. |
| **Field Scenario** 🧪 | A real-world "what would you do?" situation. |
| **Boss Cell** 👾 | End-of-level multi-question check. Required to unlock the next level. |
| **Tip & Trick** 💡 | A short pro-tip card sprinkled through topics. |
| **Guild Tier** 🏅 | Player rank by total Synapses: Builder → Architect → Visionary → Founder → Singularity. |
| **Recalibrate** 🎯 | A 5-question + interest check that adjusts the game to you. |

## 5. Topics (Constellations) and curricula

12 Constellations ship by default. Each has 10 levels. Each level is 4–6 Sparks (~5 min total).

| Constellation | Tagline |
|---|---|
| 🧠 AI Foundations | What AI is, how it learns, why it works (or doesn't). |
| 🤖 LLMs & Cognition | Inside the language brain: prompting, attention, reasoning. |
| 🧬 Memory & Safety | RAG, memory layers, alignment, safe-by-design AI. |
| 🎯 AI Product Management | Ship AI features users actually use and trust. |
| 🛠️ Being an AI Builder | Mindset, workflow, and stack of a modern AI builder. |
| 🛡️ Cybersecurity for AI | Threats, defenses, AI-specific attack surfaces. |
| ☁️ Cloud Computing | Where AI runs: compute, storage, GPUs, networks. |
| ⚙️ AI Dev Tools | Claude Code, Cursor, Copilot, agentic IDEs. |
| 📈 AI Trends | Where the field is moving — and why builders care. |
| 🚀 AI Frontier Companies | Anthropic, OpenAI, Google, Meta, xAI, Mistral, more. |
| 📰 AI News & Pulse | How to read the firehose without drowning. |
| 🌐 Open Source AI | Trendy projects you should know — and use. |

Each Constellation curriculum:

1. **Level 1** — Mental model. The "what" and "why" in plain English.
2. **Levels 2–4** — Core primitives. Foundational ideas you'll touch every week.
3. **Levels 5–7** — Production realities. Trade-offs, costs, evaluation.
4. **Levels 8–9** — Specialization & frontier. Deeper or more advanced material.
5. **Level 10** — Boss Cell. Final gate to claim the Mastery Core.

Difficulty starts gentle, ramps up. Even very advanced topics are explained in plain language with concrete examples. **Every topic includes 💡 Tip & Trick cards** sprinkled throughout — practical micro-advice you can apply today.

## 6. Mechanics

### XP (Synapses ⚡)

| Action | XP |
|---|---|
| MicroRead read | +8 |
| Tip & Trick | +5 (configurable per tip) |
| Quick Pick correct | +12 |
| Quick Pick wrong | +4 (still a participation bump) |
| Pattern Match | +12 / +4 |
| Fill the Stack | +12 / +4 |
| Field Scenario | +12 / +4 |
| Build Card "tried" | +20 |
| Boss Cell passed | +60 |
| Boss Cell failed | +10 |

### Focus (🧠)

- 5 max. Decreases by 1 on each *wrong* assessment answer.
- Regenerates 1 every ~18 minutes.
- At 0, the player is gently nudged to take a break or do a MicroRead/Tip (no focus drain).

### Build Streak (🔥)

- Increments by 1 per day with at least one Spark.
- Resets to 1 if a day is missed.

### Guild Tier (🏅)

- **Builder** < 100 ⚡
- **Architect** 100+ ⚡
- **Visionary** 500+ ⚡
- **Founder** 1500+ ⚡
- **Singularity** 5000+ ⚡

### Level unlocking

- Level 1 of every Constellation is unlocked from the start.
- Level N+1 unlocks when level N is fully completed (or its Boss Cell passed).

## 7. Spark formats (exercise types)

Variety is the engine. Each level mixes 3–5 of these:

| Format | Purpose | Example |
|---|---|---|
| 📖 **MicroRead** | 60–120 word concept card with an explicit takeaway. Includes a small SVG illustration. | "Tokens, not words" |
| 💡 **Tip & Trick** | 30–60 word pro-tip card. Quick win you can apply today. | "Drop 'think step by step' to gain ~10% accuracy on hard prompts." |
| 🎯 **Quick Pick** | Multiple choice. Instant feedback + explanation. | "What does an LLM literally output?" |
| 🧩 **Fill the Stack** | Cloze exercise — pick the right word for the blank. | "Each API call pays for ___." |
| 🔗 **Pattern Match** | Drag/click to match pairs (concept ↔ example). | "Match each AI flavor to what it does." |
| 🧪 **Field Scenario** | A 2-line setup, then "what would you do?" multiple choice. | "Your agent can pay invoices…" |
| 🛠️ **Build Card** | Copy-paste a prompt, run in Claude Code, mark when tried. | "Build a tiny semantic search in 20 lines." |
| 👾 **Boss Cell** | 3-question level final. ≥ 66% to pass. | End-of-level gate. |

## 8. Registration & sign-in (Gmail-only)

We use **Google Identity Services (GIS)** for one-tap-style sign-in. Only Gmail (`@gmail.com`) addresses are accepted — Workspace and other domains are rejected with a clear error.

### Why Gmail-only

- Lowest-friction onboarding for the broadest builder audience.
- One identity primitive for cohorts and (future) social leaderboard.
- No password reset support to maintain.

### Setup (deployer's responsibility)

1. Open `console.cloud.google.com` → APIs & Services → Credentials.
2. Create an OAuth client ID (Web). Add your deployment URL to **Authorized JavaScript origins**.
3. Paste the client ID into LearnAI's sign-in screen (or pre-fill via Settings).

The Client ID is stored in localStorage. The user's identity (email, name, picture) is decoded client-side from the returned ID token. For production, you should also verify the JWT signature with Google's certs in your backend.

### Demo mode

A "Skip OAuth" demo mode lets a developer enter a Gmail address without real OAuth (still rejects non-Gmail) — useful for local trials. Clearly labeled.

## 9. Onboarding

A 6-step wizard, friendly mascot:

1. **Name** — what should we call you?
2. **Age** — affects language + examples (kid/teen/adult bands).
3. **Skill level** — Curious starter → Frontier visionary.
4. **Interests** — pick 1–N Constellations.
5. **Daily time** — 5 / 10 / 20 / 45 minutes.
6. **Goal** — preset or freeform ("Ship my first AI feature", etc.).

Saves a `PlayerProfile` and immediately lands you on Home. All fields are editable from Settings later.

## 10. Daily session loop

Returning user:

1. **Home** opens with a "Today's quest" card pointing at the **least-recently-touched Constellation** in your interests.
2. The system computes how many Sparks you can fit in your daily minutes (avg ~1.5 min/spark).
3. You hit ▶ Start. The Play screen serves Sparks one at a time.
4. After every 4 Sparks (configurable), a **switch suggestion** appears: "Try a quick {emoji} {Topic} to keep your brain fresh." You can ignore.
5. At the end of a level, a **celebration screen** with confetti + mascot wow + summary stats.
6. Suggested next: stay on this Constellation, or jump to another.

Switching mid-session: tap the topic chip → quick switcher.

Exit anytime — progress is saved per Spark.

## 11. Recalibration

From time to time (and on demand from Home), the player can take a **Recalibrate**:

- 5 quick questions across topics → suggests a new skill level (Starter → Architect).
- An "interests" pass → updates which Constellations are featured.
- Applies the new level/interests to the profile and goes back to Home.

This keeps the difficulty curve honest as the player grows.

## 12. Tasks (light task manager)

Tasks live in their own tab. Use them to capture work that happens *outside* a Spark.

- **Task kinds:** Watch (YouTube), Read (article), Build (Claude Code prompt), Explore, Custom.
- **Source:** auto-tagged when you tap **＋ Task** on a Spark in Play (preserves topic + level + spark).
- **Statuses:** Todo / Doing / Done.
- **Filters + counts.**
- **Build tasks** include a "Copy prompt" button so you can paste it straight into Claude Code.
- Completing tasks earns badges (`task-1`, `task-10`).

## 13. Progress, stats, and visuals

We give players visibility from three angles, with **stats and pretty graphs**:

### Global Dashboard

- Stats: Synapses, Streak, Sparks, Accuracy.
- 14-day **Sparkline** of activity.
- **Radar** chart of completion across 8 Constellations.
- **Bar chart** of Sparks per Constellation.
- **12-week heat map** of daily activity.
- Per-Constellation cards with Ring + numbers.
- **Badges grid** (earned vs. locked).

### Per-Constellation page

- **Completion ring** (% complete).
- Big stats: levels done, accuracy, time invested.
- **Bars** of Sparks per level.
- 14-day topic-specific **Sparkline**.
- **The Path** — vertical timeline of all 10 levels with progress bars.

### Home

- Today's Quest card with target topic + mascot.
- Big synapse + streak + activity Sparkline trio.
- Constellation grid with progress bars.

## 14. Leaderboard / Guild Tier

A **Guild leaderboard** shows your rank against the Guild (currently a curated set of friendly bot players you can climb past). Real cohort sync is on the roadmap — once we have a backend, the same UI flips to your real cohort.

Tiers (Builder → Singularity) are universal and earned via Synapses. Visible everywhere.

## 15. Badges

14 badges in v1, covering 4 dimensions:

- **First-time milestones** (`first-spark`)
- **Streaks** (3, 7, 30 days)
- **XP tiers** (100, 500, 1500, 5000)
- **Boss kills** (1, 5)
- **Polymath** (touched 3 / 6 different Constellations)
- **Task master** (1, 10 tasks completed)

Each is a `{ id, name, emoji, description, rule(state)→bool }`. Awarded automatically after each Spark when the rule first flips true. Confetti on award.

## 16. Personalization

- **Persona:** built from age band + skill level + interests.
- **Daily volume:** session size scales to player's chosen daily minutes.
- **Topic suggestion:** Home picks the least-recently-touched interest for variety.
- **Switch suggestion:** every 4 Sparks, the system suggests a topic switch.
- **Recalibration:** rebuilds level + interests on demand.
- **Future:** age band ramping language difficulty (current scaffolding present, content tags TBD).

## 17. Dynamic content generation

The seed ships with 12 Constellations × 10 levels (~30+ Sparks per Constellation including all variants). For unlimited fresh content, the player can paste an **Anthropic** or **OpenAI** API key into Settings.

When set, the `generateSparks(...)` utility (`src/content/generate.ts`) calls the provider directly with a tight system prompt and returns validated Sparks (`microread | tip | quickpick`) calibrated to the topic + level + audience.

> Note: For production use, route the API call through your own server. The browser-direct approach is fine for local/single-user playgrounds.

## 18. Visual design

- **Dark, vivid UI** with soft gradients, glassy cards, glowing accents.
- **Mascot** ("Synapse") — animated SVG with 6 moods (neutral, happy, thinking, wow, sad, wink). Reacts to correct/wrong/celebrate.
- **20 hand-drawn-style SVG illustrations**, one per visual key (`neural`, `embed`, `tokens`, `shield`, `cloud`, `rocket`, etc.). Used in MicroReads and topic cards.
- **Confetti canvas** on correct answers and badges.
- **Charts:** Sparkline, Bars, Ring, Radar, Heat — all custom SVG, lightweight.
- **Animations:** float, pop, wiggle, ring stroke transitions.
- **Color identity per topic** (each Constellation has its own accent color).

The whole UI is designed to **feel fast, dopamine-rewarding, and a little bit silly** — endorphins on tap.

## 19. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind 3 + custom utility components |
| State | React `useReducer` + Context, persisted to `localStorage` |
| Auth | Google Identity Services (Gmail-only) |
| AI provider (optional) | Anthropic (Claude) or OpenAI (GPT) directly from browser |
| Tests | Vitest + jsdom |
| Hosting | Static (works on any: Vercel, Netlify, GitHub Pages, Cloudflare Pages) |

No backend. State is local. Identity is verified client-side (production should also verify on a server).

## 20. Data model

The full schema lives in `src/types.ts`. Core types:

- `Topic { id, name, emoji, color, visual, levels[10] }`
- `Level { id, index, title, goal, estMinutes, sparks[] }`
- `Spark { id, title, exercise }`
- `Exercise = MicroRead | Tip | QuickPick | PatternMatch | FillStack | Scenario | BuildCard | Boss`
- `PlayerProfile { name, ageBand, skillLevel, interests, dailyMinutes, goal, … }`
- `PlayerState { profile, identity, xp, focus, streak, badges, guildTier, progress, history, tasks, apiKey, … }`
- `Task { id, kind, title, notes, url, promptToCopy, source, status, … }`

## 21. Privacy & data

- All progress is stored in `localStorage` on the player's device. No tracking.
- Sign-in identity (email, name, picture) is stored locally too — never sent to any server we control (we don't have one).
- API keys (if set) are stored locally and used only to call the provider directly.
- Erasing data: Settings → "Erase all local data".

## 22. Roadmap

### Now (v1, shipped)

- Gmail sign-in, onboarding, 12 topics × 10 levels of seed content.
- Game loop with 8 exercise types (incl. Tip & Trick).
- Tasks tab with auto-add from Sparks.
- Per-topic + global dashboards with charts.
- Local leaderboard with bots.
- Calibration flow.
- Badges, streaks, XP, Focus.
- Optional API-key-driven content generation.

### Next (v2)

- Real cohort leaderboard (cloud sync via simple backend).
- Sound + haptic micro-effects.
- Daily reminder notifications (web push).
- More age-band content variants (kid-friendly mode).
- Collaborative "Guilds" — invite-only cohorts.
- Streak freezes (1 per week) so a missed day doesn't reset.
- Public skill profile shareable as a link.

### Later (v3)

- Multi-language (auto-translate Sparks).
- Voice mode (listen + answer).
- Native mobile wrapper.
- Verified Build Card completions (lightweight integration with Claude Code).

---

Built with care for builders, beginners, and the curious.
