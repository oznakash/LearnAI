import type { Spark } from "../types";
import { buildGenerationPrompt } from "./prompt";

interface GenerateOpts {
  apiKey: string;
  provider?: "anthropic" | "openai";
  topicName: string;
  topicTagline: string;
  level: number;
  audience: string;
  count?: number;
  customNote?: string;
}

/**
 * Calls the Anthropic or OpenAI Messages API to generate fresh Sparks
 * (a tip + a quickpick + a microread) for a given topic + level + audience.
 *
 * Returns sparks that match the Spark schema. Returns an empty array on failure.
 *
 * NOTE: this calls third-party APIs directly from the browser — for
 * production use you'd typically proxy through your own server. For a single-
 * user playground this is fine and avoids running a backend.
 */
export async function generateSparks({
  apiKey,
  provider = "anthropic",
  topicName,
  topicTagline,
  level,
  audience,
  count = 3,
  customNote,
}: GenerateOpts): Promise<Spark[]> {
  const sys = buildGenerationPrompt({
    topicName,
    topicTagline,
    level,
    count,
    audience,
    customNote,
  });

  const user = "Generate now.";
  let text = "";

  try {
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: sys,
          messages: [{ role: "user", content: user }],
        }),
      });
      const data = await r.json();
      text = data?.content?.[0]?.text ?? "";
    } else {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }),
      });
      const data = await r.json();
      text = data?.choices?.[0]?.message?.content ?? "";
    }
    const json = extractJson(text);
    const list = Array.isArray(json?.sparks) ? json.sparks : [];
    return list
      .map((raw, i) => {
        const ex = raw as Record<string, unknown>;
        const title = typeof ex.title === "string" ? (ex.title as string) : `Generated ${i + 1}`;
        return {
          id: `gen-${Date.now()}-${i}`,
          title,
          exercise: ex as unknown as Spark["exercise"],
        };
      })
      .filter((sp) => isValidSpark(sp));
  } catch (e) {
    console.warn("generateSparks failed", e);
    return [];
  }
}

function extractJson(text: string): { sparks?: unknown[] } | null {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function isValidSpark(sp: Spark): boolean {
  const ex = sp.exercise;
  if (!ex || !("type" in ex)) return false;
  switch (ex.type) {
    case "microread":
      return Boolean(ex.title && ex.body && ex.takeaway);
    case "tip":
      return Boolean(ex.title && ex.body);
    case "quickpick":
      return Boolean(
        ex.prompt && Array.isArray(ex.options) && ex.options.length >= 2 && typeof ex.answer === "number"
      );
    default:
      return false;
  }
}
