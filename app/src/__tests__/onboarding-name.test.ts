import { describe, it, expect } from "vitest";
import { deriveDefaultName } from "../views/Onboarding";

describe("deriveDefaultName", () => {
  it("returns identity.name when present (whitespace trimmed)", () => {
    expect(
      deriveDefaultName({ name: "Maya Chen", email: "anything@gmail.com" }),
    ).toBe("Maya Chen");
    expect(
      deriveDefaultName({ name: "  Maya Chen  ", email: "anything@gmail.com" }),
    ).toBe("Maya Chen");
  });

  it("title-cases a plain handle", () => {
    expect(deriveDefaultName({ email: "maya@gmail.com" })).toBe("Maya");
    expect(deriveDefaultName({ email: "ALEX@gmail.com" })).toBe("Alex");
  });

  it("strips Gmail-style +tag suffixes", () => {
    expect(deriveDefaultName({ email: "maya+work@gmail.com" })).toBe("Maya");
    expect(deriveDefaultName({ email: "maya+ftue+v2@gmail.com" })).toBe("Maya");
  });

  it("picks the last alphabetic segment when separators are present", () => {
    expect(deriveDefaultName({ email: "learnai-qa-maya@gmail.com" })).toBe(
      "Maya",
    );
    expect(
      deriveDefaultName({ email: "learnai-qa+maya@gmail.com" }),
    ).toBe("Maya");
    expect(deriveDefaultName({ email: "first.last@gmail.com" })).toBe("Last");
  });

  it("returns empty string when the candidate is a known token", () => {
    // `learnai-qa` collapses to `qa`, which is a token-ish stub — better to
    // leave the field blank so the user types their real name.
    expect(deriveDefaultName({ email: "learnai-qa@gmail.com" })).toBe("");
    expect(deriveDefaultName({ email: "test@gmail.com" })).toBe("");
    expect(deriveDefaultName({ email: "demo@gmail.com" })).toBe("");
  });

  it("returns empty string when there's no email or no alpha segments", () => {
    expect(deriveDefaultName(undefined)).toBe("");
    expect(deriveDefaultName({ name: undefined })).toBe("");
    expect(deriveDefaultName({ email: "" })).toBe("");
    expect(deriveDefaultName({ email: "12345@gmail.com" })).toBe("");
  });
});
