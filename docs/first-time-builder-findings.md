# First-time builder — content & experience findings

> _Driven the live SPA as a fresh signed-up user (`alex.builder@gmail.com`, profile: PM with 5 yrs SaaS, started writing code with Claude this year, goal: "Ship AI products that real users pay for"). Completed 3 Sparks across AI Product Management Level 1, then swept Tasks · Progress · Boards · Settings · Your Memory. Notes below are auditable against the metrics tree in [`metrics.md`](./metrics.md)._

---

## TL;DR

The bones work. The **gaps** that matter most for **WAB (Weekly Active Builders)** are not in the Sparks themselves — they're in the **moments between Sparks** and the **moments after a Spark lands**:

1. The **Level-Cleared screen squanders the WAB conversion moment**. I just did 3 Sparks; one Build Card away from being a WAB. The product nudges me sideways into a different topic instead of forward into a Build Card.
2. **The visual slot is broken on the first Spark** — looks like a rendered bug for a brand-new user.
3. **The cognition layer captures history + strengths but not goals** — it's an outcome log, not a personalization driver.
4. **The pre-sign-in screen leads with operator UI** ("Google OAuth Client ID") and buries the demo path. First-time users would bounce.
5. **The Level summary's stat tiles are flat by design** — no narrative closure on what the user just learned.

The framing the user landed on this session — *"5 minutes is the hook; longer sessions are the win"* — exposes a real product hole: **once a user is willing to invest more, the product has nothing to escalate them into**. No Project Quests, no follow-up Builds, no "now apply this." The path ends at "Continue" or "Try a different topic."

---

## What worked

| What | Why |
|---|---|
| **Home greeting** — *"Hey Alex 👋 · 10 min today · land 1–3 Sparks in AI Product Management"* + clear primary CTA | Intent is unambiguous; mascot adds warmth; daily quest sets a finite target |
| **MicroRead "Specs become probabilistic"** content | Sharp framing: *Classic PM = "click X do Y" · AI PM = "answer should be helpful 95% of the time, never harmful, cite sources"*. The right opening lesson |
| **PodcastNugget render** — chip · italic blockquote · takeaway · "Try this" CTA · Listen link | The Lenny variant lands as designed (PR #63). Format is reusable for future sources |
| **XP / streak tile updates visibly** at +12 / +5 per Spark with confetti | Loop-feedback is right; gamification feels earned |
| **Level-Cleared metric tiles** (Sparks 3 · Correct 3 · XP 36) | Honest, auditable summary. Good for the "short check-in" framing |
| **Daily-quest topic recomputation** — after I cleared AI PM L1, Home re-pointed me to *Being an AI Builder* | The recommender did the right next-thing |
| **Memory tab is real** — 5 memories written from one 3-Spark session, with categories + Forget per row | Differentiator visible. Per [`metrics.md` §3.6](./metrics.md#36-cognition-layer-health-the-moat) |
| **Settings: erase + signout fixes (PR #66, #72)** are live and behave per spec — subtle text-link erase, ghost-style signout, no popup | Confirms my prior security/UX shipment landed |

---

## What didn't — full list, with severity

Severity scale: **🔴 P0** = blocks a north-star input; **🟠 P1** = noticeable friction with measurable hit; **🟡 P2** = polish.

| # | Where | Finding | Sev | KPI hit | Vision pillar hit |
|---|---|---|---|---|---|
| 1 | Sign-in (production mode) | Only "Continue with Google" — no demo or guest path. A first-time user without OAuth is stuck | 🔴 | Visit→sign-in conversion | "Bite-size by default" — friction at the gate |
| 2 | Sign-in (demo mode) | "GOOGLE OAUTH CLIENT ID" is the **primary** form; "Skip OAuth setup" is buried at the bottom looking like fine print | 🔴 | Visit→sign-in · D1 activation | Operator UI bleeding into consumer flow |
| 3 | Onboarding step 2 (age) | Discrete buttons 6 → 65 in a 4×3 grid implies kids-first. Adult builder feels miscast | 🟠 | Onboarding completion | "Personalized, not generic" |
| 4 | First Spark, MicroRead | **Visual slot is empty (just a tiny dot)** — the spark has no `visual` set and the topic-default doesn't fall through | 🔴 | Time-to-first-Spark · 👍 rate | "Bite-size by default" — broken first impression |
| 5 | First Spark, MicroRead | Body is 5 dense sentences; takeaway is great but the body wall is heavier than the 60s budget | 🟡 | 👍 rate · session length | "Bite-size by default" |
| 6 | QuickPick distractors | "LOC of code" / "API latency only" / "Number of features" — distractors a builder dismisses in 1 second. Wasted teaching moment | 🟠 | Spark accuracy ·👍 rate · Boss pass rate | "Practical over passive" |
| 7 | Spark counter | Shows raw level index ("Spark 3/4") after sequencer skipped a passive Spark — user thinks they missed one | 🟡 | Trust · 👍 rate | n/a |
| 8 | After-answer feedback card | Confetti from the previous Spark renders **over the new question text** | 🟠 | First-impression · 👍 rate | n/a |
| 9 | After-answer "explain" copy | "Quality + usage + correctness, not just one." 8 words. The user just earned a 30s deeper-why | 🟠 | "Felt made for me" · 👍 rate | "Bite-size by default" — too thin |
| 10 | PodcastNugget — passive feedback copy | Says "✓ Nailed it!" on a passive read where there was nothing to nail | 🟡 | NPS · 👍 rate | Trust |
| 11 | PodcastNugget — completion loop | "Try this →" CTA has no "I tried it" affordance | 🟠 | Build-Card pasted/WAB | "Built for doing" |
| 12 | PodcastNugget — listen link | Roots-only link drops user on Lenny's home with no episode anchor — 2-click hunt | 🟡 | Click-through rate | Creator credit |
| 13 | **Level-Cleared screen** | Three stat tiles + "Continue path →" + "↔ Try Being an AI Builder" — **no Build Card path despite WAB requiring one** | 🔴🔴 | **WAB (NS)** · Build Cards pasted | "Built for doing" |
| 14 | Level-Cleared screen | No "what you just learned, in 3 lines" closure. No Level-2 preview. No share-out | 🟠 | Magic-moment · share-out rate | "Social by design" |
| 15 | Header | "+ Task" button on every Spark gives no affordance to a first-timer who hasn't visited Tasks yet | 🟡 | n/a | "Built for doing" |
| 16 | TopBar icons | 🔥 / ⚡ / 🧠 / avatar are unlabeled. Cognition status (📴/🧠/🟡 from docs) isn't visually distinct from focus hearts | 🟡 | Trust | "Memory belongs to user" — invisible |
| 17 | Home | Empty 14-day sparkline as 14 dots stretching across half the screen for a day-zero user — feels like a graveyard | 🟡 | First-impression | n/a |
| 18 | Home | No "next tier" hint under Tier: Builder. No goal-anchor either | 🟠 | Streak retention · NPS | "Personalized" |
| 19 | Home | **Goal-to-content mismatch** — I said my goal is *Ship AI products*, the daily quest landed in **AI Product Management** but suggested *AI Builder* as a sidebar | 🔴 | First-Spark fit · NPS | "Personalized" |
| 20 | Tasks tab | Generic empty state ("Watch a YouTube. Read an article."). For a builder this should be the **Build queue** | 🟠 | Build Cards pasted · WAB | "Built for doing" |
| 21 | Tasks filter pills | "All / Doing / Todo / Done" — Trello shape. Doesn't match "things I'm trying to ship" intent | 🟡 | n/a | n/a |
| 22 | Routing | `/progress` and `/boards` paths fall back to Home; TabBar's active-tab pill desyncs from the rendered view | 🟠 | Trust · session abandonment | n/a |
| 23 | Boards tab | Always visible in TabBar even when `flags.boardsEnabled = false` — clicking is a dead link | 🟠 | NPS · trust | n/a |
| 24 | Progress page | Tier ring "25 / TIER" with no scale — user can't see "X to Architect" | 🟠 | Streak retention · NPS | n/a |
| 25 | Progress page | **No Build-Card stats anywhere** despite WAB definition requiring ≥1 Build Card | 🔴 | **WAB (NS)** | "Built for doing" |
| 26 | Progress page | No memory / cognition health visible to the user. The differentiator is invisible on the user's primary stats screen | 🟠 | Cognition acceptance · "felt made for me" | "Cognition is the moat" |
| 27 | Settings | "Save Client ID" + Google OAuth fields surface in demo mode — operator UI in consumer settings | 🟡 | First-week regret rate | n/a |
| 28 | Memory tab | **Bug: duplicated `strength` memory** — "Strong on AI PM L1 (3 correct in a row)" appears twice, identical timestamps | 🟠 | Memory drift / staleness (guardrail) | "Cognition is the moat" |
| 29 | Memory tab | "Wipe everything" with red trash is **the first thing on the page**. Destructive action gets prime real estate | 🟠 | Memory wipe rate (guardrail) | "Memory belongs to user" |
| 30 | Memory tab | Each row has a red "Forget" — should be subtle by default, two-click confirm (same pattern I shipped for Settings erase) | 🟡 | Memory wipe rate · trust | "Memory belongs to user" |
| 31 | Memory tab | "This browser is in offline mode" framed apologetically. Privacy default should sound like a feature, not a deficiency | 🟡 | NPS · trust | "Memory belongs to user" |
| 32 | Memory tab | **No `goal` memory written** even though I gave one in onboarding. The cognition layer captures outcomes, not intent | 🔴 | Memory-derived recommendation acceptance · "felt made for me" | "Personalized" |
| 33 | Long-tail | After clearing a level, **the path just goes "Continue"** — there's no Project Quest, no Build Sprint, no "now apply this." The product has no escalation for the *user willing to invest hours* | 🔴 | Long-tail retention · WAB · profile depth | "Built for doing" — the framing the user just gave us |

---

## The four ahas we never deliver

Walking the flow, four **near-aha moments** sit one design decision away from landing — and we miss them all:

### Aha #1 — *"Wait, this app actually knows me."*

**What we do:** Onboarding asks for goals, daily minutes, skill, interests. After signup, none of those signals visibly drive anything in the first session.

**What's missing:** The very first Spark should reference the goal. *"You said you want to ship AI products. Here's the first PM lesson where AI lands hardest."* Today's first Spark could be Spark #1 of any user's session — generic.

**Lift:** WAB · Magic-moment hit rate · "felt made for me" self-report.

---

### Aha #2 — *"This isn't a quiz, this is a build."*

**What we do:** A user does 3 Sparks, hits Level Cleared, sees three stat tiles, clicks Continue.

**What's missing:** The Level-Cleared screen is the **WAB conversion moment**. The user has done the Sparks; now offer them the Build Card sized for what they just learned, with a goal-anchored prompt: *"Now build a one-spec for an AI feature you've been thinking about. Paste this into Claude Code →"*. ONE click goes from "I learned" to "I'm a WAB."

**Lift:** WAB (directly) · Build Cards pasted per WAB · long-tail retention.

---

### Aha #3 — *"My memory is alive."*

**What we do:** Cognition layer writes memories silently. Memory tab is buried in Settings → Open Your Memory.

**What's missing:** Inline hints during a Spark: *"💡 Last time you struggled with eval design — this Spark builds on that."* The sequencer's memory-aware reranking (workstream (a) of the content-experience plan) needs to **surface its reasoning**. Make memory-acceptance a visible loop, not a backend silently doing things.

**Lift:** Memory-derived recommendation acceptance · "felt made for me" · cognition-on retention delta.

---

### Aha #4 — *"Other builders are seeing what I'm seeing."*

**What we do:** Boards is in the TabBar but the route doesn't render. Stream is similar. Social signals are flag-gated and effectively absent for fresh users.

**What's missing:** Even before flipping the social flags on, a tiny "**3 builders did this Spark today · 2 said 👍**" line under each Spark would be social-without-substance. Lights up the magic-moment metric (≥30% by Sprint 3). Today, social is a checkbox in admin, not a felt experience.

**Lift:** Magic-moment hit rate · share-out rate · k.

---

## Cross-references with the prior strategy table

I wrote a 12-row exec table earlier in this conversation. Mapping today's findings to it:

| Earlier rec | Confirmed by today's session | Severity bump? |
|---|---|---|
| #2 Turn the sequencer up (mem0-driven) | Strongly. Memory tab proves the data is there but unused at runtime. Aha #3. Findings #19, #32. | **Keep at Now** |
| #3 Goal-tuned first Spark | Strongly. Findings #19, #32 — the goal I gave isn't even stored as a memory, let alone driving recommendations. Aha #1. | **Keep at Now** |
| #4 "Show your Build" | Strongly. Findings #11, #13, #20, #25, #33 — the entire WAB-conversion path is missing. Aha #2. | **Bump to P0/Now** |
| #1 Instrument the NS | The metrics doc landed since I wrote the earlier table; WAB is now the NS. Need a WAB tile in admin. | **Keep at Now** |
| #5 Within-level shuffle | Confirmed by Finding #7 — sequencer's logic is sound but its display isn't transparent | Keep at Now |
| #7 Generation engine | Reinforced by Finding #5 (content density) — the existing 480 Sparks are good but we won't hand-curate to 5,000 | Keep at Next |
| #9 Boards / Stream flag flip | Confirmed by #23 — currently a dead link confusing first-time users. Aha #4. | Either flip on or hide |
| #10 Project Quests | **Reinforced by Finding #33** — *the user explicitly said "longer sessions are the win"*. We have no escalation. | **Bump to Next** (was Later) |

---

## Top 10 changes I'd ship this sprint, ranked by KPI impact

(Each row's "Why this lift" cites the metric in [`metrics.md`](./metrics.md) it moves.)

| Rank | Change | Why this lift | Effort |
|---|---|---|---|
| 1 | **WAB-conversion CTA on the Level-Cleared screen** — replace "Try a different topic" secondary with a goal-anchored Build Card | NS (WAB) · Build-Cards-pasted-per-WAB · Aha #2 | M |
| 2 | **Capture goal as a `goal` memory at onboarding finish** + reference it in the first Spark intro line | Memory acceptance ≥45% · "felt made for me" ≥80% · Aha #1, #3 | S |
| 3 | **Goal-tuned first Spark** — pick the Spark whose `goal`/`level`/`tag` best matches the user's stated goal at end of wizard | Time-to-first-Spark <90s · D1 ≥60% | M |
| 4 | **"I shipped this" loop on Build Cards + PodcastNugget "Try this" CTAs** — optional URL/screenshot, bonus XP, surfaces in profile | NS (WAB) · Build-Card *completion* · profile depth | M |
| 5 | **Fix the visual slot** — fall through `spark.visual → topic.visual → "spark"` consistently. No empty boxes on a first Spark | First-impression · 👍 rate | S |
| 6 | **Sign-in screen redesign** — demo path primary, OAuth tucked behind "I'm an operator" disclosure | Visit→sign-in ≥35% · D1 ≥60% | S |
| 7 | **Memory-as-experience, not just storage** — show "Last time you struggled with X — this builds on that" inline above the Spark when memory matches | Memory acceptance · cognition-on retention delta · Aha #3 | M |
| 8 | **Hide TabBar entries that are flag-disabled** (Boards/Stream when `boardsEnabled/streamEnabled = false`) — no dead links | NPS · trust | XS |
| 9 | **Two-click "Forget" + "Wipe" in Memory tab** (mirror the Settings erase pattern from PR #66) | Memory wipe rate (guardrail) · "felt made for me" | S |
| 10 | **Fix the duplicated `strength` memory write** — bug in the inferred-strength hook | Memory drift/staleness <15% (guardrail) · trust | S |

---

## What I'd cut from the existing strategy

Walking the product made me less confident about two things:

- **Public 👍/👎 counts (was #12 in earlier table)** — at current traffic, the signal is too sparse and the comparison ("3 likes vs 1 like") is meaningless noise. Defer past Sprint 4.
- **Builds-first Profile redesign (#11)** — depends on #4 (Show your Build) running for 30+ days first. Skip the redesign until there are builds to show.

---

## What I'd add that wasn't in the earlier table

The session surfaced two ideas I hadn't named:

- **Inline "this is for you because…"** in front of every recommended Spark. One sentence — *"Because you said you want to ship AI products"* / *"Because you got 3 right in a row on AI PM"*. Makes the cognition layer's reasoning legible. Direct hit on memory-acceptance.
- **A "Sprint" mode** — multi-day Build Card chain producing a real artifact. The user's framing ("longer sessions are the win") demands this. The product currently has nowhere to *spend* a long session productively. Sprint mode is the answer.

---

## See also

- [`metrics.md`](./metrics.md) — the KPI tree these findings ladder back to. Especially §3.2 (onboarding & activation), §3.3 (engagement & UX quality), §3.6 (cognition layer health).
- [`vision.md`](./vision.md) — the seven pillars the findings test against.
- [`content-experience-plan.md`](./content-experience-plan.md) — the prior PR-shaped plan; this doc validates its priorities and bumps a few severities.
- [`mvp.md`](./mvp.md) — what's shipped today; this doc describes what the user *experiences* on top of that.
