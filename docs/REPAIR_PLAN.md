# Sira 项目修复方案

## 目标概述
- 恢复 API 网关核心功能：确保可成功启动 HTTP/HTTPS 服务并通过健康检查
- 消除 ESLint 报错与关键代码缺陷，为持续集成奠定基础
- 整理测试/CLI 设施的断裂点，明确后续迭代优先级
- 统一日志与运行时配置策略，改善部署体验（Docker、K8s 等）

## 当前状态快照
- `npm run lint` 触发 **163 个错误、2036 个警告**，CI 无法通过
- Docker 镜像入口指向 `src/core/index.js`，但该文件只实例化 `ExtensionsManager`，网关并未真正监听端口
- 大量核心模块缺省依赖或属性未初始化，运行时会抛出 `TypeError`
- CLI 相关代码引用 `../lib/*` 等不存在路径；测试夹具注释掉必要依赖，导致 `ReferenceError`
- 多个健康检查/监控文件存在重复键、错误回调等逻辑缺陷

## 高优先问题与修复路径
1. **入口与启动流程损坏**  
   - 问题：`package.json`、`Dockerfile`、`scripts` 默认入口均执行 `src/core/index.js`，该文件仅用于扩展管理。
   - 影响：Docker/K8s/本地启动均失败，健康检查端点不可用。
   - 修复建议：
     - 将启动脚本指向 `src/core/gateway/index.js` 或创建新的 `src/index.js` 包裹启动逻辑。
     - 为扩展管理独立导出，避免在启动路径直接构造。
     - CI、Dockerfile、compose、脚本同步更新入口。

2. **核心模块属性未初始化** (`src/core/index.js`)
   - 问题：`translate`/`scaffoldProject`/`generateCode` 调用未定义字段 `this.localizationService`、`this.projectScaffolder`、`this.smartGenerator`。
   - 修复建议：在构造函数中正确实例化所需组件，或移除未实现的便捷函数以防止运行期崩溃。

3. **健康检查重复键** (`src/gateway/express-server-manager.js`)
   - 问题：`/health/detailed` 响应体重复声明 `server` 属性，违反 ESLint `no-dupe-keys` 并掩盖真实数据。
   - 修复建议：
     - 将最后一个 `server: stats.server` 重命名或合并到 `application`/`metrics` 字段。
     - 添加单元测试覆盖结构。

4. **不必要的 try/catch 与未使用变量** (`src/gateway/load-balancer-manager.js`)
   - 问题：`checkBackendHealth` 在 `try/catch` 内仅重新抛出错误、保存但不使用 `url`/`responseTime`。
   - 修复建议：
     - 移除多余 `catch` 或在其中补充指标统计。
     - 删除未使用变量或用于日志/监控。

5. **回调协议错误** (`src/gateway/protocol-adapters-manager.js`)
   - 问题：`verifyWebSocketClient` 调用 `callback(true)`，按 Node 规范应为 `callback(null, true)`。
   - 修复建议：修正签名并增加异常分支处理非法来源。

6. **覆盖率分析器重复键** (`src/test/coverage-analyzer.js`)
   - 问题：`summary` 内存在两个 `covered` 键，第二个对象覆盖前者，导致统计失真。
   - 修复建议：重命名统计字段（例如 `coveredFilesCount`）并同步引用。

7. **测试与 CLI 环境断裂**
   - `src/test/fixtures/cli/environment.js` 注释掉 `TestAdapter`、`environment` 导入。
   - `src/bin/index.js` 引用 `../lib/config`，但 `src/lib` 不存在。
   - 多个 Policy 测试文件使用裸表达式 (`no-unused-expressions`)、未定义变量 `policy` 等。
   - 修复建议：
     - 恢复或替换依赖导入，确保 CLI/Gengerator 测试可执行。
     - 批量修正测试断言写法（使用 `expect(...)`）并补齐变量声明。

8. **日志策略与 ESLint 规则冲突**
   - 警告主要来自 `no-console`。需要决定：
     - 调整 ESLint 配置允许指定目录使用 `console`；或
     - 替换为 `logger` 模块统一输出。
   - 修复建议：短期内可对测试、脚本目录放宽规则；长期改用 `winston` 或现有 `logger`。

## 整体修复路线图
1. **阶段一：核心可运行性**
   - [ ] 新建统一入口（如 `src/index.js`）调用 gateway bootstrap。
   - [ ] 调整 `package.json`、`Dockerfile`、`scripts` 的命令指向新入口。
   - [ ] 修复健康检查重复键、WebSocket 回调等阻塞性 lint 错误。
   - [ ] 为关键修复添加最小限度单元测试。

2. **阶段二：Lint 与测试恢复**
   - [ ] 批量处理 `no-dupe-keys`、`no-useless-catch`、`camelcase`、`prefer-destructuring` 等高优 lint 错误。
   - [ ] 针对 Policy/CLI 测试重写断言语句，确保 `npm run test:unit` 可执行。
   - [ ] 评估日志策略，更新 ESLint 配置或替换为 `logger`。

3. **阶段三：基础设施 & 部署**
   - [ ] 更新 Docker/K8s 健康检查端点，验证容器成功启动并返回 200。
   - [ ] 为 `NODE_ENV` 设置合理默认值，避免本地启动失败。
   - [ ] 审视 `scripts/`、`ci`、`docs` 文档与实际实现一致性。

4. **阶段四：质量保障**
   - [ ] 重新生成/校验 `docs/` 文档，确保开发者指南同步。
   - [ ] 扩展自动化测试（Playwright、负载测试）以验证关键场景。
   - [ ] 建立持续集成流程（lint + unit + integration）。

## 风险与依赖
- 入口调整涉及 Docker、Compose、K8s、CLI，需要同步更新以免出现版本错配。
- Lint 规则过严可能拖慢修复节奏，可分阶段降级为 warning，再逐步收紧。
- 测试代码量大，改动需注意 `sinon`、`chai` 断言风格一致性，防止引入新的异步问题。

## 建议的后续动作
- 建立修复分支，优先完成阶段一，确保基础服务可运行。
- 设置 CI gate：`npm run lint:check` + `npm run test:unit`。
- 调整文档与 README 指向新的启动方式，避免新人踩坑。
- 评估依赖更新（如 `express-rate-limit`, `passport` 等版本较旧），作为长期优化项。
