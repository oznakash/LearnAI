// Spotlight cron — emits one kind="spotlight" event per Topic on a
// rotating cadence so the Spark Stream stays alive even when a user
// has no follows yet (PRD §4.5 visibility path 3).
//
// Algorithm (cheap, deterministic):
//   Every SPOTLIGHT_INTERVAL_MS:
//     For each Topic that has at least one Open profile carrying it
//     as a Signal:
//       Pick the top mover in that Topic over the last 7 days
//       (highest xp_week among profiles with that Signal). Emit a
//       spotlight event with topicId set, attributed to that author.
//   Idempotency: each spotlight event carries a clientId of
//     `spotlight|<topicId>|<authorEmail>|<6hWindowEpoch>` so a
//     restart inside the same window doesn't double-emit.
//
// Runs in-process (setInterval), unref'd so it doesn't keep the event
// loop alive past nginx exit.

import type { Store } from "./store.js";
import { log } from "./log.js";

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_FIRST_RUN_MS = 60 * 1000;          // 1 min after boot

export interface SpotlightOpts {
  intervalMs?: number;
  firstRunMs?: number;
}

export function startSpotlightCron(store: Store, opts: SpotlightOpts = {}): () => void {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const firstRunMs = opts.firstRunMs ?? DEFAULT_FIRST_RUN_MS;

  const tick = () => {
    try {
      const stats = store.statsSnapshot();
      // Topics with at least one signal-set: candidates for spotlight.
      const candidateTopics = Object.keys(stats.signalsByTopic);
      const windowEpoch = Math.floor(Date.now() / intervalMs);
      let emitted = 0;

      for (const topicId of candidateTopics) {
        // Find the top author for this Topic by xp_week. We can't
        // query the store directly for "best in topic"; iterate via
        // the listEventsSince + aggregate join cheaply enough.
        const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = store.listEventsSince(since, 1000);
        const authorsForTopic = new Set<string>();
        for (const e of recent) {
          if (e.topicId === topicId) authorsForTopic.add(e.email);
        }
        let topAuthor: string | null = null;
        let topXpWeek = -1;
        for (const email of authorsForTopic) {
          const agg = store.getAggregate(email);
          const profile = store.getProfileByEmail(email);
          if (!agg || !profile) continue;
          if (profile.profileMode !== "open") continue;
          if (profile.banned || profile.bannedSocial) continue;
          if (profile.ageBand === "kid") continue;
          if (agg.xpWeek > topXpWeek) {
            topXpWeek = agg.xpWeek;
            topAuthor = email;
          }
        }
        if (!topAuthor) continue;

        store.insertEventIdempotent({
          email: topAuthor,
          kind: "spotlight",
          topicId,
          createdAt: Date.now(),
          clientId: `spotlight|${topicId}|${topAuthor}|${windowEpoch}`,
        });
        emitted++;
      }

      if (emitted > 0) {
        log.info("spotlight_tick", { topics: candidateTopics.length, emitted, window: windowEpoch });
      }
    } catch (e) {
      log.error("spotlight_tick_failed", { err: (e as Error).message });
    }
  };

  const firstTimer = setTimeout(() => {
    tick();
    const interval = setInterval(tick, intervalMs);
    interval.unref?.();
  }, firstRunMs);
  firstTimer.unref?.();

  // Returned for test cleanup.
  return () => clearTimeout(firstTimer);
}
