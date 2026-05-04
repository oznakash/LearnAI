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
 * Read-only view of the hidden account list. Exposed so tests can
 * iterate the set; production code should call {@link isHiddenAccount}
 * instead.
 */
export function listHiddenAccountEmails(): readonly string[] {
  return Array.from(HIDDEN_ACCOUNT_EMAILS);
}
