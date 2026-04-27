# BuilderQuest — multi-stage build
# Stage 1: build the SPA
FROM node:22-alpine AS build
WORKDIR /workspace
COPY app/package.json app/package-lock.json* ./app/
RUN npm install --prefix ./app
COPY app/ ./app/
RUN npm run build --prefix ./app

# Stage 2: serve via nginx
FROM nginx:1.27-alpine AS runtime
# Replace the default nginx welcome page with our built SPA
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /workspace/app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
