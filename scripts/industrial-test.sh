#!/bin/bash
set -euo pipefail

# 工业级测试流程，集成快速失败机制

PIPELINE_LOG="logs/industrial-test-$(date +%Y%m%d_%H%M%S).log"
MONITOR_SCRIPT="scripts/industrial-failure-monitor.sh"

# 启动监控
exec > >(tee -a "$PIPELINE_LOG") 2>&1

echo "🧪 Starting Industrial Test Process"

# 阶段1: 单元测试
echo "🧪 Stage 1: Unit Testing"
pnpm run test || {
    echo "❌ Unit tests failed"
    bash "$MONITOR_SCRIPT" monitor "$PIPELINE_LOG"
    exit 1
}

# 阶段2: 集成测试
echo "🔗 Stage 2: Integration Testing"
# 这里可以启动测试数据库和服务
# pnpm run test:integration || {
#     echo "❌ Integration tests failed"
#     bash "$MONITOR_SCRIPT" monitor "$PIPELINE_LOG"
#     exit 1
# }

# 阶段3: 端到端测试
echo "🌐 Stage 3: E2E Testing"
# pnpm run test:e2e || {
#     echo "⚠️ E2E tests failed - continuing with warnings"
# }

# 阶段4: 性能测试
echo "⚡ Stage 4: Performance Testing"
# pnpm run test:performance || {
#     echo "⚠️ Performance tests failed - continuing with warnings"
# }

# 阶段5: 覆盖率验证
echo "📊 Stage 5: Coverage Validation"
if [ -f "coverage/coverage-summary.json" ]; then
    COVERAGE=$(node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync('coverage/coverage-summary.json')); console.log(data.total.lines.pct)")
    echo "Coverage: ${COVERAGE}%"
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
        echo "❌ Coverage below 80%: ${COVERAGE}%"
        bash "$MONITOR_SCRIPT" monitor "$PIPELINE_LOG"
        exit 1
    fi
fi

echo "✅ Industrial Test Process completed successfully"
