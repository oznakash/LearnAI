// Public-safe topic snippets used by the SSR `/u/:handle` page.
//
// These are the keyword-rich, short-form summaries that show up inside
// `<details>` collapsibles on the public profile page. Two roles:
//   1. SEO content density — every profile renders the topics that
//      player has Signals on, so each page has unique-ish keyword
//      content for Google / GPTBot / ClaudeBot to index.
//   2. "Sample of what they're learning" — non-personalized, but a
//      visitor can read the topic premise without bouncing to another
//      page. The collapsibles default closed so the layout stays tight.
//
// Source of truth for the canonical topic name + emoji + tagline lives
// in `app/src/content/topics/*.ts`. We duplicate a tight subset here
// (id → name / emoji / tagline / 2 sample-spark intros) because the
// social-svc TS build can't reach across the repo into the SPA's
// content modules. When we add more topics or reword taglines, this
// file needs the matching update — the test file pins the id set
// against the SPA's `TopicId` union.

export interface TopicSnippet {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  /** 1-2 sentence "what you'll learn" hook for the topic-card body. */
  intro: string;
  /** 2-3 sample spark titles + 1-line teasers, indexable inside <details>. */
  sampleSparks: { title: string; teaser: string }[];
}

export const TOPIC_SNIPPETS: Record<string, TopicSnippet> = {
  "ai-foundations": {
    id: "ai-foundations",
    name: "AI Foundations",
    emoji: "🧠",
    tagline: "What AI is, how it learns, and why it works (or doesn't).",
    intro:
      "The first principles of modern AI: what neural nets actually do, why scaling laws matter, and how today's models went from autocomplete to apparent reasoning. No math required.",
    sampleSparks: [
      {
        title: "AI is pattern, not magic",
        teaser:
          "Modern AI is statistical pattern-matching at scale, not symbolic reasoning. Once you see that, half the hype evaporates and the real capabilities sharpen.",
      },
      {
        title: "Why scaling worked",
        teaser:
          "Bigger models + more data + more compute kept producing better results long after most researchers thought it would plateau. That bet built today's frontier.",
      },
    ],
  },
  "ai-builder": {
    id: "ai-builder",
    name: "Being an AI Builder",
    emoji: "🛠️",
    tagline: "Mindset, workflow, and stack of a modern AI builder.",
    intro:
      "How modern AI builders work: ship in 1-7 day loops, default to tiny prototypes, use Loom before code, and treat the AI itself as a teammate. The job isn't writing code — it's choosing the right problem to solve in public.",
    sampleSparks: [
      {
        title: "Tiny ships > big plans",
        teaser:
          "AI moves so fast that 6-month roadmaps are fiction. Weekly ships compound; quarterly plans rot.",
      },
      {
        title: "Loom-before-code",
        teaser:
          "Start every project with a Loom video of the experience you want. If you can't make the Loom, the idea isn't crisp enough.",
      },
    ],
  },
  "ai-pm": {
    id: "ai-pm",
    name: "AI Product Management",
    emoji: "🎯",
    tagline: "Ship AI features users actually use and trust.",
    intro:
      "AI product management is the discipline of shipping non-deterministic features without losing user trust. Eval-driven roadmaps, prompt-as-spec, hallucination guardrails, and how to size an AI bet you can actually pay for.",
    sampleSparks: [
      {
        title: "Evals are your roadmap",
        teaser:
          "If you can't measure 'is this answer good?', you can't ship it. Build the eval before the feature.",
      },
      {
        title: "Trust budget",
        teaser:
          "Every wrong answer spends a unit of user trust. Decide how much you're willing to spend before you launch.",
      },
    ],
  },
  "ai-devtools": {
    id: "ai-devtools",
    name: "AI Dev Tools",
    emoji: "⚙️",
    tagline: "Claude Code, Cursor, Copilot, agentic IDEs.",
    intro:
      "The 2025 dev-tool stack — agentic IDEs (Cursor, Claude Code, Windsurf), CLI agents, codegen workflows, and the new economics of letting an AI write 80% of your code while you steer.",
    sampleSparks: [
      {
        title: "Agentic vs. autocomplete",
        teaser:
          "Autocomplete fills in the next token. Agentic tools take a goal, plan, run shells, edit files, and report back. Different tool, different mindset.",
      },
      {
        title: "Steering, not typing",
        teaser:
          "The skill that scales is being a great director — clear specs, fast feedback, decisive corrections. Typing speed is no longer a moat.",
      },
    ],
  },
  "llms-cognition": {
    id: "llms-cognition",
    name: "LLMs & Cognition",
    emoji: "🤖",
    tagline: "Inside the language brain: prompting, attention, reasoning.",
    intro:
      "How LLMs actually 'think' under the hood: attention, context windows, in-context learning, chain-of-thought, and why the same model can ace a logic puzzle one minute and trip on a children's riddle the next.",
    sampleSparks: [
      {
        title: "Attention is all you need (still)",
        teaser:
          "The 2017 'Attention Is All You Need' paper is the single most important architecture in modern AI. Still is.",
      },
      {
        title: "Context = working memory",
        teaser:
          "An LLM's context window is its working memory. Everything outside it might as well not exist.",
      },
    ],
  },
  "memory-safety": {
    id: "memory-safety",
    name: "Memory & Safety",
    emoji: "🧬",
    tagline: "RAG, memory layers, alignment, and safe-by-design AI.",
    intro:
      "How AI systems remember (RAG, vector DBs, dedicated memory layers like mem0) and how we keep them safe (alignment, red-teaming, eval harnesses, refusal training). The boring infra that makes the magic trustworthy.",
    sampleSparks: [
      {
        title: "RAG in one breath",
        teaser:
          "Retrieve. Augment. Generate. Pull the relevant docs first, stuff them into the prompt, then let the model write. That's the whole pattern.",
      },
      {
        title: "Alignment is a UX problem",
        teaser:
          "Most 'alignment' work in production is just hard UX: writing better refusals, surfacing uncertainty, designing escape hatches.",
      },
    ],
  },
  "ai-news": {
    id: "ai-news",
    name: "AI News & Pulse",
    emoji: "📰",
    tagline: "How to read the firehose without drowning.",
    intro:
      "Curated heuristics for surviving the AI news cycle: which sources to trust, which to skim, which to mute. Plus how to spot the difference between a real frontier release and a benchmark stunt.",
    sampleSparks: [
      {
        title: "Five sources, no more",
        teaser:
          "Pick five trusted sources and read them deeply. Mute the rest. The signal-to-noise on AI Twitter is below 5%.",
      },
      {
        title: "Benchmarks vs. vibes",
        teaser:
          "A model winning a benchmark doesn't mean it feels good to use. Always go play with it before forming an opinion.",
      },
    ],
  },
  "ai-trends": {
    id: "ai-trends",
    name: "AI Trends",
    emoji: "📈",
    tagline: "Where the field is moving — and why it matters to builders.",
    intro:
      "The directional bets that matter: agents, multimodality, on-device, smaller-but-smarter models, and the new economics of inference. What to build for, what to skip, what to watch.",
    sampleSparks: [
      {
        title: "Inference is the new compute",
        teaser:
          "Training got the headlines from 2018-2023. Inference is the cost center now, and the bottleneck for any product at scale.",
      },
      {
        title: "Smaller is the new bigger",
        teaser:
          "The frontier still scales, but the most useful product wins are coming from small fast models tuned for one job.",
      },
    ],
  },
  cloud: {
    id: "cloud",
    name: "Cloud Computing",
    emoji: "☁️",
    tagline: "Where AI runs: compute, storage, networks, GPUs.",
    intro:
      "The cloud layer that AI actually depends on: GPU economics, inference vs. training infra, data egress costs, and the hyperscaler vs. neocloud (CoreWeave, Lambda, Crusoe) trade-offs.",
    sampleSparks: [
      {
        title: "GPU economics for builders",
        teaser:
          "An H100 costs ~$2-4/hr on demand. A small product can burn that in a day. Know your unit economics before you scale.",
      },
      {
        title: "Egress is the moat",
        teaser:
          "Hyperscalers don't make money on storage. They make it on egress. That's the lock-in to be aware of.",
      },
    ],
  },
  cybersecurity: {
    id: "cybersecurity",
    name: "Cybersecurity for AI",
    emoji: "🛡️",
    tagline: "Threats, defenses, and AI-specific attack surfaces.",
    intro:
      "The new attack surface: prompt injection, model exfiltration, training-data poisoning, jailbreaks, and the operational side — RBAC for tools, audit logs for agents, kill-switches for autonomy.",
    sampleSparks: [
      {
        title: "Prompt injection is the new SQL injection",
        teaser:
          "Every place untrusted text reaches a model is a prompt-injection surface. Treat it like input validation in 2005.",
      },
      {
        title: "Tools change everything",
        teaser:
          "An LLM with no tools is a slightly chatty calculator. An LLM with tools is a junior employee. Treat their permissions accordingly.",
      },
    ],
  },
  "open-source": {
    id: "open-source",
    name: "Open Source AI",
    emoji: "🌐",
    tagline: "The trendy projects you should know — and use.",
    intro:
      "The open-source AI stack that compounds: Llama, Mistral, vLLM, Ollama, llama.cpp, Hugging Face, plus the agent/eval/memory libraries that make those models useful.",
    sampleSparks: [
      {
        title: "Run a model locally in 5 minutes",
        teaser:
          "Ollama + a 7B model on your laptop is a great mental-model anchor. Once you've held the weights, the cloud APIs make more sense.",
      },
      {
        title: "vLLM is the production answer",
        teaser:
          "If you're serving an open-weight model in prod, vLLM is the default. PagedAttention is the secret sauce.",
      },
    ],
  },
  "frontier-companies": {
    id: "frontier-companies",
    name: "AI Frontier Companies",
    emoji: "🚀",
    tagline: "Who's building the future and how — Anthropic, OpenAI, Google, more.",
    intro:
      "The companies pushing the frontier: Anthropic (Claude, Constitutional AI), OpenAI (GPT, o-series), Google DeepMind (Gemini), Meta (Llama), Mistral, xAI, and the wave of vertical specialists. How each one positions, what they ship, and what to learn from.",
    sampleSparks: [
      {
        title: "Anthropic's research culture",
        teaser:
          "Anthropic publishes its safety research openly. Reading those papers is the cheapest way to understand the frontier of alignment.",
      },
      {
        title: "Why the giants are different",
        teaser:
          "OpenAI optimizes for general intelligence. Anthropic optimizes for trust. Google optimizes for distribution. The differences show up in the products.",
      },
    ],
  },
};

export function getTopicSnippet(topicId: string): TopicSnippet | null {
  return TOPIC_SNIPPETS[topicId] ?? null;
}

export const ALL_TOPIC_IDS = Object.keys(TOPIC_SNIPPETS);
