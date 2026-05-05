// Thin HTTP client for the LinkedIn endpoints on social-svc.
//
// Kept separate from `OnlineSocialService` (and out of the
// `SocialService` interface) because the LinkedIn flow is
// online-only — there's no offline fallback, no contract surface
// for the offline mirror to satisfy. SocialContext exposes this as
// `social.linkedin` (null in offline mode).
//
// Strategy: docs/profile-linkedin.md.

import type { LinkedinIdentity } from "./types";

interface ClientOpts {
  /** Sidecar base URL. Empty string ⇒ same-origin. */
  serverUrl: string;
  /** Bearer token — the mem0-issued session JWT. */
  apiKey?: string;
  /** Used for the X-User-Email demo-mode fallback header. */
  userEmail: string;
  /** Per-call timeout, default 6000ms. */
  timeoutMs?: number;
}

export interface LinkedinConfigResponse {
  enabled: boolean;
}

export interface LinkedinMeResponse {
  connected: boolean;
  identity?: LinkedinIdentity;
}

export class LinkedinClient {
  private readonly base: string;
  private readonly apiKey?: string;
  private readonly email: string;
  private readonly timeoutMs: number;

  constructor(opts: ClientOpts) {
    const url = (opts.serverUrl ?? "").trim();
    this.base = url && url !== "/" ? url.replace(/\/+$/, "") : "";
    this.apiKey = opts.apiKey;
    this.email = opts.userEmail;
    this.timeoutMs = opts.timeoutMs ?? 6000;
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-user-email": this.email,
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.base}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { ...this.headers(), ...((init.headers as Record<string, string>) ?? {}) },
      });
      if (!res.ok) {
        let body = "";
        try {
          body = await res.text();
        } catch {
          /* ignore */
        }
        throw new Error(`linkedin ${path} → HTTP ${res.status} ${body}`.trim());
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) return undefined as unknown as T;
      return (await res.json()) as T;
    } finally {
      clearTimeout(t);
    }
  }

  /** Public probe — is the OAuth integration configured on the server? */
  config(): Promise<LinkedinConfigResponse> {
    return this.request<LinkedinConfigResponse>("/v1/social/me/linkedin/config");
  }

  /** Read the current user's LinkedIn identity (if any). */
  me(): Promise<LinkedinMeResponse> {
    return this.request<LinkedinMeResponse>("/v1/social/me/linkedin");
  }

  /**
   * Begin the OAuth flow. Returns the LinkedIn authorize URL the SPA
   * should navigate to via `window.location.href = url`. The state
   * token bound in the URL is single-use and HMAC-signed.
   */
  start(): Promise<{ url: string }> {
    return this.request<{ url: string }>("/v1/social/me/linkedin/start", {
      method: "POST",
    });
  }

  /** Disconnect — clears both visible and context buckets. */
  disconnect(): Promise<{ ok: boolean; removed: boolean }> {
    return this.request<{ ok: boolean; removed: boolean }>(
      "/v1/social/me/linkedin",
      { method: "DELETE" },
    );
  }
}
