# The LearnAI manifesto

> _The collective brain for AI builders. Open source. Community-curated. Personal-cognition powered. Built so anyone, anywhere, can keep up — and ship._

---

## Who we are

LearnAI is a tiny, opinionated team building the **AI-native learning network** for builders, creators, and the curious.

We're not a course. We're not a video site. We're not a Q&A board. We're a daily place — five minutes, sometimes ten, sometimes thirty — where the AI firehose becomes a personalized path, and where what you learn turns into something you can actually ship.

The product is **LearnAI**. The in-app experience is **BuilderQuest** — EmDash the mascot, Sparks, streaks, Constellations, build cards. The engine is open source. The cognition layer (mem0) is self-hosted. The whole thing is yours to fork, run, and remix for any domain a community cares about.

## Mission

> **End the FOMO and impostor syndrome of the AI era.**

Make every builder — from a curious twelve-year-old to a frontier researcher — confident, current, and *shipping*, regardless of where they started.

Five minutes a day. Real depth. Visible progress. No bootcamps, no $5k cohorts, no week-four obsolescence. Knowledge that compounds, distilled by the community and tuned by the user's own cognition.

## Vision

> **The social network of education for the AI era.**

Where the curriculum is a graph, the teachers are the community, and the brain that recommends what you should learn next is *yours, evolved by your own use*.

LinkedIn measures who you know. LearnAI measures **what you learned, what you built, what you taught, and what knowledge you helped distribute** — the things that actually matter as the field moves. The place you go every day to stay current, to ship, to share, and to be discovered by the next people you'll work with.

For the long arc, see [`vision.md`](./vision.md).

---

## What we bring to users — worldwide

These are the eight things every learner gets, in any time zone, on any device, in any language we ship to. Promises in plain English; how-we-keep-them follows each line.

### 1. Learning that fits your life

Five minutes a day is the unit. Not "set aside an hour." Not "make a study plan." A Spark fits between meetings, in a queue, on the bus, at lunch. *We earn the cracks of your day.*

> _How:_ everything is bite-size by default. Sparks are 30 seconds to 2 minutes. Levels are 5 minutes. The product physically can't ask for more, because there's nothing longer to ask for.

### 2. Confidence over completeness

You don't need to know everything. You need to keep moving. The cognition layer remembers what you've learned, what you struggled with, what you built — and bends the path toward what *you* are working on, not what some imagined "syllabus" thinks you need.

> _How:_ mem0 is the brain. It's self-hosted, inspectable, editable, and yours. You can see, edit, forget, or wipe everything we know about you, any time.

### 3. Doing, not just reading

Theory without doing rots. Doing without theory misleads. Every level pairs both — and ends with a Build Card: a pasteable prompt for Claude Code that produces a tiny, working artifact you can run, see, and feel.

> _How:_ every Constellation has Build Cards from level 1. Build Cards reference real models (Claude, GPT, Gemini, Llama), real tools (Cursor, Claude Code, pgvector), real patterns. No vendor euphemisms.

### 4. Your data is your data

Your progress, your memory, your identity, your contributions — all yours. Self-hostable. Exportable. Wipeable. The cognition layer is opt-in. The mem0 server is open source. Your session JWT lives only on your device. We never sell anything to anyone.

> _How:_ mem0 self-hosted by default. SPA stays static. Sessions are stateless 7-day JWTs. Memory is editable from the in-app Memory page (`/memory`). Wipe is one click; export is one click.

### 5. Free, forever, open source

The engine is MIT-licensed. The curriculum is text. The cognition is mem0. The runtime is a static SPA. There is no paid tier, no premium tier, no "enterprise" tier on the roadmap. The promise is permanent.

> _How:_ commits live on GitHub. Forks are encouraged. The standing rule is in [`vision.md`](./vision.md): *we will not lock content behind an LLM, gate the engine, or remove open-source.*

### 6. The community is the curriculum

Sparks come from people, not committees. Every Spark you author is credited to you. Your Tip becomes a Tip & Trick card seen by everyone learning that level. Your weekly digest is a teaching post. Reputation is earned, not claimed.

> _How:_ the seed curriculum is hand-authored under [`app/src/content/topics/`](../app/src/content/topics/). Contributors add Sparks via PR or via the Admin Prompt Studio. Names ride along on the Sparks they wrote.

### 7. The same product fits every level

A curious twelve-year-old, a working PM, a senior architect, a frontier researcher — same engine, different paths. Age band, skill level, daily minutes, goals, interests are all part of the cognition. The system meets you where you are.

> _How:_ profile during onboarding (age, skill, interests, daily minutes), then content + difficulty selection adapts. The mascot's tone bends with the audience. Boss Cells calibrate based on actual answers, not guesses.

### 8. Talent finds itself

Resumes are noise. GitHub stars are a poor signal. LearnAI builds a public profile from what you actually shipped, last month, with which stack. The platform becomes a hiring channel by accident — the new LinkedIn for AI talent.

> _How:_ shipped Build Cards, completed Sparks, Boss Cell streaks, and the Sparks you authored form a profile. (Year 2 on the [five-year arc](./vision.md#-the-five-year-arc).)

---

## How we operate — the principles

The values say what users get. The principles say how we behave to keep delivering them. Eleven of them, opinionated.

1. **Bite-size beats binge.** *60 words is a luxury.* If a Spark needs more, it's the wrong Spark. We split.
2. **Cognition > content.** Anyone can write topics. The moat is a memory layer that knows the user. We invest in cognition first, content second, ornament last.
3. **Open source is the multiplier.** Every component is MIT. Every component is forkable. We optimise for *the curve of who can run this*, not for what we capture.
4. **Default toward calm.** Streaks should feel motivating, not anxious. We don't ship dark patterns. We don't ship "lose your streak" countdown timers without an obvious save button.
5. **Doing beats reading.** Every level ends with a build. If a level can't, it's two levels merged into one — split it.
6. **Ship rate > time on app.** The metric is what users build, not how long they linger. We optimise for **shipping rate, retention, and wow-per-minute**.
7. **Plain English, smart-friend tone.** No academic register. Real model names, real tools, concrete examples. If a 12-year-old can't follow it, rewrite it.
8. **Honesty about what's built.** [`mvp.md`](./mvp.md) lists what's shipped vs not. We don't pretend in marketing.
9. **Privacy is a feature, not a setting.** Memory is editable. Identity is local-by-default. Demo mode works without any backend. Production mode is opt-in to the cognition layer.
10. **Forks are a feature.** We name forks ([`fork-recipe.md`](./fork-recipe.md)) and link to them. A Spanish-LearnAI, a chess-LearnAI, a quantum-LearnAI — same shape, different community. The category is bigger than us.
11. **Plan, build, test, doc, merge — don't ask permission.** Internal cadence: contributors and Claude Code agents alike. CI green + tests + same-PR docs is the bar. Anything that breaks the [vision pillars](./vision.md#-strategic-pillars) gets pushed back on.

The principles are stable. If we ever need a twelfth, this doc updates in the same PR that introduces it.

## What we will not do

- **Not a course platform.** Coursera exists.
- **Not a video site.** YouTube exists.
- **Not a Q&A board.** Stack Overflow exists, hardly works for AI.
- **Not behind an LLM.** Sparks are text, forever.
- **Not gated.** Open source is permanent.
- **Not optimised for time-on-app.** We never ship a feature whose only effect is "users spent more minutes today."
- **Not closed-data.** We never collect or sell anything. Memory belongs to the user.

## How to join

| If you are… | Start here |
|---|---|
| **Someone who wants to learn AI** | Open the live app at [`learnai.cloud-claude.com`](https://learnai.cloud-claude.com) and sign in. Five minutes a day from there. |
| **A contributor** | [`contributing.md`](./contributing.md). Five flavours of contribution, from a single Spark to a full Constellation. |
| **An educator wanting your own version** | [`fork-recipe.md`](./fork-recipe.md). Thirty-minute fork. Same engine, your domain. |
| **A company that wants to find people who shipped** | The platform isn't there yet (Year 2 in the arc) — but the data shape is. Watch the repo or [open an issue](https://github.com/oznakash/LearnAI/issues). |
| **An investor / partner** | [`pitch-deck.md`](./pitch-deck.md). Twelve text-only slides. |

---

## See also

- [`vision.md`](./vision.md) — the long-form mission, vision, and five-year arc.
- [`problem.md`](./problem.md) — the gap LearnAI fills.
- [`design-language.md`](./design-language.md) — the visual contract.
- [`pitch-deck.md`](./pitch-deck.md) — the partner / investor pitch.
- [`mvp.md`](./mvp.md) — what's shipped today (auditable).
- [`roadmap.md`](./roadmap.md) — what ships next.

---

_If a line in this document and the codebase ever disagree, the codebase wins. Then we update this document — in the same PR — to make them agree again._
