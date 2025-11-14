# Sira - 世界级智能AI网关

[![CI](https://github.com/zycxfyh/sira/workflows/CI/badge.svg)](https://github.com/zycxfyh/sira/actions)
[![codecov](https://codecov.io/gh/zycxfyh/sira/branch/main/graph/badge.svg)](https://codecov.io/gh/zycxfyh/sira)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Rust](https://img.shields.io/badge/rust-1.70+-orange.svg)](https://www.rust-lang.org/)
[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)
[![Go](https://img.shields.io/badge/go-1.19+-cyan.svg)](https://golang.org/)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)

> 🚀 **智能网关核心系统 + 可选扩展能力** - 以AI原生网关为核心，配备丰富的可选扩展模块
>
> **智能网关驱动，扩展按需加载** - 核心网关提供完整的AI请求处理能力，扩展模块根据需求灵活启用

<div align="center">
  <img src="https://img.shields.io/github/stars/zycxfyh/sira?style=social" alt="GitHub Stars">
  <img src="https://img.shields.io/github/forks/zycxfyh/sira?style=social" alt="GitHub Forks">
  <img src="https://img.shields.io/github/issues/zycxfyh/sira" alt="GitHub Issues">
  <img src="https://img.shields.io/github/last-commit/zycxfyh/sira" alt="Last Commit">
</div>

## 🎯 项目愿景

**Sira是一个以智能网关为核心的AI生态系统**，通过可选扩展模块提供丰富的增强能力。

### 🌟 核心定位：智能网关驱动
- **🎯 智能网关为核心**：提供完整的AI请求处理、智能路由、多模态支持等核心功能
- **🔧 扩展按需加载**：根据使用场景选择性启用推理增强、多模态处理、工具集成等扩展能力
- **📦 模块化架构**：核心网关轻量化，扩展模块独立部署，支持灵活组合

### 🚀 AI前沿技术吸收
基于2024年AI研究前沿分析，我们在智能网关中吸收了关键技术洞察：
- **张量原生处理**：网关内部使用张量表示提升效率
- **自组织协作**：动态编排Agent网络处理复杂任务
- **自主学习优化**：从请求历史中持续优化路由策略

### 💡 产品价值主张
- **开箱即用**：核心网关提供完整AI服务能力，无需复杂配置
- **按需增强**：根据具体需求启用相应扩展模块
- **渐进式扩展**：从小规模应用逐步扩展到企业级部署
- **技术前沿**：持续吸收AI最新研究成果，提升网关智能化水平

## ✨ 核心特性

### 🧠 微内核架构
- **统一插件框架** - 标准化插件接口，支持热加载和卸载
- **服务注册中心** - 自动服务发现、注册和健康检查
- **消息总线** - 事件驱动的组件间通信，支持发布订阅模式
- **资源调度器** - 智能资源分配和监控，多策略支持

### 🔌 插件生态系统
- **AI能力插件** - OpenAI、Anthropic、Google等模型适配器
- **业务逻辑插件** - 工作流引擎、规则引擎、业务规则
- **数据处理插件** - ETL、数据转换、实时分析
- **监控告警插件** - 性能监控、异常检测、智能告警
- **安全控制插件** - 认证授权、访问控制、审计日志

### 🌐 多层微服务架构
- **前端交互层** - JS/TS + WASM(Rust) - 快速开发 + 高性能渲染
- **调用/智能层** - Python + Go - AI生态 + 并发管理
- **执行内核层** - Rust - 内存安全 + 高性能
- **数据监控层** - Go/Rust/Python - 稳定可靠 + 生态丰富
- **学习演化层** - Python - ML生态 + 算法创新
- **系统治理层** - Go/Rust - 高并发 + 安全稳定

### 🧠 智能网关架构 (基于AOS哲学)
- **张量感知层** - 多模态信息原生张量处理
- **自组织推理层** - 动态Agent协作网络
- **自主进化层** - 持续学习与创新发现

详见：[智能网关架构设计](docs/architecture/INTELLIGENT_GATEWAY_ARCHITECTURE.md)

### 🎯 AI网关核心能力
- **统一API** - 标准化OpenAI、Anthropic、Google等AI服务接口
- **智能路由** - 基于模型能力、成本、性能的动态请求调度
- **负载均衡** - 多后端实例的智能流量分配和故障转移
- **容错机制** - 熔断器、降级、重试和优雅降级策略

### 🔍 企业级可观测性
- **实时监控** - 请求量、延迟、错误率、资源使用等关键指标
- **分布式追踪** - 完整的请求链路追踪和性能分析
- **智能告警** - 基于机器学习的异常检测和自动告警
- **性能分析** - 响应时间分布、瓶颈识别、优化建议

### 🛡️ 企业级安全与合规
- **多租户隔离** - 企业级多租户数据和资源隔离
- **访问控制** - RBAC权限模型和细粒度访问控制
- **审计日志** - 完整的操作审计和安全事件记录
- **合规支持** - GDPR、SOX等合规标准的支持

## 📚 模块文档

### 🎯 智能网关核心系统
- **[sira-gateway](docs/modules/sira-gateway.md)** - 智能网关核心，AI原生网关的中央处理枢纽
- **[sira-kernel](docs/modules/sira-kernel.md)** - 网关基础设施，张量原生微内核和基础支撑

### 🔧 可选扩展能力模块
- **[sira-intelligence](docs/modules/sira-intelligence.md)** - 推理增强扩展，复杂推理任务的专业处理
- **[sira-vcp](docs/modules/sira-vcp.md)** - 多模态增强扩展，图像/视频/音频的深度处理
- **[sira-tools](docs/modules/sira-tools.md)** - 工具执行扩展，丰富的工具生态和API集成
- **[sira-session](docs/modules/sira-session.md)** - 会话管理扩展，多轮对话和上下文持久化
- **[sira-storage-backends](docs/modules/sira-storage-backends.md)** - 存储优化扩展，高性能数据存储和管理

### 🤖 AI服务集成
- **sira-ai-backends** - AI后端适配，统一多模型接口

### 📋 开发任务
- **[sira-kernel-todo](docs/modules/sira-kernel-todo.md)** - 微内核开发任务清单
- **[sira-gateway-todo](docs/modules/sira-gateway-todo.md)** - 网关开发任务清单
- **[sira-intelligence-todo](docs/modules/sira-intelligence-todo.md)** - 智能引擎开发任务清单

### 🔬 AOS技术栈全景图
- **[AOS技术栈全景图](docs/architecture/AOS_TECH_STACK_PANORAMA.md)** - 从理论到落地的完整技术路线图
- **[AOS世界模型宪法](docs/philosophy/WORLD_MODEL_CONSTITUTION.md)** - 张量原生·自组织·自主进化的哲学基础
- **[智能网关架构设计](docs/architecture/INTELLIGENT_GATEWAY_ARCHITECTURE.md)** - 三层AOS架构的技术实现
- **[sira-tools-todo](docs/modules/sira-tools-todo.md)** - 工具系统开发任务清单
- **[sira-session-todo](docs/modules/sira-session-todo.md)** - 会话管理开发任务清单
- **[sira-storage-backends-todo](docs/modules/sira-storage-backends-todo.md)** - 存储系统开发任务清单

## 📦 安装

### Rust执行内核 (核心组件)

```bash
# 克隆项目
git clone https://github.com/zycxfyh/sira.git
cd sira

# 安装Rust (如果还没有安装)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 构建项目
cargo build --release

# 运行微内核
cargo run --bin sira-kernel
```

### Python智能层

```bash
# 进入Python目录
cd layers/python

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 运行AI大脑服务
python -m sira_brain.main
```

### Go调度层

```bash
# 进入Go目录
cd layers/go

# 安装Go依赖
go mod download

# 运行调度器
go run cmd/scheduler/main.go
```

### 前端界面

```bash
# 进入前端目录
cd layers/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### Docker一键部署

```bash
# 构建完整环境
docker-compose up --build -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

## 🚀 快速开始

### 1. 启动微内核

```bash
# 运行Rust微内核
cargo run --bin sira-kernel
```

### 2. 配置AI提供商

```toml
# kernel.toml
[ai.providers.openai]
api_key = "your-openai-api-key"
models = ["gpt-3.5-turbo", "gpt-4"]

[ai.providers.anthropic]
api_key = "your-anthropic-api-key"
models = ["claude-2", "claude-instant-1"]
```

### 3. 加载插件

```rust
use sira_kernel::{init, plugin::PluginManager};

// 初始化内核
let kernel = init().await?;

// 加载AI提供商插件
kernel.plugin_manager()
    .load_plugin("./plugins/ai-openai.so").await?;
kernel.plugin_manager()
    .load_plugin("./plugins/ai-anthropic.so").await?;
```

### 4. 发送请求

```bash
# REST API调用
curl -X POST http://localhost:8080/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello, World!"}]
  }'

### 使用CLI

```bash
# 全局安装CLI
npm install -g sira-ai-gateway

# 启动服务
sira start --port 3000

# 查看状态
sira status

# 停止服务
sira stop
```

## 📖 API文档

### Chat Completions API

```bash
POST /api/v1/chat/completions
Content-Type: application/json

{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ]
}
```

### 响应格式

```json
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 13,
    "completion_tokens": 20,
    "total_tokens": 33
  }
}
```

## 🏗️ 架构设计

Sira采用**微内核+插件驱动的分层微服务**架构，将两种架构模式的优势完美融合：

### 融合架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    🎯 插件生态层 (Plugin Ecosystem)           │
│  ┌─────────────────────────────────────────────────────┐     │
│  │ AI插件 │ 业务插件 │ 数据插件 │ 监控插件 │ 安全插件 │     │
│  └─────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│ 1. 前端交互层  JS/TS + WASM(Rust)  ← 开发快，可嵌入高性能渲染 │
├─────────────────────────────────────────────────────────────┤
│ 2. 调用/智能层  Python + Go        ← AI生态强 + 并发管理优   │
├─────────────────────────────────────────────────────────────┤
│ 3. 执行内核层  Rust                ← 极高性能 + 内存安全     │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                ⚡ 微内核 (Microkernel)              │     │
│  │  ┌─────────────────────────────────────────────┐     │     │
│  │  │ 插件管理 │ 服务注册 │ 消息总线 │ 资源调度 │     │     │
│  │  └─────────────────────────────────────────────┘     │     │
│  └─────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│ 4. 数据监控层  Go/Rust/Python     ← 稳定、轻量、接口友好     │
├─────────────────────────────────────────────────────────────┤
│ 5. 学习演化层  Python             ← 机器学习生态优势         │
├─────────────────────────────────────────────────────────────┤
│ 6. 系统治理层  Go/Rust            ← 稳定可靠、并发友好       │
└─────────────────────────────────────────────────────────────┘
```

### 微内核+插件的核心优势

#### 🧠 统一的微内核 (Unified Microkernel)
- **服务注册中心**: 所有服务和插件的统一注册管理
- **消息总线**: 层间、插件间的高效通信机制
- **插件管理系统**: 热加载、依赖管理、生命周期控制
- **资源调度器**: 智能分配计算资源和存储资源

#### 🔌 插件生态系统 (Plugin Ecosystem)
- **AI能力插件**: OpenAI、Anthropic、Google等模型适配器
- **业务逻辑插件**: 工作流引擎、规则引擎、业务规则
- **数据处理插件**: ETL、数据转换、实时分析
- **监控告警插件**: 性能监控、异常检测、智能告警
- **安全控制插件**: 认证授权、访问控制、审计日志

### 各层职责详解

#### 1. 🎨 前端交互层 (Frontend Layer)
**技术栈**: JavaScript/TypeScript + WebAssembly(Rust)
- **sira-web**: 现代Web界面，响应式设计，实时数据可视化
- **sira-wasm**: 高性能计算组件，3D渲染，复杂数据处理
- **插件集成**: 前端组件插件、UI扩展插件

#### 2. 🧠 调用/智能层 (Intelligence Layer)
**技术栈**: Python + Go
- **sira-brain**: AI逻辑处理，工作流编排，智能决策引擎
- **sira-scheduler**: 请求调度，负载均衡，队列管理
- **插件集成**: AI算法插件、工作流插件、智能调度插件

#### 3. ⚡ 执行内核层 (Execution Core)
**技术栈**: Rust
- **sira-kernel**: 微内核核心，统一的服务和插件管理
- **sira-gateway**: 高性能HTTP/WebSocket网关，路由引擎，中间件管道
- **sira-runtime**: 插件运行时环境，沙箱执行，资源隔离
- **插件集成**: 核心功能插件、系统服务插件

#### 4. 📊 数据监控层 (Monitoring Layer)
**技术栈**: Go/Rust/Python
- **sira-monitor**: 分布式监控，日志收集，告警系统
- **sira-storage**: 多后端存储抽象，缓存层，持久化
- **插件集成**: 数据源插件、存储适配器插件、监控插件

#### 5. 🎯 学习演化层 (Learning Layer)
**技术栈**: Python
- **sira-learning**: 机器学习模型，性能优化，策略更新
- **sira-analytics**: 数据分析，模式识别，预测算法
- **插件集成**: ML模型插件、分析算法插件、学习策略插件

#### 6. 🛡️ 系统治理层 (Governance Layer)
**技术栈**: Go/Rust
- **sira-governance**: 服务发现，配置管理，安全策略
- **sira-security**: 认证授权，访问控制，审计日志
- **插件集成**: 安全策略插件、治理规则插件

## 🎯 战略定位：专注网关，深刻拓展

### 核心理念

**专注网关**：坚守AI网关的核心职责，提供卓越的API代理、智能路由和流量管理能力。

**深刻拓展**：在网关基础上，提供深度智能化能力，为AI应用的完整生命周期提供支持。

### 功能分层

| 层次 | 职责 | 特性 | 集成友好性 |
|------|------|------|------------|
| **网关核心** | API代理、路由、负载均衡 | 高性能、容错、监控 | ⭐⭐⭐⭐⭐ |
| **深度拓展** | 会话管理、存储抽象、智能调度 | 智能化、持久化、扩展性 | ⭐⭐⭐⭐ |
| **集成接口** | 标准化API、插件系统、配置管理 | 易集成、可定制、标准化 | ⭐⭐⭐⭐⭐ |

### 为其他项目提供的集成方案

#### 1. 🎨 AI应用集成 (Sira as Gateway)

```rust
// 其他AI应用可以通过标准接口集成Sira网关
use sira_gateway::{GatewayClient, RouteConfig};

let client = GatewayClient::new("http://sira-gateway:8080");
let route = RouteConfig::new("/api/v1/chat", "ai-service");

// 自动获得：路由、智能调度、监控、容错等能力
```

#### 2. 🔧 微服务集成 (Sira as Infrastructure)

```rust
// 作为基础设施，为其他微服务提供AI能力
use sira_ai_backends::{AiBackendClient, ChatRequest};

let ai_client = AiBackendClient::connect("sira-gateway:9090");
// 直接调用AI服务，无需关心路由和负载均衡
```

#### 3. 📊 监控集成 (Sira as Observability)

```rust
// 其他项目可以通过标准监控接口集成
use sira_core::metrics::{MetricsClient, Counter};

let metrics = MetricsClient::connect("sira-gateway:9091");
// 获取网关的监控数据，进行统一监控
```

#### 4. 🔌 插件集成 (Sira as Platform)

```rust
// 开发自定义插件，扩展网关功能
use sira_core::plugin::{Plugin, PluginContext};

#[derive(Plugin)]
struct CustomAuthPlugin;

impl Plugin for CustomAuthPlugin {
    fn name(&self) -> &str { "custom-auth" }

    async fn process(&self, ctx: &mut PluginContext) -> Result<(), Error> {
        // 自定义认证逻辑
        Ok(())
    }
}
```

## 📋 开发路线图

### Phase 1: 架构重构 🔄
- [x] 重新设计分层架构
- [x] 更新README和文档
- [ ] 重构项目目录结构
- [ ] 建立多语言开发环境

### Phase 2: 执行内核层 (Rust) ✅
- [x] sira-core: 微内核架构
- [x] sira-gateway: HTTP/WebSocket网关
- [x] sira-ai-backends: AI后端集成
- [x] sira-utils: 工具库

### Phase 3: 调用/智能层 (Python + Go) 🚀
- [ ] sira-brain: AI智能逻辑 (Python)
- [ ] sira-scheduler: 调度管理 (Go)
- [ ] 工作流编排引擎
- [ ] 智能决策系统

### Phase 4: 前端交互层 (JS/TS + WASM) 📱
- [ ] sira-web: Web界面 (React/Vue)
- [ ] sira-wasm: 高性能组件 (Rust)
- [ ] 实时数据可视化
- [ ] 交互式控制面板

### Phase 5: 数据监控层 (Go/Rust/Python) 📊
- [ ] sira-monitor: 监控系统 (Go)
- [ ] sira-storage: 存储层 (Rust)
- [ ] 日志收集和分析
- [ ] 性能指标和告警

### Phase 6: 系统治理层 (Go/Rust) 🛡️
- [ ] sira-governance: 服务治理 (Go)
- [ ] sira-security: 安全管理 (Rust)
- [ ] 配置管理和发现
- [ ] 多租户和权限控制

## 💡 架构设计哲学

### 为什么是微内核+插件驱动的分层微服务架构？

1. **双重架构优势融合**：
   - **微内核**: 提供稳定、可扩展的核心平台
   - **插件系统**: 实现热插拔、动态扩展的能力
   - **分层微服务**: 技术栈多样化，职责分离清晰
   - **统一生态**: 插件跨越层边界，形成完整解决方案

2. **世界级架构特性**：
   - **模块化**: 每个组件都是独立的插件，可以独立开发测试
   - **可扩展性**: 插件生态系统支持无限扩展
   - **高性能**: Rust内核保证核心性能，插件沙箱隔离
   - **容错性**: 插件失败不影响核心系统运行
   - **热更新**: 支持运行时插件加载和卸载

### 融合架构的核心价值

| 架构特性 | 传统微服务 | 微内核+插件 | Sira融合方案 |
|---------|-----------|------------|-------------|
| **扩展性** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **性能** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **维护性** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **开发效率** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **部署复杂度** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### 插件生态系统的设计原则

#### 🎯 统一插件框架 (Unified Plugin Framework)
- **标准化接口**: 所有插件实现统一的生命周期接口
- **类型安全**: Rust保证插件间的类型安全通信
- **依赖管理**: 自动解决插件间的依赖关系
- **版本兼容**: 插件版本管理和兼容性检查

#### 🔄 插件生命周期管理
```
插件安装 → 依赖解析 → 类型检查 → 注册服务 → 启动运行 → 热更新 → 优雅停止
```

#### 🌐 跨层插件通信
- **消息总线**: 插件间的事件驱动通信
- **服务发现**: 自动发现和连接其他插件服务
- **协议标准化**: 统一的RPC和数据交换协议

### 技术栈选择的哲学

| 层次 | 技术栈 | 核心考量 | 关键优势 |
|------|-------|---------|---------|
| **前端交互层** | JS/TS + WASM | 用户体验 + 开发效率 | 生态丰富 + 快速迭代 |
| **调用/智能层** | Python + Go | AI生态 + 高并发 | 算法创新 + 系统稳定 |
| **执行内核层** | Rust | 性能 + 安全 | 内存安全 + 零成本抽象 |
| **数据监控层** | Go/Rust/Python | 可靠性 + 生态平衡 | 稳定运行 + 分析能力 |
| **学习演化层** | Python | ML生态 + 创新速度 | 算法领先 + 快速实验 |
| **系统治理层** | Go/Rust | 高并发 + 安全控制 | 企业级稳定 + 访问控制 |

### 为世界级产品预留空间

这种融合架构为未来发展奠定了坚实基础：

- **企业级扩展**: 支持多租户、SLA保证、企业级安全
- **云原生支持**: Kubernetes部署、Service Mesh集成
- **AI原生**: 深度学习模型集成、智能运维
- **生态建设**: 开源插件市场、商业化路径
- **全球化**: 多语言支持、国际化部署

## 🎉 项目愿景

**Sira不仅仅是一个AI网关，更是世界级的智能AI生态操作系统。**

通过"微内核+插件驱动的分层微服务"架构，我们致力于打造：

1. **世界级架构标杆**：融合微内核和微服务的双重优势，开创AI基础设施新范式
2. **统一插件生态**：构建跨越技术栈的插件市场，让创新触手可及
3. **企业级AI平台**：从单体应用到分布式集群的无缝扩展能力
4. **开源商业化典范**：开源驱动创新，商业服务赋能，为开发者创造价值

### 🌟 Sira的核心价值主张

- **🎯 专注网关，深刻拓展**：坚守AI网关核心，深度扩展智能化能力
- **🔌 插件即服务**：让每个功能都是可插拔的服务组件
- **🌐 技术栈中立**：支持多语言协作，发挥各技术栈优势
- **⚡ 高性能保障**：Rust内核确保核心性能，插件沙箱隔离保障稳定
- **🔄 热更新生态**：运行时动态加载，业务连续性不受影响
- **🏢 企业级就绪**：多租户、安全合规、SLA保证、运维友好

---

## 🚀 立即开始

### Rust执行内核 (核心层)

```bash
# 克隆项目
git clone https://github.com/zycxfyh/sira.git
cd sira

# 安装Rust依赖
cargo build

# 运行网关核心
cargo run --bin sira-gateway
```

### Python智能层 (AI逻辑)

```bash
# 进入Python目录
cd layers/python

# 安装Python依赖
pip install -r requirements.txt

# 运行AI大脑
python -m sira_brain
```

### Go调度层 (并发管理)

```bash
# 进入Go目录
cd layers/go

# 安装Go依赖
go mod download

# 运行调度器
go run cmd/scheduler/main.go
```

### 前端界面 (用户交互)

```bash
# 进入前端目录
cd layers/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 📞 联系与贡献

- **项目主页**: https://github.com/zycxfyh/sira
- **问题反馈**: https://github.com/zycxfyh/sira/issues
- **邮箱**: 1666384464@qq.com

我们欢迎任何形式的贡献，无论是代码、文档，还是想法建议！

---

<p align="center">
  <strong>🚀 Sira AI Gateway</strong>
  <br>
  <em>专注网关，深刻拓展 • 连接AI应用的桥梁</em>
</p>

