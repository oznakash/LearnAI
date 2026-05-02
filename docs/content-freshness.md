# Content freshness, diversity, and the meta-refinement loop

> _Living operating manual for **how content is shaped and re-shaped over time**. Pairs with [`content-model.md`](./content-model.md) (the *what*) and [`aha-and-network.md`](./aha-and-network.md) (the *priority bet*). This doc is the *content engine playbook* — the rules every Spark and every prompt that generates Sparks must obey._

---

## 1. The five rules

Every Spark — hand-authored or generated — must comply:

1. **Honest about its age.** The Spark declares its `category` and `addedAt`. The renderer surfaces a freshness chip. Sparks past their category-specific shelf life either deprioritize automatically or get an "aging" warning, never silently mislead.
2. **Diverse to its neighbors.** No two consecutive Sparks recycle the same vocab atoms or the same teaching shape (e.g. two MicroReads on cost levers that overlap > 60 %). The sequencer enforces a diversity score.
3. **Tonally calibrated to the user's age band.** A *Curious 12-year-old* and a *Senior architect* see different language, different examples, different abstraction depth. The Spark optionally carries `bodyByAgeBand`; the renderer picks.
4. **Source-anchored when it can be.** Every Spark whose teaching is derived from an external source attributes that source. (Schema shipped in Sprint #1; backfill is the editorial pass.)
5. **Self-improving via meta-implicit refinement.** When a user 👎s a Spark with a critique tag (*too theoretical / outdated / wrong examples / too jargon-heavy / wrong level / too long*), the system writes a `critique` memory that **biases future content generation**, not just future ranking of the same Spark. With small N, generic patterns matter more than per-Spark signals.

The rest of this doc operationalizes each rule.

---

## 2. Freshness — the shelf-life model

Different categories of AI content age at radically different rates. Treating a *Mistral release note* the same as a *RAG fundamentals* MicroRead is malpractice.

### 2.1 Categories and their shelf lives

| Category | Examples | Shelf life | Stale signal | Refresh cadence |
|---|---|---|---|---|
| **principle** | What attention does · Why eval sets matter · The bite-size thesis | **2 years +** | rare; only when a fundamental claim is invalidated | quarterly review |
| **pattern** | Router pattern · Prompt caching · Eval-as-judge | **6 months** | when a better pattern dominates the field | monthly review |
| **tooling** | Cursor / Claude Code / pgvector / Pinecone | **3 months** | when the tool changes its interface or pricing | every release cycle of the named tool |
| **company** | Anthropic's strategy · OpenAI's playbook | **30 days** | when the company makes a meaningful announcement | weekly review |
| **news** | Today's model launch · Today's release note · Today's blog post | **14 days** | when the announcement is superseded | hourly review during launches |
| **frontier** | Top-of-firehose: arXiv preprints, lab leaks, leadership moves | **7 days** | when the conversation moves on | real-time during launches |

**Rule.** Every authored Spark **must** declare a `category`. If unknown, default `principle` (the most conservative). Generated Sparks (engine output) **must** also declare `category` — failure to declare blocks publish.

### 2.2 The freshness chip

Render below the body, above the Spark footer:

| State | Chip | When |
|---|---|---|
| **Fresh** | `📅 Added <date>` (no warning) | within shelf life |
| **Aging** | `🕒 Aging — added <date>` | between 0.5× and 1× shelf life |
| **Stale** | `⚠️ May be stale — added <date>` | past 1× shelf life |
| **Stale + auto-deprioritized** | `⚠️ Stale — auto-skipped` (admin-tunable) | past 1.5× shelf life with the auto-deprioritize flag on |

`addedAt` is required on `category: "news" | "tooling" | "company" | "frontier"`. Optional but recommended on `pattern` and `principle`.

### 2.3 The recommender consequence

The sequencer treats stale Sparks the same way it treats disliked ones — they're filtered from the queue when the admin's `flags.autoSkipStaleContent` is on (default OFF for the seed corpus, default ON once the engine ships). The user can still see them via "show me stale Sparks for this topic" in the Topic detail view (a future polish).

---

## 3. Diversity — never repeat

### 3.1 The diversity score

A pure helper `diversityScore(spark, recentSparks): 0..1`:

- **Vocab overlap.** Compute Jaccard similarity between the candidate's vocab atoms and the union of the user's last 5 Sparks' atoms. High overlap → low diversity.
- **Type repetition.** If the prior 2 Sparks were both passive (microread/tip/podcastnugget/youtubenugget) and the candidate is also passive, deboost. (The sequencer already does this for type; we now compose it into a score.)
- **Topic recency.** A Spark in the same Topic as the user's last 3 Sparks is OK; a Spark in the same *level* is suspect.

`diversityScore = 1 - vocab_overlap × 0.6 - passive_streak × 0.3 - level_recency × 0.1`

### 3.2 The sequencer consequence

`pickNextSparkIdx` extends to take a `diversityHint`. When two candidates pass the existing rules (no two passive in a row, etc.), the higher-diversity-score candidate wins.

Diversity is the **second tiebreaker**, not the first — content order still respects the level designer's intent unless tiebreaking is needed.

### 3.3 The generation consequence

Generation prompts **must** instruct the model to avoid recycling vocab atoms already in the topic (a cheap dedup) and to vary teaching shape (don't write three MicroReads in a row on the same level).

---

## 4. Tonally calibrated by age band

### 4.1 The schema

Optional `bodyByAgeBand?: { kid?: string; teen?: string; adult?: string }` on `MicroRead` and `Tip`. The renderer:

```
const profileBand = profile.ageBand ?? "adult";
const text = ex.bodyByAgeBand?.[profileBand] ?? ex.body;
```

Falling back to `body` keeps every existing Spark working unchanged. Authors only add `bodyByAgeBand` when an alternate framing is genuinely needed.

### 4.2 The kid voice — what it means

A kid-band variant of an AI Foundations MicroRead does **not** dumb down the science. It changes:

- **Vocabulary.** *"Team"* → *"group"*. *"Customer"* → *"the person using it"*. *"Eval set"* → *"a list of test questions you check against."*
- **Examples.** Stripe / Notion / Cursor → Minecraft / Pokémon search / a school project chatbot.
- **Abstraction.** *"Probabilistic specs"* → *"the answer should be helpful 95 times out of 100, never harmful"* (already concrete).
- **Removed.** Money, billing, contracts, B2B mechanics.
- **Preserved.** The actual idea. Cost levers stay cost levers; cognition stays cognition.

### 4.3 The teen voice — when needed

Sparingly. Most teens can read the adult voice; the kid-band variant covers the under-13 cohort. Use `teen` only when *adult* is genuinely off-key (e.g. mentions "your career") and *kid* is too soft for the topic.

### 4.4 The generation consequence

When the engine generates a Spark for a Topic that has any 12-year-old users, it produces both `body` (adult) and `bodyByAgeBand.kid` in the same call. The kid variant uses the same takeaway, same vocab atoms, but different language and examples.

---

## 5. The meta-implicit refinement loop

> **The defining problem at small N: any single Spark's 👍 / 👎 ratio is statistical noise.** With 50 users, a Spark with 8 votes (5 up, 3 down) tells us almost nothing. With 5,000 users and 800 votes, it tells us a lot. The naïve fix is "wait for scale." The right fix is to **collect the *why* and apply it generically** — so 50 users worth of critique signal can shape thousands of future Sparks.

### 5.1 Critique categories — the chips on 👎

Today's 👎 captures an optional free-text "why." Replace with **structured chips + free text**:

| Chip | When the user would tap it |
|---|---|
| 🪨 Too theoretical | "I wanted a working example, not a definition." |
| 🧪 Wrong examples | "The example doesn't match my world." |
| 🪦 Outdated | "This was true 6 months ago; it's not anymore." |
| 🧠 Too jargon-heavy | "I don't know what half these terms mean." |
| 🦠 Watered down | "I already know this. Where's the depth?" |
| 📏 Wrong level | "Wrong difficulty for me." |
| 📜 Too long | "Could be 3 lines, was 30." |
| ✏️ Other | (free text — used today) |

Multiple chips selectable. Free text optional in addition.

### 5.2 The `critique` memory — what gets written

For each chip the user taps:

```ts
remember({
  text: `User critiqued Spark "<title>" as <chip>: <free text>`,
  category: "critique",
  metadata: {
    sparkId, topicId, levelId,
    chip,            // "too-theoretical" | ...
    sparkType,       // "microread" | "tip" | "podcastnugget" | "youtubenugget"
    sparkCategory,   // "principle" | "tooling" | etc.
    vocabAtoms,      // the atoms used in the disliked Spark
    timestamp,
  }
});
```

These memories are user-scoped (not cross-user). At small N, an aggregate of N users' `critique` memories is computed admin-side.

### 5.3 Aggregating critiques into a generation bias

A pure helper `aggregateCritiques(memories): CritiquePattern`:

```ts
type CritiquePattern = {
  byChip: Record<CritiqueChip, number>;      // global counts
  byContentCategory: Record<string, number>;  // counts by Spark category
  byVocabAtom: Record<string, number>;        // which atoms get critiqued most
  byTeachingShape: Record<ExerciseType, number>; // microread? tip? etc.
};
```

**At admin-side aggregate level**, the pattern reveals:

- *"`too-theoretical` is the dominant complaint on `principle`-category Sparks. Generate fewer abstract MicroReads on principles; pair every principle with an applied Build Card or Scenario."*
- *"`outdated` keeps firing on `tooling` Sparks > 60 days old. Tighten the tooling shelf life from 90 → 60 days, and force a refresh review every 60 days."*
- *"`wrong-examples` correlates with vocab atom *Stripe* in topic *ai-pm*. Either rewrite those Sparks with a non-Stripe example, or add a teen-band variant for non-fintech users."*

These are **prompt inputs to the next generation cycle**. The engine reads the aggregate every time it drafts a new Spark and applies the pattern as a generation constraint.

### 5.4 The generation prompt scaffold

Every generation prompt now ends with this stanza, populated from `aggregateCritiques`:

```
Avoid:
  - {top-3 chips by global count, with frequencies}
  - The vocab atoms most critiqued in this Topic: {top-5 atoms}
  - Teaching shapes the user has been critical of recently: {top-2 shapes}

Prefer:
  - Concrete tools and brand-name examples (we get critiqued for "wrong examples"
    when we use generic placeholders)
  - Sub-200-word body (the corpus is critiqued for "too long" 23% of the time)
  - For users with `intents: ["applied"]`, end every MicroRead with a
    "Try this →" CTA matching the existing PodcastNugget shape
```

This stanza updates *automatically* every generation cycle from the critique aggregate. The engine doesn't need redeployment to learn from user critique — the prompt itself is data-driven.

### 5.5 Why this works at N = 50

| Naïve approach (per-Spark 👍 / 👎) | Meta-implicit approach (this doc) |
|---|---|
| Per-Spark votes are noisy at low N | Patterns aggregate across thousands of Spark instances of the same shape |
| Improves only the rated Spark | Improves every future Spark of the same shape |
| Requires ≥ 100 votes/Spark for signal | 50 critique signals across the corpus produce a robust generation bias |
| Brittle: a single hated Spark drags its tile | Robust: critiques flow into the *prompt*, not the *content* |

This is the central engineering bet of the engine. Without it, content quality is a manual editorial chore. With it, **content quality compounds with usage**.

---

## 6. Lenny's Podcast — scaling the seam

Today: 12 nuggets. Target this sprint: **30+ nuggets across 6+ Constellations.** Long-term target: **150+ nuggets** (≈ 1 nugget per 2 episodes; the curation rubric in [`lenny-archive.md`](./lenny-archive.md) §4 remains the bar).

### 6.1 What makes a Lenny nugget land

Patterns that consistently 👍-rate above the corpus median (from observation; will be data-driven once we have ratings at scale):

- The guest names a concrete metric or threshold (50 %, 200 %, $0.30).
- The guest contradicts received wisdom in one short sentence.
- The guest predicts something specific with a date (Boris's *"by end of year, everyone is a builder"*; Ben Mann's *"50 % chance of superintelligence by 2028"*).
- The guest names a tool or pattern by its real name (not "AI" but "Claude Code" or "RAG").

### 6.2 Distribution targets across Constellations

| Constellation | Current | Sprint #2 target |
|---|---|---|
| AI Builder | 3 | 8 |
| AI Product Management | 3 | 6 |
| AI Trends | 3 | 6 |
| Frontier Companies | 3 | 6 |
| LLMs & Cognition | 0 | 4 |
| AI News | 0 | 4 |
| Memory & Safety | 0 | 2 |
| Open Source | 0 | 2 |

That's a 3-4× expansion just from the existing Lenny archive. (See the 319-episode roster in [`lenny-archive.md`](./lenny-archive.md) §6.)

---

## 7. YouTube nuggets — pilot

A new Spark variant `YoutubeNugget` in the same shape as `PodcastNugget`. Same compression rubric ([`lenny-archive.md`](./lenny-archive.md) §4); different source.

### 7.1 Pilot constraints

- **Minimum video duration:** 5 minutes. Shorts are out — they don't have the substance to extract a meaningful nugget.
- **Maximum video age:** 2 months. Older videos are likely to fail the freshness rule (§2) for `tooling` / `news` / `company` categories.
- **Volume:** **10 videos** for the pilot — hand-curated from popular AI/CS creators. No YouTube Data API integration this PR.
- **Schema:** `videoUrl` (deep link, opens in new tab), `videoTitle`, `channelName`, `publishedAt`, `durationMinutes`, optional `timestamp`.
- **Render:** Lenny-style chip but red-tinted (YouTube brand) — `🎥 YouTube · {channel}`. "Watch on YouTube →" link below the takeaway.

### 7.2 The 10 pilot videos

Curated from Karpathy, Lex Fridman, Anthropic, OpenAI Dev Day, etc. (see `app/src/content/youtube-pilot.ts` for the seed). Manually-extracted ≤ 60-word transcript snippets.

### 7.3 Future generation

Once the engine ships, YouTube nuggets become an automated pipeline:

1. Daily query: top videos in CS / AI created in the last 14 days, > 5 min duration, > 10 k views.
2. Fetch transcript via YouTube's public transcript endpoint.
3. Compress to ≤ 60-word nugget candidate via the Spark generation prompt (with the meta-refinement stanza from §5.4).
4. Queue in admin → content for one-click human approval.
5. Auto-categorize: `news` if duration < 15 min, `pattern` if a tutorial, `company` if creator is at a frontier lab.
6. Ship.

---

## 8. The full content schema additions

For reference; the actual diffs land in the Sprint #2 PR.

```ts
// New on MicroRead and Tip:
interface SparkContentMeta {
  category?: "principle" | "pattern" | "tooling" | "company" | "news" | "frontier";
  addedAt?: string;        // ISO date
  bodyByAgeBand?: {
    kid?: string;
    teen?: string;
    adult?: string;
  };
}

// New Spark variant:
interface YoutubeNugget {
  type: "youtubenugget";
  quote: string;             // ≤ 60 words
  takeaway: string;
  source: {
    platform: "youtube";
    videoUrl: string;
    videoTitle: string;
    channelName: string;
    publishedAt: string;     // ISO date
    durationMinutes: number;
    timestamp?: string;
  };
  ctaPrompt?: string;
  category?: SparkCategory;
  addedAt?: string;
  visual?: VisualKey;
}

// New MemoryCategory:
type MemoryCategory =
  | "goal" | "strength" | "gap" | "preference" | "history"
  | "calibration" | "system" | "vocabulary"
  | "critique";  // NEW
```

---

## 9. Sprint #2 deliverables — what ships in the active PR

1. ✅ This doc (`content-freshness.md`).
2. ✅ Schema additions per §8.
3. ✅ Freshness chip + age-band rendering + new `YoutubeNuggetView`.
4. ✅ Critique chips on 👎 + `critique` memory writes + admin-side aggregation surface.
5. ✅ ~30 new Lenny nuggets across 6+ Constellations (per §6.2 distribution).
6. ✅ 10 YouTube nugget pilots (per §7.2).
7. ✅ 5 kid-band variants on AI Foundations MicroReads (proves the pattern).
8. ✅ ~30 existing Sparks tagged with `category` + `addedAt` (proves the freshness chip).
9. ✅ Tests + live preview verification.
10. ✅ Doc updates (`mvp.md`, `metrics.md`, `INDEX.md`, `lenny-archive.md`).

---

## See also

- [`content-model.md`](./content-model.md) — the *what*.
- [`aha-and-network.md`](./aha-and-network.md) — the *priority bet*.
- [`lenny-archive.md`](./lenny-archive.md) — the canonical source-anchored Spark template.
- [`metrics.md`](./metrics.md) — the KPI tree this engine is responsible for moving (Spark median quality, content age, source CTR).
- [`first-time-builder-findings.md`](./first-time-builder-findings.md) — the empirical content audit that pre-dated this doc.
