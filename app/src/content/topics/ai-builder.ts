import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "ai-builder" as const;

export const aiBuilder: Topic = {
  id: T,
  name: "Being an AI Builder",
  emoji: "🛠️",
  tagline: "Mindset, workflow, and stack of a modern AI builder.",
  color: "#28e0b3",
  visual: "build",
  levels: [
    level(T, 1, "The builder mindset", "Ship small, learn fast.", 4, [
      spark("Tiny ships > big plans", {
        type: "microread",
        title: "Default to tiny",
        body: "AI moves so fast that 6-month roadmaps are fiction. Modern AI builders ship in 1–7 day loops: pick a tiny problem, build the crappiest version that works, get a real user to try it, learn, repeat. The compounding return on weekly ships beats any quarterly grand plan.",
        takeaway: "Weekly ships compound. Quarterly plans rot.",
        visual: "rocket",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Start every project with a Loom video of the experience you want, even before code. If you can't make the Loom, the idea isn't crisp enough.",
      }),
    ]),
    level(T, 2, "The modern stack", "Where to start.", 4, [
      spark("Default starter kit", {
        type: "microread",
        title: "Stack in one paragraph",
        body: "Frontend: Next.js or Vite. LLM: Anthropic Claude or OpenAI GPT. Vector DB: pgvector (Postgres) or Pinecone. Auth: Clerk or Supabase Auth. Hosting: Vercel/Render/Fly. Observability: Helicone or LangSmith. Eval: hand-rolled YAML + LLM-as-judge for now. This stack ships 80% of AI products today. Don't optimize before shipping.",
        takeaway: "Boring, well-documented defaults. Ship first.",
        visual: "stack",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "Best vector DB for small/medium AI apps starting out?",
        options: ["Build your own", "pgvector inside your existing Postgres", "Deploy Cassandra", "CSV file"],
        answer: 1,
        explain: "pgvector keeps your stack simple and gets you going in an hour.",
      }),
    ]),
    level(T, 3, "Working with Claude Code", "AI as your pair programmer.", 4, [
      spark("Pair, don't dictate", {
        type: "microread",
        title: "Treat the AI like a junior",
        body: "Claude Code (and similar agentic IDEs) work best when you brief like a colleague: 'we're trying to X, here's the constraint, here's a file to read first.' Vague prompts get vague code. Crisp prompts plus a few targeted reads beat any 'write me an app' prompt every time.",
        takeaway: "Brief like a senior. Verify like an editor.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "When Claude Code spirals, stop and `/clear`. Re-explain in 3 sentences. Faster than fighting through a confused context window.",
      }),
      spark("Build it", {
        type: "buildcard",
        title: "Build: a 1-screen toy",
        pitch: "Practice the brief-and-verify loop.",
        promptToCopy:
          "We're building a one-screen web app: paste in a long article, click button, get back a 3-bullet summary plus a single 'so what?' line. Use Vite + React + Tailwind. Use the Anthropic SDK with claude-sonnet-4-6. Show loading + error states.",
        successCriteria: "Working in 15 minutes. You learn pacing, not the code.",
      }),
    ]),
    level(T, 4, "From prototype to product", "What changes after 'it works'.", 4, [
      spark("The boring 80%", {
        type: "microread",
        title: "After it works, the real work begins",
        body: "Demo working = 20% done. The other 80%: auth, billing, error handling, retries, logging, evals, on-call, abuse prevention, billing-aware rate limits, model fallback, prompt versioning, user feedback collection. Most failed AI startups had a great demo and never did the boring 80%.",
        takeaway: "Demo = start line. Boring 80% = product.",
      }),
    ]),
    level(T, 5, "Cost engineering", "Three levers.", 4, [
      spark("Cheaper, smaller, cached", {
        type: "microread",
        title: "Cost levers that actually work",
        body: "Three real cost levers: (1) right-size — use a smaller model for easy steps, big model for hard ones (router pattern). (2) cache — Anthropic's prompt caching cuts costs ~90% on repeated system prompts. (3) batch — async batch APIs are 50% cheaper for non-realtime work. Apply all three before negotiating contracts.",
        takeaway: "Router + cache + batch ≈ 5x cost reduction.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Add prompt caching to long system prompts that don't change. One-line change in the SDK. Free 80–90% cost cut on those tokens.",
      }),
    ]),
    level(T, 6, "Working with non-determinism", "It will surprise you.", 4, [
      spark("Embrace variance", {
        type: "microread",
        title: "Test the distribution",
        body: "Same input, slightly different output every time. Stop trying to make it deterministic — design around variance instead. Your tests check distributional properties: 'output is valid JSON 99% of the time', 'always cites at least one source', 'never mentions X'. Specific examples become spot-checks; the eval set is the real assertion.",
        takeaway: "Test properties, not exact strings.",
      }),
    ]),
    level(T, 7, "Picking models", "Match model to job.", 4, [
      spark("Speed/quality/cost triangle", {
        type: "microread",
        title: "The three-way trade",
        body: "Fast and cheap: small models (Haiku 4.5, Gemini Flash, GPT-4.1 mini) for classification, extraction, simple chat. Balanced: Sonnet 4.6 for most product work. Heavy lifting: Opus 4.7 or reasoning models for hard analysis, code, multi-step plans. Build a router so each task lands on the right model — your single biggest quality+cost win.",
        takeaway: "One app, many models. Route by task.",
      }),
      spark("Pattern match", {
        type: "patternmatch",
        prompt: "Match each job to a tier",
        pairs: [
          { left: "Classify support email tone", right: "Small / fast" },
          { left: "Plan a 5-step refactor", right: "Reasoning / heavy" },
          { left: "Draft 3 marketing variants", right: "Mid-tier" },
          { left: "Extract phone numbers", right: "Small / fast" },
        ],
        explain: "Pay for what you actually need.",
      }),
    ]),
    level(T, 8, "Shipping in public", "Distribution as a builder skill.", 4, [
      spark("Build in the open", {
        type: "microread",
        title: "Distribution beats secrecy",
        body: "Most AI builders' secret weapon isn't a clever model — it's a public build journal. Ship a feature, post a 30-sec video, get 50 reactions, get 5 testers, iterate. Repeat 30 times and you have a niche audience. Stay quiet until 'it's ready' and you'll launch to crickets.",
        takeaway: "Tiny ships, public videos, real testers, every week.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Record a 30-second Loom for every shipped feature. Auto-post to one channel (X, LinkedIn, Discord). The bar for 'ship' becomes one video, not a launch.",
      }),
    ]),
    level(T, 9, "AI builder antipatterns", "What sinks projects.", 4, [
      spark("Six killers", {
        type: "microread",
        title: "Common ways to die",
        body: "(1) Over-architecting before product-market fit. (2) Assuming bigger model fixes a data problem. (3) Skipping evals because 'it works'. (4) Free unlimited AI usage. (5) Hiding the AI in UX so users don't trust it. (6) Building in stealth for 6 months. Each one alone is survivable. Two together is fatal.",
        takeaway: "Watch for these. They kill more startups than competition.",
      }),
    ]),
    level(T, 10, "Boss: builder check", "Are you ready?", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: AI Builder",
        questions: [
          {
            type: "quickpick",
            prompt: "Best first move when starting a new AI feature?",
            options: ["Pick the model first", "Write 30-sec demo script + 10 eval cases", "Set up monitoring", "Hire infra engineer"],
            answer: 1,
            explain: "Demo + evals = clarity on what you're shipping.",
          },
          {
            type: "quickpick",
            prompt: "Same prompt gives slightly different outputs each call. Best response?",
            options: ["Block ship", "Set temperature 0 always", "Test distributional properties via evals", "Switch model"],
            answer: 2,
            explain: "Embrace variance, test properties.",
          },
          {
            type: "quickpick",
            prompt: "You ship weekly. What changes after 8 weeks?",
            options: ["Nothing", "Compound learning + small audience + sharper instincts", "You burn out automatically", "Funding"],
            answer: 1,
            explain: "Velocity compounds. That's the whole point.",
          },
        ],
      }),
    ]),
  ],
};
