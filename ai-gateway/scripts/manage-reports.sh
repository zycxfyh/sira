#!/bin/bash

# 报告管理脚本
# 借鉴现代CLI工具设计理念，提供直观的命令行界面

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/reports.json"
REPORTS_DIR="$PROJECT_ROOT/data/reports"

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
报告管理工具 - Sira AI Gateway

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    generate <type>         生成报告
    dashboard <type>        获取仪表板数据
    custom                   管理自定义报告
    export <type>           导出报告
    types                    显示支持的报告类型
    dashboards               显示支持的仪表板类型
    stats                    查看报告统计信息
    batch-generate          批量生成报告
    batch-export            批量导出报告

OPTIONS:
    -h, --help              显示帮助信息
    -u, --url URL           指定网关URL (默认: http://localhost:8080)
    -t, --time-range RANGE  时间范围 (默认: 24h)
    -f, --filters JSON      过滤条件 (JSON格式)
    -o, --output FORMAT     输出格式 (json, csv, html)
    -v, --verbose           详细输出

EXAMPLES:
    $0 generate usage-summary
    $0 generate performance-analysis --time-range 7d
    $0 dashboard overview
    $0 export usage-summary --output csv --filename report.csv
    $0 custom create --name "My Report" --config '{"widgets":[]}'
    $0 batch-generate --reports '[{"type":"usage-summary"},{"type":"performance-analysis"}]'

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

# 生成报告
cmd_generate() {
    local report_type="$1"
    shift

    local time_range="24h"
    local filters="{}"
    local format="json"
    local include_charts="true"
    local cache="true"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --time-range) time_range="$2"; shift 2 ;;
            --filters) filters="$2"; shift 2 ;;
            --format) format="$2"; shift 2 ;;
            --no-charts) include_charts="false"; shift ;;
            --no-cache) cache="false"; shift ;;
            *) break ;;
        esac
    done

    if [ -z "$report_type" ]; then
        log_error "请提供报告类型"
        show_help
        return 1
    fi

    log_header "生成报告: $report_type"

    local data=$(cat << EOF
{
    "type": "$report_type",
    "timeRange": "$time_range",
    "filters": $filters,
    "format": "$format",
    "includeCharts": $include_charts,
    "cache": $cache
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/reports/generate" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "生成报告失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 获取仪表板数据
cmd_dashboard() {
    local dashboard_type="$1"
    shift

    local time_range="24h"
    local refresh="false"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --time-range) time_range="$2"; shift 2 ;;
            --refresh) refresh="true"; shift ;;
            *) break ;;
        esac
    done

    if [ -z "$dashboard_type" ]; then
        log_error "请提供仪表板类型"
        show_help
        return 1
    fi

    log_header "获取仪表板: $dashboard_type"

    local query="timeRange=$time_range&refresh=$refresh"

    local response
    if ! response=$(api_request "GET" "/reports/dashboard/$dashboard_type?$query"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取仪表板失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 导出报告
cmd_export() {
    local report_type="$1"
    shift

    local time_range="24h"
    local filters="{}"
    local format="json"
    local filename=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --time-range) time_range="$2"; shift 2 ;;
            --filters) filters="$2"; shift 2 ;;
            --format) format="$2"; shift 2 ;;
            --filename) filename="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$report_type" ]; then
        log_error "请提供报告类型"
        show_help
        return 1
    fi

    log_header "导出报告: $report_type ($format)"

    local data=$(cat << EOF
{
    "type": "$report_type",
    "timeRange": "$time_range",
    "filters": $filters,
    "format": "$format"
EOF
)

    if [ -n "$filename" ]; then
        data="$data,\"filename\":\"$filename\""
    fi

    data="$data}"

    local response
    if ! response=$(api_request "POST" "/reports/export" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        if [ -n "$filename" ]; then
            log_success "报告已导出到: $(echo "$response" | jq -r '.data.filePath')"
            format_json "$response"
        else
            # 直接输出数据
            echo "$response" | jq -r '.data.data'
        fi
    else
        log_error "导出报告失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 显示报告类型
cmd_types() {
    log_header "支持的报告类型"

    local response
    if ! response=$(api_request "GET" "/reports/types"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        echo "可用的报告类型:"
        echo

        echo "$response" | jq -r '.data[] | "📊 \(.name) (\(.type))"
描述: \(.description)
参数: \(.parameters | keys | join(", "))
---
"'
    else
        log_error "获取报告类型失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 显示仪表板类型
cmd_dashboards() {
    log_header "支持的仪表板类型"

    local response
    if ! response=$(api_request "GET" "/reports/dashboards"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        echo "可用的仪表板类型:"
        echo

        echo "$response" | jq -r '.data[] | "📈 \(.name) (\(.type))"
描述: \(.description)
指标: \(.metrics | join(", "))
---
"'
    else
        log_error "获取仪表板类型失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 管理自定义报告
cmd_custom() {
    local action="$1"
    shift

    case $action in
        list)
            cmd_custom_list "$@"
            ;;
        create)
            cmd_custom_create "$@"
            ;;
        show)
            cmd_custom_show "$@"
            ;;
        update)
            cmd_custom_update "$@"
            ;;
        delete)
            cmd_custom_delete "$@"
            ;;
        generate)
            cmd_custom_generate "$@"
            ;;
        "")
            cmd_custom_list "$@"
            ;;
        *)
            log_error "未知的自定义报告操作: $action"
            echo "可用操作: list, create, show, update, delete, generate"
            return 1
            ;;
    esac
}

# 列出自定义报告
cmd_custom_list() {
    log_header "自定义报告列表"

    local response
    if ! response=$(api_request "GET" "/reports/custom"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local reports=$(echo "$response" | jq -r '.data[]')

        if [ -z "$reports" ]; then
            log_info "暂无自定义报告"
            return 0
        fi

        printf "%-25s %-40s %-8s %-12s\n" "报告ID" "名称" "启用" "最后生成时间"
        echo "----------------------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.name)\t\(.enabled)\t\(.lastGeneratedAt // "从未生成")"' | \
        while IFS=$'\t' read -r id name enabled last_gen; do
            printf "%-25s %-40s %-8s %-12s\n" \
                "${id:0:25}" "${name:0:40}" "$enabled" "${last_gen:0:12}"
        done

        local total=$(echo "$response" | jq -r '.data | length')
        log_success "共 $total 个自定义报告"
    else
        log_error "获取自定义报告失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 创建自定义报告
cmd_custom_create() {
    local name=""
    local config="{}"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --name) name="$2"; shift 2 ;;
            --config) config="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$name" ]; then
        log_error "请提供报告名称 (--name)"
        return 1
    fi

    log_header "创建自定义报告"

    local data=$(cat << EOF
{
    "name": "$name",
    "description": "通过CLI创建的自定义报告",
    "config": $config
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/reports/custom" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local report_id=$(echo "$response" | jq -r '.data.id')
        log_success "自定义报告创建成功: $report_id"
        format_json "$response"
    else
        log_error "创建自定义报告失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 显示自定义报告详情
cmd_custom_show() {
    local report_id="$1"

    if [ -z "$report_id" ]; then
        log_error "请提供报告ID"
        return 1
    fi

    log_header "自定义报告详情: $report_id"

    local response
    if ! response=$(api_request "GET" "/reports/custom/$report_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取自定义报告详情失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 生成自定义报告
cmd_custom_generate() {
    local report_id="$1"
    shift

    local time_range="24h"
    local format="json"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --time-range) time_range="$2"; shift 2 ;;
            --format) format="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$report_id" ]; then
        log_error "请提供报告ID"
        return 1
    fi

    log_header "生成自定义报告: $report_id"

    local data=$(cat << EOF
{
    "timeRange": "$time_range",
    "format": "$format"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/reports/custom/$report_id/generate" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "生成自定义报告失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 查看统计信息
cmd_stats() {
    log_header "报告统计信息"

    local response
    if ! response=$(api_request "GET" "/reports/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取统计信息失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 批量生成报告
cmd_batch_generate() {
    local reports="[]"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --reports) reports="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    log_header "批量生成报告"

    local data=$(cat << EOF
{
    "reports": $reports
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/reports/batch/generate" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "$(echo "$response" | jq -r '.message')"
        format_json "$response"
    else
        log_error "批量生成报告失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 批量导出报告
cmd_batch_export() {
    local reports="[]"
    local format="json"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --reports) reports="$2"; shift 2 ;;
            --format) format="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    log_header "批量导出报告 ($format)"

    local data=$(cat << EOF
{
    "reports": $reports,
    "format": "$format"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/reports/batch/export" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "$(echo "$response" | jq -r '.message')"
        format_json "$response"
    else
        log_error "批量导出报告失败: $(echo "$response" | jq -r '.error')"
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
            -t|--time-range) TIME_RANGE="$2"; shift 2 ;;
            -f|--filters) FILTERS="$2"; shift 2 ;;
            -o|--output) OUTPUT_FORMAT="$2"; shift 2 ;;
            -v|--verbose) verbose=true; shift ;;
            *) command="$1"; shift; break ;;
        esac
    done

    export VERBOSE="$verbose"
    export TIME_RANGE="${TIME_RANGE:-24h}"
    export FILTERS="${FILTERS:-{}}"
    export OUTPUT_FORMAT="${OUTPUT_FORMAT:-json}"

    case $command in
        generate) cmd_generate "$@" ;;
        dashboard) cmd_dashboard "$@" ;;
        export) cmd_export "$@" ;;
        types) cmd_types "$@" ;;
        dashboards) cmd_dashboards "$@" ;;
        custom) cmd_custom "$@" ;;
        stats) cmd_stats "$@" ;;
        batch-generate) cmd_batch_generate "$@" ;;
        batch-export) cmd_batch_export "$@" ;;
        "") show_help ;;
        *) log_error "未知命令: $command"; show_help; exit 1 ;;
    esac
}

main "$@"
