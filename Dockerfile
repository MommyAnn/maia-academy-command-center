# M.A.I.A. AI Video Creator — single container: React app + API + video worker.
# Works on Render, Railway, Fly.io, Google Cloud Run, or any Docker host.
# Required runtime env vars: see server/.env.example ("AI Video Creator" section).

# ---- 1. Build the React frontend ------------------------------------------
FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig*.json ./
COPY public ./public
COPY src ./src
ENV VITE_ROOT_APP=studio
RUN npm run build

# ---- 2. Build the API server ----------------------------------------------
FROM node:22-bookworm-slim AS api
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/prisma ./prisma
RUN npx prisma generate
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev && npx prisma generate

# ---- 3. Runtime -------------------------------------------------------------
FROM node:22-bookworm-slim
# ffmpeg: product-photo processing, video verification, thumbnails, text overlays.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=api /app/server/node_modules ./node_modules
COPY --from=api /app/server/dist ./dist
COPY --from=api /app/server/package.json ./
COPY server/prisma ./prisma
COPY server/assets ./assets
COPY --from=web /app/dist /app/web
ENV SERVE_FRONTEND_DIR=/app/web
EXPOSE 4000
USER node
# Applies pending database migrations, then starts the API + background video worker.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
