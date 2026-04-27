// Google Identity Services (GIS) — Gmail-only sign-in helper.
// Loads the GIS script once. Decodes the ID token (JWT) client-side
// to extract email/name/picture. Restricted to @gmail.com addresses
// (or any address — caller decides). For server-side validation,
// you should verify the JWT signature with Google's certs in your backend.

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
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const obj = JSON.parse(decodeURIComponent(escape(json)));
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
