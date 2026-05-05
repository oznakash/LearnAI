// Server-side mirror of `app/src/lib/hidden-accounts.ts`.
//
// Internal QA accounts that exist to dogfood the FTUE flow and never
// appear on any public surface. Filtering on the SPA covered the
// client-rendered routes; mirroring here closes the SSR + same-origin
// API hole — a determined viewer typing `/u/<handle>` directly cannot
// resolve a hidden profile, and the leaderboard / stream endpoints
// drop them before any sort/limit work happens.
//
// Keep this list in sync with `app/src/lib/hidden-accounts.ts` —
// `services/social-svc/__tests__/hidden-accounts.test.ts` checks both
// allowlists describe the same set of personas.
//
// See `docs/test-personas.md` for the persona definitions and
// "Operating rules" for adding new ones.

const HIDDEN_ACCOUNT_EMAILS = new Set<string>([
  "learnai-qa+maya@gmail.com",
  "learnai-qa+jordan@gmail.com",
]);

/**
 * Handles that should be filtered from every public surface even when
 * we don't have (or don't want to maintain) the email locally. Used
 * for smoke-test artifacts that shouldn't show up on `/u/<handle>`,
 * the sitemap, leaderboards, or the stream — and where the actual
 * record cleanup requires admin auth + a deploy. Adding the handle
 * here is the fast, safe alternative.
 *
 * Keep this list in sync with `app/src/lib/hidden-accounts.ts`.
 */
const HIDDEN_HANDLES = new Set<string>([
  // Smoke-test profile from the auth-cascade audit run. Volume
  // cleanup happens on the next admin pass via
  // DELETE /v1/social/admin/profiles/by-handle/auth-cascade.
  "auth-cascade",
]);

/**
 * True when `email` belongs to one of LearnAI's internal QA personas.
 * Comparison is case-insensitive and tolerant of surrounding whitespace.
 * Returns false for `undefined`, `null`, or empty strings — absence of
 * an email is *not* the same as a hidden account.
 */
export function isHiddenAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return HIDDEN_ACCOUNT_EMAILS.has(email.trim().toLowerCase());
}

/**
 * True when `handle` is in the hidden-handles allowlist. Used for
 * smoke-test profiles whose email we don't want to track.
 */
export function isHiddenHandle(handle: string | null | undefined): boolean {
  if (!handle) return false;
  return HIDDEN_HANDLES.has(handle.trim().toLowerCase());
}

/**
 * True when this profile-shaped object should be filtered. Combines
 * the email + handle checks for callers that have both fields.
 */
export function isHiddenProfile(
  p: { email?: string; handle?: string } | null | undefined,
): boolean {
  if (!p) return false;
  return isHiddenAccount(p.email) || isHiddenHandle(p.handle);
}

/**
 * Read-only view of the hidden account list. Exposed so tests can
 * iterate the set; production code should call {@link isHiddenAccount}
 * instead.
 */
export function listHiddenAccountEmails(): readonly string[] {
  return Array.from(HIDDEN_ACCOUNT_EMAILS);
}

/** Read-only view of the hidden-handles list. Tests + audits only. */
export function listHiddenHandles(): readonly string[] {
  return Array.from(HIDDEN_HANDLES);
}
