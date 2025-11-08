# Sira AI网关 - 工业级测试指南

## 概述

Sira AI网关的工业级测试框架提供全面的测试能力，涵盖从单元测试到生产环境验证的完整测试生命周期。基于Google SRE、Netflix Chaos Engineering和AWS Well-Architected的最佳实践。

## 🧪 测试类型

### 1. 单元测试 (Unit Tests)

- **目的**: 验证单个组件的正确性
- **范围**: 函数、类、模块
- **工具**: Mocha + Chai + Sinon
- **覆盖率目标**: > 85%

```bash
cd ai-gateway
npm run test:unit
```

### 2. 集成测试 (Integration Tests)

- **目的**: 验证组件间的协作
- **范围**: API调用、数据库操作、服务间通信
- **工具**: Supertest + TestContainers
- **成功率目标**: > 90%

```bash
cd ai-gateway
npm run test:integration
```

### 3. 端到端测试 (E2E Tests)

- **目的**: 验证完整用户旅程
- **范围**: 用户界面到后端服务
- **工具**: Playwright + Puppeteer
- **成功率目标**: > 85%

```bash
cd ai-gateway
npm run test:e2e
```

### 4. 性能测试 (Performance Tests)

- **目的**: 验证系统性能指标
- **范围**: 响应时间、吞吐量、资源使用
- **工具**: Custom Performance Framework
- **目标**: P95 < 2000ms, 吞吐量 > 50 RPS

```bash
cd ai-gateway
npm run test:industrial:performance
```

### 5. 负载测试 (Load Tests)

- **目的**: 验证系统在正常负载下的表现
- **范围**: 持续负载、峰值负载、逐步负载
- **工具**: Custom Load Generator
- **目标**: 错误率 < 1%, 响应时间稳定

```bash
cd ai-gateway
npm run test:industrial:load
```

### 6. 压力测试 (Stress Tests)

- **目的**: 发现系统极限和薄弱点
- **范围**: 资源耗尽、内存压力、CPU过载
- **工具**: Custom Stress Framework
- **目标**: 识别系统瓶颈和恢复能力

```bash
cd ai-gateway
npm run test:industrial:stress
```

### 7. 可靠性测试 (Reliability Tests)

- **目的**: 验证长期运行的稳定性
- **范围**: 24/7运行、故障恢复、SLO合规
- **工具**: Custom Reliability Framework
- **目标**: 可用性 > 99.9%, MTTR < 5分钟

### 8. 安全测试 (Security Tests)

- **目的**: 识别安全漏洞和弱点
- **范围**: 依赖扫描、代码分析、渗透测试
- **工具**: ESLint Security + npm audit
- **目标**: 零严重漏洞

## 🚀 快速开始

### 环境准备

```bash
# 1. 安装依赖
cd ai-gateway
npm ci

# 2. 安装Playwright浏览器
npx playwright install --with-deps

# 3. 启动测试数据库 (可选)
docker run -d -p 6379:6379 redis:7-alpine
```

### 运行快速测试

```bash
# 运行快速测试套件 (推荐用于开发)
npm run test:industrial:quick
```

### 运行全面测试

```bash
# 运行完整的工业级测试套件
npm run test:industrial
```

### 运行特定类型测试

```bash
# 性能测试
npm run test:industrial:performance

# 负载测试 (50 RPS, 60秒)
npm run test:industrial:load

# 压力测试 (中等强度, 内存压力)
npm run test:industrial:stress
```

## 🛠️ 高级用法

### 使用命令行运行器

```bash
# 显示帮助信息
node run-industrial-tests.js --help

# 运行综合测试 (排除可靠性测试以加快速度)
node run-industrial-tests.js comprehensive --include-reliability false

# 运行性能基准测试
node run-industrial-tests.js performance

# 运行自定义负载测试
node run-industrial-tests.js load --target-rps 100 --duration 120 --scenario ai_chat_performance

# 运行压力测试
node run-industrial-tests.js stress --intensity high --scenario memory_stress
```

### 使用Shell脚本

```bash
# 运行CI模式测试 (带覆盖率和性能测试)
./scripts/industrial-testing.sh --test-type comprehensive --coverage --performance --reports

# 运行快速验证
./scripts/industrial-testing.sh unit integration

# 自定义配置运行
TEST_TYPE=performance TARGET_RPS=200 ./scripts/industrial-testing.sh
```

## 📊 测试配置

### 配置文件

测试配置位于 `test-config.json`，包含：

- **测试环境配置**: 不同测试类型的环境设置
- **测试场景定义**: API端点、负载模式、用户旅程
- **质量门禁**: 覆盖率、成功率、性能基准
- **CI/CD配置**: 流水线阶段、超时设置、通知配置

### 自定义测试场景

```javascript
// 在 test-config.json 中添加自定义场景
{
  "test_scenarios": {
    "custom_scenario": {
      "name": "自定义测试场景",
      "endpoint": "/api/custom",
      "method": "POST",
      "payload": { "data": "test" },
      "headers": { "Authorization": "Bearer token" },
      "weight": 0.1,
      "expectedResponseTime": 1000
    }
  }
}
```

### 负载模式配置

```json
{
  "load_profiles": {
    "custom_load": {
      "name": "自定义负载",
      "pattern": "custom",
      "parameters": {
        "startRPS": 10,
        "endRPS": 200,
        "duration": 300,
        "pattern": "sinusoidal"
      }
    }
  }
}
```

## 📈 报告和分析

### 报告类型

- **HTML报告**: 交互式Web报告，包含图表和详细分析
- **JSON报告**: 结构化数据，适合自动化处理
- **XML报告**: JUnit兼容格式，CI/CD工具集成
- **PDF报告**: 正式文档格式，适合存档

### 查看报告

```bash
# HTML报告 (推荐)
open ai-gateway/reports/html/test-report-*.html

# JSON报告
cat ai-gateway/reports/json/test-report-*.json | jq .

# 命令行摘要
tail -20 ai-gateway/reports/final-report.json
```

### 性能趋势分析

```bash
# 查看性能趋势
node -e "
const reports = require('./ai-gateway/reports/report-history.json');
console.log('性能趋势:');
reports.slice(-10).forEach(r => {
  console.log(\`\${r.generatedAt}: \${r.summary.successRate} 成功率, \${r.summary.averageDuration}ms 平均响应\`);
});
"
```

## 🔧 CI/CD集成

### GitHub Actions

项目包含完整的GitHub Actions工作流：

```yaml
# .github/workflows/industrial-testing.yml
name: Industrial Testing Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 0' # 每周日凌晨运行
  workflow_dispatch:
    inputs:
      test_type:
        description: 'Test Type'
        default: 'comprehensive'
```

### 质量门禁

- **单元测试覆盖率**: ≥ 85%
- **测试成功率**: ≥ 95%
- **性能基准**: P95响应时间 ≤ 2000ms
- **安全漏洞**: 零严重漏洞
- **代码质量**: ESLint和Prettier检查通过

### 部署门禁

只有当所有质量门禁通过时，代码才会：

1. 自动部署到暂存环境
2. 触发生产环境部署审批
3. 发送通知给相关团队

## 🎯 最佳实践

### 测试策略

1. **分层测试**: 单元 → 集成 → E2E → 性能
2. **持续测试**: 每次提交都运行快速测试
3. **并行执行**: 利用多核CPU并行运行测试
4. **环境隔离**: 每个测试使用独立的资源
5. **数据管理**: 使用测试数据生成器和清理脚本

### 性能测试最佳实践

1. **预热阶段**: 测试前先运行一段时间预热
2. **渐进负载**: 从低负载开始逐渐增加
3. **稳定期**: 在目标负载下运行足够长时间
4. **冷却期**: 测试结束后逐步降低负载
5. **多次运行**: 多次运行取平均值以减少波动

### 监控和告警

```bash
# 实时监控测试进度
tail -f ai-gateway/logs/test-output.log

# 设置告警阈值
export TEST_FAILURE_THRESHOLD=5  # 失败率阈值
export PERFORMANCE_DEGRADATION_THRESHOLD=15  # 性能下降阈值

# 监控资源使用
watch -n 5 'ps aux | grep node | grep -v grep'
```

## 🐛 故障排除

### 常见问题

**Q: 测试超时**
A: 增加超时时间或优化测试代码

```bash
export TEST_TIMEOUT=180000  # 3分钟
```

**Q: 内存不足**
A: 增加Node.js内存限制

```bash
export NODE_OPTIONS="--max-old-space-size=8192"
```

**Q: 端口冲突**
A: 使用不同的端口或清理占用端口的进程

```bash
lsof -ti:8080 | xargs kill -9
```

**Q: 浏览器测试失败**
A: 重新安装浏览器或检查显示设置

```bash
npx playwright install --force
```

### 调试技巧

```bash
# 启用详细日志
export DEBUG=test:*
export LOG_LEVEL=debug

# 运行单个测试用例
node run-industrial-tests.js quick --filter "AI Chat"

# 跳过特定测试
node run-industrial-tests.js comprehensive --skip e2e

# 生成详细性能分析
export ENABLE_PERFORMANCE_PROFILING=true
npm run test:industrial:performance
```

## 📚 扩展和定制

### 添加自定义测试工具

```javascript
// lib/custom-testing-tool.js
class CustomTestingTool {
  async initialize() {
    // 初始化逻辑
  }

  async runCustomTest(config) {
    // 自定义测试逻辑
  }
}

module.exports = { CustomTestingTool };
```

### 集成第三方工具

```javascript
// 集成k6进行负载测试
const { K6TestingTool } = require('./k6-integration');

const k6Tool = new K6TestingTool();
await k6Tool.runK6Test({
  script: 'load-test.js',
  vus: 100,
  duration: '5m',
});
```

### 自定义报告格式

```javascript
// 扩展报告生成器
class CustomReportGenerator extends TestReportGenerator {
  async generateCustomReport(data) {
    // 自定义报告逻辑
    return customReport;
  }
}
```

## 📞 支持和贡献

### 获取帮助

- 查看[测试配置文档](./test-config.json)
- 运行 `node run-industrial-tests.js --help`
- 检查[GitHub Issues](https://github.com/zycxfyh/sira/issues)

### 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/amazing-test`)
3. 添加测试用例
4. 运行完整测试套件确保通过
5. 提交Pull Request

### 许可证

本测试框架遵循与主项目相同的Apache 2.0许可证。
