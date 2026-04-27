import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "memory-safety" as const;

export const memorySafety: Topic = {
  id: T,
  name: "Memory & Safety",
  emoji: "🧬",
  tagline: "RAG, memory layers, alignment, and safe-by-design AI.",
  color: "#ff5d8f",
  visual: "memory",
  levels: [
    level(T, 1, "Why models forget", "The context window is short-term memory.", 4, [
      spark("Goldfish brain", {
        type: "microread",
        title: "LLMs have no memory by default",
        body: "Each API call starts fresh. The model only 'knows' what's in the current prompt. The 200k-token context window is short-term memory — it disappears the second the call ends. Anything you want it to remember tomorrow has to be stored somewhere and re-injected. That's the entire point of memory layers, RAG, and conversation history.",
        takeaway: "No persistence by default. You provide the memory.",
        visual: "memory",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "Where does an LLM 'remember' things between calls?",
        options: ["Inside the model weights", "It doesn't — you have to re-supply it", "Disk", "In a cookie"],
        answer: 1,
        explain: "Stateless by design. Memory is your job.",
      }),
    ]),
    level(T, 2, "RAG in plain terms", "Retrieval-Augmented Generation, demystified.", 5, [
      spark("Lookup, then answer", {
        type: "microread",
        title: "RAG = search + LLM",
        body: "When a user asks a question, you embed it, search your vector DB for the top-k most relevant chunks, paste them into the prompt, and let the LLM answer using those chunks. That's RAG in one paragraph. It works because the model is great at synthesizing supplied facts, even if it didn't know them. It fails when chunks are too small, too big, retrieved badly, or the LLM ignores them.",
        takeaway: "RAG = relevant docs in context, then answer.",
        visual: "embed",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Chunk by semantic boundary (paragraph, section), not fixed token size. And always include the chunk's source title — the model uses that to weight authority.",
      }),
      spark("Build it", {
        type: "buildcard",
        title: "Build: 50-line RAG over your notes",
        pitch: "End-to-end RAG. You'll never fear the term again.",
        promptToCopy:
          "Build a Python script that ingests a folder of markdown notes, chunks them by heading, embeds with sentence-transformers, stores in a local SQLite + sqlite-vec DB, and answers questions via the Anthropic API with the top 3 chunks injected into the prompt.",
        successCriteria: "You can ask questions about your own notes and get cited answers.",
      }),
    ]),
    level(T, 3, "Memory layers", "Working, short-term, long-term.", 4, [
      spark("Three tiers", {
        type: "microread",
        title: "Working / short / long memory",
        body: "Working memory = the current prompt. Short-term = the conversation history (last N turns). Long-term = a persistent store (vector DB, summary doc, structured profile) you query and inject as needed. Production AI products design all three deliberately. Skipping the long-term layer is why most chatbots feel amnesiac.",
        takeaway: "Design memory like a real database — layered, on purpose.",
      }),
      spark("Pattern match", {
        type: "patternmatch",
        prompt: "Match each memory job to a tier",
        pairs: [
          { left: "User's name & preferences", right: "Long-term" },
          { left: "Last 5 chat messages", right: "Short-term" },
          { left: "Current question being answered", right: "Working" },
          { left: "Past purchase history", right: "Long-term" },
        ],
        explain: "Different lifetimes → different stores.",
      }),
    ]),
    level(T, 4, "Alignment, briefly", "Why HH (helpful, harmless) matters.", 4, [
      spark("Two failure modes", {
        type: "microread",
        title: "Helpful AND harmless",
        body: "An aligned model is helpful (does what you actually want) AND harmless (refuses misuse). Both matter — over-refusing is also a failure (frustrating, useless). Frontier labs spend massive effort on RLHF, constitutional AI, and red teaming to find this balance. As a builder, your prompt and policy layer extend this further to fit your product.",
        takeaway: "Alignment ≠ over-refusal. Calibrate for both.",
        visual: "shield",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "An assistant refuses to summarize a news article about violence. This is…",
        options: ["Perfectly aligned", "Over-refusal — a failure mode", "A network error", "Best practice"],
        answer: 1,
        explain: "Useful work blocked = misalignment too.",
      }),
    ]),
    level(T, 5, "Guardrails in production", "Belt + suspenders.", 5, [
      spark("Layered defenses", {
        type: "microread",
        title: "Don't trust one layer",
        body: "Production safety is layered: input filters (PII, prompt injection patterns), system prompt rules, model-level training (refusals), output filters (toxicity, jailbreak detection), and human-in-the-loop for sensitive actions. Each layer fails sometimes. Together they ship. If you have only one safety layer, you have none.",
        takeaway: "Stack 3+ guardrails. Each is fallible alone.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Use a small, fast classifier (not a big LLM) to pre-screen for obvious abuse. 10x cheaper, catches 80% of bad input before you spend tokens.",
      }),
      spark("Scenario", {
        type: "scenario",
        setup: "Your AI agent can send emails. A user prompt asks it to email their ex 'with strong language'.",
        prompt: "Best layered defense?",
        options: [
          "Trust the model alone",
          "Output filter + require user confirm before send + rate limit",
          "Just block all emails",
          "Disable the model",
        ],
        answer: 1,
        explain: "Confirm + filter + limit = real defense.",
      }),
    ]),
    level(T, 6, "Privacy & PII", "Don't leak the user.", 4, [
      spark("Don't train on customers", {
        type: "microread",
        title: "PII boundaries",
        body: "Default rule: never log raw user data with PII. Redact before logging. Never send prod data to a model training pipeline without explicit consent. Use providers that contractually exclude your data from training (Anthropic, OpenAI Enterprise both do). For high-risk domains (health, finance, legal), check if you need on-prem or VPC inference.",
        takeaway: "PII in = explicit policy out. Never default-leak.",
        visual: "lock",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Run a Presidio (or similar) scrub on user input before logging. One Python line, prevents 99% of compliance headaches later.",
      }),
    ]),
    level(T, 7, "Evaluating safety", "Specific tests for specific risks.", 4, [
      spark("Eval each risk", {
        type: "microread",
        title: "One eval per risk class",
        body: "Don't evaluate 'safety' generically. Build small targeted eval sets per risk: prompt injection, PII leak, jailbreaks, biased outputs, off-policy advice. 30 cases per category beats 1000 generic. Run them on every prompt change. When a regression slips through, it's almost always a missing eval — add it.",
        takeaway: "Per-risk eval sets. Add cases when bugs slip through.",
      }),
    ]),
    level(T, 8, "Long-context vs RAG", "When to use which.", 4, [
      spark("Tradeoffs", {
        type: "microread",
        title: "Stuff it vs search it",
        body: "Modern context windows fit huge docs (200k+ tokens). Tempting to just stuff everything in. But: it's expensive, slower, and 'lost in the middle' is real (models miss facts buried mid-context). RAG keeps prompts small and lets you scale to millions of docs, but requires good retrieval. Rule: if your corpus fits and you'll re-use it, cache + stuff it. If it grows or you query small slices, RAG.",
        takeaway: "Long context for stable, small corpora. RAG for scale.",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "10 GB legal corpus, hundreds of users, varying queries. Best fit?",
        options: ["Stuff it all into context", "RAG over the corpus", "Train a custom model", "Email it"],
        answer: 1,
        explain: "Way too big for context, but perfect for RAG.",
      }),
    ]),
    level(T, 9, "Agent safety", "Power tools, careful hands.", 5, [
      spark("Blast radius mindset", {
        type: "microread",
        title: "Agents = blast radius",
        body: "An agent that can browse, code, and email has real-world reach. Treat tool permissions like Unix file modes: least privilege, scoped to the task, revoked when done. Sandboxes for code execution. Allow-lists for outbound network. Confirmations for any irreversible action (send, delete, pay, deploy). The bigger the action, the slower and more visible it should be.",
        takeaway: "Slow + visible = safe. Fast + silent = scary.",
        visual: "shield",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Add an 'undo trail' to every agent action. Even fake undo (just a log) saves you when something goes sideways at 2am.",
      }),
    ]),
    level(T, 10, "Boss: safety review", "Audit yourself.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: Memory & Safety",
        questions: [
          {
            type: "quickpick",
            prompt: "Long-term memory in a chatbot is best stored…",
            options: ["In context every call", "In a vector DB / structured store", "In the user's cookie", "Nowhere"],
            answer: 1,
            explain: "Persistent store, retrieved as needed.",
          },
          {
            type: "quickpick",
            prompt: "An agent that can pay invoices should…",
            options: ["Auto-pay everything", "Require human confirm above $X and log all attempts", "Disable logging", "Trust prompts"],
            answer: 1,
            explain: "Confirm + log for irreversible actions.",
          },
          {
            type: "quickpick",
            prompt: "Best evaluation strategy for safety?",
            options: ["One big generic safety test", "Targeted eval set per risk class, run on every change", "Skip — trust the model", "Manual spot checks"],
            answer: 1,
            explain: "Per-risk, automated, every change.",
          },
        ],
      }),
    ]),
  ],
};
