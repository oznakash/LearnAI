import { useEffect, useRef, useState } from "react";
import { decodeIdToken, isGmail, loadGoogleScript } from "../auth/google";
import { usePlayer } from "../store/PlayerContext";
import { useAdmin } from "../admin/AdminContext";
import { Mascot } from "../visuals/Mascot";
import { Illustration } from "../visuals/Illustrations";

export function SignIn() {
  const { state: player, signIn } = usePlayer();
  const { config: adminCfg } = useAdmin();

  // The Google OAuth Client ID is a deployment-level value set once by the
  // operator via Admin -> Config. Read it from admin config first; fall
  // back to the legacy per-player localStorage value for installs that
  // configured it through the old SignIn-side input form (pre-PR #20).
  // Players never enter or change this from the SignIn screen anymore.
  const savedClientId = (adminCfg.googleClientId ?? "").trim() || (player.googleClientId ?? "").trim();

  const [err, setErr] = useState<string | null>(null);
  const [loadedSDK, setLoadedSDK] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

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
  }, [loadedSDK, savedClientId, signIn]);

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

          {savedClientId ? (
            <div className="space-y-3">
              <div ref={btnRef} className="flex justify-center min-h-[44px]" />
              {!loadedSDK && <div className="text-xs text-white/50">Loading Google sign-in…</div>}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 space-y-1">
              <div className="font-medium text-white">Google sign-in not configured.</div>
              <div>
                A site admin needs to set the Google OAuth Client ID in
                Admin → Config. Until then, use Demo Mode below.
              </div>
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
