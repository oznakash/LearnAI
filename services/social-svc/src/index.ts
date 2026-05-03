// Entry point. Reads env, builds the store, mounts the app, listens on $PORT.
//
// Required env vars (production):
//   JWT_SECRET                  — same value as mem0's JWT_SECRET (HS256)
//   SOCIAL_ADMIN_EMAILS         — comma-separated emails granted admin access
//   SOCIAL_DB_PATH              — file path for JSON persistence (mounted volume)
//
// Optional env vars:
//   PORT                        (default 8787)
//   SOCIAL_ALLOWED_ORIGINS      (default "*"; restrict in non-same-origin setups)
//   SOCIAL_DEMO_TRUST_HEADER    (default "0"; "1" enables X-User-Email path
//                                — refused when NODE_ENV=production)
//   SOCIAL_UPLOADS_ROOT         (default "/data/uploads"; same volume that
//                                holds SOCIAL_DB_PATH. nginx serves it via
//                                `location /i/`.)
//   NODE_ENV                    (set to "production" on the live deploy)
//
// Storage path: in-memory + JSON-file persistence on the mounted volume.
// A Postgres adapter is intentionally NOT shipped here — the engineering
// plan retains it for the scale-out moment, not Sprint 2.5.

import { createApp } from "./app.js";
import { createStore } from "./store.js";
import { log } from "./log.js";
import { startSpotlightCron } from "./spotlight.js";

const port = parseInt(process.env.PORT ?? "8787", 10);
const dbPath = process.env.SOCIAL_DB_PATH || undefined;
const admins = (process.env.SOCIAL_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const jwtSecret = process.env.JWT_SECRET || "";
const allowedOrigins = process.env.SOCIAL_ALLOWED_ORIGINS || "*";
const demoTrustHeader = process.env.SOCIAL_DEMO_TRUST_HEADER === "1";
const uploadsRoot = process.env.SOCIAL_UPLOADS_ROOT || undefined;

if (process.env.NODE_ENV === "production") {
  if (!jwtSecret) {
    log.error("startup_misconfig", { msg: "JWT_SECRET unset in production — every request will 401" });
  }
  if (!admins.length) {
    log.warn("startup_warn", { msg: "SOCIAL_ADMIN_EMAILS empty — moderation tab will be inaccessible" });
  }
  if (!dbPath) {
    log.warn("startup_warn", { msg: "SOCIAL_DB_PATH unset — running memory-only; restarts lose state" });
  }
}

const store = createStore({ dbPath });
const app = createApp({
  store,
  admins,
  jwtSecret,
  allowedOrigins,
  demoTrustHeader,
  uploadsRoot,
});

// Spotlight cron — emits one `kind="spotlight"` event per Topic
// every ~6 hours. Keeps the Spark Stream alive even for users with
// no follows yet (PRD §4.5 visibility path 3).
startSpotlightCron(store);

app.listen(port, () => {
  log.info("listening", {
    port,
    backend: store.backendName?.() ?? "memory",
    admins: admins.length,
    jwt: jwtSecret ? "configured" : "missing",
    demo_trust_header: demoTrustHeader,
  });
});
