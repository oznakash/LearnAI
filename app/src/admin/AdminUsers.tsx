import { useMemo, useState } from "react";
import { useAdmin } from "./AdminContext";
import type { EmailTemplateId, MockUser } from "./types";

type SortKey = "lastSeen" | "xp" | "streak" | "signup";

export function AdminUsers() {
  const { mockUsers, banUser, resetUserProgress, sendTemplateToUser, config } = useAdmin();
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastSeen");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [selected, setSelected] = useState<MockUser | null>(null);

  const filtered = useMemo(() => {
    let list = mockUsers.slice();
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(needle) ||
          u.name.toLowerCase().includes(needle)
      );
    }
    if (tierFilter !== "all") list = list.filter((u) => u.tier === tierFilter);
    if (statusFilter === "active") list = list.filter((u) => !u.banned);
    if (statusFilter === "banned") list = list.filter((u) => u.banned);
    list.sort((a, b) => {
      switch (sortKey) {
        case "xp": return b.xp - a.xp;
        case "streak": return b.streak - a.streak;
        case "signup": return b.signupAt - a.signupAt;
        case "lastSeen":
        default: return b.lastSeenAt - a.lastSeenAt;
      }
    });
    return list;
  }, [mockUsers, q, sortKey, tierFilter, statusFilter]);

  const enabledTemplates = Object.values(config.emailTemplates).filter((t) => t.enabled);

  return (
    <div className="space-y-4">
      <section className="card p-4 space-y-3">
        <div className="grid sm:grid-cols-4 gap-2">
          <input
            className="input sm:col-span-2"
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
            <option value="all">All tiers</option>
            <option value="Builder">Builder</option>
            <option value="Architect">Architect</option>
            <option value="Visionary">Visionary</option>
            <option value="Founder">Founder</option>
            <option value="Singularity">Singularity</option>
          </select>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as never)}>
            <option value="all">Active + banned</option>
            <option value="active">Active only</option>
            <option value="banned">Banned only</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-white/50">Sort:</span>
          {(["lastSeen", "xp", "streak", "signup"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`pill text-xs ${sortKey === k ? "bg-accent/20 border border-accent text-white" : "bg-white/5 border border-white/10 text-white/70"}`}
            >
              {k}
            </button>
          ))}
          <span className="text-white/40 ml-auto">{filtered.length} / {mockUsers.length}</span>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-white/50 border-b border-white/5">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Tier</th>
                <th className="p-3 text-right">⚡ XP</th>
                <th className="p-3 text-right">🔥 Streak</th>
                <th className="p-3 text-right">Sparks</th>
                <th className="p-3">Last seen</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className={`border-b border-white/5 ${u.isCurrentUser ? "bg-accent/5" : ""}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {u.picture ? (
                        <img src={u.picture} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent2 grid place-items-center text-xs font-bold">
                          {u.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-white">
                          {u.name}
                          {u.isCurrentUser && <span className="chip ml-1 text-[10px]">you</span>}
                        </div>
                        <div className="text-[11px] text-white/50">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><span className="chip text-[11px]">🏅 {u.tier}</span></td>
                  <td className="p-3 text-right tabular-nums">{u.xp.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{u.streak}</td>
                  <td className="p-3 text-right tabular-nums">{u.totalSparks}</td>
                  <td className="p-3 text-white/70">{daysAgo(u.lastSeenAt)}</td>
                  <td className="p-3">
                    {u.banned ? (
                      <span className="chip bg-bad/20 border-bad/40 text-bad text-[11px]">banned</span>
                    ) : (
                      <span className="chip bg-good/20 border-good/40 text-good text-[11px]">active</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button className="text-xs text-accent hover:underline" onClick={() => setSelected(u)}>manage →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="card max-w-lg w-full p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-white/50">User</div>
                <h2 className="h2">{selected.name}</h2>
                <div className="text-sm text-white/60">{selected.email}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="chip text-[11px]">🏅 {selected.tier}</span>
                  <span className="chip text-[11px]">⚡ {selected.xp}</span>
                  <span className="chip text-[11px]">🔥 {selected.streak}d</span>
                  <span className="chip text-[11px]">📅 joined {daysAgo(selected.signupAt)}</span>
                </div>
              </div>
              <button className="text-white/40 hover:text-white text-xl" onClick={() => setSelected(null)}>✕</button>
            </header>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Stat label="Sparks" value={selected.totalSparks} />
              <Stat label="Minutes" value={selected.totalMinutes} />
              <Stat label="Days active" value={selected.daysActive} />
            </div>

            <div className="space-y-2">
              <div className="label">Actions</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`btn-ghost ${selected.banned ? "text-good" : "text-bad"}`}
                  onClick={() => {
                    banUser(selected.id, !selected.banned);
                    setSelected({ ...selected, banned: !selected.banned });
                  }}
                >
                  {selected.banned ? "Unban" : "Ban"}
                </button>
                <button
                  className="btn-ghost text-warn"
                  onClick={() => {
                    if (!confirm("Reset this user's progress?")) return;
                    resetUserProgress(selected.id);
                    setSelected({ ...selected, xp: 0, streak: 0, totalSparks: 0, totalMinutes: 0, daysActive: 0 });
                  }}
                >
                  Reset progress
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="label">Send a lifecycle email</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {enabledTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      sendTemplateToUser(selected.id, t.id as EmailTemplateId);
                    }}
                    className="text-left p-2 rounded-xl border border-white/10 bg-white/5 hover:border-white/30 text-sm"
                  >
                    <div className="font-semibold text-white">📧 {t.name}</div>
                    <div className="text-[11px] text-white/50 truncate">{t.subject}</div>
                  </button>
                ))}
                {enabledTemplates.length === 0 && (
                  <div className="text-xs text-white/50">No templates enabled. Open the Emails tab to enable some.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <EmailQueue />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-2">
      <div className="text-2xl font-display font-bold text-white tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/50">{label}</div>
    </div>
  );
}

function daysAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / (24 * 3600 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function EmailQueue() {
  const { config, flushQueue } = useAdmin();
  if (config.emailQueue.length === 0) return null;
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="h2">Outbound queue</h3>
        <button className="btn-ghost text-xs" onClick={flushQueue}>Mark all sent</button>
      </div>
      <ul className="text-sm space-y-1 max-h-64 overflow-y-auto">
        {config.emailQueue.map((q) => (
          <li key={q.id} className="flex items-center justify-between border-b border-white/5 py-1.5">
            <div className="truncate">
              <span className="chip text-[10px] mr-2">{q.status}</span>
              <span className="text-white">{q.to}</span>
              <span className="text-white/50 ml-2">— {q.subjectRendered}</span>
            </div>
            <span className="text-[10px] text-white/40 ml-2">{new Date(q.queuedAt).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
