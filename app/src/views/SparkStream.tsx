import { useEffect, useMemo, useState } from "react";
import { useSocial } from "../social/SocialContext";
import { useAdmin } from "../admin/AdminContext";
import { getTopic, TOPICS } from "../content";
import { Mascot } from "../visuals/Mascot";
import type { StreamCardKind } from "../social/types";
import type { TopicId, GuildTier } from "../types";
import type { View } from "../App";

/**
 * Spark Stream — the explore feed. Auto-derived cards (level-up,
 * boss-beaten, streak-milestone, spotlight) from people the player
 * follows or shares Signals with.
 *
 * Per the engineering plan: ranking is admin-tunable but has no
 * engagement-feedback term. We do not ship likes / reactions / comments
 * / DMs in MVP.
 *
 * Backed by `social.getStream()`. Offline mode returns []; we fold in a
 * deterministic mock cohort so a fresh install still feels alive.
 */

interface Props {
  onNav: (v: View) => void;
}

interface DisplayCard {
  id: string;
  authorHandle: string;
  authorDisplay: string;
  authorPicture?: string;
  authorTier: GuildTier;
  topicId?: TopicId;
  topicName?: string;
  level?: number;
  kind: StreamCardKind;
  detail?: Record<string, unknown>;
  createdAt: number;
  iAmFollowing: boolean;
  iCanFollow: boolean;
  isMock: boolean;
}

const HOUR = 60 * 60 * 1000;

const MOCK_TEMPLATES: Array<{
  authorHandle: string;
  authorDisplay: string;
  authorTier: GuildTier;
  topicId: TopicId;
  level?: number;
  kind: StreamCardKind;
  detail?: Record<string, unknown>;
  hoursAgo: number;
}> = [
  { authorHandle: "ada", authorDisplay: "Ada", authorTier: "Architect", topicId: "ai-builder", level: 7, kind: "level_up", hoursAgo: 1 },
  { authorHandle: "marcus", authorDisplay: "Marcus", authorTier: "Architect", topicId: "ai-pm", level: 5, kind: "level_up", hoursAgo: 3 },
  { authorHandle: "priya", authorDisplay: "Priya", authorTier: "Visionary", topicId: "memory-safety", level: 8, kind: "boss_beaten", detail: { score: 5, of: 6 }, hoursAgo: 5 },
  { authorHandle: "diego", authorDisplay: "Diego", authorTier: "Builder", topicId: "ai-foundations", level: 2, kind: "level_up", hoursAgo: 7 },
  { authorHandle: "yuki", authorDisplay: "Yuki", authorTier: "Architect", topicId: "ai-trends", kind: "streak_milestone", detail: { streak: 30 }, hoursAgo: 11 },
  { authorHandle: "sam", authorDisplay: "Sam", authorTier: "Builder", topicId: "ai-builder", level: 3, kind: "spotlight", hoursAgo: 14 },
  { authorHandle: "ada", authorDisplay: "Ada", authorTier: "Architect", topicId: "ai-pm", level: 6, kind: "boss_beaten", detail: { score: 6, of: 6 }, hoursAgo: 22 },
  { authorHandle: "rae", authorDisplay: "Rae", authorTier: "Builder", topicId: "open-source", kind: "streak_milestone", detail: { streak: 7 }, hoursAgo: 30 },
];

function makeMockCards(now: number, mascotName: string): DisplayCard[] {
  return MOCK_TEMPLATES.map((m, i) => ({
    id: `mock-${i}`,
    authorHandle: m.authorHandle,
    authorDisplay:
      m.authorHandle === "mascotBot" ? `${mascotName} Bot` : m.authorDisplay,
    authorTier: m.authorTier,
    topicId: m.topicId,
    topicName: getTopic(m.topicId)?.name,
    level: m.level,
    kind: m.kind,
    detail: m.detail,
    createdAt: now - m.hoursAgo * HOUR,
    iAmFollowing: false,
    iCanFollow: true,
    isMock: true,
  }));
}

export function SparkStream({ onNav }: Props) {
  const { config } = useAdmin();
  const social = useSocial();
  const [cards, setCards] = useState<DisplayCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFollowingOnly, setFilterFollowingOnly] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const real = await social.getStream({ limit: 50 });
    const realDisplay: DisplayCard[] = real.map((c) => ({
      id: c.id,
      authorHandle: c.authorHandle,
      authorDisplay: c.authorDisplay,
      authorPicture: c.authorPicture,
      authorTier: c.authorTier,
      topicId: c.topicId,
      topicName: c.topicName,
      level: c.level,
      kind: c.kind,
      detail: c.detail,
      createdAt: c.createdAt,
      iAmFollowing: c.iAmFollowing,
      iCanFollow: c.iCanFollow,
      isMock: false,
    }));
    const mock = realDisplay.length === 0
      ? makeMockCards(Date.now(), config.branding.mascotName)
      : [];
    setCards([...realDisplay, ...mock].sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [social.service]);

  const filtered = useMemo(() => {
    if (!filterFollowingOnly) return cards;
    return cards.filter((c) => c.iAmFollowing);
  }, [cards, filterFollowingOnly]);

  const onFollow = async (handle: string) => {
    await social.follow(handle);
    setCards((prev) =>
      prev.map((c) => (c.authorHandle === handle ? { ...c, iAmFollowing: true } : c)),
    );
  };

  const onMute = async (handle: string) => {
    // Hide author cards from this view session immediately.
    setCards((prev) => prev.filter((c) => c.authorHandle !== handle));
    await social.setMuted(handle, true);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="h1">Spark Stream</h1>
          <p className="muted text-sm">
            Fresh activity from people in your network. New levels, boss takedowns, streak milestones.
          </p>
        </div>
        <button
          className="btn-ghost text-xs"
          onClick={refresh}
          title="Refresh"
        >
          ↻ Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={!filterFollowingOnly}
          onClick={() => setFilterFollowingOnly(false)}
        >
          🌊 All
        </FilterChip>
        <FilterChip
          active={filterFollowingOnly}
          onClick={() => setFilterFollowingOnly(true)}
        >
          ✓ Only people I follow
        </FilterChip>
      </div>

      {loading ? (
        <p className="text-xs text-white/50">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState followingOnly={filterFollowingOnly} onNav={onNav} />
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <StreamCardItem
                card={c}
                onNav={onNav}
                onFollow={onFollow}
                onMute={onMute}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -- Components ---------------------------------------------------------

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
        active
          ? "bg-accent text-white"
          : "bg-white/5 text-white/60 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function StreamCardItem({
  card,
  onNav,
  onFollow,
  onMute,
}: {
  card: DisplayCard;
  onNav: (v: View) => void;
  onFollow: (handle: string) => Promise<void>;
  onMute: (handle: string) => Promise<void>;
}) {
  const t = card.topicId ? getTopic(card.topicId) : null;
  const initials = card.authorDisplay
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const headline = useMemo(() => {
    switch (card.kind) {
      case "level_up":
        return `🚀 reached Level ${card.level} in ${t?.name ?? card.topicId}`;
      case "boss_beaten": {
        const score = card.detail?.score as number | undefined;
        const of = card.detail?.of as number | undefined;
        const scoreStr = score != null && of != null ? ` with ${score}/${of}` : "";
        return `👾 beat the ${t?.name ?? card.topicId} L${card.level} Boss${scoreStr}`;
      }
      case "streak_milestone": {
        const streak = card.detail?.streak as number | undefined;
        return `🔥 hit a ${streak ?? "?"}-day streak`;
      }
      case "spotlight":
        return `✨ is climbing ${t?.name ?? card.topicId} — top mover this week`;
    }
  }, [card.kind, card.level, card.detail, card.topicId, t]);

  return (
    <article className="card p-4 sm:p-5 flex gap-3 items-start">
      <button
        onClick={() =>
          onNav({ name: "profile", handle: card.authorHandle })
        }
        className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-accent2 grid place-items-center text-white font-bold ring-2 ring-white/10 shrink-0"
      >
        {card.authorPicture ? (
          <img src={card.authorPicture} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <span className="text-sm">{initials}</span>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <button
            onClick={() => onNav({ name: "profile", handle: card.authorHandle })}
            className="font-semibold text-white hover:underline"
          >
            {card.authorDisplay}
          </button>
          <span className="text-xs text-white/40">@{card.authorHandle}</span>
          <span className="text-xs text-white/40">· {timeAgo(card.createdAt)}</span>
          {card.isMock && (
            <span className="text-[10px] uppercase tracking-wider text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
              sample
            </span>
          )}
        </div>
        <p className="text-sm text-white/85 mt-1">{headline}</p>

        {t && (
          <div className="mt-2">
            <button
              onClick={() => onNav({ name: "topic", topicId: t.id })}
              className="pill border text-xs"
              style={{
                background: `${t.color}1a`,
                color: t.color,
                borderColor: `${t.color}33`,
              }}
            >
              {t.emoji} {t.name}
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {!card.iAmFollowing && card.iCanFollow && !card.isMock && (
            <button
              onClick={() => void onFollow(card.authorHandle)}
              className="btn-primary text-xs"
            >
              + Follow {card.authorDisplay.split(" ")[0]}
            </button>
          )}
          {card.topicId && (
            <button
              onClick={() => onNav({ name: "topic", topicId: card.topicId! })}
              className="btn-ghost text-xs"
            >
              Try this Topic
            </button>
          )}
          {!card.isMock && (
            <button
              onClick={() => void onMute(card.authorHandle)}
              className="btn-ghost text-xs"
              title="Mute author"
            >
              🔇 Mute
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyState({ followingOnly, onNav }: { followingOnly: boolean; onNav: (v: View) => void }) {
  return (
    <section className="card p-6 text-center max-w-md mx-auto">
      <Mascot mood="thinking" size={84} />
      {followingOnly ? (
        <>
          <h2 className="h2 mt-3">No fresh activity from your follows</h2>
          <p className="muted mt-2 text-sm">
            Try the All filter, or pick up a Spark in your favorite Topic.
          </p>
        </>
      ) : (
        <>
          <h2 className="h2 mt-3">The Stream is empty</h2>
          <p className="muted mt-2 text-sm">
            Follow some builders, set a Topic Signal, or come back tomorrow when more activity rolls in.
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        <button
          className="btn-primary text-sm"
          onClick={() => onNav({ name: "leaderboard" })}
        >
          Find people on Boards
        </button>
        <button
          className="btn-ghost text-sm"
          onClick={() => onNav({ name: "topic", topicId: TOPICS[0].id })}
        >
          Pick a Topic
        </button>
      </div>
    </section>
  );
}

// -- Helpers ------------------------------------------------------------

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
