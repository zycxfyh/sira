# Sira - AI网关学习项目

**一个学生学习项目：用代码连接AI，让智能触手可及**

⚠️ **项目状态**: 学习中 - 第三天 | Node.js 18+ | 学生作品

## ✅ 当前完成的功能

- [x] 基本的Express服务器 (端口8080)
- [x] 健康检查端点 (`/health`)
- [x] AI API路由转发 - 连接真实AI服务 (`/api/ai/chat`)
- [x] AI提供商状态检查 (`/api/ai/providers`)
- [x] 完整的测试覆盖 (5个测试用例全部通过)
- [x] 错误处理和404处理
- [x] 安全中间件 (helmet, cors)
- [x] Docker容器化支持 (使用pnpm)

## 🚀 快速开始

### 📦 系统要求

- Node.js 18.0.0+

### 🛠️ 安装和运行

#### 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量 (用于AI API调用)
cp env.template .env
# 编辑 .env 文件，添加你的API密钥

# 启动项目
npm start

# 运行测试
npm test
```

#### Docker运行 (推荐 - 使用pnpm)

```bash
# 使用便捷脚本 (自动配置环境)
./docker-run.sh

# 或者手动运行
docker-compose -f docker-compose.simple.yml up -d

# 查看日志
docker-compose -f docker-compose.simple.yml logs -f

# 停止服务
docker-compose -f docker-compose.simple.yml down
```

> 💡 **为什么用Docker？**
>
> - 环境一致性：避免"在我机器上能跑"的问题
> - 快速部署：一键启动所有服务
> - 使用pnpm：更快的依赖安装和更好的磁盘空间利用

### 🌐 API端点

启动后访问：

- **主页**: http://localhost:8080/
- **健康检查**: http://localhost:8080/health
- **测试路由**: http://localhost:8080/test
- **AI聊天API**: http://localhost:8080/api/ai/chat (POST)
- **AI提供商状态**: http://localhost:8080/api/ai/providers (GET)

### 📡 API使用示例

#### AI聊天请求

```bash
curl -X POST http://localhost:8080/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "你好，请介绍一下自己"}
    ],
    "model": "deepseek-chat"
  }'
```

#### 检查AI提供商状态

```bash
curl http://localhost:8080/api/ai/providers
```

## 📁 项目结构

```
src/
├── server.js      # 🚀 主服务器文件 (简化版)
├── index.js       # 旧的复杂版本 (保留参考)
├── core/          # 复杂的核心功能 (学习参考)
├── config/        # 配置管理
├── locales/       # 国际化文件
├── test/          # 测试文件
│   ├── server.test.js    # ✅ 新服务器测试
│   └── conditions.test.js # 旧测试 (部分修复)
├── bin/           # CLI工具
└── docs/          # 文档
```

## 🎯 学习目标

这是一个**渐进式学习项目**，每天添加新功能：

- **Day 1-2**: 基础服务器搭建和测试 ✅
- **Day 3+**: AI API集成、缓存、负载均衡等

## 📝 学习笔记

查看 [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) 了解项目过程中的问题和解决方案。

## 🤝 联系方式

- 📧 Email: 1666384464@qq.com
- 📱 Phone: 17855398215

---

**⚠️ 免责声明**: 这是一个学生学习项目，仅供学习交流使用，不建议在生产环境中使用。
