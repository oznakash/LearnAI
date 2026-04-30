import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchAdminServerStatus,
  fetchPublicAuthConfig,
  isSessionExpired,
  serverSignIn,
  serverSignOut,
  validateServerSession,
  ServerAuthError,
} from "../auth/server";

const MEM0 = "https://mem0.example.com";

const RAW_OK = {
  session: "session.jwt.value",
  user: { email: "alex@gmail.com", name: "Alex", picture: "https://x/p.png" },
  is_admin: true,
  expires_at: Math.floor(Date.now() / 1000) + 7 * 86_400,
};

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("serverSignIn", () => {
  it("posts the ID token and returns a normalized session", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => RAW_OK,
    });
    const session = await serverSignIn(MEM0, "google.id.token");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${MEM0}/auth/google`,
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id_token: "google.id.token" }),
      })
    );
    expect(session.token).toBe("session.jwt.value");
    expect(session.email).toBe("alex@gmail.com");
    expect(session.isAdmin).toBe(true);
    expect(session.expiresAt).toBe(RAW_OK.expires_at);
  });

  it("throws ServerAuthError with the server's detail on 401/403", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ detail: "Only @gmail.com addresses are allowed to sign in." }),
    });
    await expect(serverSignIn(MEM0, "x")).rejects.toMatchObject({
      name: "ServerAuthError",
      status: 403,
      message: /gmail\.com/,
    });
  });

  it("throws when mem0 URL is empty", async () => {
    await expect(serverSignIn("", "x")).rejects.toBeInstanceOf(ServerAuthError);
  });

  it("trims trailing slashes off the mem0 URL", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => RAW_OK,
    });
    await serverSignIn(`${MEM0}///`, "x");
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      `${MEM0}/auth/google`
    );
  });
});

describe("validateServerSession", () => {
  it("returns null on 401", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });
    expect(await validateServerSession(MEM0, "tkn")).toBeNull();
  });

  it("returns null when network throws", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    expect(await validateServerSession(MEM0, "tkn")).toBeNull();
  });

  it("returns null when token or url is empty (no fetch attempted)", async () => {
    expect(await validateServerSession("", "tkn")).toBeNull();
    expect(await validateServerSession(MEM0, "")).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects responses that aren't a google_session (would-be admin-key auth)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ is_admin: true, auth_type: "admin_api_key" }),
    });
    expect(await validateServerSession(MEM0, "tkn")).toBeNull();
  });

  it("returns the parsed session on 200 with auth_type=google_session", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        email: "alex@gmail.com",
        name: "Alex",
        picture: null,
        is_admin: false,
        expires_at: RAW_OK.expires_at,
        auth_type: "google_session",
      }),
    });
    const session = await validateServerSession(MEM0, "tkn");
    expect(session).not.toBeNull();
    expect(session!.email).toBe("alex@gmail.com");
    expect(session!.isAdmin).toBe(false);
    expect(session!.token).toBe("tkn");
  });
});

describe("serverSignOut", () => {
  it("posts to /auth/google/signout with bearer", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 204 });
    await serverSignOut(MEM0, "tkn");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${MEM0}/auth/google/signout`,
      expect.objectContaining({
        method: "POST",
        headers: { authorization: "Bearer tkn" },
      })
    );
  });

  it("swallows network errors silently", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    await expect(serverSignOut(MEM0, "tkn")).resolves.toBeUndefined();
  });
});

describe("fetchPublicAuthConfig", () => {
  it("returns the parsed config on 200", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ google_client_id: "abc.apps.googleusercontent.com", session_ttl_days: 7 }),
    });
    const cfg = await fetchPublicAuthConfig(MEM0);
    expect(cfg).toEqual({ googleClientId: "abc.apps.googleusercontent.com", sessionTtlDays: 7 });
  });

  it("returns null when the server returns an empty client_id", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ google_client_id: "", session_ttl_days: 7 }),
    });
    expect(await fetchPublicAuthConfig(MEM0)).toBeNull();
  });

  it("returns null on 4xx / network error / older mem0 build (no endpoint)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await fetchPublicAuthConfig(MEM0)).toBeNull();

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    expect(await fetchPublicAuthConfig(MEM0)).toBeNull();
  });

  it("returns null when mem0 URL is empty (no fetch attempted)", async () => {
    expect(await fetchPublicAuthConfig("")).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("fetchAdminServerStatus", () => {
  it("returns the parsed status on 200", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        google_oauth_client_id: "abc.apps.googleusercontent.com",
        admin_emails: ["op@gmail.com"],
        cors_origins: ["https://learnai.example.com"],
        session_ttl_days: 7,
        history_db_path: "/app/data/history.db",
        openai_api_key_set: true,
        jwt_secret_set: true,
        admin_api_key_set: false,
      }),
    });
    const s = await fetchAdminServerStatus(MEM0, "session-jwt");
    expect(s).not.toBeNull();
    expect(s!.googleOauthClientId).toBe("abc.apps.googleusercontent.com");
    expect(s!.adminEmails).toEqual(["op@gmail.com"]);
    expect(s!.openaiApiKeySet).toBe(true);
    expect(s!.adminApiKeySet).toBe(false);
  });

  it("returns null on 403 (non-admin) / network error / missing inputs", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 403 });
    expect(await fetchAdminServerStatus(MEM0, "tkn")).toBeNull();

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    expect(await fetchAdminServerStatus(MEM0, "tkn")).toBeNull();

    expect(await fetchAdminServerStatus("", "tkn")).toBeNull();
    expect(await fetchAdminServerStatus(MEM0, "")).toBeNull();
  });
});

describe("isSessionExpired", () => {
  it("treats undefined/null as expired", () => {
    expect(isSessionExpired(undefined)).toBe(true);
    expect(isSessionExpired(null)).toBe(true);
  });

  it("treats sessions within 60s of expiry as expired", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      isSessionExpired({
        token: "x",
        email: "a@gmail.com",
        isAdmin: false,
        expiresAt: now + 30,
      })
    ).toBe(true);
  });

  it("treats far-future sessions as live", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(
      isSessionExpired({
        token: "x",
        email: "a@gmail.com",
        isAdmin: false,
        expiresAt: now + 86_400,
      })
    ).toBe(false);
  });
});
