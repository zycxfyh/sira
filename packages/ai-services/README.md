# AI Services (AI服务包)

## 概述

AI Services是创世星环系统的AI服务共享包，提供统一的AI服务接口和实现。目前该包处于规划阶段，为未来AI服务的模块化设计奠定基础。

## 状态

**当前状态**: 规划中 - 基础架构设计阶段

该包计划包含：
- AI服务接口定义
- 多AI提供商抽象层
- AI服务编排逻辑
- 智能路由和负载均衡

## 计划架构

```
packages/ai-services/
├── src/
│   ├── interfaces/           # AI服务接口定义
│   ├── providers/           # AI提供商实现
│   ├── services/            # AI服务编排
│   └── types/               # AI相关类型定义
├── test/                    # 测试文件
└── README.md
```

## 相关文档

- [Common Backend文档](../common-backend/README.md)
- [AI代理文档](../../apps/logic-agent/README.md)
