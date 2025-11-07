#!/bin/bash

# 批量处理管理脚本
# 借鉴AWS Batch CLI和Google Cloud Batch工具的设计理念
# 提供直观的批量AI请求处理和管理命令行界面

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/batch-processing.json"

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
批量处理管理工具 - Sira AI Gateway

USAGE:
    $0 [COMMAND] [SUBCOMMAND] [OPTIONS]

COMMANDS:
    batch                      批量任务管理
    queue                      队列管理
    template                   批量模板
    stats                      统计信息
    cache                      缓存管理
    health                     健康检查

BATCH SUBCOMMANDS:
    submit <file>              提交批量任务
    list                       列出批量任务
    show <batch_id>            显示批量任务详情
    status <batch_id>          显示批量任务状态
    results <batch_id>         获取批量任务结果
    cancel <batch_id>          取消批量任务
    delete <batch_id>          删除批量任务

QUEUE SUBCOMMANDS:
    status                     显示队列状态
    priority                   显示优先级队列（管理员）

TEMPLATE SUBCOMMANDS:
    list                       列出批量模板
    use <template> <data_file> 使用模板创建批量任务

STATS SUBCOMMANDS:
    summary                    批量处理统计摘要
    performance                性能统计详情

CACHE SUBCOMMANDS:
    status                     缓存状态
    clear                      清除缓存

OPTIONS:
    -h, --help                 显示帮助信息
    -u, --url URL              指定网关URL (默认: http://localhost:8080)
    -v, --verbose              详细输出
    -o, --output FILE          输出结果到文件
    -f, --format FORMAT        输出格式 (json, table, pretty)
    --user-id USER_ID          指定用户ID
    --priority PRIORITY        任务优先级 (high, normal, low)
    --name NAME                批量任务名称

EXAMPLES:
    $0 batch submit requests.json --name "文本分类任务"
    $0 batch list --user-id user123
    $0 batch status batch_1234567890
    $0 batch results batch_1234567890 --limit 10
    $0 queue status
    $0 template list
    $0 stats summary
    $0 cache clear

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

# ==================== 批量任务管理 ====================

cmd_batch() {
    local subcommand="$1"
    shift

    case $subcommand in
        submit) cmd_batch_submit "$@" ;;
        list) cmd_batch_list "$@" ;;
        show) cmd_batch_show "$@" ;;
        status) cmd_batch_status "$@" ;;
        results) cmd_batch_results "$@" ;;
        cancel) cmd_batch_cancel "$@" ;;
        delete) cmd_batch_delete "$@" ;;
        *) log_error "未知的批量子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_batch_submit() {
    local file_path=""
    local name=""
    local priority="normal"
    local user_id=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --name) name="$2"; shift 2 ;;
            --priority) priority="$2"; shift 2 ;;
            --user-id) user_id="$2"; shift 2 ;;
            *) file_path="$1"; shift ;;
        esac
    done

    if [ -z "$file_path" ]; then
        log_error "请提供批量请求文件路径"
        return 1
    fi

    if [ ! -f "$file_path" ]; then
        log_error "文件不存在: $file_path"
        return 1
    fi

    log_header "提交批量任务: $file_path"

    # 读取请求数据
    local requests_data
    if ! requests_data=$(cat "$file_path"); then
        log_error "读取文件失败: $file_path"
        return 1
    fi

    # 构建请求数据
    local data=$(cat << EOF
{
    "name": "$name",
    "requests": $requests_data,
    "priority": "$priority",
    "config": {
        "continueOnError": true,
        "collectMetrics": true
    }
}
EOF
)

    if [ -n "$user_id" ]; then
        data=$(echo "$data" | jq --arg uid "$user_id" '.userId = $uid')
    fi

    local response
    if ! response=$(api_request "POST" "/batch-processing/batches" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local batch_data=$(echo "$response" | jq -r '.data')
        log_success "批量任务已提交"

        echo "📦 任务ID: $(echo "$batch_data" | jq -r '.id')"
        echo "📝 任务名称: $(echo "$batch_data" | jq -r '.name')"
        echo "📊 请求数量: $(echo "$batch_data" | jq -r '.totalRequests')"
        echo "🎯 优先级: $(echo "$batch_data" | jq -r '.priority')"
        echo "📅 创建时间: $(echo "$batch_data" | jq -r '.createdAt')"
        echo "⏱️ 预计完成: $(echo "$batch_data" | jq -r '.estimatedCompletionTime')"

        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "提交批量任务失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_batch_list() {
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

    log_header "批量任务列表"

    local query="limit=$limit"
    [ -n "$user_id" ] && query="${query}&userId=$user_id"
    [ -n "$status" ] && query="${query}&status=$status"

    local response
    if ! response=$(api_request "GET" "/batch-processing/batches?$query"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local batches=$(echo "$response" | jq -r '.data[]')

        if [ -z "$batches" ]; then
            log_info "暂无批量任务"
            return 0
        fi

        printf "%-25s %-30s %-8s %-8s %-12s %-15s\n" "任务ID" "名称" "状态" "优先级" "进度" "创建时间"
        echo "-----------------------------------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.name)\t\(.status)\t\(.priority)\t\("\(.progress.completed)/\(.progress.total)")\t\(.createdAt[:10])"' | \
        while IFS=$'\t' read -r id name status priority progress created; do
            printf "%-25s %-30s %-8s %-8s %-12s %-15s\n" \
                "${id:0:25}" "${name:0:30}" "$status" "$priority" "$progress" "$created"
        done

        local total=$(echo "$response" | jq -r '.data | length')
        log_success "共 $total 个批量任务"
    else
        log_error "获取批量任务列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_batch_show() {
    local batch_id="$1"

    if [ -z "$batch_id" ]; then
        log_error "请提供批量任务ID"
        return 1
    fi

    log_header "批量任务详情: $batch_id"

    local response
    if ! response=$(api_request "GET" "/batch-processing/batches/$batch_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "获取批量任务详情失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_batch_status() {
    local batch_id="$1"

    if [ -z "$batch_id" ]; then
        log_error "请提供批量任务ID"
        return 1
    fi

    log_header "批量任务状态: $batch_id"

    local response
    if ! response=$(api_request "GET" "/batch-processing/batches/$batch_id/status"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local status_data=$(echo "$response" | jq -r '.data')

        echo "📦 任务ID: $(echo "$status_data" | jq -r '.id')"
        echo "📝 任务名称: $(echo "$status_data" | jq -r '.name')"
        echo "📊 状态: $(echo "$status_data" | jq -r '.status')"
        echo "📈 进度: $(echo "$status_data" | jq -r '.progress.completed')/$(echo "$status_data" | jq -r '.progress.total') ($(printf "%.1f" $(echo "$status_data" | jq -r '.progress.successRate * 100'))%)"
        echo "⏰ 创建时间: $(echo "$status_data" | jq -r '.createdAt')"
        echo "▶️ 开始时间: $(echo "$status_data" | jq -r '.startedAt // "未开始"')"
        echo "✅ 完成时间: $(echo "$status_data" | jq -r '.completedAt // "未完成"')"
        echo "⏱️ 持续时间: $(echo "$status_data" | jq -r '.duration // 0')ms"
        echo "⚡ 平均响应时间: $(printf "%.0f" $(echo "$status_data" | jq -r '.avgResponseTime // 0'))ms"

        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "获取批量任务状态失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_batch_results() {
    local batch_id="$1"
    shift

    local limit="20"
    local offset="0"
    local include_errors="true"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --limit) limit="$2"; shift 2 ;;
            --offset) offset="$2"; shift 2 ;;
            --include-errors) include_errors="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$batch_id" ]; then
        log_error "请提供批量任务ID"
        return 1
    fi

    log_header "批量任务结果: $batch_id"

    local query="limit=$limit&offset=$offset&includeErrors=$include_errors"

    local response
    if ! response=$(api_request "GET" "/batch-processing/batches/$batch_id/results?$query"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "获取批量任务结果失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_batch_cancel() {
    local batch_id="$1"
    shift

    local reason="user_cancelled"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --reason) reason="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$batch_id" ]; then
        log_error "请提供批量任务ID"
        return 1
    fi

    log_info "取消批量任务: $batch_id (原因: $reason)"

    local data=$(cat << EOF
{
    "reason": "$reason"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/batch-processing/batches/$batch_id/cancel" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "批量任务已取消"
    else
        log_error "取消批量任务失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_batch_delete() {
    local batch_id="$1"

    if [ -z "$batch_id" ]; then
        log_error "请提供批量任务ID"
        return 1
    fi

    read -p "确定要删除批量任务 $batch_id 吗? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "操作已取消"
        return 0
    fi

    log_info "删除批量任务: $batch_id"

    local response
    if ! response=$(api_request "DELETE" "/batch-processing/batches/$batch_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "批量任务已删除"
    else
        log_error "删除批量任务失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 队列管理 ====================

cmd_queue() {
    local subcommand="$1"
    shift

    case $subcommand in
        status) cmd_queue_status "$@" ;;
        priority) cmd_queue_priority "$@" ;;
        *) cmd_queue_status "$@" ;;
    esac
}

cmd_queue_status() {
    log_header "队列状态"

    local response
    if ! response=$(api_request "GET" "/batch-processing/queue"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local queue_data=$(echo "$response" | jq -r '.data')

        echo "👷 活跃Worker: $(echo "$queue_data" | jq -r '.activeWorkers')"
        echo "📦 活跃批量任务: $(echo "$queue_data" | jq -r '.activeBatches')"
        echo "🔥 最大并发数: $(echo "$queue_data" | jq -r '.maxConcurrency')"
        echo "💾 缓存大小: $(echo "$queue_data" | jq -r '.cacheSize')"

        echo ""
        echo "📋 队列长度:"
        echo "  🎯 优先级队列: $(echo "$queue_data" | jq -r '.queueLengths.priority')"
        echo "  📊 普通队列: $(echo "$queue_data" | jq -r '.queueLengths.normal')"
        echo "  📉 低优先级队列: $(echo "$queue_data" | jq -r '.queueLengths.lowPriority')"
    else
        log_error "获取队列状态失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_queue_priority() {
    log_header "优先级队列详情"

    local response
    if ! response=$(api_request "GET" "/batch-processing/queue/priority"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local queues=$(echo "$response" | jq -r '.data')

        echo "🎯 优先级队列:"
        echo "$queues" | jq -r '.priority[] | "  📦 \(.id) - \(.name) (\(.totalRequests) 请求) [\(.createdAt[:10])]"' || echo "  队列为空"

        echo ""
        echo "📊 普通队列 (前10个):"
        echo "$queues" | jq -r '.normal[] | "  📦 \(.id) - \(.name) (\(.totalRequests) 请求) [\(.createdAt[:10])]"' || echo "  队列为空"

        echo ""
        echo "📉 低优先级队列 (前5个):"
        echo "$queues" | jq -r '.lowPriority[] | "  📦 \(.id) - \(.name) (\(.totalRequests) 请求) [\(.createdAt[:10])]"' || echo "  队列为空"
    else
        log_error "获取优先级队列失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 批量模板 ====================

cmd_template() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_template_list "$@" ;;
        use) cmd_template_use "$@" ;;
        *) cmd_template_list "$@" ;;
    esac
}

cmd_template_list() {
    log_header "批量处理模板"

    local response
    if ! response=$(api_request "GET" "/batch-processing/templates"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        echo "$response" | jq -r '.data | to_entries[] | "\(.key): \(.value.name)\n  \(.value.description)\n"'
    else
        log_error "获取批量模板失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_template_use() {
    local template="$1"
    local data_file="$2"
    shift 2

    local name=""
    local priority="normal"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --name) name="$2"; shift 2 ;;
            --priority) priority="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$template" ] || [ -z "$data_file" ]; then
        log_error "请提供模板名称和数据文件路径"
        return 1
    fi

    if [ ! -f "$data_file" ]; then
        log_error "数据文件不存在: $data_file"
        return 1
    fi

    log_header "使用模板创建批量任务: $template"

    # 获取模板
    local template_response
    if ! template_response=$(api_request "GET" "/batch-processing/templates"); then
        return 1
    fi

    if [ "$(echo "$template_response" | jq -r '.success')" != "true" ]; then
        log_error "获取模板失败"
        return 1
    fi

    local template_config=$(echo "$template_response" | jq -r ".data.\"$template\"")
    if [ "$template_config" = "null" ]; then
        log_error "模板不存在: $template"
        return 1
    fi

    # 读取数据文件
    local data_content
    if ! data_content=$(cat "$data_file"); then
        log_error "读取数据文件失败: $data_file"
        return 1
    fi

    # 构建请求
    local requests=$(echo "$data_content" | jq -r '.[] | .text // .content // .prompt // .' | jq -R | jq -s 'map({prompt: .})')

    local batch_data=$(cat << EOF
{
    "name": "$name",
    "requests": $requests,
    "priority": "$priority",
    "config": $(echo "$template_config" | jq -r '.config')
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/batch-processing/batches" "$batch_data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "使用模板创建批量任务成功"
        local batch_data=$(echo "$response" | jq -r '.data')

        echo "📦 任务ID: $(echo "$batch_data" | jq -r '.id')"
        echo "📝 任务名称: $(echo "$batch_data" | jq -r '.name')"
        echo "📊 请求数量: $(echo "$batch_data" | jq -r '.totalRequests')"
        echo "🎯 优先级: $(echo "$batch_data" | jq -r '.priority')"

        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "创建批量任务失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 统计信息 ====================

cmd_stats() {
    local subcommand="$1"
    shift

    case $subcommand in
        summary) cmd_stats_summary "$@" ;;
        performance) cmd_stats_performance "$@" ;;
        *) cmd_stats_summary "$@" ;;
    esac
}

cmd_stats_summary() {
    log_header "批量处理统计摘要"

    local response
    if ! response=$(api_request "GET" "/batch-processing/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local stats=$(echo "$response" | jq -r '.data')

        echo "📊 总批量任务数: $(echo "$stats" | jq -r '.totalBatches')"
        echo "✅ 已完成: $(echo "$stats" | jq -r '.completedBatches')"
        echo "❌ 已失败: $(echo "$stats" | jq -r '.failedBatches')"
        echo "⏱️ 平均处理时间: $(printf "%.0f" $(echo "$stats" | jq -r '.avgProcessingTime'))ms"
        echo "🚀 平均吞吐量: $(printf "%.1f" $(echo "$stats" | jq -r '.avgThroughput')) 请求/秒"
        echo "🔥 峰值并发数: $(echo "$stats" | jq -r '.peakConcurrency')"
        echo "💾 缓存大小: $(echo "$stats" | jq -r '.cacheSize')"
        echo "👷 活跃Worker: $(echo "$stats" | jq -r '.activeWorkers')"
        echo "📦 活跃批量任务: $(echo "$stats" | jq -r '.activeBatches')"
    else
        log_error "获取统计信息失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stats_performance() {
    log_header "性能统计详情"

    local response
    if ! response=$(api_request "GET" "/batch-processing/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "获取性能统计失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 缓存管理 ====================

cmd_cache() {
    local subcommand="$1"
    shift

    case $subcommand in
        status) cmd_cache_status "$@" ;;
        clear) cmd_cache_clear "$@" ;;
        *) cmd_cache_status "$@" ;;
    esac
}

cmd_cache_status() {
    log_header "批量处理缓存状态"

    local response
    if ! response=$(api_request "GET" "/batch-processing/cache"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local cache=$(echo "$response" | jq -r '.data')

        echo "📦 缓存大小: $(echo "$cache" | jq -r '.cacheSize') 条记录"
        echo "⏰ 缓存TTL: $(echo "$cache" | jq -r '.cacheTTL') 毫秒"
        echo "💾 预估内存使用: $(echo "$cache" | jq -r '.estimatedMemoryUsage') 字节"
    else
        log_error "获取缓存状态失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_cache_clear() {
    log_info "清除批量处理缓存..."

    local response
    if ! response=$(api_request "POST" "/batch-processing/cache/clear"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "批量处理缓存已清理: $(echo "$response" | jq -r '.data.clearedEntries') 条记录"
    else
        log_error "清理缓存失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 健康检查 ====================

cmd_health() {
    log_header "批量处理服务健康检查"

    local response
    if ! response=$(api_request "GET" "/batch-processing/health"); then
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
        echo "  👷 活跃Worker: $(echo "$health" | jq -r '.stats.activeWorkers')"
        echo "  📦 活跃批量任务: $(echo "$health" | jq -r '.stats.activeBatches')"
        echo "  💾 缓存大小: $(echo "$health" | jq -r '.stats.cacheSize')"
        echo "  🔥 最大并发数: $(echo "$health" | jq -r '.stats.maxConcurrency')"

        # 显示队列长度
        echo ""
        echo "📋 队列状态:"
        echo "$health" | jq -r '.stats.queueLengths | to_entries[] | "  \(.key): \(.value)"'

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
        batch) cmd_batch "$@" ;;
        queue) cmd_queue "$@" ;;
        template) cmd_template "$@" ;;
        stats) cmd_stats "$@" ;;
        cache) cmd_cache "$@" ;;
        health) cmd_health "$@" ;;
        "") show_help ;;
        *) log_error "未知命令: $command"; show_help; exit 1 ;;
    esac
}

main "$@"
