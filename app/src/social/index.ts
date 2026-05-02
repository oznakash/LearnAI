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
  /**
   * Live Google identity values from `player.identity`. The offline
   * service uses these as the fallback for `displayName` / `pictureUrl`
   * when the player hasn't explicitly customized their public profile —
   * so a freshly signed-in user immediately sees their Google name + avatar
   * on `/u/<handle>` instead of email-derived defaults. The online service
   * ignores these (the server reads the JWT claims directly).
   */
  identityName?: string;
  identityPicture?: string;
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
  if (!email || !opts.socialEnabled) {
    return new OfflineSocialService({
      email,
      ageBandIsKid: opts.ageBandIsKid,
      identityName: opts.identityName,
      identityPicture: opts.identityPicture,
    });
  }
  // Same-origin is the default in production: the social-svc sidecar
  // runs in the same container as the SPA. Pass an empty serverUrl and
  // OnlineSocialService makes relative-URL fetches that nginx proxies
  // to localhost:8787. For fork / dev setups, an explicit serverUrl
  // points at a remote sidecar.
  //
  // BUT: in dev or in a bare static deploy (no sidecar), an empty
  // serverUrl means relative fetches that hit the SPA fallback (index.html
  // for unknown routes). The JSON client returns `undefined` for those
  // HTML responses, which then crashes callers like SparkStream that do
  // `result.map(...)`. Without a bearer (production session JWT) AND
  // without an explicit serverUrl, we can't be reaching a real sidecar —
  // stay offline and let the UI render mock cards instead of hanging.
  const serverUrl = (opts.serverUrl ?? "").trim();
  const bearer = (opts.bearerToken ?? "").trim();
  if (!serverUrl && !bearer) {
    return new OfflineSocialService({
      email,
      ageBandIsKid: opts.ageBandIsKid,
      identityName: opts.identityName,
      identityPicture: opts.identityPicture,
    });
  }
  return new OnlineSocialService({
    serverUrl,
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
