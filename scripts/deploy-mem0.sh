#!/usr/bin/env bash
# Deploys the BuilderQuest mem0 cognition layer to Fly.io.
#
# All decisions are pre-made:
#   - app:                builderquest-mem0
#   - region:             iad (us-east — closest to most North-American users)
#   - postgres:           Fly's managed Postgres (1 GB disk, free tier)
#   - image:              ghcr.io/oznakash/mem0:latest
#   - LLM provider:       openai (faster + cheaper for fact extraction than Claude)
#   - bearer key:         randomly generated via `openssl rand -hex 32`
#   - scale-to-zero:      yes (auto_stop_machines = "stop", min = 0)
#
# Idempotent — safe to re-run. Existing app/database/secrets are reused.
#
# What you must provide via env BEFORE running:
#   OPENAI_API_KEY  (or ANTHROPIC_API_KEY + LLM_PROVIDER=anthropic)
#
# Usage:
#   OPENAI_API_KEY=sk-... ./scripts/deploy-mem0.sh
#
# Optional overrides:
#   APP=my-mem0 REGION=lhr ./scripts/deploy-mem0.sh

set -euo pipefail

APP="${APP:-builderquest-mem0}"
DB_APP="${DB_APP:-${APP}-db}"
REGION="${REGION:-iad}"
IMAGE="${MEM0_IMAGE:-ghcr.io/oznakash/mem0:latest}"
LLM_PROVIDER="${LLM_PROVIDER:-openai}"

bold() { printf "\n\033[1m== %s ==\033[0m\n" "$*"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }
die()  { printf "  \033[31m✗\033[0m %s\n" "$*" >&2; exit 1; }

command -v fly >/dev/null 2>&1 || die "fly CLI not found. Install: curl -L https://fly.io/install.sh | sh"
command -v openssl >/dev/null 2>&1 || die "openssl not found."

# Provider check.
if [ "${LLM_PROVIDER}" = "openai" ] && [ -z "${OPENAI_API_KEY:-}" ]; then
  die "OPENAI_API_KEY must be set (or set LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY)."
fi
if [ "${LLM_PROVIDER}" = "anthropic" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  die "ANTHROPIC_API_KEY must be set."
fi

bold "1. Authentication"
fly auth whoami >/dev/null 2>&1 || die "Not logged in to Fly. Run: fly auth login"
ok "Logged in as $(fly auth whoami)"

bold "2. App: ${APP}"
if fly apps list --json 2>/dev/null | grep -q "\"Name\":\"${APP}\""; then
  ok "App ${APP} already exists — reusing."
else
  fly launch --no-deploy --copy-config --name "${APP}" --region "${REGION}" --yes
  ok "App ${APP} created in ${REGION}."
fi

bold "3. Postgres: ${DB_APP}"
if fly apps list --json 2>/dev/null | grep -q "\"Name\":\"${DB_APP}\""; then
  ok "Postgres ${DB_APP} already exists — reusing."
else
  fly postgres create --name "${DB_APP}" --region "${REGION}" \
    --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1
  ok "Postgres ${DB_APP} created."
fi

bold "4. Attach Postgres → ${APP}"
if fly secrets list -a "${APP}" 2>/dev/null | grep -q "DATABASE_URL"; then
  ok "DATABASE_URL already set — skipping attach."
else
  fly postgres attach -a "${APP}" "${DB_APP}" --yes
  ok "Attached. DATABASE_URL is now set."
fi

bold "5. Secrets"
SECRET_KEY="${MEM0_API_KEY:-$(openssl rand -hex 32)}"
SECRETS=(
  "MEM0_API_KEY=${SECRET_KEY}"
  "MEM0_LLM_PROVIDER=${LLM_PROVIDER}"
)
[ -n "${OPENAI_API_KEY:-}" ]    && SECRETS+=("OPENAI_API_KEY=${OPENAI_API_KEY}")
[ -n "${ANTHROPIC_API_KEY:-}" ] && SECRETS+=("ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}")
fly secrets set "${SECRETS[@]}" -a "${APP}" --stage
ok "Secrets staged."

bold "6. Deploy"
fly deploy --image "${IMAGE}" -a "${APP}" --strategy=immediate
ok "Deployed."

URL="https://${APP}.fly.dev"
bold "Done"
echo "  • URL:        ${URL}"
echo "  • Health:     ${URL}/health"
echo "  • Bearer key: ${SECRET_KEY}"
echo
echo "Next: open BuilderQuest → Admin Console → Memory tab → paste the URL + key."
echo "Verify with:   ./scripts/smoke-memory.mjs ${URL} ${SECRET_KEY}"
