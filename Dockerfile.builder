# 文件路径: ./Dockerfile.builder
# 职责: 创建一个包含完整源代码、完整依赖和完整构建产物的“全能”构建镜像。

FROM node:20-slim
WORKDIR /app
RUN npm install -g pnpm

# 1. 复制依赖清单并高效安装
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
RUN pnpm fetch
RUN pnpm install -r --offline --frozen-lockfile

# 2. 复制所有源代码
COPY . .

# 3. 构建所有应用
# 我们分开构建，以防前后端构建脚本有冲突或不同的环境变量需求
RUN pnpm turbo run build --filter={./apps/backend/apps/*}
RUN pnpm turbo run build --filter=frontend