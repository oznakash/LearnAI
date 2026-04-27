import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail } from "../admin/sender";
import type { EmailConfig, QueuedEmail } from "../admin/types";

const baseQueued: QueuedEmail = {
  id: "q-1",
  to: "alex@gmail.com",
  templateId: "welcome",
  subjectRendered: "Welcome",
  bodyRendered: "<p>Hi</p>",
  queuedAt: 0,
  status: "queued",
};

const baseConfig = (overrides: Partial<EmailConfig>): EmailConfig => ({
  provider: "none",
  fromName: "BuilderQuest",
  fromEmail: "no-reply@example.com",
  ...overrides,
});

describe("sendEmail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok=false when provider is none", async () => {
    const res = await sendEmail(baseConfig({ provider: "none" }), baseQueued);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/No provider/i);
  });

  it("Resend posts to the right URL with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "remote-id" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendEmail(
      baseConfig({ provider: "resend", apiKey: "re_test_123" }),
      baseQueued
    );
    expect(res.ok).toBe(true);
    expect(res.providerMessageId).toBe("remote-id");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer re_test_123");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to).toEqual(["alex@gmail.com"]);
    expect(body.subject).toBe("Welcome");
  });

  it("Resend without an api key returns an error", async () => {
    const res = await sendEmail(baseConfig({ provider: "resend" }), baseQueued);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/api key missing/i);
  });

  it("smtp-relay POSTs to the configured webhook URL with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "relay-id" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendEmail(
      baseConfig({
        provider: "smtp-relay",
        webhookUrl: "https://relay.example.com/send",
        webhookAuth: "shh-secret",
        smtp: { host: "smtp.example.com", port: 587, secure: true, username: "u", password: "p" },
      }),
      baseQueued
    );
    expect(res.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://relay.example.com/send");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer shh-secret");
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe("alex@gmail.com");
    expect(body.smtp.host).toBe("smtp.example.com");
  });

  it("smtp-relay missing webhook URL fails fast", async () => {
    const res = await sendEmail(baseConfig({ provider: "smtp-relay" }), baseQueued);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/webhook url missing/i);
  });

  it("EmailJS sends with template_params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendEmail(
      baseConfig({
        provider: "emailjs",
        emailjs: { serviceId: "svc", templateId: "tpl", userId: "uid" },
      }),
      baseQueued
    );
    expect(res.ok).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.service_id).toBe("svc");
    expect(body.template_id).toBe("tpl");
    expect(body.user_id).toBe("uid");
    expect(body.template_params.to_email).toBe("alex@gmail.com");
  });

  it("postmark / sendgrid / ses report they need a server-side relay", async () => {
    const r1 = await sendEmail(baseConfig({ provider: "postmark", apiKey: "x" }), baseQueued);
    expect(r1.ok).toBe(false);
    const r2 = await sendEmail(baseConfig({ provider: "sendgrid", apiKey: "x" }), baseQueued);
    expect(r2.ok).toBe(false);
    const r3 = await sendEmail(baseConfig({ provider: "ses", apiKey: "x" }), baseQueued);
    expect(r3.ok).toBe(false);
  });

  it("Resend HTTP error surfaces the error message from the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "bad domain" }), { status: 422 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendEmail(
      baseConfig({ provider: "resend", apiKey: "re_x" }),
      baseQueued
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("bad domain");
  });
});
