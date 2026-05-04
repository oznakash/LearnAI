# Test personas — for FTUE (first-time user experience) testing

> Internal QA personas. NOT shown anywhere on the platform.
> Used by Claude Code agents (and humans) to dogfood the FTUE flow over and over.
> The personas are realistic enough to surface real UX issues, but the email
> addresses live on the hidden-account allowlist (see
> `app/src/lib/hidden-accounts.ts`) so they never appear on the public
> leaderboard, in profile SEO, or anywhere a real user could see them.

---

## Primary persona — Maya Chen

**Why she exists:** closest to our self-reported core ICP — a curious mid-career
PM who's heard about LLMs at work, has tried ChatGPT a few times, but doesn't
know how to get from "user of AI tools" to "shipper of AI features." She's the
person we are most likely to wow on day one — and the person most likely to
leave during onboarding if it feels like a textbook.

| Field | Value |
|---|---|
| Email (demo mode) | `learnai-qa+maya@gmail.com` |
| Display name | Maya Chen |
| Age | 32 (adult age band) |
| Self-reported skill | `explorer` (Hobby explorer — "Tried a few APIs") |
| Background | Product Manager at a B2B SaaS |
| Daily time | 10 min/day (Steady) |
| Goal | "Become an AI PM" |
| Top interests | AI Foundations, AI Product Management, LLMs & Cognition |
| Mental model entering app | "I want to sound less dumb in AI roadmap reviews and ship one real AI feature this quarter." |

**What success looks like for her on first session (the wow/aha bar):**
1. Within ~60 seconds of finishing onboarding she should feel "this knows me" —
   a Spark that lands in her exact gap is the minimum bar.
2. Within ~5 minutes she should have one tangible artefact she can use at
   work — a Build Card, a vocabulary win, or a sharp framing.
3. Should not have to read more than a paragraph of text before doing
   something interactive.

**Failure tells (look for these during testing):**
- Onboarding longer than ~90 seconds.
- The first Spark feels generic / not tied to her PM goal.
- Any "next step" that's a dead-end (locked level, empty state with no nudge,
  copy that says "coming soon").
- Confusing terminology without a definition (e.g. "Boss Cell", "Synapses",
  "Constellations") on the first encounter.
- A silent or non-responsive UI element (buttons that look clickable but do
  nothing).

---

## Secondary persona — Jordan (15, teen learner)

A backup persona for spot-checking the teen age band tuning. Used only when
explicitly testing the kid/teen surface.

| Field | Value |
|---|---|
| Email | `learnai-qa+jordan@gmail.com` |
| Age | 15 (teen) |
| Skill | `starter` |
| Daily time | 5 min |
| Goal | "Learn AI as a kid / curious learner" |
| Interests | AI Foundations, AI Builder |

---

## Operating rules

1. **Demo mode only.** They sign in via the "Skip OAuth setup (demo mode)"
   button on the SignIn screen. No real Google account, no password.
2. **Hidden from all public surfaces in the SPA.** Their emails are listed in
   `app/src/lib/hidden-accounts.ts`. Anywhere the SPA would show
   leaderboard ranks, public profile pages, or shareable usernames, these
   accounts are filtered out by `isHiddenAccount(email)` /
   `isHiddenHandle(handle)`. The owner can still see their own profile while
   signed in, so the FTUE flow is fully exercisable.
3. **Reset between runs.** A clean FTUE test starts from
   `localStorage.clear()` or by opening a private window. The state key is
   `builderquest:v1` — clearing that is sufficient.
4. **Never check real persona emails into public leaderboard fixtures.**
   If a snapshot test or seed needs a "demo player," generate a fresh
   throwaway address rather than reusing a QA persona.

## Adding a new test persona

1. Add their entry below the table here, describing the user truthfully —
   age, skill, why they exist.
2. Add their email to `HIDDEN_ACCOUNT_EMAILS` in
   `app/src/lib/hidden-accounts.ts`. The convention is
   `learnai-qa+<name>@gmail.com`.
3. Run the FTUE test. Record findings in a dated section at the bottom of
   this file — the *findings*, not the raw click trace.

---

## Future work

- **Per-environment hiding.** Today the allowlist is a hard-coded module
  constant on both sides. As the persona list grows we can move it
  behind an admin config flag so prod hides them and a dev fork can
  include them for end-to-end tests.

## Done — server-side mirror (2026-05-04)

The allowlist is now mirrored in
[`services/social-svc/src/hidden-accounts.ts`](../services/social-svc/src/hidden-accounts.ts)
and gates four entry points on the sidecar:

| Entry point | Behavior for a hidden persona |
|---|---|
| `GET /u/:handle` (SSR HTML) | Renders the not-found page, regardless of viewer auth. |
| `GET /sitemap.xml` | The persona's URL is omitted from the sitemap. |
| `GET /v1/social/profiles/:handle` | Cross-viewer requests get `404`; the owner still sees their own profile (so the FTUE owner-view works). |
| `GET /v1/social/boards/:scope` | Persona is dropped before any sort/limit work — never appears on global, topic, or following boards. |
| `GET /v1/social/stream` | Stream events authored by hidden personas are filtered out for every viewer. |

Sidecar tests (`services/social-svc/__tests__/hidden-accounts.test.ts`)
cross-check that both allowlists describe the same persona set so
adding a new persona to one side and forgetting the other fails CI
loudly.

---

## Findings log

### 2026-05-03 · Maya Chen, FTUE pass against pre-fix `main`

| # | Where | Finding | Severity | Action |
|---|---|---|---|---|
| 1 | Onboarding step 1 (Name) | Field pre-fills with the raw email handle, including `+` tags and `-` separators (`learnai-qa+maya`) | 🟠 P1 | **Shipped** — `deriveDefaultName` in `Onboarding.tsx` strips Gmail tags + picks the last alphabetic segment, falling back to empty when the candidate is a token like `qa`/`test` |
| 2 | Home + Play | A self-reported "explorer" was dropped on AI Foundations Level 1 Spark 1 ("AI is pattern, not magic") — below the level she said she was at | 🔴 P0 | **Shipped** — `inferredStartingLevel(profile)` + `isLevelUnlocked` floor; explorer now starts at L2 on a fresh topic, builder at L3, etc. Calibrated level still wins |
| 3 | Home "For you, today" | Goal "Become an AI PM" pointed her at AI Foundations because the matcher fell back to `interests[0]` and "AI PM" doesn't substring-match "AI Product Management" | 🟠 P1 | **Shipped** — `TOPIC_GOAL_ALIASES` map in `memory/insight.ts`; alias-hit prefers a topic that's already in the user's interests |
| 4 | Home top-bar pills | "🧠 5/5", "🔥 0", "Tier: Builder" all surface with no tooltip/legend on day zero | 🟡 P2 | Deferred — overlaps with `aha-and-network.md` slot 10 (speed/polish pass). Not urgent |
| 5 | Onboarding step 4 (Interests) | "Pick at least one **Constellation**" uses a domain word with no inline definition | 🟡 P2 | Deferred — copy task; bundle with the editorial pass (`aha-and-network.md` slot 3) |
| 6 | SignIn | Brand says "BuilderQuest" though the URL is `learnai-…` and the project identity is LearnAI | 🟡 P2 | Deferred — tracked separately under brand consistency; project intentionally keeps "BuilderQuest" as the in-app strings per `CLAUDE.md` |
| 7 | Pattern-match exercise | Multi-pair selection requires sequential clicks; rapid scripted batches drop intermediate state | 🟡 P2 | Not regressed in this PR — file-level fix would touch `components/Exercise.tsx` and is out of scope |

The first three rows are the FTUE-blocking issues for a fresh "explorer" user;
all three are shipped in this PR. Items 4–7 are tracked but deferred to keep
the change-set focused.
