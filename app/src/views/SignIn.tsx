import { useEffect, useRef, useState } from "react";
import { decodeIdToken, isGmail, loadGoogleScript } from "../auth/google";
import { serverSignIn, ServerAuthError } from "../auth/server";
import { usePlayer } from "../store/PlayerContext";
import { useAdmin } from "../admin/AdminContext";
import { Mascot } from "../visuals/Mascot";
import { Illustration } from "../visuals/Illustrations";

export function SignIn() {
  const { state, signIn, signInWithSession, setGoogleClientId } = usePlayer();
  const { config: adminCfg, setConfig: setAdminCfg } = useAdmin();
  const isProduction = adminCfg.serverAuth.mode === "production";

  // In production mode, the Client ID is operator-level and lives in
  // admin config (so every browser visiting the deployment uses it).
  // In demo mode it's per-browser and lives on PlayerState — matches the
  // existing offline-first sign-in flow that forks rely on.
  //
  // Migration nicety: if production is on and admin doesn't have a Client ID
  // yet, fall back to the per-browser one from a prior demo-mode session.
  // This avoids forcing the operator to re-paste it after the
  // production-mode rollout.
  const savedClientId = isProduction
    ? adminCfg.serverAuth.googleClientId || state.googleClientId || ""
    : state.googleClientId ?? "";

  // Auto-promote a per-browser Client ID into admin config the first time we
  // see one in production mode. One-shot, runs after admin hydration.
  useEffect(() => {
    if (
      isProduction &&
      !adminCfg.serverAuth.googleClientId &&
      state.googleClientId &&
      state.googleClientId.endsWith(".apps.googleusercontent.com")
    ) {
      setAdminCfg((cfg) => ({
        ...cfg,
        serverAuth: { ...cfg.serverAuth, googleClientId: state.googleClientId ?? "" },
      }));
    }
  }, [isProduction, adminCfg.serverAuth.googleClientId, state.googleClientId, setAdminCfg]);

  const [draft, setDraft] = useState("");
  const [draftMode, setDraftMode] = useState(false);
  const showForm = !savedClientId || draftMode;

  const [err, setErr] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [loadedSDK, setLoadedSDK] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  const saveClientId = (clientId: string) => {
    if (isProduction) {
      setAdminCfg((cfg) => ({
        ...cfg,
        serverAuth: { ...cfg.serverAuth, googleClientId: clientId },
      }));
    } else {
      setGoogleClientId(clientId);
    }
  };

  useEffect(() => {
    if (!savedClientId) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled) return;
        setLoadedSDK(true);
      })
      .catch((e) => setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [savedClientId]);

  useEffect(() => {
    if (!loadedSDK || !window.google || !btnRef.current || !savedClientId) return;
    try {
      window.google.accounts.id.initialize({
        client_id: savedClientId,
        callback: async (resp) => {
          // In production mode we still decode locally for the email check,
          // then ALSO hand the raw token to the server for verification.
          const id = decodeIdToken(resp.credential);
          if (!id?.email) {
            setErr("Could not read your Google identity.");
            return;
          }
          if (!isGmail(id.email)) {
            setErr(`Sorry — Gmail accounts only (got ${id.email}).`);
            return;
          }
          setErr(null);
          if (!isProduction) {
            signIn(id);
            return;
          }
          // Production path: exchange Google ID token for a server session JWT.
          if (!adminCfg.serverAuth.mem0Url) {
            setErr("Production mode is on but the mem0 URL isn't configured.");
            return;
          }
          setSigningIn(true);
          try {
            const session = await serverSignIn(adminCfg.serverAuth.mem0Url, resp.credential);
            signInWithSession(session);
          } catch (e) {
            const msg =
              e instanceof ServerAuthError
                ? `Server rejected sign-in: ${e.message}`
                : `Couldn't reach the server: ${(e as Error).message}`;
            setErr(msg);
          } finally {
            setSigningIn(false);
          }
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "filled_blue",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
      });
    } catch (e) {
      setErr(String(e));
    }
  }, [loadedSDK, savedClientId, signIn, signInWithSession, isProduction, adminCfg.serverAuth.mem0Url]);

  const onDemoEnter = () => {
    setErr(null);
    if (!isGmail(demoEmail)) {
      setErr("Demo mode also requires a @gmail.com address.");
      return;
    }
    signIn({ email: demoEmail.trim(), name: demoEmail.split("@")[0] });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full grid sm:grid-cols-2 gap-6 items-center">
        <div className="flex flex-col items-center sm:items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-accent2 grid place-items-center text-white font-bold shadow-glow">{adminCfg.branding.logoEmoji}</div>
            <div>
              <h1 className="h1">{adminCfg.branding.appName}</h1>
              <p className="muted text-sm">A gamified, micro-dosed AI playbook for builders.</p>
            </div>
          </div>
          <Mascot mood="happy" size={120} message="Hi! I'm Synapse — your build buddy." />
          <ul className="text-sm text-white/70 space-y-1.5 mt-2">
            <li>⚡ 5-minute Sparks. Real depth.</li>
            <li>🔥 Daily streaks for compounding growth.</li>
            <li>🛠️ Build cards you can run in Claude Code.</li>
            <li>🎯 Personalized to you — age, level, goals.</li>
          </ul>
        </div>
        <div className="card p-6 sm:p-7 space-y-4">
          <h2 className="h2">Sign in to start</h2>
          <p className="text-sm text-white/60">
            {isProduction
              ? "Gmail only. Sessions last 7 days and sync across devices."
              : "Gmail only. Your progress is stored locally on this device."}
          </p>

          {showForm && (
            <div className="space-y-2">
              <div className="label">Google OAuth Client ID</div>
              <input
                className="input"
                placeholder="123-xxxxxx.apps.googleusercontent.com"
                value={draft}
                onChange={(e) => setDraft(e.target.value.trim())}
              />
              <button
                className="btn-primary w-full"
                disabled={!draft.endsWith(".apps.googleusercontent.com")}
                onClick={() => {
                  saveClientId(draft);
                  setDraft("");
                  setDraftMode(false);
                }}
              >
                Save Client ID
              </button>
              {savedClientId && draftMode && (
                <button
                  className="btn-ghost w-full text-xs"
                  onClick={() => {
                    setDraft("");
                    setDraftMode(false);
                  }}
                >
                  Cancel — keep the existing Client ID
                </button>
              )}
              <details className="text-xs text-white/50 mt-1">
                <summary className="cursor-pointer hover:text-white/70">How do I get one?</summary>
                <ol className="list-decimal list-inside space-y-1 mt-2">
                  <li>Open <span className="font-mono">console.cloud.google.com</span></li>
                  <li>Create a project → APIs &amp; Services → Credentials</li>
                  <li>Create OAuth client ID (Web). Add this site's URL to Authorized JavaScript origins.</li>
                  <li>Paste the client ID above.</li>
                </ol>
              </details>
            </div>
          )}

          {!showForm && (
            <div className="space-y-3">
              <div ref={btnRef} className="flex justify-center min-h-[44px]" />
              {!loadedSDK && <div className="text-xs text-white/50">Loading Google sign-in…</div>}
              {signingIn && <div className="text-xs text-white/60">Verifying with the server…</div>}
              <button
                className="btn-ghost w-full text-xs"
                onClick={() => {
                  setDraft("");
                  setDraftMode(true);
                }}
              >
                Use a different Client ID
              </button>
            </div>
          )}

          {err && <div className="text-xs text-bad bg-bad/10 border border-bad/30 rounded-lg p-2">{err}</div>}

          {!isProduction && (
            <div className="border-t border-white/5 pt-3">
              <button
                className="text-xs text-white/40 hover:text-white/70"
                onClick={() => setDemoMode((d) => !d)}
              >
                {demoMode ? "Hide demo mode" : "Skip OAuth setup (demo mode, Gmail only)"}
              </button>
              {demoMode && (
                <div className="mt-2 space-y-2">
                  <input
                    className="input"
                    placeholder="you@gmail.com"
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                  />
                  <button className="btn-primary w-full" onClick={onDemoEnter}>
                    Continue (demo)
                  </button>
                  <p className="text-[10px] text-white/40">
                    Demo mode skips real Google auth — just for trying the app locally. Identity is not verified.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-4 right-6 hidden md:block w-32 h-20 opacity-50">
        <Illustration k="rocket" />
      </div>
    </div>
  );
}
