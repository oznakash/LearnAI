import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "ai-news" as const;

export const aiNews: Topic = {
  id: T,
  name: "AI News & Pulse",
  emoji: "📰",
  tagline: "How to read the firehose without drowning.",
  color: "#28e0b3",
  visual: "news",
  levels: [
    level(T, 1, "Build a low-noise feed", "Signal beats velocity.", 4, [
      spark("Curate ruthlessly", {
        type: "microread",
        title: "Your AI news diet",
        body: "AI news is a firehose of hype. Build a small high-signal feed: 5-8 trusted writers, lab blogs (Anthropic, OpenAI, DeepMind, Meta), one weekly digest (e.g. The Rundown, Latent Space, Import AI), and one paper aggregator. Mute the rest. Quality > quantity. You'll know more, faster, with less anxiety.",
        takeaway: "Small curated feed > infinite scroll.",
        source: { name: "AlphaSignal", url: "https://alphasignal.ai/archive" },
        category: "principle",
        addedAt: "2026-04-20",
      }),
      // Sprint #2 seed — external-source nugget from AlphaSignal feed.
      // Demonstrates the freshness chip on a `news`-category Spark with
      // a recent addedAt date. SEED — VERIFY before public publish.
      spark("Long-context is a refactor signal", {
        type: "microread",
        title: "Claude Opus 4.7 (1M context) is GA",
        body: "Anthropic shipped Claude Opus 4.7 with a 1M-token context window, available to API customers and inside Claude Code. That's roughly 750k words — a full mid-size codebase or every email you've sent this year. The pricing tier above 200k tokens is higher per token, so the practical pattern is still RAG for hot paths and 1M context for one-shot codebase reasoning. If you've been chunking aggressively to fit 200k, audit which of those pipelines are now just noise.",
        takeaway: "Long-context isn't a gimmick anymore — it's a refactor signal for any RAG pipeline you built before 2026.",
        source: { name: "AlphaSignal", url: "https://alphasignal.ai/archive" },
        category: "news",
        addedAt: "2026-04-22",
      }),
    ]),
    level(T, 2, "Press release vs reality", "What labs say vs what shipped.", 4, [
      spark("Decode launches", {
        type: "microread",
        title: "Hype filters",
        body: "Common patterns: 'achieves SOTA on X' (often cherry-picked benchmark), 'agentic capabilities' (sometimes a single demo), 'available soon' (months out), 'researchers' price (not commercial). Rule: wait 1 week, read independent reviews, run your own evals before switching production.",
        takeaway: "Read launch posts skeptically. Wait for replication.",
      }),
    ]),
    level(T, 3, "Spotting real breakthroughs", "Three tells.", 4, [
      spark("Three signals", {
        type: "microread",
        title: "What real breakthroughs look like",
        body: "(1) The capability is replicated by an independent team within weeks. (2) Pricing/latency is good enough for production, not just demo. (3) The technique generalizes — papers cite it across domains. If a 'breakthrough' fails all three after a month, it's just a demo.",
        takeaway: "Replicated + practical + generalizable. Else: demo.",
      }),
    ]),
    level(T, 4, "Reading research papers fast", "10-min skim.", 4, [
      spark("Skim like a builder", {
        type: "microread",
        title: "Paper triage in 10 min",
        body: "Read in this order: title, abstract, fig 1, conclusion. Then: limitations, related work. If still interested, method. Skip math sections unless you'll implement. 90% of papers don't survive the abstract test. The 10% that do, read carefully + look for an open-source impl.",
        takeaway: "Title → abstract → fig 1 → conclusion. Triage hard.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Drop a paper into Claude with: 'TL;DR in 5 bullets, plus one paragraph on why a builder should care or shouldn't.' Saves 80% of paper-reading time.",
      }),
    ]),
    level(T, 5, "Conferences worth watching", "NeurIPS, ICML, AAAI, ICLR.", 4, [
      spark("Where research lands", {
        type: "microread",
        title: "Big AI conferences",
        body: "NeurIPS (Dec, broad), ICML (Jul, theory + applied), ICLR (Apr/May, deep learning), AAAI (Feb, broad AI), CVPR (Jun, vision), ACL (Jul, NLP). You don't need to attend — track best-paper lists, recorded talks, social conversation. Even skimming the awards each year keeps you grounded.",
        takeaway: "Skim award winners. That's 80% of the value.",
      }),
    ]),
    level(T, 6, "Following key Twitter/X voices", "Curate the firehose.", 4, [
      spark("People to follow", {
        type: "microread",
        title: "A starter follow list",
        body: "Andrej Karpathy (clear explainers), Ethan Mollick (practical), Dario + Sam + Demis (lab leaders), Simon Willison (tools, infra), Jim Fan (research takes), Latent Space podcast, Allie Miller (industry). Avoid pure hypers. Follow 30, mute keywords aggressively.",
        takeaway: "30 real voices > 3000 hypers.",
      }),
    ]),
    level(T, 7, "Newsletters that are worth it", "Weekly signal.", 4, [
      spark("Newsletter list", {
        type: "microread",
        title: "Weekly diet",
        body: "Import AI (Jack Clark, deep), The Rundown (broad), Latent Space (engineer-focused), Ben's Bites (consumer-friendly), TLDR AI (quick). Pick 1-2. Reading 5 every day is procrastination dressed as learning.",
        takeaway: "1-2 newsletters. Anything more is performance.",
      }),
    ]),
    level(T, 8, "Avoiding doom + hype loops", "Mental hygiene.", 4, [
      spark("Both ends are loud", {
        type: "microread",
        title: "Don't get pulled to extremes",
        body: "AI Twitter has two megaphones: 'AGI tomorrow' and 'all useless slop'. Reality is grayer + more interesting. When you feel strong emotions about an AI thread, close the app. Go ship something. The doomers and the boomers will still be loud tomorrow; your week's progress won't.",
        takeaway: "Mute the extremes. Ship instead.",
      }),
    ]),
    level(T, 9, "Synthesizing it weekly", "Your own digest.", 4, [
      spark("Personal digest habit", {
        type: "microread",
        title: "Write your own pulse",
        body: "Every Friday, write 5 bullets to yourself (or your team): top thing I learned, biggest model release, most interesting startup move, paper to revisit, hot take. Forces you to process, not just consume. Compound this for a year and you're a domain expert.",
        takeaway: "Write the digest. Compounds into expertise.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Use LearnAI's Tasks tab to capture interesting articles or talks during the week. Friday: review tasks, write 5 bullets, archive.",
      }),
    ]),
    level(T, 10, "Boss: news check", "Final gate.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: AI News",
        questions: [
          {
            type: "quickpick",
            prompt: "Best response to a new model release?",
            options: ["Switch production immediately", "Run your house eval, decide based on data", "Tweet about it", "Ignore"],
            answer: 1,
            explain: "Your evals are the truth.",
          },
          {
            type: "quickpick",
            prompt: "Most efficient way to read a research paper?",
            options: ["Cover to cover", "Title → abstract → fig 1 → conclusion → decide", "Math first", "Skip — just tweet"],
            answer: 1,
            explain: "Triage like a senior reader.",
          },
          {
            type: "quickpick",
            prompt: "How many newsletters is healthy?",
            options: ["10+", "1-2 chosen carefully", "0", "Random"],
            answer: 1,
            explain: "Quality > quantity.",
          },
        ],
      }),
    ]),
  ],
};
