#!/bin/bash

# Sira AI网关 - 图像生成管理脚本
# 管理图像生成功能，包括多种AI模型的统一接口

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

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/images/health" > /dev/null; then
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
    elif [ "$method" = "DELETE" ]; then
        curl -s -X DELETE "$url"
    fi
}

# 显示图像生成统计
show_stats() {
    log_header "📊 图像生成统计信息"

    local response
    response=$(api_request "GET" "images/stats")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取统计失败"
        return 1
    fi

    local stats
    stats=$(echo "$response" | jq -r '.data.stats')

    echo "📈 队列统计:"
    echo "  等待中: $(echo "$stats" | jq -r '.queued')"
    echo "  处理中: $(echo "$stats" | jq -r '.processing')"
    echo "  已完成: $(echo "$stats" | jq -r '.completed')"
    echo "  总任务数: $(echo "$stats" | jq -r '.total')"
    echo ""

    echo "🎯 活跃任务数: $(echo "$stats" | jq -r '.activeJobs')"
}

# 生成图像
generate_image() {
    log_header "🎨 生成图像"

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "AI提供商 (openai_dalle/midjourney/stability_ai，默认: openai_dalle): "
    read -r provider
    provider=${provider:-"openai_dalle"}

    echo -n "模型 (默认: dall-e-3): "
    read -r model
    model=${model:-"dall-e-3"}

    echo -n "图像风格 (natural/artistic/cartoon/minimalist/cyberpunk/fantasy，默认: natural): "
    read -r style
    style=${style:-"natural"}

    echo -n "生成数量 (1-4，默认: 1): "
    read -r count
    count=${count:-1}

    echo -n "图像尺寸 (默认: 1024x1024): "
    read -r size
    size=${size:-"1024x1024"}

    echo "请输入图像描述 (提示词):"
    read -r prompt

    echo -n "负面提示词 (可选): "
    read -r negative_prompt

    if [ -z "$prompt" ]; then
        log_error "提示词是必需的"
        return 1
    fi

    local request_data="{
        \"userId\": \"$user_id\",
        \"provider\": \"$provider\",
        \"model\": \"$model\",
        \"prompt\": \"$prompt\",
        \"style\": \"$style\",
        \"count\": $count,
        \"size\": \"$size\""

    if [ -n "$negative_prompt" ]; then
        request_data="$request_data, \"negativePrompt\": \"$negative_prompt\""
    fi

    request_data="$request_data}"

    local response
    response=$(api_request "POST" "images/generate" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "图像生成请求失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job_id
    job_id=$(echo "$response" | jq -r '.data.jobId')

    log_success "✅ 图像生成任务已创建!"
    echo "任务ID: $job_id"
    echo "预计等待时间: $(echo "$response" | jq -r '.data.estimatedWaitTime')"
    echo ""

    # 自动监控任务进度
    monitor_job "$job_id"
}

# 使用模板生成图像
generate_from_template() {
    log_header "📝 使用模板生成图像"

    # 显示可用模板
    echo "📋 可用模板:"
    local templates_response
    templates_response=$(api_request "GET" "images/templates")

    if echo "$templates_response" | jq -e '.success' >/dev/null 2>&1; then
        echo "$templates_response" | jq -r '.data.templates[] | "  \(.id): \(.name) - \(.description)"'
        echo ""
    fi

    echo -n "选择模板ID: "
    read -r template_id

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "自定义提示词 (可选，直接回车使用模板默认): "
    read -r custom_prompt

    echo -n "图像风格 (默认: natural): "
    read -r style
    style=${style:-"natural"}

    if [ -z "$template_id" ]; then
        log_error "模板ID是必需的"
        return 1
    fi

    local request_data="{
        \"templateId\": \"$template_id\",
        \"userId\": \"$user_id\",
        \"customizations\": {
            \"style\": \"$style\""

    if [ -n "$custom_prompt" ]; then
        request_data="$request_data, \"prompt\": \"$custom_prompt\""
    fi

    request_data="$request_data}}"

    local response
    response=$(api_request "POST" "images/generate-from-template" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "模板生成请求失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job_id
    job_id=$(echo "$response" | jq -r '.data.jobId')

    log_success "✅ 模板图像生成任务已创建!"
    echo "任务ID: $job_id"
    echo "使用模板: $(echo "$response" | jq -r '.data.template')"
    echo ""

    # 自动监控任务进度
    monitor_job "$job_id"
}

# 监控任务进度
monitor_job() {
    local job_id="$1"

    if [ -z "$job_id" ]; then
        log_error "需要提供任务ID"
        return 1
    fi

    log_info "开始监控任务进度: $job_id"

    local max_attempts=60  # 最多等待60次 (约5分钟)
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        local response
        response=$(api_request "GET" "images/job/$job_id")

        if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
            log_error "获取任务状态失败"
            return 1
        fi

        local status progress
        status=$(echo "$response" | jq -r '.data.job.status')
        progress=$(echo "$response" | jq -r '.data.job.progress')

        echo -ne "\r📊 任务状态: $status | 进度: ${progress}% "

        if [ "$status" = "completed" ]; then
            echo -e "\n✅ 任务完成!"

            local result
            result=$(echo "$response" | jq -r '.data.job.result')

            echo "📸 生成的图像:"
            echo "$result" | jq -r '.images[]'

            echo ""
            echo "💰 消耗成本: $(echo "$response" | jq -r '.data.job.metadata.actualCost') USD"
            echo "⏱️ 处理时间: $(echo "$response" | jq -r '.data.job.metadata.processingTime') ms"

            return 0
        elif [ "$status" = "failed" ]; then
            echo -e "\n❌ 任务失败!"

            local error
            error=$(echo "$response" | jq -r '.data.job.error')

            echo "错误信息: $(echo "$error" | jq -r '.message')"
            return 1
        fi

        sleep 5
        ((attempt++))
    done

    log_warn "监控超时，任务可能仍在处理中"
}

# 查看任务状态
check_job_status() {
    log_header "🔍 查看任务状态"

    echo -n "任务ID: "
    read -r job_id

    if [ -z "$job_id" ]; then
        log_error "任务ID是必需的"
        return 1
    fi

    local response
    response=$(api_request "GET" "images/job/$job_id")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取任务状态失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job
    job=$(echo "$response" | jq -r '.data.job')

    echo "任务ID: $job_id"
    echo "状态: $(echo "$job" | jq -r '.status')"
    echo "进度: $(echo "$job" | jq -r '.progress')%"
    echo "提供商: $(echo "$job" | jq -r '.provider')"
    echo "模型: $(echo "$job" | jq -r '.model')"
    echo "风格: $(echo "$job" | jq -r '.style')"
    echo "生成数量: $(echo "$job" | jq -r '.count')"
    echo "创建时间: $(echo "$job" | jq -r '.createdAt')"
    echo "开始时间: $(echo "$job" | jq -r '.startedAt // "未开始"')"
    echo "完成时间: $(echo "$job" | jq -r '.completedAt // "未完成"')"

    if [ "$(echo "$job" | jq -r '.status')" = "completed" ]; then
        echo ""
        echo "📸 生成的图像:"
        echo "$job" | jq -r '.result.images[]'

        echo ""
        echo "📊 元数据:"
        echo "  估算成本: $(echo "$job" | jq -r '.metadata.estimatedCost') USD"
        echo "  实际成本: $(echo "$job" | jq -r '.metadata.actualCost') USD"
        echo "  处理时间: $(echo "$job" | jq -r '.metadata.processingTime') ms"
        echo "  重试次数: $(echo "$job" | jq -r '.metadata.retryCount')"
    elif [ "$(echo "$job" | jq -r '.status')" = "failed" ]; then
        echo ""
        echo "❌ 错误信息:"
        echo "  错误代码: $(echo "$job" | jq -r '.error.code')"
        echo "  错误消息: $(echo "$job" | jq -r '.error.message')"
    fi
}

# 查看用户历史
view_user_history() {
    log_header "📚 查看用户生成历史"

    echo -n "用户ID: "
    read -r user_id

    echo -n "显示数量 (默认: 10): "
    read -r limit
    limit=${limit:-10}

    if [ -z "$user_id" ]; then
        log_error "用户ID是必需的"
        return 1
    fi

    local response
    response=$(api_request "GET" "images/history/$user_id?limit=$limit")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取用户历史失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local jobs total
    jobs=$(echo "$response" | jq -r '.data.jobs')
    total=$(echo "$response" | jq -r '.data.total')

    echo "用户 $user_id 的最近 $limit 个任务 (总共 $total 个):"
    echo ""

    echo "$jobs" | jq -r '.[] | "\(.id) | \(.status) | \(.provider)/\(.model) | \(.createdAt) | \(.prompt)"' |
    while IFS='|' read -r id status provider_model created_at prompt; do
        echo "📋 $id"
        echo "  状态: $status"
        echo "  提供商: $provider_model"
        echo "  时间: $created_at"
        echo "  提示: ${prompt:0:60}..."
        echo ""
    done
}

# 生成图像变体
generate_variation() {
    log_header "🔄 生成图像变体"

    echo -n "原任务ID: "
    read -r job_id

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "变体数量 (默认: 1): "
    read -r count
    count=${count:-1}

    echo -n "风格 (默认: 保持原风格): "
    read -r style

    if [ -z "$job_id" ]; then
        log_error "原任务ID是必需的"
        return 1
    fi

    local request_data="{
        \"userId\": \"$user_id\",
        \"count\": $count"

    if [ -n "$style" ]; then
        request_data="$request_data, \"style\": \"$style\""
    fi

    request_data="$request_data}"

    local response
    response=$(api_request "POST" "images/variation/$job_id" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "变体生成请求失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local variation_job_id
    variation_job_id=$(echo "$response" | jq -r '.data.jobId')

    log_success "✅ 图像变体生成任务已创建!"
    echo "新任务ID: $variation_job_id"
    echo ""

    monitor_job "$variation_job_id"
}

# 批量生成图像
batch_generate() {
    log_header "📦 批量生成图像"

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "批量任务数量 (1-10): "
    read -r batch_count

    if [ -z "$batch_count" ] || [ "$batch_count" -lt 1 ] || [ "$batch_count" -gt 10 ]; then
        log_error "批量任务数量必须在1-10之间"
        return 1
    fi

    local requests="["

    for ((i=1; i<=batch_count; i++)); do
        echo ""
        echo "🎯 配置第 $i 个任务:"

        echo -n "  提示词: "
        read -r prompt

        echo -n "  提供商 (默认: openai_dalle): "
        read -r provider
        provider=${provider:-"openai_dalle"}

        echo -n "  风格 (默认: natural): "
        read -r style
        style=${style:-"natural"}

        if [ -z "$prompt" ]; then
            log_error "提示词是必需的"
            return 1
        fi

        requests="$requests{
            \"prompt\": \"$prompt\",
            \"provider\": \"$provider\",
            \"style\": \"$style\"
        }"

        if [ "$i" -lt "$batch_count" ]; then
            requests="$requests,"
        fi
    done

    requests="$requests]"

    local request_data="{
        \"userId\": \"$user_id\",
        \"requests\": $requests
    }"

    local response
    response=$(api_request "POST" "images/batch" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "批量生成请求失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job_ids
    job_ids=$(echo "$response" | jq -r '.data.jobIds[]')

    log_success "✅ 批量图像生成任务已创建!"
    echo "创建的任务数量: $(echo "$job_ids" | wc -l)"
    echo "任务ID列表:"
    echo "$job_ids" | sed 's/^/  • /'
    echo ""

    # 监控第一个任务作为示例
    local first_job_id
    first_job_id=$(echo "$job_ids" | head -1)
    echo "📊 监控第一个任务 ($first_job_id) 的进度..."
    monitor_job "$first_job_id"
}

# 显示支持的提供商
show_providers() {
    log_header "🏢 支持的图像生成提供商"

    local response
    response=$(api_request "GET" "images/providers")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取提供商信息失败"
        return 1
    fi

    echo "$response" | jq -r '.data.providers[] | "
🏢 \(.name) (\(.id))
  支持模型: \(.models | join(", "))
  最大尺寸: \(.maxSize)
  支持编辑: \(.supportsEdit)
  支持变体: \(.supportsVariation)
  异步处理: \(.asyncProcessing)
"'
}

# 显示支持的风格
show_styles() {
    log_header "🎨 支持的图像风格"

    local response
    response=$(api_request "GET" "images/styles")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取风格信息失败"
        return 1
    fi

    echo "$response" | jq -r '.data.styles[] | "🎨 \(.name) (\(.id)): \(.description)"'
}

# 显示使用示例
show_examples() {
    log_header "💡 使用示例"

    cat << 'EOF'
🔥 热门使用场景:

1. 🚀 快速生成图像
   curl -X POST http://localhost:9876/images/generate \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "一只可爱的猫咪在花园里玩耍",
       "provider": "openai_dalle",
       "model": "dall-e-3",
       "style": "natural",
       "count": 1
     }'

2. 🎭 使用艺术风格
   curl -X POST http://localhost:9876/images/generate \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "未来城市的天际线",
       "style": "cyberpunk",
       "provider": "midjourney",
       "negativePrompt": "黑暗，阴郁"
     }'

3. 📝 使用模板生成
   curl -X POST http://localhost:9876/images/generate-from-template \
     -H "Content-Type: application/json" \
     -d '{
       "templateId": "portrait",
       "customizations": {
         "prompt": "一位年轻的艺术家"
       }
     }'

4. 🔄 生成图像变体
   curl -X POST http://localhost:9876/images/variation/{jobId} \
     -H "Content-Type: application/json" \
     -d '{
       "count": 2,
       "style": "artistic"
     }'

5. 📦 批量生成
   curl -X POST http://localhost:9876/images/batch \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "user123",
       "requests": [
         {"prompt": "日出时的山脉", "style": "natural"},
         {"prompt": "太空飞船", "style": "cyberpunk"}
       ]
     }'

6. 📊 查看任务状态
   curl http://localhost:9876/images/job/{jobId}

7. 📚 查看用户历史
   curl http://localhost:9876/images/history/{userId}?limit=5

✨ 高级功能:

8. 🎨 自定义风格组合
   - 结合多种风格: "cyberpunk, fantasy, detailed"
   - 负面提示优化: "blurry, low quality, deformed"

9. 🏗️ 复杂场景构建
   - 详细的环境描述
   - 光线和氛围设定
   - 视角和构图指定

10. 🎯 专业应用
    - 产品可视化
    - 概念设计
    - 艺术创作辅助

📸 最佳实践:
• 使用具体而非抽象的描述
• 指定艺术风格和氛围
• 添加质量相关的关键词
• 利用负面提示排除不需要的元素
• 实验不同的模型和参数

🎨 风格效果:
• natural: 写实照片风格
• artistic: 艺术画风格
• cartoon: 卡通动漫风格
• minimalist: 极简现代风格
• cyberpunk: 未来科技风格
• fantasy: 奇幻魔法风格

EOF
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 图像生成管理脚本

用法:
    ./manage-image-generator.sh [选项]

选项:
    -g, --generate        生成图像
    -t, --template        使用模板生成图像
    -v, --variation       生成图像变体
    -b, --batch           批量生成图像
    -s, --status          查看任务状态
    -h, --history         查看用户历史
    -p, --providers       显示支持的提供商
    -y, --styles          显示支持的风格
    -m, --monitor         监控任务进度
    -e, --examples        显示使用示例
    --help                显示此帮助信息

快速开始:
    # 生成图像
    ./manage-image-generator.sh --generate

    # 使用模板
    ./manage-image-generator.sh --template

    # 查看统计
    ./manage-image-generator.sh --stats

    # 查看任务状态
    ./manage-image-generator.sh --status

    # 查看历史
    ./manage-image-generator.sh --history

    # 查看示例
    ./manage-image-generator.sh --examples

支持的提供商:
    openai_dalle    - OpenAI DALL-E (高质量，快速)
    midjourney      - Midjourney (艺术风格，社区驱动)
    stability_ai    - Stability AI (开源，灵活)
    replicate       - Replicate (多种模型，实验性)
    adobe_firefly   - Adobe Firefly (专业，商业化)

图像风格:
    natural         - 自然写实风格
    artistic        - 艺术绘画风格
    cartoon         - 卡通动漫风格
    minimalist      - 极简现代风格
    cyberpunk       - 赛博朋克风格
    fantasy         - 奇幻魔法风格

EOF
}

# 主函数
main() {
    log_header "🎨 Sira AI网关 - 图像生成管理工具"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 参数处理
    case "${1:-}" in
        -g|--generate)
            generate_image
            ;;
        -t|--template)
            generate_from_template
            ;;
        -v|--variation)
            generate_variation
            ;;
        -b|--batch)
            batch_generate
            ;;
        -s|--status)
            check_job_status
            ;;
        -h|--history)
            view_user_history
            ;;
        -p|--providers)
            show_providers
            ;;
        -y|--styles)
            show_styles
            ;;
        -m|--monitor)
            echo -n "任务ID: "
            read -r job_id
            monitor_job "$job_id"
            ;;
        -e|--examples)
            show_examples
            ;;
        --stats)
            show_stats
            ;;
        --help|*)
            show_help
            ;;
    esac

    log_success "🎨 图像生成管理任务完成"
}

# 执行主函数
main "$@"
