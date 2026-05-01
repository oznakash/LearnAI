// Entry point for `npm start`. Loads env, builds the store, mounts
// the app, listens on $PORT.

import { createApp } from "./app.js";
import { createStore } from "./store.js";

const port = parseInt(process.env.PORT ?? "8787", 10);
const dbPath = process.env.SOCIAL_DB_PATH || undefined;
const admins = (process.env.SOCIAL_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const upstreamKey = process.env.UPSTREAM_KEY_SOCIAL || "";
const allowedOrigins = process.env.SOCIAL_ALLOWED_ORIGINS || "*";

if (process.env.NODE_ENV === "production" && !upstreamKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[social-svc] WARNING — running in production without UPSTREAM_KEY_SOCIAL. The proxy is bypassable; set this env var so social-svc rejects direct calls.",
  );
}

const store = createStore({ dbPath });
const app = createApp({ store, admins, upstreamKey, allowedOrigins });

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[social-svc] listening on :${port} (db=${dbPath ?? "memory-only"})`);
});
