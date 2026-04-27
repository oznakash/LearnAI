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
  it("returns null for malformed tokens", () => {
    expect(decodeIdToken("garbage")).toBeNull();
    expect(decodeIdToken("a.b")).toBeNull();
    expect(decodeIdToken("a.@.b")).toBeNull();
  });
});
