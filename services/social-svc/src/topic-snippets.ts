// Public-safe topic snippets used by the SSR `/u/:handle` page.
//
// These are the keyword-rich, short-form summaries that show up inside
// `<details>` collapsibles on the public profile page. Three roles:
//   1. SEO content density — every profile renders the topics that
//      player has Signals on, so each page has unique-ish keyword
//      content for Google / GPTBot / ClaudeBot to index.
//   2. AI-ingestion structure — paired with the JSON-LD
//      `LearningResource` schema in `ssr.ts`, each spark becomes an
//      indexable learning unit. ChatGPT / Claude / Perplexity can
//      cite "@<handle> is learning about X" with a real URL.
//   3. "Sample of what they're learning" — non-personalized, but a
//      visitor can read a real preview of the topic without bouncing
//      to another page. Collapsibles default closed so the layout
//      stays tight.
//
// Source of truth for the canonical topic name + emoji + tagline lives
// in `app/src/content/topics/*.ts`. We duplicate a tight subset here
// (id → name / emoji / tagline / 4-5 sample-spark intros + a "what
// you'd learn" overview) because the social-svc TS build can't reach
// across the repo into the SPA's content modules. When we add more
// topics or reword taglines, this file needs the matching update —
// the test file pins the id set against the SPA's `TopicId` union.

export interface TopicSnippet {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  /** 1-2 sentence "what you'll learn" hook for the topic-card body. */
  intro: string;
  /**
   * Longer-form "what you'd learn here" rundown — 3-4 sentences that
   * pack the keyword-dense vocabulary an AI ingestion bot scores on
   * (Anthropic, OpenAI, Perplexity all weight specific terminology
   * heavily). Rendered inside the `<details>` body alongside the
   * sample sparks. Distinct from `intro` so the short summary stays
   * tight while this carries the bulk SEO/AI content.
   */
  whatYoudLearn: string;
  /** 4-5 sample spark titles + 1-line teasers, indexable inside <details>. */
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
    whatYoudLearn:
      "Modern AI rests on a tight stack of ideas: neural networks (universal function approximators), gradient descent (the learning rule), the transformer architecture (attention as the workhorse), and scaling laws (more data + more compute = better models, with surprisingly clean exponents). You'll learn why 'pattern, not magic' is the right mental model, where today's models genuinely break down (out-of-distribution data, multi-step reasoning that can't be in-context), and the difference between pre-training, fine-tuning, RLHF, and constitutional AI. Anchored on real models — GPT-4, Claude, Gemini, Llama — not abstractions.",
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
      {
        title: "Transformers in 60 seconds",
        teaser:
          "The transformer is just attention + a feedforward block, stacked. Attention lets each token look at every other token. That single trick replaced RNNs, CNNs, and almost everything else.",
      },
      {
        title: "Pre-training vs. fine-tuning vs. RLHF",
        teaser:
          "Pre-training learns the world. Fine-tuning teaches a job. RLHF makes the model pleasant to talk to. Three stages, three very different signals.",
      },
      {
        title: "Where models still break",
        teaser:
          "Long-horizon reasoning, novel symbolic tasks, anything truly out-of-distribution. Knowing where the edges are is more useful than memorizing benchmarks.",
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
    whatYoudLearn:
      "The 2025 AI builder runs a fundamentally different loop than a 2020 software engineer. You'll learn the weekly-ship cadence (compounding > batching), the Loom-before-code spec discipline (if you can't film the experience, the idea isn't crisp), the agentic IDE workflow (steering Claude Code / Cursor / Windsurf rather than typing), and the build-in-public muscle (every Spark you ship is a recruiting asset). Plus the meta-skill: knowing which tiny problem to attack so the AI's compounding leverage actually shows up in revenue or retention, not just commits.",
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
      {
        title: "The agentic IDE workflow",
        teaser:
          "Claude Code, Cursor, Windsurf. Pick a goal, hand the tool the keys to your repo, review at the diff. The skill is steering, not typing.",
      },
      {
        title: "Build in public, every week",
        teaser:
          "Each ship is a recruiting asset. The portfolio compounds whether or not the project does.",
      },
      {
        title: "Pick the right tiny problem",
        teaser:
          "AI's compounding leverage only shows up where the bottleneck was actually 'time to write code'. Pick those problems on purpose.",
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
    whatYoudLearn:
      "Classic PM tools (PRDs, A/B tests, NPS) break on AI features because the output is non-deterministic, the cost-per-call scales with usage, and 'wrong' isn't binary. You'll learn the eval-driven roadmap (build the rubric before the feature), the prompt-as-spec discipline (your prompt IS the product spec), trust-budget thinking (every wrong answer spends user trust — meter it), inference-cost unit economics (a viral AI feature can bankrupt you in a weekend), and the new metrics that matter (good-answer rate, time-to-confidence, refusal-quality, escape-hatch usage).",
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
      {
        title: "Prompt-as-spec",
        teaser:
          "Your prompt is the product spec. Treat it that way: review it, version it, ship behind a flag.",
      },
      {
        title: "Inference unit economics",
        teaser:
          "A viral AI feature can torch your runway in 72 hours. Calculate cost-per-active-user before you scale.",
      },
      {
        title: "Refusal quality",
        teaser:
          "How an AI says 'I don't know' is half the product. A great refusal is better than a confident wrong answer.",
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
    whatYoudLearn:
      "Cursor, Claude Code, Windsurf, Aider, GitHub Copilot Workspace. You'll learn the difference between autocomplete (next-token prediction in your editor) and agentic dev tools (a long-running agent that takes a goal, plans, runs shell commands, edits files, and reports back). The workflow patterns: spec-first, diff-review, narrow-window-vs-whole-repo, when to let the agent run unsupervised vs sit in the loop. Plus the economics — what each tool costs per active developer, how to budget agent runs, when to lean on Claude Code's deeper tool-use vs Cursor's faster inline edits.",
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
      {
        title: "Claude Code vs. Cursor",
        teaser:
          "Cursor is fast inline edits with the model in your editor. Claude Code is long-running agentic runs in your terminal. Use both, for different tasks.",
      },
      {
        title: "Diff-review is the new code review",
        teaser:
          "When the agent writes the code, your job is reviewing the diff before you accept. Same skill, different surface.",
      },
      {
        title: "Spec-first prompting",
        teaser:
          "A two-paragraph spec gets you a one-shot solution. A one-line vibe gets you a confused agent and a wasted hour.",
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
    whatYoudLearn:
      "The cognition layer: attention as the working-memory mechanism, context windows as the model's effective RAM, in-context learning as 'few-shot prompting' done right, chain-of-thought as the prompt pattern that buys you reasoning quality on a budget, and tree-of-thought / ReAct / scratch-pad as the post-CoT generation. You'll learn why models fail on multi-step arithmetic but succeed on multi-step legal reasoning (the training distribution, not raw capability), why temperature matters more than you think, and how prompt patterns like role-prompting, instruction-tuning hooks, and constraint scaffolding actually steer the model.",
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
      {
        title: "Chain-of-thought, in plain English",
        teaser:
          "Asking the model to 'think step by step' literally buys you better reasoning. The compute is the same, the answer is different.",
      },
      {
        title: "Why temperature matters",
        teaser:
          "Temperature 0 is deterministic. Temperature 1 explores. The right setting is task-specific and almost nobody tunes it.",
      },
      {
        title: "Role prompting works (and why)",
        teaser:
          "Telling the model 'you are a senior engineer' changes the distribution it samples from. It's not magic, it's conditioning.",
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
    whatYoudLearn:
      "The memory stack: RAG (retrieve-augment-generate) as the default pattern for grounding LLMs in your data, vector databases (pgvector, Pinecone, Weaviate) as the index, embedding models as the lossy compression, and dedicated memory layers (mem0, MemGPT, Letta) as the next abstraction up. The safety stack: alignment (RLHF, Constitutional AI, DPO), red-teaming (jailbreak resistance, prompt injection defense), eval harnesses (HELM, lm-eval-harness, your own), and the operational side (audit logs for agent actions, kill-switches for autonomy, RBAC for tool use). Anthropic's published research is the cheapest masterclass in the field.",
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
      {
        title: "pgvector vs. dedicated vector DBs",
        teaser:
          "Postgres + pgvector covers 80% of teams. Reach for Pinecone / Weaviate when you outgrow it, not before.",
      },
      {
        title: "Constitutional AI in 60 seconds",
        teaser:
          "Anthropic's training trick: have the model critique itself against a written constitution. The constitution does the work humans used to do.",
      },
      {
        title: "Memory layers > longer contexts",
        teaser:
          "Throwing 1M tokens at every turn is slow and expensive. A memory layer (mem0, MemGPT) summarizes and retrieves selectively.",
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
    whatYoudLearn:
      "An AI-news literacy toolkit: which signal sources actually move the field (Anthropic / OpenAI / DeepMind / Meta research blogs, ArXiv tags, a few high-quality podcasts and Substacks), which feeds are 95% noise (most AI Twitter, breathless launch threads), and how to triage in under 10 minutes a day. You'll learn the anatomy of a fake-frontier release (cherry-picked benchmarks, no usable demo, no reproducibility), the 'wait two weeks' rule, and how to track real adoption signals (download counts, API usage, repo stars on the implementation libraries).",
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
      {
        title: "The 'wait two weeks' rule",
        teaser:
          "Frontier launches mostly look great on day one. Two weeks in, the limits surface. Don't reorganize your stack on a launch tweet.",
      },
      {
        title: "ArXiv tags worth following",
        teaser:
          "cs.LG, cs.CL, cs.AI. Sort by 'most recent', skim titles for 30 seconds, save the 1-2 that matter.",
      },
      {
        title: "Adoption beats announcement",
        teaser:
          "Hugging Face downloads, GitHub stars on the SDK, OpenRouter usage curves. Real adoption is a slower, truer signal than launch-day buzz.",
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
    whatYoudLearn:
      "The trend lines worth modeling for 2025-2026: agents going from demos to production (with guardrails, audit, and reliable tool-use), multimodality as default (vision + audio + text in one model), small-models-tuned-tight beating frontier general models on narrow jobs, on-device inference (Apple Intelligence, Llama on-device) eating low-latency use cases, and inference economics dropping ~10x/year on the cost curve. Plus the contrarian bets — what gets oversold (true autonomous agents in regulated industries, AGI timelines), what gets undersold (the long tail of vertical AI tools).",
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
      {
        title: "Agents finally working",
        teaser:
          "2024's agent demos were toys. 2025's agents (Claude Code, Devin, OpenAI Operator) actually finish real tasks unsupervised.",
      },
      {
        title: "Multimodality as default",
        teaser:
          "GPT-4o, Gemini, Claude 3.5+. Vision + audio + text in one model is no longer the premium tier — it's the default.",
      },
      {
        title: "On-device is real now",
        teaser:
          "Apple Intelligence, Llama 3.2 on phones, Phi on Surface. Latency-sensitive UX is moving off the cloud.",
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
    whatYoudLearn:
      "GPU economics from first principles: H100 / B200 hourly rates, on-demand vs. reserved, spot vs. committed. The hyperscaler stack (AWS / GCP / Azure) vs. the GPU neoclouds (CoreWeave, Lambda, Crusoe, Together) — what each is good at, where the lock-in lives. Inference-tier infra (Modal, Replicate, RunPod) vs. training-tier (Slurm clusters, Kubernetes with GPU operator). The hidden costs (egress, cross-AZ, NAT, VPC peering) that turn a cheap-on-paper deploy into an expensive surprise.",
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
      {
        title: "Hyperscaler vs. neocloud",
        teaser:
          "AWS / GCP / Azure for everything-bundled. CoreWeave / Lambda / Crusoe for cheaper raw GPU time. Trade-off: managed services vs. cost.",
      },
      {
        title: "Modal / Replicate / RunPod",
        teaser:
          "Inference-tier specialists. Pay per call, not per hour. Great for product-shape workloads, not for training runs.",
      },
      {
        title: "Spot is your friend (until it isn't)",
        teaser:
          "Spot GPU pricing is 60-80% off. Your training script needs to be checkpoint-resilient or you'll lose work.",
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
    whatYoudLearn:
      "The AI-specific threat catalog: prompt injection (the new SQL injection — every untrusted text surface is an attack vector), training-data poisoning (rare but high-impact), model extraction / inversion (extracting training data from a deployed model), jailbreaks (DAN, role-prompting, multi-turn manipulation). Defenses in depth: input sanitization, output filtering, RBAC for tool use (an agent with no permissions is a chatbot; with permissions, it's a junior employee), audit logs for every tool invocation, kill-switches and rate limits, and the OWASP LLM Top 10 as a checklist.",
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
      {
        title: "OWASP LLM Top 10",
        teaser:
          "Real, regularly-updated checklist. Bookmark it. Walk through it for every AI feature you ship.",
      },
      {
        title: "Audit every tool call",
        teaser:
          "When the agent runs `rm -rf` on the wrong directory, the audit log is the only thing that tells you what happened.",
      },
      {
        title: "Kill-switches are non-negotiable",
        teaser:
          "Every long-running agent needs an off-button you can hit before lunch. If you can't shut it down in 30 seconds, you don't ship it.",
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
    whatYoudLearn:
      "The 2025 open-weight model landscape: Llama 3.x family (Meta's flagship, MIT-licensed, tuned for everything), Mistral / Mixtral (efficient, multilingual), Qwen / DeepSeek / Yi (China-built, often near-frontier on benchmarks), Phi (Microsoft, small + smart). The serving stack: vLLM for production (PagedAttention is the secret sauce), Ollama / LM Studio for local play, llama.cpp for the bare metal. The ecosystem: Hugging Face Hub as the GitHub of weights, LangChain / LlamaIndex / DSPy as the orchestration layer, and dozens of vertical libs (Letta for memory, AutoGen for agents).",
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
      {
        title: "Llama 3.x is the workhorse",
        teaser:
          "MIT-licensed, top-of-class on most benchmarks, full toolchain. The default 'pick first, swap later' open-weight choice.",
      },
      {
        title: "Hugging Face is the GitHub of weights",
        teaser:
          "Models, datasets, demos, leaderboards, training scripts. If it's open and worth using, it's there.",
      },
      {
        title: "Quantization isn't free, but close",
        teaser:
          "GPTQ, AWQ, GGUF. 4-bit quantization gives you 2-4x speedup with usually <2% quality loss. Always worth a benchmark.",
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
    whatYoudLearn:
      "Each frontier lab has a distinct research culture and product strategy worth modeling. Anthropic optimizes for trust and safety as a competitive moat (Constitutional AI, refusal quality, published interpretability research). OpenAI optimizes for general capability and distribution (ChatGPT consumer, GPT-API platform, the o-series reasoning models). Google DeepMind optimizes for distribution + multimodality at search-engine scale (Gemini family, AI in every Google product). Meta optimizes for ecosystem (Llama as commodified open infrastructure to break the API moat). Plus the specialists — Mistral (Europe), xAI (Twitter/X-native), and the wave of vertical labs (Cohere for enterprise, Replicate for inference).",
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
      {
        title: "Meta's open-weight bet",
        teaser:
          "Llama isn't a product. It's a strategic move to commoditize the layer where competitors built moats. Watch how that plays out.",
      },
      {
        title: "DeepMind's compute advantage",
        teaser:
          "Inside Google, DeepMind has compute most labs can only dream of. Gemini's frontier scaling is the most direct expression of that.",
      },
      {
        title: "The vertical wave",
        teaser:
          "Cohere (enterprise NLP), Replicate (inference platform), Mistral (efficient EU models), xAI (Twitter-data-native). Each carved a defensible niche.",
      },
    ],
  },
};

export function getTopicSnippet(topicId: string): TopicSnippet | null {
  return TOPIC_SNIPPETS[topicId] ?? null;
}

export const ALL_TOPIC_IDS = Object.keys(TOPIC_SNIPPETS);
