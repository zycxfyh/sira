#!/bin/bash

# Sira AI网关 - 语音处理管理脚本
# 管理语音转文字(STT)和文字转语音(TTS)功能

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

    if ! command -v ffmpeg &> /dev/null; then
        missing_deps+=("ffmpeg")
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

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/voice/health" > /dev/null; then
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

# 显示语音处理统计
show_stats() {
    log_header "📊 语音处理统计信息"

    local response
    response=$(api_request "GET" "voice/stats")

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

# 语音转文字
speech_to_text() {
    log_header "🎤 语音转文字"

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "AI提供商 (openai_whisper/azure_speech/google_speech/aws_transcribe，默认: openai_whisper): "
    read -r provider
    provider=${provider:-"openai_whisper"}

    echo -n "模型 (默认: whisper-1): "
    read -r model
    model=${model:-"whisper-1"}

    echo -n "语言 (zh-CN/en-US/ja-JP等，默认: auto): "
    read -r language
    language=${language:-"auto"}

    echo -n "音频文件路径: "
    read -r audio_file

    if [ -z "$audio_file" ]; then
        log_error "音频文件路径是必需的"
        return 1
    fi

    if [ ! -f "$audio_file" ]; then
        log_error "音频文件不存在: $audio_file"
        return 1
    fi

    # 检查文件大小
    local file_size
    file_size=$(stat -f%z "$audio_file" 2>/dev/null || stat -c%s "$audio_file" 2>/dev/null)
    if [ "$file_size" -gt 26214400 ]; then # 25MB
        log_error "音频文件大小不能超过25MB"
        return 1
    fi

    # 检查音频格式
    local mime_type
    mime_type=$(file -b --mime-type "$audio_file" 2>/dev/null || echo "unknown")

    if [[ ! "$mime_type" =~ ^audio/ ]]; then
        log_error "不支持的文件格式: $mime_type"
        log_info "支持的格式: MP3, MP4, MPEG, MPGA, M4A, WAV, WebM, FLAC"
        return 1
    fi

    log_info "正在上传音频文件..."

    local response
    response=$(curl -s -X POST "http://$ADMIN_HOST:$ADMIN_PORT/voice/stt/upload" \
        -F "audio=@$audio_file" \
        -F "userId=$user_id" \
        -F "provider=$provider" \
        -F "model=$model" \
        -F "language=$language")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "语音转文字请求失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job_id
    job_id=$(echo "$response" | jq -r '.data.jobId')

    log_success "✅ 语音转文字任务已创建!"
    echo "任务ID: $job_id"
    echo "预计等待时间: $(echo "$response" | jq -r '.data.estimatedWaitTime')"
    echo ""

    # 自动监控任务进度
    monitor_job "$job_id"
}

# 文字转语音
text_to_speech() {
    log_header "🗣️ 文字转语音"

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "AI提供商 (openai_tts/azure_speech/google_tts/aws_polly，默认: openai_tts): "
    read -r provider
    provider=${provider:-"openai_tts"}

    echo -n "模型 (tts-1/tts-1-hd，默认: tts-1): "
    read -r model
    model=${model:-"tts-1"}

    echo -n "语音类型 (alloy/echo/fable/onyx/nova/shimmer，默认: alloy): "
    read -r voice
    voice=${voice:-"alloy"}

    echo -n "语音风格 (natural/professional/cheerful/calm/dramatic，默认: natural): "
    read -r style
    style=${style:-"natural"}

    echo -n "输出格式 (mp3/opus/aac/flac，默认: mp3): "
    read -r format
    format=${format:-"mp3"}

    echo "请输入要转换为语音的文本 (最多4096字符):"
    read -r text

    if [ -z "$text" ]; then
        log_error "文本内容是必需的"
        return 1
    fi

    if [ ${#text} -gt 4096 ]; then
        log_error "文本长度不能超过4096字符"
        return 1
    fi

    local request_data="{
        \"userId\": \"$user_id\",
        \"provider\": \"$provider\",
        \"model\": \"$model\",
        \"text\": \"$text\",
        \"voice\": \"$voice\",
        \"style\": \"$style\",
        \"outputFormat\": \"$format\"
    }"

    local response
    response=$(api_request "POST" "voice/tts" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "文字转语音请求失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job_id
    job_id=$(echo "$response" | jq -r '.data.jobId')

    log_success "✅ 文字转语音任务已创建!"
    echo "任务ID: $job_id"
    echo "预计等待时间: $(echo "$response" | jq -r '.data.estimatedWaitTime')"
    echo ""

    # 自动监控任务进度
    monitor_job "$job_id"
}

# 使用模板生成语音
text_to_speech_from_template() {
    log_header "📝 使用模板生成语音"

    # 显示可用模板
    echo "📋 可用模板:"
    local templates_response
    templates_response=$(api_request "GET" "voice/tts/templates")

    if echo "$templates_response" | jq -e '.success' >/dev/null 2>&1; then
        echo "$templates_response" | jq -r '.data.templates[] | "  \(.id): \(.name) - \(.description)"'
        echo ""
    fi

    echo -n "选择模板ID: "
    read -r template_id

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "自定义文本 (可选，直接回车使用模板默认): "
    read -r custom_text

    echo -n "语音类型 (默认: alloy): "
    read -r voice
    voice=${voice:-"alloy"}

    echo -n "语音风格 (默认: natural): "
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
            \"voice\": \"$voice\",
            \"style\": \"$style\""

    if [ -n "$custom_text" ]; then
        request_data="$request_data, \"text\": \"$custom_text\""
    fi

    request_data="$request_data}}"

    local response
    response=$(api_request "POST" "voice/tts/from-template" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "模板语音生成请求失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job_id
    job_id=$(echo "$response" | jq -r '.data.jobId')

    log_success "✅ 模板语音生成任务已创建!"
    echo "任务ID: $job_id"
    echo "使用模板: $(echo "$response" | jq -r '.data.template')"
    echo ""

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
        response=$(api_request "GET" "voice/job/$job_id")

        if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
            log_error "获取任务状态失败"
            return 1
        fi

        local status progress type
        status=$(echo "$response" | jq -r '.data.job.status')
        progress=$(echo "$response" | jq -r '.data.job.progress')
        type=$(echo "$response" | jq -r '.data.job.type')

        echo -ne "\r📊 任务状态: $status | 进度: ${progress}% | 类型: $type "

        if [ "$status" = "completed" ]; then
            echo -e "\n✅ 任务完成!"

            local result
            result=$(echo "$response" | jq -r '.data.job.result')

            if [ "$type" = "stt" ]; then
                echo "📝 识别结果:"
                echo "文本: $(echo "$result" | jq -r '.text')"
                echo "置信度: $(echo "$result" | jq -r '.confidence')"
                echo "语言: $(echo "$result" | jq -r '.language')"
            else
                echo "🔊 生成的音频:"
                echo "音频URL: $(echo "$result" | jq -r '.audioUrl')"
                echo "时长: $(echo "$result" | jq -r '.duration') 秒"
            fi

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
    response=$(api_request "GET" "voice/job/$job_id")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取任务状态失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job
    job=$(echo "$response" | jq -r '.data.job')

    echo "任务ID: $job_id"
    echo "类型: $(echo "$job" | jq -r '.type')"
    echo "状态: $(echo "$job" | jq -r '.status')"
    echo "进度: $(echo "$job" | jq -r '.progress')%"
    echo "提供商: $(echo "$job" | jq -r '.provider')"
    echo "模型: $(echo "$job" | jq -r '.model')"
    echo "输出格式: $(echo "$job" | jq -r '.outputFormat')"
    echo "语言: $(echo "$job" | jq -r '.language // "未指定"')"
    echo "语音: $(echo "$job" | jq -r '.voice // "未指定"')"
    echo "创建时间: $(echo "$job" | jq -r '.createdAt')"
    echo "开始时间: $(echo "$job" | jq -r '.startedAt // "未开始"')"
    echo "完成时间: $(echo "$job" | jq -r '.completedAt // "未完成"')"

    if [ "$(echo "$job" | jq -r '.status')" = "completed" ]; then
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
    log_header "📚 查看用户语音处理历史"

    echo -n "用户ID: "
    read -r user_id

    echo -n "任务类型 (stt/tts/all，默认: all): "
    read -r task_type
    task_type=${task_type:-"all"}

    echo -n "显示数量 (默认: 10): "
    read -r limit
    limit=${limit:-10}

    if [ -z "$user_id" ]; then
        log_error "用户ID是必需的"
        return 1
    fi

    local endpoint="voice/history/$user_id?limit=$limit"
    if [ "$task_type" != "all" ]; then
        endpoint="$endpoint&type=$task_type"
    fi

    local response
    response=$(api_request "GET" "$endpoint")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取用户历史失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local jobs total
    jobs=$(echo "$response" | jq -r '.data.jobs')
    total=$(echo "$response" | jq -r '.data.total')

    echo "用户 $user_id 的最近 ${limit} 个语音处理任务 (总共 $total 个):"
    if [ "$task_type" != "all" ]; then
        echo "任务类型: $task_type"
    fi
    echo ""

    echo "$jobs" | jq -r '.[] | "\(.id) | \(.type) | \(.status) | \(.provider)/\(.model) | \(.createdAt) | \(.completedAt // \"未完成\")"' |
    while IFS='|' read -r id type status provider_model created_at completed_at; do
        echo "🎯 $id"
        echo "  类型: $type"
        echo "  状态: $status"
        echo "  提供商: $provider_model"
        echo "  创建时间: $created_at"
        echo "  完成时间: $completed_at"
        echo ""
    done
}

# 批量语音转文字
batch_speech_to_text() {
    log_header "📦 批量语音转文字"

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "音频文件数量 (1-10): "
    read -r file_count

    if [ -z "$file_count" ] || [ "$file_count" -lt 1 ] || [ "$file_count" -gt 10 ]; then
        log_error "文件数量必须在1-10之间"
        return 1
    fi

    echo "请依次输入音频文件路径:"

    local files=()
    for ((i=1; i<=file_count; i++)); do
        echo -n "文件 $i: "
        read -r file_path
        if [ -n "$file_path" ] && [ -f "$file_path" ]; then
            files+=("$file_path")
        else
            log_warn "跳过无效文件: $file_path"
        fi
    done

    if [ ${#files[@]} -eq 0 ]; then
        log_error "没有有效的音频文件"
        return 1
    fi

    log_info "正在上传 ${#files[@]} 个音频文件..."

    # 构建curl命令
    local curl_cmd="curl -s -X POST \"http://$ADMIN_HOST:$ADMIN_PORT/voice/stt/batch\""
    curl_cmd="$curl_cmd -F \"userId=$user_id\""

    for file in "${files[@]}"; do
        curl_cmd="$curl_cmd -F \"audio=@$file\""
    done

    local response
    response=$(eval "$curl_cmd")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "批量语音转文字请求失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job_ids
    job_ids=$(echo "$response" | jq -r '.data.jobIds[]')

    log_success "✅ 批量语音转文字任务已创建!"
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

# 批量文字转语音
batch_text_to_speech() {
    log_header "📦 批量文字转语音"

    echo -n "用户ID (默认: anonymous): "
    read -r user_id
    user_id=${user_id:-"anonymous"}

    echo -n "文本数量 (1-10): "
    read -r text_count

    if [ -z "$text_count" ] || [ "$text_count" -lt 1 ] || [ "$text_count" -gt 10 ]; then
        log_error "文本数量必须在1-10之间"
        return 1
    fi

    echo "请依次输入要转换的文本:"

    local texts=()
    for ((i=1; i<=text_count; i++)); do
        echo "文本 $i (最多4096字符，直接回车结束输入):"
        read -r text
        if [ -n "$text" ]; then
            texts+=("$text")
        fi
    done

    if [ ${#texts[@]} -eq 0 ]; then
        log_error "没有有效的文本内容"
        return 1
    fi

    echo -n "语音类型 (默认: alloy): "
    read -r voice
    voice=${voice:-"alloy"}

    local request_data="{
        \"userId\": \"$user_id\",
        \"texts\": ["

    for ((i=0; i<${#texts[@]}; i++)); do
        request_data="$request_data\"${texts[$i]}\""
        if [ $i -lt $((${#texts[@]} - 1)) ]; then
            request_data="$request_data,"
        fi
    done

    request_data="$request_data], \"voice\": \"$voice\" }"

    local response
    response=$(api_request "POST" "voice/tts/batch" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "批量文字转语音请求失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local job_ids
    job_ids=$(echo "$response" | jq -r '.data.jobIds[]')

    log_success "✅ 批量文字转语音任务已创建!"
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
    log_header "🏢 支持的语音处理提供商"

    echo "🎤 语音转文字 (STT) 提供商:"
    local stt_response
    stt_response=$(api_request "GET" "voice/stt/providers")

    if echo "$stt_response" | jq -e '.success' >/dev/null 2>&1; then
        echo "$stt_response" | jq -r '.data.providers[] | "  📝 \(.name) (\(.id))
    模型: \(.models | join(\", \")) | 格式: \(.supportedFormats | join(\", \")) | 最大时长: \(.maxDuration)秒"'
        echo ""
    fi

    echo "🗣️ 文字转语音 (TTS) 提供商:"
    local tts_response
    tts_response=$(api_request "GET" "voice/tts/providers")

    if echo "$tts_response" | jq -e '.success' >/dev/null 2>&1; then
        echo "$tts_response" | jq -r '.data.providers[] | "  🔊 \(.name) (\(.id))
    模型: \(.models | join(\", \")) | 语音: \(.voices | join(\", \")) | 最大长度: \(.maxTextLength)"'
        echo ""
    fi
}

# 显示支持的风格
show_styles() {
    log_header "🎨 支持的语音风格"

    local response
    response=$(api_request "GET" "voice/styles")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取风格信息失败"
        return 1
    fi

    echo "$response" | jq -r '.data.styles[] | "🎭 \(.name) (\(.id)): \(.description)
  语速: \(.speed) | 音调: \(.pitch) | 稳定性: \(.stability)"'
}

# 显示使用示例
show_examples() {
    log_header "💡 使用示例"

    cat << 'EOF'
🔥 热门使用场景:

1. 🚀 语音转文字 - 会议录音转写
   curl -X POST http://localhost:9876/voice/stt/upload \
     -F "audio=@meeting.mp3" \
     -F "provider=openai_whisper" \
     -F "language=zh-CN"

2. 🗣️ 文字转语音 - 内容播报
   curl -X POST http://localhost:9876/voice/tts \
     -H "Content-Type: application/json" \
     -d '{
       "text": "欢迎收听今天的新闻摘要",
       "provider": "openai_tts",
       "voice": "alloy",
       "style": "professional"
     }'

3. 📝 使用模板生成语音
   curl -X POST http://localhost:9876/voice/tts/from-template \
     -H "Content-Type: application/json" \
     -d '{
       "templateId": "greeting",
       "customizations": {
         "voice": "nova",
         "style": "cheerful"
       }
     }'

4. 📦 批量语音转文字
   curl -X POST http://localhost:9876/voice/stt/batch \
     -F "audio=@file1.mp3" \
     -F "audio=@file2.wav" \
     -F "userId=user123" \
     -F "provider=azure_speech"

5. 📦 批量文字转语音
   curl -X POST http://localhost:9876/voice/tts/batch \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "user123",
       "texts": ["第一段文本", "第二段文本"],
       "voice": "echo"
     }'

6. 📊 查看任务状态
   curl http://localhost:9876/voice/job/{jobId}

7. 📚 查看用户历史
   curl http://localhost:9876/voice/history/{userId}?type=stt&limit=5

8. 🏢 获取支持的提供商
   curl http://localhost:9876/voice/providers

9. 🎨 获取语音风格
   curl http://localhost:9876/voice/styles

✨ 高级功能:

10. 🎵 自定义语音参数
    - 语速控制 (0.5-2.0)
    - 音调调整 (-0.5到+0.5)
    - 稳定性设置 (0.0-1.0)

11. 🌍 多语言支持
    - 中文（普通话、台湾、粤语）
    - 英语（美国、英国、澳大利亚）
    - 日语、韩语、法语、德语等

12. 🎭 情感表达
    - 自然对话风格
    - 专业播音风格
    - 活泼开朗风格
    - 平静舒缓风格

📁 支持的音频格式:
• STT输入: MP3, MP4, MPEG, MPGA, M4A, WAV, WebM, FLAC
• TTS输出: MP3, OPUS, AAC, FLAC

🎯 最佳实践:
• STT: 使用高质量麦克风，减少背景噪音
• TTS: 选择合适的语音和风格匹配内容类型
• 批量处理: 文件大小控制在25MB以内
• 文本长度: TTS单次请求不超过4096字符

💰 成本估算:
• OpenAI Whisper: $0.006/分钟
• OpenAI TTS: $0.000015/字符
• Azure Speech: $1/小时 (STT), $15/百万字符 (TTS)
• Google Speech: $0.024/小时 (STT), $16/百万字符 (TTS)

EOF
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 语音处理管理脚本

用法:
    ./manage-voice-processor.sh [选项]

选项:
    -s, --stt           语音转文字
    -t, --tts           文字转语音
    -p, --template      使用模板生成语音
    -b, --batch-stt     批量语音转文字
    -B, --batch-tts     批量文字转语音
    -j, --job           查看任务状态
    -h, --history       查看用户历史
    -r, --providers     显示支持的提供商
    -y, --styles        显示支持的风格
    -m, --monitor       监控任务进度
    -e, --examples      显示使用示例
    --stats             显示统计信息
    --help              显示此帮助信息

快速开始:
    # 语音转文字
    ./manage-voice-processor.sh --stt

    # 文字转语音
    ./manage-voice-processor.sh --tts

    # 使用模板
    ./manage-voice-processor.sh --template

    # 批量处理
    ./manage-voice-processor.sh --batch-stt
    ./manage-voice-processor.sh --batch-tts

    # 查看任务状态
    ./manage-voice-processor.sh --job

    # 查看历史
    ./manage-voice-processor.sh --history

    # 查看示例
    ./manage-voice-processor.sh --examples

支持的提供商:
    STT: openai_whisper, azure_speech, google_speech, aws_transcribe
    TTS: openai_tts, azure_speech, google_tts, aws_polly

语音风格:
    natural     - 自然对话风格
    professional - 专业播音风格
    cheerful    - 活泼开朗风格
    calm        - 平静舒缓风格
    dramatic    - 戏剧化风格

音频格式:
    输入: MP3, MP4, MPEG, MPGA, M4A, WAV, WebM, FLAC (最大25MB)
    输出: MP3, OPUS, AAC, FLAC

EOF
}

# 主函数
main() {
    log_header "🎤 Sira AI网关 - 语音处理管理工具"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 参数处理
    case "${1:-}" in
        -s|--stt)
            speech_to_text
            ;;
        -t|--tts)
            text_to_speech
            ;;
        -p|--template)
            text_to_speech_from_template
            ;;
        -b|--batch-stt)
            batch_speech_to_text
            ;;
        -B|--batch-tts)
            batch_text_to_speech
            ;;
        -j|--job)
            check_job_status
            ;;
        -h|--history)
            view_user_history
            ;;
        -r|--providers)
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

    log_success "🎤 语音处理管理任务完成"
}

# 执行主函数
main "$@"
