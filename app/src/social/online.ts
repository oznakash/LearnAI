// HTTP client implementation of SocialService. Talks to social-svc
// via the auth-verifying proxy (or directly in demo mode).
//
// Mirrors Mem0MemoryService — same shape, same retry / timeout policy,
// same defensive parsing. Failure modes are surfaced as thrown errors;
// callers wrap in withSocialGuard() to fail soft.

import type {
  BoardPeriod,
  BoardScope,
  FollowEdge,
  FollowStatus,
  PlayerSnapshot,
  ProfilePatch,
  PublicProfile,
  ReportReason,
  SocialService,
  SocialStatus,
  StreamCard,
} from "./types";
import type { TopicId } from "../types";

export interface OnlineOpts {
  serverUrl: string;
  /** Bearer token (session JWT in production, admin key in demo). */
  apiKey?: string;
  /** The viewer's email — sent as `X-User-Email` (proxy strips/replaces in prod). */
  userEmail: string;
  /** Per-call hard timeout, default 6000ms. */
  timeoutMs?: number;
}

export class OnlineSocialService implements SocialService {
  private readonly base: string;
  private readonly apiKey?: string;
  private readonly email: string;
  private readonly timeoutMs: number;

  constructor(opts: OnlineOpts) {
    this.base = opts.serverUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.email = opts.userEmail;
    this.timeoutMs = opts.timeoutMs ?? 6000;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-user-email": this.email,
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      ...extra,
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit & { timeoutMs?: number } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), init.timeoutMs ?? this.timeoutMs);
    try {
      const res = await fetch(`${this.base}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { ...this.headers(), ...((init.headers as Record<string, string>) ?? {}) },
      });
      if (res.status === 204) return undefined as unknown as T;
      if (!res.ok) {
        let body = "";
        try {
          body = await res.text();
        } catch {
          /* ignore */
        }
        throw new Error(`social ${path} → HTTP ${res.status} ${body}`.trim());
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) return undefined as unknown as T;
      return (await res.json()) as T;
    } finally {
      clearTimeout(t);
    }
  }

  // -- read --------------------------------------------------------------
  getMyProfile(): Promise<PublicProfile> {
    return this.request<PublicProfile>("/v1/social/me");
  }

  async getProfile(handle: string): Promise<PublicProfile | null> {
    try {
      return await this.request<PublicProfile>(
        `/v1/social/profiles/${encodeURIComponent(handle)}`,
      );
    } catch (e) {
      // 404s are surfaced as null; everything else propagates.
      if ((e as Error).message.includes("HTTP 404")) return null;
      throw e;
    }
  }

  listFollowing(opts: { status?: FollowStatus } = {}): Promise<FollowEdge[]> {
    const q = opts.status ? `?status=${opts.status}` : "";
    return this.request<FollowEdge[]>(`/v1/social/me/following${q}`);
  }

  listFollowers(opts: { status?: FollowStatus } = {}): Promise<FollowEdge[]> {
    const q = opts.status ? `?status=${opts.status}` : "";
    return this.request<FollowEdge[]>(`/v1/social/me/followers${q}`);
  }

  async listPendingIncoming(): Promise<FollowEdge[]> {
    return this.listFollowers({ status: "pending" });
  }

  async listPendingOutgoing(): Promise<FollowEdge[]> {
    return this.listFollowing({ status: "pending" });
  }

  listBlocked(): Promise<string[]> {
    return this.request<string[]>("/v1/social/me/blocked");
  }

  getBoard(scope: BoardScope, period: BoardPeriod): Promise<PublicProfile[]> {
    const scopePath =
      scope === "global" || scope === "following"
        ? scope
        : `topic:${(scope as { topicId: TopicId }).topicId}`;
    return this.request<PublicProfile[]>(
      `/v1/social/boards/${encodeURIComponent(scopePath)}?period=${period}`,
    );
  }

  getStream(opts: { limit?: number; before?: number } = {}): Promise<StreamCard[]> {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.before) params.set("before", String(opts.before));
    const q = params.toString();
    return this.request<StreamCard[]>(`/v1/social/stream${q ? `?${q}` : ""}`);
  }

  // -- write (profile) ---------------------------------------------------
  updateProfile(patch: ProfilePatch): Promise<PublicProfile> {
    return this.request<PublicProfile>("/v1/social/me", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  }

  async setSignals(topics: TopicId[]): Promise<TopicId[]> {
    const r = await this.request<{ topics: TopicId[] }>(
      "/v1/social/me/signals",
      { method: "PUT", body: JSON.stringify({ topics }) },
    );
    return r.topics;
  }

  async pushSnapshot(snapshot: PlayerSnapshot): Promise<void> {
    await this.request("/v1/social/me/snapshot", {
      method: "POST",
      body: JSON.stringify(snapshot),
    });
  }

  // -- write (graph) -----------------------------------------------------
  follow(targetHandle: string): Promise<FollowEdge> {
    return this.request<FollowEdge>(
      `/v1/social/follow/${encodeURIComponent(targetHandle)}`,
      { method: "POST" },
    );
  }

  async unfollow(targetHandle: string): Promise<void> {
    await this.request(`/v1/social/follow/${encodeURIComponent(targetHandle)}`, {
      method: "DELETE",
    });
  }

  async approveFollowRequest(followerEmail: string): Promise<void> {
    await this.request(
      `/v1/social/requests/${encodeURIComponent(followerEmail)}/approve`,
      { method: "POST" },
    );
  }

  async declineFollowRequest(followerEmail: string): Promise<void> {
    await this.request(
      `/v1/social/requests/${encodeURIComponent(followerEmail)}/decline`,
      { method: "POST" },
    );
  }

  async cancelMyPendingRequest(targetHandle: string): Promise<void> {
    await this.request(
      `/v1/social/requests/outgoing/${encodeURIComponent(targetHandle)}`,
      { method: "DELETE" },
    );
  }

  async setMuted(targetHandle: string, muted: boolean): Promise<void> {
    await this.request(
      `/v1/social/follow/${encodeURIComponent(targetHandle)}/mute`,
      { method: "PUT", body: JSON.stringify({ muted }) },
    );
  }

  async block(targetHandle: string): Promise<void> {
    await this.request(`/v1/social/blocks/${encodeURIComponent(targetHandle)}`, {
      method: "POST",
    });
  }

  async unblock(targetEmail: string): Promise<void> {
    await this.request(`/v1/social/blocks/${encodeURIComponent(targetEmail)}`, {
      method: "DELETE",
    });
  }

  async report(
    targetHandle: string,
    reason: ReportReason,
    note?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.request("/v1/social/reports", {
      method: "POST",
      body: JSON.stringify({ targetHandle, reason, note, context }),
    });
  }

  // -- meta --------------------------------------------------------------
  async health(): Promise<SocialStatus> {
    try {
      const r = await this.request<{ status?: string; version?: string }>(
        "/health",
        { timeoutMs: 2500 },
      );
      return { ok: true, backend: "online", details: { ...(r ?? {}) } };
    } catch (e) {
      return { ok: false, backend: "online", reason: (e as Error).message };
    }
  }
}
