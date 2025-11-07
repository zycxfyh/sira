#!/bin/bash

# 流式响应管理脚本
# 借鉴OpenAI流式API和Twitter Streaming API的CLI工具设计理念
# 提供直观的流式响应连接管理和监控命令行界面

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/streaming.json"

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
流式响应管理工具 - Sira AI Gateway

USAGE:
    $0 [COMMAND] [SUBCOMMAND] [OPTIONS]

COMMANDS:
    stream                      流式会话管理
    connection                  连接管理
    data                        数据发送
    broadcast                   广播管理
    stats                       统计信息
    monitor                     实时监控
    health                      健康检查

STREAM SUBCOMMANDS:
    create                      创建流式会话
    list                        列出流式会话
    show <stream_id>            显示流式会话详情
    send <stream_id> <data>     向流发送数据
    close <stream_id>           关闭流式会话

CONNECTION SUBCOMMANDS:
    list                        列出所有连接
    show <connection_id>        显示连接详情
    close <connection_id>       关闭连接

DATA SUBCOMMANDS:
    send-stream <stream_id>     向流发送数据
    send-sse <data>             发送SSE数据

BROADCAST SUBCOMMANDS:
    all <message>               广播到所有连接
    user <user_id> <message>    广播到指定用户

STATS SUBCOMMANDS:
    summary                     流式统计摘要
    connections                 连接统计详情
    streams                     流统计详情
    performance                 性能统计详情

MONITOR SUBCOMMANDS:
    connections                 实时监控连接状态
    streams                     实时监控流状态
    performance                 实时监控性能指标

OPTIONS:
    -h, --help                  显示帮助信息
    -u, --url URL               指定网关URL (默认: http://localhost:8080)
    -v, --verbose               详细输出
    -o, --output FILE           输出结果到文件
    -f, --format FORMAT         输出格式 (json, table, pretty)
    --user-id USER_ID           指定用户ID
    --event-type TYPE           指定事件类型 (默认: data)
    --follow                    持续监控模式

EXAMPLES:
    $0 stream create --user-id user123
    $0 stream list --user-id user123
    $0 stream send stream_123 "Hello World"
    $0 connection list
    $0 data send-stream stream_123 --event-type custom "Custom data"
    $0 broadcast all "System maintenance notice"
    $0 stats summary
    $0 monitor connections --follow

EOF
}

# 发送HTTP请求的辅助函数
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local content_type="${4:-application/json}"

    local url="$(get_api_url)$endpoint"
    local curl_opts=(-s -X "$method" -H "Content-Type: $content_type")

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

# 格式化输出
format_output() {
    local data="$1"
    local format="${2:-pretty}"

    case $format in
        json)
            echo "$data"
            ;;
        table)
            # 简化的表格输出
            echo "$data" | jq -r '.data // .'
            ;;
        pretty|*)
            if command -v jq &> /dev/null; then
                echo "$data" | jq '.'
            else
                echo "$data"
            fi
            ;;
    esac
}

# 保存输出到文件
save_output() {
    local data="$1"
    local file="$2"

    if [ -n "$file" ]; then
        echo "$data" > "$file"
        log_success "结果已保存到: $file"
    fi
}

# ==================== 流式会话管理 ====================

cmd_stream() {
    local subcommand="$1"
    shift

    case $subcommand in
        create) cmd_stream_create "$@" ;;
        list) cmd_stream_list "$@" ;;
        show) cmd_stream_show "$@" ;;
        send) cmd_stream_send "$@" ;;
        close) cmd_stream_close "$@" ;;
        *) log_error "未知的流子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_stream_create() {
    local user_id=""
    local max_connections="10"
    local timeout="300000"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --user-id) user_id="$2"; shift 2 ;;
            --max-connections) max_connections="$2"; shift 2 ;;
            --timeout) timeout="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$user_id" ]; then
        user_id="${USER_ID:-anonymous}"
    fi

    log_header "创建流式会话"

    local data=$(cat << EOF
{
    "userId": "$user_id",
    "options": {
        "maxConnections": $max_connections,
        "timeout": $timeout
    }
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/streaming/streams" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local stream_data=$(echo "$response" | jq -r '.data')
        log_success "流式会话已创建"

        echo "🌊 流ID: $(echo "$stream_data" | jq -r '.streamId')"
        echo "👤 用户ID: $(echo "$stream_data" | jq -r '.userId')"
        echo "📊 状态: $(echo "$stream_data" | jq -r '.status')"
        echo "🔗 最大连接数: $(echo "$stream_data" | jq -r '.options.maxConnections')"
        echo "⏰ 创建时间: $(echo "$stream_data" | jq -r '.createdAt')"

        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "创建流式会话失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stream_list() {
    local user_id=""
    local status=""
    local limit="10"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --user-id) user_id="$2"; shift 2 ;;
            --status) status="$2"; shift 2 ;;
            --limit) limit="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$user_id" ]; then
        user_id="${USER_ID:-}"
    fi

    log_header "流式会话列表"

    local query=""
    [ -n "$user_id" ] && query="${query}&userId=$user_id"
    [ -n "$status" ] && query="${query}&status=$status"
    query="${query}&limit=$limit"

    # 移除开头的 &
    query="${query#&}"

    local response
    if ! response=$(api_request "GET" "/streaming/streams?$query"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local streams=$(echo "$response" | jq -r '.data[]')

        if [ -z "$streams" ]; then
            log_info "暂无流式会话"
            return 0
        fi

        printf "%-25s %-15s %-8s %-8s %-12s %-15s\n" "流ID" "用户ID" "状态" "连接数" "消息数" "创建时间"
        echo "---------------------------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.userId)\t\(.status)\t\(.connectionCount)\t\(.messageCount)\t\(.createdAt[:10])"' | \
        while IFS=$'\t' read -r id user_id status connections messages created; do
            printf "%-25s %-15s %-8s %-8s %-12s %-15s\n" \
                "${id:0:25}" "${user_id:0:15}" "$status" "$connections" "$messages" "$created"
        done

        local total=$(echo "$response" | jq -r '.data | length')
        log_success "共 $total 个流式会话"
    else
        log_error "获取流式会话列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stream_show() {
    local stream_id="$1"

    if [ -z "$stream_id" ]; then
        log_error "请提供流ID"
        return 1
    fi

    log_header "流式会话详情: $stream_id"

    local response
    if ! response=$(api_request "GET" "/streaming/streams/$stream_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "获取流式会话详情失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stream_send() {
    local stream_id="$1"
    shift

    if [ -z "$stream_id" ]; then
        log_error "请提供流ID"
        return 1
    fi

    local data=""
    local event_type="data"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --event-type) event_type="$2"; shift 2 ;;
            *) data="$1"; shift ;;
        esac
    done

    if [ -z "$data" ]; then
        log_error "请提供要发送的数据"
        return 1
    fi

    log_info "向流 $stream_id 发送数据 (事件类型: $event_type)"

    local request_data=$(cat << EOF
{
    "data": $data,
    "eventType": "$event_type",
    "metadata": {
        "source": "cli",
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/streaming/streams/$stream_id/send" "$request_data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "数据已发送到流"
    else
        log_error "发送数据失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stream_close() {
    local stream_id="$1"
    shift

    local reason="cli_request"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --reason) reason="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$stream_id" ]; then
        log_error "请提供流ID"
        return 1
    fi

    log_info "关闭流式会话: $stream_id (原因: $reason)"

    local data=$(cat << EOF
{
    "reason": "$reason"
}
EOF
)

    local response
    if ! response=$(api_request "DELETE" "/streaming/streams/$stream_id" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "流式会话已关闭"
    else
        log_error "关闭流式会话失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 连接管理 ====================

cmd_connection() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_connection_list "$@" ;;
        show) cmd_connection_show "$@" ;;
        close) cmd_connection_close "$@" ;;
        *) cmd_connection_list "$@" ;;
    esac
}

cmd_connection_list() {
    log_header "连接列表"

    local response
    if ! response=$(api_request "GET" "/streaming/connections"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local connections=$(echo "$response" | jq -r '.data[]')

        if [ -z "$connections" ]; then
            log_info "暂无连接"
            return 0
        fi

        printf "%-25s %-8s %-25s %-15s %-15s %-10s\n" "连接ID" "类型" "流ID" "用户ID" "客户端IP" "年龄(秒)"
        echo "------------------------------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.type)\t\(.streamId // "N/A")\t\(.userId)\t\(.clientIP)\t\(.age)"' | \
        while IFS=$'\t' read -r id type stream_id user_id ip age; do
            printf "%-25s %-8s %-25s %-15s %-15s %-10s\n" \
                "${id:0:25}" "$type" "${stream_id:0:25}" "${user_id:0:15}" "$ip" "$age"
        done

        local total=$(echo "$response" | jq -r '.total')
        log_success "共 $total 个连接"
    else
        log_error "获取连接列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_connection_show() {
    local connection_id="$1"

    if [ -z "$connection_id" ]; then
        log_error "请提供连接ID"
        return 1
    fi

    log_header "连接详情: $connection_id"

    # 这里需要管理员权限，通常通过API获取
    log_info "注意: 此功能需要管理员权限"

    local response
    if ! response=$(api_request "GET" "/streaming/connections/$connection_id" \
        -H "x-admin: true"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
    else
        log_error "获取连接详情失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_connection_close() {
    local connection_id="$1"
    shift

    local reason="admin_request"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --reason) reason="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$connection_id" ]; then
        log_error "请提供连接ID"
        return 1
    fi

    log_info "关闭连接: $connection_id (原因: $reason)"

    local data=$(cat << EOF
{
    "reason": "$reason"
}
EOF
)

    local response
    if ! response=$(api_request "DELETE" "/streaming/connections/$connection_id" "$data" \
        -H "x-admin: true"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "连接已关闭"
    else
        log_error "关闭连接失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 数据发送 ====================

cmd_data() {
    local subcommand="$1"
    shift

    case $subcommand in
        send-stream) cmd_data_send_stream "$@" ;;
        send-sse) cmd_data_send_sse "$@" ;;
        *) log_error "未知的数据子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_data_send_stream() {
    local stream_id="$1"
    shift

    if [ -z "$stream_id" ]; then
        log_error "请提供流ID"
        return 1
    fi

    local data=""
    local event_type="data"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --event-type) event_type="$2"; shift 2 ;;
            *) data="$1"; shift ;;
        esac
    done

    if [ -z "$data" ]; then
        log_error "请提供要发送的数据"
        return 1
    fi

    log_info "向流 $stream_id 发送数据 (事件类型: $event_type)"

    local request_data=$(cat << EOF
{
    "data": $data,
    "eventType": "$event_type"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/streaming/streams/$stream_id/send" "$request_data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "数据已发送到流"
    else
        log_error "发送数据失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_data_send_sse() {
    local data="$1"
    shift

    local stream_id=""
    local event_type="data"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --stream-id) stream_id="$2"; shift 2 ;;
            --event-type) event_type="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$data" ]; then
        log_error "请提供要发送的数据"
        return 1
    fi

    local endpoint="/streaming/sse/data"
    if [ -n "$stream_id" ]; then
        endpoint="/streaming/sse/${stream_id}/data"
    fi

    log_info "发送SSE数据 (事件类型: $event_type)"

    local request_data=$(cat << EOF
{
    "data": $data,
    "eventType": "$event_type"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "$endpoint" "$request_data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "SSE数据已发送"
    else
        log_error "发送SSE数据失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 广播管理 ====================

cmd_broadcast() {
    local subcommand="$1"
    shift

    case $subcommand in
        all) cmd_broadcast_all "$@" ;;
        user) cmd_broadcast_user "$@" ;;
        *) log_error "未知的广播子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_broadcast_all() {
    local message="$1"
    shift

    if [ -z "$message" ]; then
        log_error "请提供广播消息"
        return 1
    fi

    log_header "广播消息到所有连接"

    local data=$(cat << EOF
{
    "message": $message,
    "eventType": "broadcast",
    "metadata": {
        "source": "cli",
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/streaming/broadcast" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "广播消息已发送"
    else
        log_error "广播消息失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_broadcast_user() {
    local user_id="$1"
    local message="$2"
    shift 2

    if [ -z "$user_id" ] || [ -z "$message" ]; then
        log_error "请提供用户ID和消息内容"
        return 1
    fi

    log_header "广播消息到用户: $user_id"

    local data=$(cat << EOF
{
    "message": $message,
    "userId": "$user_id",
    "eventType": "user_broadcast",
    "metadata": {
        "source": "cli",
        "targetUser": "$user_id",
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/streaming/broadcast" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "用户广播消息已发送"
    else
        log_error "用户广播消息失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 统计信息 ====================

cmd_stats() {
    local subcommand="$1"
    shift

    case $subcommand in
        summary) cmd_stats_summary "$@" ;;
        connections) cmd_stats_connections "$@" ;;
        streams) cmd_stats_streams "$@" ;;
        performance) cmd_stats_performance "$@" ;;
        *) cmd_stats_summary "$@" ;;
    esac
}

cmd_stats_summary() {
    log_header "流式响应统计摘要"

    local response
    if ! response=$(api_request "GET" "/streaming/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local stats=$(echo "$response" | jq -r '.data')

        echo "📊 总连接数: $(echo "$stats" | jq -r '.totalConnections')"
        echo "🔗 活跃连接: $(echo "$stats" | jq -r '.activeConnections')"
        echo "🌊 总流数: $(echo "$stats" | jq -r '.totalStreams')"
        echo "🌊 活跃流: $(echo "$stats" | jq -r '.activeStreams')"
        echo "📨 发送消息数: $(echo "$stats" | jq -r '.messagesSent')"
        echo "📦 传输字节数: $(echo "$stats" | jq -r '.bytesTransferred')"
        echo "⚡ 平均响应时间: $(printf "%.2f" $(echo "$stats" | jq -r '.avgResponseTime // 0'))ms"
        echo "❌ 连接错误数: $(echo "$stats" | jq -r '.connectionErrors')"
    else
        log_error "获取统计信息失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stats_connections() {
    log_header "连接统计详情"

    local response
    if ! response=$(api_request "GET" "/streaming/connections/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "获取连接统计失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stats_streams() {
    log_header "流统计详情"

    local response
    if ! response=$(api_request "GET" "/streaming/streams/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "获取流统计失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stats_performance() {
    log_header "性能统计详情"

    local response
    if ! response=$(api_request "GET" "/streaming/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local stats=$(echo "$response" | jq -r '.data')
        echo "📊 性能指标:"
        echo "  总连接数: $(echo "$stats" | jq -r '.totalConnections')"
        echo "  活跃连接: $(echo "$stats" | jq -r '.activeConnections')"
        echo "  总流数: $(echo "$stats" | jq -r '.totalStreams')"
        echo "  活跃流: $(echo "$stats" | jq -r '.activeStreams')"
        echo "  发送消息数: $(echo "$stats" | jq -r '.messagesSent')"
        echo "  传输字节数: $(echo "$stats" | jq -r '.bytesTransferred')"
        echo "  平均响应时间: $(printf "%.2f" $(echo "$stats" | jq -r '.avgResponseTime // 0'))ms"
        echo "  连接错误数: $(echo "$stats" | jq -r '.connectionErrors')"

        if [ "$(echo "$stats" | jq -r '.connectionStats')" != "null" ]; then
            echo ""
            echo "🔗 连接统计:"
            echo "  SSE连接: $(echo "$stats" | jq -r '.connectionStats.sse')"
            echo "  WebSocket连接: $(echo "$stats" | jq -r '.connectionStats.websocket')"
            echo "  平均连接年龄: $(echo "$stats" | jq -r '.connectionStats.avgConnectionAge')秒"
        fi
    else
        log_error "获取性能统计失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 实时监控 ====================

cmd_monitor() {
    local subcommand="$1"
    shift

    case $subcommand in
        connections) cmd_monitor_connections "$@" ;;
        streams) cmd_monitor_streams "$@" ;;
        performance) cmd_monitor_performance "$@" ;;
        *) log_error "未知的监控子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_monitor_connections() {
    local follow=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --follow) follow=true; shift ;;
            *) break ;;
        esac
    done

    log_header "连接状态监控"

    if [ "$follow" = "true" ]; then
        log_info "开始持续监控连接状态 (按Ctrl+C退出)..."

        while true; do
            echo "$(date '+%Y-%m-%d %H:%M:%S') - 连接状态:"

            local response
            if response=$(api_request "GET" "/streaming/connections/stats" 2>/dev/null); then
                if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
                    local stats=$(echo "$response" | jq -r '.data')
                    echo "  总连接: $(echo "$stats" | jq -r '.total')"
                    echo "  活跃连接: $(echo "$stats" | jq -r '.active')"
                    echo "  SSE连接: $(echo "$stats" | jq -r '.sse')"
                    echo "  WebSocket连接: $(echo "$stats" | jq -r '.websocket')"
                fi
            fi

            sleep 5
            echo ""
        done
    else
        cmd_stats_connections
    fi
}

cmd_monitor_streams() {
    local follow=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --follow) follow=true; shift ;;
            *) break ;;
        esac
    done

    log_header "流状态监控"

    if [ "$follow" = "true" ]; then
        log_info "开始持续监控流状态 (按Ctrl+C退出)..."

        while true; do
            echo "$(date '+%Y-%m-%d %H:%M:%S') - 流状态:"

            local response
            if response=$(api_request "GET" "/streaming/streams/stats" 2>/dev/null); then
                if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
                    local stats=$(echo "$response" | jq -r '.data')
                    echo "  总流数: $(echo "$stats" | jq -r '.total')"
                    echo "  活跃流: $(echo "$stats" | jq -r '.active')"
                    echo "  平均连接/流: $(echo "$stats" | jq -r '.avgConnectionsPerStream')"
                    echo "  平均消息/流: $(echo "$stats" | jq -r '.avgMessagesPerStream')"
                fi
            fi

            sleep 5
            echo ""
        done
    else
        cmd_stats_streams
    fi
}

cmd_monitor_performance() {
    local follow=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --follow) follow=true; shift ;;
            *) break ;;
        esac
    done

    log_header "性能指标监控"

    if [ "$follow" = "true" ]; then
        log_info "开始持续监控性能指标 (按Ctrl+C退出)..."

        while true; do
            echo "$(date '+%Y-%m-%d %H:%M:%S') - 性能指标:"

            local response
            if response=$(api_request "GET" "/streaming/stats" 2>/dev/null); then
                if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
                    local stats=$(echo "$response" | jq -r '.data')
                    echo "  活跃连接: $(echo "$stats" | jq -r '.activeConnections')"
                    echo "  发送消息数: $(echo "$stats" | jq -r '.messagesSent')"
                    echo "  传输字节: $(echo "$stats" | jq -r '.bytesTransferred')"
                    echo "  平均响应时间: $(printf "%.2f" $(echo "$stats" | jq -r '.avgResponseTime // 0'))ms"
                fi
            fi

            sleep 5
            echo ""
        done
    else
        cmd_stats_performance
    fi
}

# ==================== 健康检查 ====================

cmd_health() {
    log_header "流式响应服务健康检查"

    local response
    if ! response=$(api_request "GET" "/streaming/health"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local health=$(echo "$response" | jq -r '.data')
        echo "🏥 状态: $(echo "$health" | jq -r '.status')"
        echo "⏰ 时间戳: $(echo "$health" | jq -r '.timestamp')"

        echo ""
        echo "🔧 组件状态:"
        echo "$health" | jq -r '.components | to_entries[] | "  \(.key): \(.value)"'

        echo ""
        echo "📊 统计信息:"
        echo "  总连接数: $(echo "$health" | jq -r '.stats.totalConnections')"
        echo "  活跃连接: $(echo "$health" | jq -r '.stats.activeConnections')"
        echo "  总流数: $(echo "$health" | jq -r '.stats.totalStreams')"
        echo "  活跃流: $(echo "$health" | jq -r '.stats.activeStreams')"
        echo "  发送消息数: $(echo "$health" | jq -r '.stats.messagesSent')"
        echo "  传输字节数: $(echo "$health" | jq -r '.stats.bytesTransferred')"

        if [ "$(echo "$health" | jq -r '.status')" = "healthy" ]; then
            log_success "服务运行正常"
        else
            log_warning "服务状态异常"
        fi
    else
        log_error "健康检查失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 主函数 ====================

main() {
    check_dependencies

    local command=""
    local verbose=false
    local output_file=""
    local format="pretty"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help; exit 0 ;;
            -u|--url) GATEWAY_URL="$2"; shift 2 ;;
            -v|--verbose) verbose=true; shift ;;
            -o|--output) output_file="$2"; shift 2 ;;
            -f|--format) format="$2"; shift 2 ;;
            *) command="$1"; shift; break ;;
        esac
    done

    export VERBOSE="$verbose"
    export OUTPUT_FILE="$output_file"
    export FORMAT="$format"

    case $command in
        stream) cmd_stream "$@" ;;
        connection) cmd_connection "$@" ;;
        data) cmd_data "$@" ;;
        broadcast) cmd_broadcast "$@" ;;
        stats) cmd_stats "$@" ;;
        monitor) cmd_monitor "$@" ;;
        health) cmd_health "$@" ;;
        "") show_help ;;
        *) log_error "未知命令: $command"; show_help; exit 1 ;;
    esac
}

main "$@"
