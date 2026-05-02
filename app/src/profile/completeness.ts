import type { PublicProfile } from "../social/types";

export interface CompletenessSlot {
  id:
    | "picture"
    | "fullName"
    | "mode"
    | "signals"
    | "global"
    | "showFullName"
    | "showCurrent"
    | "showMap"
    | "showActivity"
    | "showBadges"
    | "bio"
    | "skill"
    | "links"
    | "location";
  label: string;
  done: boolean;
  weight: number;
}

/**
 * Score the owner's profile from 0-100 by inspecting only the fields the
 * owner can actually control. Weights sum to 100 — keep that invariant if
 * you change one. The UI gauge assumes the score is a real percentage.
 *
 * We never read game-derived fields (xp / streak / activity) here — those
 * are not a "completion" choice, they're the residue of using the app.
 */
export function profileCompletenessSlots(
  profile: PublicProfile | null,
  fallbackPicture?: string,
): CompletenessSlot[] {
  const p = profile;
  const prefs = p?.ownerPrefs;
  const hasPicture = !!(p?.pictureUrl || fallbackPicture);
  const hasFullName = !!(prefs?.fullName && prefs.fullName.trim().length > 0);
  const hasBio = !!(p?.bio && p.bio.trim().length > 0);
  const hasSkill = !!p?.skillLevel;
  const hasLocation = !!(p?.location && p.location.trim().length > 0);
  const links = p?.links ?? {};
  const hasLink = !!(links.linkedin || links.github || links.twitter || links.website);
  return [
    { id: "picture", label: "Set a profile photo", done: hasPicture, weight: 15 },
    { id: "fullName", label: "Add your full name", done: hasFullName, weight: 10 },
    { id: "bio", label: "Write a one-sentence bio", done: hasBio, weight: 15 },
    { id: "skill", label: "Pick your skill level", done: hasSkill, weight: 5 },
    { id: "location", label: "Add your location", done: hasLocation, weight: 5 },
    { id: "links", label: "Add a social or website link", done: hasLink, weight: 10 },
    {
      id: "mode",
      label: "Choose a profile visibility",
      done: !!p?.profileMode,
      weight: 5,
    },
    {
      id: "signals",
      label: "Pick at least one Signal",
      done: !!p?.signals && p.signals.length >= 1,
      weight: 15,
    },
    {
      id: "global",
      label: "Decide whether to show on the Global Leaderboard",
      done: !!prefs?.signalsGlobal,
      weight: 5,
    },
    {
      id: "showFullName",
      label: "Decide whether others see your full name",
      done: !!prefs?.showFullName,
      weight: 5,
    },
    {
      id: "showCurrent",
      label: "Show your current Topic + level",
      done: !!prefs?.showCurrent,
      weight: 3,
    },
    { id: "showMap", label: "Show your Topic map", done: !!prefs?.showMap, weight: 2 },
    {
      id: "showActivity",
      label: "Show your 14-day activity",
      done: !!prefs?.showActivity,
      weight: 2,
    },
    { id: "showBadges", label: "Show your badges", done: !!prefs?.showBadges, weight: 3 },
  ];
}

export function profileCompleteness(
  profile: PublicProfile | null,
  fallbackPicture?: string,
): number {
  const slots = profileCompletenessSlots(profile, fallbackPicture);
  return slots.reduce((sum, s) => sum + (s.done ? s.weight : 0), 0);
}
