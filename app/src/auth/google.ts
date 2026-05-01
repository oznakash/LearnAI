// Google Identity Services (GIS) — Gmail-only sign-in helper.
//
// SECURITY NOTE: decodeIdToken() does NOT verify the JWT signature, audience,
// issuer, or expiry. It only extracts the payload to drive the UI. Anyone
// with devtools open can paste a forged token and the SPA will treat them as
// the corresponding email. All admin gating in this app is therefore a
// client-side UX boundary, not a security boundary. If you ever add a
// backend, verify the JWT against Google's JWKS there before trusting the
// caller's identity.

const GIS_SRC = "https://accounts.google.com/gsi/client";

let loadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            ux_mode?: "popup" | "redirect";
          }) => void;
          renderButton: (
            el: HTMLElement,
            options: Record<string, unknown>
          ) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS script failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS script failed to load"));
    document.head.appendChild(s);
  });
  return loadPromise;
}

export interface GoogleIdentity {
  email: string;
  name?: string;
  picture?: string;
  sub?: string;
}

export function decodeIdToken(token: string): GoogleIdentity | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const json = new TextDecoder("utf-8").decode(bytes);
    const obj = JSON.parse(json);
    return {
      email: obj.email,
      name: obj.name,
      picture: obj.picture,
      sub: obj.sub,
    };
  } catch {
    return null;
  }
}

/** Returns true if the email is a personal Gmail address. */
export function isGmail(email: string): boolean {
  return /@gmail\.com$/i.test(email.trim());
}
