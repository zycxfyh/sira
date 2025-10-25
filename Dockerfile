# =========================================
# ---------- Stage: base ----------
FROM node:20-slim AS base
WORKDIR /app
RUN npm install -g pnpm@9.6.0

# 复制元数据和工作区配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

# ---------- Stage: dependencies ----------
FROM base AS dependencies
WORKDIR /app
ENV NODE_ENV=development
ENV TURBO_CACHE_DIR=/app/.turbo
RUN mkdir -p /app/.turbo

# 安装全部依赖（含子包与 devDependencies）
RUN pnpm install --frozen-lockfile --recursive
RUN pnpm rebuild

# ---------- Stage: builder ----------
FROM dependencies AS builder
WORKDIR /app

# 执行 monorepo 构建
RUN pnpm exec turbo run build

# 可选：如果有 deploy 脚本
RUN pnpm --filter=@tuheg/backend-gateway deploy . || true \
 && pnpm --filter=@tuheg/creation-agent deploy . || true \
 && pnpm --filter=@tuheg/logic-agent deploy . || true \
 && pnpm --filter=@tuheg/narrative-agent deploy . || true || true

# ---------- Stage: production images ----------

# --- backend-gateway ---
FROM node:20-slim AS backend-gateway-prod
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9.6.0
COPY --from=builder /app/apps/backend-gateway/dist ./dist
COPY --from=builder /app/apps/backend-gateway/package.json ./package.json
CMD ["node", "dist/main.js"]

# --- creation-agent ---
FROM node:20-slim AS creation-agent-prod
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9.6.0
COPY --from=builder /app/apps/creation-agent/dist ./dist
COPY --from=builder /app/apps/creation-agent/package.json ./package.json
CMD ["node", "dist/main.js"]

# --- logic-agent ---
FROM node:20-slim AS logic-agent-prod
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9.6.0
COPY --from=builder /app/apps/logic-agent/dist ./dist
COPY --from=builder /app/apps/logic-agent/package.json ./package.json
CMD ["node", "dist/main.js"]

# --- narrative-agent ---
FROM node:20-slim AS narrative-agent-prod
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@9.6.0
COPY --from=builder /app/apps/narrative-agent/dist ./dist
COPY --from=builder /app/apps/narrative-agent/package.json ./package.json
CMD ["node", "dist/main.js"]

# --- frontend ---
FROM nginx:stable-alpine AS frontend-prod
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
