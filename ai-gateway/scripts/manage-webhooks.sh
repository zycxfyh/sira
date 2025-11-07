#!/bin/bash

# Webhook管理脚本
# 借鉴Stripe和GitHub的webhook管理设计，提供直观的命令行界面

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/webhooks.json"
DELIVERY_LOG="$PROJECT_ROOT/data/webhook-deliveries.json"

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
Webhook管理工具 - Sira AI Gateway

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    list                    列出所有webhooks
    create                  创建新webhook
    show <webhook_id>       显示webhook详情
    update <webhook_id>     更新webhook配置
    delete <webhook_id>     删除webhook
    test <webhook_id>       测试webhook连接
    retry <webhook_id>      重试失败的投递
    stats [webhook_id]      查看webhook统计信息
    trigger <event_type>    手动触发webhook事件
    batch-test              批量测试webhooks
    batch-retry             批量重试失败投递

OPTIONS:
    -h, --help              显示帮助信息
    -u, --url URL           指定网关URL (默认: http://localhost:8080)
    -v, --verbose           详细输出

EXAMPLES:
    $0 list
    $0 create
    $0 show wh_1234567890
    $0 test wh_1234567890
    $0 stats wh_1234567890
    $0 trigger image.completed --data '{"jobId":"job_123"}'

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

# 列出所有webhooks
cmd_list() {
    log_header "Webhook列表"

    local response
    if ! response=$(api_request "GET" "/webhooks"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local webhooks=$(echo "$response" | jq -r '.data[]')

        if [ -z "$webhooks" ]; then
            log_info "暂无webhook配置"
            return 0
        fi

        printf "%-25s %-50s %-15s %-8s %-12s\n" "Webhook ID" "URL" "事件" "状态" "成功率"
        echo "-----------------------------------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.url)\t\(.events[0])\t\(.status)\t\(.successCount)/\(.successCount + .failureCount)"' | \
        while IFS=$'\t' read -r id url events status success_rate; do
            printf "%-25s %-50s %-15s %-8s %-12s\n" \
                "${id:0:25}" "${url:0:50}" "${events:0:15}" "$status" "${success_rate:-0/0}"
        done

        local total=$(echo "$response" | jq -r '.total')
        log_success "共 $total 个webhook"
    else
        log_error "获取webhook列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 创建新webhook
cmd_create() {
    log_header "创建Webhook"

    echo "请输入webhook信息:"

    # 获取URL
    read -p "Webhook URL: " webhook_url
    [ -z "$webhook_url" ] && { log_error "URL不能为空"; return 1; }

    # 获取事件类型
    echo "支持的事件类型:"
    echo "  image.completed     - 图像生成完成"
    echo "  voice.stt.completed - 语音转文字完成"
    echo "  voice.tts.completed - 文字转语音完成"
    echo "  *                   - 所有事件 (通配符)"
    read -p "订阅的事件类型 (用空格分隔): " -a events
    [ ${#events[@]} -eq 0 ] && events=("*")

    # 获取描述
    read -p "描述 (可选): " description

    # 获取用户ID
    read -p "用户ID (可选，留空为匿名): " user_id

    # 构建事件数组JSON
    events_json=$(printf '%s\n' "${events[@]}" | jq -R . | jq -s .)

    # 构建数据
    data=$(cat << EOF
{
    "url": "$webhook_url",
    "events": $events_json,
    "description": "$description"
EOF
)

    [ -n "$user_id" ] && data="$data,\"userId\":\"$user_id\""
    data="$data}"

    log_info "创建webhook中..."

    local response
    if ! response=$(api_request "POST" "/webhooks" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local webhook_id=$(echo "$response" | jq -r '.data.id')
        local secret=$(echo "$response" | jq -r '.data.secret')
        log_success "Webhook创建成功: $webhook_id"
        log_warning "请保存好这个密钥，它只显示一次: $secret"
        echo "$response" | jq '.data | del(.secret)'
    else
        log_error "创建webhook失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 显示webhook详情
cmd_show() {
    local webhook_id="$1"

    if [ -z "$webhook_id" ]; then
        log_error "请提供webhook ID"
        show_help
        return 1
    fi

    log_header "Webhook详情: $webhook_id"

    local response
    if ! response=$(api_request "GET" "/webhooks/$webhook_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取webhook详情失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 更新webhook
cmd_update() {
    local webhook_id="$1"

    if [ -z "$webhook_id" ]; then
        log_error "请提供webhook ID"
        show_help
        return 1
    fi

    log_header "更新Webhook: $webhook_id"

    echo "输入要更新的字段 (留空保持不变):"

    read -p "新URL: " new_url
    read -p "新事件类型 (用空格分隔): " -a new_events
    read -p "新描述: " new_description
    read -p "新状态 (active/paused/disabled): " new_status

    # 构建更新数据
    data="{"

    [ -n "$new_url" ] && data="$data\"url\":\"$new_url\","
    [ -n "$new_description" ] && data="$data\"description\":\"$new_description\","
    [ -n "$new_status" ] && data="$data\"status\":\"$new_status\","

    if [ ${#new_events[@]} -gt 0 ]; then
        events_json=$(printf '%s\n' "${new_events[@]}" | jq -R . | jq -s .)
        data="$data\"events\":$events_json,"
    fi

    # 移除末尾逗号
    data="${data%,}}"

    if [ "$data" = "{}" ]; then
        log_warning "没有提供任何更新字段"
        return 0
    fi

    log_info "更新webhook中..."

    local response
    if ! response=$(api_request "PUT" "/webhooks/$webhook_id" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "Webhook更新成功"
        format_json "$response"
    else
        log_error "更新webhook失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 删除webhook
cmd_delete() {
    local webhook_id="$1"

    if [ -z "$webhook_id" ]; then
        log_error "请提供webhook ID"
        show_help
        return 1
    fi

    read -p "确定要删除webhook $webhook_id 吗? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "操作已取消"
        return 0
    fi

    log_info "删除webhook: $webhook_id"

    local response
    if ! response=$(api_request "DELETE" "/webhooks/$webhook_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "Webhook删除成功"
    else
        log_error "删除webhook失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 测试webhook
cmd_test() {
    local webhook_id="$1"

    if [ -z "$webhook_id" ]; then
        log_error "请提供webhook ID"
        show_help
        return 1
    fi

    log_info "测试webhook: $webhook_id"

    local response
    if ! response=$(api_request "POST" "/webhooks/$webhook_id/test"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "Webhook测试成功"
        format_json "$response"
    else
        log_error "Webhook测试失败: $(echo "$response" | jq -r '.message')"
        return 1
    fi
}

# 重试失败投递
cmd_retry() {
    local webhook_id="$1"

    if [ -z "$webhook_id" ]; then
        log_error "请提供webhook ID"
        show_help
        return 1
    fi

    log_info "重试webhook失败投递: $webhook_id"

    local response
    if ! response=$(api_request "POST" "/webhooks/$webhook_id/retry"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local retry_count=$(echo "$response" | jq -r '.data.retryCount')
        log_success "已安排重试 $retry_count 个失败的投递"
        format_json "$response"
    else
        log_error "重试失败投递失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 查看统计信息
cmd_stats() {
    local webhook_id="$1"

    log_header "Webhook统计信息"

    local endpoint="/webhooks/stats"
    [ -n "$webhook_id" ] && endpoint="$endpoint/$webhook_id"

    local response
    if ! response=$(api_request "GET" "$endpoint"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取统计信息失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 手动触发事件
cmd_trigger() {
    local event_type="$1"
    shift
    local event_data="{}"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --data) event_data="$2"; shift 2 ;;
            *) log_error "未知选项: $1"; return 1 ;;
        esac
    done

    if [ -z "$event_type" ]; then
        log_error "请提供事件类型"
        show_help
        return 1
    fi

    log_header "触发Webhook事件: $event_type"

    local data=$(cat << EOF
{
    "eventType": "$event_type",
    "eventData": $event_data
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/webhooks/trigger" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local delivered=$(echo "$response" | jq -r '.data.delivered')
        local total=$(echo "$response" | jq -r '.data.total')
        log_success "事件已触发，投递至 ${delivered}/${total} 个webhook"
        format_json "$response"
    else
        log_error "触发事件失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 批量测试
cmd_batch_test() {
    log_header "批量测试Webhooks"

    # 获取所有webhook ID
    local response
    if ! response=$(api_request "GET" "/webhooks"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" != "true" ]; then
        log_error "获取webhook列表失败"
        return 1
    fi

    local webhook_ids=$(echo "$response" | jq -r '.data[].id')
    local ids_array=$(echo "$webhook_ids" | jq -R . | jq -s .)

    if [ "$ids_array" = "[]" ]; then
        log_warning "没有找到webhook配置"
        return 0
    fi

    local data="{\"webhookIds\":$ids_array}"

    log_info "批量测试webhooks中..."

    if ! response=$(api_request "POST" "/webhooks/batch/test" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "$(echo "$response" | jq -r '.message')"
        format_json "$response"
    else
        log_error "批量测试失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 批量重试
cmd_batch_retry() {
    log_header "批量重试失败投递"

    # 获取所有webhook ID
    local response
    if ! response=$(api_request "GET" "/webhooks"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" != "true" ]; then
        log_error "获取webhook列表失败"
        return 1
    fi

    local webhook_ids=$(echo "$response" | jq -r '.data[].id')
    local ids_array=$(echo "$webhook_ids" | jq -R . | jq -s .)

    if [ "$ids_array" = "[]" ]; then
        log_warning "没有找到webhook配置"
        return 0
    fi

    local data="{\"webhookIds\":$ids_array}"

    log_info "批量重试失败投递中..."

    if ! response=$(api_request "POST" "/webhooks/batch/retry" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "$(echo "$response" | jq -r '.message')"
        format_json "$response"
    else
        log_error "批量重试失败: $(echo "$response" | jq -r '.error')"
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
        update) cmd_update "$@" ;;
        delete) cmd_delete "$@" ;;
        test) cmd_test "$@" ;;
        retry) cmd_retry "$@" ;;
        stats) cmd_stats "$@" ;;
        trigger) cmd_trigger "$@" ;;
        batch-test) cmd_batch_test "$@" ;;
        batch-retry) cmd_batch_retry "$@" ;;
        "") show_help ;;
        *) log_error "未知命令: $command"; show_help; exit 1 ;;
    esac
}

main "$@"
