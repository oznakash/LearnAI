import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "ai-trends" as const;

export const aiTrends: Topic = {
  id: T,
  name: "AI Trends",
  emoji: "📈",
  tagline: "Where the field is moving — and why it matters to builders.",
  color: "#ffb547",
  visual: "trend",
  levels: [
    level(T, 1, "Reasoning models everywhere", "From chat to thinking.", 4, [
      spark("The reasoning era", {
        type: "microread",
        title: "Why reasoning models exploded",
        body: "Through 2025-2026, every frontier lab shipped 'thinking' modes. Claude with extended thinking, o-series from OpenAI, Gemini Thinking, DeepSeek-R1 open weights. The pattern: same base model, but allowed to generate hidden reasoning before the answer. Effect: huge gains on math, code, planning. Cost: more tokens, more latency. Builders learn to route — fast model for chat, reasoning for hard.",
        takeaway: "Reasoning is now an option, not a feature. Route per task.",
              category: "news",
        addedAt: "2026-02-01",
}),
      spark("50/50 odds on superintelligence by 2028", {
        type: "podcastnugget",
        creatorId: "lenny",
        quote:
          "I think 50th-percentile chance of hitting some kind of superintelligence is now like 2028.",
        takeaway:
          "One of the people who built GPT-3 thinks superintelligence has 50/50 odds inside three years. You don't have to agree — but if you don't have a position on this, your career strategy is borrowed.",
        source: {
          podcast: "Lenny's Podcast",
          podcastUrl: "https://www.lennysnewsletter.com/podcast",
          guest: "Benjamin Mann",
          guestRole: "co-founder of Anthropic, GPT-3 architect at OpenAI",
          episodeTitle: "Inside Anthropic — alignment, scaling, AGI timelines",
          timestamp: "00:00:06",
        },
      }),
    ]),
    level(T, 2, "Agents go mainstream", "From demos to production.", 4, [
      spark("Beyond toy demos", {
        type: "microread",
        title: "Agents become work",
        body: "By 2026, agentic coding (Claude Code, Devin, Cursor Agent) became default in many engineering teams. Customer-support agents, research agents, ops agents quietly handle most ticket triage at top SaaS. Pattern: narrow scope + tight tools + good evals + human approval for risky steps. Wide-open 'do anything' agents still flop.",
        takeaway: "Narrow, tool-rich, supervised agents — that's what works.",
              category: "news",
        addedAt: "2026-02-01",
}),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "When pitching an agent, name the 5 specific tasks it handles. Vague 'AI assistant' pitches lose to specific 'AI that drafts your weekly report from these 4 dashboards'.",
              category: "pattern",
        addedAt: "2025-10-01",
}),
      spark("November 2025: agents crossed the threshold", {
        type: "podcastnugget",
        creatorId: "lenny",
        quote:
          "In November we had what I call the inflection point where GPT 5.1 and Claude Opus 4.5 came along. Previously you had to pay very close attention. Suddenly we went from that to almost all of the time it does what you told it to do, which makes all of the difference in the world.",
        takeaway:
          "Late-2025 is the year coding agents crossed the threshold from experimental to reliable. If you tried agents in summer '25 and bounced — you owe yourself another look.",
        source: {
          podcast: "Lenny's Podcast",
          podcastUrl: "https://www.lennysnewsletter.com/podcast",
          guest: "Simon Willison",
          guestRole: "co-creator of Django, coined 'prompt injection'",
          episodeTitle: "The November inflection: AI coding crosses the threshold",
          timestamp: "00:04:23",
        },
      }),
    ]),
    level(T, 3, "Multimodal as default", "Text, image, audio, video.", 4, [
      spark("One model, many senses", {
        type: "microread",
        title: "Multimodal everywhere",
        body: "Frontier models now handle image input by default and increasingly handle audio + video. Use cases exploding: screenshot-to-code, voice agents, video summarization, document understanding. Builder shift: design UX assuming users will paste screenshots, drag video, talk into a mic.",
        takeaway: "Plan for users to paste anything — image, audio, doc.",
              category: "pattern",
        addedAt: "2025-10-01",
}),
    ]),
    level(T, 4, "Open weights catching up", "Llama, DeepSeek, Mistral, Qwen.", 4, [
      spark("Closed vs open gap", {
        type: "microread",
        title: "The open weights wave",
        body: "Open-weight frontier-class models (DeepSeek, Llama, Qwen, Mistral) closed much of the gap with closed APIs in 2025. They run on your own infra, fine-tune freely, and are perfect for regulated industries. They lag closed models on the hardest benchmarks, but for 80% of product use cases they're plenty.",
        takeaway: "Open is a real option now. Pick by use case + regulation.",
              category: "news",
        addedAt: "2026-02-01",
}),
    ]),
    level(T, 5, "On-device AI", "Models in your pocket.", 4, [
      spark("Edge models", {
        type: "microread",
        title: "AI without the cloud",
        body: "Apple Intelligence, Gemini Nano, on-device Phi models bring small but capable models to phones and laptops. Wins: privacy, latency, offline. Use cases: smart text replies, summarization, image edits, intent detection. Hybrid stacks (small on-device + big in cloud) are the new frontier UX.",
        takeaway: "Hybrid: small fast on-device + big smart cloud.",
              category: "news",
        addedAt: "2026-02-01",
}),
    ]),
    level(T, 6, "Synthetic data", "Models training models.", 4, [
      spark("Self-feeding loop", {
        type: "microread",
        title: "Synthetic data goes mainstream",
        body: "Frontier models increasingly train on data generated by other models — sometimes themselves. With careful filtering, this expands data efficiently. Risks: model collapse if done naively (echo chambers), bias amplification. Done well, it's a competitive moat — synthetic eval sets, synthetic instruction tuning, synthetic edge cases.",
        takeaway: "Synthetic data, carefully filtered, is the new fuel.",
              category: "pattern",
        addedAt: "2025-10-01",
}),
    ]),
    level(T, 7, "AI search rewrites the web", "From links to answers.", 4, [
      spark("Search 2.0", {
        type: "microread",
        title: "Answers replace links",
        body: "Perplexity, ChatGPT search, Google AI Overviews changed search behavior. Builders need to think about being cited (LLM-friendly content, structured data, fast pages, clear factual statements). Direct traffic for many sites is dropping; AI-cited traffic is rising. Brand/product visibility now requires LLM-ready content.",
        takeaway: "Optimize for being cited, not just ranked.",
              category: "news",
        addedAt: "2026-02-01",
}),
    ]),
    level(T, 8, "AI copilots → AI co-workers", "From 1 task to many.", 4, [
      spark("Co-worker pattern", {
        type: "microread",
        title: "Co-workers, not copilots",
        body: "The shift from 'copilot helping with one task' to 'co-worker owning a workflow end-to-end' is the next wave. Companies wire agents into Slack, Linear, Salesforce — they take a thread, run the steps, post results, pause for approval. The product surface: not a chat box, but a teammate inside your existing tools.",
        takeaway: "Embed agents where work already happens.",
              category: "pattern",
        addedAt: "2025-10-01",
}),
      spark("Productivity per engineer is up 200%", {
        type: "podcastnugget",
        creatorId: "lenny",
        quote:
          "I have never enjoyed coding as much as I do today, because I don't have to deal with all the minutia. Productivity per engineer has increased 200%.",
        takeaway:
          "The ceiling on what one person can ship has just doubled. The engineers winning right now aren't the ones writing more code — they're the ones giving better instructions to agents.",
        source: {
          podcast: "Lenny's Podcast",
          podcastUrl: "https://www.lennysnewsletter.com/podcast",
          guest: "Boris Cherny",
          guestRole: "head of Claude Code, Anthropic",
          episodeTitle: "How Claude Code rewrites the job of an engineer",
          timestamp: "00:00:21",
        },
      }),
    ]),
    level(T, 9, "Regulation & policy", "EU AI Act, US executive orders.", 4, [
      spark("Compliance landscape", {
        type: "microread",
        title: "Regulation lands",
        body: "EU AI Act phased in through 2025-2026, classifying systems by risk. US states (CA, NY) ship narrower rules on automated decisions. Builders need: provenance for training data, model cards, risk assessments for high-risk uses. Compliance becomes a product feature — enterprise buyers ask for it before signing.",
        takeaway: "Treat compliance as a product axis, not a tax.",
              category: "news",
        addedAt: "2026-02-01",
}),
    ]),
    level(T, 10, "Boss: trends check", "Final gate.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: AI Trends",
        questions: [
          {
            type: "quickpick",
            prompt: "What's the smarter way to deploy reasoning models?",
            options: ["Use them for everything", "Route — fast for chat, reasoning for hard", "Avoid them", "Only for math"],
            answer: 1,
            explain: "Per-task routing wins on cost + quality.",
          },
          {
            type: "quickpick",
            prompt: "Where do agents fail most often in production?",
            options: ["Wide-open scope with weak supervision", "Narrow scoped with evals", "On weekends", "When using tools"],
            answer: 0,
            explain: "Scope creep + weak evals = stuck agents.",
          },
          {
            type: "quickpick",
            prompt: "Why care about being LLM-cited?",
            options: ["Vanity", "AI search shifts traffic from links to answers", "SEO trick", "It's free"],
            answer: 1,
            explain: "Citations are the new ranking.",
          },
        ],
      }),
    ]),
  ],
};
