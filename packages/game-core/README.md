# Game Core (游戏核心包)

## 概述

Game Core是创世星环系统的游戏逻辑核心包，采用领域驱动设计(DDD)架构。目前该包处于规划阶段，计划实现游戏规则引擎、状态管理和核心游戏逻辑。

## 状态

**当前状态**: 规划中 - 架构设计阶段

该包计划采用经典的DDD分层架构：

- **Domain**: 领域层 - 核心业务逻辑和规则
- **Application**: 应用层 - 用例和应用服务
- **Infrastructure**: 基础设施层 - 外部依赖和数据访问
- **Interfaces**: 接口层 - API和外部接口

## 计划架构

```
packages/game-core/
├── src/
│   ├── domain/              # 领域层
│   │   ├── entities/        # 领域实体
│   │   ├── value-objects/   # 值对象
│   │   ├── services/        # 领域服务
│   │   └── events/          # 领域事件
│   ├── application/         # 应用层
│   │   ├── use-cases/       # 用例
│   │   ├── services/        # 应用服务
│   │   └── dto/             # 数据传输对象
│   ├── infrastructure/      # 基础设施层
│   │   ├── repositories/    # 仓储实现
│   │   ├── external/        # 外部服务集成
│   │   └── config/          # 配置
│   └── interfaces/          # 接口层
│       ├── controllers/     # API控制器
│       ├── presenters/      # 展示器
│       └── dto/             # 接口DTO
├── test/                    # 测试文件
└── README.md
```

## 计划功能

### 领域层 (Domain)

- **Game Entity**: 游戏实体，包含游戏状态和规则
- **Character Entity**: 角色实体，包含属性和能力
- **World Entity**: 世界实体，包含地理和规则
- **Action Value Object**: 行动值对象，定义行动类型和参数
- **Game Rules**: 游戏规则服务，验证行动有效性
- **State Manager**: 状态管理器，处理状态转换

### 应用层 (Application)

- **Create Game Use Case**: 创建游戏用例
- **Execute Action Use Case**: 执行行动用例
- **Game Query Service**: 游戏查询服务
- **Character Management Service**: 角色管理服务

### 基础设施层 (Infrastructure)

- **Prisma Repositories**: 基于Prisma的仓储实现
- **Redis Cache**: 缓存实现
- **Event Bus Integration**: 事件总线集成
- **AI Service Integration**: AI服务集成

## 相关文档

- [Common Backend文档](../common-backend/README.md)
- [Logic Agent文档](../../apps/logic-agent/README.md)
- [领域驱动设计](https://domainlanguage.com/ddd/)
