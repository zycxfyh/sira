# =========================================
# ---------- Stage: base ----------
FROM node:20-slim AS base

# 安装pnpm
RUN npm install -g pnpm@9.6.0

WORKDIR /app

# ---------- Stage: dependencies ----------
FROM base AS dependencies

# 重要：构建阶段需要development环境以安装devDependencies（如vite）
ENV NODE_ENV=development
ENV TURBO_CACHE_DIR=/app/.turbo

# 创建turbo缓存目录
RUN mkdir -p /app/.turbo

# 严格按照pnpm monorepo最佳实践复制文件
# 1. 首先复制workspace配置文件
COPY pnpm-workspace.yaml ./

# 2. 复制根package.json和lockfile
COPY package.json ./
COPY pnpm-lock.yaml ./

# 3. 创建目录结构
RUN mkdir -p packages/common-backend apps/backend-gateway apps/creation-agent apps/logic-agent apps/narrative-agent apps/frontend

# 4. 复制所有子包的package.json
COPY packages/common-backend/package.json packages/common-backend/
COPY apps/backend-gateway/package.json apps/backend-gateway/
COPY apps/creation-agent/package.json apps/creation-agent/
COPY apps/logic-agent/package.json apps/logic-agent/
COPY apps/narrative-agent/package.json apps/narrative-agent/
COPY apps/frontend/package.json apps/frontend/

# 5. 复制构建配置
COPY turbo.json tsconfig.json ./

# 6. 安装所有依赖（包括devDependencies）
RUN pnpm install --frozen-lockfile

# ---------- Stage: builder ----------
FROM dependencies AS builder

# 复制所有源代码（依赖安装完成后）
COPY packages/ ./packages/
COPY apps/ ./apps/

# 设置构建环境
ENV NODE_ENV=production

# 执行 monorepo 构建
RUN pnpm exec turbo run build

# ---------- Stage: production images ----------

# --- backend-gateway ---
FROM node:20-slim AS backend-gateway-prod

# 安装pnpm
RUN npm install -g pnpm@9.6.0

WORKDIR /app
ENV NODE_ENV=production

# 复制构建产物和配置
COPY --from=builder /app/apps/backend-gateway/dist ./dist
COPY --from=builder /app/apps/backend-gateway/package.json ./package.json

# 复制workspace依赖 (common-backend)
COPY --from=builder /app/packages/common-backend/dist ./node_modules/@tuheg/common-backend/dist
COPY --from=builder /app/packages/common-backend/package.json ./node_modules/@tuheg/common-backend/

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

CMD ["node", "dist/main.js"]

# --- creation-agent ---
FROM node:20-slim AS creation-agent-prod

# 安装pnpm
RUN npm install -g pnpm@9.6.0

WORKDIR /app
ENV NODE_ENV=production

# 复制构建产物和配置
COPY --from=builder /app/apps/creation-agent/dist ./dist
COPY --from=builder /app/apps/creation-agent/package.json ./package.json

# 复制workspace依赖
COPY --from=builder /app/packages/common-backend/dist ./node_modules/@tuheg/common-backend/dist
COPY --from=builder /app/packages/common-backend/package.json ./node_modules/@tuheg/common-backend/

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

CMD ["node", "dist/main.js"]

# --- logic-agent ---
FROM node:20-slim AS logic-agent-prod

# 安装pnpm
RUN npm install -g pnpm@9.6.0

WORKDIR /app
ENV NODE_ENV=production

# 复制构建产物和配置
COPY --from=builder /app/apps/logic-agent/dist ./dist
COPY --from=builder /app/apps/logic-agent/package.json ./package.json

# 复制workspace依赖
COPY --from=builder /app/packages/common-backend/dist ./node_modules/@tuheg/common-backend/dist
COPY --from=builder /app/packages/common-backend/package.json ./node_modules/@tuheg/common-backend/

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

CMD ["node", "dist/main.js"]

# --- narrative-agent ---
FROM node:20-slim AS narrative-agent-prod

# 安装pnpm
RUN npm install -g pnpm@9.6.0

WORKDIR /app
ENV NODE_ENV=production

# 复制构建产物和配置
COPY --from=builder /app/apps/narrative-agent/dist ./dist
COPY --from=builder /app/apps/narrative-agent/package.json ./package.json

# 复制workspace依赖
COPY --from=builder /app/packages/common-backend/dist ./node_modules/@tuheg/common-backend/dist
COPY --from=builder /app/packages/common-backend/package.json ./node_modules/@tuheg/common-backend/

# 安装生产依赖
RUN pnpm install --prod --frozen-lockfile

CMD ["node", "dist/main.js"]

# --- frontend ---
FROM nginx:stable-alpine AS frontend-prod
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
