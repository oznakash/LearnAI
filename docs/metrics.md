# Metrics & KPIs

> _The numbers that tell us we're winning the right game. North Stars, supporting inputs, and the guardrails that keep us honest. Auditable. Updated every PR that meaningfully shifts a curve._

This is the executive product playbook for **what to measure, why, and what would make us walk away from a number even if it's going up**. It exists because [`manifesto.md`](./manifesto.md) and [`vision.md`](./vision.md) set the destination, [`mvp.md`](./mvp.md) shows where we are, but none of them tell a builder "the dashboard turned red — change course." This one does.

---

## 1. The principle: measure for the player, not against them

Most consumer apps optimize for **time-on-app**. We optimize for **time-saved + things-shipped + things-shared**. That difference shows up in the math:

| Big-tech default | LearnAI default | Why we pick the second |
|---|---|---|
| DAU × session length | DAU × *Sparks completed* × *Build Cards shipped* | Time alone rewards rabbit-holing. We reward output. |
| Posts per user per day | Useful Sparks per user per day (rated 👍) | Posting volume ≠ teaching value. Quality is the unit. |
| Friend graph density | *Knowledge-distribution* density (Sparks consumed from another user × ratings) | Following someone is cheap. Learning from them is signal. |
| Notification CTR | Notification-driven *return-and-finish* rate | Pings that get clicks but no completion are noise. |
| Retention curve flattening at any cost | Retention curve flattening *with* shipping rate flat-or-up | A retained user who never builds is a leak we should fear. |

**Rule:** every chart we build must have a "did this *help the user*?" companion chart. If we can't answer yes, we don't ship the win.

---

## 2. The North Star Metric

> **Weekly Active Builders (WAB).**
> A signed-in player who, in a rolling 7-day window, completed **≥ 3 Sparks** *and* **≥ 1 Build Card** *or* **≥ 1 contribution** (Spark authored, Tip submitted, Boss Cell passed, Spark rated).

Why this one:

- It's a *behavior*, not a vanity (DAU doesn't distinguish a tab open from a brain engaged).
- It bundles the three loops from [`README.md`](../README.md) — **Learn + Build + Share** — into one number. You can't fake it with one loop.
- It scales with the vision pillars in [`vision.md`](./vision.md): bite-size habit (frequency), build-don't-just-read (output), social by design (contribution).
- It is **not** time-on-app. A WAB who finishes in 9 minutes is better than one who lingers 90.

**Year-1 target:** 10,000 WAB by month 12 of Sprint 1 turning on. (Matches the vision.md year-1 marker.)

**The one chart for the leadership review:** WAB / week, with the *retention triangle* underneath it (W1 / W4 / W12 cohort retention of WABs). If the triangle thickens, we're compounding. If it thins, no growth tactic above will save us.

---

## 3. The supporting layer — input metrics

These are the levers a PM or contributor can actually move in a sprint. Group them by where they sit in the player's journey.

### 3.1 Acquisition & Marketing

| Metric | Healthy direction | Why |
|---|---|---|
| **Visit → sign-in conversion** | ≥ 35% | Hero + value prop + 1-tap Google sign-in should clear the gate. Below 25% means the landing story is unclear. |
| **Source-of-truth attribution** (organic / referral / share-link / fork-card / podcast / community) | Diversified, no source > 60% | A single channel collapsing kills momentum. Avoid Twitter-only growth. |
| **Cost per WAB (CAC, when paid is on)** | < 1× revenue per WAB at steady state, < 3× during land-grab | Standard, with the twist: we count revenue *and* contribution value (a high-quality Spark author is worth more than a passive sub). |
| **Share-link CTR** (recipient clicks "share this Spark / profile") | ≥ 8% | The *organic* growth lever. If a Spark isn't worth forwarding, fix the Spark. |
| **Branded search volume** (`learnai`, related) | Compounding 10–20% MoM in year 1 | Word-of-mouth proxy. |
| **Fork-of-the-engine count** (GitHub forks of `oznakash/learnai`) | Compounding | The five-year vision moat. Each fork is a long-term distribution channel. |

**Guardrail:** if `Visit → sign-in` is high but day-1 retention is low, marketing is over-promising. Tighten the hero, don't loosen the funnel.

### 3.2 Onboarding & Activation

The 6-step wizard plus first session must produce a **wow inside 5 minutes**, every time. Activation is where most education products bleed users.

| Metric | Healthy direction | Notes |
|---|---|---|
| **Onboarding completion** (all 6 steps) | ≥ 85% | We already have this in admin Analytics. Below 70% means a step is asking too much. |
| **Time-to-first-Spark-completed** (from sign-in) | < 90 seconds median | The "wow" budget. |
| **Time-to-first-Build-Card-pasted** (from sign-in) | < 10 minutes for the active 70th-percentile user | Build = the moment the product earns its place. |
| **Day-1 activation rate** (signed in & finished ≥ 1 level) | ≥ 60% | The single best predictor of W1 retention in our cohorts. |
| **Recalibration completion** (when offered) | ≥ 50% | If users skip recalibration, the personalization promise rots. |
| **Personalization-quality self-report** ("did this feel like it was made for you?", post-onboarding) | ≥ 80% strongly agree | We add the prompt at level 2. Cheap to ask, expensive to ignore. |

**Guardrail — onboarding length creep:** every additional onboarding step costs ~5–8% of completion. Adding a step requires removing one, or proving > 8% lift on D7 retention to justify it.

### 3.3 Engagement & UX quality

This is where time-on-app would lie to us. Replace it with *useful* engagement.

| Metric | Healthy direction | Anti-metric (what we will NOT chase) |
|---|---|---|
| **Sparks per active session** | 4–7 (the "I had a snack, not a meal" zone) | 20+ Sparks/session — that's a binge, not a habit. Investigate. |
| **Wow-per-minute self-report** (👍 on Spark) | ≥ 70% Sparks rated 👍 of those rated | Volume of ratings (we don't reward authors who beg for ratings). |
| **Build Streak (active streaks ≥ 7 days)** | Compounding share of WAB | Streak count alone — a player on a 200-day streak who hates the product is a flight risk, not a fan. |
| **Focus-ran-out rate** (player hit zero Focus and bounced) | < 8% of sessions | If high, the difficulty curve is misaligned. Tune via admin. |
| **Boss Cell pass rate** | 55–75% on first attempt | Below 40% = punishing. Above 85% = trivial. |
| **Spark accuracy** (correctness on Quick Pick / Pattern Match / Fill the Stack) | 65–80% rolling | Same band. The cognition layer should *protect* this band. |
| **L7 / L28** (Lx = days active in last x) | L7 ≥ 3, L28 ≥ 10 for retained cohort | Standard Meta-style depth-of-engagement signals. |
| **Session length P50** | 6–12 min | Longer = we drifted into time-on-app land. Shorter = we're not delivering value per visit. |
| **NPS / CSAT** (in-app, post-level pulse) | NPS ≥ 50, CSAT ≥ 4.4 / 5 | Below those = the magic is fading. |

**The "is this fun?" floor:** if 👍 rate on Sparks drops below 60% for two weeks, freeze new feature work and run a quality sprint instead.

### 3.4 Content generation & the creator funnel

This is where LearnAI stops being an app and starts being a network. Sprint 3 onward.

| Metric | Healthy direction | Why |
|---|---|---|
| **Authored-Spark count per week** (community + maintainer) | Community share ≥ 50% by Sprint 3 done | Hits the [`roadmap.md`](./roadmap.md) Sprint 3 "Done when". |
| **Spark publish rate** (drafts → approved Sparks) | 40–60% | Below 40% = AI review is too strict, contributor pain. Above 70% = quality is leaking. |
| **Author retention** (% of contributors who publish a 2nd Spark within 30d) | ≥ 35% | Single-Spark authors are tourists. We want creators. |
| **Top-author concentration** (Gini of authored Sparks) | < 0.65 | Too concentrated = a few stars carry the network. Too distributed = no breakout creators. |
| **Time-to-first-publish** (sign-up → first authored Spark) | Median < 14 days for the contributor segment | The ramp from learner → teacher. |
| **Spark median quality** (👍 rate ÷ exposures) | ≥ 0.55 | The single number that says "is the curriculum getting better?" |
| **Fork-back contribution rate** (community Sparks pulled into upstream) | Compounding monthly | The fork ecosystem feeding itself, per [`fork-recipe.md`](./fork-recipe.md). |
| **AI-co-author transparency** (Sparks where AI is named as co-author) | 100% when AI was used | Trust. Non-negotiable. |

**Guardrail — content slop:** if median 👍 rate falls below 0.45 for two weeks, the AI-review threshold gets stricter automatically (admin tuning).

### 3.5 Network effect & social loops

Every viral consumer network — Facebook, Instagram, TikTok — has a "magic moment" early in life that predicts every future cohort. Ours is **the first time a player learns from another player's Spark and rates it 👍**. We measure ruthlessly around that.

| Metric | Healthy direction | The Meta/IG analogue |
|---|---|---|
| **Magic-moment hit rate** (% of new users who 👍 a community-authored Spark within 7 days) | ≥ 30% by Sprint 3 | "7 friends in 10 days" (FB). |
| **Viral coefficient (k)** | ≥ 0.3 organically; > 0.7 with referral mechanics | k > 1 = self-sustaining growth. |
| **Cycle time** (days from invited → invites others) | < 21 days | Faster cycle compounds faster. |
| **Follow-graph density** (median follows per WAB, post-Sprint 2) | 5–25 — the "small world" zone | Higher = noise, lower = ghost town. |
| **Feed sourcing health** (% of feed Sparks that the viewer rates 👍) | ≥ 50% | TikTok-style: feed quality is the product. |
| **Share-out rate** (Sparks shared / Sparks completed) | ≥ 5% | The natural funnel of "this was good — pass it on". |
| **Talent-graph signal density** (% of public profiles with ≥ 1 verified Build Card) | ≥ 70% by Sprint 4 done | Without verified work, Talent Match is just LinkedIn lite. |

**Guardrail — social before substance:** never ship a leaderboard / feed / follow feature when the prior feature's quality metric is red. Per [pillar 4](./vision.md#4-social-is-added-on-top-of-value-never-below-it): social *adds* to value, never substitutes for it.

### 3.6 Cognition layer health (the moat)

Per [`docs/mem0.md`](./mem0.md) and [`ux.md`](./ux.md). The cognition layer is the differentiator — its quality has to be measurable, not vibes.

| Metric | Healthy direction | Why |
|---|---|---|
| **Memory-derived recommendation acceptance** | ≥ 45% accept rate | Above the heuristic-only baseline (~20–25%). |
| **"Why?" expansion rate** (player taps "why is this recommended") | 5–15% | Healthy curiosity. Above 25% = recommendations feel opaque or wrong. |
| **Recall latency P95** | < 800 ms | UX budget; above this and the suggestion arrives after the player has moved on. |
| **Memory drift / staleness** (% of stored facts contradicted by recent behavior) | < 15% rolling | If high, the extractor is over-eager. |
| **Player edits to memory** | Healthy: any non-zero. Concerning: ≥ 40% of WAB editing weekly = trust gap. | Visibility is good; mass-editing is a smell. |
| **Memory wipe rate** | < 1% of WAB / month | A wipe is a "you scared me" event. |
| **Cognition-on vs cognition-off retention delta** (W4) | ≥ +20% absolute | If cognition-on doesn't move retention, our moat isn't a moat. |
| **Cost per cognition-on user / month** | < $0.30 (LLM + infra) | The unit economics that make personalization viable. |

**Guardrail — privacy parity:** every new memory hook ships with the matching `forget` path *and* an entry in the Your Memory tab. No exceptions. Measured by automated audit on every PR.

### 3.7 Talent Match & monetization (Sprint 4+)

When the social graph matures, Talent Match becomes the first revenue line per [`roadmap.md`](./roadmap.md).

| Metric | Healthy direction | Why |
|---|---|---|
| **Verified Build Cards per active profile** | ≥ 3 median | The signal recruiters pay for. |
| **Recruiter search → outreach rate** | ≥ 25% | Search without outreach = the index isn't useful. |
| **Outreach → reply rate** | ≥ 30% | Far above LinkedIn InMail (typically 10–18%). |
| **Reply → hire conversion** | ≥ 8% | Per role, with reasonable sample. |
| **Days from search → hire** | < 21 median | The whole pitch is "faster than LinkedIn". Prove it. |
| **Hire-attributed revenue per WAB** | Compounding | Connects the platform's success to the player's success without ads. |
| **Builder NPS post-hire** | ≥ 60 | The hired user is a marketing asset for life. Treat them well. |
| **Anti-fake rate** (Build Card completions flagged & verified) | < 2% disputes upheld | Trust collapses fast if the verified-work signal isn't actually verifiable. |

**Guardrail — never become a recruiter spam channel.** Cap recruiter outreach per builder per month. If "recruiter messages received" exceeds "Sparks completed" for any user-week, that user is being abused. Throttle.

### 3.8 Fork ecosystem (the platform stage)

| Metric | Healthy direction |
|---|---|
| Live forks (deployed instances calling distinct mem0 servers) | Compounding, ≥ 25 by year 2 |
| Cross-fork Spark adoption rate (upstream Sparks pulled to forks; fork Sparks pulled upstream) | Bidirectional, both > 0 monthly |
| Fork retention (forks still active 90 days after launch) | ≥ 50% |
| Vertical diversity (forks beyond AI: kids, languages, on-call, sales, etc.) | ≥ 5 verticals by year 2 |

---

## 4. Guardrails — what we WILL NOT trade away

These are the metrics whose decline blocks shipping, even if everything else is up. They mirror the "what we will not do" list in [`vision.md`](./vision.md#-what-we-will-not-do).

| Guardrail | Threshold | Action when breached |
|---|---|---|
| **Time-on-app per session creep** | > 25 min P50 | Audit feed for engagement bait. Strip mechanics that reward lingering. |
| **Doom-scroll rate** (consecutive Sparks without 👍) | > 4 P75 | The feed is failing. Pause feed expansion. |
| **First-week regret rate** (`/settings/delete-account` within 7 days) | > 5% | Onboarding is over-promising or experience under-delivering. |
| **Memory complaints** (Your Memory tab abandons / mass-wipes) | > 3% MoM | Trust is eroding. Pause new memory hooks. |
| **Spark median quality (👍 rate)** | < 0.45 for 2 weeks | Freeze features. Run a content quality sprint. |
| **Performance** (TTI, P75 mobile) | > 3.5s | Block all merges that don't reduce it. |
| **Accessibility regressions** (axe critical findings) | > 0 | Block merge. |
| **Hostile-DM rate** (post-Sprint 4) | > 0.5% of weekly DMs reported | Tighten outreach throttle, ban tier escalation. |
| **Vendor-lock drift** (% of curriculum that requires a single vendor's tool to complete) | > 25% | We are an *AI builder's daily diet* — vendor-neutral by charter. |
| **Open-source dilution** (closed-source modules creeping into the core) | Any | Refuse merge. The MIT license is the moat. |
| **Cost per WAB / month** | > $0.80 | Personalization economics break. Throttle LLM use. |

**The big one: no growth tactic survives a guardrail breach.** Reverse the launch, fix the cause, then retry.

---

## 5. Competitor & market awareness

We exist in an ecosystem with [`competitors.md`](./competitors.md) listing the named threats. We don't measure them daily, but the following signals tell us when an adjacent player is arriving in our quadrant.

| Watch signal | Why it matters | Cadence |
|---|---|---|
| **Duolingo / Brilliant** ship a memory layer or a vertical-AI track | They have the user habit; if they add cognition, our moat shrinks | Monthly |
| **LinkedIn Learning + AI** announces behavioral / shipped-work signals on profiles | Direct attack on Talent Match | Monthly |
| **Anthropic / OpenAI / Google** ship a consumer learning app | Vendor academy → platform pivot | Bi-weekly |
| **GitHub / Microsoft Copilot** adds learning to the IDE | Most likely structural competitor | Monthly |
| **TikTok / YouTube Shorts** AI-creator ecosystem density (top 100 AI educators, posting cadence) | Their attention captures our oxygen | Monthly |
| **mem0 / Letta / Zep** pricing or licensing changes | Affects our cost per cognition-on user | When announced |
| **Open-source forks of *us*** that gain traction | A fork going viral is a *positive* signal, but tells us where the vertical demand is | Monthly |

**Rule of thumb:** if a competitor enters our quadrant (real-time *and* personalized — see [`competitors.md`](./competitors.md)), we don't try to out-feature them. We out-*compound* them on community, cognition fidelity, and shipping rate.

**Defensibility audit — quarterly:** for each defensibility item in `competitors.md` § "What gives us defensibility", confirm it still holds. If any item flips, escalate to roadmap re-prioritization.

---

## 6. Cadence & ownership

| Cadence | What we look at | Who |
|---|---|---|
| **Daily** (auto, in admin Analytics) | DAU, sign-ins, sparks completed, error rate | On-call eng |
| **Weekly review** | WAB, retention triangle, magic-moment hit rate, top 3 guardrails | Product lead |
| **Monthly business review** | Full North Star + supporting layer + competitor watch + cost per WAB | All |
| **Quarterly defensibility audit** | `competitors.md` defensibility items, fork ecosystem health, moat checks | All |
| **Per-PR** | If the PR meaningfully shifts a curve, the PR description must list which curve and the expected delta. | PR author |

---

## 7. How this connects to mission, vision, and the problem

| Vision pillar (from [`vision.md`](./vision.md)) | The metric that proves it's working |
|---|---|
| Bite-size by default | Session length P50 in 6–12 min, sparks per session 4–7 |
| Personal, not generic | Memory-derived recommendation acceptance ≥ 45%, personalization-quality self-report ≥ 80% |
| Always current | Spark median age (time since author update) < 90 days; weekly community-authored Sparks compounding |
| Built for doing | Build Cards pasted per WAB ≥ 1 / week; verified Build Cards per profile ≥ 3 |
| Social by design | Magic-moment hit rate ≥ 30%, share-out rate ≥ 5% |
| The cognition layer is the moat | Cognition-on vs cognition-off W4 retention delta ≥ +20% |
| Open source is the multiplier | Live fork count compounding, cross-fork Spark adoption bidirectional |

| Problem statement (from [`problem.md`](./problem.md)) | The metric that proves we're closing the gap |
|---|---|
| AI moves faster than any course can | Spark median age < 90 days; community-authored share ≥ 50% by Sprint 3 |
| Time is the scarce resource | Time-to-first-wow < 5 min; session P50 < 12 min |
| Theory without doing rots | Build Cards pasted per WAB ≥ 1 / week |
| AI FOMO (chronic, low-grade fear) | NPS ≥ 50; first-week regret rate < 5%; "felt made for me" ≥ 80% |

If those columns light up green, the strategy is working. If any column drifts red while WAB is up, **WAB is lying to us** — investigate the root.

---

## See also

- [`manifesto.md`](./manifesto.md) — what we promise users; this doc is how we measure that we kept it.
- [`vision.md`](./vision.md) — the strategic North Star this document instruments.
- [`problem.md`](./problem.md) — the problem the metrics ladder back to.
- [`mvp.md`](./mvp.md) — what's shipped that the metrics actually measure today.
- [`roadmap.md`](./roadmap.md) — when each metric becomes meaningful (cognition / cohort / community / talent).
- [`competitors.md`](./competitors.md) — the ecosystem players these guardrails defend against.
- [`ux.md`](./ux.md) — the cognition-layer UX whose health metrics live in §3.6.

[← back to wiki TOC](./INDEX.md)
