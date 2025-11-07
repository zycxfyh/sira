#!/bin/bash

# 多语言管理脚本
# 借鉴i18n CLI工具和语言服务平台的优秀设计理念
# 提供直观的多语言管理和翻译服务命令行界面

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOCALES_DIR="$PROJECT_ROOT/locales"
CONFIG_FILE="$PROJECT_ROOT/config/multilingual.json"

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
多语言管理工具 - Sira AI Gateway

USAGE:
    $0 [COMMAND] [SUBCOMMAND] [OPTIONS]

COMMANDS:
    language                    语言管理
    translate                   翻译服务
    preference                  用户偏好管理
    resource                    翻译资源管理
    provider                    翻译提供商管理
    stats                       统计信息
    cache                       缓存管理
    health                      健康检查

LANGUAGE SUBCOMMANDS:
    list                        列出支持的语言
    detect <text>               检测文本语言
    current                     显示当前语言信息

TRANSLATE SUBCOMMANDS:
    text <text> --from <lang> --to <lang> 翻译文本
    batch <file> --from <lang> --to <lang> 批量翻译
    file <input> <output> --from <lang> --to <lang> 翻译文件

PREFERENCE SUBCOMMANDS:
    get <user_id>               获取用户语言偏好
    set <user_id> <language>    设置用户语言偏好

RESOURCE SUBCOMMANDS:
    list <language> <namespace> 列出翻译资源
    add <language> <namespace> <key> <value> 添加翻译资源
    export <language>          导出语言资源
    import <language> <file>   导入语言资源

PROVIDER SUBCOMMANDS:
    list                        列出翻译提供商
    switch <provider>           切换翻译提供商

STATS SUBCOMMANDS:
    summary                     翻译统计摘要
    detailed <time_range>       详细统计 (1h, 24h, 7d)

CACHE SUBCOMMANDS:
    status                      缓存状态
    clear                      清除缓存

OPTIONS:
    -h, --help                  显示帮助信息
    -u, --url URL               指定网关URL (默认: http://localhost:8080)
    -v, --verbose               详细输出
    -o, --output FILE           输出结果到文件
    -f, --format FORMAT         输出格式 (json, table, pretty)
    --from LANG                 源语言
    --to LANG                   目标语言

EXAMPLES:
    $0 language list
    $0 translate text "Hello World" --from en-US --to zh-CN
    $0 preference set user123 zh-CN
    $0 resource add zh-CN common success "成功"
    $0 provider switch openai
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

# ==================== 语言管理 ====================

cmd_language() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_language_list "$@" ;;
        detect) cmd_language_detect "$@" ;;
        current) cmd_language_current "$@" ;;
        *) log_error "未知的语言子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_language_list() {
    log_header "支持的语言列表"

    local response
    if ! response=$(api_request "GET" "/multilingual/languages"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        printf "%-10s %-20s %-15s %-5s %-10s\n" "代码" "名称" "原生名称" "旗帜" "默认"
        echo "--------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data | to_entries[] | "\(.key)\t\(.value.name)\t\(.value.nativeName)\t\(.value.flag)\t\(.value.isDefault)"' | \
        while IFS=$'\t' read -r code name native flag is_default; do
            default_mark=$([ "$is_default" = "true" ] && echo "✓" || echo "")
            printf "%-10s %-20s %-15s %-5s %-10s\n" \
                "${code:0:10}" "${name:0:20}" "${native:0:15}" "$flag" "$default_mark"
        done

        local total=$(echo "$response" | jq -r '.data | length')
        log_success "共支持 $total 种语言"
    else
        log_error "获取语言列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_language_detect() {
    local text="$1"
    shift

    if [ -z "$text" ]; then
        log_error "请提供要检测的文本"
        return 1
    fi

    log_header "语言检测"

    local data=$(cat << EOF
{
    "text": "$text"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/multilingual/detect" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local result=$(echo "$response" | jq -r '.data')
        echo "📝 检测文本: $text"
        echo "🌍 检测语言: $(echo "$result" | jq -r '.language')"
        echo "🎯 置信度: $(echo "$result" | jq -r '.confidence')"
        echo "🔍 检测方法: $(echo "$result" | jq -r '.method')"
        echo "🏳️ 语言信息: $(echo "$result" | jq -r '.languageInfo.name') ($(echo "$result" | jq -r '.languageInfo.flag'))"
    else
        log_error "语言检测失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_language_current() {
    log_header "当前语言信息"

    local response
    if ! response=$(api_request "GET" "/multilingual/current"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
    else
        log_error "获取当前语言信息失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 翻译服务 ====================

cmd_translate() {
    local subcommand="$1"
    shift

    case $subcommand in
        text) cmd_translate_text "$@" ;;
        batch) cmd_translate_batch "$@" ;;
        file) cmd_translate_file "$@" ;;
        *) log_error "未知的翻译子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_translate_text() {
    local text=""
    local from_lang=""
    local to_lang=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --from) from_lang="$2"; shift 2 ;;
            --to) to_lang="$2"; shift 2 ;;
            *) text="$1"; shift ;;
        esac
    done

    if [ -z "$text" ]; then
        log_error "请提供要翻译的文本"
        return 1
    fi

    if [ -z "$to_lang" ]; then
        log_error "请指定目标语言 (--to)"
        return 1
    fi

    log_header "翻译文本"

    local data=$(cat << EOF
{
    "text": "$text",
    "fromLanguage": "$from_lang",
    "toLanguage": "$to_lang"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/multilingual/translate" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local result=$(echo "$response" | jq -r '.data')
        echo "📝 原文: $text"
        echo "🌍 源语言: $(echo "$result" | jq -r '.fromLanguage')"
        echo "🎯 目标语言: $(echo "$result" | jq -r '.toLanguage')"
        echo "📖 译文: $(echo "$result" | jq -r '.translatedText')"
        echo "🤖 提供商: $(echo "$result" | jq -r '.provider')"

        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "翻译失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_translate_batch() {
    local file_path=""
    local from_lang=""
    local to_lang=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --from) from_lang="$2"; shift 2 ;;
            --to) to_lang="$2"; shift 2 ;;
            *) file_path="$1"; shift ;;
        esac
    done

    if [ -z "$file_path" ]; then
        log_error "请提供包含文本列表的文件路径"
        return 1
    fi

    if [ ! -f "$file_path" ]; then
        log_error "文件不存在: $file_path"
        return 1
    fi

    if [ -z "$to_lang" ]; then
        log_error "请指定目标语言 (--to)"
        return 1
    fi

    log_header "批量翻译: $file_path"

    # 读取文本列表
    local texts_json
    if ! texts_json=$(cat "$file_path"); then
        log_error "读取文件失败: $file_path"
        return 1
    fi

    local data=$(cat << EOF
{
    "texts": $texts_json,
    "fromLanguage": "$from_lang",
    "toLanguage": "$to_lang"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/multilingual/translate-batch" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local stats=$(echo "$response" | jq -r '.data.stats')
        log_success "批量翻译完成 - 总计: $(echo "$stats" | jq -r '.total'), 成功: $(echo "$stats" | jq -r '.successful'), 失败: $(echo "$stats" | jq -r '.failed')"

        # 显示翻译结果
        echo "$response" | jq -r '.data.translations[] | select(.success == true) | "✅ \(.originalText) -> \(.translatedText)"'
        echo "$response" | jq -r '.data.translations[] | select(.success == false) | "❌ \(.originalText) -> 失败: \(.error)"'

        save_output "$response" "$OUTPUT_FILE"
    else
        log_error "批量翻译失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_translate_file() {
    local input_file="$1"
    local output_file="$2"
    shift 2

    local from_lang=""
    local to_lang=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --from) from_lang="$2"; shift 2 ;;
            --to) to_lang="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$input_file" ] || [ -z "$output_file" ]; then
        log_error "请提供输入文件和输出文件路径"
        return 1
    fi

    if [ ! -f "$input_file" ]; then
        log_error "输入文件不存在: $input_file"
        return 1
    fi

    if [ -z "$to_lang" ]; then
        log_error "请指定目标语言 (--to)"
        return 1
    fi

    log_header "翻译文件: $input_file -> $output_file"

    # 读取输入文件
    local content
    if ! content=$(cat "$input_file"); then
        log_error "读取输入文件失败: $input_file"
        return 1
    fi

    local data=$(cat << EOF
{
    "text": "$content",
    "fromLanguage": "$from_lang",
    "toLanguage": "$to_lang"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/multilingual/translate" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local translated_text=$(echo "$response" | jq -r '.data.translatedText')

        # 写入输出文件
        echo "$translated_text" > "$output_file"

        log_success "文件翻译完成"
        echo "📁 输入文件: $input_file"
        echo "📁 输出文件: $output_file"
        echo "🌍 源语言: $(echo "$response" | jq -r '.data.fromLanguage')"
        echo "🎯 目标语言: $(echo "$response" | jq -r '.data.toLanguage')"
        echo "🤖 提供商: $(echo "$response" | jq -r '.data.provider')"

        # 显示文件大小对比
        local input_size=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file" 2>/dev/null || echo "0")
        local output_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "0")
        echo "📊 文件大小: ${input_size} -> ${output_size} 字节"
    else
        log_error "文件翻译失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 用户偏好管理 ====================

cmd_preference() {
    local subcommand="$1"
    shift

    case $subcommand in
        get) cmd_preference_get "$@" ;;
        set) cmd_preference_set "$@" ;;
        *) log_error "未知的偏好子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_preference_get() {
    local user_id="$1"

    if [ -z "$user_id" ]; then
        log_error "请提供用户ID"
        return 1
    fi

    log_header "用户语言偏好: $user_id"

    local response
    if ! response=$(api_request "GET" "/multilingual/preferences/$user_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_output "$response" "$FORMAT"
    else
        log_error "获取用户偏好失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_preference_set() {
    local user_id="$1"
    local language="$2"

    if [ -z "$user_id" ] || [ -z "$language" ]; then
        log_error "请提供用户ID和语言代码"
        return 1
    fi

    log_info "设置用户语言偏好: $user_id -> $language"

    local data=$(cat << EOF
{
    "language": "$language"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/multilingual/preferences/$user_id" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "用户语言偏好已设置"
        format_output "$response" "$FORMAT"
    else
        log_error "设置用户偏好失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 翻译资源管理 ====================

cmd_resource() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_resource_list "$@" ;;
        add) cmd_resource_add "$@" ;;
        export) cmd_resource_export "$@" ;;
        import) cmd_resource_import "$@" ;;
        *) log_error "未知的资源子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_resource_list() {
    local language="$1"
    local namespace="${2:-common}"

    if [ -z "$language" ]; then
        log_error "请提供语言代码"
        return 1
    fi

    log_header "翻译资源: $language.$namespace"

    local response
    if ! response=$(api_request "GET" "/multilingual/resources/$language/$namespace"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local resources=$(echo "$response" | jq -r '.data')
        local count=$(echo "$resources" | jq -r 'keys | length')

        if [ "$count" -eq 0 ]; then
            log_info "暂无翻译资源"
        else
            printf "%-30s %-50s\n" "键" "值"
            echo "--------------------------------------------------------------------------------"

            echo "$resources" | jq -r 'to_entries[] | "\(.key)\t\(.value)"' | \
            while IFS=$'\t' read -r key value; do
                printf "%-30s %-50s\n" "${key:0:30}" "${value:0:50}"
            done

            log_success "共 $count 个翻译资源"
        fi
    else
        log_error "获取翻译资源失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_resource_add() {
    local language="$1"
    local namespace="$2"
    local key="$3"
    local value="$4"

    if [ -z "$language" ] || [ -z "$namespace" ] || [ -z "$key" ] || [ -z "$value" ]; then
        log_error "请提供语言代码、命名空间、键和值"
        return 1
    fi

    log_info "添加翻译资源: $language.$namespace.$key = $value"

    local data=$(cat << EOF
{
    "$key": "$value"
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/multilingual/resources/$language/$namespace" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "翻译资源已添加"
    else
        log_error "添加翻译资源失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_resource_export() {
    local language="$1"

    if [ -z "$language" ]; then
        log_error "请提供语言代码"
        return 1
    fi

    local output_file="${OUTPUT_FILE:-${language}_resources.json}"

    log_header "导出翻译资源: $language -> $output_file"

    # 导出所有命名空间的资源
    local all_resources="{}"

    # 获取所有命名空间（这里简化处理，实际应该从API获取）
    for namespace in common auth api validation ai routing training multilingual errors messages; do
        local response
        if response=$(api_request "GET" "/multilingual/resources/$language/$namespace" 2>/dev/null); then
            if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
                local namespace_data=$(echo "$response" | jq -r '.data')
                all_resources=$(echo "$all_resources" | jq --arg ns "$namespace" --argjson data "$namespace_data" '.[$ns] = $data')
            fi
        fi
    done

    echo "$all_resources" > "$output_file"
    log_success "翻译资源已导出到: $output_file"
}

cmd_resource_import() {
    local language="$1"
    local file_path="$2"

    if [ -z "$language" ] || [ -z "$file_path" ]; then
        log_error "请提供语言代码和文件路径"
        return 1
    fi

    if [ ! -f "$file_path" ]; then
        log_error "文件不存在: $file_path"
        return 1
    fi

    log_header "导入翻译资源: $file_path -> $language"

    # 读取资源文件
    local resources
    if ! resources=$(cat "$file_path"); then
        log_error "读取文件失败: $file_path"
        return 1
    fi

    # 遍历所有命名空间并导入
    local imported_count=0
    echo "$resources" | jq -r 'keys[]' | while read -r namespace; do
        local namespace_data=$(echo "$resources" | jq -r --arg ns "$namespace" '.[$ns]')

        local data="$namespace_data"
        local response
        if response=$(api_request "POST" "/multilingual/resources/$language/$namespace" "$data"); then
            if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
                local count=$(echo "$namespace_data" | jq -r 'keys | length')
                imported_count=$((imported_count + count))
                log_success "命名空间 $namespace 导入成功 ($count 个资源)"
            else
                log_error "命名空间 $namespace 导入失败: $(echo "$response" | jq -r '.error')"
            fi
        fi
    done

    log_success "翻译资源导入完成，共导入 $imported_count 个资源"
}

# ==================== 翻译提供商管理 ====================

cmd_provider() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_provider_list "$@" ;;
        switch) cmd_provider_switch "$@" ;;
        *) cmd_provider_list "$@" ;;
    esac
}

cmd_provider_list() {
    log_header "翻译提供商"

    local response
    if ! response=$(api_request "GET" "/multilingual/providers"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        printf "%-15s %-20s %-8s %-10s %-15s\n" "提供商" "名称" "启用" "活跃" "请求限制"
        echo "--------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data | to_entries[] | "\(.key)\t\(.value.name)\t\(.value.enabled)\t\(.value.isActive)\t\(.value.rateLimit)"' | \
        while IFS=$'\t' read -r provider name enabled active rate_limit; do
            enabled_mark=$([ "$enabled" = "true" ] && echo "✓" || echo "✗")
            active_mark=$([ "$active" = "true" ] && echo "✓" || echo "")
            printf "%-15s %-20s %-8s %-10s %-15s\n" \
                "${provider:0:15}" "${name:0:20}" "$enabled_mark" "$active_mark" "$rate_limit"
        done
    else
        log_error "获取提供商列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_provider_switch() {
    local provider="$1"

    if [ -z "$provider" ]; then
        log_error "请指定提供商名称"
        return 1
    fi

    log_info "切换翻译提供商: $provider"

    local response
    if ! response=$(api_request "POST" "/multilingual/providers/$provider/switch"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "翻译提供商已切换"
        echo "$response" | jq -r '.message'
        echo "$response" | jq -r '.data'
    else
        log_error "切换提供商失败: $(echo "$response" | jq -r '.error')"
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
    log_header "翻译统计摘要"

    local response
    if ! response=$(api_request "GET" "/multilingual/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local stats=$(echo "$response" | jq -r '.data')
        echo "📊 总请求数: $(echo "$stats" | jq -r '.totalRequests')"
        echo "💾 缓存命中数: $(echo "$stats" | jq -r '.cacheHits')"
        echo "🌐 API调用数: $(echo "$stats" | jq -r '.apiCalls')"
        echo "⚡ 平均响应时间: $(printf "%.2f" $(echo "$stats" | jq -r '.avgResponseTime'))ms"
        echo "🎯 缓存命中率: $(printf "%.1f" $(echo "$stats" | jq -r '.cacheHitRate * 100'))%"
        echo "🤖 当前提供商: $(echo "$stats" | jq -r '.activeProvider')"
    else
        log_error "获取统计信息失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stats_detailed() {
    local time_range="${1:-1h}"

    log_header "详细翻译统计 ($time_range)"

    local response
    if ! response=$(api_request "GET" "/multilingual/stats?timeRange=$time_range"); then
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
    log_header "翻译缓存状态"

    local response
    if ! response=$(api_request "GET" "/multilingual/cache"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local cache=$(echo "$response" | jq -r '.data')
        echo "🔧 缓存启用: $(echo "$cache" | jq -r '.enabled')"
        echo "📦 缓存大小: $(echo "$cache" | jq -r '.size') 条记录"
        echo "📊 预估内存使用: $(echo "$cache" | jq -r '.estimatedMemoryUsage') 字节"
        echo "🎯 命中率: $(printf "%.1f" $(echo "$cache" | jq -r '.hitRate * 100'))%"
    else
        log_error "获取缓存状态失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_cache_clear() {
    log_info "清除翻译缓存..."

    local response
    if ! response=$(api_request "POST" "/multilingual/cache/clear"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "翻译缓存已清理: $(echo "$response" | jq -r '.data.clearedEntries') 条记录"
    else
        log_error "清理缓存失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 健康检查 ====================

cmd_health() {
    log_header "多语言服务健康检查"

    local response
    if ! response=$(api_request "GET" "/multilingual/health"); then
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
        echo "  请求数: $(echo "$health" | jq -r '.stats.totalRequests')"
        echo "  缓存大小: $(echo "$health" | jq -r '.stats.cacheSize')"
        echo "  当前提供商: $(echo "$health" | jq -r '.stats.activeProvider')"

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
        language) cmd_language "$@" ;;
        translate) cmd_translate "$@" ;;
        preference) cmd_preference "$@" ;;
        resource) cmd_resource "$@" ;;
        provider) cmd_provider "$@" ;;
        stats) cmd_stats "$@" ;;
        cache) cmd_cache "$@" ;;
        health) cmd_health "$@" ;;
        "") show_help ;;
        *) log_error "未知命令: $command"; show_help; exit 1 ;;
    esac
}

main "$@"
