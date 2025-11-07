#!/bin/bash

# 智能路由管理脚本
# 借鉴OpenRouter的CLI工具设计理念，提供直观的智能路由管理界面

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/intelligent-routing.json"

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
智能路由管理工具 - Sira AI Gateway

USAGE:
    $0 [COMMAND] [SUBCOMMAND] [OPTIONS]

COMMANDS:
    route                      路由决策
    analyze                    复杂度分析
    strategy                   策略管理
    preferences                用户偏好管理
    stats                      统计信息
    models                     模型信息
    cache                      缓存管理
    health                     健康检查

ROUTE SUBCOMMANDS:
    single <request>           单次路由决策
    batch <file>               批量路由决策

ANALYZE SUBCOMMANDS:
    text <text>                分析文本复杂度
    file <file>                分析文件内容复杂度

STRATEGY SUBCOMMANDS:
    list                       列出所有策略
    current                    显示当前策略
    set <strategy>             设置路由策略

PREFERENCES SUBCOMMANDS:
    get <user_id>              获取用户偏好
    set <user_id> <key> <value> 设置用户偏好

STATS SUBCOMMANDS:
    summary                    路由统计摘要
    detailed <time_range>      详细统计 (1h, 24h, 7d)

MODELS SUBCOMMANDS:
    list                       列出所有模型
    info <model>               显示模型详情

CACHE SUBCOMMANDS:
    status                     缓存状态
    clear                      清除缓存

OPTIONS:
    -h, --help                 显示帮助信息
    -u, --url URL              指定网关URL (默认: http://localhost:8080)
    -v, --verbose              详细输出
    -o, --output FILE          输出结果到文件
    -f, --format FORMAT        输出格式 (json, table, pretty)

EXAMPLES:
    $0 route single "Hello, how are you?"
    $0 analyze text "Write a complex algorithm for sorting"
    $0 strategy set performance_first
    $0 preferences set user123 speedPreference fast
    $0 stats summary
    $0 models list
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
            # 简化的表格输出，实际使用中可能需要更复杂的处理
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

# ==================== 路由决策 ====================

cmd_route() {
    local subcommand="$1"
    shift

    case $subcommand in
        single) cmd_route_single "$@" ;;
        batch) cmd_route_batch "$@" ;;
        *) log_error "未知的路由子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_route_single() {
    local request="$1"
    shift

    if [ -z "$request" ]; then
        log_error "请提供请求内容"
        return 1
    fi

    log_header "执行智能路由决策"

    # 构建请求数据
    local data
    if [[ "$request" == *.json ]]; then
        # 如果是JSON文件，读取文件内容
        if [ ! -f "$request" ]; then
            log_error "文件不存在: $request"
            return 1
        fi
        data=$(cat "$request")
    else
        # 直接使用文本
        data=$(cat << EOF
{
    "request": "$request",
    "context": {
        "userId": "${USER_ID:-anonymous}",
        "requestId": "cli_$(date +%s)"
    }
}
EOF
)
    fi

    local response
    if ! response=$(api_request "POST" "/intelligent-routing/route" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "路由决策完成"

        # 显示结果
        echo "🎯 推荐模型: $(echo "$response" | jq -r '.model')"
        echo "🏢 提供商: $(echo "$response" | jq -r '.provider')"
        echo "📊 置信度: $(echo "$response" | jq -r '.confidence')"
        echo "🎲 策略: $(echo "$response" | jq -r '.routingStrategy')"
        echo ""
        echo "📋 推理过程:"
        echo "$response" | jq -r '.reasoning[]'

        if [ "$(echo "$response" | jq -r '.alternatives | length')" -gt 0 ]; then
            echo ""
            echo "🔄 备选方案:"
            echo "$response" | jq -r '.alternatives[] | "- \(.model) (\(.provider)): \(.score)"'
        fi

        # 保存输出
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "路由决策失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_route_batch() {
    local file_path="$1"
    shift

    if [ -z "$file_path" ]; then
        log_error "请提供包含请求列表的文件路径"
        return 1
    fi

    if [ ! -f "$file_path" ]; then
        log_error "文件不存在: $file_path"
        return 1
    fi

    log_header "批量执行智能路由决策"

    # 读取请求列表
    local requests_data
    if ! requests_data=$(cat "$file_path"); then
        log_error "读取文件失败: $file_path"
        return 1
    fi

    # 构建请求数据
    local data=$(cat << EOF
{
    "requests": $requests_data,
    "context": {
        "userId": "${USER_ID:-anonymous}",
        "batchId": "cli_batch_$(date +%s)"
    }
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/intelligent-routing/route-batch" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local stats=$(echo "$response" | jq -r '.stats')
        log_success "批量路由决策完成 - 总计: $(echo "$stats" | jq -r '.total'), 成功: $(echo "$stats" | jq -r '.successful'), 缓存命中: $(echo "$stats" | jq -r '.cacheHits')"

        # 显示每个请求的结果
        echo "$response" | jq -r '.data[] | select(.success == true) | "✅ \(.model) (\(.provider)) - \(.reasoning[0])"'
        echo "$response" | jq -r '.data[] | select(.success == false) | "❌ 失败: \(.error)"'

        # 保存输出
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "批量路由决策失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 复杂度分析 ====================

cmd_analyze() {
    local subcommand="$1"
    shift

    case $subcommand in
        text) cmd_analyze_text "$@" ;;
        file) cmd_analyze_file "$@" ;;
        *) log_error "未知的分析子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_analyze_text() {
    local text="$1"
    shift

    if [ -z "$text" ]; then
        log_error "请提供要分析的文本"
        return 1
    fi

    log_header "分析文本复杂度"

    local data=$(cat << EOF
{
    "request": "$text"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/intelligent-routing/analyze" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local analysis=$(echo "$response" | jq -r '.analysis')

        echo "📊 复杂度等级: $(echo "$analysis" | jq -r '.complexity')"
        echo "🎯 任务类型: $(echo "$analysis" | jq -r '.taskType')"
        echo "📏 预估tokens: $(echo "$analysis" | jq -r '.estimatedTokens')"
        echo "⚡ 处理时间: $(echo "$analysis" | jq -r '.processingTime')"
        echo "🎲 置信度: $(echo "$analysis" | jq -r '.confidence')"
        echo ""
        echo "📋 推理过程:"
        echo "$analysis" | jq -r '.reasoning[]'
        echo ""
        echo "🔍 详细分析:"
        echo "$analysis" | jq -r '.factors'

        # 保存输出
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "复杂度分析失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_analyze_file() {
    local file_path="$1"
    shift

    if [ -z "$file_path" ]; then
        log_error "请提供文件路径"
        return 1
    fi

    if [ ! -f "$file_path" ]; then
        log_error "文件不存在: $file_path"
        return 1
    fi

    log_header "分析文件复杂度: $file_path"

    # 读取文件内容
    local file_content
    if ! file_content=$(cat "$file_path"); then
        log_error "读取文件失败: $file_path"
        return 1
    fi

    local data=$(cat << EOF
{
    "request": "$file_content"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/intelligent-routing/analyze" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "文件复杂度分析失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 策略管理 ====================

cmd_strategy() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_strategy_list "$@" ;;
        current) cmd_strategy_current "$@" ;;
        set) cmd_strategy_set "$@" ;;
        *) log_error "未知的策略子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_strategy_list() {
    log_header "可用路由策略"

    local response
    if ! response=$(api_request "GET" "/intelligent-routing/strategies"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        echo "$response" | jq -r '.data | to_entries[] | "\(.key): \(.value.name) - \(.value.description)\(if .value.isActive then " (当前)" else "" end)"'
    else
        log_error "获取策略列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_strategy_current() {
    log_header "当前路由策略"

    local response
    if ! response=$(api_request "GET" "/intelligent-routing/strategy"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local strategy=$(echo "$response" | jq -r '.data')
        echo "🎯 当前策略: $(echo "$strategy" | jq -r '.name')"
        echo "📝 描述: $(echo "$strategy" | jq -r '.description')"
        echo "⚖️ 权重配置:"
        echo "$strategy" | jq -r '.weights // "自适应"'
    else
        log_error "获取当前策略失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_strategy_set() {
    local strategy="$1"

    if [ -z "$strategy" ]; then
        log_error "请指定策略名称"
        return 1
    fi

    log_info "设置路由策略: $strategy"

    local data=$(cat << EOF
{
    "strategy": "$strategy"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/intelligent-routing/strategy" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "路由策略已更新"
        echo "$response" | jq -r '.message'
    else
        log_error "设置路由策略失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 用户偏好管理 ====================

cmd_preferences() {
    local subcommand="$1"
    shift

    case $subcommand in
        get) cmd_preferences_get "$@" ;;
        set) cmd_preferences_set "$@" ;;
        *) log_error "未知的偏好子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_preferences_get() {
    local user_id="$1"

    if [ -z "$user_id" ]; then
        log_error "请提供用户ID"
        return 1
    fi

    log_header "用户偏好: $user_id"

    local response
    if ! response=$(api_request "GET" "/intelligent-routing/preferences/$user_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
    else
        log_error "获取用户偏好失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_preferences_set() {
    local user_id="$1"
    local key="$2"
    local value="$3"

    if [ -z "$user_id" ] || [ -z "$key" ] || [ -z "$value" ]; then
        log_error "请提供用户ID、偏好键和值"
        return 1
    fi

    log_info "设置用户偏好: $user_id.$key = $value"

    local data=$(cat << EOF
{
    "$key": "$value"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/intelligent-routing/preferences/$user_id" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "用户偏好已更新"
    else
        log_error "设置用户偏好失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 统计信息 ====================

cmd_stats() {
    local subcommand="$1"
    shift

    case $subcommand in
        summary) cmd_stats_summary "$@" ;;
        detailed) cmd_stats_detailed "$@" ;;
        *) cmd_stats_summary "$@" ;;
    esac
}

cmd_stats_summary() {
    log_header "路由统计摘要"

    local response
    if ! response=$(api_request "GET" "/intelligent-routing/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local stats=$(echo "$response" | jq -r '.data')
        echo "📊 总请求数: $(echo "$stats" | jq -r '.totalRequests')"
        echo "⚡ 平均复杂度分析时间: $(printf "%.2f" $(echo "$stats" | jq -r '.avgComplexityAnalysisTime'))ms"
        echo "🎯 平均决策时间: $(printf "%.2f" $(echo "$stats" | jq -r '.avgDecisionTime'))ms"
        echo "💾 缓存命中率: $(printf "%.1f" $(echo "$stats" | jq -r '.cacheHitRate * 100'))%"
        echo "🎲 当前策略: $(echo "$stats" | jq -r '.activeStrategy') ($(echo "$stats" | jq -r '.strategyName'))"
        echo "📦 缓存大小: $(echo "$stats" | jq -r '.cacheSize') 条记录"

        if [ "$(echo "$stats" | jq -r '.decisionStats')" != "null" ]; then
            echo ""
            echo "📈 决策统计 (最近1小时):"
            echo "   总决策数: $(echo "$stats" | jq -r '.decisionStats.totalDecisions')"
            echo "   平均置信度: $(printf "%.2f" $(echo "$stats" | jq -r '.decisionStats.avgConfidence'))"
        fi
    else
        log_error "获取统计信息失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stats_detailed() {
    local time_range="${1:-1h}"

    log_header "详细路由统计 ($time_range)"

    local response
    if ! response=$(api_request "GET" "/intelligent-routing/stats?timeRange=$time_range"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "获取详细统计失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 模型信息 ====================

cmd_models() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_models_list "$@" ;;
        info) cmd_models_info "$@" ;;
        *) cmd_models_list "$@" ;;
    esac
}

cmd_models_list() {
    log_header "可用AI模型"

    local response
    if ! response=$(api_request "GET" "/intelligent-routing/models"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        printf "%-20s %-15s %-8s %-12s %-10s\n" "模型" "提供商" "MaxTokens" "平均响应时间" "成功率"
        echo "--------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data | to_entries[] | "\(.key)\t\(.value.provider)\t\(.value.maxTokens)\t\(.value.avgResponseTime)\t\(.value.successRate)"' | \
        while IFS=$'\t' read -r model provider maxtokens resptime successrate; do
            printf "%-20s %-15s %-8s %-12s %-10s\n" \
                "${model:0:20}" "$provider" "$maxtokens" "${resptime}ms" "$(printf "%.1f" $(echo "$successrate * 100" | bc -l))%"
        done

        local total=$(echo "$response" | jq -r '.data | length')
        log_success "共 $total 个可用模型"
    else
        log_error "获取模型列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_models_info() {
    local model="$1"

    if [ -z "$model" ]; then
        log_error "请提供模型名称"
        return 1
    fi

    log_header "模型详情: $model"

    local response
    if ! response=$(api_request "GET" "/intelligent-routing/models/$model"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
    else
        log_error "获取模型详情失败: $(echo "$response" | jq -r '.error')"
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
    log_header "路由缓存状态"

    local response
    if ! response=$(api_request "GET" "/intelligent-routing/cache"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local cache=$(echo "$response" | jq -r '.data')
        echo "🔧 缓存启用: $(echo "$cache" | jq -r '.enabled')"
        echo "📦 缓存大小: $(echo "$cache" | jq -r '.size') 条记录"
        echo "⏰ 缓存TTL: $(echo "$cache" | jq -r '.ttl') 毫秒"
        echo "🎯 命中率: $(printf "%.1f" $(echo "$cache" | jq -r '.hitRate * 100'))%"
    else
        log_error "获取缓存状态失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_cache_clear() {
    log_info "清除路由缓存..."

    local response
    if ! response=$(api_request "POST" "/intelligent-routing/cache/clear"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "路由缓存已清理: $(echo "$response" | jq -r '.data.clearedEntries') 条记录"
    else
        log_error "清理缓存失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 健康检查 ====================

cmd_health() {
    log_header "智能路由服务健康检查"

    local response
    if ! response=$(api_request "GET" "/intelligent-routing/health"); then
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
        echo "  总请求数: $(echo "$health" | jq -r '.stats.totalRequests')"
        echo "  缓存大小: $(echo "$health" | jq -r '.stats.cacheSize')"
        echo "  当前策略: $(echo "$health" | jq -r '.stats.activeStrategy')"

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
        route) cmd_route "$@" ;;
        analyze) cmd_analyze "$@" ;;
        strategy) cmd_strategy "$@" ;;
        preferences) cmd_preferences "$@" ;;
        stats) cmd_stats "$@" ;;
        models) cmd_models "$@" ;;
        cache) cmd_cache "$@" ;;
        health) cmd_health "$@" ;;
        "") show_help ;;
        *) log_error "未知命令: $command"; show_help; exit 1 ;;
    esac
}

main "$@"
