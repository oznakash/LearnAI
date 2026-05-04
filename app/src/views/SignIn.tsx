import { useEffect, useRef, useState } from "react";
import { decodeIdToken, isGmail, loadGoogleScript } from "../auth/google";
import { fetchPublicAuthConfig, serverSignIn, ServerAuthError } from "../auth/server";
import { usePlayer } from "../store/PlayerContext";
import { useAdmin } from "../admin/AdminContext";
import { Mascot } from "../visuals/Mascot";
import { Illustration } from "../visuals/Illustrations";

/**
 * The official Google "G" mark in flat single-tone form. Sized 1em so it
 * inherits the surrounding button's font-size + color via `currentColor`.
 *
 * Why not Google's pre-rendered button? Their `renderButton` component
 * paints an opinionated white card that fights every dark UI theme. We
 * render it invisibly as a click-through overlay (so the auth flow still
 * fires) and stack our own design-system btn on top — see `docs/design-language.md`.
 */
function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 12.227c0-.815-.073-1.6-.21-2.354H12v4.45h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.232c1.892-1.742 2.981-4.31 2.981-7.624Z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.964-.895 6.619-2.42l-3.232-2.51c-.896.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.598-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        d="M6.402 13.902a6.005 6.005 0 0 1 0-3.804V7.508H3.064a10 10 0 0 0 0 8.984l3.338-2.59Z"
      />
      <path
        fill="currentColor"
        d="M12 5.977c1.47 0 2.787.504 3.823 1.498l2.866-2.867C16.96 2.99 14.696 2 12 2A9.997 9.997 0 0 0 3.064 7.508l3.338 2.59C7.19 7.736 9.395 5.977 12 5.977Z"
      />
    </svg>
  );
}

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

  // Fresh-browser bootstrap. In production mode, if neither admin nor
  // player has a Client ID stored yet, ask mem0 for the operator's public
  // config (mem0 already runs with GOOGLE_OAUTH_CLIENT_ID set). Self-heals
  // a cleared-localStorage / new-device visit without the manual paste.
  // Falls back silently on any failure (network, older mem0 build) — the
  // user can still paste the Client ID by hand.
  useEffect(() => {
    if (
      !isProduction ||
      adminCfg.serverAuth.googleClientId ||
      state.googleClientId ||
      !adminCfg.serverAuth.mem0Url
    ) {
      return;
    }
    let cancelled = false;
    fetchPublicAuthConfig(adminCfg.serverAuth.mem0Url).then((cfg) => {
      if (cancelled || !cfg?.googleClientId) return;
      setAdminCfg((prev) => ({
        ...prev,
        serverAuth: { ...prev.serverAuth, googleClientId: cfg.googleClientId },
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [isProduction, adminCfg.serverAuth.googleClientId, adminCfg.serverAuth.mem0Url, state.googleClientId, setAdminCfg]);

  const [draft, setDraft] = useState("");
  // The Client ID is *only* editable from this screen during first-time
  // bootstrap (no Client ID configured anywhere). After that, edits live in
  // Admin → Authentication. Keeps the user-facing screen clean.
  const showForm = !savedClientId;

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
      // Render Google's button as wide as our card; we then stack it under
      // a custom button via opacity: 0 (see below). 400 is GIS's max width.
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "filled_blue",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
        width: 400,
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
    // Don't pre-fill `name` from the email's local-part — that bleeds the
    // raw handle (including +tags + namespace prefixes) into Onboarding's
    // name field. Onboarding's `deriveDefaultName` will sanitize the
    // email-derived fallback when `name` is absent. See `docs/test-personas.md`.
    signIn({ email: demoEmail.trim() });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full grid sm:grid-cols-2 gap-6 items-center">
        <div className="flex flex-col items-center sm:items-start gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl grid place-items-center text-white font-bold shadow-glow"
              style={{ background: `linear-gradient(135deg, ${adminCfg.branding.accentColor}, ${adminCfg.branding.accent2Color})` }}
            >
              {adminCfg.branding.logoEmoji}
            </div>
            <div>
              <h1 className="h1">{adminCfg.branding.appName}</h1>
              <p className="muted text-sm">{adminCfg.branding.tagline}</p>
            </div>
          </div>
          <Mascot mood="happy" size={120} message={`Hi! I'm ${adminCfg.branding.mascotName} — your build buddy.`} />
          <ul className="text-sm text-white/70 space-y-1.5 mt-2">
            <li>⚡ 5-minute Sparks. Real depth.</li>
            <li>🔥 Daily streaks for compounding growth.</li>
            <li>🛠️ Build cards you can run in Claude Code.</li>
            <li>🎯 Personalized to you — age, level, goals.</li>
          </ul>
        </div>
        <div className="card p-6 sm:p-7 space-y-4">
          <h2 className="h2">Sign in to start</h2>
          <p className="text-sm text-white/60">Learning starts now!</p>

          {showForm ? (
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
                }}
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
                <p className="mt-2 text-white/40">
                  Already configured? An admin can update it later from <span className="font-mono">/admin → Authentication</span>.
                </p>
              </details>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Custom-styled button is purely decorative; the invisible Google
                  button below sits on top and captures the actual click so the
                  GIS auth flow runs unchanged. See `docs/design-language.md`. */}
              <div className="relative">
                <div
                  className="btn-primary w-full pointer-events-none select-none"
                  aria-hidden="true"
                >
                  <GoogleMark className="w-5 h-5" />
                  <span>Continue with Google</span>
                </div>
                <div
                  ref={btnRef}
                  className="absolute inset-0 opacity-0 [&>*]:!w-full [&>*]:!h-full"
                  aria-label="Continue with Google"
                />
              </div>
              {!loadedSDK && <div className="text-xs text-white/50">Loading Google sign-in…</div>}
              {signingIn && <div className="text-xs text-white/60">Verifying with the server…</div>}
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
