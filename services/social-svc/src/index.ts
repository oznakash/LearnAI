// Entry point. Reads env, builds the store, mounts the app, listens on $PORT.
//
// Required env vars (production):
//   JWT_SECRET             — same value as mem0's JWT_SECRET (HS256)
//   SOCIAL_ADMIN_EMAILS    — comma-separated emails granted admin access
//   SOCIAL_DB_PATH         — file path for JSON persistence (mounted volume)
//
// Optional env vars:
//   PORT                       (default 8787)
//   SOCIAL_ALLOWED_ORIGINS     (default "*"; restrict in non-same-origin setups)
//   SOCIAL_DEMO_TRUST_HEADER   (default "0"; "1" enables X-User-Email path —
//                               refused when NODE_ENV=production)
//   NODE_ENV                   (set to "production" on the live deploy)

import { createApp } from "./app.js";
import { createStore } from "./store.js";
import { log } from "./log.js";

const port = parseInt(process.env.PORT ?? "8787", 10);
const dbPath = process.env.SOCIAL_DB_PATH || undefined;
const admins = (process.env.SOCIAL_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const jwtSecret = process.env.JWT_SECRET || "";
const allowedOrigins = process.env.SOCIAL_ALLOWED_ORIGINS || "*";
const demoTrustHeader = process.env.SOCIAL_DEMO_TRUST_HEADER === "1";

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
const app = createApp({ store, admins, jwtSecret, allowedOrigins, demoTrustHeader });

app.listen(port, () => {
  log.info("listening", {
    port,
    db: dbPath ?? "memory-only",
    admins: admins.length,
    jwt: jwtSecret ? "configured" : "missing",
    demo_trust_header: demoTrustHeader,
  });
});
