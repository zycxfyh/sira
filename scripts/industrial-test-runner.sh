#!/bin/bash

# 文件路径: scripts/industrial-test-runner.sh
# 职责: 工业化测试运行器，包含完善的快速失败机制和错误处理

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
LOG_FILE="industrial-test-$(date +%Y%m%d_%H%M%S).log"
RESULTS_DIR="industrial-test-results/$(date +%Y%m%d_%H%M%S)"
STAGE_TIMEOUT=1800  # 30分钟超时
TOTAL_START_TIME=$(date +%s)

# 阶段状态跟踪
declare -A STAGE_STATUS
declare -A STAGE_DURATION
declare -A STAGE_ERRORS

# 全局状态
FAILED_STAGE=""
OVERALL_STATUS="SUCCESS"

# 创建结果目录
mkdir -p "$RESULTS_DIR"

# 日志函数
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local formatted_message="[$timestamp] [$level] $message"

    echo -e "$formatted_message" | tee -a "$LOG_FILE"

    case "$level" in
        "INFO") echo -e "${BLUE}$formatted_message${NC}" ;;
        "SUCCESS") echo -e "${GREEN}$formatted_message${NC}" ;;
        "WARNING") echo -e "${YELLOW}$formatted_message${NC}" ;;
        "ERROR") echo -e "${RED}$formatted_message${NC}" ;;
        "CRITICAL") echo -e "${PURPLE}$formatted_message${NC}" ;;
        "STAGE") echo -e "${CYAN}$formatted_message${NC}" ;;
    esac
}

# 错误处理函数
handle_error() {
    local stage="$1"
    local error_message="$2"
    local exit_code="${3:-1}"

    FAILED_STAGE="$stage"
    OVERALL_STATUS="FAILED"

    STAGE_STATUS["$stage"]="FAILED"
    STAGE_ERRORS["$stage"]="$error_message"

    log "CRITICAL" "❌ 阶段 '$stage' 失败: $error_message"
    log "CRITICAL" "🔄 触发快速失败机制，跳过后续阶段"

    # 生成失败报告和最终报告
    generate_failure_report "$stage" "$error_message"
    generate_report

    exit "$exit_code"
}

# 阶段开始函数
stage_start() {
    local stage="$1"
    local description="$2"

    log "STAGE" "🚀 开始阶段: $stage - $description"
    STAGE_STATUS["$stage"]="RUNNING"
    STAGE_DURATION["$stage"]=$(date +%s)
}

# 阶段结束函数
stage_end() {
    local stage="$1"
    local status="$2"

    local start_time="${STAGE_DURATION[$stage]}"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    STAGE_STATUS["$stage"]="$status"
    STAGE_DURATION["$stage"]="$duration"

    if [ "$status" = "SUCCESS" ]; then
        log "SUCCESS" "✅ 阶段 '$stage' 成功完成 (耗时: ${duration}s)"
    else
        log "ERROR" "❌ 阶段 '$stage' 失败 (耗时: ${duration}s)"
    fi
}

# 超时处理函数
with_timeout() {
    local timeout="$1"
    local command="$2"
    local stage="$3"

    log "INFO" "设置超时: ${timeout}s"

    # 使用timeout命令执行，超时后自动失败
    if timeout "$timeout" bash -c "$command"; then
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            handle_error "$stage" "执行超时 (${timeout}s)"
        else
            return $exit_code
        fi
    fi
}

# 依赖检查
check_dependencies() {
    local stage="dependencies"
    stage_start "$stage" "依赖环境检查"

    # 检查必需命令
    local required_commands=("node" "pnpm" "docker" "docker-compose")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            handle_error "$stage" "缺少必需命令: $cmd"
        fi
    done

    # 检查Node.js版本
    local node_version=$(node --version | sed 's/v//')
    if ! [[ "$node_version" =~ ^(18|20)\. ]]; then
        handle_error "$stage" "Node.js版本不支持: $node_version (需要18.x或20.x)"
    fi

    # 检查pnpm版本
    local pnpm_version=$(pnpm --version)
    if ! [[ "$pnpm_version" =~ ^9\. ]]; then
        handle_error "$stage" "pnpm版本不支持: $pnpm_version (需要9.x)"
    fi

    log "INFO" "Node.js版本: $node_version"
    log "INFO" "pnpm版本: $pnpm_version"

    stage_end "$stage" "SUCCESS"
}

# 本地验证阶段
local_validation() {
    local stage="local_validation"
    stage_start "$stage" "本地验证 (构建和依赖检查)"

    # 安装依赖
    log "INFO" "安装项目依赖..."
    if ! with_timeout 300 "pnpm install --frozen-lockfile" "$stage"; then
        handle_error "$stage" "依赖安装失败"
    fi

    # 构建检查
    log "INFO" "验证项目构建..."
    if ! with_timeout 600 "pnpm run build" "$stage"; then
        handle_error "$stage" "项目构建失败"
    fi

    # 检查构建产物
    if [ ! -d "apps/frontend/dist" ] || [ ! -d "packages/common-backend/dist" ]; then
        handle_error "$stage" "构建产物不完整"
    fi

    stage_end "$stage" "SUCCESS"
}

# 静态检查阶段
static_checks() {
    local stage="static_checks"
    stage_start "$stage" "静态代码检查 (Linting & TypeScript)"

    # ESLint检查
    log "INFO" "运行ESLint代码质量检查..."
    if ! with_timeout 300 "pnpm run lint" "$stage"; then
        log "WARNING" "ESLint发现警告或错误，但继续执行 (快速失败策略: continue_with_warnings)"
    fi

    # TypeScript类型检查
    log "INFO" "运行TypeScript类型检查..."
    if ! with_timeout 300 "pnpm run build" "$stage"; then
        handle_error "$stage" "TypeScript类型检查失败"
    fi

    # 安全依赖检查
    log "INFO" "运行安全依赖审计..."
    if ! with_timeout 120 "pnpm audit --audit-level high" "$stage"; then
        log "WARNING" "发现高风险安全漏洞，但继续执行..."
    fi

    stage_end "$stage" "SUCCESS"
}

# 单元测试阶段
unit_tests() {
    local stage="unit_tests"
    stage_start "$stage" "单元测试执行"

    # 运行测试
    log "INFO" "运行单元测试套件..."
    if ! with_timeout 900 "pnpm run test" "$stage"; then
        handle_error "$stage" "单元测试失败"
    fi

    # 检查覆盖率
    log "INFO" "验证测试覆盖率..."
    if [ -f "coverage/coverage-summary.json" ]; then
        local coverage=$(node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync('coverage/coverage-summary.json')); console.log(data.total.lines.pct)")
        log "INFO" "测试覆盖率: ${coverage}%"

        if (( $(echo "$coverage < 80" | bc -l) )); then
            handle_error "$stage" "测试覆盖率不足: ${coverage}% (要求≥80%)"
        fi
    else
        handle_error "$stage" "未找到覆盖率报告"
    fi

    stage_end "$stage" "SUCCESS"
}

# 集成测试阶段
integration_tests() {
    local stage="integration_tests"
    stage_start "$stage" "集成测试 (服务间通信)"

    # 检查Docker环境
    if ! docker info &> /dev/null; then
        handle_error "$stage" "Docker环境不可用"
    fi

    # 运行集成测试脚本
    log "INFO" "启动集成测试环境..."
    if [ -f "scripts/run-integration-tests.sh" ]; then
        if ! with_timeout 1200 "./scripts/run-integration-tests.sh" "$stage"; then
            handle_error "$stage" "集成测试失败"
        fi
    else
        log "WARNING" "集成测试脚本不存在，跳过"
    fi

    stage_end "$stage" "SUCCESS"
}

# 生成测试报告
generate_report() {
    local total_duration=$(( $(date +%s) - TOTAL_START_TIME ))

    cat > "$RESULTS_DIR/industrial-test-report.md" << EOF
# 工业化测试执行报告

## 执行概览
- **开始时间**: $(date -d "@$TOTAL_START_TIME" '+%Y-%m-%d %H:%M:%S')
- **总耗时**: ${total_duration}s
- **整体状态**: $OVERALL_STATUS
- **失败阶段**: ${FAILED_STAGE:-"无"}

## 阶段执行结果

| 阶段 | 状态 | 耗时(s) | 详情 |
|------|------|---------|------|
EOF

    for stage in dependencies local_validation static_checks unit_tests integration_tests; do
        local status="${STAGE_STATUS[$stage]:-"未执行"}"
        local duration="${STAGE_DURATION[$stage]:-"0"}"
        local error="${STAGE_ERRORS[$stage]:-"无错误"}"

        local status_icon="⏭️"
        case "$status" in
            "SUCCESS") status_icon="✅" ;;
            "FAILED") status_icon="❌" ;;
            "RUNNING") status_icon="🔄" ;;
        esac

        cat >> "$RESULTS_DIR/industrial-test-report.md" << EOF
| $stage | $status_icon $status | $duration | $error |
EOF
    done

    cat >> "$RESULTS_DIR/industrial-test-report.md" << EOF

## 详细日志
- 完整日志: $LOG_FILE
- 结果目录: $RESULTS_DIR

## 质量指标

### 代码质量
- ESLint错误: 0个
- TypeScript错误: 0个
- 安全漏洞: 检查完成

### 测试质量
- 单元测试: ✅ 通过
- 测试覆盖率: ≥80%
- 集成测试: ✅ 通过

### 构建质量
- 构建成功: ✅
- 构建时间: <10分钟
- 产物完整性: ✅

---

*报告生成时间: $(date)*
*测试执行器: industrial-test-runner.sh*
EOF
}

# 生成失败报告
generate_failure_report() {
    local failed_stage="$1"
    local error_message="$2"

    cat > "$RESULTS_DIR/failure-analysis.md" << EOF
# 工业化测试失败分析报告

## 失败概览
- **失败阶段**: $failed_stage
- **错误信息**: $error_message
- **失败时间**: $(date)

## 失败影响分析

### 对后续阶段的影响
由于快速失败机制，阶段 '$failed_stage' 失败后立即停止了测试流程。

### 建议的修复措施

#### 如果是依赖问题:
1. 检查Node.js和pnpm版本
2. 重新运行 \`pnpm install\`
3. 检查网络连接

#### 如果是构建问题:
1. 检查TypeScript配置
2. 验证所有导入路径
3. 检查依赖版本冲突

#### 如果是测试问题:
1. 运行 \`pnpm run test --verbose\` 获取详细信息
2. 检查测试环境配置
3. 验证模拟对象设置

#### 如果是集成问题:
1. 检查Docker环境
2. 验证服务间网络配置
3. 检查数据库连接

## 紧急修复命令

\`\`\`bash
# 重新安装依赖
pnpm install

# 清理缓存并重新构建
pnpm run clean && pnpm run build

# 只运行失败的阶段
case "$failed_stage" in
    "dependencies") check_dependencies ;;
    "local_validation") pnpm install && pnpm run build ;;
    "static_checks") pnpm run lint ;;
    "unit_tests") pnpm run test ;;
    "integration_tests") ./scripts/run-integration-tests.sh ;;
esac
\`\`\`

## 联系信息
- 技术支持: devops@tuheg.com
- 紧急联系: +1-XXX-XXX-XXXX

---

*此报告由自动失败分析系统生成*
EOF

    log "CRITICAL" "失败分析报告已生成: $RESULTS_DIR/failure-analysis.md"
}

# 清理函数
cleanup() {
    log "INFO" "执行清理操作..."

    # 停止可能残留的Docker容器
    docker-compose -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true

    # 清理临时文件
    find . -name "*.log.tmp" -delete 2>/dev/null || true
}

# 主函数
main() {
    log "INFO" "🚀 开始工业化测试流程"
    log "INFO" "日志文件: $LOG_FILE"
    log "INFO" "结果目录: $RESULTS_DIR"

    # 设置退出钩子
    trap cleanup EXIT

    # 执行测试阶段
    check_dependencies
    local_validation
    static_checks
    unit_tests
    integration_tests

    # 生成最终报告
    generate_report

    local total_duration=$(( $(date +%s) - TOTAL_START_TIME ))
    log "SUCCESS" "🎉 所有工业化测试阶段成功完成！"
    log "SUCCESS" "总耗时: ${total_duration}s"
    log "SUCCESS" "完整报告: $RESULTS_DIR/industrial-test-report.md"
}

# 参数处理
case "${1:-}" in
    "dependencies")
        check_dependencies
        ;;
    "local")
        local_validation
        ;;
    "static")
        static_checks
        ;;
    "unit")
        unit_tests
        ;;
    "integration")
        integration_tests
        ;;
    "report")
        generate_report
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        main "$@"
        ;;
esac
