import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "./AdminContext";
import { usePlayer } from "../store/PlayerContext";
import type { ReportReason } from "../social/types";

/**
 * AdminModeration — the report queue.
 *
 * Reads + writes go straight to social-svc's /v1/social/admin/reports
 * endpoints (MVP: protected by SOCIAL_ADMIN_EMAILS server-side, plus
 * the auth-verifying proxy in production). The SocialService
 * interface intentionally does NOT include admin endpoints — admin
 * traffic is rare, request/response shapes are different, and
 * exposing them on the player-facing service would tempt drift.
 *
 * Two queue tabs (Open / Resolved). Each row has 4 resolution actions:
 * Warn, Ban from social, Global ban, No action.
 */

type ResolutionAction = "warned" | "banned-social" | "banned-global" | "no-action";

interface AdminReport {
  id: number;
  reporter: string;
  reported: string;
  reason: ReportReason;
  note?: string;
  context?: Record<string, unknown>;
  status: "open" | "resolved" | "dismissed";
  resolution?: string;
  resolvedBy?: string;
  createdAt: number;
  resolvedAt?: number;
}

const REASON_LABEL: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Harassment",
  "off-topic": "Off-topic",
  impersonation: "Impersonation",
  other: "Other",
};

export function AdminModeration() {
  const { config } = useAdmin();
  const { state: player } = usePlayer();
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [rows, setRows] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Empty serverUrl means "same origin" — production co-hosts social-svc
  // behind the same nginx that serves the SPA at /v1/social/*. Forks
  // running social-svc on a different host set serverUrl explicitly.
  const baseUrl = config.socialConfig.serverUrl.replace(/\/+$/, "");
  const adminEmail = player.identity?.email ?? "";

  const fetchHeaders = useMemo(() => {
    const h: Record<string, string> = {
      "content-type": "application/json",
      "x-user-email": adminEmail,
    };
    // Prefer the player session JWT in production (social-svc verifies
    // it). Demo-mode falls back to the shared apiKey.
    const bearer = player.serverSession?.token || config.socialConfig.apiKey;
    if (bearer) h["authorization"] = `Bearer ${bearer}`;
    return h;
  }, [adminEmail, config.socialConfig.apiKey, player.serverSession?.token]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${baseUrl}/v1/social/admin/reports?status=${tab}`,
        { headers: fetchHeaders },
      );
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setRows([]);
        return;
      }
      setRows((await res.json()) as AdminReport[]);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, baseUrl, adminEmail]);

  const resolve = async (id: number, resolution: ResolutionAction) => {
    if (busyId === id) return;
    setBusyId(id);
    try {
      const res = await fetch(
        `${baseUrl}/v1/social/admin/reports/${id}/resolve`,
        {
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({ resolution }),
        },
      );
      if (!res.ok) {
        setError(`Resolve failed: HTTP ${res.status}`);
        return;
      }
      // Optimistic: drop the row from the open tab.
      if (tab === "open") {
        setRows((rs) => rs.filter((r) => r.id !== id));
      } else {
        await refresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="h2">Moderation</h1>
          <p className="muted text-xs">
            Reports queue. Backed by <code className="text-white/70">{baseUrl || "/v1/social/* (same origin)"}</code>.
          </p>
        </div>
        <div className="flex gap-1.5">
          <TabBtn active={tab === "open"} onClick={() => setTab("open")}>
            Open
          </TabBtn>
          <TabBtn active={tab === "resolved"} onClick={() => setTab("resolved")}>
            Resolved
          </TabBtn>
          <button className="btn-ghost text-xs" onClick={refresh}>
            ↻ Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="card p-3 bg-bad/10 border border-bad/30 text-bad text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-white/50">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-white/50 italic">
          {tab === "open"
            ? "No open reports. Clean inbox."
            : "No resolved reports yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <ReportRow
                row={r}
                isResolved={tab === "resolved"}
                busy={busyId === r.id}
                onResolve={(action) => resolve(r.id, action)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
        active
          ? "bg-accent text-white"
          : "bg-white/5 text-white/60 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function ReportRow({
  row,
  isResolved,
  busy,
  onResolve,
}: {
  row: AdminReport;
  isResolved: boolean;
  busy: boolean;
  onResolve: (action: ResolutionAction) => void;
}) {
  return (
    <article className="card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-white/50">
          #{row.id} · {new Date(row.createdAt).toLocaleString()}
        </div>
        <span
          className={`pill text-xs border ${
            row.reason === "harassment"
              ? "bg-bad/10 text-bad border-bad/30"
              : row.reason === "spam"
                ? "bg-warn/10 text-warn border-warn/30"
                : "bg-white/5 text-white/70 border-white/10"
          }`}
        >
          {REASON_LABEL[row.reason]}
        </span>
      </div>
      <div className="text-sm text-white">
        <span className="text-white/50">Reporter:</span> {row.reporter}
      </div>
      <div className="text-sm text-white">
        <span className="text-white/50">Reported:</span> {row.reported}
      </div>
      {row.note && (
        <div className="text-sm bg-white/5 border border-white/10 rounded-lg p-2 text-white/80">
          {row.note}
        </div>
      )}
      {row.context && Object.keys(row.context).length > 0 && (
        <pre className="text-[11px] bg-white/5 border border-white/10 rounded-lg p-2 text-white/60 overflow-x-auto">
          {JSON.stringify(row.context, null, 2)}
        </pre>
      )}
      {isResolved ? (
        <div className="text-xs text-white/50 pt-1 border-t border-white/5">
          Resolved as <strong className="text-white">{row.resolution}</strong>{" "}
          by {row.resolvedBy}
          {row.resolvedAt && (
            <> · {new Date(row.resolvedAt).toLocaleString()}</>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <ActionBtn variant="ghost" disabled={busy} onClick={() => onResolve("no-action")}>
            ✓ No action
          </ActionBtn>
          <ActionBtn variant="warn" disabled={busy} onClick={() => onResolve("warned")}>
            ⚠ Warn
          </ActionBtn>
          <ActionBtn variant="bad" disabled={busy} onClick={() => onResolve("banned-social")}>
            🚫 Ban from social
          </ActionBtn>
          <ActionBtn variant="bad" disabled={busy} onClick={() => onResolve("banned-global")}>
            🚷 Global ban
          </ActionBtn>
        </div>
      )}
    </article>
  );
}

function ActionBtn({
  variant,
  onClick,
  disabled,
  children,
}: {
  variant: "ghost" | "warn" | "bad";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    variant === "warn"
      ? "bg-warn/15 text-warn hover:bg-warn/25"
      : variant === "bad"
        ? "bg-bad/15 text-bad hover:bg-bad/25"
        : "bg-white/5 text-white/70 hover:bg-white/10";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs px-3 py-1.5 rounded-md font-semibold ${cls}`}
    >
      {children}
    </button>
  );
}
