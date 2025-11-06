#!/bin/bash

# 文件路径: scripts/demo-fast-failure.sh
# 职责: 演示快速失败机制的工作原理

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🚀 工业化测试快速失败机制演示${NC}"
echo "=================================="

# 演示1: 正常流程
echo -e "\n${GREEN}📋 演示1: 正常测试流程${NC}"
echo "模拟各个阶段的成功执行..."

simulate_stage() {
    local stage="$1"
    local duration="$2"

    echo -n "  $stage: 执行中..."
    sleep "$duration"
    echo -e " ${GREEN}✅ 成功${NC}"
}

echo "开始执行测试阶段..."
simulate_stage "依赖检查" 1
simulate_stage "本地验证" 2
simulate_stage "静态检查" 1
simulate_stage "单元测试" 3
simulate_stage "集成测试" 2

echo -e "\n${GREEN}🎉 所有阶段成功完成！${NC}"

# 演示2: 快速失败
echo -e "\n${YELLOW}📋 演示2: 快速失败机制${NC}"
echo "模拟依赖检查阶段失败的情况..."

echo "开始执行测试阶段..."
simulate_stage "依赖检查" 1

echo -n "  本地验证: 执行中..."
sleep 1
echo -e " ${RED}❌ 失败 - 构建错误${NC}"

echo -e "\n${PURPLE}🛑 触发快速失败机制！${NC}"
echo "  - 立即停止后续阶段执行"
echo "  - 生成失败分析报告"
echo "  - 发送告警通知"
echo "  - 清理临时资源"

# 演示3: 不同失败策略
echo -e "\n${BLUE}📋 演示3: 不同失败策略${NC}"

echo "失败策略类型:"
echo "  ${RED}立即失败${NC}: 依赖检查、构建验证、单元测试"
echo "    - 任何错误都立即停止整个流程"
echo "    - 适用于基础性问题"
echo ""
echo "  ${YELLOW}警告继续${NC}: 静态代码检查"
echo "    - 记录警告但继续执行"
echo "    - 适用于非关键质量问题"
echo ""
echo "  ${PURPLE}可重试${NC}: 网络相关测试"
echo "    - 自动重试指定次数"
echo "    - 适用于临时性问题"

# 演示4: 实际快速失败
echo -e "\n${RED}📋 演示4: 实际快速失败${NC}"
echo "运行真实的快速失败测试..."

# 创建一个会失败的测试
cat > /tmp/failing-test.sh << 'EOF'
#!/bin/bash
echo "模拟测试开始..."
echo "检查依赖..."
echo "发现缺失依赖: nonexistent-command"
exit 1
EOF

chmod +x /tmp/failing-test.sh

echo "执行测试命令..."
if /tmp/failing-test.sh 2>/dev/null; then
    echo -e " ${GREEN}✅ 测试通过${NC}"
else
    echo -e " ${RED}❌ 测试失败，触发快速失败${NC}"
    echo "  - 记录失败原因"
    echo "  - 停止管道执行"
    echo "  - 生成错误报告"
fi

# 演示5: 配置选项
echo -e "\n${CYAN}📋 演示5: 配置选项${NC}"

echo "快速失败配置选项:"
echo "  FAILURE_STRICT_MODE=true    # 启用严格模式"
echo "  FAILURE_DISABLED=true       # 禁用快速失败"
echo "  MAX_RETRY_ATTEMPTS=3        # 最大重试次数"
echo "  STAGE_TIMEOUT=600          # 阶段超时时间"

echo -e "\n示例配置使用:"
echo "  FAILURE_STRICT_MODE=true ./scripts/industrial-test-runner.sh"
echo "  MAX_RETRY_ATTEMPTS=5 pnpm run industrial-test"

# 演示6: 错误分类
echo -e "\n${PURPLE}📋 演示6: 错误分类系统${NC}"

echo "错误严重程度:"
echo "  ${RED}Critical${NC}: 立即停止 + 告警通知"
echo "    - 缺少必需命令"
echo "    - 版本不兼容"
echo "    - 构建完全失败"
echo ""
echo "  ${YELLOW}High${NC}: 立即停止 + 详细日志"
echo "    - 测试失败"
echo "    - 覆盖率不足"
echo "    - 安全漏洞"
echo ""
echo "  ${BLUE}Medium${NC}: 警告 + 继续执行"
echo "  ${CYAN}Low${NC}: 只记录日志"
echo "    - ESLint警告"
echo "    - 代码风格问题"
echo ""

# 演示7: 恢复和重试
echo -e "\n${GREEN}📋 演示7: 恢复机制${NC}"

echo "失败后的恢复选项:"
echo "  1. 自动重试 (适用于临时失败)"
echo "  2. 手动修复后重新运行"
echo "  3. 降级策略 (允许某些失败继续)"
echo "  4. 紧急部署 (在严格控制下)"

echo -e "\n重试示例:"
echo "  ./scripts/industrial-test-runner.sh unit  # 只重试单元测试阶段"

# 总结
echo -e "\n${BLUE}🎯 快速失败机制总结${NC}"
echo "=================================="
echo "✅ 优势:"
echo "  - 快速发现问题，减少反馈延迟"
echo "  - 避免资源浪费，提高执行效率"
echo "  - 提供清晰的错误分类和修复指导"
echo "  - 支持灵活的失败策略配置"
echo ""
echo "✅ 适用场景:"
echo "  - CI/CD流水线"
echo "  - 自动化测试套件"
echo "  - 部署前验证"
echo "  - 代码质量检查"
echo ""
echo "✅ 最佳实践:"
echo "  - 为不同阶段设置合适的失败策略"
echo "  - 提供详细的错误信息和修复建议"
echo "  - 建立完善的监控和告警系统"
echo "  - 定期review和优化失败策略"

echo -e "\n${GREEN}🚀 演示完成！查看 docs/fast-failure-mechanism.md 了解详细信息${NC}"

# 清理
rm -f /tmp/failing-test.sh
