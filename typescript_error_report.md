# 🩺 Tuheg 项目 TypeScript 健康诊断报告

**生成时间:** `2025-10-26 03:26:07`

## ❗ 诊断结论：项目构建失败！

构建命令返回了失败状态，但在输出日志中**未能解析出标准格式的 TypeScript 错误**。请检查下面的原始日志以确定根本原因。

---

---

## 原始构建日志 (Raw Build Log)

```text
• Packages in scope: @tuheg/backend-gateway, @tuheg/common-backend, @tuheg/creation-agent, @tuheg/frontend, @tuheg/logic-agent, @tuheg/narrative-agent
• Running build in 6 packages
• Remote caching disabled
@tuheg/frontend:build: cache hit, replaying logs b73457e6ce1938da
@tuheg/frontend:build: 
@tuheg/frontend:build: > @tuheg/frontend@1.0.0 build C:\Users\16663\Desktop\tuheg\apps\frontend
@tuheg/frontend:build: > vite build
@tuheg/frontend:build: 
@tuheg/frontend:build: [33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m
@tuheg/frontend:build: [36mvite v5.4.21 [32mbuilding for production...[36m[39m
@tuheg/frontend:build: transforming...
@tuheg/frontend:build: [32m✓[39m 355 modules transformed.
@tuheg/frontend:build: rendering chunks...
@tuheg/frontend:build: computing gzip size...
@tuheg/frontend:build: [2mdist/[22m[32mindex.html                 [39m[1m[2m  0.71 kB[22m[1m[22m[2m │ gzip:   0.60 kB[22m
@tuheg/frontend:build: [2mdist/[22m[35massets/index-SBhXW3fD.css  [39m[1m[2m 13.98 kB[22m[1m[22m[2m │ gzip:   3.34 kB[22m
@tuheg/frontend:build: [2mdist/[22m[36massets/index-D6vXUIwf.js   [39m[1m[2m458.90 kB[22m[1m[22m[2m │ gzip: 159.68 kB[22m
@tuheg/frontend:build: [32m✓ built in 2.91s[39m
@tuheg/common-backend:build: cache hit, replaying logs f014918c03020a55
@tuheg/common-backend:build: 
@tuheg/common-backend:build: > @tuheg/common-backend@1.0.0 build C:\Users\16663\Desktop\tuheg\packages\common-backend
@tuheg/common-backend:build: > pnpm prisma:generate && tsc -p tsconfig.json
@tuheg/common-backend:build: 
@tuheg/common-backend:build: 
@tuheg/common-backend:build: > @tuheg/common-backend@1.0.0 prisma:generate C:\Users\16663\Desktop\tuheg\packages\common-backend
@tuheg/common-backend:build: > prisma generate --schema=./src/prisma/schema.prisma
@tuheg/common-backend:build: 
@tuheg/common-backend:build: Prisma schema loaded from src\prisma\schema.prisma
@tuheg/common-backend:build: 
@tuheg/common-backend:build: ✔ Generated Prisma Client (v5.22.0) to .\..\..\node_modules\.pnpm\@prisma+client@5.22.0_prisma@5.22.0\node_modules\@prisma\client in 76ms
@tuheg/common-backend:build: 
@tuheg/common-backend:build: Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
@tuheg/common-backend:build: 
@tuheg/common-backend:build: Tip: Curious about the SQL queries Prisma ORM generates? Optimize helps you enhance your visibility: https://pris.ly/tip-2-optimize
@tuheg/common-backend:build: 
@tuheg/common-backend:build: ┌─────────────────────────────────────────────────────────┐
@tuheg/common-backend:build: │  Update available 5.22.0 -> 6.18.0                      │
@tuheg/common-backend:build: │                                                         │
@tuheg/common-backend:build: │  This is a major update - please follow the guide at    │
@tuheg/common-backend:build: │  https://pris.ly/d/major-version-upgrade                │
@tuheg/common-backend:build: │                                                         │
@tuheg/common-backend:build: │  Run the following to update                            │
@tuheg/common-backend:build: │    npm i --save-dev prisma@latest                       │
@tuheg/common-backend:build: │    npm i @prisma/client@latest                          │
@tuheg/common-backend:build: └─────────────────────────────────────────────────────────┘
@tuheg/logic-agent:build: cache miss, executing 34c951fbe0bbc7a0
@tuheg/creation-agent:build: cache miss, executing 4b450c3651b7d54b
@tuheg/backend-gateway:build: cache miss, executing 41be0e34ab15fcc5
@tuheg/narrative-agent:build: cache miss, executing eb7d74dac99f28c1
@tuheg/logic-agent:build: 
@tuheg/logic-agent:build: > @tuheg/logic-agent@1.0.0 build C:\Users\16663\Desktop\tuheg\apps\logic-agent
@tuheg/logic-agent:build: > nest build
@tuheg/logic-agent:build: 
@tuheg/creation-agent:build: 
@tuheg/creation-agent:build: > @tuheg/creation-agent@1.0.0 build C:\Users\16663\Desktop\tuheg\apps\creation-agent
@tuheg/creation-agent:build: > nest build
@tuheg/creation-agent:build: 
@tuheg/narrative-agent:build: 
@tuheg/narrative-agent:build: > @tuheg/narrative-agent@1.0.0 build C:\Users\16663\Desktop\tuheg\apps\narrative-agent
@tuheg/narrative-agent:build: > nest build
@tuheg/narrative-agent:build: 
@tuheg/logic-agent:build: 'nest' �����ڲ����ⲿ���Ҳ���ǿ����еĳ���
@tuheg/logic-agent:build: ���������ļ���
@tuheg/creation-agent:build: 'nest' �����ڲ����ⲿ���Ҳ���ǿ����еĳ���
@tuheg/creation-agent:build: ���������ļ���
@tuheg/logic-agent:build:  ELIFECYCLE  Command failed with exit code 1.
@tuheg/creation-agent:build:  ELIFECYCLE  Command failed with exit code 1.
@tuheg/narrative-agent:build: 'nest' �����ڲ����ⲿ���Ҳ���ǿ����еĳ���
@tuheg/narrative-agent:build: ���������ļ���
@tuheg/backend-gateway:build: 
@tuheg/backend-gateway:build: > @tuheg/backend-gateway@1.0.0 build C:\Users\16663\Desktop\tuheg\apps\backend-gateway
@tuheg/backend-gateway:build: > nest build
@tuheg/backend-gateway:build: 
@tuheg/narrative-agent:build:  ELIFECYCLE  Command failed with exit code 1.
@tuheg/backend-gateway:build: 'nest' �����ڲ����ⲿ���Ҳ���ǿ����еĳ���
@tuheg/backend-gateway:build: ���������ļ���
@tuheg/backend-gateway:build:  ELIFECYCLE  Command failed with exit code 1.

 Tasks:    2 successful, 6 total
Cached:    2 cached, 6 total
  Time:    453ms 
Failed:    @tuheg/creation-agent#build, @tuheg/logic-agent#build, @tuheg/narrative-agent#build


turbo 2.5.8

@tuheg/narrative-agent:build: ERROR: command finished with error: command (C:\Users\16663\Desktop\tuheg\apps\narrative-agent) C:\Users\16663\AppData\Local\pnpm\.tools\pnpm\9.6.0\bin\pnpm.CMD run build exited (1)
@tuheg/logic-agent:build: ERROR: command finished with error: command (C:\Users\16663\Desktop\tuheg\apps\logic-agent) C:\Users\16663\AppData\Local\pnpm\.tools\pnpm\9.6.0\bin\pnpm.CMD run build exited (1)
@tuheg/creation-agent:build: ERROR: command finished with error: command (C:\Users\16663\Desktop\tuheg\apps\creation-agent) C:\Users\16663\AppData\Local\pnpm\.tools\pnpm\9.6.0\bin\pnpm.CMD run build exited (1)
@tuheg/narrative-agent#build: command (C:\Users\16663\Desktop\tuheg\apps\narrative-agent) C:\Users\16663\AppData\Local\pnpm\.tools\pnpm\9.6.0\bin\pnpm.CMD run build exited (1)
@tuheg/logic-agent#build: command (C:\Users\16663\Desktop\tuheg\apps\logic-agent) C:\Users\16663\AppData\Local\pnpm\.tools\pnpm\9.6.0\bin\pnpm.CMD run build exited (1)
@tuheg/creation-agent#build: command (C:\Users\16663\Desktop\tuheg\apps\creation-agent) C:\Users\16663\AppData\Local\pnpm\.tools\pnpm\9.6.0\bin\pnpm.CMD run build exited (1)
 ERROR  run failed: command  exited (1)

```
