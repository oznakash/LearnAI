# The content model — bite-size compression of the AI firehose

> _The product LearnAI is a **personal compression layer** for the AI internet. Any data point — a 4-hour podcast, a 60-page paper, a release-note thread, a launch memo, a YouTube tutorial — gets compressed, through the lens of AI topics, into Sparks shaped to **your** mental model. You always keep the door open: zoom in, see the source, skip what's not relevant, or move on._
>
> _This doc is the one place that defines what content **is** at LearnAI. Everything else — Spark formats, the cognition layer, the contribution flow, the metrics — ladders back to here._

---

## 1. The thesis, in one sentence

**LearnAI is a knowledge compressor, not a curriculum.** We do not write courses. We compress the firehose into the user's bite-size budget, in the moment, through the lens of what *they* are trying to understand — and we hand them the controls to expand, see the source, skip, or move on at every step.

The competitive frame: Coursera and Duolingo built **fixed curricula**. Twitter and YouTube serve **infinite firehose**. LearnAI is the **compression layer that lives between them**, custom-fit to each user's mind. *That* category does not exist yet. We are defining it.

---

## 2. Five principles

These five are the constitution of the content layer. Anything we ship must pass all five.

### 2.1 Bite-size by default — but the bite is a function of the user

The bite is **not 5 minutes**. The bite is **the smallest unit that delivers a real insight to *this* user, given what they already know.**

For a senior architect, the bite-size on "prompt caching" is one paragraph + a code snippet. For a curious starter, the same insight is three paragraphs + a definition of what tokens are. The cognition layer (§5) shapes the bite-size; we do not.

**5 minutes is the *hook*, not the *cap*.** Once a user is engaged, longer sessions are the win — provided every additional minute carries a new compressed insight, not a stretched one.

### 2.2 Source-anchored — any source can become a Spark

Source-of-truth is not the Spark. Source-of-truth is the **original artifact**: a Lenny's Podcast episode, a paper on arXiv, a launch memo, a YouTube video, a release note, a Hacker News thread, a maintainer's blog. The Spark is the *compressed view*, presented under attribution.

| Source type | Spark variant (existing or proposed) | Status |
|---|---|---|
| Long-form interview podcast | `PodcastNugget` | ✅ Shipped (Lenny's Podcast — see [`lenny-archive.md`](./lenny-archive.md)) |
| Long-form video / YouTube | `VideoNugget` | Proposed |
| Paper / arXiv preprint | `PaperNugget` | Proposed |
| Release note / changelog | `ReleaseNote` | Proposed |
| Long-form essay / memo | `EssayNugget` | Proposed |
| Newsletter issue | `NewsletterNugget` | Proposed |
| Hand-authored teaching | `MicroRead`, `Tip`, `QuickPick`, `FillStack`, `Scenario`, `PatternMatch`, `BuildCard`, `Boss` | ✅ Shipped (8 formats) |

Every Spark whose origin is an external artifact carries:

1. A **source attribution chip** (e.g. *🎙️ Lenny's Podcast — Boris Cherny*).
2. A **deep link** back to the artifact when one exists; root link as fallback. (See [`lenny-archive.md` §5](./lenny-archive.md) for the attribution policy that today applies to PodcastNugget; future variants inherit this shape.)
3. A **"see the original"** affordance the user can take any time without leaving their flow.

The hand-authored formats stay first-class — they're how we cover ground no source has yet — but the **share of source-anchored Sparks should compound** as the corpus grows. A LearnAI corpus that's 80% original creator's voice + 20% LearnAI's own commentary is the natural endpoint.

### 2.3 Expandable on demand — three choices on every Spark

Every Spark is a **decision surface**, not a one-way street. The user always has three first-class actions:

| Choice | What it means | What happens |
|---|---|---|
| ✅ **I got it** | This landed; move me forward | Spark complete; XP awarded; cognition layer logs this concept as understood |
| 🔍 **Zoom in** | I want to go deeper on this | A child Spark is generated or surfaced (see §3); the user can keep zooming until they're satisfied |
| ⏭ **Skip / not now** | This isn't relevant in this moment | Spark is not 👎-ed (still available later); cognition layer logs a soft de-prioritize |

The three are **separate from the existing 👍 / 👎 feedback row** (which is a quality signal on the Spark itself). Zoom-in / Skip are signals about the user's **state of mind right now**. The cognition layer treats them as orthogonal axes.

The most underweighted of the three today is **Zoom in**. We surface concepts users may not know — *RAG, eval set, prompt caching, distillation, MCP* — and a casual user has no inline way to learn the term and come back. That gap is one of the four near-aha moments named in [`first-time-builder-findings.md`](./first-time-builder-findings.md).

### 2.4 Just-in-time knowledge — terms become Sparks on tap

A Spark sometimes uses vocabulary the user hasn't met yet. The system has three responses, in priority order:

1. **Inline tap-to-define** — every term we know is a vocabulary atom. User taps the term → mini definition popover, optionally with a "Tell me more →" that spawns a child Spark.
2. **Spawn a parent-pointer child Spark** — when "more" is requested, the new Spark carries a back-link to the parent so the user can return to the original flow.
3. **Defer** — if the term doesn't matter for the takeaway, the user can skip the lookup and finish the Spark. The cognition layer logs *"saw this term, didn't expand"* — useful signal but not a gap.

The vocabulary atom is the smallest content unit in the corpus. It is **not** a Spark — it's the leaf. A Spark is a composition of vocabulary atoms in service of a takeaway.

### 2.5 Mind-shaped — the cognition layer is the compressor

Compression is lossy by definition. The lossiness has to be **personal**, not generic. The cognition layer (mem0; see [`mem0.md`](./mem0.md), [`ux.md`](./ux.md)) is what makes the compression personal. Specifically, it tracks:

| Memory category | What it captures | Where it shapes the content |
|---|---|---|
| `goal` | What the user told us they want, refined over time | Picks the *first* Spark of every session; orders Topics on Home |
| `intent` | Curious / Applied / Decision / Researcher / Forker — implied from action signals | Picks the *secondary* CTA after a Level (Build Card vs. Go Deeper vs. Read more) |
| `vocabulary` | Terms the user has been exposed to and engaged with | Decides when to inline-define vs. assume; tunes bite-size |
| `strength` | Concepts the user has demonstrated mastery of | Deboosts redundant Sparks; unlocks deeper levels |
| `gap` | Concepts where the user's signal is mixed | Reinforces with related Sparks; offers "zoom in" surface proactively |
| `preference` | What shapes the user has 👎-ed | Filters those shapes out; informs the sequencer |
| `history` | What's been completed | Powers cross-device sync and "where was I" |

Today the loop runs but several of these (`intent`, `vocabulary`) aren't yet writing memories. That's the work — see §8.

---

## 3. The compression pipeline

The conceptual flow from any source to a delivered Spark:

```
   ┌─────────────────────────────────────────────────────────────┐
   │  1. Source artifact                                         │
   │     (4hr podcast · 60-page paper · 47-min video ·           │
   │      release thread · launch memo · newsletter)             │
   └────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  2. Compression — produced by an editor (human or AI-       │
   │     assisted), curated to the rubric in `lenny-archive.md`  │
   │     §4 (smart-friend / compress / concrete / earned).       │
   │     Output: a *Spark candidate* — verbatim quote + take-    │
   │     away + source attribution + linkbacks.                  │
   └────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  3. Tagging                                                 │
   │     - Topic / Constellation                                 │
   │     - Vocabulary atoms used                                 │
   │     - Concept difficulty band (starter/builder/visionary)   │
   │     - Intent fit (curious/applied/decision/researcher)      │
   │     - Source metadata (creator, episode, timestamp, URL)    │
   └────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  4. Personalization at delivery (cognition layer)           │
   │     - Should this user see this Spark *now*?                │
   │     - At what bite-size? (skip preamble / inline-define X)  │
   │     - With which secondary CTA? (Zoom / Build / Go deeper)  │
   │     - Sequenced where in the level / session?               │
   └────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  5. The user's three-choice surface                         │
   │     ✅ Got it · 🔍 Zoom in · ⏭ Skip                          │
   │     +  👍 / 👎 quality signal · 📚 see source              │
   └─────────────────────────────────────────────────────────────┘
```

Step 2 is the only step where original content is created. **Steps 3, 4, 5 are pure software** — and that's why this product can scale to thousands of sources without becoming a course-authoring shop.

Today: steps 2–3 are entirely manual (we hand-author or hand-curate). The first source-anchored format (PodcastNugget for Lenny's archive) proves step 2 works. Scaling step 2 with AI-assisted compression (under human approval) is the **content generation engine** in the roadmap (Sprint 3 territory; see [`roadmap.md`](./roadmap.md), [`first-time-builder-findings.md`](./first-time-builder-findings.md) #7).

---

## 4. What a Spark *is* and *isn't*

| A Spark IS | A Spark ISN'T |
|---|---|
| A **compressed view** of source material under attribution | The source itself |
| **Bite-size in the user's frame**, not a fixed length | A pre-cut chunk on a calendar |
| **Personalized at delivery** by the cognition layer | A static page everyone sees the same |
| Always **expandable** to the source or a child Spark | A dead-end |
| Always **skippable** without penalty if not relevant *now* | A required step |
| **Source-attributed** when it comes from an external artifact | Anonymous summarization |
| **Authored once, delivered many ways** (different bite-sizes per user) | Re-authored per user |

---

## 5. The user's mental model on a Spark

Every Spark, in the user's head, runs through a tiny three-question evaluation:

1. **Do I get it?** → ✅ Got it. Move on.
2. **Do I want more on this?** → 🔍 Zoom in. Spawns a child Spark with the parent linked.
3. **Is this for me right now?** → ⏭ Skip. Bookmark / try-later / quietly de-prioritize.

If the answer to all three is *no* — i.e. *"this isn't for me ever"* — that's the existing 👎 (permanent skip; PR #64). Today we conflate "not now" with "never." Splitting them is part of §8.

This is the same shape that has worked across consumer learning and content products:

- **TikTok's** 👍 / 👎 / Show-me-more is a stripped version of this.
- **Anki's** difficulty levels (again / hard / good / easy) is a more granular version.
- **Wikipedia's** hyperlink graph is the zoom-in primitive at internet scale.

We're applying the same mental model to AI knowledge, with attribution on every step.

---

## 6. The wide → narrow → wide pattern

The platform must **go wide on intake, narrow per Spark, then let users go wide again** at any time. (This was the user-facing correction that produced this doc — see chat history.) Three implications:

### 6.1 Wide on intake

Onboarding asks not just *"what topic do you like?"* but *"what mode are you in?"* — curious / applied / decision-maker / researcher / forker. The user can pick more than one. (Implementation: an `intent` memory written at onboarding completion.)

### 6.2 Narrow per Spark

Every Spark interaction is signal: did they expand the takeaway? click "Zoom in"? rate it? skip it? mark a term unfamiliar? The cognition layer accumulates these and **narrows the next-Spark choice** accordingly. The narrowing is invisible to the user but visible in their Memory tab — the moat is *legibility*, not magic.

### 6.3 Wide again on demand

The user is never trapped in a narrow path. First-class affordances:

- **"Take me somewhere new today"** on Home — explicitly breaks the narrowing.
- **Recalibrate** — the existing 5-question quiz; resets and re-shapes the path.
- **Try a different Topic** — already exists as a secondary CTA.
- **Zoom out** at the end of a Spark chain — *"want to step back to the parent topic?"*

The narrowing is a *default*, never a *constraint*.

---

## 7. What this is NOT

We don't have to be everything. Saying no protects the thing.

- We are **not a course platform.** The bite is shaped to *the user*, not a syllabus week. Coursera exists.
- We are **not a feed.** The compression is intentional, not optimized for engagement. TikTok / X exist.
- We are **not a video site.** We compress videos *into Sparks*. The video stays where it is. YouTube exists.
- We are **not a Q&A board.** We don't crowdsource arbitrary questions. Stack Overflow exists.
- We are **not a search engine.** A user comes here to *grow their mind*, not to look up an answer. Google exists.
- We are **not a wrapper around an LLM.** The Sparks are text — authored, attributed, durable. Nothing important regenerates on every visit.

---

## 8. What this means for the roadmap

The model above implies a concrete next-PR queue. Each item maps to a KPI in [`metrics.md`](./metrics.md).

| # | Change | Primary KPI moved | Effort | When |
|---|---|---|---|---|
| 1 | **Three-choice row on every Spark** — *✅ Got it · 🔍 Zoom in · ⏭ Skip* alongside 👍 / 👎. Wire the existing 👍 to "Got it + helpful" so we don't bloat the surface | Sparks/session · NPS · "felt made for me" ≥ 80% | M | Now |
| 2 | **`intent` memory captured at onboarding** — multi-select: Curious / Applied / Decision / Researcher / Forker. Stored as `goal`-category memories with `intent` metadata | Memory acceptance ≥ 45% · personalization-quality self-report | S | Now |
| 3 | **Intent-aware Level-Cleared CTA** — secondary nudge picked from the table in §5 of [`first-time-builder-findings.md`](./first-time-builder-findings.md). Replace the universal "Try a different topic" | NS (WAB, via the *or contribution* branch as well as Build Cards) | S | Now |
| 4 | **`vocabulary` memory category** — every Spark declares the vocab atoms it uses; on completion the user's vocab is updated; new Sparks check before assuming | Memory drift / staleness · "felt made for me" | M | Next |
| 5 | **Inline term tap-to-define** in MicroRead / Tip / PodcastNugget bodies — atoms render as subtle underlines; tap → popover → optional zoom-in Spark | Sparks/session (productive zoom) · session length P50 | M | Next |
| 6 | **Source-anchored Spark variants** — `VideoNugget`, `PaperNugget`, `ReleaseNote`. Same shape as `PodcastNugget`. Each carries source attribution + linkback | Spark count growth · perceived freshness | M | Next |
| 7 | **AI-assisted compression pipeline** (the "engine") — daily cron picks one source per Topic, drafts 3 candidate Sparks via the existing PromptStudio shape, queues for human approval | Spark velocity 5× · author retention · publish rate 40–60% | L | Next |
| 8 | **"Take me somewhere new today" affordance** on Home — first-class wide path | NPS · "felt made for me" · session diversity | S | Next |
| 9 | **Vocabulary-tagged sequencer** — extends the soft sequencer to bias toward Sparks that fill `gap` vocab and skip Sparks that recycle `strength` vocab | Memory-derived recommendation acceptance · 👍 rate | M | Later |
| 10 | **Cross-source Spark stitching** — a Spark on "RAG" should know about the Lenny PodcastNugget on RAG, the Anthropic blog post on RAG, the Hugging Face course module on RAG. Surface as a "more on this" panel | Source CTR · session length · cognition-on retention delta | L | Later |

---

## 9. KPIs this model is responsible for moving

These are the [`metrics.md`](./metrics.md) lines this content model has to move. If they don't, the model is wrong.

### Direct (the lines this model owns)

| Metric | Healthy direction | Why this model owns it |
|---|---|---|
| **Sparks per active session** | 4–7 | Bite-size is right when this is in band. Above = binge; below = not enough |
| **Wow-per-minute** (👍 rate on Sparks) | ≥ 70% | The single best proxy for compression quality |
| **Spark median quality** (👍 ÷ exposures) | ≥ 0.55 | Curriculum quality over time |
| **Time-to-first-Spark-completed** | < 90 s median | First compression must land in under a minute and a half |
| **Memory-derived recommendation acceptance** | ≥ 45% | Compression is personal; this measures whether personalization is felt |
| **Personalization-quality self-report** ("felt made for me") | ≥ 80% strongly agree | The user-facing test of §2.1 |
| **Source CTR** (clicks on attribution links) | ≥ 8% | The expandability promise of §2.3 |
| **Zoom-in rate** (% of Sparks where user taps Zoom) | 5–15% (band) | New metric — too high = bite-size wrong; too low = expandability not felt |
| **Skip-not-down rate** (⏭ vs 👎) | Skip should outnumber 👎 by ≥ 4:1 | New metric — confirms that "not now" lives apart from "never" |
| **Boss Cell pass rate** | 55–75% on first attempt | Compression accuracy: did the personalization meet the user where they are? |

### Indirect (lines this model contributes to but doesn't solely own)

- **L7 / L28** (depth of engagement) — better compression → more sessions per week.
- **NPS** ≥ 50 — better-shaped Sparks → more "this is for me."
- **Cost per WAB / month** < $0.80 — bite-size + smart cognition keeps LLM spend in band.
- **Cognition-on vs cognition-off W4 retention delta** ≥ +20% — *the* moat metric. If the model in §5 is right, this lights up green.

### Guardrails the model defends against

- **Time-on-app per session creep** > 25 min P50 — would mean we drifted into engagement-bait. Compression is the antidote.
- **Doom-scroll rate** > 4 consecutive Sparks without 👍 — feed quality failure. Trigger a freeze + content-quality sprint per [`metrics.md` §3.3](./metrics.md#33-engagement--ux-quality).
- **Spark median quality** < 0.45 for 2 weeks — same response.

---

## 10. How this connects back to vision and problem

The thesis here is the **active form** of the strategic claims in [`vision.md`](./vision.md) and [`problem.md`](./problem.md).

| Vision pillar | What this content model contributes |
|---|---|
| Bite-size by default | §2.1 — bite-size is *user-shaped*, not fixed-length |
| Personal, not generic | §2.5, §5 — the cognition layer is the compressor |
| Always current | §2.2 — source-anchored variants follow the firehose, not a syllabus |
| Built for doing | §2.3 + intent-aware secondary CTA — Build Cards offered when intent says applied |
| Open source is the multiplier | §2.2 — the source pipeline is exactly what a fork inherits |
| The cognition layer is the moat | §2.5, §5 — this is where the moat lives |
| Social adds on top of value, never below | The compression model has to feel good *solo* before the social network compounds |

| Problem statement (`problem.md`) | What this content model fixes |
|---|---|
| Twitter is a firehose | We compress the firehose into bite-size, *personally* |
| YouTube wants 47 minutes | We compress to 1–3 min, link back to YouTube for those who want it |
| Courses go stale | The corpus refreshes from sources weekly (when the engine ships) |
| Newsletters are linear | Cognition-layer-driven sequencing is non-linear by design |
| Theory without doing rots | Intent-aware CTAs route applied-mode users into Build Cards |
| AI FOMO | Visible *daily* progress + provenance back to the source closes the loop |

---

## See also

- [`vision.md`](./vision.md) — the strategic claims this model implements.
- [`problem.md`](./problem.md) — the gap this model closes.
- [`metrics.md`](./metrics.md) — the KPIs this model is responsible for moving.
- [`first-time-builder-findings.md`](./first-time-builder-findings.md) — the live-product audit that surfaced the gaps this model addresses.
- [`lenny-archive.md`](./lenny-archive.md) — the first source-anchored variant (`PodcastNugget`) and the curation rubric every future variant inherits.
- [`mem0.md`](./mem0.md) — the cognition layer this model treats as the compressor.
- [`ux.md`](./ux.md) — UX of the cognition layer; will need extension when zoom-in / skip / intent ship.
- [`mvp.md`](./mvp.md) — what's shipped today vs. the queue in §8.
- [`roadmap.md`](./roadmap.md) — when each item in §8 lands.
- [`content-experience-plan.md`](./content-experience-plan.md) — the prior PR-shaped plan; many of those items are subsumed into this model and re-prioritized in §8.
