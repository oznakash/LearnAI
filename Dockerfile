# LearnAI — single container that serves the SPA + the social-svc sidecar.
#
# Three build stages:
#   1. spa-build      — vite-builds the React SPA → /dist/
#   2. social-build   — tsc-builds services/social-svc → JS in /dist/
#   3. runtime        — alpine + nginx + node22; serves both processes via
#                       a tiny entrypoint.sh that forwards signals.
#
# Why one container:
#   The SPA and social-svc are two processes but a single deploy unit.
#   Operating two cloud-claude services (one for each) would double the
#   ops surface for no value at LearnAI's stage. mem0 stays its own
#   service because it's Python + has its own DB.

# ── Stage 1: build the SPA ───────────────────────────────────────────────
FROM node:22-alpine AS spa-build
WORKDIR /workspace
COPY app/package.json app/package-lock.json* ./app/
RUN npm install --prefix ./app
COPY app/ ./app/
# Legal MD content: app/src/views/Legal.tsx imports
# `../../../docs/legal/{privacy,terms}.md?raw` so Vite can bundle the
# canonical text into the SPA. Without this COPY the build fails with
# "Denied ID /workspace/docs/legal/privacy.md?raw" — docs/ wouldn't
# exist in the build context. Same canonical source the runtime stage
# copies into /opt/social-svc/legal/ for the sidecar SSR.
COPY docs/legal/ ./docs/legal/
ARG VITE_SERVER_AUTH_DEFAULT
ARG VITE_MEM0_URL
ARG VITE_GOOGLE_CLIENT_ID
RUN npm run build --prefix ./app
# Output: /workspace/dist/

# ── Stage 2: build the social-svc sidecar ───────────────────────────────
FROM node:22-alpine AS social-build
WORKDIR /workspace
COPY services/social-svc/package.json services/social-svc/package-lock.json* ./
RUN npm install
COPY services/social-svc/tsconfig.json ./
COPY services/social-svc/src/ ./src/
RUN npm run build && npm prune --omit=dev
# Output: /workspace/dist/*.js + /workspace/node_modules (prod only)

# ── Stage 3: runtime — nginx + node22 ───────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Add Node.js (for the social-svc sidecar). Alpine ships Node 20 in
# community/nodejs at this nginx tag; it's enough for our needs.
RUN apk add --no-cache nodejs npm tini

# Static SPA assets.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=spa-build /workspace/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

# social-svc artifacts.
RUN mkdir -p /opt/social-svc /opt/social-svc/legal /data
COPY --from=social-build /workspace/dist/ /opt/social-svc/dist/
COPY --from=social-build /workspace/node_modules/ /opt/social-svc/node_modules/
COPY --from=social-build /workspace/package.json /opt/social-svc/package.json
# Legal MD content (privacy + terms). The sidecar SSRs /privacy + /terms
# from these files for crawlers + the LinkedIn app-review bot. Same
# canonical source the SPA imports via `?raw`. See docs/profile-linkedin.md
# §10 for the operator submission checklist.
COPY docs/legal/ /opt/social-svc/legal/

# Entrypoint runs nginx + Node sidecar with signal forwarding so SIGTERM
# from cloud-claude / docker stops both cleanly.
COPY scripts/container-entrypoint.sh /usr/local/bin/container-entrypoint.sh
RUN chmod +x /usr/local/bin/container-entrypoint.sh

# Persistence path for social-svc's JSON store. Operator should mount
# a volume here in production.
VOLUME ["/data"]
ENV SOCIAL_DB_PATH=/data/social.db.json

# Sidecar listens on 8787 inside the container; nginx proxies /v1/social/*
# to it. External port stays 80 (nginx).
EXPOSE 80

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/container-entrypoint.sh"]
