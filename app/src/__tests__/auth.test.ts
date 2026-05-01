import { describe, it, expect } from "vitest";
import { decodeIdToken, isGmail } from "../auth/google";

describe("isGmail", () => {
  it("accepts gmail addresses", () => {
    expect(isGmail("alex@gmail.com")).toBe(true);
    expect(isGmail("ALEX@Gmail.com")).toBe(true);
    expect(isGmail("  trim@gmail.com  ")).toBe(true);
  });
  it("rejects non-gmail addresses", () => {
    expect(isGmail("alex@yahoo.com")).toBe(false);
    expect(isGmail("alex@gmail.co")).toBe(false);
    expect(isGmail("alex@notgmail.com")).toBe(false);
    expect(isGmail("just-a-word")).toBe(false);
  });
});

describe("decodeIdToken", () => {
  // SECURITY NOTE: decodeIdToken is a UI-only decoder. It does not verify
  // the JWT signature, audience, issuer, or expiry. These tests assert
  // payload extraction only — they do NOT exercise authenticity.

  it("decodes a valid 3-part JWT", () => {
    // header.payload.sig — we only inspect payload
    const payload = btoa(
      JSON.stringify({
        email: "demo@gmail.com",
        name: "Demo",
        picture: "https://example.com/p.png",
        sub: "abc123",
      })
    );
    const token = `xx.${payload}.yy`;
    const id = decodeIdToken(token);
    expect(id?.email).toBe("demo@gmail.com");
    expect(id?.name).toBe("Demo");
    expect(id?.sub).toBe("abc123");
  });
  it("preserves multi-byte UTF-8 in the name (no mojibake)", () => {
    // Names with é, 中, emoji used to corrupt because the previous decoder
    // routed atob() through escape()/decodeURIComponent, which only
    // handles Latin-1.
    const obj = { email: "u@gmail.com", name: "Adélie 中野 🚀", sub: "x" };
    const utf8 = new TextEncoder().encode(JSON.stringify(obj));
    const b64 = btoa(String.fromCharCode(...utf8));
    const token = `xx.${b64}.yy`;
    const id = decodeIdToken(token);
    expect(id?.name).toBe("Adélie 中野 🚀");
    expect(id?.email).toBe("u@gmail.com");
  });
  it("returns null for malformed tokens", () => {
    expect(decodeIdToken("garbage")).toBeNull();
    expect(decodeIdToken("a.b")).toBeNull();
    expect(decodeIdToken("a.@.b")).toBeNull();
  });
});
