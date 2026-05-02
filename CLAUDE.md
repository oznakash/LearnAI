# CLAUDE.md — operator manual for AI agents on this repo

> _If you're a Claude Code agent (or any AI agent) working in this repository, read this first.
> Humans are also welcome — it's the same manual._

---

## Project at a glance

**LearnAI** is the AI-native learning network for builders, creators, and curious people. A static React SPA in front, an opt-in self-hosted **mem0** cognition layer behind, and 12 community-curated AI Constellations as the seed curriculum. The in-app, gamified experience is named **BuilderQuest** — that name lives on inside the app shell (mascot, copy, brand strings) but the project, network, and public identity is **LearnAI**.

- **Live:** `https://learnai-b94d78.cloud-claude.com`
- **Source:** [`oznakash/learnai`](https://github.com/oznakash/learnai)
- **Mission, end-game, vision:** [`docs/vision.md`](./docs/vision.md)
- **Today's MVP:** [`docs/mvp.md`](./docs/mvp.md)
- **Architecture:** [`docs/architecture.md`](./docs/architecture.md)
- **Metrics & KPIs (North Star + guardrails):** [`docs/metrics.md`](./docs/metrics.md)
- **Wiki TOC:** [`docs/INDEX.md`](./docs/INDEX.md)
- **Content-experience plan (active):** [`docs/content-experience-plan.md`](./docs/content-experience-plan.md). Three workstreams: session sequencer + visual-box redesign · `PodcastNugget` Spark variant + admin feature flag · 👍/👎 with permanent skip on 👎.
- **External content seam — Lenny's Podcast archive:** [`docs/lenny-archive.md`](./docs/lenny-archive.md). The transcripts themselves live **outside** this repo at `/Users/oznakash/Downloads/Lenny's Podcast Transcripts Archive [public]` (319 files, ~27 MB). That folder is read-only reference material, **not** committed to git. Use the doc above as the staging surface for any `PodcastNugget` Spark before it ships into `app/src/content/topics/*.ts`.

## What you're allowed to change

- Anything under `app/src/`. Tests live in `app/src/__tests__/`.
- Anything under `docs/`.
- Anything under `scripts/`.
- The root `package.json`, `Dockerfile`, `nginx.conf`, `fly.toml`, `vercel.json`, `netlify.toml`, `static.json`, `docker-compose.mem0.yml`, `.env.example`, `.gitignore`.

## What you should be cautious about

- **`/dist/`** — auto-rebuilt + auto-committed by GitHub Actions on every push to `main`. Don't hand-edit. Run `npm run build` and let CI commit the diff.
- **`app/src/types.ts`** — schema changes ripple through the cognition layer + content seeds + admin overrides. Bump tests for any change.
- **`app/src/content/topics/*.ts`** — seed curriculum. Edits land in production. Be sure.
- **`app/src/admin/types.ts` / `defaults.ts` / `store.ts`** — admin config schema. The loader merges old saved configs forward; don't break that.

## What you must not do

- **Do not commit secrets.** `.env` is git-ignored. Use `.env.example` as the source of truth for what *should* be in `.env`.
- **Do not bypass `git` hooks** (`--no-verify`, `--no-gpg-sign`) unless explicitly told.
- **Do not push to `main` directly.** Always go through a PR + merge (the GitHub MCP tools default to this).
- **Do not target other repositories.** This repo's GitHub MCP scope is `oznakash/learnai` only. Do not attempt to write to `oznakash/mem0` or anywhere else.
- **Do not skip tests** when adding game logic, cognition wiring, or anything in `app/src/store/` or `app/src/memory/`.

## The build/test loop

```sh
npm install     # workspace install (delegates to ./app)
npm test        # vitest — SPA, must be all green (currently 560 / 560). Run `cd services/social-svc && npm test` for the sidecar suite (114 / 114).
npm run build   # tsc + vite build → ./dist
npm run dev     # local dev server (http://localhost:5173)
```

Both `npm test` and `npm run build` must be green before any PR. CI will rebuild `/dist/` for you on merge to `main`.

## Where features live

| Capability | Path |
|---|---|
| Routing shell | `app/src/App.tsx` |
| Player state container | `app/src/store/PlayerContext.tsx` |
| Game logic (XP / focus / streak) | `app/src/store/game.ts` |
| Badges | `app/src/store/badges.ts` |
| Cognition layer | `app/src/memory/{types,offline,mem0,index,MemoryContext}.ts(x)` |
| Admin store + tabs | `app/src/admin/*` |
| Seed curriculum | `app/src/content/topics/*.ts` |
| Generation prompt (single source of truth) | `app/src/content/prompt.ts` |
| Player views (Home, Topic, Play, Tasks, Dashboard, Settings, Leaderboard, Calibration, Memory) | `app/src/views/*.tsx` |
| Reusable visuals | `app/src/visuals/{Mascot,Illustrations,Charts,Confetti}.tsx` |
| Sign-in | `app/src/auth/google.ts` |
| Tests | `app/src/__tests__/*.test.ts(x)` |

## When you change behavior, update docs

If your PR changes user-visible behavior, update **at least one** of:

- `docs/mvp.md` — bump "Shipped" / "Not yet shipped" lists.
- `docs/ux.md` — if the cognition-layer UX changes.
- `docs/technical.md` — if a service contract or wiring changes.
- `docs/architecture.md` — if a box on the diagram changes.
- `docs/roadmap.md` — if a sprint item moves status.
- `docs/design-language.md` — if a colour, shadow, primitive, motion, or third-party-widget pattern changes.
- `docs/metrics.md` — if the change is expected to move a North Star, supporting KPI, or guardrail. PR description should list which curve and the expected delta.

If you add a Spark or a Constellation, you don't need a doc change — the seed file is the doc.

## Default tone for content (Sparks, docs, UI strings)

- Plain English, smart-friend tone.
- Concrete > abstract. Example > definition.
- Short > long. *60 words is a luxury.*
- Use real model names / tools where the level supports it (Claude, GPT, Gemini, Llama, pgvector, Cursor, Claude Code, etc.).
- No academic register. No emojis in code or commits. Emojis are fine in UI strings and Spark titles where they earn their place.

## Default visual language

The visual contract lives in [`docs/design-language.md`](./docs/design-language.md). Read it before adding a colour, a shadow, a new component primitive, a new motion, or hosting a third-party UI widget. Concrete rules to keep top of mind:

- Use the existing primitives (`.card`, `.btn-primary`, `.btn-ghost`, `.input`, `.label`, `.h1`, `.h2`, `.muted`, `.progress`, `.chip`, `.pill`, `.node`, `.dot`) instead of re-rolling Tailwind chains. If the same chain shows up more than twice, promote it to a primitive in `app/src/index.css` and document it in `design-language.md`.
- Hierarchy on dark surfaces is `text-white` plus an opacity ladder (`/70`, `/60`, `/50`, `/40`). Don't introduce a separate gray scale.
- Border radius scale is `rounded-xl` (controls) and `rounded-2xl` (containers). Shadow vocabulary is `shadow-card` and `shadow-glow`. Don't add to either set without a reason.
- For third-party widgets that ship their own theme (Google Identity, Stripe, etc.), prefer the "invisible overlay + our own button" pattern from `app/src/views/SignIn.tsx` over re-skinning the vendor element.
- Update `design-language.md` in the same PR that ships any surface-level change. Tokens in `tailwind.config.js` and primitives in `index.css` are the runtime; the doc is the contract.

## Common tasks recipe

### Add a new Spark

1. Pick the Constellation file in `app/src/content/topics/`.
2. Use one of the eight Spark variants (see `app/src/types.ts`).
3. Add it to the relevant level's `sparks` array.
4. Run `npm test` (the content-shape tests will catch malformed sparks).
5. PR.

### Add a new Constellation

1. Open an issue first to discuss the topic + its 10-level outline.
2. Add `app/src/content/topics/<id>.ts` following the existing shape.
3. Add the topic to the `TopicId` union in `app/src/types.ts` and to the imports/list in `app/src/content/index.ts`.
4. Update `docs/mvp.md` "Shipped" list (count of Constellations / Sparks).
5. PR.

### Touch the cognition layer

1. Edits to the contract → `app/src/memory/types.ts`. Update both `OfflineMemoryService` and `Mem0MemoryService` and the `withMemoryGuard` test set.
2. New event hook (write a memory on event X) → add the call inside the relevant view (Onboarding / Play / Calibration), wrapped in `void remember(...)` so it stays fire-and-forget.
3. Run `npm test`. The 19 memory-layer tests in `__tests__/memory.test.ts` and `__tests__/memory-flag.test.ts` are sensitive to contract changes.

### Touch the admin

1. Add a new field to `AdminConfig` → bump the loader merge in `app/src/admin/store.ts` so old saved configs forward-compat.
2. Add UI to the right tab. New tabs go through `AdminConsole.tsx` registration.
3. If runtime code needs the new field, add a getter in `app/src/admin/runtime.ts`.

### Deploy mem0

```sh
OPENAI_API_KEY=sk-... npm run deploy:mem0
npm run smoke:memory -- https://builderquest-mem0.fly.dev <bearerKey>
```

The script is idempotent. Re-runnable. See [`docs/mem0.md`](./docs/mem0.md) for the full play-by-play.

## Commit message style

```
<short imperative subject in present tense>

<body — what + why, not how>

<optional bullets if multiple non-trivial things>

<co-authorship trailer if applicable>
```

Example:

> *Add Boss Cell pass-rate badge*
>
> *Earned at 5 Boss Cells passed across any topic. Hooked into evaluateBadges and surfaces a confetti burst + memory write of category "history".*

Don't write release-note prose in commits. Save that for PR descriptions.

## PR description style

- **What** — 1–3 lines.
- **Why** — 1–3 lines.
- **How** — concise table or bullets if it's structural.
- **Verified** — what you ran (`npm test`, `npm run build`, manual UX, smoke test).
- **Test plan** — what a reviewer can verify.

When you open a PR, you'll get a webhook subscription to that PR's activity. Read CI failures + review comments and either fix or ask. Don't merge over an unresolved review.

## Standing autonomous-delivery directive

For this project, the user has authorized full autonomous delivery:

> *"Don't ask permissions. Plan ahead, write the code, write/update the tests, write/update the docs (README, design-language, planning docs), build, test, and merge to production. Make it easy, fast, and make sense; be opinionated and verify you're doing the right thing by planning ahead."*

Concretely on every task:

1. **Plan first.** Map out what you'll change, in which files, and what tests + docs need to follow. If the plan is non-trivial, jot it as a TodoWrite list so the user can see your shape of mind.
2. **Be opinionated.** Pick one path and commit. Two-roads-diverge is the enemy of velocity. If you land on the wrong path, the PR + revert is cheap.
3. **Always update docs in the same PR.** Surface change → `docs/design-language.md`. Architecture change → `docs/architecture.md` and/or `docs/server-auth-plan.md`. Roadmap move → `docs/roadmap.md`. README badges or "Try it" copy if user-visible. CLAUDE.md if it's a workflow rule future you should inherit.
4. **Always test before merging.** `npm test --prefix app` and `npm run build --prefix app` must both be green. Add a regression test for any user-reported bug — that's the single best forcing function against re-regressing.
5. **Squash-merge yourself** once CI is green and there are no unresolved review threads.
6. **Use the Cloud-Claude MCP for the deploy side of the loop.** When something needs platform-side action — set an env var, mount a volume, read container logs, force a redeploy, attach a domain, roll back — call the MCP tool directly instead of asking the operator to click in the dashboard or paste terminal output. The full playbook + safety rules + audit recipe are in [`docs/cloud-claude-mcp.md`](./docs/cloud-claude-mcp.md). Read it once. The fast path on any infra question is `describe_project(projectId)` followed by `get_logs` for the resource that's misbehaving.

The standing scope is `oznakash/learnai` and `oznakash/mem0`. Do not write to other repos.

## When to push back

- A request that breaks the **vision** in [`docs/vision.md`](./docs/vision.md). Quote the relevant pillar back at the user; offer a different shape.
- A request to lock content behind an LLM, gate the engine, or remove open-source. **No.**
- A request that adds a backend dependency at the SPA tier (the SPA must keep working without one).
- A request that moves us toward time-on-app over shipping rate / retention / wow-per-minute.

## Honesty about your boundaries

You don't have credentials for:

- Other repositories (your GitHub MCP scope is `oznakash/learnai` and `oznakash/mem0` only).
- Cloud DNS / TLS / billing flows that aren't surfaced through the Cloud-Claude MCP (e.g. registrar-side DNS edits — the platform handles verification + TLS once the record is in place, but the registrar update is operator-side).
- Anything outside Cloud-Claude (Fly.io, AWS, Vercel, etc. for this project's deploys are not in scope).

What you **do** have when the Cloud-Claude MCP is loaded: full read + mutate access to projects / resources / env vars / volumes / domains / deploys. See [`docs/cloud-claude-mcp.md`](./docs/cloud-claude-mcp.md). Don't pretend the limit is wider than it is — but don't be falsely humble about what you can introspect either.

---

## See also

- [`README.md`](./README.md) — public-facing overview.
- [`docs/INDEX.md`](./docs/INDEX.md) — full wiki TOC.
- [`docs/vision.md`](./docs/vision.md) — what you're aligning to.
- [`docs/contributing.md`](./docs/contributing.md) — public contribution guide.
