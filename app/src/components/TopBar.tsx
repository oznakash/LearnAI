import { usePlayer } from "../store/PlayerContext";
import { useMemory } from "../memory/MemoryContext";
import { useAdmin } from "../admin/AdminContext";
import { maxFocus, tierForXP } from "../store/game";
import type { View } from "../App";

export function TopBar({ onNav }: { onNav: (v: View) => void }) {
  const { state } = usePlayer();
  const { backend, status } = useMemory();
  const { config: adminCfg } = useAdmin();
  const tier = tierForXP(state.xp);
  const focusMax = maxFocus();
  // Color-grade the focus pill by remaining ratio so a full bar reads as
  // "good" and a depleted bar reads as "warn/bad". Was previously hardcoded
  // red, which looks alarming when the player has full focus.
  const focusRatio = focusMax > 0 ? Math.max(0, Math.min(1, state.focus / focusMax)) : 0;
  const focusClasses =
    focusRatio >= 0.66
      ? "bg-good/10 text-good border-good/30"
      : focusRatio >= 0.33
        ? "bg-warn/10 text-warn border-warn/30"
        : "bg-bad/10 text-bad border-bad/30";
  const memoryBadge =
    backend === "offline"
      ? { emoji: "📴", label: "Offline mode", classes: "bg-white/5 text-white/70 border-white/10" }
      : status?.ok
      ? { emoji: "🧠", label: "Memory on", classes: "bg-good/10 text-good border-good/30" }
      : { emoji: "🟡", label: "Memory pause", classes: "bg-warn/10 text-warn border-warn/30" };
  const initials = (state.identity?.name ?? state.identity?.email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-ink/70 border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <button
          onClick={() => onNav({ name: "home" })}
          className="flex items-center gap-2 hover:opacity-90"
        >
          <div
            className="w-9 h-9 rounded-xl grid place-items-center text-white font-bold shadow-glow"
            style={{ background: `linear-gradient(135deg, ${adminCfg.branding.accentColor}, ${adminCfg.branding.accent2Color})` }}
          >
            {adminCfg.branding.logoEmoji}
          </div>
          <div className="hidden sm:block">
            <div className="font-display font-bold text-white leading-none">{adminCfg.branding.appName}</div>
            <div className="text-[11px] uppercase tracking-wider text-white/40 leading-none mt-0.5">
              {adminCfg.branding.tagline}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 text-sm">
          <div className="pill bg-warn/10 text-warn border border-warn/30" title="Build Streak">
            🔥 <span className="tabular-nums">{state.streak}</span>
          </div>
          <div className="pill bg-accent/10 text-accent border border-accent/30" title={`${adminCfg.branding.xpUnit} (XP)`}>
            ⚡ <span className="tabular-nums">{state.xp}</span>
          </div>
          <div className={`pill border ${focusClasses}`} title="Focus">
            🧠 <span className="tabular-nums">{state.focus}/{focusMax}</span>
          </div>
          <div className="hidden md:block pill bg-good/10 text-good border border-good/30" title="Guild Tier">
            🏅 {tier}
          </div>
          <button
            onClick={() => onNav({ name: "memory" })}
            className={`hidden md:inline-flex pill border ${memoryBadge.classes}`}
            title={memoryBadge.label}
          >
            {memoryBadge.emoji}
          </button>
          <button
            onClick={() => onNav({ name: "settings" })}
            className="ml-1 w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent2 grid place-items-center text-white font-bold ring-2 ring-white/10 hover:ring-accent/60 transition"
            title={state.identity?.email ?? "Profile"}
          >
            {state.identity?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={state.identity.picture} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-xs">{initials}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
