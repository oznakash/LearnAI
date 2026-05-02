import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "open-source" as const;

export const openSource: Topic = {
  id: T,
  name: "Open Source AI",
  emoji: "🌐",
  tagline: "The trendy projects you should know — and use.",
  color: "#28e0b3",
  visual: "open",
  levels: [
    level(T, 1, "Why open source matters", "Power, learning, leverage.", 4, [
      spark("Three reasons", {
        type: "microread",
        title: "Why builders care about OSS",
        body: "(1) You can read the code — best way to learn how real systems work. (2) You're not locked in — own the stack, fork if needed. (3) Standards emerge from OSS (LangChain, Llama, transformers). Even if you ship on closed APIs, your stack is full of OSS — be respectful, contribute back, and use it as a learning ground.",
        takeaway: "OSS = teacher, leverage, insurance.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
    ]),
    level(T, 2, "Hugging Face ecosystem", "The GitHub of AI.", 4, [
      spark("HF in one breath", {
        type: "microread",
        title: "Why Hugging Face matters",
        body: "Hugging Face hosts hundreds of thousands of open models, datasets, and spaces. The transformers library standardized how Python loads models. Datasets library standardized how you stream big training data. If you build with open models, your week revolves around HF Hub. Free for most use, paid for inference endpoints.",
        takeaway: "HF Hub is the open AI center of gravity.",
        category: "company",
        addedAt: "2026-02-01",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Run any open model in 4 lines: `from transformers import pipeline; p = pipeline('text-generation', 'meta-llama/Meta-Llama-3-8B-Instruct'); print(p('Hi'))`. Test 5 models in an afternoon.",
        category: "tooling",
        addedAt: "2026-02-01",
      }),
    ]),
    level(T, 3, "LangChain, LlamaIndex, DSPy", "Frameworks.", 4, [
      spark("Three styles", {
        type: "microread",
        title: "Pick your framework",
        body: "LangChain: huge, batteries-included, sometimes overengineered — great for speed. LlamaIndex: RAG-first, cleaner abstractions for retrieval. DSPy: programmable prompts, compiles for you, research-led, steeper learning curve. Many builders go bare metal (raw API + small custom code) — frameworks help quick start, can hurt long-term.",
        takeaway: "Try a framework. Drop to bare metal when it gets in the way.",
        category: "tooling",
        addedAt: "2026-02-01",
      }),
    ]),
    level(T, 4, "Vector DBs", "pgvector, Chroma, Qdrant, Weaviate.", 4, [
      spark("Picking a vector store", {
        type: "microread",
        title: "Vector DB landscape",
        body: "pgvector — Postgres extension, perfect for adding vectors to existing apps. Chroma — local, dev-friendly, great for prototyping. Qdrant + Weaviate + Milvus — purpose-built, scale to billions. Pinecone (closed) — managed for serious scale. Start small with pgvector or Chroma, migrate when you cross 10M+ vectors.",
        takeaway: "Start tiny (pgvector). Migrate when scale forces.",
        category: "tooling",
        addedAt: "2026-02-01",
      }),
    ]),
    level(T, 5, "vLLM, llama.cpp, Ollama", "Serving open models locally.", 4, [
      spark("Three serving stacks", {
        type: "microread",
        title: "Run models on your hardware",
        body: "Ollama — easiest, brew install, run any model in 1 command. Great for laptops + dev. llama.cpp — battle-tested C++ engine, runs on CPU, M1/M2 fast, no GPU required. vLLM — production-grade, super fast batching, GPU. Pick by: dev (Ollama) → local (llama.cpp) → prod (vLLM).",
        takeaway: "Ollama → llama.cpp → vLLM as you scale.",
        category: "tooling",
        addedAt: "2026-02-01",
      }),
      spark("Build it", {
        type: "buildcard",
        title: "Build: chat with a local model",
        pitch: "5 min on a laptop. Total privacy.",
        promptToCopy:
          "Help me install Ollama, pull `llama3.2:3b`, then write a tiny Python REPL using `requests` that streams responses from `http://localhost:11434/api/chat`. No external APIs.",
        successCriteria: "Working chat that runs entirely on your machine.",
      }),
    ]),
    level(T, 6, "OSS agent frameworks", "AutoGen, CrewAI, Swarm.", 4, [
      spark("Multi-agent kits", {
        type: "microread",
        title: "Open agent stacks",
        body: "AutoGen (Microsoft) — research-grade multi-agent. CrewAI — friendlier, role-based teams. Swarm (OpenAI) — minimalist handoff pattern. SmolAgents (HF) — tiny, code-first agents. Each tries to standardize 'agent talks to agent + tools'. Reality: most production agents are still hand-rolled, but reading these helps you understand patterns.",
        takeaway: "Read 1-2 frameworks. Roll your own when needed.",
        category: "tooling",
        addedAt: "2026-02-01",
      }),
    ]),
    level(T, 7, "Open evals + datasets", "What everyone benchmarks on.", 4, [
      spark("Eval suites", {
        type: "microread",
        title: "Famous benchmarks",
        body: "MMLU (broad knowledge), HumanEval (code), GSM8K (math), HellaSwag (commonsense), MT-Bench (chat), SWE-bench (real GitHub issues). When labs claim 'SOTA', they cite these. Pitfalls: overfitting to benchmarks. Use as one signal among many — your real evals matter more.",
        takeaway: "Know the names. Trust your own evals more.",
        category: "pattern",
        addedAt: "2025-10-01",
      }),
    ]),
    level(T, 8, "OSS observability", "Helicone, Langfuse, Phoenix.", 4, [
      spark("LLM observability OSS", {
        type: "microread",
        title: "See what your AI is doing",
        body: "Helicone, Langfuse, OpenLLMetry, Phoenix (Arize) — all open source, all instrument LLM calls so you can see latency, cost, prompts, responses, eval scores. Set up day one. Without it you're flying blind in prod. Many also offer hosted versions if you don't want to self-host.",
        takeaway: "Instrument from day one. OSS makes it free.",
        category: "tooling",
        addedAt: "2026-02-01",
      }),
    ]),
    level(T, 9, "Trendy OSS to watch", "Worth bookmarking.", 4, [
      spark("Names to know", {
        type: "microread",
        title: "Repos worth a star",
        body: "ggerganov/llama.cpp (CPU inference), open-webui (chat UI for any model), comfyanonymous/ComfyUI (image gen), unsloth (fast fine-tuning), Marker / Docling (PDF extraction for RAG), browser-use (browser agents), mem0 (memory layer), LiteLLM (provider abstraction), continue (open Cursor alternative).",
        takeaway: "Star these. They cover most builder needs.",
        category: "tooling",
        addedAt: "2026-02-01",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Once a month, browse Hugging Face's trending models page and GitHub's trending Python repos for tag 'llm'. 10 minutes that keeps you current.",
        category: "pattern",
        addedAt: "2025-10-01",
      }),
    ]),
    level(T, 10, "Boss: open source check", "Final gate.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: Open Source AI",
        questions: [
          {
            type: "quickpick",
            prompt: "Easiest way to run an open model on your laptop?",
            options: ["Build CUDA from source", "Install Ollama, pull a model", "Train your own", "Buy an H100"],
            answer: 1,
            explain: "Ollama in 1 command.",
          },
          {
            type: "quickpick",
            prompt: "Best lightweight start for a vector DB inside an existing app?",
            options: ["Pinecone enterprise", "pgvector in Postgres", "Custom search index", "Redis only"],
            answer: 1,
            explain: "Same DB, vectors added.",
          },
          {
            type: "quickpick",
            prompt: "When should you DROP a framework?",
            options: ["Never", "When it costs more than it saves (debugging, abstraction tax)", "When you raise a Series A", "On Tuesdays"],
            answer: 1,
            explain: "Frameworks age into liabilities. Reassess yearly.",
          },
        ],
      }),
    ]),
  ],
};
