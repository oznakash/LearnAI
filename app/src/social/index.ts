import { OfflineSocialService } from "./offline";
import { OnlineSocialService } from "./online";
import type { SocialService } from "./types";

export type {
  BoardPeriod,
  BoardScope,
  FollowEdge,
  FollowStatus,
  PlayerSnapshot,
  ProfileMode,
  ProfilePatch,
  PublicProfile,
  ReportReason,
  SocialService,
  SocialStatus,
  StreamCard,
  StreamCardKind,
} from "./types";
export { OfflineSocialService, firstName, readOfflineSocialState } from "./offline";
export { OnlineSocialService } from "./online";
export {
  baseHandleFromEmail,
  disambiguateHandle,
  firstNameFrom,
  isValidHandle,
  resolveDisplayName,
} from "./handles";

export interface SelectSocialOpts {
  /** Player email; "" or missing → returns an offline service for "anon". */
  email: string;
  ageBandIsKid?: boolean;
  /** Master toggle. When false, returns offline regardless of `serverUrl`. */
  socialEnabled: boolean;
  /** social-svc base URL. Empty → offline (degrade silently). */
  serverUrl: string;
  /** Bearer for /v1/social — session JWT in production, admin key in demo. */
  bearerToken?: string;
}

/**
 * Resolve the active SocialService.
 *
 * Inputs are explicit args — no `localStorage` reads in here. The caller
 * (`SocialContext`) derives every input from React state (admin config +
 * player identity). Same lesson as `selectMemoryService`: keep this pure
 * to avoid the stale-cache race.
 */
export function selectSocialService(opts: SelectSocialOpts): SocialService {
  const email = (opts.email ?? "").trim();
  if (!email || !opts.socialEnabled || !opts.serverUrl) {
    return new OfflineSocialService({ email, ageBandIsKid: opts.ageBandIsKid });
  }
  return new OnlineSocialService({
    serverUrl: opts.serverUrl,
    apiKey: opts.bearerToken,
    userEmail: email,
  });
}

/** Fail-soft wrapper. Same shape as `withMemoryGuard`. */
export async function withSocialGuard<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (typeof console !== "undefined") {
      console.warn("[social]", (e as Error).message);
    }
    return fallback;
  }
}
