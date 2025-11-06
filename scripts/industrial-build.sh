#!/bin/bash
set -euo pipefail

# 工业级构建流程，集成快速失败机制

PIPELINE_LOG="logs/industrial-build-$(date +%Y%m%d_%H%M%S).log"
MONITOR_SCRIPT="scripts/industrial-failure-monitor.sh"

# 启动监控
exec > >(tee -a "$PIPELINE_LOG") 2>&1

echo "🏗️ Starting Industrial Build Process"

# 阶段1: 环境验证
echo "🔍 Stage 1: Environment Validation"
node --version || { echo "❌ Node.js not found"; exit 1; }
pnpm --version || { echo "❌ pnpm not found"; exit 1; }

# 阶段2: 依赖安装
echo "📦 Stage 2: Dependency Installation"
pnpm install --frozen-lockfile || {
    echo "❌ Dependency installation failed"
    bash "$MONITOR_SCRIPT" monitor "$PIPELINE_LOG"
    exit 1
}

# 阶段3: 构建验证
echo "🔨 Stage 3: Build Validation"
pnpm run build || {
    echo "❌ Build failed"
    bash "$MONITOR_SCRIPT" monitor "$PIPELINE_LOG"
    exit 1
}

# 阶段4: 质量检查
echo "🔍 Stage 4: Quality Checks"
pnpm run lint || {
    echo "⚠️ Lint issues detected - continuing with warnings"
    # 对于lint问题，我们可以选择继续但记录警告
}

# 阶段5: 测试执行
echo "🧪 Stage 5: Test Execution"
pnpm run test || {
    echo "❌ Tests failed"
    bash "$MONITOR_SCRIPT" monitor "$PIPELINE_LOG"
    exit 1
}

# 阶段6: 安全扫描
echo "🔒 Stage 6: Security Scan"
pnpm audit --audit-level high || {
    echo "❌ Security vulnerabilities found"
    bash "$MONITOR_SCRIPT" monitor "$PIPELINE_LOG"
    exit 1
}

echo "✅ Industrial Build Process completed successfully"
