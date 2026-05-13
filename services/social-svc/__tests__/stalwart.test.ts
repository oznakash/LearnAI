import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  fetchQueueMessage,
  parseQueueMessageBody,
  stalwartConfigFromEnv,
  summariseStatus,
  type StalwartConfig,
  type StalwartDomain,
} from "../src/stalwart.js";

// Stalwart admin API client. We don't make a real network call — the
// caller passes in a fake `fetch` so each test asserts on exactly the
// request we send and the response we'd handle. Three classes of test:
// (1) config detection from env (feature-flag behaviour), (2) request
// shape + status-code branching, (3) the body parser + status summary
// (which is what the admin UI ultimately renders).

const baseCfg: StalwartConfig = {
  adminUrl: "https://mail.example.com",
  adminToken: "stl_token_abc",
};

describe("stalwartConfigFromEnv", () => {
  const originalUrl = process.env.STALWART_ADMIN_URL;
  const originalToken = process.env.STALWART_ADMIN_TOKEN;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.STALWART_ADMIN_URL;
    else process.env.STALWART_ADMIN_URL = originalUrl;
    if (originalToken === undefined) delete process.env.STALWART_ADMIN_TOKEN;
    else process.env.STALWART_ADMIN_TOKEN = originalToken;
  });

  it("returns null when either var is unset (feature flag off)", () => {
    delete process.env.STALWART_ADMIN_URL;
    delete process.env.STALWART_ADMIN_TOKEN;
    expect(stalwartConfigFromEnv()).toBeNull();

    process.env.STALWART_ADMIN_URL = "https://mail.example.com";
    expect(stalwartConfigFromEnv()).toBeNull();

    delete process.env.STALWART_ADMIN_URL;
    process.env.STALWART_ADMIN_TOKEN = "tok";
    expect(stalwartConfigFromEnv()).toBeNull();
  });

  it("strips trailing slashes from the admin URL", () => {
    process.env.STALWART_ADMIN_URL = "https://mail.example.com///";
    process.env.STALWART_ADMIN_TOKEN = "tok";
    expect(stalwartConfigFromEnv()).toEqual({
      adminUrl: "https://mail.example.com",
      adminToken: "tok",
    });
  });
});

describe("fetchQueueMessage — request shape", () => {
  it("issues a GET to /api/queue/messages/{id} with Bearer auth", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const fakeFetch: typeof fetch = async (url, init) => {
      seen.url = String(url);
      seen.init = init;
      return new Response(JSON.stringify({ id: 1, domains: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const r = await fetchQueueMessage(baseCfg, "qid-123", {
      fetchImpl: fakeFetch,
    });
    expect(r.kind).toBe("found");
    expect(seen.url).toBe("https://mail.example.com/api/queue/messages/qid-123");
    const headers = new Headers(seen.init?.headers);
    expect(headers.get("authorization")).toBe("Bearer stl_token_abc");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("url-encodes the queue id (defends against funky-but-valid ids)", async () => {
    let seenUrl = "";
    const fakeFetch: typeof fetch = async (url) => {
      seenUrl = String(url);
      return new Response("{}", { status: 200 });
    };
    await fetchQueueMessage(baseCfg, "weird/id with spaces", {
      fetchImpl: fakeFetch,
    });
    expect(seenUrl).toBe(
      "https://mail.example.com/api/queue/messages/weird%2Fid%20with%20spaces",
    );
  });

  it("supports Basic auth when token has the `basic:` prefix", async () => {
    let auth = "";
    const fakeFetch: typeof fetch = async (_url, init) => {
      auth = new Headers(init?.headers).get("authorization") ?? "";
      return new Response("{}", { status: 200 });
    };
    await fetchQueueMessage(
      { adminUrl: "https://mail.example.com", adminToken: "basic:admin:p4ss" },
      "qid",
      { fetchImpl: fakeFetch },
    );
    const expected = "Basic " + Buffer.from("admin:p4ss").toString("base64");
    expect(auth).toBe(expected);
  });
});

describe("fetchQueueMessage — status branching", () => {
  const okFetch =
    (status: number, body: unknown = "{}"): typeof fetch =>
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
      });

  it("returns not_found on 404 (Stalwart prunes completed deliveries)", async () => {
    const r = await fetchQueueMessage(baseCfg, "qid", {
      fetchImpl: okFetch(404),
    });
    expect(r).toEqual({ kind: "not_found" });
  });

  it("returns error on 5xx WITHOUT leaking the response body", async () => {
    const r = await fetchQueueMessage(baseCfg, "qid", {
      fetchImpl: okFetch(500, "internal token error revealed"),
    });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.reason).toBe("stalwart_http_500");
      expect(r.status).toBe(500);
      expect(JSON.stringify(r)).not.toContain("internal token error revealed");
    }
  });

  it("returns error on a network/abort failure", async () => {
    const r = await fetchQueueMessage(baseCfg, "qid", {
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.reason).toBe("ECONNREFUSED");
    }
  });

  it("honours timeoutMs by aborting the fetch", async () => {
    const slowFetch: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    const r = await fetchQueueMessage(baseCfg, "qid", {
      fetchImpl: slowFetch,
      timeoutMs: 25,
    });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.reason).toBe("stalwart_timeout");
    }
  });
});

describe("parseQueueMessageBody", () => {
  it("parses the example shape from openapi.yml verbatim", () => {
    const sample = {
      id: 217700302698266624,
      return_path: "pepe@pepe.com",
      created: "2025-01-05T14:33:15Z",
      size: 1451,
      domains: [
        {
          name: "example.org",
          status: "scheduled",
          recipients: [
            { address: "john@example.org", status: "scheduled" },
          ],
          retry_num: 0,
          next_retry: "2025-01-05T14:33:15Z",
          expires: "2025-01-10T14:33:15Z",
        },
      ],
    };
    const out = parseQueueMessageBody(sample);
    expect(out.created).toBe("2025-01-05T14:33:15Z");
    expect(out.size).toBe(1451);
    expect(out.domains).toHaveLength(1);
    expect(out.domains[0]).toMatchObject({
      name: "example.org",
      status: "scheduled",
      retryNum: 0,
      nextRetry: "2025-01-05T14:33:15Z",
      expires: "2025-01-10T14:33:15Z",
    });
    expect(out.domains[0].recipients[0]).toEqual({
      address: "john@example.org",
      status: "scheduled",
      errorCategory: undefined,
      message: undefined,
    });
  });

  it("captures error_category on temp_fail / perm_fail recipients", () => {
    const out = parseQueueMessageBody({
      domains: [
        {
          name: "example.org",
          status: "temp_fail",
          recipients: [
            {
              address: "u@example.org",
              status: "temp_fail",
              error_category: "tls",
              message: "STARTTLS handshake failed",
            },
          ],
        },
      ],
    });
    expect(out.domains[0].recipients[0].errorCategory).toBe("tls");
    expect(out.domains[0].recipients[0].message).toBe(
      "STARTTLS handshake failed",
    );
  });

  it("returns an empty domains array for null/wrong-shape input rather than throwing", () => {
    expect(parseQueueMessageBody(null).domains).toEqual([]);
    expect(parseQueueMessageBody("oops" as unknown).domains).toEqual([]);
    expect(parseQueueMessageBody({}).domains).toEqual([]);
    expect(parseQueueMessageBody({ domains: "not an array" }).domains).toEqual(
      [],
    );
  });
});

describe("summariseStatus", () => {
  // The rollup is what the admin UI ultimately renders as a chip. The
  // ordering matters: any perm_fail beats temp_fail beats in_progress
  // beats scheduled beats completed.

  it("treats a single completed delivery as completed", () => {
    const domains: StalwartDomain[] = [
      {
        name: "example.org",
        status: "completed",
        recipients: [{ address: "u@example.org", status: "completed" }],
      },
    ];
    expect(summariseStatus(domains).state).toBe("completed");
  });

  it("escalates to perm_fail even when other recipients succeeded", () => {
    const domains: StalwartDomain[] = [
      {
        name: "a.com",
        status: "completed",
        recipients: [{ address: "u@a.com", status: "completed" }],
      },
      {
        name: "b.com",
        status: "perm_fail",
        recipients: [
          {
            address: "u@b.com",
            status: "perm_fail",
            errorCategory: "unexpected-reply",
          },
        ],
      },
    ];
    const out = summariseStatus(domains);
    expect(out.state).toBe("perm_fail");
    expect(out.worstErrorCategory).toBe("unexpected-reply");
  });

  it("returns temp_fail over scheduled / completed", () => {
    const domains: StalwartDomain[] = [
      {
        name: "a.com",
        status: "scheduled",
        recipients: [
          { address: "u@a.com", status: "temp_fail", errorCategory: "dns" },
        ],
      },
    ];
    const out = summariseStatus(domains);
    expect(out.state).toBe("temp_fail");
    expect(out.worstErrorCategory).toBe("dns");
  });

  it("falls through to 'unknown' for unrecognised status strings", () => {
    const domains: StalwartDomain[] = [
      {
        name: "a.com",
        status: "weird-new-state",
        recipients: [{ address: "u@a.com", status: "?" }],
      },
    ];
    expect(summariseStatus(domains).state).toBe("unknown");
  });
});
