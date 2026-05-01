// Anonymous traffic beacon. Fires ONCE per browser session on first SPA
// load. Tells social-svc:
//   - what page was hit (just the pathname, never the full URL)
//   - what domain the visitor came from (or "(direct)" / "(internal)")
//   - what utm_source / ref / from query param brought them, if any
//
// Used by Admin → Analytics → Traffic to answer "did my LinkedIn /
// Twitter post drive any visits?". No PII is captured. The endpoint
// itself is open (unauthenticated) because first-time visitors aren't
// signed in yet — that's the whole point.
//
// Errors are swallowed: tracking must never break the app. The beacon
// uses navigator.sendBeacon when available so unloads don't drop it.

const SESSION_KEY = "learnai.tracked_visit";

/** Lowercased, trimmed first match of utm_source / ref / from. */
function pickSource(search: string): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  for (const k of ["utm_source", "ref", "from"]) {
    const v = params.get(k);
    if (v && v.trim()) return v.trim().toLowerCase();
  }
  return null;
}

/**
 * Reduce a referrer URL to a bare host:
 *   "https://twitter.com/user/status/1" → "twitter.com"
 *   "https://www.linkedin.com/post/..."  → "linkedin.com"
 *   "" or invalid → "(direct)"
 *   same-origin (SPA internal nav) → "(internal)"
 */
export function normalizeReferrer(referrer: string, currentOrigin: string): string {
  if (!referrer) return "(direct)";
  try {
    const u = new URL(referrer);
    if (u.origin === currentOrigin) return "(internal)";
    return u.host.replace(/^www\./, "");
  } catch {
    return "(direct)";
  }
}

export function trackInitialVisit(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    if (window.sessionStorage?.getItem(SESSION_KEY)) return;
  } catch {
    // Some browsers throw on sessionStorage in private mode; just proceed.
  }
  const path = window.location.pathname || "/";
  const refDomain = normalizeReferrer(document.referrer || "", window.location.origin);
  const source = pickSource(window.location.search || "");
  const body = JSON.stringify({ path, refDomain, source });
  const url = "/v1/social/track/visit";
  let sent = false;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // sendBeacon needs a Blob with the right content-type.
      const blob = new Blob([body], { type: "application/json" });
      sent = navigator.sendBeacon(url, blob);
    }
  } catch {
    sent = false;
  }
  if (!sent) {
    // Fallback: fetch + keepalive so it survives navigation/unload.
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Swallow; tracking failures must not surface to the user.
    });
  }
  try {
    window.sessionStorage?.setItem(SESSION_KEY, "1");
  } catch {
    // ignore
  }
}
