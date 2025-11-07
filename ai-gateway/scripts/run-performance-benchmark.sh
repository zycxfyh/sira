#!/bin/bash

# Sira AI网关 - 性能基准测试脚本
# 运行AI模型性能基准测试，包括响应时间、成本对比和质量评估

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ADMIN_PORT=${ADMIN_PORT:-9876}
ADMIN_HOST=${ADMIN_HOST:-localhost}

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_header() {
    echo -e "${PURPLE}================================================${NC}"
    echo -e "${PURPLE} $1 ${NC}"
    echo -e "${PURPLE}================================================${NC}"
}

# 检查依赖
check_dependencies() {
    local missing_deps=()

    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi

    if ! command -v bc &> /dev/null; then
        missing_deps+=("bc")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "缺少必要的依赖: ${missing_deps[*]}"
        log_info "请安装缺失的依赖:"
        echo "  Ubuntu/Debian: sudo apt-get install ${missing_deps[*]}"
        echo "  CentOS/RHEL: sudo yum install ${missing_deps[*]}"
        echo "  macOS: brew install ${missing_deps[*]}"
        exit 1
    fi
}

# 检查服务是否运行
check_service() {
    log_info "检查网关服务状态..."

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/benchmark/test-cases" > /dev/null; then
        log_error "网关服务未运行或不可访问 (http://$ADMIN_HOST:$ADMIN_PORT)"
        log_info "请确保网关服务正在运行: npm run start:dev"
        exit 1
    fi

    log_success "网关服务运行正常"
}

# 发送API请求
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    local url="http://$ADMIN_HOST:$ADMIN_PORT/$endpoint"

    if [ "$method" = "GET" ]; then
        curl -s -X GET "$url"
    elif [ "$method" = "POST" ]; then
        curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# 显示可用模型
show_available_models() {
    log_header "🤖 可用AI模型"

    echo "基于Sira配置的AI供应商，以下是常用的测试模型:"
    echo ""
    echo "🇺🇸 国际模型:"
    echo "  • gpt-4              - OpenAI GPT-4"
    echo "  • gpt-3.5-turbo      - OpenAI GPT-3.5 Turbo"
    echo "  • claude-3-opus      - Anthropic Claude 3 Opus"
    echo "  • claude-3-sonnet    - Anthropic Claude 3 Sonnet"
    echo "  • gemini-pro         - Google Gemini Pro"
    echo "  • deepseek-chat      - DeepSeek Chat"
    echo ""
    echo "🇨🇳 国内模型:"
    echo "  • qwen-max          - 通义千问Max"
    echo "  • qwen-plus         - 通义千问Plus"
    echo "  • ernie-bot         - 文心一言"
    echo "  • glm-4             - 智谱GLM-4"
    echo "  • kimi-chat         - Kimi Chat"
    echo ""
}

# 显示测试用例
show_test_cases() {
    log_header "📋 可用测试用例"

    local response
    response=$(api_request "GET" "benchmark/test-cases")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取测试用例失败"
        return 1
    fi

    local test_cases
    test_cases=$(echo "$response" | jq -r '.data.test_cases[] | "\(.id): \(.name) - \(.description)"')

    echo "简单任务:"
    echo "$test_cases" | grep -E "(simple_qa|sentiment_analysis|math_calculation)" | sed 's/^/  • /'
    echo ""

    echo "创意任务:"
    echo "$test_cases" | grep -E "(creative_writing|brainstorming|random_story)" | sed 's/^/  • /'
    echo ""

    echo "编程任务:"
    echo "$test_cases" | grep -E "(code_generation|expert_knowledge)" | sed 's/^/  • /'
    echo ""

    echo "分析任务:"
    echo "$test_cases" | grep -E "(text_summarization|logical_reasoning)" | sed 's/^/  • /'
    echo ""

    local total
    total=$(echo "$response" | jq -r '.data.total')
    echo ""
    echo "总计: $total 个测试用例"
}

# 显示测试套件
show_test_suites() {
    log_header "📦 测试套件"

    local response
    response=$(api_request "GET" "benchmark/suites")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取测试套件失败"
        return 1
    fi

    echo "$response" | jq -r '.data.suites | to_entries[] | "🎯 \(.key): \(.value.name)\n   📝 \(.value.description)\n   📊 任务: \(.value.tasks | join(", ")) (\(.value.iterations)次迭代)\n"'
}

# 运行快速测试
run_quick_test() {
    log_header "⚡ 快速性能测试"

    echo -n "输入要测试的模型 (用逗号分隔): "
    read -r models_input

    if [ -z "$models_input" ]; then
        log_error "模型列表不能为空"
        return 1
    fi

    # 解析模型列表
    IFS=',' read -ra MODELS <<< "$models_input"
    # 去除空格
    for i in "${!MODELS[@]}"; do
        MODELS[$i]=$(echo "${MODELS[$i]}" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    done

    echo -n "选择测试任务 (默认: simple_qa,math_calculation) [回车使用默认]: "
    read -r tasks_input

    local tasks="simple_qa,math_calculation"
    if [ -n "$tasks_input" ]; then
        tasks="$tasks_input"
    fi

    # 构建请求数据
    local models_json
    models_json=$(printf '%s\n' "${MODELS[@]}" | jq -R . | jq -s .)

    local request_data="{
        \"models\": $models_json,
        \"tasks\": [\"$(echo "$tasks" | sed 's/,/","/g')\",
        \"iterations\": 3,
        \"concurrency\": 2
    }"

    log_info "开始快速测试..."
    log_info "模型: ${MODELS[*]}"
    log_info "任务: $tasks"
    log_info "迭代次数: 3"

    local response
    response=$(api_request "POST" "benchmark/quick-test" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "快速测试失败"
        return 1
    fi

    local test_id
    test_id=$(echo "$response" | jq -r '.data.testId')

    log_success "✅ 快速测试完成!"
    echo "测试ID: $test_id"
    echo ""

    # 显示结果摘要
    local summary
    summary=$(echo "$response" | jq -r '.data.summary')

    echo "📊 测试结果摘要:"
    echo "$summary" | jq -r '.performance_analysis // empty'
    echo "$summary" | jq -r '.cost_analysis // empty'
    echo "$summary" | jq -r '.quality_analysis // empty'

    if echo "$summary" | jq -e '.recommendations' >/dev/null 2>&1; then
        echo ""
        echo "💡 建议:"
        echo "$summary" | jq -r '.recommendations.suggestions[]'
    fi
}

# 运行自定义测试
run_custom_test() {
    log_header "🔧 自定义性能测试"

    echo -n "输入要测试的模型 (用逗号分隔): "
    read -r models_input

    if [ -z "$models_input" ]; then
        log_error "模型列表不能为空"
        return 1
    fi

    # 解析模型列表
    IFS=',' read -ra MODELS <<< "$models_input"
    for i in "${!MODELS[@]}"; do
        MODELS[$i]=$(echo "${MODELS[$i]}" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    done

    echo -n "输入测试任务 (用逗号分隔): "
    read -r tasks_input

    if [ -z "$tasks_input" ]; then
        log_error "任务列表不能为空"
        return 1
    fi

    # 解析任务列表
    IFS=',' read -ra TASKS <<< "$tasks_input"
    for i in "${!TASKS[@]}"; do
        TASKS[$i]=$(echo "${TASKS[$i]}" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    done

    echo -n "迭代次数 (默认5): "
    read -r iterations
    iterations=${iterations:-5}

    echo -n "并发数 (默认3): "
    read -r concurrency
    concurrency=${concurrency:-3}

    echo -n "超时时间(毫秒，默认30000): "
    read -r timeout
    timeout=${timeout:-30000}

    echo -n "测试名称 (可选): "
    read -r test_name
    test_name=${test_name:-"自定义性能测试"}

    # 构建请求数据
    local models_json
    local tasks_json
    models_json=$(printf '%s\n' "${MODELS[@]}" | jq -R . | jq -s .)
    tasks_json=$(printf '%s\n' "${TASKS[@]}" | jq -R . | jq -s .)

    local request_data="{
        \"name\": \"$test_name\",
        \"models\": $models_json,
        \"tasks\": $tasks_json,
        \"iterations\": $iterations,
        \"concurrency\": $concurrency,
        \"timeout\": $timeout,
        \"includeQualityAssessment\": true,
        \"generateReport\": true
    }"

    log_info "开始自定义测试..."
    log_info "名称: $test_name"
    log_info "模型: ${MODELS[*]}"
    log_info "任务: ${TASKS[*]}"
    log_info "迭代次数: $iterations"
    log_info "并发数: $concurrency"

    local response
    response=$(api_request "POST" "benchmark/run" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "启动自定义测试失败"
        return 1
    fi

    log_success "✅ 测试已启动，请等待完成..."
    echo "测试可能需要几分钟时间，期间请不要关闭终端。"
    echo ""

    # 轮询检查测试状态
    local test_started=false
    local max_attempts=60  # 最多等待5分钟
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        sleep 5
        attempt=$((attempt + 1))

        # 检查最新结果
        local status_response
        status_response=$(api_request "GET" "benchmark/status")

        if echo "$status_response" | jq -e '.success' >/dev/null 2>&1; then
            local active_tests
            active_tests=$(echo "$status_response" | jq -r '.data.active_tests')

            if [ "$active_tests" -eq 0 ] && [ "$test_started" = true ]; then
                log_success "🎉 测试完成!"
                break
            elif [ "$active_tests" -gt 0 ]; then
                test_started=true
                echo -n "."
            fi
        fi
    done

    if [ $attempt -ge $max_attempts ]; then
        log_warn "测试可能仍在运行，请稍后检查结果"
    fi

    echo ""
    log_info "获取最新测试结果..."
    get_latest_results
}

# 运行测试套件
run_test_suite() {
    log_header "📦 运行测试套件"

    echo -n "输入测试套件ID (quick_test/comprehensive_test/performance_test/quality_test/creative_test/coding_test): "
    read -r suite_id

    if [ -z "$suite_id" ]; then
        log_error "测试套件ID不能为空"
        return 1
    fi

    # 检查套件是否存在
    local suite_response
    suite_response=$(api_request "GET" "benchmark/suites/$suite_id")

    if ! echo "$suite_response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "测试套件不存在: $suite_id"
        return 1
    fi

    echo -n "输入要测试的模型 (用逗号分隔): "
    read -r models_input

    if [ -z "$models_input" ]; then
        log_error "模型列表不能为空"
        return 1
    fi

    # 解析模型列表
    IFS=',' read -ra MODELS <<< "$models_input"
    for i in "${!MODELS[@]}"; do
        MODELS[$i]=$(echo "${MODELS[$i]}" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    done

    # 构建请求数据
    local models_json
    models_json=$(printf '%s\n' "${MODELS[@]}" | jq -R . | jq -s .)

    local request_data="{
        \"models\": $models_json
    }"

    log_info "运行测试套件: $suite_id"
    log_info "模型: ${MODELS[*]}"

    local response
    response=$(api_request "POST" "benchmark/suite/$suite_id/run" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "运行测试套件失败"
        return 1
    fi

    local test_id
    test_id=$(echo "$response" | jq -r '.data.testId')

    log_success "✅ 测试套件运行完成!"
    echo "测试ID: $test_id"
    echo ""

    # 显示结果摘要
    local summary
    summary=$(echo "$response" | jq -r '.data.summary')

    echo "📊 测试结果摘要:"
    show_analysis_results "$summary"
}

# 获取最新结果
get_latest_results() {
    log_header "📊 最新测试结果"

    local response
    response=$(api_request "GET" "benchmark/results?limit=1")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取测试结果失败"
        return 1
    fi

    local results
    results=$(echo "$response" | jq -r '.data.results[0]')

    if [ "$results" = "null" ] || [ -z "$results" ]; then
        log_warn "暂无测试结果"
        return 0
    fi

    local test_id
    test_id=$(echo "$results" | jq -r '.testId')

    echo "测试ID: $test_id"
    echo "测试名称: $(echo "$results" | jq -r '.config.name')"
    echo "开始时间: $(echo "$results" | jq -r '.metadata.startTime')"
    echo "持续时间: $(echo "$results" | jq -r '.metadata.duration / 1000 | floor')秒"
    echo ""

    # 显示摘要
    local summary
    summary=$(echo "$results" | jq -r '.summary')

    if [ "$summary" != "null" ]; then
        show_analysis_results "$summary"
    fi
}

# 显示分析结果
show_analysis_results() {
    local summary="$1"

    echo "📈 性能分析:"
    echo "$summary" | jq -r '.performance_analysis // empty' 2>/dev/null || echo "  暂无性能数据"

    echo ""
    echo "💰 成本分析:"
    echo "$summary" | jq -r '.cost_analysis // empty' 2>/dev/null || echo "  暂无成本数据"

    echo ""
    echo "🎯 质量分析:"
    echo "$summary" | jq -r '.quality_analysis // empty' 2>/dev/null || echo "  暂无质量数据"

    echo ""
    echo "🏆 推荐:"
    if echo "$summary" | jq -e '.recommendations' >/dev/null 2>&1; then
        echo "$summary" | jq -r '.recommendations.suggestions[]' | sed 's/^/  • /'
    else
        echo "  暂无推荐"
    fi
}

# 比较模型
compare_models() {
    log_header "⚖️ 模型性能比较"

    echo -n "输入要比较的模型 (用逗号分隔，至少2个): "
    read -r models_input

    if [ -z "$models_input" ]; then
        log_error "模型列表不能为空"
        return 1
    fi

    # 解析模型列表
    IFS=',' read -ra MODELS <<< "$models_input"
    for i in "${!MODELS[@]}"; do
        MODELS[$i]=$(echo "${MODELS[$i]}" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    done

    if [ ${#MODELS[@]} -lt 2 ]; then
        log_error "至少需要2个模型进行比较"
        return 1
    fi

    echo -n "比较指标 (response_time/cost/quality，默认: response_time): "
    read -r metric
    metric=${metric:-response_time}

    # 构建请求数据
    local models_json
    models_json=$(printf '%s\n' "${MODELS[@]}" | jq -R . | jq -s .)

    local request_data="{
        \"models\": $models_json,
        \"metric\": \"$metric\"
    }"

    local response
    response=$(api_request "POST" "benchmark/compare" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "模型比较失败"
        return 1
    fi

    local comparison
    comparison=$(echo "$response" | jq -r '.data.comparison')

    log_success "✅ 模型比较完成!"

    echo ""
    echo "📊 比较指标: $metric"
    echo "📋 排名:"

    local rankings
    rankings=$(echo "$comparison" | jq -r '.rankings[] | "\(.model): \(.value)"')

    local rank=1
    echo "$rankings" | while read -r line; do
        echo "  $rank. $line"
        rank=$((rank + 1))
    done

    echo ""
    echo "📈 差异分析:"
    echo "$comparison" | jq -r '.differences // empty' 2>/dev/null || echo "  暂无差异数据"
}

# 生成报告
generate_report() {
    log_header "📄 生成测试报告"

    echo -n "输入测试ID (可选，留空使用最新结果): "
    read -r test_id

    echo -n "报告格式 (json/csv，默认: json): "
    read -r format
    format=${format:-json}

    local url="benchmark/export?format=$format"
    if [ -n "$test_id" ]; then
        url="$url&testId=$test_id"
    fi

    local response
    response=$(api_request "GET" "$url")

    if [ -z "$response" ]; then
        log_error "生成报告失败"
        return 1
    fi

    local filename="benchmark_report_$(date +%Y%m%d_%H%M%S).$format"
    echo "$response" > "$filename"

    log_success "✅ 报告已生成: $filename"

    if [ "$format" = "json" ]; then
        echo "📊 报告摘要:"
        echo "$response" | jq -r '.[] | "测试ID: \(.testId), 模型数: \(.config.models | length), 任务数: \(.config.tasks | length)"' 2>/dev/null || echo "  JSON格式报告已保存"
    fi
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 性能基准测试脚本

用法:
    ./run-performance-benchmark.sh [选项]

选项:
    -m, --models      显示可用模型
    -c, --cases       显示测试用例
    -s, --suites      显示测试套件
    -q, --quick       运行快速测试
    -u, --custom      运行自定义测试
    -t, --suite       运行测试套件
    -r, --results     查看最新结果
    -p, --compare     比较模型性能
    -g, --report      生成测试报告
    -h, --help        显示此帮助信息

快速开始:
    # 快速测试两个模型
    ./run-performance-benchmark.sh --quick

    # 查看所有可用选项
    ./run-performance-benchmark.sh --help

示例:
    # 显示可用模型
    ./run-performance-benchmark.sh --models

    # 显示测试用例
    ./run-performance-benchmark.sh --cases

    # 运行快速测试
    ./run-performance-benchmark.sh --quick

    # 运行自定义测试
    ./run-performance-benchmark.sh --custom

    # 运行测试套件
    ./run-performance-benchmark.sh --suite

    # 查看最新结果
    ./run-performance-benchmark.sh --results

    # 比较模型性能
    ./run-performance-benchmark.sh --compare

    # 生成报告
    ./run-performance-benchmark.sh --report

环境变量:
    ADMIN_HOST       管理API主机 (默认: localhost)
    ADMIN_PORT       管理API端口 (默认: 9876)

测试套件:
    quick_test       - 5分钟快速评估
    comprehensive_test - 全面能力评估
    performance_test - 重点评估响应速度
    quality_test     - 重点评估输出质量
    creative_test    - 评估创造力
    coding_test      - 评估编程能力

EOF
}

# 主函数
main() {
    log_header "📊 Sira AI网关 - 性能基准测试工具"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 参数处理
    case "${1:-}" in
        -m|--models)
            show_available_models
            ;;
        -c|--cases)
            show_test_cases
            ;;
        -s|--suites)
            show_test_suites
            ;;
        -q|--quick)
            run_quick_test
            ;;
        -u|--custom)
            run_custom_test
            ;;
        -t|--suite)
            run_test_suite
            ;;
        -r|--results)
            get_latest_results
            ;;
        -p|--compare)
            compare_models
            ;;
        -g|--report)
            generate_report
            ;;
        -h|--help|*)
            show_help
            ;;
    esac

    log_success "🎉 性能基准测试任务完成"
}

# 执行主函数
main "$@"
