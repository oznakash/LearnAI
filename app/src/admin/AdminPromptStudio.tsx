import { useMemo, useState } from "react";
import { useAdmin } from "./AdminContext";
import type { PromptStudioState } from "./types";
import { allTopicChoices, buildGenerationPrompt } from "../content/prompt";
import type { Spark } from "../types";
import { generateSparks } from "../content/generate";

/**
 * Lets an admin assemble (and copy) the long content-generation prompt.
 *
 * - Without an API key: paste it into Claude / ChatGPT / etc. by hand,
 *   then paste the JSON response back here and it slots straight into
 *   `contentOverrides` for the chosen topic + level.
 * - With an API key (Anthropic or OpenAI, set in Settings): one click
 *   does the whole loop, validates, and inserts.
 */
export function AdminPromptStudio({ apiKey, apiProvider }: { apiKey?: string; apiProvider?: "anthropic" | "openai" }) {
  const { config, setConfig } = useAdmin();
  const studio = config.promptStudio;

  const choices = useMemo(() => allTopicChoices(), []);

  const set = (mutate: (cur: PromptStudioState) => PromptStudioState) =>
    setConfig((cfg) => ({ ...cfg, promptStudio: mutate(cfg.promptStudio) }));

  const prompt = useMemo(
    () =>
      buildGenerationPrompt({
        topicName: studio.topicName,
        topicTagline: studio.topicTagline,
        level: studio.level,
        count: studio.count,
        audience: studio.audience,
        customNote: studio.customNote,
      }),
    [studio]
  );

  const [pasted, setPasted] = useState("");
  const [parsed, setParsed] = useState<{ sparks: Spark[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {}
  };

  const tryParse = (text: string) => {
    setPasted(text);
    setError(null);
    setParsed(null);
    if (!text.trim()) return;
    let raw: unknown;
    try {
      // Tolerate code-fenced output.
      const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/, "")
        .replace(/```\s*$/, "");
      raw = JSON.parse(cleaned);
    } catch (e) {
      setError("Not valid JSON: " + (e as Error).message);
      return;
    }
    if (!raw || typeof raw !== "object" || !Array.isArray((raw as Record<string, unknown>).sparks)) {
      setError("Expected `{ \"sparks\": [...] }`.");
      return;
    }
    const sparks = (raw as { sparks: unknown[] }).sparks.map((sp, i) => {
      const ex = sp as Record<string, unknown>;
      return {
        id: `gen-${Date.now()}-${i}`,
        title: typeof ex.title === "string" ? (ex.title as string) : `Generated ${i + 1}`,
        exercise: ex as unknown as Spark["exercise"],
      } as Spark;
    });
    setParsed({ sparks });
  };

  const insertIntoTopic = () => {
    if (!parsed) return;
    const topicId = choices.find((c) => c.name === studio.topicName)?.id;
    if (!topicId) {
      setError("Pick a known topic to insert into.");
      return;
    }
    setConfig((cfg) => {
      const live =
        cfg.contentOverrides.topics[topicId] ??
        cfg.contentOverrides.extras.find((t) => t.id === topicId);
      const fallbackTopic = live ?? null;
      if (!fallbackTopic) return cfg;
      const targetLevel = fallbackTopic.levels.find((l) => l.index === studio.level);
      if (!targetLevel) return cfg;
      const nextLevels = fallbackTopic.levels.map((l) =>
        l.index === studio.level ? { ...l, sparks: [...l.sparks, ...parsed.sparks] } : l
      );
      return {
        ...cfg,
        contentOverrides: {
          ...cfg.contentOverrides,
          topics: {
            ...cfg.contentOverrides.topics,
            [topicId]: { ...fallbackTopic, levels: nextLevels },
          },
        },
      };
    });
    setPasted("");
    setParsed(null);
  };

  const apiCall = async () => {
    if (!apiKey) {
      setError("No API key. Add one in Settings or paste model output below.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sparks = await generateSparks({
        apiKey,
        provider: apiProvider ?? "anthropic",
        topicName: studio.topicName,
        topicTagline: studio.topicTagline,
        level: studio.level,
        audience: studio.audience,
        count: studio.count,
        customNote: studio.customNote,
      });
      if (sparks.length === 0) {
        setError("No valid sparks returned. Try again or paste the model output below.");
      } else {
        setParsed({ sparks });
      }
    } catch (e) {
      setError("Generation failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="h2">📝 Prompt Studio</h2>
        <p className="muted text-sm">
          Generate fresh content for any topic + level. With an API key you get one-click generation; without one you
          can copy the long prompt, paste it into Claude/ChatGPT/etc., and paste the JSON back here.
        </p>
      </header>

      <section className="card p-5 grid sm:grid-cols-2 gap-3">
        <div>
          <div className="label">Topic</div>
          <select
            className="input"
            value={studio.topicName}
            onChange={(e) => {
              const c = choices.find((x) => x.name === e.target.value);
              if (c) set((cur) => ({ ...cur, topicName: c.name, topicTagline: c.tagline }));
            }}
          >
            {choices.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="label">Level (1–10)</div>
          <input
            type="number"
            min={1}
            max={10}
            className="input tabular-nums"
            value={studio.level}
            onChange={(e) => set((cur) => ({ ...cur, level: Math.max(1, Math.min(10, Number(e.target.value) || 1)) }))}
          />
        </div>
        <div>
          <div className="label">Topic tagline (sent to model)</div>
          <input
            className="input"
            value={studio.topicTagline}
            onChange={(e) => set((cur) => ({ ...cur, topicTagline: e.target.value }))}
          />
        </div>
        <div>
          <div className="label">How many sparks</div>
          <input
            type="number"
            min={1}
            max={12}
            className="input tabular-nums"
            value={studio.count}
            onChange={(e) => set((cur) => ({ ...cur, count: Math.max(1, Math.min(12, Number(e.target.value) || 1)) }))}
          />
        </div>
        <div className="sm:col-span-2">
          <div className="label">Audience profile</div>
          <textarea
            className="input min-h-[64px]"
            value={studio.audience}
            onChange={(e) => set((cur) => ({ ...cur, audience: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <div className="label">Extra instructions (optional)</div>
          <textarea
            className="input min-h-[44px]"
            value={studio.customNote ?? ""}
            placeholder="e.g. Include at least one Build Card. Keep examples vendor-neutral."
            onChange={(e) => set((cur) => ({ ...cur, customNote: e.target.value }))}
          />
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display font-semibold text-white">The prompt</h3>
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" onClick={onCopy}>
              📋 Copy prompt
            </button>
            <button className="btn-primary text-sm" onClick={apiCall} disabled={!apiKey || busy}>
              {busy ? "Generating…" : `⚡ Generate via ${apiProvider ?? "Anthropic"}`}
            </button>
          </div>
        </div>
        <pre className="rounded-lg bg-black/50 border border-white/10 p-3 font-mono text-[11px] whitespace-pre-wrap max-h-[40vh] overflow-y-auto">
          {prompt}
        </pre>
        {!apiKey && (
          <p className="text-[11px] text-white/50">
            No API key set in Settings — that's fine. Copy the prompt, paste it into Claude / ChatGPT / Gemini, then
            paste the JSON response below.
          </p>
        )}
      </section>

      <section className="card p-5 space-y-3">
        <h3 className="font-display font-semibold text-white">Paste model output</h3>
        <textarea
          className="input font-mono text-[11px] min-h-[180px]"
          placeholder={`{\n  "sparks": [\n    { "type": "microread", "title": "...", "body": "...", "takeaway": "..." }\n  ]\n}`}
          value={pasted}
          onChange={(e) => tryParse(e.target.value)}
        />
        {error && <div className="text-bad text-xs">{error}</div>}
        {parsed && (
          <div className="space-y-2">
            <div className="text-good text-xs">✓ Parsed {parsed.sparks.length} valid spark{parsed.sparks.length === 1 ? "" : "s"}.</div>
            <button className="btn-primary text-sm" onClick={insertIntoTopic}>
              ➕ Append to {studio.topicName} L{studio.level}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
