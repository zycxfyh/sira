# (通用后端提取器 Dockerfile - V12)
# 这个Dockerfile假设一个名为 "builder" 的镜像已经存在，并包含了所有构建产物。

# --- 阶段 1: 裁剪层 ---
FROM builder AS pruner
WORKDIR /app
ARG SERVICE_NAME
# pnpm deploy 是从完整构建环境中提取单个服务的最优方式
RUN pnpm --filter=${SERVICE_NAME} deploy /deploy

# --- 阶段 2: 最终镜像 ---
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=pruner /deploy .
CMD ["node", "dist/main.js"]