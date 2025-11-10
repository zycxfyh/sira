# 📁 Sira AI Gateway - 目录结构说明

## 整体架构

```
sira-ai-gateway/
├── src/                          # 源代码目录
│   ├── api/                      # API层 - 控制器和路由
│   │   ├── controllers/          # API控制器
│   │   ├── middleware/           # API中间件
│   │   ├── routes/               # 路由定义
│   │   └── validators/           # 请求验证器
│   ├── core/                     # 核心业务逻辑
│   │   ├── services/             # 核心服务
│   │   ├── ml-framework/         # 机器学习框架
│   │   ├── middleware/           # 核心中间件
│   │   └── *.js                  # 核心管理器
│   ├── middleware/               # 全局中间件
│   ├── i18n/                     # 国际化支持
│   ├── types/                    # 类型定义
│   ├── config/                   # 配置文件
│   ├── admin/                    # 管理面板
│   ├── bin/                      # CLI工具
│   ├── test/                     # 测试文件
│   ├── utils/                    # 工具函数
│   └── data/                     # 数据文件
├── public/                       # 静态资源
├── scripts/                      # 构建和部署脚本
├── docs/                         # 项目文档
├── examples/                     # 示例代码
├── docker/                       # Docker配置
├── k8s/                         # Kubernetes配置
└── *.md                         # 项目文档
```

## 详细说明

### 📂 src/api/ - API接口层
负责处理HTTP请求和响应，是外部系统与Sira网关的交互入口。

- **controllers/**: API控制器，封装业务逻辑
- **middleware/**: API级别中间件，如认证、验证
- **routes/**: 路由定义和映射
- **validators/**: 请求数据验证规则

### 📂 src/core/ - 核心业务逻辑
包含所有核心功能实现，是项目的核心价值所在。

#### 核心管理器
- **intelligent-routing-manager.js**: 智能路由引擎
- **cache-manager.js**: 多层缓存系统
- **rate-limiter-manager.js**: 请求限流管理
- **ab-test-manager.js**: A/B测试框架
- **price-monitor-manager.js**: 价格监控系统
- **usage-analytics.js**: 使用分析统计

#### 子目录
- **services/**: 核心服务组件
- **ml-framework/**: 机器学习优化框架
- **middleware/**: 核心中间件
- **policies/**: 策略配置

### 📂 src/middleware/ - 全局中间件
全局级别的中间件，用于处理跨API的通用功能。

- **auth.js**: 身份认证中间件
- **logging.js**: 日志记录和监控中间件

### 📂 src/i18n/ - 国际化支持
完整的国际化系统，支持多语言界面和API响应。

- **i18n-service.js**: 国际化服务核心
- **locales/**: 语言包文件
- **middleware/**: i18n中间件
- **utils/**: 翻译工具函数

### 📂 src/types/ - 类型定义
TypeScript风格的类型定义，提供更好的开发体验。

### 📂 src/config/ - 配置管理
配置文件和配置管理系统。

- **gateway.config.yml**: 主配置文件
- **ai-providers.yml**: AI服务商配置
- **models/**: AI模型配置

### 📂 src/admin/ - 管理面板
Web管理界面，提供系统监控和管理功能。

- **public/**: 静态资源文件
- ***.js**: 管理面板后端逻辑

### 📂 src/bin/ - CLI工具
命令行工具，用于项目管理和部署。

### 📂 src/test/ - 测试文件
完整的测试体系，包括单元测试、集成测试、性能测试。

## 设计原则

### 🏗️ 分层架构
- **API层**: 处理外部请求和响应
- **核心层**: 实现业务逻辑和核心功能
- **基础设施层**: 提供基础服务和工具

### 📦 模块化设计
- **高内聚**: 相关功能集中在一个模块内
- **低耦合**: 模块间依赖关系清晰可控
- **可扩展**: 易于添加新功能和修改现有功能

### 🔧 配置驱动
- **环境分离**: 不同环境的配置独立管理
- **动态加载**: 支持运行时配置更新
- **验证机制**: 配置文件的语法和逻辑验证

## 开发指南

### 添加新功能
1. 根据功能类型选择合适的目录
2. 在对应目录下创建新文件
3. 更新相关的导入和导出
4. 添加相应的测试文件
5. 更新文档

### 目录命名规范
- 使用小写字母和连字符
- 语义化命名，清晰表达目录用途
- 保持命名的一致性

### 文件组织原则
- 相关文件放在同一目录
- 按功能模块组织，而不是按文件类型
- 保持目录层级适中，避免过深或过浅

## 迁移说明

### 从旧结构迁移
- `src/gateway/` → 合并到 `src/core/`
- `src/locales/` → 迁移到 `src/i18n/locales/`
- `src/admin/` → 重构为更简洁的管理面板
- 散乱的工具文件 → 组织到 `src/bin/` 和 `scripts/`

### 兼容性保证
- API接口保持向后兼容
- 配置文件格式保持稳定
- 部署方式保持一致

---

*清晰的目录结构是高质量代码的基础*

*—— Sira AI Gateway 开发团队*
