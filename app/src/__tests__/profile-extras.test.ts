import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  profileCompleteness,
  profileCompletenessSlots,
} from "../profile/completeness";
import { buildProfileUrl, copyToClipboard, shareProfile } from "../profile/share";
import { buildPersonJsonLd, clearProfileSeo, setProfileSeo } from "../profile/seo";
import type { PublicProfile } from "../social/types";

function bareProfile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    email: "maya@gmail.com",
    handle: "maya",
    displayName: "Maya",
    guildTier: "Builder",
    streak: 0,
    xpTotal: 0,
    signals: [],
    badges: [],
    ageBandIsKid: false,
    profileMode: "open",
    signupAt: 0,
    ownerPrefs: {
      showFullName: false,
      showCurrent: false,
      showMap: false,
      showActivity: false,
      showBadges: false,
      showSignup: false,
      signalsGlobal: false,
    },
    ...overrides,
  };
}

describe("profileCompletenessSlots", () => {
  it("weights sum to 100", () => {
    const total = profileCompletenessSlots(bareProfile()).reduce((s, x) => s + x.weight, 0);
    expect(total).toBe(100);
  });

  it("scores a bare-but-loaded profile below 100", () => {
    expect(profileCompleteness(bareProfile())).toBeLessThan(100);
    // Profile mode is set on a freshly loaded profile, so we never score 0.
    expect(profileCompleteness(bareProfile())).toBeGreaterThan(0);
  });

  it("hits 100 when every slot is satisfied", () => {
    const full = bareProfile({
      pictureUrl: "https://example.com/p.png",
      signals: ["ai-foundations"],
      ownerPrefs: {
        fullName: "Maya Patel",
        showFullName: true,
        showCurrent: true,
        showMap: true,
        showActivity: true,
        showBadges: true,
        showSignup: true,
        signalsGlobal: true,
      },
    });
    expect(profileCompleteness(full)).toBe(100);
  });

  it("counts a Google fallback picture as the picture slot", () => {
    const baseline = profileCompleteness(bareProfile());
    const withFallback = profileCompleteness(
      bareProfile(),
      "https://lh3.googleusercontent.com/x",
    );
    expect(withFallback).toBeGreaterThan(baseline);
  });

  it("returns slots with an empty completeness when profile is null", () => {
    const slots = profileCompletenessSlots(null);
    expect(slots.every((s) => s.done === false)).toBe(true);
    expect(profileCompleteness(null)).toBe(0);
  });
});

describe("buildProfileUrl + share", () => {
  it("builds the expected /u/<handle> URL and encodes the handle", () => {
    expect(buildProfileUrl("maya", "https://x.com")).toBe("https://x.com/u/maya");
    expect(buildProfileUrl("maya.p", "https://x.com")).toBe("https://x.com/u/maya.p");
  });

  it("returns empty for an empty handle", () => {
    expect(buildProfileUrl("", "https://x.com")).toBe("");
  });

  describe("shareProfile", () => {
    let originalNav: Navigator;
    let originalClipboard: typeof navigator.clipboard | undefined;

    beforeEach(() => {
      originalNav = globalThis.navigator;
      originalClipboard = (originalNav as Navigator & { clipboard?: typeof navigator.clipboard })
        .clipboard;
    });
    afterEach(() => {
      // Restore navigator.share / clipboard between tests so we don't
      // leak the spy into other suites.
      Object.defineProperty(globalThis, "navigator", { value: originalNav, configurable: true });
      if (originalClipboard !== undefined) {
        Object.defineProperty(navigator, "clipboard", {
          value: originalClipboard,
          configurable: true,
        });
      }
    });

    it("uses navigator.share when available", async () => {
      const spy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, "navigator", {
        value: { ...originalNav, share: spy },
        configurable: true,
      });
      const r = await shareProfile({
        handle: "maya",
        displayName: "Maya",
        origin: "https://x.com",
      });
      expect(r).toBe("shared");
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://x.com/u/maya" }),
      );
    });

    it("falls back to clipboard when navigator.share is not available", async () => {
      // Remove navigator.share if present.
      Object.defineProperty(globalThis, "navigator", {
        value: { ...originalNav, share: undefined },
        configurable: true,
      });
      const writeSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeSpy },
        configurable: true,
      });
      const r = await shareProfile({
        handle: "maya",
        displayName: "Maya",
        origin: "https://x.com",
      });
      expect(r).toBe("copied");
      expect(writeSpy).toHaveBeenCalledWith("https://x.com/u/maya");
    });

    it("falls back to clipboard when navigator.share rejects", async () => {
      const shareSpy = vi.fn().mockRejectedValue(new Error("user cancelled"));
      const writeSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, "navigator", {
        value: { ...originalNav, share: shareSpy },
        configurable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeSpy },
        configurable: true,
      });
      const r = await shareProfile({
        handle: "maya",
        displayName: "Maya",
        origin: "https://x.com",
      });
      expect(r).toBe("copied");
      expect(writeSpy).toHaveBeenCalled();
    });

    it("returns 'failed' when both share and clipboard are unavailable", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { ...originalNav, share: undefined, clipboard: undefined },
        configurable: true,
      });
      const r = await shareProfile({
        handle: "maya",
        displayName: "Maya",
        origin: "https://x.com",
      });
      expect(r).toBe("failed");
    });

    it("copyToClipboard returns false when navigator.clipboard is missing", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: { ...originalNav, clipboard: undefined },
        configurable: true,
      });
      expect(await copyToClipboard("hi")).toBe(false);
    });
  });
});

describe("setProfileSeo / clearProfileSeo / buildPersonJsonLd", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "LearnAI — Don't learn alone.";
  });
  afterEach(() => {
    clearProfileSeo();
  });

  it("sets title, OG, twitter meta, and JSON-LD", () => {
    setProfileSeo({
      title: "Maya (@maya) — LearnAI",
      description: "Maya on LearnAI.",
      url: "https://learnai.cloud-claude.com/u/maya",
      imageUrl: "https://example.com/maya.png",
      jsonLd: buildPersonJsonLd({
        name: "Maya",
        handle: "maya",
        url: "https://learnai.cloud-claude.com/u/maya",
      }),
    });
    expect(document.title).toBe("Maya (@maya) — LearnAI");
    expect(
      document.querySelector('meta[name="description"]')?.getAttribute("content"),
    ).toBe("Maya on LearnAI.");
    expect(
      document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    ).toBe("Maya (@maya) — LearnAI");
    expect(
      document.querySelector('meta[property="og:url"]')?.getAttribute("content"),
    ).toBe("https://learnai.cloud-claude.com/u/maya");
    expect(
      document.querySelector('meta[property="og:type"]')?.getAttribute("content"),
    ).toBe("profile");
    expect(
      document.querySelector('meta[name="twitter:card"]')?.getAttribute("content"),
    ).toBe("summary_large_image");
    const ld = document.getElementById("__lai_ld_profile");
    expect(ld).toBeTruthy();
    const parsed = JSON.parse(ld!.textContent!);
    expect(parsed["@type"]).toBe("Person");
    expect(parsed.name).toBe("Maya");
    expect(parsed.alternateName).toBe("maya");
  });

  it("clearProfileSeo restores the original title and removes the JSON-LD", () => {
    setProfileSeo({
      title: "X",
      description: "y",
      url: "z",
      jsonLd: { "@context": "https://schema.org", "@type": "Person", name: "X" },
    });
    clearProfileSeo();
    expect(document.title).toBe("LearnAI — Don't learn alone.");
    expect(document.getElementById("__lai_ld_profile")).toBeNull();
    expect(document.querySelector('meta[property="og:title"]')).toBeNull();
  });

  it("buildPersonJsonLd omits sameAs when no links are passed", () => {
    const ld = buildPersonJsonLd({ name: "Maya", handle: "maya", url: "/u/maya" });
    expect(ld.sameAs).toBeUndefined();
  });

  it("buildPersonJsonLd includes sameAs when links are non-empty", () => {
    const ld = buildPersonJsonLd({
      name: "Maya",
      handle: "maya",
      url: "/u/maya",
      sameAs: ["https://github.com/maya"],
    });
    expect(ld.sameAs).toEqual(["https://github.com/maya"]);
  });
});
