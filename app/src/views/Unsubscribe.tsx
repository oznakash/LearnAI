import { useEffect, useState } from "react";
import { useAdmin } from "../admin/AdminContext";
import { Mascot } from "../visuals/Mascot";

/**
 * Branded one-click unsubscribe page.
 *
 * Email recipients click a link in the footer → land here with a token
 * in the query string → SPA POSTs the token to mem0's
 * `POST /v1/email/unsubscribe?token=…`. Success renders a thank-you
 * card with the brand mascot. Bad / expired tokens render an
 * "expired link" card with a sign-in fallback.
 *
 * Single click, no auth required (HMAC validates server-side).
 */
type Phase = "submitting" | "ok" | "expired" | "error";

export function Unsubscribe() {
  const { config } = useAdmin();
  const [phase, setPhase] = useState<Phase>("submitting");
  const [email, setEmail] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? "";
    if (!token) {
      setPhase("expired");
      return;
    }
    const base = config.serverAuth.mem0Url.replace(/\/+$/, "");
    if (!base) {
      setPhase("error");
      setErrMsg("mem0 URL is not configured for this deployment.");
      return;
    }
    fetch(`${base}/v1/email/unsubscribe?token=${encodeURIComponent(token)}`, {
      method: "POST",
    })
      .then(async (r) => {
        if (r.status === 401) {
          setPhase("expired");
          return;
        }
        if (!r.ok) {
          setPhase("error");
          setErrMsg(`HTTP ${r.status}`);
          return;
        }
        const data = (await r.json()) as { ok?: boolean; email?: string };
        setEmail(data?.email ?? null);
        setPhase("ok");
      })
      .catch((e) => {
        setPhase("error");
        setErrMsg((e as Error).message);
      });
  }, [config.serverAuth.mem0Url]);

  const accent = config.branding.accentColor;
  const accent2 = config.branding.accent2Color;
  const appName = config.branding.appName;

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="card max-w-md w-full p-8 text-center space-y-4">
        <div
          className="mx-auto"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent2})`,
            width: 64,
            height: 64,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          {config.branding.logoEmoji}
        </div>
        <Mascot mood={phase === "ok" ? "happy" : phase === "expired" ? "thinking" : "neutral"} size={120} />

        {phase === "submitting" && (
          <>
            <h1 className="h1">One moment…</h1>
            <p className="muted">Updating your preferences.</p>
          </>
        )}

        {phase === "ok" && (
          <>
            <h1 className="h1">You're unsubscribed.</h1>
            <p className="muted">
              We won't email{" "}
              {email ? <span className="font-mono text-white/80">{email}</span> : "you"} from{" "}
              <strong className="text-white">{appName}</strong> anymore.
            </p>
            <p className="text-xs text-white/50">
              Changed your mind?{" "}
              <a href="/" className="text-accent hover:underline">
                Sign in
              </a>{" "}
              and re-opt-in from Settings.
            </p>
          </>
        )}

        {phase === "expired" && (
          <>
            <h1 className="h1">Link expired or invalid.</h1>
            <p className="muted">
              This unsubscribe link is no longer valid. You can manage email
              preferences after signing in.
            </p>
            <a href="/" className="btn-primary inline-block mt-2">
              Sign in
            </a>
          </>
        )}

        {phase === "error" && (
          <>
            <h1 className="h1">Hmm, something went wrong.</h1>
            <p className="muted">
              {errMsg ?? "We couldn't reach the unsubscribe service."} Try again
              in a minute or sign in to opt out from your Settings.
            </p>
            <a href="/" className="btn-ghost inline-block mt-2">
              Sign in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
