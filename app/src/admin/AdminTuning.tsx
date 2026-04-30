import { useAdmin } from "./AdminContext";
import { DEFAULT_TUNING } from "./defaults";
import type { GameTuning } from "./types";

interface NumProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  onChange: (v: number) => void;
}

function NumberRow({ label, value, min, max, step = 1, hint, onChange }: NumProps) {
  return (
    <label className="grid grid-cols-[1fr_120px] items-center gap-3 text-sm py-1.5 border-b border-white/5">
      <div>
        <div className="text-white">{label}</div>
        {hint && <div className="text-[11px] text-white/40">{hint}</div>}
      </div>
      <input
        type="number"
        className="input py-1.5 text-right tabular-nums"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isFinite(v)) return;
          onChange(v);
        }}
      />
    </label>
  );
}

export function AdminTuning() {
  const { config, setConfig } = useAdmin();
  const t = config.tuning;
  const set = (mutate: (cur: GameTuning) => GameTuning) =>
    setConfig((cfg) => ({ ...cfg, tuning: mutate(cfg.tuning) }));
  const setXp = (key: keyof GameTuning["xp"], v: number) =>
    set((cur) => ({ ...cur, xp: { ...cur.xp, [key]: v } }));
  const setFocus = (key: keyof GameTuning["focus"], v: number) =>
    set((cur) => ({ ...cur, focus: { ...cur.focus, [key]: v } }));
  const setTier = (key: keyof GameTuning["tiers"], v: number) =>
    set((cur) => ({ ...cur, tiers: { ...cur.tiers, [key]: v } }));
  const reset = () => set(() => ({ ...DEFAULT_TUNING, xp: { ...DEFAULT_TUNING.xp }, focus: { ...DEFAULT_TUNING.focus }, tiers: { ...DEFAULT_TUNING.tiers } }));

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="h2">🎮 Game tuning</h2>
          <p className="muted text-sm">Every controllable game variable. Changes apply immediately to the running app.</p>
        </div>
        <button className="btn-ghost text-sm" onClick={reset}>↺ Reset to defaults</button>
      </header>

      <section className="card p-5 space-y-2">
        <h3 className="font-display font-semibold text-white">XP awards ({config.branding.xpUnit} ⚡)</h3>
        <NumberRow label="MicroRead" value={t.xp.microread} min={0} hint="Reading a concept card." onChange={(v) => setXp("microread", v)} />
        <NumberRow label="Tip & Trick" value={t.xp.tip} min={0} hint="Default tip XP (per-tip override still wins)." onChange={(v) => setXp("tip", v)} />
        <NumberRow label="Build Card (tried)" value={t.xp.buildcard} min={0} onChange={(v) => setXp("buildcard", v)} />
        <NumberRow label="Quick Pick — correct" value={t.xp.quickpickCorrect} min={0} onChange={(v) => setXp("quickpickCorrect", v)} />
        <NumberRow label="Quick Pick — wrong" value={t.xp.quickpickWrong} min={0} onChange={(v) => setXp("quickpickWrong", v)} />
        <NumberRow label="Fill the Stack — correct" value={t.xp.fillstackCorrect} min={0} onChange={(v) => setXp("fillstackCorrect", v)} />
        <NumberRow label="Fill the Stack — wrong" value={t.xp.fillstackWrong} min={0} onChange={(v) => setXp("fillstackWrong", v)} />
        <NumberRow label="Field Scenario — correct" value={t.xp.scenarioCorrect} min={0} onChange={(v) => setXp("scenarioCorrect", v)} />
        <NumberRow label="Field Scenario — wrong" value={t.xp.scenarioWrong} min={0} onChange={(v) => setXp("scenarioWrong", v)} />
        <NumberRow label="Pattern Match — correct" value={t.xp.patternmatchCorrect} min={0} onChange={(v) => setXp("patternmatchCorrect", v)} />
        <NumberRow label="Pattern Match — wrong" value={t.xp.patternmatchWrong} min={0} onChange={(v) => setXp("patternmatchWrong", v)} />
        <NumberRow label="Boss Cell — pass" value={t.xp.bossPass} min={0} onChange={(v) => setXp("bossPass", v)} />
        <NumberRow label="Boss Cell — fail" value={t.xp.bossFail} min={0} onChange={(v) => setXp("bossFail", v)} />
      </section>

      <section className="card p-5 space-y-2">
        <h3 className="font-display font-semibold text-white">Focus 🧠</h3>
        <NumberRow label="Max focus (hearts)" value={t.focus.max} min={1} max={20} onChange={(v) => setFocus("max", v)} />
        <NumberRow label="Regen interval (minutes)" value={t.focus.regenMinutes} min={1} max={240} onChange={(v) => setFocus("regenMinutes", v)} />
      </section>

      <section className="card p-5 space-y-2">
        <h3 className="font-display font-semibold text-white">Guild Tier thresholds 🏅</h3>
        <p className="text-[11px] text-white/40">XP needed to enter each tier.</p>
        <NumberRow label="Architect" value={t.tiers.architect} min={1} onChange={(v) => setTier("architect", v)} />
        <NumberRow label="Visionary" value={t.tiers.visionary} min={1} onChange={(v) => setTier("visionary", v)} />
        <NumberRow label="Founder" value={t.tiers.founder} min={1} onChange={(v) => setTier("founder", v)} />
        <NumberRow label="Singularity" value={t.tiers.singularity} min={1} onChange={(v) => setTier("singularity", v)} />
      </section>

      <section className="card p-5 space-y-2">
        <h3 className="font-display font-semibold text-white">Boss</h3>
        <NumberRow
          label="Pass ratio"
          value={Number((t.bossPassRatio).toFixed(3))}
          min={0}
          max={1}
          step={0.05}
          hint="Fraction of boss questions that must be correct (0..1). 0.66 = 2 of 3."
          onChange={(v) => set((cur) => ({ ...cur, bossPassRatio: Math.max(0, Math.min(1, v)) }))}
        />
      </section>

      <section className="card p-4 text-xs text-white/60">
        <strong className="text-white/80">Note:</strong> values are stored in the admin config, not in code. They take effect on the next interaction. To version-control your tuning, paste the JSON below into your repo.
        <pre className="mt-2 rounded-lg bg-black/40 border border-white/10 p-3 font-mono text-[11px] whitespace-pre-wrap">{JSON.stringify(t, null, 2)}</pre>
      </section>
    </div>
  );
}
