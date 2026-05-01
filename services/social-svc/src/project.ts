// Viewer-aware projection from the storage records to the public-shape
// types served on the wire. Same rules as the OfflineSocialService:
// owner sees ownerPrefs + everything; viewers see fields gated by
// the owner's profile.show* flags.

import type {
  AggregateRecord,
  ProfileRecord,
  PublicProfile,
} from "./types.js";
import { resolveDisplayName } from "./handles.js";

export function projectProfile(
  profile: ProfileRecord,
  aggregate: AggregateRecord | null,
  viewerEmail: string,
): PublicProfile {
  const isOwner = viewerEmail.toLowerCase() === profile.email.toLowerCase();
  // P0-3 fix: only the owner sees their own email back. Non-owners get
  // an empty string so the wire shape stays stable but the gmail isn't
  // leaked. PRD §4.2: email is "never displayed to viewers."
  // P1-9 fix: dead `showFullName ? showFullName : showFullName` ternary
  // — owner-side preview is meant to *always* show the full name when
  // present (even if `showFullName=false`, so the owner can preview
  // what they'll display when they flip the toggle on).
  const showFullName = isOwner ? true : profile.showFullName;

  return {
    email: isOwner ? profile.email : "",
    handle: profile.handle,
    displayName: resolveDisplayName({
      fullName: profile.fullName,
      showFullName,
      email: profile.email,
    }),
    pictureUrl: profile.pictureUrl,
    guildTier: aggregate?.guildTier ?? "Builder",
    streak: aggregate?.streak ?? 0,
    xpTotal: aggregate?.xpTotal ?? 0,
    signals: profile.signals,
    badges:
      isOwner || profile.showBadges ? aggregate?.badges ?? [] : [],
    ageBandIsKid: profile.ageBand === "kid",
    profileMode: profile.profileMode,
    signupAt: profile.createdAt,
    currentWork:
      (isOwner || profile.showCurrent) &&
      aggregate?.currentTopicId &&
      aggregate.currentLevel != null
        ? {
            topicId: aggregate.currentTopicId,
            level: aggregate.currentLevel,
            topicName: aggregate.currentTopicId,
          }
        : undefined,
    topicMap:
      isOwner || profile.showMap
        ? Object.entries(aggregate?.topicXp ?? {}).map(([topicId, xp]) => ({
            topicId,
            xp,
          }))
        : undefined,
    activity14d:
      isOwner || profile.showActivity ? aggregate?.activity14d : undefined,
    ownerPrefs: isOwner
      ? {
          fullName: profile.fullName,
          showFullName: profile.showFullName,
          showCurrent: profile.showCurrent,
          showMap: profile.showMap,
          showActivity: profile.showActivity,
          showBadges: profile.showBadges,
          showSignup: profile.showSignup,
          signalsGlobal: profile.signalsGlobal,
        }
      : undefined,
  };
}
