#!/bin/bash

# Sira AI网关 - API密钥管理脚本
# 管理API密钥的添加、轮换、权限控制和使用监控

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

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/api-keys" > /dev/null; then
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
    elif [ "$method" = "PUT" ]; then
        curl -s -X PUT "$url" \
            -H "Content-Type: application/json" \
            -d "$data"
    elif [ "$method" = "DELETE" ]; then
        curl -s -X DELETE "$url"
    fi
}

# 显示API密钥概览
show_overview() {
    log_header "🔑 API密钥概览"

    local response
    response=$(api_request "GET" "api-keys")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取API密钥概览失败"
        return 1
    fi

    local overview
    overview=$(echo "$response" | jq -r '.data')

    echo "📊 全局统计:"
    echo "  总供应商数: $(echo "$overview" | jq -r '.providers | length')"
    echo "  总密钥数: $(echo "$overview" | jq -r '.totalKeys')"
    echo "  活跃密钥数: $(echo "$overview" | jq -r '.activeKeys')"
    echo "  禁用密钥数: $(echo "$overview" | jq -r '.disabledKeys')"
    echo "  总请求数: $(echo "$overview" | jq -r '.totalRequests')"
    echo "  总Token数: $(echo "$overview" | jq -r '.totalTokens')"
    echo "  总成本: $(printf "%.4f" $(echo "$overview" | jq -r '.totalCost'))"
    echo ""

    echo "🏢 供应商详情:"
    echo "$overview" | jq -r '.providers | to_entries[] | "  \(.key):\n    密钥数: \(.value.totalKeys) (活跃: \(.value.activeKeys), 禁用: \(.value.disabledKeys))\n    请求数: \(.value.totalRequests)\n    Token数: \(.value.totalTokens)\n    成本: \(.value.totalCost)\n"'
}

# 显示供应商密钥
show_provider_keys() {
    log_header "🔑 供应商API密钥"

    echo -n "请输入供应商名称 (openai/anthropic/deepseek/qwen等): "
    read -r provider

    if [ -z "$provider" ]; then
        log_error "供应商名称不能为空"
        return 1
    fi

    local response
    response=$(api_request "GET" "api-keys/providers/$provider")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取供应商密钥失败"
        return 1
    fi

    local data
    data=$(echo "$response" | jq -r '.data')

    echo "供应商: $provider"
    echo "密钥数量: $(echo "$data" | jq -r '.count')"
    echo ""

    if [ "$(echo "$data" | jq -r '.count')" -eq 0 ]; then
        log_warn "该供应商暂无API密钥"
        return 0
    fi

    echo "$data" | jq -r '.keys[] | "🔑 \(.name) (\(.id)))\n   状态: \(.usage ? "正常" : "未使用")\n   请求数: \(.usage.totalRequests // 0)\n   Token数: \(.usage.totalTokens // 0)\n   最后使用: \(.usage.lastUsed // "从未使用")\n   权限: \(.permissions | join(", "))\n"'
}

# 添加API密钥
add_api_key() {
    log_header "➕ 添加API密钥"

    echo -n "供应商名称: "
    read -r provider

    echo -n "API密钥: "
    read -r api_key

    echo -n "密钥名称 (可选): "
    read -r key_name

    echo -n "描述 (可选): "
    read -r description

    if [ -z "$provider" ] || [ -z "$api_key" ]; then
        log_error "供应商名称和API密钥都是必需的"
        return 1
    fi

    # 构建请求数据
    local request_data="{
        \"provider\": \"$provider\",
        \"key\": \"$api_key\""

    if [ -n "$key_name" ]; then
        request_data="$request_data, \"name\": \"$key_name\""
    fi

    if [ -n "$description" ]; then
        request_data="$request_data, \"description\": \"$description\""
    fi

    request_data="$request_data}"

    local response
    response=$(api_request "POST" "api-keys" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "添加API密钥失败"
        return 1
    fi

    local key_id
    key_id=$(echo "$response" | jq -r '.data.keyId')

    log_success "✅ API密钥添加成功!"
    echo "密钥ID: $key_id"
    echo "供应商: $provider"
}

# 查看密钥详情
view_key_details() {
    log_header "📋 API密钥详情"

    echo -n "供应商名称: "
    read -r provider

    echo -n "密钥ID: "
    read -r key_id

    if [ -z "$provider" ] || [ -z "$key_id" ]; then
        log_error "供应商名称和密钥ID都是必需的"
        return 1
    fi

    local response
    response=$(api_request "GET" "api-keys/$provider/$key_id")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取API密钥详情失败"
        return 1
    fi

    local data
    data=$(echo "$response" | jq -r '.data')

    echo "供应商: $provider"
    echo "密钥ID: $key_id"
    echo "名称: $(echo "$data" | jq -r '.key.name')"
    echo "状态: $(echo "$data" | jq -r '.key.status')"
    echo "权限: $(echo "$data" | jq -r '.key.permissions | join(", ")')"
    echo "创建时间: $(echo "$data" | jq -r '.key.metadata.createdAt')"
    echo "描述: $(echo "$data" | jq -r '.key.metadata.description // "无"')"
    echo ""

    # 获取使用统计
    local usage_response
    usage_response=$(api_request "GET" "api-keys/$provider/$key_id/usage")

    if echo "$usage_response" | jq -e '.success' >/dev/null 2>&1; then
        local usage
        usage=$(echo "$usage_response" | jq -r '.data.usage')

        echo "📊 使用统计:"
        echo "  总请求数: $(echo "$usage" | jq -r '.totalRequests')"
        echo "  总Token数: $(echo "$usage" | jq -r '.totalTokens')"
        echo "  总成本: $(printf "%.4f" $(echo "$usage" | jq -r '.totalCost'))"
        echo "  最后使用: $(echo "$usage" | jq -r '.lastUsed // "从未使用"')"
        echo ""

        echo "📈 当前使用情况:"
        echo "  本分钟请求: $(echo "$usage" | jq -r '.currentMinuteRequests.requests')"
        echo "  本小时请求: $(echo "$usage" | jq -r '.currentHourRequests.requests')"
        echo "  今日请求: $(echo "$usage" | jq -r '.currentDayRequests.requests')"
    fi
}

# 轮换API密钥
rotate_api_key() {
    log_header "🔄 轮换API密钥"

    echo -n "供应商名称: "
    read -r provider

    echo -n "密钥ID: "
    read -r key_id

    echo -n "新的API密钥: "
    read -r new_key

    if [ -z "$provider" ] || [ -z "$key_id" ] || [ -z "$new_key" ]; then
        log_error "供应商名称、密钥ID和新API密钥都是必需的"
        return 1
    fi

    local request_data="{
        \"newKey\": \"$new_key\"
    }"

    local response
    response=$(api_request "PUT" "api-keys/$provider/$key_id/rotate" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "轮换API密钥失败"
        return 1
    fi

    log_success "✅ API密钥轮换成功!"
    echo "供应商: $provider"
    echo "密钥ID: $key_id"
    echo "下次轮换: $(echo "$response" | jq -r '.data.nextRotation')"
}

# 禁用API密钥
disable_api_key() {
    log_header "🚫 禁用API密钥"

    echo -n "供应商名称: "
    read -r provider

    echo -n "密钥ID: "
    read -r key_id

    echo -n "禁用原因 (可选): "
    read -r reason

    if [ -z "$provider" ] || [ -z "$key_id" ]; then
        log_error "供应商名称和密钥ID都是必需的"
        return 1
    fi

    local request_data="{}"
    if [ -n "$reason" ]; then
        request_data="{\"reason\": \"$reason\"}"
    fi

    local response
    response=$(api_request "PUT" "api-keys/$provider/$key_id/disable" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "禁用API密钥失败"
        return 1
    fi

    log_success "✅ API密钥已禁用!"
    echo "供应商: $provider"
    echo "密钥ID: $key_id"
}

# 启用API密钥
enable_api_key() {
    log_header "✅ 启用API密钥"

    echo -n "供应商名称: "
    read -r provider

    echo -n "密钥ID: "
    read -r key_id

    if [ -z "$provider" ] || [ -z "$key_id" ]; then
        log_error "供应商名称和密钥ID都是必需的"
        return 1
    fi

    local response
    response=$(api_request "PUT" "api-keys/$provider/$key_id/enable")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "启用API密钥失败"
        return 1
    fi

    log_success "✅ API密钥已启用!"
    echo "供应商: $provider"
    echo "密钥ID: $key_id"
}

# 删除API密钥
delete_api_key() {
    log_header "🗑️ 删除API密钥"

    echo -n "供应商名称: "
    read -r provider

    echo -n "密钥ID: "
    read -r key_id

    if [ -z "$provider" ] || [ -z "$key_id" ]; then
        log_error "供应商名称和密钥ID都是必需的"
        return 1
    fi

    echo -n "确认删除API密钥 $provider/$key_id? (y/N): "
    read -r confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "取消删除操作"
        return 0
    fi

    local response
    response=$(api_request "DELETE" "api-keys/$provider/$key_id")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "删除API密钥失败"
        return 1
    fi

    log_success "✅ API密钥已删除!"
    echo "供应商: $provider"
    echo "密钥ID: $key_id"
}

# 选择最佳密钥
select_best_key() {
    log_header "🎯 选择最佳API密钥"

    echo -n "供应商名称: "
    read -r provider

    echo -n "用户ID (可选): "
    read -r user_id

    echo -n "所需权限 (用逗号分隔，默认: read,write): "
    read -r permissions

    echo -n "选择策略 (least_used/random/round_robin，默认: least_used): "
    read -r strategy

    if [ -z "$provider" ]; then
        log_error "供应商名称是必需的"
        return 1
    fi

    permissions=${permissions:-"read,write"}
    strategy=${strategy:-"least_used"}

    local query="strategy=$strategy"
    if [ -n "$user_id" ]; then
        query="$query&userId=$user_id"
    fi
    if [ -n "$permissions" ]; then
        query="$query&permissions=$permissions"
    fi

    local response
    response=$(api_request "GET" "api-keys/select/$provider?$query")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "选择最佳API密钥失败"
        return 1
    fi

    local data
    data=$(echo "$response" | jq -r '.data')

    log_success "✅ 已选择最佳API密钥!"

    echo "供应商: $provider"
    echo "选择策略: $(echo "$data" | jq -r '.strategy')"
    echo ""
    echo "🎯 选中的密钥:"
    echo "  ID: $(echo "$data" | jq -r '.selectedKey.id')"
    echo "  名称: $(echo "$data" | jq -r '.selectedKey.name')"
    echo ""
    echo "📊 使用统计:"
    echo "  总请求数: $(echo "$data" | jq -r '.selectedKey.usage.totalRequests')"
    echo "  总Token数: $(echo "$data" | jq -r '.selectedKey.usage.totalTokens')"
    echo "  最后使用: $(echo "$data" | jq -r '.selectedKey.usage.lastUsed // "从未使用"')"
}

# 设置用户权限
set_user_permissions() {
    log_header "👤 设置用户权限"

    echo -n "用户ID: "
    read -r user_id

    echo -n "供应商权限 (用逗号分隔，如: openai,anthropic): "
    read -r providers

    echo -n "密钥权限 (用逗号分隔，如: key_123,key_456): "
    read -r keys

    if [ -z "$user_id" ]; then
        log_error "用户ID是必需的"
        return 1
    fi

    local permissions="{}"

    if [ -n "$providers" ]; then
        permissions="{\"providers\": [\"$(echo "$providers" | sed 's/,/","/g')\"]"
    fi

    if [ -n "$keys" ]; then
        if [ "$permissions" != "{}" ]; then
            permissions="${permissions%}}"
            permissions="$permissions,"
        fi
        permissions="$permissions\"keys\": [\"$(echo "$keys" | sed 's/,/","/g')\"]}"
    fi

    local request_data="{
        \"userId\": \"$user_id\",
        \"permissions\": $permissions
    }"

    local response
    response=$(api_request "POST" "api-keys/permissions" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "设置用户权限失败"
        return 1
    fi

    log_success "✅ 用户权限设置成功!"
    echo "用户ID: $user_id"
    echo "权限: $permissions"
}

# 导出配置
export_config() {
    log_header "📤 导出API密钥配置"

    echo -n "是否包含密钥数据? (y/N): "
    read -r include_keys

    local include_keys_flag="false"
    if [[ "$include_keys" =~ ^[Yy]$ ]]; then
        include_keys_flag="true"
    fi

    local request_data="{
        \"includeKeys\": $include_keys_flag
    }"

    local response
    response=$(api_request "POST" "api-keys/export" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "导出配置失败"
        return 1
    fi

    local config
    config=$(echo "$response" | jq -r '.data.config')

    local filename="api_keys_config_$(date +%Y%m%d_%H%M%S).json"
    echo "$config" > "$filename"

    log_success "✅ 配置已导出: $filename"

    if [ "$include_keys_flag" = "true" ]; then
        log_warn "⚠️ 导出的配置包含敏感的API密钥数据，请妥善保管!"
    fi
}

# 显示使用示例
show_examples() {
    log_header "💡 使用示例"

    cat << 'EOF'
🔥 热门使用场景:

1. 🚀 快速添加API密钥
   curl -X POST http://localhost:9876/api-keys \
     -H "Content-Type: application/json" \
     -d '{
       "provider": "openai",
       "key": "sk-your-openai-key",
       "name": "OpenAI Production Key"
     }'

2. 📊 查看密钥使用情况
   curl http://localhost:9876/api-keys/openai/key_123/usage

3. 🔄 轮换过期密钥
   curl -X PUT http://localhost:9876/api-keys/openai/key_123/rotate \
     -H "Content-Type: application/json" \
     -d '{
       "newKey": "sk-new-openai-key",
       "name": "OpenAI New Key"
     }'

4. 🎯 选择最佳密钥
   curl "http://localhost:9876/api-keys/select/openai?userId=user_123&strategy=least_used"

5. 🚫 临时禁用密钥
   curl -X PUT http://localhost:9876/api-keys/openai/key_123/disable \
     -H "Content-Type: application/json" \
     -d '{"reason": "Rate limit exceeded"}'

6. 👤 设置用户权限
   curl -X POST http://localhost:9876/api-keys/permissions \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "user_123",
       "permissions": {
         "providers": ["openai", "anthropic"],
         "keys": ["key_123", "key_456"]
       }
     }'

✨ 高级用法:

7. 📤 导出配置 (不含密钥)
   curl -X POST http://localhost:9876/api-keys/export \
     -H "Content-Type: application/json" \
     -d '{"includeKeys": false}'

8. 📊 获取全局概览
   curl http://localhost:9876/api-keys

9. 🔍 查看供应商密钥
   curl http://localhost:9876/api-keys/providers/openai

10. 🗑️ 删除不需要的密钥
    curl -X DELETE http://localhost:9876/api-keys/openai/key_123

🔐 安全建议:
• 定期轮换API密钥
• 使用最小权限原则
• 监控密钥使用情况
• 及时禁用泄露的密钥
• 定期审查用户权限

EOF
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - API密钥管理脚本

用法:
    ./manage-api-keys.sh [选项]

选项:
    -o, --overview     显示API密钥概览
    -p, --provider     显示供应商密钥列表
    -a, --add          添加新的API密钥
    -v, --view         查看API密钥详情
    -r, --rotate       轮换API密钥
    -d, --disable      禁用API密钥
    -e, --enable       启用API密钥
    -x, --delete       删除API密钥
    -s, --select       选择最佳API密钥
    -u, --permissions  设置用户权限
    -t, --export       导出配置
    -m, --examples     显示使用示例
    -h, --help         显示此帮助信息

快速开始:
    # 查看所有密钥概览
    ./manage-api-keys.sh --overview

    # 添加新的API密钥
    ./manage-api-keys.sh --add

    # 查看使用示例
    ./manage-api-keys.sh --examples

示例:
    # 显示API密钥概览
    ./manage-api-keys.sh --overview

    # 显示OpenAI密钥列表
    ./manage-api-keys.sh --provider

    # 添加新的API密钥
    ./manage-api-keys.sh --add

    # 查看密钥详情和使用情况
    ./manage-api-keys.sh --view

    # 轮换过期的密钥
    ./manage-api-keys.sh --rotate

    # 禁用有问题的密钥
    ./manage-api-keys.sh --disable

    # 选择最佳可用密钥
    ./manage-api-keys.sh --select

    # 设置用户访问权限
    ./manage-api-keys.sh --permissions

环境变量:
    ADMIN_HOST       管理API主机 (默认: localhost)
    ADMIN_PORT       管理API端口 (默认: 9876)

安全注意事项:
    • API密钥会进行加密存储
    • 支持用户权限控制
    • 提供密钥轮换机制
    • 监控使用量和速率限制

EOF
}

# 主函数
main() {
    log_header "🔐 Sira AI网关 - API密钥管理工具"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 参数处理
    case "${1:-}" in
        -o|--overview)
            show_overview
            ;;
        -p|--provider)
            show_provider_keys
            ;;
        -a|--add)
            add_api_key
            ;;
        -v|--view)
            view_key_details
            ;;
        -r|--rotate)
            rotate_api_key
            ;;
        -d|--disable)
            disable_api_key
            ;;
        -e|--enable)
            enable_api_key
            ;;
        -x|--delete)
            delete_api_key
            ;;
        -s|--select)
            select_best_key
            ;;
        -u|--permissions)
            set_user_permissions
            ;;
        -t|--export)
            export_config
            ;;
        -m|--examples)
            show_examples
            ;;
        -h|--help|*)
            show_help
            ;;
    esac

    log_success "🎉 API密钥管理任务完成"
}

# 执行主函数
main "$@"
