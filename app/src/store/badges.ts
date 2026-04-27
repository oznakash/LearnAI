import type { Badge } from "../types";

export const BADGES: Badge[] = [
  {
    id: "first-spark",
    name: "First Spark",
    emoji: "✨",
    description: "Completed your very first Spark.",
    rule: (s) => s.history.some((h) => h.sparkIds.length > 0),
  },
  {
    id: "streak-3",
    name: "On Fire",
    emoji: "🔥",
    description: "3-day Build Streak.",
    rule: (s) => s.streak >= 3,
  },
  {
    id: "streak-7",
    name: "Unstoppable",
    emoji: "🚀",
    description: "7-day Build Streak.",
    rule: (s) => s.streak >= 7,
  },
  {
    id: "streak-30",
    name: "Compounding",
    emoji: "💎",
    description: "30-day Build Streak.",
    rule: (s) => s.streak >= 30,
  },
  {
    id: "xp-100",
    name: "Curious Mind",
    emoji: "🧠",
    description: "Earned 100 Synapses.",
    rule: (s) => s.xp >= 100,
  },
  {
    id: "xp-500",
    name: "Builder",
    emoji: "🛠️",
    description: "Earned 500 Synapses.",
    rule: (s) => s.xp >= 500,
  },
  {
    id: "xp-1500",
    name: "Architect",
    emoji: "🏛️",
    description: "Earned 1500 Synapses.",
    rule: (s) => s.xp >= 1500,
  },
  {
    id: "xp-5000",
    name: "Visionary",
    emoji: "🌌",
    description: "Earned 5000 Synapses.",
    rule: (s) => s.xp >= 5000,
  },
  {
    id: "boss-1",
    name: "Boss Slayer",
    emoji: "👾",
    description: "Beat your first Boss Cell.",
    rule: (s) => Object.values(s.progress.bossPassed).filter(Boolean).length >= 1,
  },
  {
    id: "boss-5",
    name: "Boss Hunter",
    emoji: "⚔️",
    description: "Beat 5 Boss Cells.",
    rule: (s) => Object.values(s.progress.bossPassed).filter(Boolean).length >= 5,
  },
  {
    id: "explorer-3",
    name: "Polymath",
    emoji: "🧭",
    description: "Touched 3 different Constellations.",
    rule: (s) => Object.keys(s.progress.topicXP).length >= 3,
  },
  {
    id: "explorer-6",
    name: "Renaissance Builder",
    emoji: "🎨",
    description: "Touched 6 different Constellations.",
    rule: (s) => Object.keys(s.progress.topicXP).length >= 6,
  },
  {
    id: "task-1",
    name: "Task Master Apprentice",
    emoji: "📋",
    description: "Completed your first Task.",
    rule: (s) => s.tasks.some((t) => t.status === "done"),
  },
  {
    id: "task-10",
    name: "Task Master",
    emoji: "🏆",
    description: "Completed 10 Tasks.",
    rule: (s) => s.tasks.filter((t) => t.status === "done").length >= 10,
  },
];

export function evaluateBadges(s: Parameters<Badge["rule"]>[0]) {
  const earned = new Set(s.badges);
  const newlyEarned: Badge[] = [];
  for (const b of BADGES) {
    if (!earned.has(b.id) && b.rule(s)) {
      newlyEarned.push(b);
    }
  }
  return newlyEarned;
}
