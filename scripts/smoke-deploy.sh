#!/usr/bin/env bash
# Post-deploy smoke for LearnAI + mem0. 5 checks, ~3 seconds, no auth.
#
# Verifies the deployment isn't badly broken after a Cloud-Claude rebuild.
# Intentionally lean — round-trip checks (real memory writes, Google sign-in)
# live in scripts/smoke-memory.mjs and require an admin key.
#
# Usage:
#   ./scripts/smoke-deploy.sh
#   MEM0_URL=https://… SPA_URL=https://… ./scripts/smoke-deploy.sh

set -uo pipefail
MEM0="${1:-${MEM0_URL:-https://mem0-09b7ea.cloud-claude.com}}"
SPA="${2:-${SPA_URL:-https://learnai.cloud-claude.com}}"
G=$'\033[32m'; R=$'\033[31m'; X=$'\033[0m'; FAIL=0

ok()  { printf "${G}✓${X} %s\n" "$1"; }
bad() { printf "${R}✗${X} %s — %s\n" "$1" "$2"; FAIL=$((FAIL+1)); }

# 1. mem0 alive
[ "$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$MEM0/health")" = "200" ] \
  && ok "mem0 /health 200" || bad "mem0 /health 200" "down"

# 2. mem0 has every endpoint we expect (one fetch, all paths checked at once)
curl -sS -m 5 "$MEM0/openapi.json" | python3 -c "
import json, sys
want = ['/auth/google','/auth/session','/auth/google/signout','/auth/config','/auth/admin/status','/v1/state']
got = set(json.load(sys.stdin).get('paths',{}))
miss = [p for p in want if p not in got]
sys.exit(0 if not miss else 1)
" \
  && ok "mem0 has /auth/* + /v1/state endpoints" \
  || bad "mem0 endpoints" "missing one of /auth/google /auth/session /auth/google/signout /auth/config /auth/admin/status /v1/state"

# 3. CORS lets the SPA call mem0
curl -sS -m 5 -o /dev/null -w '%{http_code}' -X OPTIONS "$MEM0/auth/google" \
  -H "Origin: $SPA" -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type' \
  | grep -q '^200$' \
  && ok "CORS preflight from $SPA OK" || bad "CORS preflight" "preflight didn't 200"

# 4. SPA serves LearnAI (and not legacy BuilderQuest)
SPA_HTML=$(curl -sS -m 5 "$SPA/")
echo "$SPA_HTML" | grep -q '<title>LearnAI' && ! echo "$SPA_HTML" | grep -q 'BuilderQuest' \
  && ok "SPA / says LearnAI, no BuilderQuest leak" \
  || bad "SPA branding" "title wrong or 'BuilderQuest' still present"

# 5. SPA bundle has the production mem0 URL baked in. Use grep -c (no
# early-exit) instead of -q so the curl pipe never gets SIGPIPE.
BUNDLE=$(echo "$SPA_HTML" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
if [ -n "$BUNDLE" ] && [ "$(curl -sS -m 5 "$SPA$BUNDLE" | grep -c "$MEM0")" -gt 0 ]; then
  ok "SPA bundle references $MEM0"
else
  bad "SPA bundle" "JS doesn't contain the production mem0 URL"
fi

echo
[ "$FAIL" = 0 ] && printf "${G}✅ all 5 checks passed${X}\n" \
                || { printf "${R}❌ %d check(s) failed${X}\n" "$FAIL"; exit 1; }
