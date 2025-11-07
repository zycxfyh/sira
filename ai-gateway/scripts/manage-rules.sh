#!/bin/bash

# 规则引擎管理脚本
# 借鉴现代CLI工具设计理念，提供直观的命令行界面

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/rules.json"

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
规则引擎管理工具 - Sira AI Gateway

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    list                    列出所有规则
    create                  创建新规则
    show <rule_id>          显示规则详情
    update <rule_id>        更新规则配置
    delete <rule_id>        删除规则
    test <rule_id>          测试规则条件
    execute                 执行规则
    stats [rule_id]         查看规则统计信息
    templates               显示规则模板
    rulesets                管理规则集
    engine-stats            查看引擎统计信息

OPTIONS:
    -h, --help              显示帮助信息
    -u, --url URL           指定网关URL (默认: http://localhost:8080)
    -v, --verbose           详细输出

EXAMPLES:
    $0 list
    $0 create
    $0 show rule_123
    $0 test rule_123 --context '{"user":{"tier":"premium"}}'
    $0 execute --context '{"user":{"id":"user123"}}'
    $0 stats rule_123
    $0 templates

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

# 列出所有规则
cmd_list() {
    local endpoint="/rules"
    local query=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --enabled) query="${query}&enabled=$2"; shift 2 ;;
            --tags) query="${query}&tags=$2"; shift 2 ;;
            --limit) query="${query}&limit=$2"; shift 2 ;;
            --offset) query="${query}&offset=$2"; shift 2 ;;
            *) break ;;
        esac
    done

    [ -n "$query" ] && endpoint="${endpoint}?${query:1}"

    log_header "规则列表"

    local response
    if ! response=$(api_request "GET" "$endpoint"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local rules=$(echo "$response" | jq -r '.data[]')

        if [ -z "$rules" ]; then
            log_info "暂无规则配置"
            return 0
        fi

        printf "%-25s %-40s %-8s %-6s %-10s %-12s\n" "规则ID" "名称" "优先级" "启用" "执行次数" "成功率"
        echo "---------------------------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.name)\t\(.priority)\t\(.enabled)\t\(.executionCount)\t\(.successRate)%"' | \
        while IFS=$'\t' read -r id name priority enabled exec_count success_rate; do
            printf "%-25s %-40s %-8s %-6s %-10s %-12s\n" \
                "${id:0:25}" "${name:0:40}" "$priority" "$enabled" "$exec_count" "$success_rate"
        done

        local total=$(echo "$response" | jq -r '.pagination.total')
        log_success "共 $total 个规则"
    else
        log_error "获取规则列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 创建新规则
cmd_create() {
    log_header "创建规则"

    echo "选择规则模板:"
    echo "1. 智能路由规则 (基于用户等级)"
    echo "2. 速率限制规则 (基于用户类型)"
    echo "3. 成本控制规则 (高成本请求验证)"
    echo "4. 自定义规则"
    read -p "选择模板 (1-4): " template_choice

    local rule_config=""

    case $template_choice in
        1)
            rule_config='{
                "name": "Premium用户智能路由",
                "description": "Premium用户自动路由到GPT-4",
                "priority": 10,
                "conditions": [
                    {
                        "type": "field",
                        "field": "user.tier",
                        "operator": "equals",
                        "value": "premium"
                    }
                ],
                "actions": [
                    {
                        "type": "setField",
                        "params": {
                            "field": "routing.provider",
                            "value": "openai"
                        }
                    }
                ],
                "tags": ["routing", "premium"]
            }'
            ;;
        2)
            rule_config='{
                "name": "免费用户速率限制",
                "description": "免费用户限制每小时10次请求",
                "priority": 5,
                "conditions": [
                    {
                        "type": "field",
                        "field": "user.tier",
                        "operator": "equals",
                        "value": "free"
                    }
                ],
                "actions": [
                    {
                        "type": "modifyRequest",
                        "params": {
                            "modifications": [
                                {
                                    "type": "set",
                                    "field": "rateLimit.requestsPerHour",
                                    "value": 10
                                }
                            ]
                        }
                    }
                ],
                "tags": ["rate-limit", "free-tier"]
            }'
            ;;
        3)
            rule_config='{
                "name": "高成本请求控制",
                "description": "高成本请求需要额外验证",
                "priority": 15,
                "conditions": [
                    {
                        "type": "field",
                        "field": "request.estimatedCost",
                        "operator": "greaterThan",
                        "value": 1.0
                    }
                ],
                "actions": [
                    {
                        "type": "setField",
                        "params": {
                            "field": "request.requiresApproval",
                            "value": true
                        }
                    }
                ],
                "tags": ["cost-control", "approval"]
            }'
            ;;
        4)
            echo "请输入自定义规则配置 (JSON格式):"
            echo "提示: 使用 Ctrl+D 结束输入"
            rule_config=$(cat)
            ;;
        *)
            log_error "无效选择"
            return 1
            ;;
    esac

    log_info "创建规则中..."

    local response
    if ! response=$(api_request "POST" "/rules" "$rule_config"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local rule_id=$(echo "$response" | jq -r '.data.id')
        log_success "规则创建成功: $rule_id"
        format_json "$response"
    else
        log_error "创建规则失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 显示规则详情
cmd_show() {
    local rule_id="$1"

    if [ -z "$rule_id" ]; then
        log_error "请提供规则ID"
        show_help
        return 1
    fi

    log_header "规则详情: $rule_id"

    local response
    if ! response=$(api_request "GET" "/rules/$rule_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取规则详情失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 更新规则
cmd_update() {
    local rule_id="$1"

    if [ -z "$rule_id" ]; then
        log_error "请提供规则ID"
        show_help
        return 1
    fi

    log_header "更新规则: $rule_id"

    echo "输入要更新的字段 (留空保持不变):"

    read -p "新名称: " new_name
    read -p "新描述: " new_description
    read -p "新优先级: " new_priority
    read -p "启用状态 (true/false): " new_enabled

    # 构建更新数据
    local data="{"

    [ -n "$new_name" ] && data="$data\"name\":\"$new_name\","
    [ -n "$new_description" ] && data="$data\"description\":\"$new_description\","
    [ -n "$new_priority" ] && data="$data\"priority\":$new_priority,"
    [ -n "$new_enabled" ] && data="$data\"enabled\":$new_enabled,"

    # 移除末尾逗号
    data="${data%,}}"

    if [ "$data" = "{}" ]; then
        log_warning "没有提供任何更新字段"
        return 0
    fi

    log_info "更新规则中..."

    local response
    if ! response=$(api_request "PUT" "/rules/$rule_id" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "规则更新成功"
        format_json "$response"
    else
        log_error "更新规则失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 删除规则
cmd_delete() {
    local rule_id="$1"

    if [ -z "$rule_id" ]; then
        log_error "请提供规则ID"
        show_help
        return 1
    fi

    read -p "确定要删除规则 $rule_id 吗? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "操作已取消"
        return 0
    fi

    log_info "删除规则: $rule_id"

    local response
    if ! response=$(api_request "DELETE" "/rules/$rule_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "规则删除成功"
    else
        log_error "删除规则失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 测试规则
cmd_test() {
    local rule_id="$1"
    shift
    local context="{}"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --context) context="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$rule_id" ]; then
        log_error "请提供规则ID"
        show_help
        return 1
    fi

    log_header "测试规则: $rule_id"

    local data="{\"context\":$context}"

    local response
    if ! response=$(api_request "POST" "/rules/$rule_id/test" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "测试规则失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 执行规则
cmd_execute() {
    local rule_set_id=""
    local context="{}"
    local max_results="10"
    local dry_run="false"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --rule-set) rule_set_id="$2"; shift 2 ;;
            --context) context="$2"; shift 2 ;;
            --max-results) max_results="$2"; shift 2 ;;
            --dry-run) dry_run="true"; shift ;;
            *) break ;;
        esac
    done

    log_header "执行规则"

    local data="{
        \"context\": $context,
        \"options\": {
            \"maxResults\": $max_results,
            \"dryRun\": $dry_run
        }
    }"

    [ -n "$rule_set_id" ] && data=$(echo "$data" | jq ".options.ruleSetId = \"$rule_set_id\"")

    local response
    if ! response=$(api_request "POST" "/rules/execute" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "执行规则失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 查看统计信息
cmd_stats() {
    local rule_id="$1"

    log_header "规则统计信息"

    local endpoint="/rules/stats"
    [ -n "$rule_id" ] && endpoint="$endpoint/$rule_id"

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

# 显示规则模板
cmd_templates() {
    log_header "规则模板"

    local response
    if ! response=$(api_request "GET" "/rules/templates"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取规则模板失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 引擎统计信息
cmd_engine_stats() {
    log_header "规则引擎统计信息"

    local response
    if ! response=$(api_request "GET" "/rules/engine/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取引擎统计失败: $(echo "$response" | jq -r '.error')"
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
        execute) cmd_execute "$@" ;;
        stats) cmd_stats "$@" ;;
        templates) cmd_templates "$@" ;;
        engine-stats) cmd_engine_stats "$@" ;;
        "") show_help ;;
        *) log_error "未知命令: $command"; show_help; exit 1 ;;
    esac
}

main "$@"
