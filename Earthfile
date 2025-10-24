# Earthfile for Nexus Verse (V13 - The Final Fix)

VERSION 0.8

# --- 1. 后端服务: nexus-engine ---
nexus-engine-image:
    FROM node:20-slim AS builder
    WORKDIR /app
    RUN npm install -g pnpm@9.6.0
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
    COPY apps/backend/package.json ./apps/backend/
    COPY apps/frontend/package.json ./apps/frontend/
    RUN pnpm install --frozen-lockfile
    COPY . .
    RUN pnpm turbo run build --filter=nexus-engine...
    RUN pnpm --filter=nexus-engine deploy /deploy

    FROM node:20-slim
    WORKDIR /app
    ENV NODE_ENV=production
    COPY --from=builder /deploy .
    CMD ["node", "dist/main.js"]
    SAVE IMAGE nexus-verse/nexus-engine:latest

# --- 2. 后端服务: creation-agent ---
creation-agent-image:
    FROM node:20-slim AS builder
    WORKDIR /app
    RUN npm install -g pnpm@9.6.0
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
    COPY apps/backend/package.json ./apps/backend/
    COPY apps/frontend/package.json ./apps/frontend/
    RUN pnpm install --frozen-lockfile
    COPY . .
    RUN pnpm turbo run build --filter=creation-agent...
    RUN pnpm --filter=creation-agent deploy /deploy

    FROM node:20-slim
    WORKDIR /app
    ENV NODE_ENV=production
    COPY --from=builder /deploy .
    CMD ["node", "dist/main.js"]
    SAVE IMAGE nexus-verse/creation-agent:latest

# --- 3. 后端服务: logic-agent ---
logic-agent-image:
    FROM node:20-slim AS builder
    WORKDIR /app
    RUN npm install -g pnpm@9.6.0
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
    COPY apps/backend/package.json ./apps/backend/
    COPY apps/frontend/package.json ./apps/frontend/
    RUN pnpm install --frozen-lockfile
    COPY . .
    RUN pnpm turbo run build --filter=logic-agent...
    RUN pnpm --filter=logic-agent deploy /deploy

    FROM node:20-slim
    WORKDIR /app
    ENV NODE_ENV=production
    COPY --from=builder /deploy .
    CMD ["node", "dist/main.js"]
    SAVE IMAGE nexus-verse/logic-agent:latest

# --- 4. 后端服务: narrative-agent ---
narrative-agent-image:
    FROM node:20-slim AS builder
    WORKDIR /app
    RUN npm install -g pnpm@9.6.0
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
    COPY apps/backend/package.json ./apps/backend/
    COPY apps/frontend/package.json ./apps/frontend/
    RUN pnpm install --frozen-lockfile
    COPY . .
    RUN pnpm turbo run build --filter=narrative-agent...
    RUN pnpm --filter=narrative-agent deploy /deploy

    FROM node:20-slim
    WORKDIR /app
    ENV NODE_ENV=production
    COPY --from=builder /deploy .
    CMD ["node", "dist/main.js"]
    SAVE IMAGE nexus-verse/narrative-agent:latest

# --- 5. 前端服务 ---
frontend-image:
    FROM node:20-slim AS builder
    WORKDIR /app
    RUN npm install -g pnpm@9.6.0
    COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
    COPY apps/backend/package.json ./apps/backend/
    COPY apps/frontend/package.json ./apps/frontend/
    RUN pnpm install --frozen-lockfile
    COPY . .
    RUN pnpm turbo run build --filter=frontend

    FROM nginx:stable-alpine
    COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
    COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
    SAVE IMAGE nexus-verse/frontend:latest

# --- 6. 聚合目标 (The Final Fix) ---
# 关键修正：在每个 BUILD 命令前都加上 ./
# 这会强制 Earthly 在本地寻找依赖，而不是去远程仓库
all:
    BUILD ./+nexus-engine-image
    BUILD ./+creation-agent-image
    BUILD ./+logic-agent-image
    BUILD ./+narrative-agent-image
    BUILD ./+frontend-image