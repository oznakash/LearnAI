# Pitch deck (text only)

> _12 slides. No fluff. Same argument an investor or strategic partner would hear in a 20-minute meeting._

---

## Slide 1 — Title

**LearnAI** — *the social network of AI education for builders.*

A cognitively personalized, bite-size, real-time learning platform for the millions of working professionals who feel they're falling behind on AI.

---

## Slide 2 — The problem, in one line

> *Tens of millions of professionals know AI is reshaping their job. Every option to "catch up" is broken.*

The four-axis trap:

| Axis | Bootcamp | Coursera | YouTube | Twitter | Newsletters |
|---|:-:|:-:|:-:|:-:|:-:|
| Bite-size | ❌ | ❌ | ❌ | ✅ | ✅ |
| Personalized | ✅ | ❌ | ❌ | ❌ | ❌ |
| Real-time | ❌ | ❌ | mid | ✅ | ✅ |
| Practical (build) | ✅ | mid | mid | ❌ | ❌ |
| **All four** | ❌ | ❌ | ❌ | ❌ | ❌ |

**Nobody is in all four. We are.**

---

## Slide 3 — The shift that makes us possible

In 2024, three things flipped at the same time:

1. **Frontier models** can extract → evaluate → personalize curricula at $0.20/user/year. Used to cost $50/user with human editors.
2. **Memory layers** (mem0, zep) can give every user a persistent cognitive profile. Used to require building from scratch.
3. **Static SPAs + edge compute** make a global daily-habit consumer product runnable for ~$0/month at the SPA tier.

For the first time, the unit economics of a *truly personalized, daily, evolving* learning product work.

---

## Slide 4 — What it is

A web app you open for **5–10 minutes a day**.

- **12 Constellations** (topics) × **10 Levels** each, in 8 micro-formats: read, tip, pick, match, fill, scenario, build, boss.
- **Cognition layer** (self-hosted mem0): the system *remembers you* — your goals, gaps, strengths, stack, preferences. Inspectable, editable, ownable.
- **Build Cards**: every level has a pasteable prompt for Claude Code that produces a tiny working artifact in 5 minutes.
- **Personalized at the day-1 level**: age (kid / teen / adult), skill (starter → researcher), interests, daily minutes, goals.
- **Open source**, MIT-licensed.

Today's MVP runs on any browser. Production deploy ready, 90 unit tests, single-command Fly deploy of the cognition server.

---

## Slide 5 — The wedge audience

We start with **the working AI builder + the curious starter**:

- Working PMs, engineers, designers — people with a job who want to ship AI features.
- People who feel "AI FOMO" daily.
- 5–10 minute consumption pattern fits their life.
- High willingness to pay (eventually) because every minute saved on the firehose is hours of work.

**TAM:** every knowledge worker on Earth, ~1B people. Realistic ceiling at year-5: 50M monthly active.

---

## Slide 6 — Why we win the wedge

1. **The cognition layer is the moat.** Anyone can write Sparks. Few will build a memory layer that *truly* knows what each user has learned. We're already on mem0, self-hosted, end-to-end.
2. **The format is right.** Duolingo proved bite-size habit-forming wins. We bring it to a domain that's 10× more lucrative.
3. **The content compounds.** Every player's interaction makes the system smarter. Every contributed Spark grows the curriculum. Year-2 LearnAI has knowledge no individual instructor could keep up with.
4. **Open source is the multiplier.** We become *infrastructure for community-driven micro-learning* — not just an AI app. (See *Slide 11*.)

---

## Slide 7 — The product roadmap, in three layers

### Layer 1 — The daily habit (today, MVP)

5-minute daily session. Personalized. Memory-aware. Free.

### Layer 2 — The social graph (next 6 months)

Public builder profiles · followers · share what you learned · contributed Sparks credited to authors · weekly digests posted to your timeline.

### Layer 3 — The talent + fork layer (12–24 months)

- **Talent Match**: companies search the behavioral graph (*"shipped a RAG agent with eval suite in last 90 days"*) — this is the **new LinkedIn for AI roles**.
- **Forks**: educators and domain experts clone the engine for their own communities (Spanish, chess, on-call training). The platform becomes infrastructure.

---

## Slide 8 — Competitive landscape

```
                Personalized
                     ▲
                     │
                     │       ╔═══════════════╗
   Bootcamps         │       ║ LearnAI  ║
                     │       ╚═══════════════╝
                     │
   Static ◀────────┼────────▶ Real-time
                     │
   Coursera          │       Twitter
   Udemy             │       Newsletters
                     │
                     ▼
                Generic
```

- **Duolingo** — wrong domain, can't move at AI's pace.
- **LinkedIn** — wrong format, wrong incentives, optimizes for claims not behaviors.
- **Brilliant** — closest cousin, static content.
- **Coursera / bootcamps** — wrong shape, can't compress to 5 minutes.
- **Vendor academies** — locked, funnel-driven.

**No one is in our quadrant.** Full landscape in [`competitors.md`](./competitors.md).

---

## Slide 9 — Business model

**Free forever**: the core habit + the cognition layer + open-source engine.

**Paid tier (post-MVP, opt-in)**:
- Higher daily generation cap on personalized Sparks.
- Verified Build Card completions (signed artifacts shareable to recruiters).
- Priority memory storage + advanced cognition queries.
- Org plans (teams, learning paths, contribution leaderboards).

**Talent Match (post-MVP)**: platform fee per hire from companies. Behavioral search of the public builder graph.

**Forks**: open source. Hosted-fork-as-a-service is a possible future revenue line for non-technical educators.

Reasonable target: **$15/mo Pro, $99/mo Org seat, ~5–10% conversion** at maturity. At 10M MAU this is a ~$1.5–3B revenue line.

---

## Slide 10 — Traction & MVP status (as of today)

**Built and deployed:**
- 12 Constellations, ~480 hand-crafted Sparks, 8 exercise types.
- Gmail-only sign-in (Google Identity Services).
- Cognition layer (offline / mem0) behind a feature flag, default-on for offline.
- Admin Console with 7 tabs: Users, Analytics, Memory, Emails, Tuning, Content, Prompt Studio, Config.
- Email lifecycle pipeline (Resend / SMTP-relay / EmailJS, queue + send-test).
- 90 / 90 Vitest tests across 12 files.
- Static-host deployable (Cloudflare/Vercel/Netlify/Docker/static-mirror).
- One-command Fly deploy for mem0 (`npm run deploy:mem0`) + smoke test.

**Not yet:**
- Public builder profiles + social graph.
- Real cohort leaderboard (currently bots + you).
- Contribution flow.
- Talent Match.
- Mobile native shell.

Full MVP detail in [`mvp.md`](./mvp.md). Next sprints in [`roadmap.md`](./roadmap.md).

---

## Slide 11 — The fork play (the long-term option value)

The same engine — *evolving cognitive micro-learning* — is correct for many domains where:

1. The field changes faster than education can keep up, **or**
2. The audience needs daily-habit micro-learning, **or**
3. There's a community willing to contribute content.

Plausible early forks:

- **AI for kids** (school + home).
- **On-call engineering / SRE drills.**
- **Sales enablement at velocity.**
- **Climate-tech / nuclear / quantum learning communities.**
- **Compliance / regulatory updates** (e.g. EU AI Act).
- **Languages, with a memory layer that actually adapts** (yes, Duolingo could ship this — but won't soon).

The MIT license + the modular architecture mean **one win seeds many.** The brand of the platform compounds across forks.

---

## Slide 12 — The ask

**Today**, we're shipping the MVP and earning daily-habit retention with no marketing.

**Next**, we want partners who can help with:
- **Distribution**: communities of working AI builders.
- **Content seeding**: experts willing to author 5–20 Sparks in their domain.
- **Talent**: 1–2 senior engineers with deep mem0 / agentic experience.
- **Capital** (when appropriate): $1–2M to fund the social graph + Talent Match build-out + initial hiring.

**Contact:** the GitHub repo at [`oznakash/learnai`](https://github.com/oznakash/learnai). Pull requests welcome. Strategic conversations welcome.

> *We're building the daily habit that closes the AI knowledge gap for everyone — and the talent graph that emerges as a byproduct.*

---

## Closing one-liner

**LearnAI is the brain you build by using it. The first 5-minute habit that makes you better at AI than the day before — every day, forever.**

---

## See also

- [`vision.md`](./vision.md) — the long version of slides 1–6.
- [`competitors.md`](./competitors.md) — the long version of slide 8.
- [`mvp.md`](./mvp.md) — the long version of slide 10.
- [`roadmap.md`](./roadmap.md) — the long version of slide 7.
