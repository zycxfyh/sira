# 🚀 CI/CD Pipeline 使用指南

本文档详细介绍Sira AI Gateway的CI/CD Pipeline的使用方法和最佳实践。

## 📋 目录

- [快速开始](#快速开始)
- [工作流阶段详解](#工作流阶段详解)
- [配置管理](#配置管理)
- [故障排除](#故障排除)
- [最佳实践](#最佳实践)

## 🚀 快速开始

### 1. 分支策略

```mermaid
graph LR
    A[feature/*] --> B[develop]
    B --> C[staging]
    C --> D[main/production]
```

- `main`: 生产环境代码
- `develop`: 开发环境代码
- `feature/*`: 特性分支

### 2. 提交规范

```bash
# 特性提交
git commit -m "feat: add user authentication"

# 修复提交
git commit -m "fix: resolve memory leak in cache"

# 文档提交
git commit -m "docs: update API documentation"
```

### 3. PR创建

1. 从 `develop` 分支创建特性分支
2. 推送代码并创建PR
3. 等待CI/CD Pipeline完成
4. 代码审查通过后合并

## 🔍 工作流阶段详解

### 阶段1: 本地验证环境 🔍

**执行内容:**

- Node.js版本验证
- 项目结构检查
- 依赖完整性验证
- 许可证合规检查

**成功标准:**

- 所有必需文件存在
- Node.js版本兼容
- 依赖安装成功

**故障排除:**

```bash
# 检查Node.js版本
node --version

# 验证项目结构
ls -la && cat package.json
```

### 阶段2: 智能测试执行 🧪

**测试类型:**

- **单元测试**: 单个函数/模块测试
- **集成测试**: 模块间交互测试
- **组件测试**: UI组件功能测试
- **契约测试**: API接口契约验证

**质量门禁:**

```javascript
// 覆盖率阈值 (jest.config.js)
coverageThreshold: {
  global: {
    lines: 80,
    functions: 85,
    branches: 75,
    statements: 80
  }
}
```

**运行测试:**

```bash
# 本地运行测试
npm test

# 运行覆盖率测试
npm run test:coverage

# 运行特定类型测试
npm run test:unit
npm run test:integration
npm run test:e2e
```

### 阶段3: 高级安全分析 🔒

**安全扫描:**

- **npm审计**: 依赖漏洞扫描
- **CodeQL**: 代码安全分析
- **Trivy**: 容器安全扫描
- **Semgrep**: 自定义安全规则

**安全评分计算:**

```javascript
// 安全评分算法
function calculateSecurityScore(vulnerabilities) {
  let score = 100;
  score -= vulnerabilities.critical * 20; // 严重漏洞扣20分
  score -= vulnerabilities.high * 10; // 高风险扣10分
  score -= vulnerabilities.moderate * 2; // 中风险扣2分
  return Math.max(0, score);
}
```

### 阶段4: 端到端测试 🌐

**测试环境:**

```yaml
# 测试服务配置 (docker-compose.test.yml)
services:
  redis:
    image: redis:7-alpine
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: test_password
  rabbitmq:
    image: rabbitmq:3-management-alpine
```

**API兼容性测试:**

```javascript
// 向后兼容性检查
const apiVersions = ['v1', 'v2'];
apiVersions.forEach(version => {
  test(`${version} API compatibility`, async () => {
    const response = await request(app)
      .get(`/api/${version}/models`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
  });
});
```

### 阶段5: PR审核流程 📋

**自动化检查:**

- 代码质量分析
- 复杂度评估
- 安全问题检测
- 风险等级评定

**风险评估算法:**

```javascript
function assessPRRisk(changes) {
  let risk = 0;

  // 文件数量风险
  if (changes.files > 50) risk += 30;
  if (changes.files > 20) risk += 15;

  // 代码行数风险
  if (changes.lines > 1000) risk += 25;
  if (changes.lines > 500) risk += 10;

  // 测试覆盖风险
  const testRatio = changes.testFiles / changes.files;
  if (testRatio < 0.2) risk += 20;

  return risk;
}
```

### 阶段6: Staging部署 🚀

**部署策略:**

```yaml
# 金丝雀发布配置
canary:
  initialTraffic: 10% # 初始流量
  increment: 25% # 流量递增
  validationTime: 300s # 验证时间
  rollbackThreshold: 5% # 回滚阈值
```

**验证检查:**

```bash
# 健康检查
curl -f https://staging.sira-gateway.com/health

# API功能测试
curl -X POST https://staging.sira-gateway.com/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}'
```

### 阶段7: 回归测试 🔄

**性能回归检测:**

```javascript
// 性能基准比较
function checkPerformanceRegression(current, baseline) {
  const threshold = 0.05; // 5% 性能下降阈值

  Object.keys(baseline).forEach(metric => {
    const regression = (current[metric] - baseline[metric]) / baseline[metric];
    if (regression > threshold) {
      throw new Error(`${metric} regressed by ${regression * 100}%`);
    }
  });
}
```

### 阶段8: 生产部署 🎯

**生产就绪检查:**

- [ ] 安全审计通过
- [ ] 性能基准达成
- [ ] 集成测试通过
- [ ] 回滚计划准备
- [ ] 监控配置完成

**部署验证:**

```bash
# 生产健康检查
curl -f https://api.sira-gateway.com/health

# SSL证书验证
openssl s_client -connect api.sira-gateway.com:443 -servername api.sira-gateway.com

# 负载测试
npm run test:load -- --url=https://api.sira-gateway.com --concurrency=10 --duration=60
```

### 阶段9: 监控回溯 📊

**监控指标:**

```javascript
// 关键指标定义
const monitoringMetrics = {
  availability: {
    target: 99.9,
    alert: 99.5,
  },
  responseTime: {
    p95: 2000, // 毫秒
    p99: 5000,
  },
  errorRate: {
    threshold: 0.05, // 5%
    window: 300000, // 5分钟
  },
};
```

## ⚙️ 配置管理

### 环境变量配置

创建 `.env` 文件:

```bash
# 环境配置
NODE_ENV=production
PORT=8080

# 数据库配置
DATABASE_URL=postgresql://user:pass@host:5432/db

# 缓存配置
REDIS_URL=redis://host:6379

# 监控配置
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
```

### 秘密管理

使用GitHub Secrets配置敏感信息:

```yaml
# .github/workflows/ci.yml
env:
  DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
  API_KEYS: ${{ secrets.API_KEYS }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### 部署配置

Kubernetes部署配置示例:

```yaml
# k8s/production-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sira-gateway-production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  template:
    spec:
      containers:
        - name: sira-gateway
          image: ghcr.io/your-org/sira-gateway:latest
          resources:
            requests:
              memory: '512Mi'
              cpu: '200m'
            limits:
              memory: '1Gi'
              cpu: '1000m'
```

## 🔧 故障排除

### 常见问题解决

#### 1. 构建失败

**问题:** `npm install` 失败

```bash
# 解决方案
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### 2. 测试超时

**问题:** Jest测试超时

```bash
# 解决方案
export JEST_TIMEOUT=10000
npm test -- --testTimeout=10000
```

#### 3. Docker构建失败

**问题:** 构建缓存问题

```bash
# 解决方案
docker system prune -a
docker build --no-cache -t sira-gateway .
```

#### 4. 部署失败

**问题:** Kubernetes部署失败

```bash
# 检查状态
kubectl get pods -n production
kubectl describe pod <pod-name> -n production
kubectl logs <pod-name> -n production
```

### 调试技巧

#### 启用详细日志

```bash
# 设置环境变量
export ACTIONS_STEP_DEBUG=true
export ACTIONS_RUNNER_DEBUG=true

# 运行工作流
gh workflow run ci.yml --ref main
```

#### 本地测试

```bash
# 运行Docker容器本地测试
docker run -p 8080:8080 sira-gateway:latest

# 使用curl测试API
curl http://localhost:8080/health
```

## 📈 最佳实践

### 开发最佳实践

1. **小批量提交**

   ```bash
   # 避免大PR，使用小批量提交
   git add -p
   git commit -m "feat: implement user login"
   ```

2. **编写测试**

   ```javascript
   // 为每个功能编写测试
   describe('UserService', () => {
     test('should create user', async () => {
       const user = await userService.create({ name: 'test' });
       expect(user.id).toBeDefined();
     });
   });
   ```

3. **安全编码**

   ```javascript
   // 避免安全漏洞
   // ❌ 不安全
   app.get('/user/:id', (req, res) => {
     const user = users.find(u => u.id === req.params.id);
   });

   // ✅ 安全
   app.get('/user/:id', (req, res) => {
     const userId = parseInt(req.params.id);
     if (isNaN(userId)) return res.status(400).json({ error: 'Invalid ID' });
     const user = users.find(u => u.id === userId);
   });
   ```

### CI/CD最佳实践

1. **快速反馈**
   - 尽早失败
   - 并行执行任务
   - 使用缓存加速

2. **安全第一**
   - 定期更新依赖
   - 使用最小权限原则
   - 实施安全扫描

3. **监控告警**
   - 设置关键指标监控
   - 配置自动告警
   - 定期审查告警规则

### 性能优化

1. **构建优化**

   ```dockerfile
   # 使用多阶段构建
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production

   FROM node:20-alpine AS runtime
   COPY --from=builder /app/node_modules ./node_modules
   COPY . .
   CMD ["npm", "start"]
   ```

2. **测试优化**

   ```javascript
   // 并行测试执行
   module.exports = {
     maxWorkers: '50%', // 使用50% CPU核心
     testTimeout: 10000,
   };
   ```

3. **缓存策略**

   ```yaml
   # 依赖缓存
   - uses: actions/cache@v4
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

   # 构建缓存
   - uses: actions/cache@v4
     with:
       path: .next/cache
       key: ${{ runner.os }}-nextjs-${{ hashFiles('**/package-lock.json') }}
   ```

## 📞 支持

### 获取帮助

1. **查看日志**: GitHub Actions运行日志
2. **检查文档**: 本文档和相关文档
3. **提交Issue**: 详细描述问题和复现步骤
4. **联系团队**: 通过Slack或邮件联系DevOps团队

### 紧急情况

对于生产环境紧急问题:

1. 立即通知DevOps团队
2. 执行自动回滚 (如果可用)
3. 启动应急响应流程
4. 进行事后分析

---

_📚 持续更新中 | 🤝 欢迎贡献 | 🚀 一起构建更好的CI/CD_
