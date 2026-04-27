import type { Topic } from "../../types";
import { level, spark } from "../helpers";

const T = "ai-devtools" as const;

export const aiDevtools: Topic = {
  id: T,
  name: "AI Dev Tools",
  emoji: "⚙️",
  tagline: "Claude Code, Cursor, Copilot, agentic IDEs.",
  color: "#28e0b3",
  visual: "build",
  levels: [
    level(T, 1, "The new IDE wave", "AI inside your editor.", 4, [
      spark("Three flavors", {
        type: "microread",
        title: "Suggest, chat, agent",
        body: "AI dev tools come in three flavors: (1) Suggest — inline ghost text (Copilot, Cursor Tab). (2) Chat — a side panel for back-and-forth (Cursor Chat, JetBrains AI). (3) Agent — autonomous, multi-file edits (Claude Code, Cursor Agent, Devin). Each fits a different brain mode. The best teams mix all three across the day.",
        takeaway: "Suggest for typing. Chat for thinking. Agent for grunt work.",
      }),
      spark("Pattern match", {
        type: "patternmatch",
        prompt: "Match each task to the best mode",
        pairs: [
          { left: "Refactor across 12 files", right: "Agent" },
          { left: "Finish a tedious utility function", right: "Suggest" },
          { left: "Debug a confusing error", right: "Chat" },
          { left: "Migrate to a new API", right: "Agent" },
        ],
        explain: "Match the tool to the mental gear.",
      }),
    ]),
    level(T, 2, "Claude Code mental model", "Briefing an autonomous teammate.", 4, [
      spark("Brief, run, verify", {
        type: "microread",
        title: "How Claude Code thinks",
        body: "Claude Code is an agent: it reads files, runs commands, edits code, asks for permission on risky things. Best results come from clear briefs ('we're trying to X, here's a relevant file'), small diffs ('add only the function, no refactors'), and active verification ('run the test, show me output'). Treat it like a sharp pair partner, not an oracle.",
        takeaway: "Brief tightly. Verify often. Small diffs.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Add a CLAUDE.md to your repo with the project's conventions. Claude Code reads it on startup and follows your house style without you repeating yourself.",
      }),
      spark("Build it", {
        type: "buildcard",
        title: "Build: tiny utility with Claude Code",
        pitch: "5 min. Get a feel for the loop.",
        promptToCopy:
          "Add a small Python script `scripts/word_count.py` that reads stdin and prints word count + char count + estimated tokens (chars/4). Add a unit test with pytest. Run the test.",
        successCriteria: "Script + green test, no manual fixes from you.",
      }),
    ]),
    level(T, 3, "Cursor & friends", "When to use what.", 4, [
      spark("Editor wars", {
        type: "microread",
        title: "Quick comparison",
        body: "Cursor: VS Code fork with deep AI (Tab completion, Composer for multi-file). Windsurf (Codeium): similar territory, strong autocomplete. JetBrains AI: native to IntelliJ family. Claude Code: terminal-first, agent-strong. GitHub Copilot: ubiquitous, integrates everywhere. Try 2-3 in a real workflow before committing — your taste matters more than reviews.",
        takeaway: "Try a few. Pick what fits your flow.",
      }),
    ]),
    level(T, 4, "Vibe coding vs spec coding", "When to lean which way.", 4, [
      spark("Two modes", {
        type: "microread",
        title: "Vibe vs spec",
        body: "Vibe coding: 'just make it work', iterate by feel — great for prototypes, throwaways, exploration. Spec coding: write the contract first (types, tests, docstrings), let AI fill the body — great for production, libraries, maintained systems. Mixing them blindly creates messes. Pick mode per task.",
        takeaway: "Vibe to explore. Spec to ship.",
      }),
    ]),
    level(T, 5, "Tests as the AI's compass", "TDD finally easy.", 4, [
      spark("AI loves tests", {
        type: "microread",
        title: "Tests = clarity for the AI",
        body: "Tests give the AI an unambiguous signal: pass or fail. Write the test first, hand it to the agent, let it iterate against red. AI burnout? Bad tests. AI shipping clean code? Good tests. TDD never had a more natural partner.",
        takeaway: "Test-first. AI iterates faster than you ever could.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "When the AI gets stuck, don't help directly — write one more test that exposes the bug. The AI will fix it itself.",
      }),
    ]),
    level(T, 6, "Code review with AI", "Faster, fairer, deeper.", 4, [
      spark("Pre-PR scan", {
        type: "microread",
        title: "AI review = first pass",
        body: "Run AI review on your diff before opening the PR. Most catch typos, missing error handling, security smells, weak tests. Saves humans from boring nits and lets them focus on architecture/intent. Tools: GitHub Copilot Review, CodeRabbit, custom Claude Code workflows.",
        takeaway: "AI does the boring review. Humans do the hard.",
      }),
    ]),
    level(T, 7, "MCP servers & extensions", "Plug AI into your tools.", 4, [
      spark("Model Context Protocol", {
        type: "microread",
        title: "What MCP unlocks",
        body: "MCP (Model Context Protocol) is an open standard for plugging tools into AI clients. Build once, work in Claude Code, Cursor, others. Common MCPs: Postgres, GitHub, Linear, Slack, filesystem, browser. Building one is ~50 lines. Suddenly your agent can query prod, file tickets, send messages.",
        takeaway: "MCP = USB-C for AI tools.",
      }),
      spark("Tip & Trick", {
        type: "tip",
        title: "💡 Tip & Trick",
        body: "Build a tiny MCP server for your team's internal docs/wiki. Suddenly Claude Code can answer 'where do we store user emails' from your real source of truth.",
      }),
    ]),
    level(T, 8, "Agent feedback loops", "Watch and adjust.", 4, [
      spark("Don't go silent", {
        type: "microread",
        title: "Stay in the loop",
        body: "Agents drift. After every agent run: skim the diff, run the tests, check the changed-files list. If it touched things you didn't expect, ask why. Catching drift early is the difference between '10x faster' and 'broken codebase by Friday'.",
        takeaway: "Skim every diff. Trust slowly.",
      }),
    ]),
    level(T, 9, "Prompt files & templates", "Reusable AI context.", 4, [
      spark("Promptbooks", {
        type: "microread",
        title: "Make your prompts reusable",
        body: "If you keep typing the same brief ('refactor X but keep API stable'), put it in a prompt file. Cursor has .cursorrules, Claude Code has CLAUDE.md and slash-commands. Treat prompts like code — version, share, refine across the team. The team that systematizes prompts ships 2x.",
        takeaway: "Promptbook your repo. Share across team.",
      }),
    ]),
    level(T, 10, "Boss: dev tools check", "Final gate.", 6, [
      spark("Boss Cell", {
        type: "boss",
        title: "Boss: AI Dev Tools",
        questions: [
          {
            type: "quickpick",
            prompt: "Most reliable way to make Claude Code follow your house style?",
            options: ["Repeat in every prompt", "Commit a CLAUDE.md", "Yelling caps", "Switch to Cursor"],
            answer: 1,
            explain: "CLAUDE.md is read on startup.",
          },
          {
            type: "quickpick",
            prompt: "Agent is stuck on a bug. Best move?",
            options: ["Take over manually", "Write one more test that fails on the bug", "Restart agent", "Switch model"],
            answer: 1,
            explain: "Tests are the agent's compass.",
          },
          {
            type: "quickpick",
            prompt: "Best use of MCP?",
            options: ["Replace VS Code", "Plug your team's data sources into AI clients", "Train models", "Speed up CI"],
            answer: 1,
            explain: "MCP = standardized tool surface.",
          },
        ],
      }),
    ]),
  ],
};
