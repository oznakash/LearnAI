# Forking the engine for a new domain

> _BuilderQuest is the engine. AI is the topic. Anyone can swap the topic._

If you're a Spanish teacher, a chess coach, a quantum-computing researcher, an SRE on-call lead, or a sales-enablement manager — the engine fits your domain. This is how to bend it.

---

## The 30-minute fork

```sh
# 1. Fork the repo on GitHub. Clone your fork.
git clone https://github.com/<you>/<your-fork>
cd <your-fork>

# 2. Re-brand. Open Admin Console → Config → Branding.
#    Change the app name, accent colors, mascot, tagline.
#    Or edit src/admin/defaults.ts directly to set the seed branding.

# 3. Replace the curriculum.
#    Option A: edit `app/src/content/topics/*.ts` directly.
#    Option B: write a JSON file with `Topic[]` and import it via
#              Admin Console → Content → Import.

# 4. Run it.
npm install
npm run dev
```

You now have your own gamified, micro-dosed, optionally-cognitive learning app.

## What you keep "for free"

- The 8 Spark formats (read / tip / pick / fill / match / scenario / build / boss).
- Onboarding wizard, recalibration, age bands, skill tiers.
- XP / focus / streak / badges / Guild Tiers (all admin-tunable).
- Sparkline / radar / ring / heatmap dashboards.
- Tasks tab, Memory layer, "Your Memory" view.
- Admin Console (7 tabs).
- Email lifecycle pipeline.
- Static-mirror deploy + Docker + Vercel/Netlify configs.
- Vitest test scaffolding.
- The cognition layer (your own mem0 instance — it's just a URL + bearer key).

## What you'll want to customize

| Layer | Where | What |
|---|---|---|
| Brand | Admin → Config → Branding | App name, accent + accent2, logo emoji, tagline. |
| Topics | `app/src/content/topics/*.ts` | Replace AI Foundations / LLMs / etc. with your domain. Keep the `Topic` shape. |
| Visuals | `app/src/visuals/Illustrations.tsx` | The 20 SVGs are AI-shaped (neural, embed, tokens, …). Swap for your domain (e.g. *piano*, *board*, *grammar*). |
| Mascot | `app/src/visuals/Mascot.tsx` | Synapse the robot is editable. |
| Sparks | Admin → Content + Prompt Studio | Generate fresh content with the Prompt Studio's long prompt; paste back. |
| Cognition | `docs/mem0.md` | Run your own mem0 instance per [`mem0.md`](./mem0.md). |

## What you should *not* change

- **The MIT license.** Keep it MIT in your fork, or BuilderQuest can't sync improvements with you.
- **The cognition contract** (`MemoryService` interface). Customize the impl, not the interface — otherwise you fall off our upstream.
- **The Spark types.** Add new types in a way that's backward-compatible (a new `type: "..."` variant), so seed-shape changes don't break the renderer.

## Recommended initial domains

| Domain | Why it fits | Suggested first 12 Constellations |
|---|---|---|
| **AI for kids** | Same engine, kid-tone shaping already exists | What is AI · Smart Helpers · Robots · Pictures from Words · Voice · Safety · Building · Famous AI · How AI learns · Asking AI Better · Funny mistakes · Build a chat app |
| **On-call / SRE** | Drilling failure modes is exactly the bite-size shape | Incident anatomy · Pages · Runbooks · Postmortems · SLOs · Cascading failures · DB outages · Network partitions · Capacity · Observability · Recovery · Tabletop |
| **Sales enablement** | Pitches, objections, plays — all bite-size | ICP · Discovery · Pain · Champions · Demo flow · Objections · Pricing · Negotiation · Closing · Renewals · Expansion · Forecasting |
| **Climate / nuclear / quantum** | Frontier domain that moves fast, audience hungry for distilled signal | (Domain-specific) |
| **Compliance / regulatory** | Updates frequently (EU AI Act, etc.) — same shape as AI news | Frameworks · Risk classes · Documentation · Audits · Incidents · Reporting · Cross-border · Sector-specific |
| **Languages, with a real cognition layer** | Duolingo doesn't do memory yet | (Per language) |

## Sharing your fork

1. **Add yourself to the fork registry** (when we publish one — Sprint 3). Until then, just open an issue on the upstream repo with your fork URL.
2. **Contribute back.** If you build a useful general capability (a new Spark type, a new chart, a new Admin tab), open a PR upstream. We'll credit you.
3. **Brand cleanly.** Keep "Powered by BuilderQuest" in your footer (it's not required, just appreciated). When we ship the fork registry, mutual links amplify both communities.

## A note on the cognition layer + privacy

Your mem0 instance is yours. We don't see your users' memories. Ever. The memories live in your Postgres. Your bearer key. Your domain.

That's a feature, not a limitation. **Your fork = your data sovereignty.**

---

## See also

- [`vision.md`](./vision.md) — the long-term value of the fork ecosystem.
- [`contributing.md`](./contributing.md) — pushing improvements back upstream.
- [`mem0.md`](./mem0.md) — running your own cognition layer.
- [`architecture.md`](./architecture.md) — what you're forking.
