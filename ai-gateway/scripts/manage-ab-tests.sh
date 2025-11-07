#!/bin/bash

# A/B测试管理脚本
# 借鉴现代CLI工具设计理念，提供直观的命令行界面

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/ab-tests.json"
RESULTS_FILE="$PROJECT_ROOT/data/ab-test-results.json"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

# 检查依赖
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed. Please install curl."
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. JSON output will be unformatted."
    fi
}

# 获取API基础URL
get_api_url() {
    if [ -n "$GATEWAY_URL" ]; then
        echo "$GATEWAY_URL"
    else
        echo "http://localhost:8080"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
A/B测试管理工具 - Sira AI Gateway

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    list                    列出所有测试
    create                  创建新测试
    show <test_id>          显示测试详情
    start <test_id>         启动测试
    pause <test_id>         暂停测试
    stop <test_id>          停止测试
    delete <test_id>        删除测试
    analyze <test_id>       分析测试结果
    results <test_id>       查看测试原始结果
    allocate <test_id>      为用户分配测试变体
    record <test_id>        记录测试结果
    batch-start             批量启动测试
    batch-stop              批量停止测试

OPTIONS:
    -h, --help              显示帮助信息
    -u, --url URL           指定网关URL (默认: http://localhost:8080)
    -v, --verbose           详细输出

EXAMPLES:
    $0 list
    $0 create
    $0 start ab_test_123
    $0 analyze ab_test_123
    $0 allocate ab_test_123 --user-id user123
    $0 record ab_test_123 --variant A --user-id user123 --metric response_time 1.2

EOF
}

# 发送HTTP请求的辅助函数
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    local url="$(get_api_url)$endpoint"
    local curl_opts=(-s -X "$method" -H "Content-Type: application/json")

    if [ -n "$data" ]; then
        curl_opts+=(-d "$data")
    fi

    if [ "$VERBOSE" = "true" ]; then
        log_info "API Request: $method $url"
        [ -n "$data" ] && log_info "Data: $data"
    fi

    local response
    if ! response=$(curl "${curl_opts[@]}" "$url" 2>/dev/null); then
        log_error "API请求失败: $method $url"
        return 1
    fi

    if [ "$VERBOSE" = "true" ]; then
        log_info "API Response: $response"
    fi

    echo "$response"
}

# 格式化JSON输出
format_json() {
    local json="$1"
    if command -v jq &> /dev/null; then
        echo "$json" | jq '.'
    else
        echo "$json"
    fi
}

# 列出所有测试
cmd_list() {
    log_header "A/B测试列表"

    local response
    if ! response=$(api_request "GET" "/ab-tests"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local tests=$(echo "$response" | jq -r '.data[]')

        if [ -z "$tests" ]; then
            log_info "暂无A/B测试"
            return 0
        fi

        printf "%-20s %-30s %-10s %-6s %-8s %-12s\n" "测试ID" "名称" "状态" "变体数" "流量%" "开始时间"
        echo "------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.name)\t\(.status)\t\(.variants)\t\(.traffic)\t\(.startDate // "未开始")"' | \
        while IFS=$'\t' read -r id name status variants traffic start_date; do
            printf "%-20s %-30s %-10s %-6s %-8s %-12s\n" \
                "${id:0:20}" "${name:0:30}" "$status" "$variants" "$traffic" "${start_date:0:12}"
        done

        local total=$(echo "$response" | jq -r '.total')
        log_success "共 $total 个测试"
    else
        log_error "获取测试列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 创建新测试
cmd_create() {
    log_header "创建A/B测试"

    echo "请输入测试信息:"

    # 获取测试名称
    read -p "测试名称: " test_name
    [ -z "$test_name" ] && { log_error "测试名称不能为空"; return 1; }

    # 获取测试描述
    read -p "测试描述 (可选): " test_description

    # 获取测试目标
    echo "测试目标选项:"
    echo "1. provider - 测试不同的AI供应商"
    echo "2. model - 测试不同的AI模型"
    echo "3. parameter_set - 测试不同的参数配置"
    echo "4. prompt_template - 测试不同的提示词模板"
    read -p "选择测试目标 (1-4): " target_choice

    case $target_choice in
        1) target="provider" ;;
        2) target="model" ;;
        3) target="parameter_set" ;;
        4) target="prompt_template" ;;
        *) log_error "无效选择"; return 1 ;;
    esac

    # 获取变体数量
    read -p "变体数量 (2-10): " variant_count
    if ! [[ "$variant_count" =~ ^[2-9]|10$ ]]; then
        log_error "变体数量必须在2-10之间"
        return 1
    fi

    # 获取变体信息
    variants=()
    for ((i=1; i<=variant_count; i++)); do
        echo "变体 $i:"
        read -p "  变体ID: " variant_id
        read -p "  变体名称: " variant_name
        read -p "  变体描述 (可选): " variant_desc

        variant_json="{\"id\":\"$variant_id\",\"name\":\"$variant_name\""
        [ -n "$variant_desc" ] && variant_json="$variant_json,\"description\":\"$variant_desc\""
        variant_json="$variant_json}"

        variants+=("$variant_json")
    done

    # 获取流量百分比
    read -p "参与测试的流量百分比 (1-100): " traffic_percent
    if ! [[ "$traffic_percent" =~ ^[1-9][0-9]?$|^100$ ]]; then
        log_error "流量百分比必须在1-100之间"
        return 1
    fi

    # 构建JSON数据
    variants_json=$(IFS=,; echo "[${variants[*]}]")

    data=$(cat << EOF
{
    "name": "$test_name",
    "description": "$test_description",
    "target": "$target",
    "variants": $variants_json,
    "traffic": $traffic_percent,
    "metrics": ["response_time", "cost", "quality_score"]
}
EOF
)

    log_info "创建测试中..."

    local response
    if ! response=$(api_request "POST" "/ab-tests" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local test_id=$(echo "$response" | jq -r '.data.id')
        log_success "测试创建成功: $test_id"
        echo "$response" | jq '.data'
    else
        log_error "创建测试失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 显示测试详情
cmd_show() {
    local test_id="$1"

    if [ -z "$test_id" ]; then
        log_error "请提供测试ID"
        show_help
        return 1
    fi

    log_header "测试详情: $test_id"

    local response
    if ! response=$(api_request "GET" "/ab-tests/$test_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取测试详情失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 启动测试
cmd_start() {
    local test_id="$1"

    if [ -z "$test_id" ]; then
        log_error "请提供测试ID"
        show_help
        return 1
    fi

    log_info "启动测试: $test_id"

    local response
    if ! response=$(api_request "POST" "/ab-tests/$test_id/start"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "测试启动成功"
    else
        log_error "启动测试失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 暂停测试
cmd_pause() {
    local test_id="$1"

    if [ -z "$test_id" ]; then
        log_error "请提供测试ID"
        show_help
        return 1
    fi

    log_info "暂停测试: $test_id"

    local response
    if ! response=$(api_request "POST" "/ab-tests/$test_id/pause"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "测试暂停成功"
    else
        log_error "暂停测试失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 停止测试
cmd_stop() {
    local test_id="$1"

    if [ -z "$test_id" ]; then
        log_error "请提供测试ID"
        show_help
        return 1
    fi

    log_info "停止测试: $test_id"

    local response
    if ! response=$(api_request "POST" "/ab-tests/$test_id/stop"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "测试停止成功"
    else
        log_error "停止测试失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 删除测试
cmd_delete() {
    local test_id="$1"

    if [ -z "$test_id" ]; then
        log_error "请提供测试ID"
        show_help
        return 1
    fi

    read -p "确定要删除测试 $test_id 吗? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "操作已取消"
        return 0
    fi

    log_info "删除测试: $test_id"

    local response
    if ! response=$(api_request "DELETE" "/ab-tests/$test_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "测试删除成功"
    else
        log_error "删除测试失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 分析测试结果
cmd_analyze() {
    local test_id="$1"

    if [ -z "$test_id" ]; then
        log_error "请提供测试ID"
        show_help
        return 1
    fi

    log_header "测试分析: $test_id"

    local response
    if ! response=$(api_request "GET" "/ab-tests/$test_id/analysis"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取测试分析失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 查看测试原始结果
cmd_results() {
    local test_id="$1"
    shift
    local metric=""
    local variant=""
    local limit="100"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --metric) metric="$2"; shift 2 ;;
            --variant) variant="$2"; shift 2 ;;
            --limit) limit="$2"; shift 2 ;;
            *) log_error "未知选项: $1"; return 1 ;;
        esac
    done

    if [ -z "$test_id" ]; then
        log_error "请提供测试ID"
        show_help
        return 1
    fi

    log_header "测试结果: $test_id"

    local query=""
    [ -n "$metric" ] && query="${query}&metric=$metric"
    [ -n "$variant" ] && query="${query}&variant=$variant"
    query="${query}&limit=$limit"

    local endpoint="/ab-tests/$test_id/results${query}"

    local response
    if ! response=$(api_request "GET" "$endpoint"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取测试结果失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 为用户分配测试变体
cmd_allocate() {
    local test_id="$1"
    shift
    local user_id=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --user-id) user_id="$2"; shift 2 ;;
            *) log_error "未知选项: $1"; return 1 ;;
        esac
    done

    if [ -z "$test_id" ]; then
        log_error "请提供测试ID"
        show_help
        return 1
    fi

    if [ -z "$user_id" ]; then
        log_error "请提供用户ID (--user-id)"
        return 1
    fi

    log_info "为用户分配测试变体: $test_id -> $user_id"

    local data="{\"userId\":\"$user_id\"}"

    local response
    if ! response=$(api_request "POST" "/ab-tests/$test_id/allocate" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local allocation=$(echo "$response" | jq -r '.data')
        if [ "$allocation" = "null" ]; then
            log_info "用户未参与测试"
        else
            local variant_id=$(echo "$allocation" | jq -r '.variantId')
            local variant_name=$(echo "$allocation" | jq -r '.variant.name')
            log_success "分配结果: 变体 $variant_id ($variant_name)"
            format_json "$response"
        fi
    else
        log_error "分配测试变体失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 记录测试结果
cmd_record() {
    local test_id="$1"
    shift
    local variant_id=""
    local user_id=""
    local metrics=()

    while [[ $# -gt 0 ]]; do
        case $1 in
            --variant) variant_id="$2"; shift 2 ;;
            --user-id) user_id="$2"; shift 2 ;;
            --metric)
                local metric_name="$2"
                local metric_value="$3"
                metrics+=("\"$metric_name\":$metric_value")
                shift 3
                ;;
            *) log_error "未知选项: $1"; return 1 ;;
        esac
    done

    if [ -z "$test_id" ]; then
        log_error "请提供测试ID"
        show_help
        return 1
    fi

    if [ -z "$variant_id" ] || [ -z "$user_id" ] || [ ${#metrics[@]} -eq 0 ]; then
        log_error "请提供变体ID、用户ID和至少一个指标"
        return 1
    fi

    log_info "记录测试结果: $test_id (变体: $variant_id, 用户: $user_id)"

    local metrics_json=$(IFS=,; echo "{${metrics[*]}}")
    local data=$(cat << EOF
{
    "variantId": "$variant_id",
    "userId": "$user_id",
    "metrics": $metrics_json
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/ab-tests/$test_id/record" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "测试结果记录成功"
    else
        log_error "记录测试结果失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 批量启动测试
cmd_batch_start() {
    log_header "批量启动测试"

    echo "请输入要启动的测试ID (用空格分隔):"
    read -p "测试ID: " -a test_ids

    if [ ${#test_ids[@]} -eq 0 ]; then
        log_error "请至少提供一个测试ID"
        return 1
    fi

    local data=$(printf '%s\n' "${test_ids[@]}" | jq -R . | jq -s '{testIds: .}')

    log_info "批量启动测试中..."

    local response
    if ! response=$(api_request "POST" "/ab-tests/batch/start" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "$(echo "$response" | jq -r '.message')"
        format_json "$response"
    else
        log_error "批量启动失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 批量停止测试
cmd_batch_stop() {
    log_header "批量停止测试"

    echo "请输入要停止的测试ID (用空格分隔):"
    read -p "测试ID: " -a test_ids

    if [ ${#test_ids[@]} -eq 0 ]; then
        log_error "请至少提供一个测试ID"
        return 1
    fi

    local data=$(printf '%s\n' "${test_ids[@]}" | jq -R . | jq -s '{testIds: .}')

    log_info "批量停止测试中..."

    local response
    if ! response=$(api_request "POST" "/ab-tests/batch/stop" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "$(echo "$response" | jq -r '.message')"
        format_json "$response"
    else
        log_error "批量停止失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 主函数
main() {
    check_dependencies

    local command=""
    local verbose=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help; exit 0 ;;
            -u|--url) GATEWAY_URL="$2"; shift 2 ;;
            -v|--verbose) verbose=true; shift ;;
            *) command="$1"; shift; break ;;
        esac
    done

    export VERBOSE="$verbose"

    case $command in
        list) cmd_list "$@" ;;
        create) cmd_create "$@" ;;
        show) cmd_show "$@" ;;
        start) cmd_start "$@" ;;
        pause) cmd_pause "$@" ;;
        stop) cmd_stop "$@" ;;
        delete) cmd_delete "$@" ;;
        analyze) cmd_analyze "$@" ;;
        results) cmd_results "$@" ;;
        allocate) cmd_allocate "$@" ;;
        record) cmd_record "$@" ;;
        batch-start) cmd_batch_start "$@" ;;
        batch-stop) cmd_batch_stop "$@" ;;
        "") show_help ;;
        *) log_error "未知命令: $command"; show_help; exit 1 ;;
    esac
}

main "$@"
