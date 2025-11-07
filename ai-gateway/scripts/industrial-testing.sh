#!/bin/bash

# Sira AI网关 - 工业级测试脚本
# 集成到CI/CD流水线，提供全面的自动化测试能力

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_ROOT/reports"
BASELINES_DIR="$PROJECT_ROOT/baselines"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置变量
NODE_ENV="${NODE_ENV:-test}"
TEST_TYPE="${TEST_TYPE:-comprehensive}"
PARALLEL_JOBS="${PARALLEL_JOBS:-4}"
TEST_TIMEOUT="${TEST_TIMEOUT:-1800000}" # 30分钟
ENABLE_COVERAGE="${ENABLE_COVERAGE:-true}"
ENABLE_PERFORMANCE="${ENABLE_PERFORMANCE:-true}"
GENERATE_REPORTS="${GENERATE_REPORTS:-true}"

# 全局变量
TEST_RESULTS=()
PERFORMANCE_RESULTS=()
COVERAGE_RESULTS=()
START_TIME=$(date +%s)
EXIT_CODE=0

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}=== $1 ===${NC}"
}

# 错误处理
error_handler() {
    local line_no=$1
    local error_code=$2
    log_error "脚本执行失败 (行 $line_no, 错误码 $error_code)"
    cleanup
    exit $error_code
}

trap 'error_handler ${LINENO} $?' ERR

# 清理函数
cleanup() {
    log_info "清理测试环境..."

    # 停止所有后台进程
    pkill -f "node.*test" || true
    pkill -f "node.*mock" || true
    pkill -f "node.*server" || true

    # 清理临时文件
    rm -rf /tmp/sira-test-* || true

    # 生成最终报告
    if [ "$GENERATE_REPORTS" = "true" ]; then
        generate_final_report
    fi
}

# 检查依赖
check_dependencies() {
    log_header "检查依赖"

    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi

    # 检查npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi

    # 检查测试框架依赖
    if ! command -v npx &> /dev/null; then
        log_error "npx 未找到"
        exit 1
    fi

    # 检查必要的工具
    local tools=("curl" "jq" "bc")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_warning "$tool 未安装，某些功能可能受限"
        fi
    done

    log_success "依赖检查完成"
}

# 安装测试依赖
install_test_dependencies() {
    log_header "安装测试依赖"

    cd "$PROJECT_ROOT"

    # 安装npm依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装项目依赖..."
        npm ci
    fi

    # 安装测试专用依赖
    npm install --no-save \
        puppeteer \
        artillery \
        lighthouse \
        clinics \
        autocannon \
        0x \
        clinic

    log_success "测试依赖安装完成"
}

# 设置测试环境
setup_test_environment() {
    log_header "设置测试环境"

    export NODE_ENV="$NODE_ENV"
    export TEST_TYPE="$TEST_TYPE"
    export CI=true
    export TEST_TIMEOUT="$TEST_TIMEOUT"

    # 创建必要的目录
    mkdir -p "$REPORTS_DIR"
    mkdir -p "$BASELINES_DIR"
    mkdir -p "$REPORTS_DIR/coverage"
    mkdir -p "$REPORTS_DIR/performance"
    mkdir -p "$REPORTS_DIR/security"
    mkdir -p "$REPORTS_DIR/e2e"

    # 设置Node.js选项以提高测试稳定性
    export NODE_OPTIONS="--max-old-space-size=4096 --enable-source-maps"

    # 如果是CI环境，禁用某些耗时操作
    if [ -n "$CI" ]; then
        export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
        export DISABLE_OPENCOLLECTIVE=true
    fi

    log_success "测试环境设置完成"
}

# 运行单元测试
run_unit_tests() {
    log_header "运行单元测试"

    local test_cmd="npm test"

    if [ "$ENABLE_COVERAGE" = "true" ]; then
        test_cmd="npm run test:coverage"
    fi

    if [ "$PARALLEL_JOBS" -gt 1 ]; then
        export NODE_OPTIONS="$NODE_OPTIONS --experimental-worker"
        test_cmd="$test_cmd -- --maxWorkers=$PARALLEL_JOBS"
    fi

    log_info "执行命令: $test_cmd"

    if eval "$test_cmd"; then
        log_success "单元测试通过"
        TEST_RESULTS+=("unit:passed")
    else
        log_error "单元测试失败"
        TEST_RESULTS+=("unit:failed")
        EXIT_CODE=1
    fi
}

# 运行集成测试
run_integration_tests() {
    log_header "运行集成测试"

    # 启动测试服务
    start_test_services

    # 等待服务就绪
    wait_for_services

    # 运行集成测试
    if npm run test:integration; then
        log_success "集成测试通过"
        TEST_RESULTS+=("integration:passed")
    else
        log_error "集成测试失败"
        TEST_RESULTS+=("integration:failed")
        EXIT_CODE=1
    fi

    # 停止测试服务
    stop_test_services
}

# 运行端到端测试
run_e2e_tests() {
    log_header "运行端到端测试"

    # 启动完整应用栈
    start_full_application

    # 等待应用就绪
    wait_for_application

    # 运行E2E测试
    if npm run test:e2e; then
        log_success "端到端测试通过"
        TEST_RESULTS+=("e2e:passed")
    else
        log_error "端到端测试失败"
        TEST_RESULTS+=("e2e:failed")
        EXIT_CODE=1
    fi

    # 停止应用
    stop_full_application
}

# 运行性能测试
run_performance_tests() {
    log_header "运行性能测试"

    if [ "$ENABLE_PERFORMANCE" != "true" ]; then
        log_info "性能测试已禁用，跳过"
        return 0
    fi

    # 运行基准测试
    log_info "运行基准性能测试..."
    if node scripts/run-performance-benchmark.js; then
        log_success "基准性能测试完成"
    else
        log_warning "基准性能测试失败"
    fi

    # 运行负载测试
    log_info "运行负载测试..."
    if node -e "
        const { LoadTestingTool } = require('./lib/load-testing');
        const loadTester = new LoadTestingTool();
        loadTester.initialize().then(() => {
            return loadTester.runLoadTest({
                scenario: 'ai_chat_performance',
                targetRPS: 50,
                duration: 60
            });
        }).then(result => {
            console.log('负载测试结果:', result.summary);
            process.exit(0);
        }).catch(error => {
            console.error('负载测试失败:', error);
            process.exit(1);
        });
    "; then
        log_success "负载测试完成"
        TEST_RESULTS+=("load:passed")
    else
        log_error "负载测试失败"
        TEST_RESULTS+=("load:failed")
        EXIT_CODE=1
    fi

    # 运行压力测试
    log_info "运行压力测试..."
    if node -e "
        const { StressTestingTool } = require('./lib/stress-testing');
        const stressTester = new StressTestingTool();
        stressTester.initialize().then(() => {
            return stressTester.runStressTest({
                scenario: 'memory_stress',
                intensity: 'medium',
                duration: 30
            });
        }).then(result => {
            console.log('压力测试结果:', result.summary);
            process.exit(0);
        }).catch(error => {
            console.error('压力测试失败:', error);
            process.exit(1);
        });
    "; then
        log_success "压力测试完成"
        TEST_RESULTS+=("stress:passed")
    else
        log_error "压力测试失败"
        TEST_RESULTS+=("stress:failed")
        EXIT_CODE=1
    fi
}

# 运行可靠性测试
run_reliability_tests() {
    log_header "运行可靠性测试"

    log_info "运行可靠性测试..."
    if node -e "
        const { ReliabilityTestingTool } = require('./lib/reliability-testing');
        const reliabilityTester = new ReliabilityTestingTool();
        reliabilityTester.initialize().then(() => {
            return reliabilityTester.runReliabilityTest({
                scenarios: ['basic_health'],
                duration: 300
            });
        }).then(result => {
            console.log('可靠性测试结果:', result.summary);
            process.exit(0);
        }).catch(error => {
            console.error('可靠性测试失败:', error);
            process.exit(1);
        });
    "; then
        log_success "可靠性测试完成"
        TEST_RESULTS+=("reliability:passed")
    else
        log_error "可靠性测试失败"
        TEST_RESULTS+=("reliability:failed")
        EXIT_CODE=1
    fi
}

# 运行安全测试
run_security_tests() {
    log_header "运行安全测试"

    # 运行依赖安全检查
    log_info "检查依赖安全漏洞..."
    if npm audit --audit-level=moderate; then
        log_success "依赖安全检查通过"
    else
        log_warning "发现依赖安全漏洞"
        # 不标记为失败，因为可能存在已知但未修复的漏洞
    fi

    # 运行代码安全扫描 (如果安装了相关工具)
    if command -v eslint &> /dev/null; then
        log_info "运行代码安全扫描..."
        if npx eslint . --ext .js --config .eslintrc.js --format=compact; then
            log_success "代码安全扫描通过"
        else
            log_warning "代码安全扫描发现问题"
        fi
    fi

    # 这里可以添加更多安全测试
    TEST_RESULTS+=("security:completed")
}

# 运行代码质量检查
run_quality_checks() {
    log_header "运行代码质量检查"

    # ESLint检查
    if command -v eslint &> /dev/null; then
        log_info "运行ESLint检查..."
        if npx eslint . --ext .js --max-warnings 0; then
            log_success "ESLint检查通过"
            TEST_RESULTS+=("eslint:passed")
        else
            log_error "ESLint检查失败"
            TEST_RESULTS+=("eslint:failed")
            EXIT_CODE=1
        fi
    fi

    # Prettier检查
    if command -v prettier &> /dev/null; then
        log_info "运行代码格式检查..."
        if npx prettier --check "**/*.{js,json,md}"; then
            log_success "代码格式检查通过"
            TEST_RESULTS+=("prettier:passed")
        else
            log_error "代码格式检查失败"
            TEST_RESULTS+=("prettier:failed")
            EXIT_CODE=1
        fi
    fi

    # 代码复杂度检查
    if command -v complexity-report &> /dev/null; then
        log_info "运行代码复杂度分析..."
        npx complexity-report --format json > "$REPORTS_DIR/complexity.json"
        log_success "代码复杂度分析完成"
    fi
}

# 启动测试服务
start_test_services() {
    log_info "启动测试服务..."

    # 启动Mock AI服务器
    node test/mock-ai-server.js > /dev/null 2>&1 &
    MOCK_PID=$!

    # 启动测试数据库 (如果需要)
    # 这里可以启动测试用的数据库实例

    log_success "测试服务已启动"
}

# 停止测试服务
stop_test_services() {
    log_info "停止测试服务..."

    if [ -n "$MOCK_PID" ]; then
        kill $MOCK_PID 2>/dev/null || true
    fi

    log_success "测试服务已停止"
}

# 启动完整应用栈
start_full_application() {
    log_info "启动完整应用栈..."

    # 启动网关服务
    npm start > /dev/null 2>&1 &
    GATEWAY_PID=$!

    # 等待服务启动
    sleep 10

    log_success "完整应用栈已启动"
}

# 停止完整应用栈
stop_full_application() {
    log_info "停止完整应用栈..."

    if [ -n "$GATEWAY_PID" ]; then
        kill $GATEWAY_PID 2>/dev/null || true
    fi

    log_success "完整应用栈已停止"
}

# 等待服务就绪
wait_for_services() {
    log_info "等待服务就绪..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            log_success "服务已就绪"
            return 0
        fi

        log_info "等待服务就绪... (尝试 $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    log_error "服务启动超时"
    return 1
}

# 等待应用就绪
wait_for_application() {
    log_info "等待应用就绪..."

    local max_attempts=60
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            log_success "应用已就绪"
            return 0
        fi

        log_info "等待应用就绪... (尝试 $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    log_error "应用启动超时"
    return 1
}

# 生成最终报告
generate_final_report() {
    log_header "生成最终测试报告"

    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))

    # 创建最终报告
    cat > "$REPORTS_DIR/final-report.json" << EOF
{
    "metadata": {
        "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "duration_seconds": $duration,
        "node_version": "$(node --version)",
        "npm_version": "$(npm --version)",
        "platform": "$(uname -s)",
        "exit_code": $EXIT_CODE
    },
    "results": {
        $(printf '%s\n' "${TEST_RESULTS[@]}" | jq -R . | jq -s 'map(split(":")) | map({(.[0]): .[1]}) | add' 2>/dev/null || echo "{}")
    },
    "summary": {
        "total_tests": $(echo "${TEST_RESULTS[@]}" | wc -w),
        "passed_tests": $(echo "${TEST_RESULTS[@]}" | grep -c "passed"),
        "failed_tests": $(echo "${TEST_RESULTS[@]}" | grep -c "failed"),
        "success_rate": $(echo "scale=2; ($(echo "${TEST_RESULTS[@]}" | grep -c "passed") * 100) / $(echo "${TEST_RESULTS[@]}" | wc -w)" | bc 2>/dev/null || echo "0")
    }
}
EOF

    # 生成HTML报告
    generate_html_final_report "$duration"

    log_success "最终报告已生成: $REPORTS_DIR/final-report.json"
}

# 生成HTML最终报告
generate_html_final_report() {
    local duration=$1

    cat > "$REPORTS_DIR/final-report.html" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Sira AI网关 - 工业级测试最终报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #333; border-bottom: 2px solid #007acc; padding-bottom: 20px; }
        .summary { display: flex; justify-content: space-around; margin: 30px 0; }
        .metric { text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007acc; }
        .metric-label { color: #666; }
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .status.success { background: #d4edda; color: #155724; }
        .status.failure { background: #f8d7da; color: #721c24; }
        .footer { text-align: center; margin-top: 40px; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Sira AI网关 - 工业级测试最终报告</h1>
            <p>测试持续时间: ${duration}秒 | 完成时间: $(date)</p>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value">${#TEST_RESULTS[@]}</div>
                <div class="metric-label">总测试数</div>
            </div>
            <div class="metric">
                <div class="metric-value">$(echo "${TEST_RESULTS[@]}" | grep -c "passed")</div>
                <div class="metric-label">通过测试</div>
            </div>
            <div class="metric">
                <div class="metric-value">$(echo "${TEST_RESULTS[@]}" | grep -c "failed")</div>
                <div class="metric-label">失败测试</div>
            </div>
            <div class="metric">
                <div class="metric-value">$(printf "%.1f" $(echo "scale=2; ($(echo "${TEST_RESULTS[@]}" | grep -c "passed") * 100) / ${#TEST_RESULTS[@]}" | bc 2>/dev/null || echo "0"))%</div>
                <div class="metric-label">成功率</div>
            </div>
        </div>

        <div class="status $([ $EXIT_CODE -eq 0 ] && echo "success" || echo "failure")">
            <h3>测试状态: $([ $EXIT_CODE -eq 0 ] && echo "✅ 通过" || echo "❌ 失败")</h3>
            <p>退出代码: $EXIT_CODE</p>
        </div>

        <div class="footer">
            <p>© 2024 Sira AI网关 - 工业级测试框架</p>
            <p>报告生成时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)</p>
        </div>
    </div>
</body>
</html>
EOF
}

# 显示帮助信息
show_help() {
    cat << EOF
Sira AI网关 - 工业级测试脚本

USAGE:
    $0 [OPTIONS] [TEST_TYPES...]

OPTIONS:
    -h, --help                  显示帮助信息
    -t, --test-type TYPE        测试类型 (comprehensive, unit, integration, e2e, performance, security)
    -j, --jobs NUM              并行作业数 (默认: 4)
    -c, --coverage              启用覆盖率测试
    -p, --performance           启用性能测试
    -r, --reports               生成详细报告
    --no-coverage               禁用覆盖率测试
    --no-performance            禁用性能测试
    --no-reports                不生成报告

TEST_TYPES:
    unit                        单元测试
    integration                 集成测试
    e2e                         端到端测试
    performance                 性能测试
    reliability                 可靠性测试
    security                    安全测试
    quality                     代码质量检查

ENVIRONMENT VARIABLES:
    NODE_ENV                    运行环境 (默认: test)
    TEST_TYPE                   测试类型 (默认: comprehensive)
    PARALLEL_JOBS               并行作业数
    TEST_TIMEOUT                测试超时时间(ms)
    ENABLE_COVERAGE             是否启用覆盖率
    ENABLE_PERFORMANCE          是否启用性能测试
    GENERATE_REPORTS            是否生成报告

EXAMPLES:
    $0                          运行所有测试
    $0 unit integration         只运行单元测试和集成测试
    $0 -j 8 -c -p               使用8个并行作业，启用覆盖率和性能测试
    $0 --test-type performance  只运行性能测试

EOF
}

# 主函数
main() {
    # 解析命令行参数
    local test_types=()
    local skip_tests=()

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help; exit 0 ;;
            -t|--test-type) TEST_TYPE="$2"; shift 2 ;;
            -j|--jobs) PARALLEL_JOBS="$2"; shift 2 ;;
            -c|--coverage) ENABLE_COVERAGE=true; shift ;;
            -p|--performance) ENABLE_PERFORMANCE=true; shift ;;
            -r|--reports) GENERATE_REPORTS=true; shift ;;
            --no-coverage) ENABLE_COVERAGE=false; shift ;;
            --no-performance) ENABLE_PERFORMANCE=false; shift ;;
            --no-reports) GENERATE_REPORTS=false; shift ;;
            unit|integration|e2e|performance|reliability|security|quality)
                test_types+=("$1")
                shift
                ;;
            *) log_error "未知参数: $1"; show_help; exit 1 ;;
        esac
    done

    # 如果没有指定测试类型，使用默认的全面测试
    if [ ${#test_types[@]} -eq 0 ]; then
        case $TEST_TYPE in
            comprehensive)
                test_types=(unit integration e2e performance reliability security quality)
                ;;
            unit) test_types=(unit) ;;
            integration) test_types=(integration) ;;
            e2e) test_types=(e2e) ;;
            performance) test_types=(performance) ;;
            security) test_types=(security) ;;
            quality) test_types=(quality) ;;
            *) test_types=(unit integration e2e) ;;
        esac
    fi

    log_header "开始工业级测试"
    log_info "测试类型: ${test_types[*]}"
    log_info "并行作业数: $PARALLEL_JOBS"
    log_info "覆盖率测试: $ENABLE_COVERAGE"
    log_info "性能测试: $ENABLE_PERFORMANCE"
    log_info "生成报告: $GENERATE_REPORTS"

    # 执行测试流程
    check_dependencies
    install_test_dependencies
    setup_test_environment

    # 根据指定的测试类型运行测试
    for test_type in "${test_types[@]}"; do
        case $test_type in
            unit) run_unit_tests ;;
            integration) run_integration_tests ;;
            e2e) run_e2e_tests ;;
            performance) run_performance_tests ;;
            reliability) run_reliability_tests ;;
            security) run_security_tests ;;
            quality) run_quality_checks ;;
        esac
    done

    # 生成最终报告
    generate_final_report

    # 输出测试结果摘要
    log_header "测试结果摘要"
    log_info "总测试数: ${#TEST_RESULTS[@]}"
    log_info "通过测试: $(echo "${TEST_RESULTS[@]}" | grep -c "passed\|completed")"
    log_info "失败测试: $(echo "${TEST_RESULTS[@]}" | grep -c "failed")"

    local success_rate=$(printf "%.1f" $(echo "scale=2; ($(echo "${TEST_RESULTS[@]}" | grep -c "passed\|completed") * 100) / ${#TEST_RESULTS[@]}" | bc 2>/dev/null || echo "0"))
    log_info "成功率: ${success_rate}%"

    if [ $EXIT_CODE -eq 0 ]; then
        log_success "🎉 所有测试通过！"
    else
        log_error "❌ 部分测试失败，请检查报告以获取详细信息"
    fi

    exit $EXIT_CODE
}

# 执行主函数
main "$@"
