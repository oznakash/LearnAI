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
  const showFullName = isOwner ? profile.showFullName : profile.showFullName;

  return {
    email: profile.email,
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
