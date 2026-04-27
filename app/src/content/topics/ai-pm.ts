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
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Replace 'must always work' in your specs with 'must work in 95% of these 50 cases'. Forces you to write the eval set up-front.",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "Best success metric for an AI summarizer feature?",
        options: ["LOC of code", "User retention + thumbs-up rate + factual accuracy on eval set", "API latency only", "Number of features"],
        answer: 1,
        explain: "Quality + usage + correctness, not just one.",
      }),
    ]),
    level(T, 2, "Picking the right problem", "Where AI is unfair advantage.", 4, [
      spark("Repeat + boring + judgment", {
        type: "microread",
        title: "Where AI wins big",
        body: "AI works best where work is repetitive, requires light judgment, and humans hate doing it. Inbox triage. Spec drafting. Code review nudges. Image moderation. It works terribly where stakes are extreme, edge cases dominate, or the user wants control. Don't pick AI to be cool — pick it where humans burn out and tolerance for 90% accuracy is high.",
        takeaway: "Boring + repeated + 90%-good-enough = AI gold.",
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
    ]),
    level(T, 3, "UX patterns for AI", "Design for uncertainty.", 5, [
      spark("Show the seams", {
        type: "microread",
        title: "Confidence + control",
        body: "Best AI UX shows the seams: cite sources, show confidence, let users edit/regenerate, never auto-commit irreversible actions. Hide the AI? Users feel tricked. Over-explain? They tune out. Sweet spot: visible AI suggestions + easy human override + a clear undo. Look at GitHub Copilot ghost text or Notion AI: opt-in, easy to dismiss, easy to accept.",
        takeaway: "Confident-but-correctable. Always.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Add a 'why' button next to AI outputs. 'Because document X said Y on date Z.' Builds trust faster than any UI polish.",
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
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Weekly: copy 5 surprising user logs into your eval set. Within 3 months you'll have 60 hard cases that catch 80% of regressions.",
      }),
    ]),
    level(T, 6, "User trust loops", "Earn it slowly, lose it fast.", 4, [
      spark("Trust is asymmetric", {
        type: "microread",
        title: "One failure undoes ten wins",
        body: "AI features feel magical until they confidently mislead once. From that moment users discount everything. So: ship boring-but-reliable before flashy-but-fragile. Add 'sources' UI, conservative refusal language ('I don't have that info'), and easy human escape hatches. Trust compounds. So does distrust.",
        takeaway: "Underpromise. Overdeliver. Sources visible.",
      }),
    ]),
    level(T, 7, "Roadmapping AI products", "Capabilities ladder.", 4, [
      spark("Crawl-walk-run", {
        type: "microread",
        title: "From assistive → autonomous",
        body: "Roadmap AI features along an autonomy ladder: (1) suggest, human accepts, (2) draft, human reviews, (3) act, human can undo, (4) act autonomously, audit log only. Each step requires more eval depth, more guardrails, more trust. Most successful AI products live at level 1-2 for years before earning level 3.",
        takeaway: "Move down the ladder by earning trust, not by shipping faster.",
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
    ]),
    level(T, 8, "Measuring AI quality", "Beyond accuracy.", 4, [
      spark("Multi-axis quality", {
        type: "microread",
        title: "Five axes of quality",
        body: "Don't reduce AI quality to 'accuracy'. Track (1) correctness, (2) helpfulness, (3) safety, (4) latency, (5) cost. Score each on every release. Trade-offs are normal — a faster model may lose 2 points correctness. Show the trade-off explicitly so leadership can pick.",
        takeaway: "Quality is a 5D shape. Show all axes.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Make a single 'AI Quality Radar' chart in your weekly review. 5 axes, before/after each release. Forces honest trade-off conversations.",
      }),
    ]),
    level(T, 9, "AI feedback loops", "User feedback → better model.", 4, [
      spark("Closed loops win", {
        type: "microread",
        title: "Build the data flywheel",
        body: "Every thumbs-up/down, every regenerate, every edit is gold. Capture it tagged with the prompt and output. Over months you build a labeled dataset that powers fine-tunes, eval sets, and prompt tuning. Products with feedback loops compound; products without plateau.",
        takeaway: "Capture every signal. Compound monthly.",
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
