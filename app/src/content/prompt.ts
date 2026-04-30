import { SEED_TOPICS } from "./index";
import type { TopicId } from "../types";

export interface PromptOpts {
  topicName: string;
  topicTagline: string;
  level: number;       // 1..10
  count: number;       // # of sparks to generate
  audience: string;    // free-text persona description
  customNote?: string; // additional instruction
}

/**
 * The single source of truth for the LearnAI content-generation
 * prompt.  Used both by `generateSparks` (when an API key is set) and by
 * the Admin Prompt Studio (so admins can paste it into Claude/ChatGPT
 * manually and copy the JSON back in).
 *
 * The output is intentionally long, opinionated, and self-contained —
 * the kind of prompt you'd want a frontier model to follow without
 * extra context.
 */
export function buildGenerationPrompt(opts: PromptOpts): string {
  const {
    topicName,
    topicTagline,
    level,
    count,
    audience,
    customNote,
  } = opts;

  const sample = SEED_TOPICS[0]?.levels?.[0]?.sparks?.find((s) => s.exercise.type === "microread");
  const sampleJson = sample
    ? JSON.stringify({ type: "microread", ...(sample.exercise as object) }, null, 2)
    : "";

  return `# LearnAI content generator

You are an expert AI educator + game designer producing micro-lessons for
**LearnAI**, a Duolingo-inspired learning app for active AI builders
and curious starters. Your output is consumed by code, not humans, so it
must be valid JSON exactly matching the schema below — no prose, no
markdown, no commentary.

## Mission

Generate ${count} bite-sized exercises ("Sparks") for the topic
"**${topicName}**" — ${topicTagline} — calibrated to **Level ${level}**
(scale 1=foundational → 10=frontier expert). The audience is:

> ${audience}

${customNote ? `Special instructions: ${customNote}\n\n` : ""}

## Voice & rules

- Plain English, concrete examples, opinionated takes. No filler.
- Write like a smart friend — never an academic.
- Avoid acronyms unless you define them on first use.
- Examples should reference real tools / labs / patterns from late 2025
  / 2026 (Anthropic Claude family, OpenAI GPT, Gemini, Llama, Mistral,
  pgvector, Cursor, Claude Code, etc.) when the level supports it.
- Lower levels: simpler analogies, fewer assumptions.
- Higher levels: tradeoffs, second-order effects, named systems.
- Never invent benchmarks or quotes you cannot defend.
- For Tips & Build Cards, prefer something the player can *do today*.

## Mix

Across the ${count} Sparks, balance the types. A typical good mix is:

- 1 MicroRead (the central concept).
- 1 Tip & Trick (one practical move).
- 1–2 assessment exercises (quickpick / fillstack / scenario / patternmatch).
- Optionally 1 Build Card if the level invites a hands-on try.

## Schema

Return EXACTLY this JSON shape, with no surrounding text:

\`\`\`
{
  "sparks": [
    /* one of the variants below per array element */
  ]
}
\`\`\`

### Variant: MicroRead

\`\`\`
{
  "type": "microread",
  "title": "<= 60 chars, punchy, action-oriented",
  "body": "60–120 words. Plain English. Concrete examples. End with a sharp insight.",
  "takeaway": "One sentence. The thing they remember in 2 weeks."
}
\`\`\`

### Variant: Tip & Trick

\`\`\`
{
  "type": "tip",
  "title": "💡 Tip & Trick",
  "body": "30–60 words. One specific, actionable move. Tell them exactly what to type / change / try."
}
\`\`\`

### Variant: Quick Pick (multiple choice)

\`\`\`
{
  "type": "quickpick",
  "prompt": "Question. Crisp.",
  "options": ["A", "B", "C", "D"],
  "answer": 1,                       // zero-based index of the correct option
  "explain": "1–2 sentences. Why the right answer is right + a common wrong belief it dispels."
}
\`\`\`

### Variant: Fill the Stack

\`\`\`
{
  "type": "fillstack",
  "prompt": "Sentence with ___ blank.",
  "options": ["foo", "bar", "baz", "qux"],
  "answer": 0,
  "explain": "1 sentence."
}
\`\`\`

### Variant: Field Scenario

\`\`\`
{
  "type": "scenario",
  "setup": "2–3 sentences. Specific situation. Real role / stakes.",
  "prompt": "What's the best move?",
  "options": ["A", "B", "C", "D"],
  "answer": 2,
  "explain": "1–2 sentences. Why this is best + the trap of the most-tempting wrong answer."
}
\`\`\`

### Variant: Pattern Match

\`\`\`
{
  "type": "patternmatch",
  "prompt": "Match each X to its Y",
  "pairs": [
    { "left": "concept-A", "right": "example-A" },
    { "left": "concept-B", "right": "example-B" },
    { "left": "concept-C", "right": "example-C" },
    { "left": "concept-D", "right": "example-D" }
  ],
  "explain": "1 sentence."
}
\`\`\`

### Variant: Build Card

\`\`\`
{
  "type": "buildcard",
  "title": "Build: <something tiny>",
  "pitch": "1 line. Why this is fun + sticky.",
  "promptToCopy": "An exact prompt the player will paste into Claude Code. Self-contained.",
  "successCriteria": "1 sentence. How they know it worked."
}
\`\`\`

## Reference Spark (for tone — do not copy verbatim)

\`\`\`json
${sampleJson}
\`\`\`

## Output

Return only the JSON object, with **no** \`\`\`json fences, no preamble,
no closing remarks. Just \`{ "sparks": [...] }\`. Validate it against the
schema before returning.
`;
}

/** Helper: list of all topic ids for the Prompt Studio dropdown. */
export function allTopicChoices(): { id: TopicId; name: string; tagline: string }[] {
  return SEED_TOPICS.map((t) => ({ id: t.id, name: t.name, tagline: t.tagline }));
}
