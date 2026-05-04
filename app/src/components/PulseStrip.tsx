import { useState } from "react";
import type { PulseItem } from "../admin/types";
import { pulseFreshness } from "../store/pulse";
import { TOPICS } from "../content";
import { useMemory } from "../memory/MemoryContext";
import type { TopicId } from "../types";

/**
 * "Today in AI" Pulse strip.
 *
 * 1-line trend headlines, with a "Zoom in" affordance that expands a 2-3
 * line body, optional source credit, freshness chip, and a deep-link
 * CTA into the most-relevant Constellation. Tapping the CTA writes a
 * `preference` memory ("interested in <headline>") so the cognition
 * layer can pick this up next session.
 *
 * The strip is intentionally calm: small, single-row, easy to ignore.
 * The whole point of LearnAI is that the user has a 5-minute habit; the
 * pulse is glanceable, not engagement-bait.
 *
 * Pure rendering — no network. The items come from admin config; the
 * SPA's "works without backend" contract holds.
 */
export function PulseStrip({
  items,
  onOpenTopic,
}: {
  items: readonly PulseItem[];
  onOpenTopic: (topicId: TopicId) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { remember } = useMemory();

  if (!items?.length) return null;

  const visible = items.slice(0, 6);

  const handleOpen = (item: PulseItem) => {
    if (!item.topicId) return;
    void remember({
      text: `Pulse interest: ${item.headline}`,
      category: "preference",
      metadata: { source: "pulse", pulseId: item.id, topicId: item.topicId },
    });
    onOpenTopic(item.topicId);
  };

  return (
    <section
      aria-label="Today in AI"
      className="card p-4 sm:p-5 border border-accent2/30 bg-accent2/5 relative overflow-hidden"
    >
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-accent2 font-semibold">
            Today in AI
          </div>
          <div className="font-display font-semibold text-white text-base leading-tight">
            What's hot — tap a card to zoom in.
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {visible.map((item) => {
          const isOpen = openId === item.id;
          const fresh = pulseFreshness(item.addedAt);
          const topic = item.topicId ? TOPICS.find((t) => t.id === item.topicId) : undefined;
          return (
            <div
              key={item.id}
              data-testid={`pulse-card-${item.id}`}
              className={`rounded-xl border transition ${
                isOpen ? "border-accent2/60 bg-accent2/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`pulse-body-${item.id}`}
                onClick={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
                className="w-full text-left p-3 flex items-start gap-3"
              >
                <div className="text-xl">⚡</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm leading-snug">
                    {item.headline}
                  </div>
                  <div className="text-[11px] text-white/50 mt-0.5 flex items-center gap-2">
                    <span
                      className={
                        fresh.tone === "fresh"
                          ? "text-accent2"
                          : fresh.tone === "stale"
                            ? "text-white/40"
                            : "text-white/60"
                      }
                    >
                      📅 {fresh.label}
                    </span>
                    {topic && (
                      <span className="text-white/40">· {topic.emoji} {topic.name}</span>
                    )}
                  </div>
                </div>
                <div className="text-white/50 text-sm shrink-0">
                  {isOpen ? "▴ Hide" : "▾ Zoom in"}
                </div>
              </button>
              {isOpen && (
                <div id={`pulse-body-${item.id}`} className="px-3 pb-3 -mt-1">
                  <div className="text-sm text-white/80 leading-snug">{item.body}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {item.topicId && topic && (
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        onClick={() => handleOpen(item)}
                      >
                        ▶ Start a Spark on this
                      </button>
                    )}
                    {item.source && (
                      <a
                        href={item.source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="btn-ghost text-xs"
                      >
                        🔗 via {item.source.name}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
