import type { TopicId } from "../types";
import { tierForXP } from "../store/game";
import type { AnalyticsBundle, AnalyticsCohortRow, MockUser } from "./types";

const NAMES = [
  "Ada Patel", "Marcus Chen", "Priya Singh", "Diego Lopez", "Yuki Tanaka",
  "Sam O'Neil", "Rae Johansson", "Liam Walsh", "Maya Cohen", "Noor Hassan",
  "Theo Brown", "Iris Petrova", "Kenji Mori", "Zara Ahmed", "Olu Adeyemi",
  "Hana Kim", "Jordan Lee", "Mira Gupta", "Alex Park", "Camila Rossi",
  "Ravi Shah", "Fatima Khan", "Dev Mehra", "Nina Schultz", "Arjun Rao",
  "Lena Müller", "Tom Reilly", "Ines García", "Sofia Russo", "Ben Carter",
];

const TOPICS: TopicId[] = [
  "ai-foundations", "llms-cognition", "memory-safety", "ai-pm",
  "ai-builder", "cybersecurity", "cloud", "ai-devtools", "ai-trends",
  "frontier-companies", "ai-news", "open-source",
];

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Deterministic mock cohort, ~30 users. */
export function buildMockUsers(now = Date.now()): MockUser[] {
  const rand = seededRandom(7);
  const out: MockUser[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const xp = Math.floor(rand() * 4500);
    const signupDaysAgo = Math.floor(rand() * 90) + 1;
    const lastSeenDaysAgo = Math.floor(rand() * Math.min(signupDaysAgo, 28));
    const banned = rand() > 0.97;
    const skill = xp > 1500 ? "architect" : xp > 500 ? "builder" : xp > 100 ? "explorer" : "starter";
    const ageBand: MockUser["ageBand"] = rand() > 0.85 ? "teen" : rand() > 0.97 ? "kid" : "adult";
    const handle = NAMES[i].toLowerCase().replace(/\W+/g, ".");
    out.push({
      id: `u-${i + 1}`,
      email: `${handle}@gmail.com`,
      name: NAMES[i],
      ageBand,
      skillLevel: skill,
      signupAt: now - signupDaysAgo * 24 * 3600 * 1000,
      lastSeenAt: now - lastSeenDaysAgo * 24 * 3600 * 1000,
      xp,
      streak: lastSeenDaysAgo === 0 ? Math.min(signupDaysAgo, Math.floor(rand() * 30) + 1) : 0,
      tier: tierForXP(xp),
      topInterest: TOPICS[Math.floor(rand() * TOPICS.length)],
      daysActive: Math.min(30, Math.floor(rand() * 24) + 1),
      totalSparks: Math.floor(xp / 10) + Math.floor(rand() * 30),
      totalMinutes: Math.floor((xp / 10) * 1.4) + Math.floor(rand() * 40),
      banned,
    });
  }
  return out;
}

export function buildAnalytics(users: MockUser[], now = Date.now()): AnalyticsBundle {
  // signups by day, last 30
  const dayMs = 24 * 3600 * 1000;
  const newSignupsByDay: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const start = new Date(now - i * dayMs);
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + dayMs;
    const count = users.filter((u) => u.signupAt >= start.getTime() && u.signupAt < end).length;
    newSignupsByDay.push({ date: start.toISOString().slice(0, 10), count });
  }

  const total = users.length;
  const onboarded = users.filter((u) => u.totalSparks > 0 || u.xp > 0).length;
  const firstSpark = users.filter((u) => u.totalSparks > 0).length;
  const streak1 = users.filter((u) => u.streak >= 1).length;
  const streak7 = users.filter((u) => u.streak >= 7).length;

  const dauCount = users.filter((u) => now - u.lastSeenAt < dayMs).length;
  const wauCount = users.filter((u) => now - u.lastSeenAt < 7 * dayMs).length;
  const mauCount = users.filter((u) => now - u.lastSeenAt < 30 * dayMs).length;

  const avgSparks = total === 0 ? 0 : users.reduce((a, u) => a + u.totalSparks, 0) / total;
  const avgMinutes = total === 0 ? 0 : users.reduce((a, u) => a + u.totalMinutes, 0) / total;

  const popMap = new Map<TopicId, number>();
  for (const u of users) {
    if (!u.topInterest) continue;
    popMap.set(u.topInterest, (popMap.get(u.topInterest) ?? 0) + u.totalSparks);
  }
  const topicPopularity = Array.from(popMap.entries())
    .map(([topicId, sparks]) => ({ topicId, sparks }))
    .sort((a, b) => b.sparks - a.sparks);

  // Retention: bucket users into weekly cohorts and compute simple D1/D7/D30 (mocked deterministic)
  const cohortMap = new Map<string, MockUser[]>();
  for (const u of users) {
    const d = new Date(u.signupAt);
    const week = `${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, "0")}`;
    if (!cohortMap.has(week)) cohortMap.set(week, []);
    cohortMap.get(week)!.push(u);
  }
  const retention: AnalyticsCohortRow[] = Array.from(cohortMap.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-6)
    .map(([cohort, list]) => {
      const size = list.length;
      const d1 = size === 0 ? 0 : Math.round((list.filter((u) => u.daysActive >= 1).length / size) * 100);
      const d7 = size === 0 ? 0 : Math.round((list.filter((u) => u.daysActive >= 4).length / size) * 100);
      const d30 = size === 0 ? 0 : Math.round((list.filter((u) => u.daysActive >= 12).length / size) * 100);
      return { cohort, size, d1, d7, d30 };
    });

  return {
    totalUsers: total,
    newSignupsByDay,
    funnel: {
      signedUp: total,
      onboarded,
      firstSpark,
      streak1,
      streak7,
    },
    dau: dauCount,
    wau: wauCount,
    mau: mauCount,
    avgSparksPerUser: Math.round(avgSparks * 10) / 10,
    avgMinutesPerUser: Math.round(avgMinutes * 10) / 10,
    topicPopularity,
    retention,
    emailsSentLast7Days: Math.floor(total * 1.6),
  };
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
