#!/bin/bash

# Sira AI网关 - 对话管理脚本
# 借鉴Redis设计理念，管理对话历史和上下文

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

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/conversations/health" > /dev/null; then
        log_error "网关服务未运行或不可访问 (http://$ADMIN_HOST:$ADMIN_HOST)"
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

# 显示对话统计
show_stats() {
    log_header "📊 对话统计信息"

    local response
    response=$(api_request "GET" "conversations/stats")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取统计失败"
        return 1
    fi

    local stats
    stats=$(echo "$response" | jq -r '.data.stats')

    echo "💬 对话统计:"
    echo "  总会话数: $(echo "$stats" | jq -r '.totalSessions')"
    echo "  活跃会话数: $(echo "$stats" | jq -r '.activeSessionsCount')"
    echo "  归档会话数: $(echo "$stats" | jq -r '.archivedSessionsCount')"
    echo "  删除会话数: $(echo "$stats" | jq -r '.deletedSessionsCount')"
    echo ""
    echo "📝 消息统计:"
    echo "  总消息数: $(echo "$stats" | jq -r '.totalMessages')"
    echo "  总Token数: $(echo "$stats" | jq -r '.totalTokens')"
    echo "  平均每会话消息数: $(echo "$stats" | jq -r '.avgMessagesPerSession')"
    echo "  平均每会话Token数: $(echo "$stats" | jq -r '.avgTokensPerSession')"
}

# 创建新会话
create_session() {
    log_header "🆕 创建新对话会话"

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "会话标题 (默认: 新对话): "
    read -r title
    title=${title:-"新对话"}

    echo -n "上下文窗口大小 (默认: 20): "
    read -r context_window
    context_window=${context_window:-20}

    local request_data="{
        \"userId\": \"$user_id\",
        \"title\": \"$title\",
        \"contextWindow\": $context_window
    }"

    local response
    response=$(api_request "POST" "conversations" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "创建会话失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local session
    session=$(echo "$response" | jq -r '.data.session')

    log_success "✅ 对话会话创建成功!"
    echo "会话ID: $(echo "$session" | jq -r '.id')"
    echo "标题: $(echo "$session" | jq -r '.title')"
    echo "用户: $(echo "$session" | jq -r '.userId')"
    echo "创建时间: $(echo "$session" | jq -r '.createdAt')"
}

# 列出用户会话
list_sessions() {
    log_header "📋 用户对话会话列表"

    echo -n "用户ID: "
    read -r user_id

    echo -n "会话状态 (active/archived/deleted，默认: active): "
    read -r status
    status=${status:-"active"}

    echo -n "显示数量 (默认: 10): "
    read -r limit
    limit=${limit:-10}

    if [ -z "$user_id" ]; then
        log_error "用户ID是必需的"
        return 1
    fi

    local response
    response=$(api_request "GET" "conversations/$user_id?status=$status&limit=$limit")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取会话列表失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local sessions total
    sessions=$(echo "$response" | jq -r '.data.sessions[]')
    total=$(echo "$response" | jq -r '.data.total')

    echo "用户 $user_id 的 $status 会话 (共 $total 个，会话显示前 $limit 个):"
    echo ""

    if [ "$(echo "$sessions" | wc -l)" -eq 0 ]; then
        echo "暂无会话记录"
        return
    fi

    echo "$sessions" | jq -r '"📝 \(.title) (ID: \(.id))
  消息数: \(.messageCount) | Token数: \(.totalTokens)
  创建时间: \(.createdAt) | 最后活动: \(.lastActivity)
"' | sed 's/^/  /'

    echo ""
    echo "💡 提示: 使用 'view-session' 查看详细内容"
}

# 查看会话详情
view_session() {
    log_header "👀 查看会话详情"

    echo -n "会话ID: "
    read -r session_id

    if [ -z "$session_id" ]; then
        log_error "会话ID是必需的"
        return 1
    fi

    local response
    response=$(api_request "GET" "conversations/session/$session_id")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取会话详情失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local session
    session=$(echo "$response" | jq -r '.data.session')

    echo "会话详情:"
    echo "ID: $(echo "$session" | jq -r '.id')"
    echo "标题: $(echo "$session" | jq -r '.title')"
    echo "用户: $(echo "$session" | jq -r '.userId')"
    echo "状态: $(echo "$session" | jq -r '.status')"
    echo "创建时间: $(echo "$session" | jq -r '.createdAt')"
    echo "最后活动: $(echo "$session" | jq -r '.lastActivity')"
    echo "消息总数: $(echo "$session" | jq -r '.messageCount')"
    echo ""

    echo "📊 统计信息:"
    echo "  用户消息: $(echo "$session" | jq -r '.stats.userMessages')"
    echo "  助手消息: $(echo "$session" | jq -r '.stats.assistantMessages')"
    echo "  总Token数: $(echo "$session" | jq -r '.stats.totalTokens')"
    echo "  错误次数: $(echo "$session" | jq -r '.stats.errorCount')"
    echo ""

    if [ "$(echo "$session" | jq -r '.summary')" != "null" ]; then
        echo "📝 会话摘要:"
        echo "$(echo "$session" | jq -r '.summary')"
        echo ""
    fi

    if [ "$(echo "$session" | jq -r '.topics | length')" -gt 0 ]; then
        echo "🏷️  对话主题:"
        echo "$session" | jq -r '.topics[]' | sed 's/^/  • /'
        echo ""
    fi
}

# 添加消息到会话
add_message() {
    log_header "💬 添加消息到会话"

    echo -n "会话ID: "
    read -r session_id

    echo -n "消息角色 (user/assistant/system): "
    read -r role

    echo -n "重要程度 (low/medium/high/critical，默认: medium): "
    read -r importance
    importance=${importance:-"medium"}

    echo "请输入消息内容 (输入空行结束):"
    local content=""
    local line
    while IFS= read -r line; do
        if [ -z "$line" ]; then
            break
        fi
        content="$content$line\n"
    done

    content=$(echo -e "$content" | sed '/^$/d') # 移除空行

    if [ -z "$session_id" ] || [ -z "$role" ] || [ -z "$content" ]; then
        log_error "会话ID、消息角色和内容都是必需的"
        return 1
    fi

    if [[ ! "$role" =~ ^(user|assistant|system)$ ]]; then
        log_error "无效的消息角色"
        return 1
    fi

    local request_data="{
        \"role\": \"$role\",
        \"content\": $(echo "$content" | jq -R -s '.'),
        \"importance\": \"$importance\"
    }"

    local response
    response=$(api_request "POST" "conversations/session/$session_id/messages" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "添加消息失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local message
    message=$(echo "$response" | jq -r '.data.message')

    log_success "✅ 消息添加成功!"
    echo "消息ID: $(echo "$message" | jq -r '.id')"
    echo "角色: $(echo "$message" | jq -r '.role')"
    echo "Token数: $(echo "$message" | jq -r '.tokens')"
    echo "时间: $(echo "$message" | jq -r '.timestamp')"
}

# 查看会话消息历史
view_messages() {
    log_header "📜 查看会话消息历史"

    echo -n "会话ID: "
    read -r session_id

    echo -n "显示数量 (默认: 20): "
    read -r limit
    limit=${limit:-20}

    echo -n "消息角色过滤 (user/assistant/system，可选): "
    read -r role_filter

    if [ -z "$session_id" ]; then
        log_error "会话ID是必需的"
        return 1
    fi

    local query="limit=$limit"
    if [ -n "$role_filter" ]; then
        query="$query&role=$role_filter"
    fi

    local response
    response=$(api_request "GET" "conversations/session/$session_id/messages?$query")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取消息历史失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local messages total
    messages=$(echo "$response" | jq -r '.data.messages[]')
    total=$(echo "$response" | jq -r '.data.total')

    echo "会话 $session_id 的消息历史 (共 $total 条消息，显示最近 $limit 条):"
    echo ""

    if [ "$(echo "$messages" | wc -l)" -eq 0 ]; then
        echo "暂无消息记录"
        return
    fi

    echo "$messages" | jq -r '"\(.timestamp[:19] | sub("T"; " ")) [\(.role)] \(.content | if length > 100 then .[0:100] + \"...\" else . end)"' | sed 's/^/  /'

    echo ""
    echo "📊 统计:"
    local user_count assistant_count system_count
    user_count=$(echo "$messages" | jq -r 'select(.role == "user") | .id' | wc -l)
    assistant_count=$(echo "$messages" | jq -r 'select(.role == "assistant") | .id' | wc -l)
    system_count=$(echo "$messages" | jq -r 'select(.role == "system") | .id' | wc -l)

    echo "  用户消息: $user_count 条"
    echo "  助手消息: $assistant_count 条"
    echo "  系统消息: $system_count 条"
}

# 获取会话上下文
get_context() {
    log_header "🧠 获取会话上下文"

    echo -n "会话ID: "
    read -r session_id

    echo -n "上下文大小 (默认: 自动): "
    read -r context_limit

    if [ -z "$session_id" ]; then
        log_error "会话ID是必需的"
        return 1
    fi

    local query=""
    if [ -n "$context_limit" ]; then
        query="limit=$context_limit"
    fi

    local response
    response=$(api_request "GET" "conversations/session/$session_id/context?$query")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取上下文失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local context_messages context_size
    context_messages=$(echo "$response" | jq -r '.data.context[]')
    context_size=$(echo "$response" | jq -r '.data.contextSize')

    echo "会话 $session_id 的上下文 (共 $context_size 条消息):"
    echo ""

    echo "$context_messages" | jq -r '"[\(.role)] \(.content | if length > 80 then .[0:80] + \"...\" else . end)\(if .isSummary then \" (摘要)\" elif .isMemory then \" (记忆)\" else \"\" end)"' | sed 's/^/  /'

    echo ""
    echo "💡 提示: 上下文消息已按相关性排序，包含摘要和记忆信息"
}

# 搜索会话
search_sessions() {
    log_header "🔍 搜索对话会话"

    echo -n "用户ID: "
    read -r user_id

    echo -n "搜索关键词 (标题或内容关键词): "
    read -r query

    echo -n "会话状态 (active/archived，默认: active): "
    read -r status
    status=${status:-"active"}

    echo -n "显示数量 (默认: 10): "
    read -r limit
    limit=${limit:-10}

    if [ -z "$user_id" ] || [ -z "$query" ]; then
        log_error "用户ID和搜索关键词都是必需的"
        return 1
    fi

    local response
    response=$(api_request "GET" "conversations/$user_id/search?q=$query&status=$status&limit=$limit")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "搜索会话失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local sessions total search_query
    sessions=$(echo "$response" | jq -r '.data.sessions[]')
    total=$(echo "$response" | jq -r '.data.total')
    search_query=$(echo "$response" | jq -r '.data.query')

    echo "搜索结果 - 关键词: \"$search_query\" (共找到 $total 个会话):"
    echo ""

    if [ "$(echo "$sessions" | wc -l)" -eq 0 ]; then
        echo "未找到匹配的会话"
        return
    fi

    echo "$sessions" | jq -r '"📝 \(.title) (ID: \(.id))
  消息数: \(.messageCount) | 创建时间: \(.createdAt[:10])
"' | sed 's/^/  /'
}

# 更新会话信息
update_session() {
    log_header "✏️ 更新会话信息"

    echo -n "会话ID: "
    read -r session_id

    echo -n "新标题 (可选): "
    read -r new_title

    echo -n "新状态 (active/archived，可选): "
    read -r new_status

    if [ -z "$session_id" ]; then
        log_error "会话ID是必需的"
        return 1
    fi

    if [ -z "$new_title" ] && [ -z "$new_status" ]; then
        log_error "至少需要提供一个更新字段"
        return 1
    fi

    local request_data="{"

    if [ -n "$new_title" ]; then
        request_data="$request_data\"title\": \"$new_title\""
    fi

    if [ -n "$new_title" ] && [ -n "$new_status" ]; then
        request_data="$request_data, "
    fi

    if [ -n "$new_status" ]; then
        request_data="$request_data\"status\": \"$new_status\""
    fi

    request_data="$request_data}"

    local response
    response=$(api_request "PUT" "conversations/session/$session_id" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "更新会话失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    log_success "✅ 会话更新成功!"
    local session
    session=$(echo "$response" | jq -r '.data.session')
    echo "标题: $(echo "$session" | jq -r '.title')"
    echo "状态: $(echo "$session" | jq -r '.status')"
    echo "更新时间: $(echo "$session" | jq -r '.updatedAt')"
}

# 删除会话
delete_session() {
    log_header "🗑️ 删除对话会话"

    echo -n "会话ID: "
    read -r session_id

    echo -n "确认删除？(yes/no): "
    read -r confirm

    if [ "$confirm" != "yes" ]; then
        log_info "操作已取消"
        return
    fi

    if [ -z "$session_id" ]; then
        log_error "会话ID是必需的"
        return 1
    fi

    local response
    response=$(api_request "DELETE" "conversations/session/$session_id")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "删除会话失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    log_success "✅ 会话删除成功!"
}

# 导出会话数据
export_session() {
    log_header "💾 导出会话数据"

    echo -n "会话ID: "
    read -r session_id

    echo -n "导出格式 (json，默认: json): "
    read -r format
    format=${format:-"json"}

    echo -n "输出文件名 (默认: conversation-{session_id}.json): "
    read -r filename
    filename=${filename:-"conversation-$session_id.$format"}

    if [ -z "$session_id" ]; then
        log_error "会话ID是必需的"
        return 1
    fi

    log_info "正在导出会话数据..."

    local response
    response=$(api_request "GET" "conversations/session/$session_id/export?format=$format")

    if [ -z "$response" ]; then
        log_error "导出失败，响应为空"
        return 1
    fi

    echo "$response" > "$filename"

    log_success "✅ 会话数据已导出到 $filename"
    echo "文件大小: $(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null) bytes"
}

# 获取用户概览
user_overview() {
    log_header "👤 用户对话概览"

    echo -n "用户ID: "
    read -r user_id

    if [ -z "$user_id" ]; then
        log_error "用户ID是必需的"
        return 1
    fi

    local response
    response=$(api_request "GET" "conversations/$user_id/overview")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取用户概览失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local overview recent_sessions
    overview=$(echo "$response" | jq -r '.data.overview')
    recent_sessions=$(echo "$response" | jq -r '.data.recentSessions[]')

    echo "用户 $user_id 的对话概览:"
    echo ""

    echo "📊 统计信息:"
    echo "  总会话数: $(echo "$overview" | jq -r '.totalSessions')"
    echo "  总消息数: $(echo "$overview" | jq -r '.totalMessages')"
    echo "  总Token数: $(echo "$overview" | jq -r '.totalTokens')"
    echo "  平均每会话消息数: $(echo "$overview" | jq -r '.avgMessagesPerSession')"
    echo "  平均每会话Token数: $(echo "$overview" | jq -r '.avgTokensPerSession')"
    echo ""

    local most_active
    most_active=$(echo "$overview" | jq -r '.mostActiveSession')
    if [ "$most_active" != "null" ]; then
        echo "🏆 最活跃会话:"
        echo "  ID: $(echo "$most_active" | jq -r '.id')"
        echo "  标题: $(echo "$most_active" | jq -r '.title')"
        echo "  消息数: $(echo "$most_active" | jq -r '.messageCount')"
        echo ""
    fi

    echo "📈 活跃度分布:"
    echo "  高活跃度会话: $(echo "$overview" | jq -r '.activityDistribution.high')"
    echo "  中活跃度会话: $(echo "$overview" | jq -r '.activityDistribution.medium')"
    echo "  低活跃度会话: $(echo "$overview" | jq -r '.activityDistribution.low')"
    echo ""

    echo "🕒 最近会话:"
    if [ "$(echo "$recent_sessions" | wc -l)" -gt 0 ]; then
        echo "$recent_sessions" | jq -r '"• \(.title) (\(.messageCount) 条消息) - \(.lastActivity[:10])"' | sed 's/^/  /'
    else
        echo "  暂无会话记录"
    fi
}

# 显示使用示例
show_examples() {
    log_header "💡 使用示例"

    cat << 'EOF'
🔥 热门使用场景:

1. 🚀 创建和管理对话会话
   # 创建新会话
   ./manage-conversations.sh --create

   # 查看用户的所有会话
   ./manage-conversations.sh --list

   # 查看会话详情
   ./manage-conversations.sh --view

2. 💬 消息管理和上下文
   # 添加消息到会话
   ./manage-conversations.sh --add-message

   # 查看消息历史
   ./manage-conversations.sh --messages

   # 获取对话上下文
   ./manage-conversations.sh --context

3. 🔍 搜索和分析
   # 搜索会话
   ./manage-conversations.sh --search

   # 用户对话概览
   ./manage-conversations.sh --overview

   # 查看统计信息
   ./manage-conversations.sh --stats

4. 💾 数据管理和导出
   # 更新会话信息
   ./manage-conversations.sh --update

   # 导出会话数据
   ./manage-conversations.sh --export

   # 删除会话
   ./manage-conversations.sh --delete

✨ 高级功能:

5. 🧠 智能上下文管理
   • 自动消息压缩和摘要
   • 主题提取和实体识别
   • 记忆网络关联

6. 📊 数据分析和洞察
   • 会话活跃度分析
   • Token使用量统计
   • 对话质量评估

7. 🔒 隐私和安全
   • 用户数据隔离
   • 敏感信息过滤
   • 访问权限控制

🎯 最佳实践:
• 定期清理过期会话，保持系统性能
• 使用有意义的会话标题，便于后续查找
• 合理设置上下文窗口，避免Token浪费
• 定期导出重要会话数据作为备份

💾 数据持久化:
• 会话数据自动压缩，节省存储空间
• 支持90天数据保留，可配置
• JSON格式导出，便于数据迁移
• 实时备份机制，保障数据安全

🔄 实时同步:
• WebSocket支持实时消息同步
• 多设备间会话状态同步
• 跨平台对话连续性保证

EOF
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 对话管理脚本

用法:
    ./manage-conversations.sh [选项]

选项:
    -c, --create         创建新对话会话
    -l, --list           列出用户的所有会话
    -v, --view           查看会话详情
    -a, --add-message    添加消息到会话
    -m, --messages       查看会话消息历史
    -x, --context        获取会话上下文
    -s, --search         搜索对话会话
    -u, --update         更新会话信息
    -d, --delete         删除对话会话
    -e, --export         导出会话数据
    -o, --overview       获取用户对话概览
    --stats              显示对话统计信息
    --examples           显示使用示例
    --help               显示此帮助信息

快速开始:
    # 查看概览统计
    ./manage-conversations.sh --stats

    # 创建新会话
    ./manage-conversations.sh --create

    # 查看用户会话
    ./manage-conversations.sh --list

    # 添加消息
    ./manage-conversations.sh --add-message

    # 查看消息历史
    ./manage-conversations.sh --messages

    # 查看使用示例
    ./manage-conversations.sh --examples

核心概念:
    会话(Session)     - 独立的对话实例
    消息(Message)     - 会话中的具体对话内容
    上下文(Context)   - 用于AI推理的相关历史消息
    主题(Topic)       - 对话的主要话题
    摘要(Summary)     - 长对话的压缩表示

数据管理:
    • 自动压缩: 超过阈值的对话自动压缩
    • 定期清理: 90天未活跃会话自动归档
    • 数据导出: 支持JSON格式完整导出
    • 隐私保护: 用户数据严格隔离

EOF
}

# 主函数
main() {
    log_header "💬 Sira AI网关 - 对话管理工具"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 参数处理
    case "${1:-}" in
        -c|--create)
            create_session
            ;;
        -l|--list)
            list_sessions
            ;;
        -v|--view)
            view_session
            ;;
        -a|--add-message)
            add_message
            ;;
        -m|--messages)
            view_messages
            ;;
        -x|--context)
            get_context
            ;;
        -s|--search)
            search_sessions
            ;;
        -u|--update)
            update_session
            ;;
        -d|--delete)
            delete_session
            ;;
        -e|--export)
            export_session
            ;;
        -o|--overview)
            user_overview
            ;;
        --stats)
            show_stats
            ;;
        --examples)
            show_examples
            ;;
        --help|*)
            show_help
            ;;
    esac

    log_success "💬 对话管理任务完成"
}

# 执行主函数
main "$@"
