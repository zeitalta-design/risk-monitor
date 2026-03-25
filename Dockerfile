# ============================================
# 比較サイト OS — 本番 Docker イメージ
# ============================================
# Next.js standalone + better-sqlite3
#
# Usage:
#   docker build -t sports-event-app .
#   docker run -d -p 3000:3000 --env-file web/.env -v $(pwd)/web/data:/app/web/data sports-event-app

# ─── 1. 依存インストール ──────────────────
FROM node:20-slim AS deps
WORKDIR /app/web

# better-sqlite3 ビルドに必要
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY web/package.json web/package-lock.json ./
RUN npm ci --production=false

# ─── 2. ビルド ────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app/web

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY web/package.json web/package-lock.json ./
RUN npm ci

# ソース全体コピー
COPY web/ ./

# Next.js ビルド（standalone 出力）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx next build

# ─── 3. 本番イメージ ─────────────────────
FROM node:20-slim AS runner
WORKDIR /app/web

# better-sqlite3 実行に必要な最小ライブラリ
RUN apt-get update && apt-get install -y libsqlite3-0 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# standalone 出力をコピー
COPY --from=builder /app/web/.next/standalone/web ./
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public

# scripts / lib / sql をコピー（importer / seed / cron 用）
COPY --from=builder /app/web/scripts ./scripts
COPY --from=builder /app/web/lib ./lib
COPY --from=builder /app/web/node_modules ./node_modules

# data ディレクトリ（Volume マウントポイント）
RUN mkdir -p ./data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
