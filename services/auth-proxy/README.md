# auth-proxy

Cloudflare Worker that fronts both `social-svc` and `mem0`. Verifies the SPA's Google ID token, injects `X-User-Email` server-side, rate-limits per email, swaps in upstream API keys (kept out of the browser), and forwards.

> Sister docs: [`docs/social-mvp-engineering.md`](../../docs/social-mvp-engineering.md) §6, [`docs/architecture.md`](../../docs/architecture.md).

## Run tests

```bash
npm install
npm test
```

12 tests cover: CORS preflight, /health, missing token → 401, demo-mode passthrough, non-Gmail rejection, header injection on forward, mem0 vs. social-svc routing, per-email rate limits, unknown path 404, upstream error passthrough.

## Deploy

```bash
# 1. one-time
npm install
npm install -g wrangler   # or: npx wrangler ...
wrangler login

# 2. (optional) create a KV namespace for rate limits, paste id into wrangler.toml
wrangler kv namespace create RATE_LIMITS

# 3. set the secrets
wrangler secret put UPSTREAM_KEY_SOCIAL
wrangler secret put UPSTREAM_KEY_MEM0
# Set these public values in wrangler.toml:
#   GOOGLE_OAUTH_CLIENT_ID  - the SPA's OAuth Client ID
#   SOCIAL_SVC_URL          - https://<your-social-svc>
#   MEM0_URL                - https://<your-mem0>

# 4. ship it
wrangler deploy
```

Then point the SPA at the Worker URL:
- `AdminConfig.socialConfig.serverUrl = https://learnai-auth-proxy.<acct>.workers.dev`
- (Optional) point the existing mem0 client at the same Worker too.

## Request shape

The SPA sends:

```
POST /v1/social/follow/priya HTTP/1.1
Host: learnai-auth-proxy.<acct>.workers.dev
X-Id-Token: <Google ID token>
content-type: application/json
```

The Worker verifies, then forwards to social-svc as:

```
POST /v1/social/follow/priya HTTP/1.1
Host: <SOCIAL_SVC_URL>
X-User-Email: maya@gmail.com
Authorization: Bearer <UPSTREAM_KEY_SOCIAL>
content-type: application/json
```

If the request path starts with `/v1/memories`, the Worker forwards to `MEM0_URL` with `UPSTREAM_KEY_MEM0` instead. Same auth model.

## Demo mode

For forks running locally without OAuth, set `ALLOW_DEMO_HEADER = "1"` in `wrangler.toml`. The Worker will accept `X-User-Email` directly when `X-Id-Token` is absent. Don't enable this in production.

## Rate limits

Per-email sliding windows, 1-minute granularity, KV-backed. Defaults match the engineering plan §6.3:

| Action | per minute | per hour |
|---|---|---|
| social write | 60 | 600 |
| social read | 600 | 6000 |
| social report | 5 | 20 |
| social snapshot | 60 | 1800 |
| mem0 write | 30 | 300 |
| mem0 read | 600 | 6000 |

Tighten or relax these in `src/worker.ts` (`DEFAULT_RULES`) and re-deploy.
