#!/bin/bash

# Sira AI网关 - 提示词模板管理脚本
# 管理AI提示词模板，包括查看、使用、自定义模板等

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

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/prompt-templates" > /dev/null; then
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
    elif [ "$method" = "DELETE" ]; then
        curl -s -X DELETE "$url"
    fi
}

# 显示所有模板
show_templates() {
    log_header "📋 所有提示词模板"

    local response
    response=$(api_request "GET" "prompt-templates")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取模板列表失败"
        return 1
    fi

    local stats
    stats=$(echo "$response" | jq -r '.data.stats')

    echo "📊 模板统计:"
    echo "  总分类数: $(echo "$stats" | jq -r '.totalCategories')"
    echo "  总模板数: $(echo "$stats" | jq -r '.totalTemplates')"
    echo ""

    echo "📂 模板分类:"
    echo "$response" | jq -r '.data.categories[]' | sed 's/^/  - /'
    echo ""

    echo "🏷️ 热门标签:"
    echo "$stats" | jq -r 'to_entries(.popularTags)[] | "  \(.key): \(.value)"'
}

# 显示分类模板
show_category_templates() {
    log_header "📂 分类模板列表"

    echo -n "请输入分类名称 (creative/coding/business/education/communication/analysis/custom): "
    read -r category

    if [ -z "$category" ]; then
        log_error "分类名称不能为空"
        return 1
    fi

    local response
    response=$(api_request "GET" "prompt-templates/categories/$category")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取分类模板失败"
        return 1
    fi

    echo "分类: $category"
    echo "模板数量: $(echo "$response" | jq -r '.data.count')"
    echo ""

    echo "$response" | jq -r '.data.templates[] | "🎯 \(.id): \(.name)\n   📝 \(.description)\n   🏷️ 标签: \(.tags | join(", "))\n"'
}

# 搜索模板
search_templates() {
    log_header "🔍 搜索提示词模板"

    echo -n "请输入搜索关键词 (如: 写作、代码、邮件、报告等): "
    read -r query

    if [ -z "$query" ]; then
        log_error "搜索关键词不能为空"
        return 1
    fi

    local response
    response=$(api_request "GET" "prompt-templates/search?q=$query")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "搜索模板失败"
        return 1
    fi

    local count
    count=$(echo "$response" | jq -r '.data.count')

    if [ "$count" -eq 0 ]; then
        log_warn "未找到匹配的模板"
        return 0
    fi

    echo "搜索关键词: $query"
    echo "找到 $count 个相关模板:"
    echo ""

    if echo "$response" | jq -e '.data.results[]' >/dev/null 2>&1; then
        echo "$response" | jq -r '.data.results[] | "🎯 \(.category).\(.templateId): \(.name)\n   📝 \(.description)\n   🏷️ 标签: \(.tags | join(", "))\n   📊 匹配度: \(.score)\n"'
    else
        echo "$response" | jq -r '.data.results[] | "🎯 \(.category).\(.id): \(.name)\n   📝 \(.description)\n   🏷️ 标签: \(.tags | join(", "))\n"'
    fi
}

# 查看模板详情
view_template_detail() {
    log_header "📖 模板详情查看"

    echo -n "请输入模板ID (格式: 分类.模板名，如: creative.story_writer): "
    read -r template_id

    if [ -z "$template_id" ]; then
        log_error "模板ID不能为空"
        return 1
    fi

    # 解析分类和模板名
    if [[ ! "$template_id" =~ ^[^.]+\.[^.]+$ ]]; then
        log_error "模板ID格式错误，应为 '分类.模板名'"
        return 1
    fi

    local category
    local template_name
    category=$(echo "$template_id" | cut -d. -f1)
    template_name=$(echo "$template_id" | cut -d. -f2)

    local response
    response=$(api_request "GET" "prompt-templates/$category/$template_name")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取模板详情失败"
        return 1
    fi

    local template_data
    template_data=$(echo "$response" | jq -r '.data.template')

    echo "模板ID: $category.$template_name"
    echo "名称: $(echo "$template_data" | jq -r '.name')"
    echo "描述: $(echo "$template_data" | jq -r '.description')"
    echo ""
    echo "🏷️ 标签: $(echo "$template_data" | jq -r '.tags | join(", ")')"
    echo ""
    echo "📋 变量列表:"
    echo "$template_data" | jq -r '.variables[]' | sed 's/^/  - /'
    echo ""
    echo "🔧 默认值:"
    echo "$template_data" | jq -r '.defaultValues | to_entries[] | "  \(.key): \(.value)"'
    echo ""
    echo "📝 模板内容:"
    echo "$template_data" | jq -r '.template' | sed 's/^/  /'
}

# 渲染模板
render_template() {
    log_header "🎨 模板渲染"

    echo -n "请输入模板ID (格式: 分类.模板名): "
    read -r template_id

    if [ -z "$template_id" ]; then
        log_error "模板ID不能为空"
        return 1
    fi

    # 解析分类和模板名
    if [[ ! "$template_id" =~ ^[^.]+\.[^.]+$ ]]; then
        log_error "模板ID格式错误"
        return 1
    fi

    local category
    local template_name
    category=$(echo "$template_id" | cut -d. -f1)
    template_name=$(echo "$template_id" | cut -d. -f2)

    echo -n "是否要自定义变量值? (y/N): "
    read -r customize_vars

    local variables_data="{}"

    if [[ "$customize_vars" =~ ^[Yy]$ ]]; then
        echo "请输入变量值 (JSON格式，如: {\"theme\": \"科幻\", \"characters\": \"AI机器人\"})"

        # 获取模板信息以显示变量提示
        local template_response
        template_response=$(api_request "GET" "prompt-templates/$category/$template_name")

        if echo "$template_response" | jq -e '.success' >/dev/null 2>&1; then
            echo "可用变量:"
            echo "$template_response" | jq -r '.data.template.variables[]' | sed 's/^/  - /'
            echo ""
        fi

        echo -n "变量值 (JSON): "
        read -r variables_input

        if [ -n "$variables_input" ]; then
            if ! echo "$variables_input" | jq . >/dev/null 2>&1; then
                log_error "变量值格式不正确，必须是有效的JSON"
                return 1
            fi
            variables_data="$variables_input"
        fi
    fi

    local request_data="{\"category\": \"$category\", \"templateId\": \"$template_name\", \"variables\": $variables_data}"

    local response
    response=$(api_request "POST" "prompt-templates/render" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "模板渲染失败"
        return 1
    fi

    log_success "✅ 模板渲染成功"

    local rendered
    rendered=$(echo "$response" | jq -r '.data.rendered')

    echo ""
    echo "📝 渲染结果:"
    echo "----------------------------------------"
    echo "$rendered"
    echo "----------------------------------------"
    echo ""
    echo "📊 统计信息:"
    echo "  字符数: $(echo -n "$rendered" | wc -c)"
    echo "  行数: $(echo "$rendered" | wc -l)"
}

# 验证模板变量
validate_template() {
    log_header "✅ 模板变量验证"

    echo -n "请输入模板ID (格式: 分类.模板名): "
    read -r template_id

    if [ -z "$template_id" ]; then
        log_error "模板ID不能为空"
        return 1
    fi

    # 解析分类和模板名
    if [[ ! "$template_id" =~ ^[^.]+\.[^.]+$ ]]; then
        log_error "模板ID格式错误"
        return 1
    fi

    local category
    local template_name
    category=$(echo "$template_id" | cut -d. -f1)
    template_name=$(echo "$template_id" | cut -d. -f2)

    echo -n "请输入要验证的变量值 (JSON格式): "
    read -r variables_input

    local variables_data="{}"
    if [ -n "$variables_input" ]; then
        if ! echo "$variables_input" | jq . >/dev/null 2>&1; then
            log_error "变量值格式不正确，必须是有效的JSON"
            return 1
        fi
        variables_data="$variables_input"
    fi

    local request_data="{\"category\": \"$category\", \"templateId\": \"$template_name\", \"variables\": $variables_data}"

    local response
    response=$(api_request "POST" "prompt-templates/validate" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "模板验证失败"
        return 1
    fi

    local validation
    validation=$(echo "$response" | jq -r '.data.validation')

    if echo "$validation" | jq -e '.valid' | grep -q true; then
        log_success "✅ 变量验证通过"
    else
        log_error "❌ 变量验证失败"
        echo "缺少的变量:"
        echo "$validation" | jq -r '.missing[]' | sed 's/^/  - /'
        echo "无效的变量:"
        echo "$validation" | jq -r '.invalid[]' | sed 's/^/  - /'
    fi
}

# 添加自定义模板
add_custom_template() {
    log_header "➕ 添加自定义模板"

    echo -n "请输入分类名称: "
    read -r category

    echo -n "请输入模板ID (英文小写字母和下划线): "
    read -r template_id

    echo -n "请输入模板名称: "
    read -r template_name

    echo -n "请输入模板描述: "
    read -r template_description

    echo -n "请输入模板内容 (支持变量如 {{variable_name}}): "
    read -r template_content

    echo -n "请输入变量列表 (用逗号分隔，如: var1,var2,var3): "
    read -r variables_list

    echo -n "请输入标签列表 (用逗号分隔，如: 自定义,测试): "
    read -r tags_list

    # 构建请求数据
    local variables_json="[]"
    if [ -n "$variables_list" ]; then
        variables_json=$(echo "$variables_list" | sed 's/,/","/g' | sed 's/^/["/' | sed 's/$/"]/')
    fi

    local tags_json="[]"
    if [ -n "$tags_list" ]; then
        tags_json=$(echo "$tags_list" | sed 's/,/","/g' | sed 's/^/["/' | sed 's/$/","自定义"]/')
    else
        tags_json='["自定义"]'
    fi

    local request_data="{
        \"category\": \"$category\",
        \"templateId\": \"$template_id\",
        \"template\": {
            \"name\": \"$template_name\",
            \"description\": \"$template_description\",
            \"template\": \"$template_content\",
            \"variables\": $variables_json,
            \"tags\": $tags_json
        }
    }"

    local response
    response=$(api_request "POST" "prompt-templates/custom" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "添加自定义模板失败"
        return 1
    fi

    log_success "✅ 自定义模板添加成功: $category.$template_id"
}

# 删除自定义模板
delete_custom_template() {
    log_header "🗑️ 删除自定义模板"

    echo -n "请输入要删除的模板ID (格式: 分类.模板名): "
    read -r template_id

    if [ -z "$template_id" ]; then
        log_error "模板ID不能为空"
        return 1
    fi

    # 解析分类和模板名
    if [[ ! "$template_id" =~ ^[^.]+\.[^.]+$ ]]; then
        log_error "模板ID格式错误"
        return 1
    fi

    local category
    local template_name
    category=$(echo "$template_id" | cut -d. -f1)
    template_name=$(echo "$template_id" | cut -d. -f2)

    echo -n "确认删除模板 $category.$template_name? (y/N): "
    read -r confirm

    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "取消删除操作"
        return 0
    fi

    local response
    response=$(api_request "DELETE" "prompt-templates/custom/$category/$template_name")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "删除自定义模板失败"
        return 1
    fi

    log_success "✅ 自定义模板删除成功: $category.$template_name"
}

# 获取推荐模板
get_recommendations() {
    log_header "💡 智能推荐模板"

    echo -n "请描述您的任务 (如: 写一篇科技文章、解释代码、起草商务邮件等): "
    read -r task_description

    if [ -z "$task_description" ]; then
        log_error "任务描述不能为空"
        return 1
    fi

    echo -n "推荐数量 (默认5): "
    read -r limit
    limit=${limit:-5}

    local request_data="{\"taskDescription\": \"$task_description\", \"limit\": $limit}"

    local response
    response=$(api_request "POST" "prompt-templates/recommend" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取推荐模板失败"
        return 1
    fi

    local recommendations
    recommendations=$(echo "$response" | jq -r '.data.recommendations[]')

    if [ -z "$recommendations" ]; then
        log_warn "未找到合适的推荐模板"
        return 0
    fi

    echo "任务描述: $task_description"
    echo "推荐模板:"
    echo ""

    echo "$response" | jq -r '.data.recommendations[] | "🎯 \(.category).\(.templateId): \(.name)\n   📝 \(.description)\n   🏷️ 标签: \(.tags | join(", "))\n   📊 推荐度: \(.score)\n"'
}

# 显示使用示例
show_examples() {
    log_header "💡 使用示例"

    cat << 'EOF'
🔥 热门使用场景:

1. 📚 创意写作
   使用模板: creative.story_writer
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "gpt-4",
       "messages": [{"role": "user", "content": "写一个故事"}],
       "prompt_template": "creative.story_writer",
       "template_variables": {
         "theme": "时空旅行",
         "genre": "科幻冒险"
       }
     }'

2. 💻 代码解释
   使用模板: coding.code_explanation
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "x-prompt-template: coding.code_explanation" \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "deepseek-chat",
       "messages": [{"role": "user", "content": "解释这段代码"}],
       "template_variables": {
         "language": "JavaScript",
         "function": "用户认证",
         "code": "function auth(user) { return validateToken(user.token); }",
         "audience": "初中级开发者"
       }
     }'

3. 📧 商务邮件
   使用模板: business.email_writer
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "x-prompt-template: business.email_writer" \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "kimi",
       "messages": [{"role": "user", "content": "写一封商务邮件"}],
       "template_variables": {
         "email_type": "合作邀请",
         "recipient": "尊敬的合作伙伴",
         "subject": "关于新技术合作的探讨"
       }
     }'

4. 📊 数据分析
   使用模板: analysis.data_interpreter
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "x-prompt-template: analysis.data_interpreter" \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "qwen-max",
       "messages": [{"role": "user", "content": "分析这份数据"}],
       "template_variables": {
         "data_source": "销售数据库",
         "analysis_goal": "找出销售趋势和改进建议",
         "audience": "销售总监"
       }
     }'

5. 🎓 课程设计
   使用模板: education.lesson_planner
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "x-prompt-template: education.lesson_planner" \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "gpt-4",
       "messages": [{"role": "user", "content": "设计AI课程"}],
       "template_variables": {
         "subject": "人工智能导论",
         "grade_level": "本科生",
         "duration": "90分钟"
       }
     }'

✨ 高级用法:

6. 自定义变量
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "claude-3-sonnet",
       "messages": [{"role": "user", "content": "生成自定义内容"}],
       "prompt_template": "custom.my_template",
       "template_variables": {
         "custom_var1": "值1",
         "custom_var2": "值2"
       }
     }'

7. 模板预览
   curl -X POST http://localhost:9876/prompt-templates/preview \
     -H "Content-Type: application/json" \
     -d '{
       "category": "creative",
       "templateId": "story_writer",
       "variables": {
         "theme": "魔法世界",
         "genre": "奇幻冒险"
       }
     }'

8. 模板推荐
   curl -X POST http://localhost:9876/prompt-templates/recommend \
     -H "Content-Type: application/json" \
     -d '{
       "taskDescription": "写一篇关于环保的文章",
       "limit": 3
     }'

EOF
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 提示词模板管理脚本

用法:
    ./manage-prompt-templates.sh [选项]

选项:
    -l, --list          显示所有模板列表
    -c, --category      显示分类模板
    -s, --search        搜索模板
    -v, --view          查看模板详情
    -r, --render        渲染模板
    -t, --validate      验证模板变量
    -a, --add           添加自定义模板
    -d, --delete        删除自定义模板
    -m, --recommend     获取推荐模板
    -e, --examples      显示使用示例
    -h, --help          显示此帮助信息

环境变量:
    ADMIN_HOST          管理API主机 (默认: localhost)
    ADMIN_PORT          管理API端口 (默认: 9876)

示例:
    # 显示所有模板
    ./manage-prompt-templates.sh --list

    # 搜索模板
    ./manage-prompt-templates.sh --search

    # 渲染模板
    ./manage-prompt-templates.sh --render

    # 查看使用示例
    ./manage-prompt-templates.sh --examples

模板ID格式:
    分类.模板名，如: creative.story_writer, coding.code_explanation

内置分类:
    creative     - 创意写作
    coding       - 编程开发
    business     - 商业应用
    education    - 教育学习
    communication - 沟通交流
    analysis     - 数据分析
    custom       - 用户自定义

EOF
}

# 主函数
main() {
    log_header "🎭 Sira AI网关 - 提示词模板管理工具"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 参数处理
    case "${1:-}" in
        -l|--list)
            show_templates
            ;;
        -c|--category)
            show_category_templates
            ;;
        -s|--search)
            search_templates
            ;;
        -v|--view)
            view_template_detail
            ;;
        -r|--render)
            render_template
            ;;
        -t|--validate)
            validate_template
            ;;
        -a|--add)
            add_custom_template
            ;;
        -d|--delete)
            delete_custom_template
            ;;
        -m|--recommend)
            get_recommendations
            ;;
        -e|--examples)
            show_examples
            ;;
        -h|--help|*)
            show_help
            ;;
    esac

    log_success "🎉 提示词模板管理任务完成"
}

# 执行主函数
main "$@"
