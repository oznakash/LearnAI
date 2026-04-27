import { useMemo } from "react";
import { usePlayer } from "../store/PlayerContext";
import { tierForXP } from "../store/game";
import { Mascot } from "../visuals/Mascot";

const FAKE_GUILD: { name: string; xp: number; emoji: string }[] = [
  { name: "Synapse Bot", xp: 1240, emoji: "🤖" },
  { name: "Ada (Architect)", xp: 980, emoji: "🦊" },
  { name: "Marcus", xp: 740, emoji: "🐯" },
  { name: "Priya", xp: 620, emoji: "🦋" },
  { name: "Diego", xp: 410, emoji: "🐻" },
  { name: "Yuki", xp: 270, emoji: "🐰" },
  { name: "Sam", xp: 140, emoji: "🐧" },
  { name: "Rae", xp: 60, emoji: "🐢" },
];

export function Leaderboard() {
  const { state } = usePlayer();
  const me = useMemo(
    () => ({
      name: state.identity?.name ?? state.identity?.email?.split("@")[0] ?? "You",
      xp: state.xp,
      emoji: "🌟",
      isMe: true,
    }),
    [state]
  );
  const players = useMemo(() => {
    const all = [...FAKE_GUILD.map((p) => ({ ...p, isMe: false })), me];
    return all.sort((a, b) => b.xp - a.xp);
  }, [me]);

  const tier = tierForXP(state.xp);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="h1">Guild leaderboard</h1>
          <p className="muted text-sm">Local + bots for now. Cohort sync on the roadmap.</p>
        </div>
        <div className="hidden sm:block">
          <div className="pill bg-good/10 text-good border border-good/30">🏅 You: {tier}</div>
        </div>
      </header>

      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-3">
          <Mascot mood="wow" size={64} />
          <div>
            <div className="font-display font-semibold text-white">This week's standings</div>
            <div className="text-xs text-white/50">Climb tiers by earning Synapses (⚡) and beating Boss Cells.</div>
          </div>
        </div>
        <ol className="space-y-2">
          {players.map((p, i) => (
            <li
              key={p.name + i}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                p.isMe ? "bg-accent/15 border-accent shadow-glow" : "bg-white/5 border-white/10"
              }`}
            >
              <div className={`w-8 h-8 grid place-items-center rounded-full text-sm font-bold ${
                i === 0 ? "bg-warn text-ink2" : i === 1 ? "bg-white/20 text-white" : i === 2 ? "bg-accent2/40 text-ink2" : "bg-white/10 text-white/60"
              }`}>{i + 1}</div>
              <div className="text-2xl">{p.emoji}</div>
              <div className="flex-1">
                <div className="font-semibold text-white">{p.name} {p.isMe && <span className="chip ml-2">you</span>}</div>
                <div className="text-xs text-white/50">{tierForXP(p.xp)}</div>
              </div>
              <div className="font-display tabular-nums text-white">⚡ {p.xp}</div>
            </li>
          ))}
        </ol>
      </div>

      <div className="card p-4 sm:p-5">
        <h2 className="h2">Tiers</h2>
        <ul className="text-sm text-white/70 mt-2 space-y-1.5">
          <li><span className="chip bg-white/5">Builder</span> &lt; 100 ⚡</li>
          <li><span className="chip bg-accent2/10 text-accent2 border-accent2/30">Architect</span> 100+ ⚡</li>
          <li><span className="chip bg-warn/10 text-warn border-warn/30">Visionary</span> 500+ ⚡</li>
          <li><span className="chip bg-bad/10 text-bad border-bad/30">Founder</span> 1500+ ⚡</li>
          <li><span className="chip bg-accent/10 text-accent border-accent/30">Singularity</span> 5000+ ⚡</li>
        </ul>
      </div>
    </div>
  );
}
