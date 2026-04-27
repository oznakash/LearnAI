import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "frontier-companies" as const;

export const frontierCompanies: Topic = {
  id: T,
  name: "AI Frontier Companies",
  emoji: "🚀",
  tagline: "Who's building the future and how — Anthropic, OpenAI, Google, more.",
  color: "#7c5cff",
  visual: "rocket",
  levels: [
    level(T, 1, "The AI lab landscape", "The big six.", 4, [
      spark("Who builds the brains", {
        type: "microread",
        title: "Major labs at a glance",
        body: "Anthropic (Claude, safety-first), OpenAI (GPT, ChatGPT scale), Google DeepMind (Gemini, research depth), Meta AI (Llama open weights), xAI (Grok, fast), Mistral (open + premium). Each has a distinct philosophy: research-led vs scale-led, closed vs open, safety-first vs capability-first. Smart builders match labs to their values + use cases.",
        takeaway: "Six labs, six philosophies. Pick by fit, not hype.",
        visual: "rocket",
      }),
    ]),
    level(T, 2, "Anthropic in depth", "Mission, models, products.", 4, [
      spark("Anthropic 101", {
        type: "microread",
        title: "Why Anthropic exists",
        body: "Anthropic was founded in 2021 by ex-OpenAI researchers focused on AI safety. Mission: build reliable, interpretable, steerable AI. Models: Claude family (Haiku/Sonnet/Opus, latest 4.x). Products: Claude.ai, API, Claude Code. Distinctive: Constitutional AI, deep red-teaming, transparent model cards. Loved by enterprises for safety posture + clear policies.",
        takeaway: "Safety-first frontier lab. Strong with regulated buyers.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "When pitching to enterprise, lead with safety: model cards, no-train-on-customer-data clause, audit logs. Anthropic + Claude is a great anchor for that conversation.",
      }),
    ]),
    level(T, 3, "OpenAI playbook", "Distribution + API breadth.", 4, [
      spark("OpenAI strategy", {
        type: "microread",
        title: "Scale, distribution, breadth",
        body: "OpenAI ships GPT-class models, ChatGPT (huge consumer reach), Whisper (audio), DALL-E (image), Sora (video), agents, structured outputs, batch APIs. Strategy: be the broadest API surface, with biggest ecosystem. Builder takeaway: easy to start, hard to leave (lock-in via fine-tunes + APIs).",
        takeaway: "Broadest surface. Plan for lock-in if you go deep.",
      }),
    ]),
    level(T, 4, "Google DeepMind", "Research depth + integration.", 4, [
      spark("DeepMind edge", {
        type: "microread",
        title: "Research-meets-scale",
        body: "Google DeepMind merged Brain + DeepMind in 2023. Strengths: deep research (AlphaFold, Gemini), giant infrastructure (TPUs), integration into Workspace + Android + Search. Models: Gemini family, including thinking variants and Nano (on-device). Builder note: best multimodal + tightest integration with Google Cloud + Workspace.",
        takeaway: "Research depth + ecosystem reach. Pick if you live in Google land.",
      }),
    ]),
    level(T, 5, "Meta + open weights", "Llama and beyond.", 4, [
      spark("Meta's open bet", {
        type: "microread",
        title: "Why Meta gives weights away",
        body: "Meta open-sources frontier-class weights (Llama series). Strategic logic: drive ecosystem standards, hire from the field that uses your tools, undermine closed-API moats. Effect: thousands of fine-tunes, research acceleration, enterprise on-prem options. The open ecosystem is now serious infrastructure.",
        takeaway: "Open weights = real production option, especially regulated.",
      }),
    ]),
    level(T, 6, "xAI, Mistral, Cohere, Inflection", "The serious challengers.", 4, [
      spark("Mid-tier matters", {
        type: "microread",
        title: "Beyond the big three",
        body: "xAI (Grok, fast iteration), Mistral (Euro-based, mix of open + premium), Cohere (enterprise/RAG focus), Inflection (consumer voice). They occupy niches: speed, region, vertical, modality. Smart builders watch them — sometimes you find a better cost/perf fit than the giants.",
        takeaway: "Don't ignore mid-tier. Niches sometimes win on price/perf.",
      }),
    ]),
    level(T, 7, "AI-native frontier startups", "The picks-and-shovels & apps.", 4, [
      spark("Two clusters", {
        type: "microread",
        title: "Infra + apps",
        body: "Frontier AI startups split into infra (Modal, Replicate, Together, Fireworks, Pinecone, Weaviate, Helicone) and apps (Cursor, Perplexity, Harvey, Glean, Decagon). Infra companies battle on latency + price + DX. App companies battle on retention + workflow lock-in. Both have minted unicorns rapidly.",
        takeaway: "Infra battles on DX. Apps battle on workflow lock-in.",
      }),
    ]),
    level(T, 8, "How to read a model release", "Spec, eval, vibe.", 4, [
      spark("Model release decoder", {
        type: "microread",
        title: "How to read launches",
        body: "When a lab ships a new model, read in this order: (1) capability table — what's actually new. (2) eval scores — but only on benchmarks you trust. (3) pricing — token cost, context size. (4) latency — TPS for streaming. (5) vibes — community demos. Skip the hype thread; it lies. Always test on YOUR eval set before switching production.",
        takeaway: "Capabilities → evals → price → vibes. Never just vibes.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Keep a 30-case 'house eval' you run on every new model release. You'll know in 20 min whether it's actually better for YOUR use case.",
      }),
    ]),
    level(T, 9, "Talent + research signals", "Who to follow.", 4, [
      spark("Watch the diaspora", {
        type: "microread",
        title: "People are the signal",
        body: "Lab quality follows people. When senior researchers move (e.g. Anthropic founders left OpenAI, then later moves), expect ripples. Watch ICML/NeurIPS papers, lab blog posts, key Twitter accounts (Karpathy, Demis, Dario, Sam). Also watch arxiv-sanity for papers cited by frontier labs.",
        takeaway: "Follow people, not hype. Diasporas predict shifts.",
      }),
    ]),
    level(T, 10, "Boss: frontier check", "Final gate.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: Frontier Companies",
        questions: [
          {
            type: "quickpick",
            prompt: "Best lab fit for a privacy-strict enterprise feature?",
            options: ["Closed API with no audit", "Anthropic or open-weights on-prem", "Whatever's cheapest", "GPT free tier"],
            answer: 1,
            explain: "Safety + on-prem options matter most.",
          },
          {
            type: "quickpick",
            prompt: "Quickest signal to know if a new model fits your product?",
            options: ["Twitter hype", "Run your 30-case house eval", "Press release", "Benchmarks alone"],
            answer: 1,
            explain: "Your evals > anyone else's.",
          },
          {
            type: "quickpick",
            prompt: "Why follow open-weights labs even if you don't ship them?",
            options: ["Boredom", "They drive prices + research that affect closed labs too", "Cool merch", "Easier APIs"],
            answer: 1,
            explain: "Open ecosystem reshapes the whole market.",
          },
        ],
      }),
    ]),
  ],
};
