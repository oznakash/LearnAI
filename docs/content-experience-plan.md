# Content-experience plan — make LearnAI's content actually *land*

> _The bones of LearnAI are great. Now we make a session **feel** like a curated set, not a hand of cards. This is the active design doc behind three independently-mergeable PRs._

**Status:** approved. Decisions signed off. Active build.
**North-star metric:** *% of sessions that end with the user choosing "Continue path" rather than exiting.* If this doesn't move, nothing else matters.
**We optimize for** wow-per-minute, **not** time-on-app — same as the [vision pillar](./vision.md).

---

## 1. Diagnosis

Today:

- A level fires its 4–6 Sparks in **fixed order**. There's no rhythm — two `MicroRead`s can land back-to-back, fatigue the user, and they bounce.
- The mem0 cognition layer **observes** what the user knows / struggles with — but it doesn't **drive** sequencing.
- The animation box on a Spark card is generic per-Topic; it doesn't tie to the *concept* being taught, and it half-breaks on a 390px phone.
- We can't see which Sparks land and which flop. We're flying blind on content quality.
- We've been hand-authoring 480 micro-lessons. A handful of curated outside voices (Lenny's Podcast guests, with attribution) would be a credibility multiplier our solo-authored content can't match.

---

## 2. Three workstreams

The three workstreams are independent enough to ship as three separate PRs, and intertwined enough that they share a single north-star metric.

### Workstream (a) — Session feel: stitching, not shuffling

**What ships:**

- **mem0-driven session sequencer.** Before each Spark, ask memory *"what does this user know, struggle with, want?"* and re-rank the queue. Hard rules:
  - Never two passive Sparks (`MicroRead` / `Tip` / `PodcastNugget`) in a row.
  - A doing-Spark (`QuickPick` / `FillStack` / `Scenario` / `BuildCard`) must appear at least every ≤ 3.
  - Open easy, peak in the middle, end on a small win.
- **Visual box, properly.** The illustration slot becomes a *content slot*: real diagrams for `MicroRead`s (token diagram for tokenization, attention heatmap for transformers, RAG flow for RAG), the mascot for `Tip`s, a Claude-Code window mock for `BuildCard`s, an attributed-headshot tile for `PodcastNugget`s. Mobile-first sizing — the card reads cleanly on a 390px screen with no overflow.
- **Tighter memory nudge.** Today's "every 6th Spark" nudge becomes earned (only on a real signal, e.g. inferred-strength or inferred-gap touched in the last few Sparks).

**Aggressiveness — signed off:** start **soft** (light reorder, hard rules above), measure the north-star metric, then turn it up. Don't let mem0 rebuild the entire queue every Spark on day one.

**Bundle the visual-box redesign with the sequencer** in this single PR — the box redesign is the most visible polish the user will feel, and the sequencer alone won't feel like enough.

**User value:**
- *"It feels like the app knows me."*
- *"I never feel like I'm grinding."*
- *"It looks right on my phone."*

---

### Workstream (b) — Lenny's Podcast as a content seam

**What ships:**

- A new Spark variant — **`PodcastNugget`**. ≤ 60-word quote, single-sentence takeaway, attribution chip, "Listen on Lenny's Podcast →" link to the podcast root.
- An admin feature flag — **`flags.lennyContentEnabled`**, **default ON**. When OFF, the topic-loader filters out every PodcastNugget Spark. Lets the operator turn the seam off with a toggle if Lenny ever asks us to.
- ~12 nuggets seeded in PR (b), distributed across the four highest-fit Constellations: **AI Builder**, **AI Product Management**, **AI Trends**, **Frontier Companies**. Drafted from real episodes, drafts staged in [`lenny-archive.md`](./lenny-archive.md), human-curated against the rubric there.
- Crediting policy — **podcast root URL only**. Every PodcastNugget links to `https://www.lennysnewsletter.com/podcast`. We do *not* deep-link to specific episode pages — simpler to maintain, no broken-URL risk, sends curious users to Lenny's house where they can browse the full catalog themselves.

**Why now:** Lenny's interviews include the highest-signal voices in modern PM and AI engineering. Featuring his content adds value for our users (real expert voice inside the lesson) and sends real traffic back to him.

**User value:**
- *"There's a real expert speaking inside this lesson."*
- *"This sends me deeper when I want it."*

**Outreach to Lenny — signed off:** ship first, email same day with the live URL and the list of episodes we credited. He's more likely to share if it's already real.

**See also:** [`lenny-archive.md`](./lenny-archive.md) for the canonical schema, attribution policy, curation rubric, topic mapping (319-episode roster bucketed by Constellation), and the 12 seed nuggets.

---

### Workstream (c) — 👍 / 👎 feedback loop

**What ships:**

- Two buttons on every Spark: **👍 helpful · 👎 skip this**.
- 👎 = **permanent skip for that user on that Spark** (signed off — cleanest user promise, no re-show). Also writes a `preference` memory to mem0 — *"User disliked Spark X about Y"* — so the cognition layer stops surfacing similar shapes.
- Optional one-line *why* on 👎 (single field, never a survey).
- Roll-up in **Admin → Content**: best / worst Sparks ranked. Sparks above a sustained 👎-ratio threshold flagged for revision (not auto-deleted).
- Player-facing — admin-only counts in this round; public ratings wait for the contribution flow.

**User value:**
- *"I'm not stuck with content I dislike."*
- *"My taste shapes the path."* The cognition layer earning its keep, visibly.

---

## 3. What we are explicitly **not** building this round

- **Generation engine.** We mark hooks where a Spark / nugget generator should plug in. Content stays hand-curated + ad-hoc.
- **Public 👍 / 👎 counts.** Admin-only this round; public ratings wait for the contribution flow (Sprint 3+).
- **New Constellations.** The goal is to make existing content great, not add more.
- **mem0 contract changes.** We add *callers*, not new methods on `MemoryService`.
- **Deep-linked podcast URLs.** Root URL only — see workstream (b).

---

## 4. Acceptance criteria — each PR

A PR doesn't ship until:

- `npm test` is green (existing 266+ SPA + 44 social-svc tests pass; new behavior is covered by **new** tests).
- `npm run build` is green.
- The new behavior is verified by hand on a 390px viewport (Workstream (a) requires this; (b) and (c) verify their visible UI on mobile too).
- Docs touched at least one of: [`mvp.md`](./mvp.md), [`ux.md`](./ux.md), [`technical.md`](./technical.md), this doc.

---

## 5. PR ordering and the why

PRs land sequentially in this order:

1. **PR-0 — this docs bundle.** Ship the staging surface and the plan before any code.
2. **PR (b) — `PodcastNugget` Spark variant + admin feature flag + 12 seed nuggets.** Concrete, has the feature flag the operator just asked for, integrates the Lenny content seed.
3. **PR (c) — 👍 / 👎 feedback loop with permanent skip.** Narrow surface, shareable schema, builds on (b)'s rendering surface for a clean integration point.
4. **PR (a) — sequencer + visual-box redesign.** Touches the most files (it's the polish layer that lands on top). Easiest to land last because by then both new Spark types and feedback hooks are stable.

The standing autonomous-merge directive in [`../CLAUDE.md`](../CLAUDE.md) applies: when CI is green and there are no unresolved review threads, the agent that opened the PR squash-merges it.

---

## 6. Decisions signed off

1. **Lenny outreach** → ship first, email same day.
2. **👎 behavior** → permanent skip on that Spark for that user (also writes a `preference` memory).
3. **Sequencer aggressiveness** → start soft (hard rules + light reorder), measure, then turn up.
4. **Visual-box redesign** → bundled with the sequencer PR (workstream (a)).
5. **Lenny links** → podcast root only (`https://www.lennysnewsletter.com/podcast`), not episode-deep-linked.

---

## 7. Telemetry to add (admin-tab + console-event level)

- `session.continue_path_clicked` vs. `session.exit_clicked` — the north-star.
- `spark.thumb_up` and `spark.thumb_down` (with optional `reason` string).
- `session.sequencer.reorder_count` — how often the sequencer changed the next-Spark choice in a session.
- `podcast_nugget.shown` and `podcast_nugget.click_through` — the rate at which users actually click through to Lenny's site.

We aggregate these locally first (admin tab, mock-cohort overlay). Cross-user telemetry waits for the social-svc backend that's already in place from Sprint 2.

---

## See also

- [`lenny-archive.md`](./lenny-archive.md) — the source-of-truth on the Lenny's Podcast seam.
- [`mvp.md`](./mvp.md) — current "Not yet shipped" lists the three PRs above.
- [`vision.md`](./vision.md) — the pillar: *bite-size by default*, *wow-per-minute*, *open source is the multiplier*.
- [`technical.md`](./technical.md) — `MemoryService` contract; the sequencer is a **caller** of the contract, not a contract change.
- [`ux.md`](./ux.md) — UX of the cognition layer; update when (a) and (c) ship.
