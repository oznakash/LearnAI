// Internal QA accounts used to dogfood the FTUE flow over and over.
// These accounts can sign in (typically via demo mode) and exercise the
// app from end-to-end like a real user, but we filter them out of
// every public-facing surface so they never appear on leaderboards,
// public profile pages, SEO indexing, or anywhere else a real user
// could see them.
//
// See `docs/test-personas.md` for who each account represents and why.
//
// Adding a new persona: append the email here, document the persona in
// `docs/test-personas.md`, and the rest of the platform's public
// surfaces will filter them automatically.
//
// NOTE: this allowlist lives in the SPA layer so client-rendered
// surfaces (leaderboard, profile SEO, share URLs) filter consistently.
// For full defense-in-depth the social-svc backend should ALSO carry
// the same list — until then a directly-typed `/u/<handle>` URL handled
// purely by the server could still expose a hidden profile to a
// determined viewer. Tracked in `docs/test-personas.md` "Future work."
import { baseHandleFromEmail } from "../social/handles";

const HIDDEN_ACCOUNT_EMAILS = new Set<string>([
  "learnai-qa+maya@gmail.com",
  "learnai-qa+jordan@gmail.com",
]);

/**
 * Returns true when the given email belongs to one of LearnAI's internal
 * QA personas — those accounts are blocked from public surfaces. The
 * comparison is case-insensitive and tolerant of surrounding whitespace
 * since these strings sometimes flow through hand-typed forms.
 *
 * Returns false for `undefined`, `null`, or empty strings — the absence
 * of an email is *not* the same as a hidden account.
 */
export function isHiddenAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return HIDDEN_ACCOUNT_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Read-only view of the hidden account list. Exposed so tests can iterate
 * the set; production code should call {@link isHiddenAccount} instead.
 */
export function listHiddenAccountEmails(): readonly string[] {
  return Array.from(HIDDEN_ACCOUNT_EMAILS);
}

// Handles to filter even when we don't have / don't want the email
// locally. Smoke-test artifacts go here.
//
// Keep in sync with `services/social-svc/src/hidden-accounts.ts`.
const EXPLICIT_HIDDEN_HANDLES = [
  "auth-cascade", // smoke-test profile from the auth-cascade audit run
] as const;

// Pre-computed set of canonical handles derived from each hidden email,
// plus any explicit handles. Built once at module load so the per-call
// check is just a Set hit.
const HIDDEN_HANDLES: ReadonlySet<string> = new Set([
  ...Array.from(HIDDEN_ACCOUNT_EMAILS).map((e) => baseHandleFromEmail(e)),
  ...EXPLICIT_HIDDEN_HANDLES,
]);

/**
 * True when `handle` matches the canonical handle of a hidden account.
 * Handles are case-insensitive — we lowercase the input before checking.
 *
 * This is the right gate for surfaces that only have a handle (URL
 * params, leaderboard rows, profile SEO) and don't carry the email.
 */
export function isHiddenHandle(handle: string | null | undefined): boolean {
  if (!handle) return false;
  return HIDDEN_HANDLES.has(handle.trim().toLowerCase());
}
