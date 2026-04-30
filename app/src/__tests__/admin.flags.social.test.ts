import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_STORAGE_KEY, loadAdminConfig, saveAdminConfig } from "../admin/store";
import { defaultAdminConfig } from "../admin/defaults";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe("AdminConfig social flags + socialConfig", () => {
  it("default flags are off; defaults populate sensible socialConfig values", () => {
    const cfg = defaultAdminConfig();
    expect(cfg.flags.socialEnabled).toBe(false);
    expect(cfg.flags.streamEnabled).toBe(false);
    expect(cfg.flags.boardsEnabled).toBe(false);
    expect(cfg.flags.defaultProfileMode).toBe("open");
    expect(cfg.socialConfig.signalsMaxPerUser).toBe(5);
    expect(cfg.socialConfig.followsMaxOutbound).toBe(500);
    expect(cfg.socialConfig.streamWeights.recencyHalfLifeHours).toBe(18);
    expect(cfg.socialConfig.streamWeights.follow).toBe(1.0);
  });

  it("forward-merges new fields into older saved configs", () => {
    // Simulate a config saved before social fields existed.
    const legacy = {
      bootstrapped: true,
      admins: ["maya@gmail.com"],
      flags: {
        // intentionally missing socialEnabled / streamEnabled / etc.
        allowDemoMode: true,
      },
      // intentionally no socialConfig field at all
    };
    window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(legacy));
    const cfg = loadAdminConfig();
    expect(cfg.flags.socialEnabled).toBe(false);
    expect(cfg.flags.streamEnabled).toBe(false);
    expect(cfg.flags.boardsEnabled).toBe(false);
    expect(cfg.flags.defaultProfileMode).toBe("open");
    expect(cfg.socialConfig.signalsMaxPerUser).toBe(5);
    expect(cfg.socialConfig.streamWeights.follow).toBe(1.0);
  });

  it("preserves admin overrides through a save → load round-trip", () => {
    const cfg = defaultAdminConfig();
    cfg.flags.socialEnabled = true;
    cfg.flags.streamEnabled = true;
    cfg.socialConfig.serverUrl = "https://social.example.com";
    cfg.socialConfig.signalsMaxPerUser = 7;
    cfg.socialConfig.streamWeights.follow = 1.5;
    saveAdminConfig(cfg);
    const loaded = loadAdminConfig();
    expect(loaded.flags.socialEnabled).toBe(true);
    expect(loaded.flags.streamEnabled).toBe(true);
    expect(loaded.socialConfig.serverUrl).toBe("https://social.example.com");
    expect(loaded.socialConfig.signalsMaxPerUser).toBe(7);
    expect(loaded.socialConfig.streamWeights.follow).toBe(1.5);
    // Other weights inherit fresh defaults.
    expect(loaded.socialConfig.streamWeights.recencyHalfLifeHours).toBe(18);
  });

  it("partially-saved socialConfig.streamWeights merges with defaults (no missing fields)", () => {
    const cfg = defaultAdminConfig();
    saveAdminConfig({
      ...cfg,
      socialConfig: {
        ...cfg.socialConfig,
        streamWeights: { ...cfg.socialConfig.streamWeights, follow: 2.0 },
      },
    });
    // Manually clobber stored JSON to a partial weights object — simulating an
    // older saved config before we added a field.
    const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY)!;
    const parsed = JSON.parse(raw);
    parsed.socialConfig.streamWeights = { follow: 2.0 }; // missing the others
    window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(parsed));
    const loaded = loadAdminConfig();
    expect(loaded.socialConfig.streamWeights.follow).toBe(2.0);
    expect(loaded.socialConfig.streamWeights.signalOverlap).toBe(0.3);
    expect(loaded.socialConfig.streamWeights.qualityTier).toBe(0.2);
    expect(loaded.socialConfig.streamWeights.recencyHalfLifeHours).toBe(18);
  });
});
