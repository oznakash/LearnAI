# Contributing

> _LearnAI is built for the community of builders, by the community of builders. Pull requests over arguments, every time._

## How to contribute, in five flavors

| Flavor | What it looks like | How |
|---|---|---|
| 🐛 **Bug fix** | Something is wrong, you fix it | Open a PR. Include a test that fails before your fix and passes after. |
| 📚 **A new Spark** | Add or improve a single micro-lesson | Edit a topic file in `app/src/content/topics/*.ts`. Or use the **Admin → Prompt Studio** + **Content** tabs and export the JSON. |
| 🛠️ **A new Build Card** | Add a pasteable Claude Code prompt that produces a real artifact | Same as a Spark, type `buildcard`. Test it end-to-end yourself first. |
| 🌐 **A new Topic** | A whole new topic (10 levels) | Big PR. Discuss in an issue first. |
| 🧠 **Engine work** | Game logic, cognition layer, admin, deploy, docs | Standard PR. Tests required for game logic; docs required for new admin features. |

## Quick start

```sh
git clone https://github.com/oznakash/learnai
cd learnai
npm install      # delegates to ./app
npm run dev      # local dev at http://localhost:5173
npm test         # vitest (90 tests today)
```

## House rules

1. **Tests over arguments.** If a behavior is worth describing in a PR, it's worth a test.
2. **Type strictly.** TypeScript strict mode. No `any` unless a comment explains why.
3. **Small PRs over big ones.** A 50-line PR merges in hours; a 5,000-line PR merges in weeks.
4. **No emojis in code or commits.** They go in the UI and Spark titles where they earn their place.
5. **Update docs in the same PR** that adds/changes a feature. `mvp.md`'s "Shipped" list is the source of truth.
6. **Don't break the static-mirror deploy.** The committed `/dist/` must be fresh after every PR — the GitHub Action handles this; just don't disable it.

## Authoring a Spark

A Spark is one of these shapes:

```ts
{ type: "microread", title, body, takeaway, visual? }
{ type: "tip", title, body, bonusXP?, visual? }
{ type: "quickpick", prompt, options, answer, explain }
{ type: "fillstack", prompt, options, answer, explain }
{ type: "scenario", setup, prompt, options, answer, explain }
{ type: "patternmatch", prompt, pairs[], explain }
{ type: "buildcard", title, pitch, promptToCopy, successCriteria }
{ type: "boss", title, questions: QuickPick[] }
```

Voice rules (also enforced by `docs/mem0.md` for AI generation):

- Plain English. Smart-friend tone. No academic.
- Concrete examples. Real model/tool names where the level supports it.
- Lower levels: simpler analogies. Higher levels: tradeoffs + named systems.
- 60–120 words for MicroReads. 30–60 for Tips. 1–2 sentences for explainers.
- Build Cards must produce a *runnable* artifact in 5–15 minutes — test it yourself first.

A great Spark passes this check: *"if I read this in 60 seconds at a busy moment, do I walk away with a sharper mental model than I had a minute ago?"*

## Reviewing PRs

Reviewers look for:

- **Does it ship a wow?** A great new Spark gets merged faster than a clever refactor.
- **Does it earn its size?** A 200-line refactor without a clear "before/after retention or correctness" answer is no.
- **Does it move docs?** If the PR changes user-visible behavior, the corresponding doc(s) must move too.
- **Does it preserve the vision?** Read [`vision.md`](./vision.md) and [`pitch-deck.md`](./pitch-deck.md) — if the PR drifts from those, push back.

## Code of conduct

The short version: **assume good faith, write the PR you'd want to receive, ship the spark you'd want to read.**

The long version: be the kind of contributor who makes other people want to contribute too. Disagreement is fine; condescension is not. Quality bars are mandatory; gatekeeping is not.

## Recognition

- Every Spark you author is credited to you (handle on the Spark, public profile shipping in Sprint 2).
- Top contributors get a perma-badge.
- Once Talent Match ships, your contribution count + the Sparks you authored become a search axis recruiters use.

You write the curriculum. Your name goes on it. Permanently.

## License

MIT. Same for forks (see [`fork-recipe.md`](./fork-recipe.md)). Contributions are licensed identically.

---

## See also

- [`fork-recipe.md`](./fork-recipe.md) — how to fork the engine for a different domain.
- [`vision.md`](./vision.md) — what you're contributing toward.
- [`mvp.md`](./mvp.md) — what already exists; don't duplicate.
- [`technical.md`](./technical.md) — the engineer-level architecture you'll touch.
