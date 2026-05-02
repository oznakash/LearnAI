import { useAdmin } from "./AdminContext";
import { usePlayer } from "../store/PlayerContext";

/**
 * Admin → Public Profile tab.
 *
 * Operator-level controls for the `/u/<handle>` SSR + SPA Profile view.
 * The Network view is the per-user surface where each player toggles
 * their own visibility flags; this tab is the policy layer above it —
 * what defaults a fresh sign-up starts in, plus master switches that
 * apply globally.
 *
 * Today these settings live in the admin's localStorage config (same
 * as every other admin setting). The Network view honors the defaults
 * for new users at v1; persisting them server-side so social-svc's
 * lazy-create flow honors them is queued in a follow-up PR.
 *
 * Why a separate tab (vs. just using Network view): operators care
 * about policy across all users — "should new users default to Open?"
 * — separately from per-account choices.
 */
export function AdminPublicProfile() {
  const { config: adminCfg, setConfig } = useAdmin();
  const { state: player } = usePlayer();
  const pp = adminCfg.socialConfig.publicProfile;

  function setMode(mode: "open" | "closed") {
    setConfig((cfg) => ({
      ...cfg,
      socialConfig: {
        ...cfg.socialConfig,
        publicProfile: { ...cfg.socialConfig.publicProfile, defaultProfileMode: mode },
      },
    }));
  }

  function setDefault(key: keyof typeof pp.defaults, value: boolean) {
    setConfig((cfg) => ({
      ...cfg,
      socialConfig: {
        ...cfg.socialConfig,
        publicProfile: {
          ...cfg.socialConfig.publicProfile,
          defaults: {
            ...cfg.socialConfig.publicProfile.defaults,
            [key]: value,
          },
        },
      },
    }));
  }

  function setShowLearning(value: boolean) {
    setConfig((cfg) => ({
      ...cfg,
      socialConfig: {
        ...cfg.socialConfig,
        publicProfile: { ...cfg.socialConfig.publicProfile, showLearningContent: value },
      },
    }));
  }

  const myHandle = (player.identity?.email ?? "")
    .split("@")[0]
    .toLowerCase()
    .replace(/\./g, "");
  const previewHref = myHandle ? `/u/${myHandle}` : "/u/oznakash";

  return (
    <div className="space-y-5">
      <header>
        <h2 className="h2">Public Profile policy</h2>
        <p className="muted text-sm">
          What every player's <code className="text-white/80">/u/&lt;handle&gt;</code> page exposes
          by default. Each player can still flip their own toggles in Settings → Network — these
          are the starting state, plus operator-level master switches.
        </p>
      </header>

      {/* 1. Default profile visibility */}
      <section className="card p-5 space-y-3">
        <h3 className="h2 text-lg">Default profile visibility for new sign-ups</h3>
        <p className="muted text-xs">
          Public profiles are discoverable; private require approval. Kid-band profiles are forced
          to Private regardless.
        </p>
        <div className="flex gap-2">
          <button
            className={`btn ${pp.defaultProfileMode === "open" ? "btn-good" : "btn-ghost"} text-sm`}
            onClick={() => setMode("open")}
          >
            🌐 Public
          </button>
          <button
            className={`btn ${pp.defaultProfileMode === "closed" ? "btn-good" : "btn-ghost"} text-sm`}
            onClick={() => setMode("closed")}
          >
            🔒 Private
          </button>
        </div>
      </section>

      {/* 2. Master switch: SSR personalized learning content */}
      <section className="card p-5 space-y-3">
        <h3 className="h2 text-lg">SSR personalized learning content</h3>
        <p className="muted text-xs">
          Whether <code className="text-white/80">/u/&lt;handle&gt;</code> renders the per-Signal{" "}
          <code className="text-white/80">&lt;details&gt;</code> blocks with sample sparks +
          "what you'd learn" rundowns. Optimized for Google + GPTBot + ClaudeBot ingestion.
          Off = bare profile only (header + activity sparkline).
        </p>
        <FieldToggle
          label="Show personalized learning content on public profiles (SEO + AI ingestion)"
          checked={pp.showLearningContent}
          onChange={setShowLearning}
        />
      </section>

      {/* 3. Per-field defaults */}
      <section className="card p-5 space-y-3">
        <h3 className="h2 text-lg">Default field visibility for new users</h3>
        <p className="muted text-xs">
          When a player signs up, these are their starting Network-view toggles. They can flip
          any of them later — this is the policy, not a hard ceiling.
        </p>
        <div className="space-y-2">
          <FieldToggle
            label="Show full name (otherwise first-name only)"
            checked={pp.defaults.showFullName}
            onChange={(v) => setDefault("showFullName", v)}
          />
          <FieldToggle
            label="Show currently working on (Topic + level)"
            checked={pp.defaults.showCurrent}
            onChange={(v) => setDefault("showCurrent", v)}
          />
          <FieldToggle
            label="Show Topic map (per-Topic XP affinities)"
            checked={pp.defaults.showMap}
            onChange={(v) => setDefault("showMap", v)}
          />
          <FieldToggle
            label="Show 14-day activity sparkline"
            checked={pp.defaults.showActivity}
            onChange={(v) => setDefault("showActivity", v)}
          />
          <FieldToggle
            label="Show badges"
            checked={pp.defaults.showBadges}
            onChange={(v) => setDefault("showBadges", v)}
          />
          <FieldToggle
            label="Show sign-up month"
            checked={pp.defaults.showSignup}
            onChange={(v) => setDefault("showSignup", v)}
          />
          <FieldToggle
            label="Include in the Global Leaderboard"
            checked={pp.defaults.signalsGlobal}
            onChange={(v) => setDefault("signalsGlobal", v)}
          />
        </div>
      </section>

      {/* 4. Preview + reset */}
      <section className="card p-5 space-y-3">
        <h3 className="h2 text-lg">Preview + reset</h3>
        <div className="flex flex-wrap gap-2">
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary text-sm"
          >
            👁 Preview /u/{myHandle || "your-handle"}
          </a>
        </div>
        <p className="muted text-xs">
          The preview opens the SSR public-profile HTML in a new tab. Use it to verify the
          policy before saving — this is exactly what crawlers and link-unfurlers see.
        </p>
      </section>

      {/* 5. What's still server-side */}
      <section className="card p-5 space-y-2">
        <h3 className="h2 text-lg">Roadmap</h3>
        <ul className="text-sm text-white/70 space-y-1.5 list-disc pl-5">
          <li>
            v1 (this tab): defaults flow into the SPA Network view for fresh sign-ups, master
            toggle on the SSR personalized-learnings section.
          </li>
          <li>
            v2: social-svc lazy-create honors these defaults server-side so the policy is
            enforced at the source.
          </li>
          <li>
            v2: per-field operator force-overrides — pin a setting for every user, e.g. force
            <code className="text-white/80 ml-1">showActivity = false</code> globally.
          </li>
        </ul>
      </section>
    </div>
  );
}

function FieldToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-white/80">{label}</span>
    </label>
  );
}
