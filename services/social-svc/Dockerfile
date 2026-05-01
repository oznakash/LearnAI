# social-svc — standalone container build.
#
# Used when running social-svc on its own host (e.g. for tests, or a
# fork that wants the social layer detached from the SPA). Production
# LearnAI bundles it into the SPA container instead — see the root
# Dockerfile which copies the build artifacts in.

FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /workspace/dist/ /app/dist/
COPY --from=build /workspace/node_modules/ /app/node_modules/
COPY --from=build /workspace/package.json /app/package.json
USER app
ENV PORT=8787
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "/app/dist/index.js"]
