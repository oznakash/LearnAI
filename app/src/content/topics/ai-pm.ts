import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "ai-pm" as const;

export const aiPm: Topic = {
  id: T,
  name: "AI Product Management",
  emoji: "🎯",
  tagline: "Ship AI features users actually use and trust.",
  color: "#ffb547",
  visual: "compass",
  levels: [
    level(T, 1, "What an AI PM does differently", "Probabilistic ≠ deterministic.", 4, [
      spark("Specs in distributions", {
        type: "microread",
        title: "Specs become probabilistic",
        body: "Classic PM: 'when user clicks X, do Y.' AI PM: 'when user asks X, the answer should be helpful 95% of the time, never harmful, and cite sources when it's a fact.' You write specs in target distributions, not guarantees. You ship evals, not just designs. You measure quality continuously, not at QA only.",
        takeaway: "AI PM = specs as distributions, evals as guardrails.",
        visual: "compass",
        category: "principle",
        addedAt: "2025-10-01",
        vocab: [
          { term: "evals", definition: "A scored test set you run on every release of an AI feature. Each row is an input + the criteria a 'good answer' must meet. Replaces 'does it click X' with 'does it score above the bar on 50 hard cases.'" },
          { term: "target distributions", definition: "Instead of a single 'this must work,' you state the *distribution* of acceptable outcomes: helpful 95% of the time, harmful 0% of the time, factual when it's a fact. AI PMs ship distributions; classic PMs shipped binary specs." },
        ],
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Replace 'must always work' in your specs with 'must work in 95% of these 50 cases'. Forces you to write the eval set up-front.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "Best success metric for an AI summarizer feature?",
        options: ["LOC of code", "User retention + thumbs-up rate + factual accuracy on eval set", "API latency only", "Number of features"],
        answer: 1,
        explain: "Quality + usage + correctness, not just one.",
      }),
      spark("PM and engineer collapse into builder", {
        type: "podcastnugget",
        creatorId: "lenny",
        quote:
          "By the end of the year everyone is going to be a product manager, and everyone codes. The title software engineer is going to start to go away. It's just going to be replaced by builder.",
        takeaway:
          "The roles aren't disappearing — they're collapsing into one. The premium goes to people who can think and ship in the same hour.",
        source: {
          podcast: "Lenny's Podcast",
          podcastUrl: "https://www.lennysnewsletter.com/podcast",
          guest: "Boris Cherny",
          guestRole: "head of Claude Code, Anthropic",
          episodeTitle: "How Claude Code rewrites the job of an engineer",
          timestamp: "00:00:44",
        },
        ctaPrompt:
          "Write your next project description from a builder's voice, not a PM's. State the user, the unmet need, and what 'done' looks like — in under 100 words.",
      }),
    ]),
    level(T, 2, "Picking the right problem", "Where AI is unfair advantage.", 4, [
      spark("Repeat + boring + judgment", {
        type: "microread",
        title: "Where AI wins big",
        body: "AI works best where work is repetitive, requires light judgment, and humans hate doing it. Inbox triage. Spec drafting. Code review nudges. Image moderation. It works terribly where stakes are extreme, edge cases dominate, or the user wants control. Don't pick AI to be cool — pick it where humans burn out and tolerance for 90% accuracy is high.",
        takeaway: "Boring + repeated + 90%-good-enough = AI gold.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Pattern match", {
        type: "patternmatch",
        prompt: "Match each task to its AI fit",
        pairs: [
          { left: "Drafting marketing emails", right: "Strong fit" },
          { left: "Final medical diagnosis", right: "Weak fit" },
          { left: "Auto-tagging support tickets", right: "Strong fit" },
          { left: "Approving million-dollar wires", right: "Weak fit" },
        ],
        explain: "Stakes + tolerance for error decide it.",
      }),
      spark("Sometimes it's positioning, not the product", {
        type: "podcastnugget",
        creatorId: "lenny",
        quote:
          "If your product isn't doing well, there's a chance that it may not be the product that's the problem — it may be your positioning.",
        takeaway:
          "Before you rebuild the feature, rewrite the sentence. 'What is this and who is it for?' — answered in one line, in the prospect's words — is a higher-leverage edit than three sprints of new code.",
        source: {
          podcast: "Lenny's Podcast",
          podcastUrl: "https://www.lennysnewsletter.com/podcast",
          guest: "April Dunford",
          guestRole: "author of Obviously Awesome",
          episodeTitle: "Why positioning is your highest-leverage PM lever",
          timestamp: "00:00:00",
        },
        ctaPrompt:
          "Write your product's one-sentence positioning today. Then ask three users to tell you what your product is. Compare. The gap is your homework.",
      }),
    ]),
    level(T, 3, "UX patterns for AI", "Design for uncertainty.", 5, [
      spark("Show the seams", {
        type: "microread",
        title: "Confidence + control",
        body: "Best AI UX shows the seams: cite sources, show confidence, let users edit/regenerate, never auto-commit irreversible actions. Hide the AI? Users feel tricked. Over-explain? They tune out. Sweet spot: visible AI suggestions + easy human override + a clear undo. Look at GitHub Copilot ghost text or Notion AI: opt-in, easy to dismiss, easy to accept.",
        takeaway: "Confident-but-correctable. Always.",
        bodyByAgeBand: {
          kid: "Good AI shows its work and lets you fix it. If an AI is hidden, it feels sneaky. If it explains everything for ten lines, you stop reading. The sweet spot: the AI suggests something, you can clearly see it's a suggestion, and one tap accepts or changes it. Like a friend whispering an idea instead of grabbing the pencil out of your hand.",
          teen: "The best AI features show the seams. They cite where an answer came from, signal how sure they are, and always let you edit or undo. Hidden AI feels sneaky; over-explained AI gets tuned out. The pattern that works: a visible suggestion + a clear way to accept it + an obvious way to change or reject it. Think autocomplete you can dismiss, not autopilot you can't.",
        },
        category: "pattern",
        addedAt: "2025-10-01",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Add a 'why' button next to AI outputs. 'Because document X said Y on date Z.' Builds trust faster than any UI polish.",
        category: "pattern",
        addedAt: "2025-10-01",
      }),
      spark("Scenario", {
        type: "scenario",
        setup: "Your AI categorizes user expenses. Sometimes it's wrong.",
        prompt: "Best UX?",
        options: [
          "Auto-categorize silently, no UI",
          "Show category as a chip with one-tap edit",
          "Email the user every wrong guess",
          "Disable until 100% accurate",
        ],
        answer: 1,
        explain: "Visible + correctable. The 5-second fix beats a buried setting.",
      }),
    ]),
    level(T, 4, "Pricing AI features", "Tokens cost money.", 4, [
      spark("Margin awareness", {
        type: "microread",
        title: "Inference cost vs price",
        body: "Unlike most software, AI features have non-zero marginal cost. A 'free unlimited' AI feature can bankrupt you. Build cost dashboards from day one. Track tokens per user per day. Cap heavy users. Push the most expensive workflows to higher pricing tiers. Many AI products fail not on quality but unit economics.",
        takeaway: "Track inference $/user. Caps and tiers from day one.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "Most important early metric for an AI feature's economics?",
        options: ["Brand mentions", "Tokens per active user per day", "DAU/MAU only", "Star rating"],
        answer: 1,
        explain: "Cost per user predicts whether the unit economics work.",
      }),
    ]),
    level(T, 5, "Evals as a PM artifact", "PMs own evals now.", 4, [
      spark("Curate the cases", {
        type: "microread",
        title: "PMs write the evals",
        body: "The PM owns the 'what good looks like' set. You hand-curate edge cases from real user logs, define rubric (1-5 scores), and update the set monthly. Engineers wire them to CI. Without you, they default to 'looks good in dev' — and you'll ship regressions. With you, every prompt change is measurable.",
        takeaway: "Eval set = your spec. Own it like you own roadmap.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Weekly: copy 5 surprising user logs into your eval set. Within 3 months you'll have 60 hard cases that catch 80% of regressions.",
        category: "pattern",
        addedAt: "2025-10-01",
      }),
    ]),
    level(T, 6, "User trust loops", "Earn it slowly, lose it fast.", 4, [
      spark("Trust is asymmetric", {
        type: "microread",
        title: "One failure undoes ten wins",
        body: "AI features feel magical until they confidently mislead once. From that moment users discount everything. So: ship boring-but-reliable before flashy-but-fragile. Add 'sources' UI, conservative refusal language ('I don't have that info'), and easy human escape hatches. Trust compounds. So does distrust.",
        takeaway: "Underpromise. Overdeliver. Sources visible.",
        bodyByAgeBand: {
          kid: "Trust with AI works the same as trust with a friend who tells stories. Ten cool true stories make you believe them. One confident lie, and you start checking everything they say. So good AI tools play it safe: they say 'I don't know' a lot, they show where they got their info, and they make it easy to fix mistakes. Boring and reliable beats flashy and wrong.",
          teen: "AI feels magical right up until it confidently misleads you once. From that moment, you discount every answer it gives — even the right ones. So the smartest move is shipping boring-but-reliable before flashy-but-fragile. Show sources. Use cautious language ('I don't have that info'). Make it easy to ask a human. Trust compounds with every quiet correct answer; one loud wrong one resets the count.",
        },
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("The Challenger disaster of AI", {
        type: "podcastnugget",
        creatorId: "lenny",
        quote:
          "Lots of people knew those little O-rings were unreliable, but every single time you get away with launching a space shuttle without the O-rings failing, you institutionally feel more confident in what you're doing. We've been using these systems in increasingly unsafe ways. My prediction is we're going to see a Challenger disaster.",
        takeaway:
          "Ship velocity is masking risk. Treat each AI agent run as if the worst-case prompt-injection has already happened — because the day it does, 'we always did it this way' won't save you.",
        source: {
          podcast: "Lenny's Podcast",
          podcastUrl: "https://www.lennysnewsletter.com/podcast",
          guest: "Simon Willison",
          guestRole: "co-creator of Django, coined 'prompt injection'",
          episodeTitle: "The November inflection: AI coding crosses the threshold",
          timestamp: "00:01:08",
        },
      }),
    ]),
    level(T, 7, "Roadmapping AI products", "Capabilities ladder.", 4, [
      spark("Crawl-walk-run", {
        type: "microread",
        title: "From assistive → autonomous",
        body: "Roadmap AI features along an autonomy ladder: (1) suggest, human accepts, (2) draft, human reviews, (3) act, human can undo, (4) act autonomously, audit log only. Each step requires more eval depth, more guardrails, more trust. Most successful AI products live at level 1-2 for years before earning level 3.",
        takeaway: "Move down the ladder by earning trust, not by shipping faster.",
        category: "pattern",
        addedAt: "2025-10-01",
      }),
      spark("Pattern match", {
        type: "patternmatch",
        prompt: "Match the autonomy level",
        pairs: [
          { left: "Copilot ghost text suggestions", right: "Suggest" },
          { left: "Background agent fixing typos in PRs", right: "Act + undoable" },
          { left: "Drafting an email for review", right: "Draft" },
          { left: "Self-healing infra responder", right: "Autonomous + audited" },
        ],
        explain: "Each step = more autonomy, more guardrails.",
      }),
      spark("AI raises ambition, not free time", {
        type: "podcastnugget",
        creatorId: "lenny",
        quote:
          "AI's supposed to make us more productive. It feels like the people that are most AI-pilled are working harder than they've ever worked. I can fire up four agents in parallel and have them work on four different problems. By 11am, I am wiped out.",
        takeaway:
          "AI doesn't reduce hours — it raises ambition. The right comparison isn't 'less work' vs. 'same work.' It's 'the project I'd never have attempted' vs. 'the project I would've taken three months on.'",
        source: {
          podcast: "Lenny's Podcast",
          podcastUrl: "https://www.lennysnewsletter.com/podcast",
          guest: "Simon Willison",
          guestRole: "co-creator of Django, coined 'prompt injection'",
          episodeTitle: "The November inflection: AI coding crosses the threshold",
          timestamp: "00:00:43",
        },
      }),
    ]),
    level(T, 8, "Measuring AI quality", "Beyond accuracy.", 4, [
      spark("Multi-axis quality", {
        type: "microread",
        title: "Five axes of quality",
        body: "Don't reduce AI quality to 'accuracy'. Track (1) correctness, (2) helpfulness, (3) safety, (4) latency, (5) cost. Score each on every release. Trade-offs are normal — a faster model may lose 2 points correctness. Show the trade-off explicitly so leadership can pick.",
        takeaway: "Quality is a 5D shape. Show all axes.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Make a single 'AI Quality Radar' chart in your weekly review. 5 axes, before/after each release. Forces honest trade-off conversations.",
        category: "pattern",
        addedAt: "2025-10-01",
      }),
    ]),
    level(T, 9, "AI feedback loops", "User feedback → better model.", 4, [
      spark("Closed loops win", {
        type: "microread",
        title: "Build the data flywheel",
        body: "Every thumbs-up/down, every regenerate, every edit is gold. Capture it tagged with the prompt and output. Over months you build a labeled dataset that powers fine-tunes, eval sets, and prompt tuning. Products with feedback loops compound; products without plateau.",
        takeaway: "Capture every signal. Compound monthly.",
        category: "principle",
        addedAt: "2025-10-01",
      }),
    ]),
    level(T, 10, "Boss: AI PM check", "Final boss.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: AI PM",
        questions: [
          {
            type: "quickpick",
            prompt: "Most underrated PM artifact for AI features?",
            options: ["Press release", "Eval set", "Pitch deck", "OKR doc"],
            answer: 1,
            explain: "Evals are your spec.",
          },
          {
            type: "quickpick",
            prompt: "User asks for autonomous expense booking. Right roadmap step?",
            options: ["Ship full autopilot day 1", "Start with suggest + 1-tap accept, climb the ladder", "Manual only forever", "Auto-book + email if wrong"],
            answer: 1,
            explain: "Autonomy is earned by trust + evals.",
          },
          {
            type: "quickpick",
            prompt: "Best signal that an AI feature is sustainable?",
            options: ["High API calls", "Cost per user trends down or stable as usage grows", "Lots of integrations", "PR mentions"],
            answer: 1,
            explain: "Unit economics, always.",
          },
        ],
      }),
    ]),
  ],
};
