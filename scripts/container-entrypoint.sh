#!/bin/sh
# Boot script for the consolidated SPA + social-svc container.
#
# - Starts nginx (foreground) + Node sidecar (background).
# - Forwards SIGTERM / SIGINT to both so docker stop / cloud-claude
#   redeploy is clean.
# - Exits when either process dies (so cloud-claude restarts the whole
#   container — same blast radius as a single-process service).
#
# Logs:
#   nginx access + error → already routed to /dev/stdout + /dev/stderr
#                          via the upstream nginx:1.27-alpine image.
#   social-svc           → JSON, one line per event, via console.log /
#                          console.error in src/log.ts. stdout / stderr
#                          flow into docker logs → cloud-claude logs.

set -e

NODE_PID=""
NGINX_PID=""

shutdown() {
  echo "[entrypoint] received signal, shutting down both processes…"
  if [ -n "$NODE_PID" ]; then kill -TERM "$NODE_PID" 2>/dev/null || true; fi
  if [ -n "$NGINX_PID" ]; then kill -TERM "$NGINX_PID" 2>/dev/null || true; fi
  wait
  exit 0
}

trap shutdown TERM INT

echo "[entrypoint] starting social-svc on :8787"
node /opt/social-svc/dist/index.js &
NODE_PID=$!

echo "[entrypoint] starting nginx"
nginx -g "daemon off;" &
NGINX_PID=$!

# wait -n: exit as soon as ANY child exits. If either dies, container
# dies and cloud-claude restarts. Better than papering over crashes.
wait -n
EXIT=$?
echo "[entrypoint] one of the processes exited (code=$EXIT) — propagating"
shutdown
exit $EXIT
