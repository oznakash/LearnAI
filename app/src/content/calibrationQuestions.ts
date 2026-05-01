import type { TopicId } from "../types";

/**
 * A single calibration question — multiple-choice, with a numeric `level`
 * matching the 1..10 Topic level index. The smart selector picks a
 * 5-question quiz that probes the player's claimed level: an anchor at
 * their level, two up-probes (level+1, level+2), one down-probe
 * (level-1), and one cross-area probe in a different topic. The seen-id
 * tracker on the player profile keeps repeat sessions fresh.
 *
 * `area` is a free-text sub-topic tag. The selector uses it to spread
 * questions across distinct corners of a topic when multiple are
 * available at the same level.
 *
 * Adding a question:
 *   1. Pick a stable `id` (kebab-case). Never reuse an id.
 *   2. Pick the `level` honestly — what knowledge band would a player
 *      have to be in to know this without thinking?
 *   3. `answer` is the index into `options`.
 */
export interface CalibrationQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  /** 1..10, matching the Topic level index. */
  level: number;
  topic: TopicId;
  /** Optional sub-topic tag (e.g. "embeddings", "rag", "agents"). */
  area?: string;
  /** Optional one-liner shown after the player answers. */
  explain?: string;
}

export const CALIBRATION_POOL: CalibrationQuestion[] = [
  // ───────── ai-foundations ─────────
  {
    id: "afnd-01",
    level: 1,
    topic: "ai-foundations",
    area: "basics",
    prompt: "What does AI broadly stand for?",
    options: [
      "Automated Internet",
      "Artificial Intelligence",
      "Advanced Iteration",
      "Algorithmic Index",
    ],
    answer: 1,
  },
  {
    id: "afnd-02",
    level: 2,
    topic: "ai-foundations",
    area: "training",
    prompt: "In one phrase, what is 'training' a model?",
    options: [
      "Compiling its source code",
      "Adjusting weights to reduce error on examples",
      "Logging into the GPU cluster",
      "Encrypting the data set",
    ],
    answer: 1,
  },
  {
    id: "afnd-03",
    level: 3,
    topic: "ai-foundations",
    area: "embeddings",
    prompt: "Pick the best definition of an embedding.",
    options: [
      "A short prompt for an LLM",
      "A vector that represents meaning so similar things land near each other",
      "A small fine-tuned model",
      "A type of UI component",
    ],
    answer: 1,
  },
  {
    id: "afnd-04",
    level: 4,
    topic: "ai-foundations",
    area: "hallucinations",
    prompt: "Why does an LLM hallucinate?",
    options: [
      "GPU error",
      "Gaps or noise in training + the model must always predict",
      "Cosmic rays",
      "Bad internet connection",
    ],
    answer: 1,
  },
  {
    id: "afnd-05",
    level: 6,
    topic: "ai-foundations",
    area: "scaling",
    prompt: "What does the 'scaling laws' literature mostly predict?",
    options: [
      "GPU prices",
      "Loss decreasing predictably with more data + parameters + compute",
      "How fast a model overfits",
      "Optimal context length",
    ],
    answer: 1,
  },

  // ───────── llms-cognition ─────────
  {
    id: "llms-01",
    level: 1,
    topic: "llms-cognition",
    area: "tokens",
    prompt: "What does an LLM literally output?",
    options: [
      "A finished answer",
      "One token at a time",
      "An embedding",
      "A summary",
    ],
    answer: 1,
  },
  {
    id: "llms-02",
    level: 3,
    topic: "llms-cognition",
    area: "model-choice",
    prompt: "Which model fits real-time chat best?",
    options: [
      "Heavy reasoning model",
      "Small fast model (Haiku-class)",
      "Image gen model",
      "Diffusion model",
    ],
    answer: 1,
  },
  {
    id: "llms-03",
    level: 5,
    topic: "llms-cognition",
    area: "context",
    prompt: "What is a 'context window'?",
    options: [
      "The OS window the model runs in",
      "The max tokens of input + output the model can attend to in a single call",
      "The IDE pane that shows code",
      "A type of UI alert",
    ],
    answer: 1,
  },
  {
    id: "llms-04",
    level: 7,
    topic: "llms-cognition",
    area: "rag",
    prompt: "What is the core idea of retrieval-augmented generation (RAG)?",
    options: [
      "Train a smaller model on your docs",
      "Fetch relevant snippets at query time and put them in the prompt",
      "Cache every answer the model produces",
      "Run two models in parallel and average them",
    ],
    answer: 1,
  },
  {
    id: "llms-05",
    level: 9,
    topic: "llms-cognition",
    area: "tool-use",
    prompt: "What's the most accurate description of 'tool use' in modern LLM agents?",
    options: [
      "The model writes a calculator from scratch each call",
      "The model emits a structured call to a registered function and consumes its result",
      "It only means web browsing",
      "It's a fine-tune that adds calculator math",
    ],
    answer: 1,
  },

  // ───────── ai-builder ─────────
  {
    id: "build-01",
    level: 1,
    topic: "ai-builder",
    area: "first-build",
    prompt: "What's the simplest first 'AI app' you can build?",
    options: [
      "A web browser",
      "A prompt that asks an LLM and shows the answer",
      "A new neural net architecture",
      "A custom GPU driver",
    ],
    answer: 1,
  },
  {
    id: "build-02",
    level: 3,
    topic: "ai-builder",
    area: "prompting",
    prompt: "Best general first move when an LLM gives you a wrong answer?",
    options: [
      "Switch to a tinier model",
      "Re-read your prompt — clarify the task and constraints",
      "Disable streaming",
      "Lower max tokens",
    ],
    answer: 1,
  },
  {
    id: "build-03",
    level: 5,
    topic: "ai-builder",
    area: "caching",
    prompt: "Most cost-effective way to make repeated system prompts cheaper?",
    options: ["Bigger model", "Prompt caching", "Smaller context", "Higher temperature"],
    answer: 1,
  },
  {
    id: "build-04",
    level: 7,
    topic: "ai-builder",
    area: "evals",
    prompt: "Why ship an eval set before scaling an AI feature?",
    options: [
      "To pick a logo",
      "To detect quality regressions when you change prompt or model",
      "To pre-pay GPU bills",
      "Because the framework requires it",
    ],
    answer: 1,
  },
  {
    id: "build-05",
    level: 9,
    topic: "ai-builder",
    area: "agents",
    prompt: "What's the practical difference between a 'chain' and an 'agent'?",
    options: [
      "Agents are always faster",
      "A chain is a fixed pipeline; an agent decides next steps based on intermediate results",
      "Chains can't use tools",
      "Agents are always cheaper",
    ],
    answer: 1,
  },

  // ───────── ai-pm ─────────
  {
    id: "pm-01",
    level: 2,
    topic: "ai-pm",
    area: "shape",
    prompt: "What's the right unit to ship an AI feature in early?",
    options: [
      "A 12-month roadmap",
      "A small, evaluable slice with a clear success metric",
      "A moonshot vision deck",
      "A press release",
    ],
    answer: 1,
  },
  {
    id: "pm-02",
    level: 4,
    topic: "ai-pm",
    area: "evals",
    prompt: "Best PM artifact for AI features?",
    options: ["Press release", "Eval set", "Pitch deck", "OKR doc"],
    answer: 1,
  },
  {
    id: "pm-03",
    level: 6,
    topic: "ai-pm",
    area: "metrics",
    prompt: "Which metric most directly tracks an AI feature's quality?",
    options: [
      "DAU",
      "Task success rate on a representative eval",
      "GPU spend",
      "Page-load time",
    ],
    answer: 1,
  },
  {
    id: "pm-04",
    level: 8,
    topic: "ai-pm",
    area: "rollout",
    prompt: "Cheapest way to de-risk a model upgrade in production?",
    options: [
      "Swap models on Friday at 5pm",
      "Shadow the new model behind the old one and compare on a held-out eval",
      "Email the team",
      "Increase logs verbosity only",
    ],
    answer: 1,
  },

  // ───────── memory-safety ─────────
  {
    id: "sec-01",
    level: 3,
    topic: "memory-safety",
    area: "prompt-injection",
    prompt: "What is the #1 LLM security category to defend against?",
    options: ["Memory leaks", "Prompt injection", "Slow GPUs", "Empty caches"],
    answer: 1,
  },
  {
    id: "sec-02",
    level: 5,
    topic: "memory-safety",
    area: "data-leakage",
    prompt: "When does a model most plausibly leak private data?",
    options: [
      "When the GPU overheats",
      "When training data was indexed without scrubbing PII",
      "When the colors are dark",
      "When the JSON is invalid",
    ],
    answer: 1,
  },
  {
    id: "sec-03",
    level: 7,
    topic: "memory-safety",
    area: "tool-permissions",
    prompt: "Best mitigation for an agent that runs shell commands?",
    options: [
      "Trust the model",
      "Sandbox the shell + allowlist commands + require user confirmation for destructive ones",
      "Disable logging",
      "Make the model larger",
    ],
    answer: 1,
  },

  // ───────── cybersecurity ─────────
  {
    id: "cyber-01",
    level: 2,
    topic: "cybersecurity",
    area: "basics",
    prompt: "Pick the strongest password move below.",
    options: [
      "Reuse a memorable password everywhere",
      "Use a manager + unique passwords + 2FA",
      "Append the year to your name",
      "Email passwords to yourself",
    ],
    answer: 1,
  },
  {
    id: "cyber-02",
    level: 5,
    topic: "cybersecurity",
    area: "phishing",
    prompt: "Most effective single defense against phishing?",
    options: [
      "Mobile data only",
      "Phishing-resistant 2FA (passkeys / hardware key)",
      "Antivirus updates",
      "Clearing your cache",
    ],
    answer: 1,
  },

  // ───────── cloud ─────────
  {
    id: "cloud-01",
    level: 2,
    topic: "cloud",
    area: "deploy",
    prompt: "Simplest way to put a static SPA in front of users today?",
    options: [
      "Build a Kubernetes cluster",
      "Deploy to a static host (Vercel / Netlify / Cloud-Claude / etc.)",
      "Buy a server rack",
      "Email the .zip to users",
    ],
    answer: 1,
  },
  {
    id: "cloud-02",
    level: 6,
    topic: "cloud",
    area: "scaling",
    prompt: "What does horizontal scaling mean?",
    options: [
      "Bigger machines",
      "More machines",
      "Wider monitors",
      "Faster disks",
    ],
    answer: 1,
  },

  // ───────── ai-devtools ─────────
  {
    id: "devt-01",
    level: 2,
    topic: "ai-devtools",
    area: "ides",
    prompt: "Which is an AI-first developer tool?",
    options: ["Notepad", "Cursor", "Microsoft Paint", "ZIP"],
    answer: 1,
  },
  {
    id: "devt-02",
    level: 6,
    topic: "ai-devtools",
    area: "agents",
    prompt: "What does Claude Code primarily automate?",
    options: [
      "Email triage",
      "Multi-file code edits + tests + commits in your repo",
      "Spreadsheet pivots",
      "Photo retouching",
    ],
    answer: 1,
  },

  // ───────── ai-trends ─────────
  {
    id: "trd-01",
    level: 3,
    topic: "ai-trends",
    area: "frontier",
    prompt: "Which best describes 'frontier model' as of 2025?",
    options: [
      "An older small model",
      "The current top-capability models from Anthropic, OpenAI, Google, etc.",
      "A model trained only on books",
      "A research-only paper model",
    ],
    answer: 1,
  },
  {
    id: "trd-02",
    level: 7,
    topic: "ai-trends",
    area: "agents",
    prompt: "What's the broad shift from 'chatbots' to 'agents'?",
    options: [
      "A logo refresh",
      "From single-turn answers to multi-step task execution with tools",
      "Different fonts",
      "From web to mobile only",
    ],
    answer: 1,
  },

  // ───────── frontier-companies ─────────
  {
    id: "fc-01",
    level: 2,
    topic: "frontier-companies",
    area: "labs",
    prompt: "Which company makes Claude?",
    options: ["Anthropic", "OpenAI", "Google DeepMind", "Meta"],
    answer: 0,
  },
  {
    id: "fc-02",
    level: 4,
    topic: "frontier-companies",
    area: "labs",
    prompt: "Which lab open-sourced Llama?",
    options: ["Anthropic", "Meta", "OpenAI", "xAI"],
    answer: 1,
  },
  {
    id: "fc-03",
    level: 8,
    topic: "frontier-companies",
    area: "compute",
    prompt: "Why is access to compute strategic for frontier labs?",
    options: [
      "Cheaper electricity",
      "Training frontier models requires 10⁴+ GPUs for weeks",
      "Marketing",
      "Better office snacks",
    ],
    answer: 1,
  },

  // ───────── ai-news ─────────
  {
    id: "news-01",
    level: 1,
    topic: "ai-news",
    area: "habit",
    prompt: "Healthiest way to follow AI news as a builder?",
    options: [
      "Refresh Twitter all day",
      "A few high-signal sources + a weekly digest, applied to your work",
      "Avoid all news",
      "Only read press releases",
    ],
    answer: 1,
  },

  // ───────── open-source ─────────
  {
    id: "os-01",
    level: 4,
    topic: "open-source",
    area: "vector",
    prompt: "Default vector store for an existing Postgres app?",
    options: ["Cassandra", "pgvector", "Redis", "CSV file"],
    answer: 1,
  },
  {
    id: "os-02",
    level: 6,
    topic: "open-source",
    area: "models",
    prompt: "Which is a popular OSS LLM family today?",
    options: ["GPT-4", "Llama / Mistral / Qwen", "Claude Sonnet", "Gemini"],
    answer: 1,
  },
];
