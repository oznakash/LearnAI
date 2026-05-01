# The Cloud-Claude MCP — operator superpower for autonomous delivery

> _When the deploy gets weird, you don't need to leave the chat._

LearnAI runs on Cloud-Claude. The platform exposes an MCP server that lets a Claude Code session **read + mutate the deploy directly** — list resources, read container logs, set env vars, mount volumes, redeploy, roll back, manage domains. This page is the integration playbook every autonomous-delivery agent should read once and refer back to.

## When to use it

Use the Cloud-Claude MCP for anything that today would require either:

- the operator clicking around the Cloud-Claude dashboard,
- the operator pasting `psql` / `curl` output back into chat,
- the operator setting an env var by hand and waiting for redeploy,
- the agent guessing at deploy state ("is the new code live yet?"),
- the agent reasoning about an outage from public probes alone.

If the answer is in Cloud-Claude, the MCP gets it in one tool call.

## When **not** to use it

- Local-machine work (npm test, npm run build, git, file edits) — use Bash.
- Public-surface verification — use the existing `npm run smoke:deploy` (1-second smoke against /health, /openapi.json, CORS, SPA bundle, etc.). It's faster and doesn't need the MCP attached.
- Reading the SPA's user-side state — that's localStorage on the user's browser, not Cloud-Claude.

## Enabling it (once per shell)

```sh
claude mcp add cloud-claude -- npx -y @cloud-claude/mcp
```

The `--` separator is required: it tells `claude mcp add` where the server name ends and the launch command begins. **Existing Claude Code sessions will not pick up the new server until they restart** (`/quit` and reopen with `/resume` to keep transcript). Confirm it loaded by searching the deferred-tool registry for `cloud-claude` in the new session.

## The 36 tools, grouped by what they do

### Inventory and introspection (read-only)

| Tool | Why you'd call it |
|---|---|
| `list_projects` | Map all tenant projects you can see. |
| `describe_project` | **The single best call to start any operation** — composite snapshot of every resource, latest deploy, custom domains, env-var counts. One call, full picture. |
| `list_resources` | Cheaper than `describe_project` when you only need IDs + slugs. |
| `list_env_vars` | Read keys + decrypted values for one resource. **Secrets enter your context** when you call this — be deliberate. |
| `list_domains` | Custom domains attached to a resource. |
| `list_recipes` | Available app catalog entries. |
| `get_app_url` | Base URL for an app resource. |
| `get_credentials` | Connection credentials for a database resource. |
| `get_resource_access_url` | Public URL to access a specific resource. |

### Logs and live state (read-only)

| Tool | Why you'd call it |
|---|---|
| `get_logs` | Container stdout/stderr (last N lines, default 100). The first thing to call when a deploy is misbehaving. |
| `get_container_stats` | Live CPU / memory / restart count. Use to investigate "why is this slow" or "is it OOM-ing." |
| `get_deployment_status` | Status + duration of the most recent deploy for a resource. Useful for polling after a redeploy. |
| `tail_deploy_log` | Stream the in-flight build/deploy log. Pair with a deploy tool to watch it land. |

### Deploy lifecycle (mutations)

| Tool | Why you'd call it |
|---|---|
| `deploy_app` | Deploy or update an app from a recipe / repo / image. |
| `redeploy_app` | Force a fresh container without changing config. The fastest way to pick up a new image tag or external state change. |
| `restart_app` | Restart the existing container without redeploying. |
| `rollback_to_image` | Revert to a previously-built image. The break-glass for a bad deploy. |
| `set_resource_image` | Pin or change the Docker image for an app. |
| `connect_repo` | Link a GitHub repo so pushes auto-deploy. |
| `run_recipe` | Provision a catalog item end-to-end. |

### Configuration (mutations — these often trigger a redeploy)

| Tool | Why you'd call it |
|---|---|
| `set_env_var` | Add or change an env var. Triggers a redeploy unless you opt out. |
| `delete_env_var` | Remove one. |
| `set_volume_path` | Mount a persistent volume at a container path. The escape hatch when an upstream image expects writes to survive rebuilds. **Doesn't apply to type=database resources** — those have their own platform-managed storage. |
| `set_exposure_mode` | Public / private / internal-only. |
| `set_resource_category` | Tagging for the dashboard. |
| `set_power_state` | Pause or resume an app to save cost. |
| `rename_resource` / `rename_project` | Cosmetic, but updates URLs / slugs. |
| `delete_resource` | Tear down. Permanent — no soft-delete. |

### Domains and TLS (mutations)

| Tool | Why you'd call it |
|---|---|
| `add_domain` | Attach a custom domain to a resource. |
| `verify_domain` | Run the verification handshake (DNS / TXT). |
| `set_domain_tls_mode` | Platform-managed TLS vs. bring-your-own. |
| `remove_domain` | Detach. |
| `create_database` | Provision a managed Postgres / pgvector. |

## Audit recipe — one-call-then-pivot

The shape of a clean infra audit is **always** this:

1. `list_projects` → find your project ID. (One call, ~10 ms.)
2. `describe_project(projectId)` → composite snapshot. **Stop here unless you need to dig.** This single call replaces what used to be `list_resources` + `list_env_vars` + `list_domains` + `get_deployment_status` × N.
3. From the snapshot, branch:
   - **Boot or runtime issue** → `get_logs(resourceId, lines=200)` → look for the failing line, fix forward.
   - **Env config check** → `list_env_vars(resourceId)` → diff against expected. (Secrets land in context — flag the user.)
   - **Deploy in flight** → `get_deployment_status(resourceId)` (poll) or `tail_deploy_log(resourceId)` (stream).
   - **Storage hypothesis** → check `volumePath` on the resource in step 2's output. If absent and the upstream image needs it, call `set_volume_path` with a single path string.
   - **Performance complaint** → `get_container_stats(resourceId)`.

Don't chain reads beyond what the diagnosis requires. Public smoke (`npm run smoke:deploy`) covers the "is anything wrong externally" question; the MCP covers the "where's it wrong internally" question.

## Patterns to bank

### Rotate `JWT_SECRET` on mem0

```
1. set_env_var(resourceId=<mem0>, key="JWT_SECRET", value="<new>")
   → triggers redeploy automatically
2. get_deployment_status(resourceId=<mem0>) until status=success
3. Smoke: npm run smoke:deploy (no auth changed for new sign-ins)
```

Side effect: every active session JWT invalidates. Tell the user this is intentional.

### Add a custom domain end-to-end

```
1. add_domain(resourceId=<spa>, domain="learnai.com")
2. (Operator updates DNS — point the record to the platform target shown in the response.)
3. verify_domain(domainId=<from step 1>)
4. set_domain_tls_mode(domainId=<...>, mode="platform")
```

### Fix a deploy that's stuck

```
1. get_logs(resourceId, lines=200) → identify the failing line
2. Fix forward: change source / env var / image
3. redeploy_app(resourceId)
4. tail_deploy_log(resourceId) → confirm it lands
```

### Reset a resource to a known-good image (break-glass)

```
1. rollback_to_image(resourceId, imageTag="<known-good>")
2. get_deployment_status(resourceId) until success
3. Diagnose the bad commit out-of-band — the rollback bought you time.
```

## Security and safety rules

1. **Secrets enter your context** when you call `list_env_vars`, `get_credentials`, or anything else that returns a value. Treat that context as if it were the contents of a `.env` file: never echo, redact when summarizing, and warn the user that the values landed in chat.
2. **`delete_resource` is permanent.** There is no undo. Always confirm intent in chat first, even with the autonomous-delivery directive.
3. **`rollback_to_image` and `redeploy_app` cause downtime windows** of seconds to a minute. Note it in the message that triggers the action.
4. **`set_env_var` triggers a redeploy.** If you're batching multiple env-var changes, do them in one go where the platform supports it; otherwise the tenant gets N rolling restarts.
5. **Don't auto-run `delete_*` or `rollback_*` from a /loop or scheduled job.** Those are one-shot, deliberate actions only.
6. **Read-only tools are free to use proactively.** `describe_project` / `get_logs` / `get_deployment_status` have no side effects — when in doubt, look first.

## How this fits the autonomous-delivery directive

The standing directive in [`CLAUDE.md`](../CLAUDE.md) says: plan, build, test, doc, merge — don't ask permission. The Cloud-Claude MCP is the deploy-side half of that loop. Without it the agent has to hand work back to the operator at every infra boundary; with it, the agent can:

- verify post-merge that Cloud-Claude actually picked up the new commit,
- introspect a misbehaving deploy without `ssh` or terminal paste-back,
- rotate or set env vars as part of the same PR flow that introduces them,
- fix forward on a bad deploy without waiting for the operator,
- close the operator-checklist's "what survives a rebuild?" question with one call instead of speculation.

It does not replace good engineering: tests still need to be green before merge, smoke tests still run after deploy, the operator stays in the loop on irreversible actions. It removes the "ask the operator to paste output" step from every other interaction.

## See also

- [`architecture.md`](./architecture.md) — the system this MCP introspects.
- [`operator-checklist.md`](./operator-checklist.md) — the operational steps the MCP automates away.
- [`server-auth-plan.md`](./server-auth-plan.md) — the auth + state + persistence story that's now the system of record.
- [`../scripts/smoke-deploy.sh`](../scripts/smoke-deploy.sh) — the public-surface smoke test (preferred over MCP for routine post-deploy checks).
