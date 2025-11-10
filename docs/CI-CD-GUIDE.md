# CI/CD 指南

本文档介绍Sira AI Gateway项目的持续集成和持续部署流程。

## 📋 工作流概览

### 🔄 CI Pipeline (ci.yml)
自动化的代码质量检查和测试流程。

**触发条件:**
- Push到`main`或`develop`分支
- 针对`main`或`develop`分支的PR
- 手动触发

**包含的检查:**
- ✅ ESLint代码质量检查
- ✅ Biome格式化和导入检查
- ✅ Oxlint快速代码检查
- ✅ 代码格式验证
- ✅ 单元测试(Node.js 18.x 和 20.x)
- ✅ 集成测试(带Redis服务)
- ✅ Docker镜像构建测试
- ✅ 性能基准测试(仅main分支)
- ✅ 测试覆盖率报告

### 🚀 Deploy Pipeline (deploy.yml)
自动化部署到Staging和生产环境。

**触发条件:**
- Push到`main`分支
- CI Pipeline成功完成
- 手动触发(可选择环境)

**部署流程:**
1. 构建并推送Docker镜像到GitHub Container Registry
2. 部署到指定环境(Staging/Production)
3. 健康检查和冒烟测试
4. 性能验证(生产环境)
5. 生成部署报告

### 📦 Release Pipeline (release.yml)
自动化版本发布和分发。

**触发条件:**
- 创建版本标签(`v*.*.*`)
- 手动触发(版本递增)

**发布流程:**
1. 构建发布资产
2. 创建GitHub Release
3. 发布到NPM
4. 推送Docker镜像
5. 生成发布说明

### 🔄 Rollback Pipeline (rollback.yml)
快速回滚到稳定版本。

**触发条件:**
- 手动触发
- 部署失败时自动触发

### 📢 Notification Pipeline (notify.yml)
构建状态通知和监控。

**触发条件:**
- 其他工作流完成时
- 每日定时摘要

## 🛠️ 本地开发设置

### 环境要求
- Node.js 18.x 或 20.x
- Docker (用于容器化测试)
- Git

### 本地测试
```bash
# 安装依赖
npm ci

# 运行所有质量检查
npm run lint:check
npm run lint:biome
npm run format:check

# 运行测试
npm test

# 运行集成测试
npm run test:integration

# 构建Docker镜像
docker build -f Dockerfile.test -t sira-test .
```

## 🔐 必需的密钥

### GitHub Secrets
设置以下secrets用于CI/CD流程：

```
# GitHub Container Registry
GITHUB_TOKEN          # 自动提供给GitHub Actions

# NPM发布
NPM_TOKEN            # NPM访问令牌

# Docker Hub (可选)
DOCKER_USERNAME      # Docker Hub用户名
DOCKER_PASSWORD      # Docker Hub密码

# 通知服务 (可选)
SLACK_WEBHOOK        # Slack Webhook URL
DISCORD_WEBHOOK      # Discord Webhook URL
```

## 📊 质量门禁

### 必须通过的检查
- [ ] ESLint无错误
- [ ] 单元测试通过率 > 80%
- [ ] 代码覆盖率 > 70%
- [ ] Docker构建成功
- [ ] 安全扫描无高危漏洞

### 可选检查
- [ ] 性能基准测试
- [ ] 集成测试
- [ ] 可访问性测试

## 🚀 部署流程

### 开发分支部署
```bash
# 推送到develop分支
git push origin develop

# CI Pipeline自动运行
# 如果通过，可以手动触发Staging部署
```

### 生产部署
```bash
# 创建release分支
git checkout -b release/v1.2.3
git push origin release/v1.2.3

# 创建PR并合并到main
# CI Pipeline运行
# Deploy Pipeline自动触发生产部署
```

### 手动部署
在GitHub Actions中手动触发Deploy工作流，选择目标环境。

## 🔍 监控和告警

### 部署后监控
- 应用健康检查
- 性能指标监控
- 错误日志监控
- 用户访问监控

### 告警条件
- 部署失败
- 健康检查失败
- 性能下降 > 20%
- 错误率 > 5%

## 🛠️ 故障排除

### 常见问题

#### CI Pipeline失败
1. 检查ESLint错误
2. 查看测试失败详情
3. 确认Docker构建日志
4. 检查依赖安装问题

#### 部署失败
1. 检查Docker镜像构建
2. 查看环境变量配置
3. 确认网络连接
4. 检查服务依赖

#### 发布失败
1. 确认NPM_TOKEN权限
2. 检查Docker Hub凭据
3. 验证GitHub Release权限

### 调试技巧

#### 本地调试CI
```bash
# 运行与CI相同的命令
npm ci
npm run lint:check
npm test -- --coverage
```

#### 查看详细日志
- GitHub Actions日志
- Docker构建日志
- 测试覆盖率报告

## 📚 相关文档

- [README.md](../README.md) - 项目概览
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - 测试指南
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 部署指南
- [SECURITY.md](../SECURITY.md) - 安全指南

## 🤝 贡献指南

### 代码提交
1. 创建功能分支
2. 编写测试
3. 确保所有质量检查通过
4. 创建PR
5. 等待CI通过后合并

### 分支策略
- `main`: 生产环境代码
- `develop`: 开发环境代码
- `feature/*`: 功能分支
- `hotfix/*`: 紧急修复分支

---

**最后更新**: $(date)
**维护者**: Sira AI Gateway Team
