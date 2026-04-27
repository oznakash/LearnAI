import { useEffect, useRef, useState } from "react";
import { decodeIdToken, isGmail, loadGoogleScript } from "../auth/google";
import { usePlayer } from "../store/PlayerContext";
import { Mascot } from "../visuals/Mascot";
import { Illustration } from "../visuals/Illustrations";

export function SignIn() {
  const { state, signIn, setGoogleClientId } = usePlayer();
  const [clientId, setLocalClientId] = useState(state.googleClientId ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [loadedSDK, setLoadedSDK] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientId) return;
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
  }, [clientId]);

  useEffect(() => {
    if (!loadedSDK || !window.google || !btnRef.current || !clientId) return;
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => {
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
          signIn(id);
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
  }, [loadedSDK, clientId, signIn]);

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
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-accent2 grid place-items-center text-white font-bold shadow-glow">BQ</div>
            <div>
              <h1 className="h1">BuilderQuest</h1>
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
          <p className="text-sm text-white/60">Gmail only. Your progress is stored locally on this device.</p>

          {!clientId && (
            <div className="space-y-2">
              <div className="label">Google OAuth Client ID</div>
              <input
                className="input"
                placeholder="123-xxxxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setLocalClientId(e.target.value.trim())}
              />
              <button
                className="btn-primary w-full"
                disabled={!clientId.endsWith(".apps.googleusercontent.com")}
                onClick={() => setGoogleClientId(clientId)}
              >
                Save Client ID
              </button>
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

          {clientId && (
            <div className="space-y-3">
              <div ref={btnRef} className="flex justify-center min-h-[44px]" />
              {!loadedSDK && <div className="text-xs text-white/50">Loading Google sign-in…</div>}
              <button
                className="btn-ghost w-full text-xs"
                onClick={() => {
                  setGoogleClientId("");
                  setLocalClientId("");
                }}
              >
                Use a different Client ID
              </button>
            </div>
          )}

          {err && <div className="text-xs text-bad bg-bad/10 border border-bad/30 rounded-lg p-2">{err}</div>}

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
        </div>
      </div>
      <div className="absolute bottom-4 right-6 hidden md:block w-32 h-20 opacity-50">
        <Illustration k="rocket" />
      </div>
    </div>
  );
}
