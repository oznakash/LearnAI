# Aha + Network — the priority bet

> **Living strategy doc.** Last updated: 2026-05-01. Status of each item tracked in §10.
>
> Today's product is *clean*. It does not yet *wow*. The North Star is **WAB**, and only two effects compound under it:
>
> 1. **Visceral individual aha** in the first session — and every session — for the user alone, at zero network density.
> 2. **Inherent network compounding** — mechanics that deliver value at N=100 *and* deliver 100× value at N=10k.
>
> The operator's directive: **90% of the focus on (1), 10% on (2), but not zero on (2).** This doc translates that into 10 items, ranked by impact, each with rationale, tradeoffs, and shipping shape. The 5-PR plan from the prior CPO memo is preserved in [`growth-plan-cpo-q1.md`](./growth-plan-cpo-q1.md); two of those five carry into the active queue here, three go on hold pending data from the first four shipped items.

---

## 1. The 90/10 framing — why it's right

The instinct to default to "social features = growth" is wrong for this stage. Network features at low density (N < 1k same-domain) are dead surfaces that sap the team's energy without compounding. A user signing up to a leaderboard with 12 names is *worse* than one with no leaderboard. A "Stream" feed populated by 30 strangers is not a feed — it's a graveyard.

The reverse is also true: an app with no network mechanic, however polished, eventually plateaus. Twitter at 100 users is useless; the moment that flips depends entirely on **density of the right users**, not raw count.

**Therefore.** Optimize 90% for **individual** wow until D1 retention + W4 retention + share-out rate clear the [`metrics.md`](./metrics.md) bands. Spend 10% on network mechanisms whose **shape is right but whose value compounds quietly with N**, so when scale arrives the moat is in place. We ignore network mechanics that *require* density to show any value at all (open Stream feed, Boards leaderboards, public Topic discovery). We invest in mechanics that *seed* with one user and *compound* — public Builds, signed Spark Cards, paired-onboarding from inviter to invitee.

---

## 2. Wow without high-trust context — surfaces beyond context

The operator's framing is right: reading a user's last 7 days of email solves wow for adults but is a low-trust ask no one will permit. We need wow *without* the heaviest context grant. Six surfaces, each independent of email/calendar/Notion access:

### 2.1 The cheap, voluntary, high-yield asks

We don't need a user's inbox. We need *what they will type or paste in 30 seconds*:

- **A one-line statement** ("I'm a senior PM at a fintech, want to ship an AI summarizer."). Single sentence. Carries more useful context than 7 days of email.
- **A LinkedIn URL or resume PDF** (optional, never required). Parsed once, never stored beyond derived facts. Massive context lift for the small fraction who paste.
- **A 30-second tool-stack checklist** (Claude / ChatGPT / Cursor / Copilot / Replit / Lovable / v0 / none). 8 chips. Inferable level + terminology + audience.
- **An adaptive 3-question diagnostic** (3 actual problems, not stated levels). Behavioral, not declared.
- **A goal verb** ("learn / ship / decide / track"). Maps cleanly onto the existing `Intent` type.

The first session reads these and the cognition layer composes the *first three Sparks* in real time, with the user's name and goal embedded. **This is the GPT-3 dazzle moment applied to learning** — no competitor does it.

### 2.2 Speed & polish

Most learning apps feel slow. Sub-200 ms perceived latency on every interaction. Animations on entry. Skeleton states that match the eventual content shape. **Not aesthetic — visceral.** Users notice. The *only* way an app in 2026 wows is if it feels fast, period.

### 2.3 Brand attribution + trusted creators

Every Spark cites a real source. Today the hand-authored 480 Sparks have **zero source links** and the only real names are inside Lenny's Podcast nuggets. That's a credibility hole we can close cheaply:

- "From [Anthropic Blog]"
- "Drawn from [Karpathy's blog]"
- "Distilled from [a16z's *Latent Space* podcast]"
- "Based on [Stripe Press → 'Working Backwards']"
- Plus the existing 🎙️ Lenny's Podcast attribution

For a 5-name endorsement layer (Lenny ✓ + Naval + Wes Kao + Karpathy + Aman) we get ~1 hour of conversation each → 100+ source-anchored Sparks. The trust lift is asymmetric to the cost.

### 2.4 Real diagrams + concrete examples

The visual slot today is a generic topic icon. A MicroRead about *attention* should show an attention heatmap. A MicroRead about *RAG* should show the retrieve→rerank→generate flow. A MicroRead about *prompt caching* should show the cached-prefix vs. fresh-tokens diagram. **The visual is content, not decoration.**

Same with examples: the seeded Sparks lean on generic ("your app", "imagine a feature"). They should cite Notion AI, Cursor, Claude Code, Linear, Stripe, Anthropic — products users have *used*.

### 2.5 Anti-hedging editorial voice

Most learning content waters itself down with "consider", "might", "potentially." Our manifesto already commits to a "smart-friend, plain-English, concrete > abstract, short > long" voice — but the seed corpus has drifted from it in places. A focused editorial pass on the worst-rated 100 Sparks (driven by 👍 / 👎 ratio) addresses the operator's complaint about content quality directly.

### 2.6 The "ask anything" tutor on demand

A small chat surface available from any Spark. The user types a question; the cognition layer replies in their context (their goal, their vocab, what they've completed). Sub-300 ms perceived response (streaming). **The cognition layer made interactive.** This is the demonstration of the moat to a first-time user.

---

## 3. Network effects at low density — the structural problem

The operator's framing is correct. Twitter at 100 users is useless; Twitter at 100M is essential. WhatsApp without your contacts delivers zero value. LearnAI today is *designed* to deliver value at N=1 (the cognition layer is solo-effective), which is the right choice for the 0–1 stage. The question is: **what mechanics deliver value at N=100 and 100× value at N=10k?**

### 3.1 Three patterns that work at low density

- **Asymmetric value via 1% creators**: 1 expert + 1k consumers is a working network (newsletter, podcast, YouTube, Stack Overflow). The 1% carries the rest.
- **Cohort scaffolds**: cohorts of 5 work even at N=50 if matchmade well (Y Combinator, Maven, On Deck).
- **Permanent accretive contributions**: every shipped Build, every comment, every annotation is a *durable* artifact that future users discover. Not real-time. Asynchronous. Compounds with N.

### 3.2 Three patterns that *don't* work at low density

- **Open feed of strangers** (Twitter shape). Dead at small N.
- **Leaderboard of strangers** (Boards shape). Dead at small N.
- **Real-time matchmaking** (live multiplayer). Worse than dead — actively frustrating when the queue is empty.

### 3.3 The right early-stage mechanic for LearnAI

Pick mechanisms that pass two filters:

1. **Solo value from day one.** Even at N=1, the user gets value.
2. **Compound silently with N.** The mechanism gets more valuable with each user, but doesn't *require* density to be useful.

Six candidate mechanisms, ranked:

| # | Mechanism | Solo value | Compounds with N | Verdict |
|---|---|---|---|---|
| a | **Public Builds wall + tag-search** ("show me Builds tagged RAG, Stripe-stack") | High (own portfolio) | Linear with N | ✅ Top pick |
| b | **Author-signed Spark Cards** (every share carries the author's name; recipient's first Spark is the same one) | High (sharer looks smart) | Linear; viral coefficient compounds | ✅ Top pick |
| c | **Comment threads on every Spark** (StackOverflow shape) | Low at N=1 | Quadratic with N (every reader, every author) | Defer until N > 1k |
| d | **Industry-density tagging** ("12 PMs at Stripe are on LearnAI") | Low at N=1 | Compound vertically | Defer |
| e | **Cohort Quests** (matched 5-builder Quest) | Zero at N=1 | High | Defer (see [`growth-plan-cpo-q1.md`](./growth-plan-cpo-q1.md)) |
| f | **Annotations on Sparks** (Genius.com shape) | Low at N=1 | Quadratic | Defer until N > 1k |

**Conclusion:** Two network mechanics get a slot in the active 10 — Public Builds (slot 9) and Author-signed Spark Cards (slot 8). The rest go on hold. We do not ship Boards or Stream as user-facing surfaces while density is < 1k same-domain.

---

## 4. Content quality review — what users complain about

The operator reports complaints: *"sometimes content doesn't fit the level"*, *"not really helping."* Three diagnoses, three fixes.

### 4.1 What's broken in the seed corpus

Reading through the seeded ~480 Sparks against the manifesto's voice rules, three patterns emerge:

- **No skill-level branching.** A MicroRead written for a *Senior architect* and a *Curious starter* is the same paragraph. This is the single biggest cause of "doesn't fit my level."
- **Hedging.** Words like *"consider"*, *"might"*, *"potentially"* dilute teaching value. The manifesto's *anti-hedging* voice is partly violated in seed content.
- **Generic examples.** "Your app" / "your team" / "imagine X" instead of *Notion AI*, *Linear*, *Cursor*, *Stripe Press*, *Anthropic Blog*. Builders skim past abstract.
- **No source attribution.** Hand-authored MicroReads cite nothing. The PodcastNugget format proved the source-anchor pattern works — it should be the default for any Spark that *can* be sourced.
- **Outdated references.** Some Sparks mention model names + tools that have moved on. Date-stamped Sparks would surface staleness.

### 4.2 Three fixes

| Fix | What it does | Effort |
|---|---|---|
| **Editorial pass — worst-100 Sparks by 👍-ratio** | Strip hedging, replace generic examples with named tools/products, add source attribution, mark dates | M (1 sprint, with the engine accelerating it) |
| **Skill-level branching on MicroRead** | Add `bodyByLevel?: { starter, builder, architect }` shape; renderer picks based on `profile.skillLevel`; falls back to existing `body` | M |
| **Source-anchor inheritance** | Every Spark gets a `source?: { name, url }` even if hand-authored — surfaces a cite chip on the card. Editorial pass fills these in for the worst-100 first | S |

### 4.3 Trust + social proof — the brand layer

In addition to fixing voice + examples, we add three trust signals:

- **Brand attribution on every Spark that can have one** (cite the Anthropic Blog, the Y Combinator talk, the Karpathy post — see §2.3).
- **Trusted-creator endorsements** — get 5 names to "endorse" curated paths. Their face/name on the start of a Constellation. Lenny ✓; outreach to four more.
- **Social-proof tile on share** — when a user shares a Spark Card (slot 8 below), the card carries "*shared by Maya · Senior PM at fintech*" + the takeaway + brand citation. Three trust layers in one tile.

---

## 5. FTUE critical re-review — the button-bloat problem

The operator's complaints: *"too many buttons, not an instant value when clicking on the buttons, empty boxes sometimes."* All three are real. The most damning evidence is in our own recent shipping cadence — the rows we added are correct individually but cumulatively crowd the Spark surface.

### 5.1 Counted buttons on a fresh user's first answered Spark

| Surface | Buttons today | Necessary on first 3 Sparks? |
|---|---|---|
| TopBar | 🔥 streak · ⚡ XP · 🧠 focus · avatar (4 unlabeled icons) | No — labels would help; otherwise hide cognition badge until first memory written |
| Spark header | + Task · ✕ Exit (2) | No — `+ Task` is invisible without context; hide on first 3 Sparks |
| Spark body | varies — for QuickPick, 4 answer buttons | Yes |
| Feedback card | Mascot · message · `Next →` (1 primary action) | Yes |
| Quality row | 👍 helpful · 👎 skip forever (2) | Reveal AFTER first 3 Sparks |
| Signal row | 🔍 Zoom in · ⏭ Skip for now (2) | Reveal AFTER first level cleared |
| Memory nudge | Optional dismiss (1) | Hide on first session |
| Switch suggestion | "Switch it up?" (1) | Hide on first session |
| TabBar | Home · Tasks · Progress · Boards (4 — Boards a dead link if `boardsEnabled=false`) | Hide flag-disabled tabs (already covered in [`first-time-builder-findings.md`](./first-time-builder-findings.md) #41) |

**Counted on a single Spark, after answering**: ≥ 8 distinct buttons in a fresh user's view. This is too many. The feedback card alone has *Mascot* + *Message* + *Next* + the row below has 4 more buttons. A first-time user has zero schema for what any of them mean.

### 5.2 Empty boxes

- **The 14-day sparkline on Home**, day-zero, renders 14 grey dots stretching half a screen. *Hide it until day 2.*
- **The Tier ring** shows "0 / TIER" with no scale. *Hide until 25 XP, then surface "75 to Architect".*
- **The Visual slot** on the first Spark renders empty when the Spark has no `visual` set and the topic-default doesn't fall through. *Already partially fixed in PR #65 — extend to MicroRead.*
- **The "Builds 0" tile** that follows the Build-and-Ship Loop shipping (§6 #4) — show *"Your first Build → 🛠 try a Build Card"* as the empty state, never a 0.
- **The `Last 14 days` heatmap on Progress** for a fresh user — same fix.

### 5.3 The progressive-disclosure recipe

A simple rule that solves all three complaints:

> **"Don't show a control until the user has earned a need for it."**

| Surface | First 3 Sparks | First level cleared | After D1 |
|---|---|---|---|
| Primary CTA | ✓ shown | ✓ | ✓ |
| 👍 / 👎 row | hidden | ✓ shown | ✓ |
| 🔍 / ⏭ signal row | hidden | hidden | ✓ shown |
| `+ Task` button | hidden | ✓ shown | ✓ |
| Memory nudge | hidden | hidden | ✓ |
| TabBar Boards / Stream | hidden when flags off (always) |
| 14-day sparkline | hidden | hidden | ✓ |

**The user gets *one* primary action at a time on the first 3 Sparks**. Everything else appears as they've earned it. This is the single most impactful FTUE change.

---

## 6. The 10 items, prioritized

Mix: **9 wow + content + FTUE; 1 inherent-network seed.** Per the 90/10 directive.

| # | Item | Bucket | Primary KPI | Effort | Status |
|---|---|---|---|---|---|
| 1 | **Cold-Start Aha** — 60-sec AI interview at sign-up · drafts 3 Sparks tuned to the user · greets by name + goal | Wow (context) | Time-to-first-Spark < 90 s · "felt made for me" ≥ 80% · D1 ≥ 60% | S–M | Carried from [`growth-plan-cpo-q1.md`](./growth-plan-cpo-q1.md) |
| 2 | **FTUE simplification — progressive disclosure** · single primary CTA on first 3 Sparks · hide flag-disabled tabs · empty-state fixes (sparkline, tier ring, visual slot) | Wow (cognitive load) | D1 activation ≥ 60% · NPS · "felt made for me" | S | Net new |
| 3 | **Editorial pass — worst-100 Sparks by 👍 ratio** · strip hedging · replace generic examples with named tools · add source citations · mark dates | Content quality | Spark median quality (👍÷exposures) ≥ 0.55 · sustained 👍-rate ≥ 70% | M | Net new |
| 4 | **Source-anchor on every Spark** that can have one — `source?: { name, url }` on `MicroRead` / `Tip` / new `EssayNugget` / `ReleaseNote` variants. Renderer surfaces the cite chip — same shape as `PodcastNugget`. | Trust + content | Source CTR ≥ 8% · trust self-report | S–M | Net new — schema only ships in this slot; content backfills with #3 |
| 5 | **AI Tutor on demand — "ask anything" chat with the cognition layer** · streaming, sub-300 ms perceived · uses goal/intent/vocab/gap memories | Wow (interactivity) | Memory-derived recommendation acceptance ≥ 45% · session length P50 6–12 min | M | Net new |
| 6 | **Skill-level branching in MicroRead** — `bodyByLevel?: { starter, builder, architect }` · renderer picks based on `profile.skillLevel` · falls back to existing `body` | Content fit | "Felt made for me" ≥ 80% · 👍 rate · accuracy band 65–80% | M | Net new |
| 7 | **Concept-tied real diagrams** — token diagram, attention heatmap, RAG flow, eval matrix — replace generic topic-icon visual on every MicroRead with a content-tied SVG | Wow (polish) | First-impression NPS · 👍 rate | M | Builds on PR #65 visual-slot work |
| 8 | **Spark Cards — author-signed, brand-cited, viral-shaped** · every 👍'd Spark renders as a 1080² shareable card with takeaway + source + author + 1-tap CTA · invitee's *first Spark* is the one that was shared (paired-onboarding mechanic) | Network seed (inherent) | Share-out rate ≥ 5% · k ≥ 0.3 organic / > 0.5 with the paired mechanic | S–M | Carried + extended from [`growth-plan-cpo-q1.md`](./growth-plan-cpo-q1.md) |
| 9 | **Public Builds wall + tag-search** ("show me RAG bots", "show me Stripe-stack Builds") · default-private; user opts in to publish · works at N=100, compounds linearly with N | Network seed (inherent) | WAB · profile views · Builds-per-WAB · Talent Match readiness | M (foundation only this slot — full Build-and-Ship Loop returns from `growth-plan-cpo-q1.md` after #1–7 land) | Net new |
| 10 | **Speed & polish pass** — sub-200 ms perceived latency on every interaction · skeleton states · entry animations · TopBar icons get hover-labels · audit performance budget | Wow (polish) | TTI < 3.5 s P75 mobile (existing guardrail) · NPS | S | Net new |

**Effort key:** S < 1 sprint, M ≈ 1–2 sprints. No L items in this round — bigger bets (Cohort Quests, full Build Loop) live in [`growth-plan-cpo-q1.md`](./growth-plan-cpo-q1.md) until #1–7 ship and we have data.

---

## 7. What we move OUT of focus this round

Saying no protects the focus.

| Was on the radar | Decision | Reason |
|---|---|---|
| **Daily Pulse** ([`growth-plan-cpo-q1.md` #3](./growth-plan-cpo-q1.md)) | Defer until #1 (Cold-Start) ships | A Pulse without a meaningful cognition layer is a generic newsletter. Ship the layer first. |
| **Cohort Quests** ([`growth-plan-cpo-q1.md` #5](./growth-plan-cpo-q1.md)) | Defer; comes back via paired-onboarding from #8 | Cohorts need an aha to recruit into. Ship aha (#1) + the inviter-invitee mechanic (#8) first. |
| **Full Build-and-Ship Loop with auto-generated case studies** ([`growth-plan-cpo-q1.md` #4](./growth-plan-cpo-q1.md)) | Slot 9 here is a *foundation* (the wall + tag-search). The completion ritual + auto-rendered case studies return next | Editorial + skill-branching (#3, #6) come first; Builds need a sharp authoring path before we monetize the artifact. |
| **Talent Match (Sprint 4 in [`roadmap.md`](./roadmap.md))** | Defer to after #9 has ≥ 30 days of Builds | Without proof-of-work it's LinkedIn-lite. |
| **Voice mode (Sprint 5)** | Defer | Demand-gated. No user has asked. |
| **Native mobile shell (Sprint 5–6)** | Defer | Web works on mobile. Revisit when retention justifies. |
| **Spark Stream feed + Boards leaderboard at user scale** | Stay flag-OFF in production until N > 1k same-domain | Open-feed-of-strangers and leaderboard-of-strangers patterns die at low density. The mechanics are right; the *shape* surfaces should not be exposed yet. |
| **Comment threads on Sparks** | Defer to after N > 1k | Quadratic compound with N; useless at small N. |

---

## 8. Sequencing — next 4 weeks (4 ship-ready PRs)

A tight 4-PR plan that touches **9 of the 10 items** (Spark Cards #8 ships in week 4 because it depends on #1's profile + #4's source-anchor).

| Week | PR | Items |
|---|---|---|
| **Week 1** | **PR-W1 — FTUE simplification + speed pass + empty-state fixes** | #2, #10, partial #4 (source-anchor schema only) |
| **Week 2** | **PR-W2 — Cold-Start Aha (60-sec AI interview)** | #1 |
| **Week 3** | **PR-W3 — Editorial pass + skill-level branching + concept diagrams** | #3, #6, #7 |
| **Week 4** | **PR-W4 — AI Tutor + Spark Cards + Public Builds foundation** | #5, #8, #9 |

Each PR independently mergeable, each with new Vitest coverage, each verified live in browser preview before merge. Each declares its primary KPI in the PR description so we know if it worked.

---

## 9. Executive summary + prioritized table

**The bet, in one paragraph.** Spend the next 4 weeks turning a clean app into one that *wows*. Ten items: nine in service of individual aha + content quality + FTUE simplification (the 90%); one in service of inherent network compounding via paired Spark Card sharing (the 10%, with a foundation for public Builds). We *defer* every network feature whose shape needs density to deliver value (Stream, Boards, Cohort Quests, Talent Match). We *ship* every individual-wow surface that can move a single user from "this is clean" to "I have to show this to someone."

**Execution discipline.** Each PR has one primary KPI declared. If the curve doesn't move, we fix the previous PR before stacking the next.

**Final-form prioritized table:**

| # | Item | Bucket | KPI moved | Effort | Slot |
|---|---|---|---|---|---|
| **1** | **Cold-Start AI interview** | Wow | Time-to-first-Spark · "felt made for me" · D1 | S–M | W2 |
| **2** | **FTUE simplification (progressive disclosure)** | Wow | D1 · NPS · cognitive load | S | W1 |
| **3** | **Editorial pass on worst-100 Sparks** | Content | 👍 rate · median quality | M | W3 |
| **4** | **Source-anchor on every Spark** | Trust | Source CTR · trust | S–M | W1 (schema) + W3 (backfill) |
| **5** | **AI Tutor on demand** | Wow | Memory acceptance · session length | M | W4 |
| **6** | **Skill-level branching in MicroRead** | Content | "Felt made for me" · accuracy band | M | W3 |
| **7** | **Concept-tied real diagrams** | Wow | First-impression · 👍 rate | M | W3 |
| **8** | **Spark Cards — author-signed + paired-onboarding** | Network seed | Share-out · k | S–M | W4 |
| **9** | **Public Builds wall foundation** | Network seed | WAB · Builds-per-WAB | M | W4 (scaffold) |
| **10** | **Speed & polish pass** | Wow | TTI · NPS | S | W1 |

---

## 10. Status & changelog

| Item | Status | PR | Notes |
|---|---|---|---|
| 1 — Cold-Start | 📅 W2 planned | — | — |
| 2 — FTUE | 📅 W1 planned | — | — |
| 3 — Editorial | 📅 W3 planned | — | depends on 👍 telemetry to pick the worst-100 |
| 4 — Source-anchor | 📅 W1 (schema) + W3 (backfill) | — | — |
| 5 — AI Tutor | 📅 W4 planned | — | — |
| 6 — Skill branching | 🟡 partial | _entry-point — see changelog_ | Entry-point branching shipped: `inferredStartingLevel` + `isLevelUnlocked` floor. Explorer starts at L2 / builder at L3 / architect at L4 / visionary at L5 on a fresh topic; calibrated level still wins. Per-Spark `bodyByLevel` content branching remains W3 |
| 7 — Diagrams | 📅 W3 planned | — | — |
| 8 — Spark Cards | 📅 W4 planned | — | depends on #1 (profile data for the author byline) |
| 9 — Public Builds | 📅 W4 (scaffold) | — | — |
| 10 — Speed/polish | 📅 W1 planned | — | — |

**Changelog:**

- **2026-05-01** — Doc created. 10-item active queue defined. Three items from [`growth-plan-cpo-q1.md`](./growth-plan-cpo-q1.md) (Daily Pulse, Cohort Quests, full Build Loop) deferred. Two items carried (Cold-Start Aha, Spark Cards). Cohort Quests deferred because cohorts need an aha to recruit into; will return after the paired-onboarding mechanic in #8 ships and we see what the inviter→invitee curve looks like.
- **2026-05-03** — Slot 6 moved from 📅 to 🟡 partial. Entry-point skill branching now lands a self-reported "explorer" on Level 2 of a fresh topic instead of forcing them through Level 1 ("AI is pattern, not magic") — the single biggest fit-misalignment surfaced by the Maya FTUE pass in [`test-personas.md`](./test-personas.md). Per-Spark `bodyByLevel` content branching still pending. Same PR also lands the goal→topic alias map (Maya's "Become an AI PM" goal now correctly resolves to `ai-pm` instead of falling through to `interests[0]`), the Onboarding name-prefill sanitizer, and the hidden-account allowlist that filters QA personas from every public surface.

---

## See also

- [`growth-plan-cpo-q1.md`](./growth-plan-cpo-q1.md) — the 5-PR plan from the prior CPO memo, parked for revisit after this active queue ships.
- [`content-model.md`](./content-model.md) — the operating manual for what content *means* at LearnAI; this doc is what we *do* with that model in the next 4 weeks.
- [`first-time-builder-findings.md`](./first-time-builder-findings.md) — live-product audit of the FTUE; the empirical ground truth behind §5 of this doc.
- [`metrics.md`](./metrics.md) — the KPI tree this doc ladders to.
- [`vision.md`](./vision.md) — the strategic destination this 4-week plan moves toward.
- [`roadmap.md`](./roadmap.md) — the engineering roadmap, currently a *platform* roadmap; this doc is the *growth* layer to graft on.
