#!/bin/bash

# Sira AI网关 - 参数管理脚本
# 管理AI模型参数配置、预设和验证

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

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/parameters" > /dev/null; then
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
    fi
}

# 显示参数预设
show_presets() {
    log_header "📋 参数预设列表"

    local response
    response=$(api_request "GET" "parameters/presets")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取预设失败"
        return 1
    fi

    echo "$response" | jq -r '.data.presets | to_entries[] | "🎯 \(.key): \(.value.name)\n   \(.value.description)\n   参数: \(.value.parameters | tostring)\n"'
}

# 验证参数
validate_parameters() {
    log_header "🔍 参数验证"

    echo -n "请输入要验证的参数 (JSON格式): "
    read -r param_input

    if [ -z "$param_input" ]; then
        log_error "参数不能为空"
        return 1
    fi

    # 验证JSON格式
    if ! echo "$param_input" | jq . >/dev/null 2>&1; then
        log_error "参数格式不正确，必须是有效的JSON"
        return 1
    fi

    echo -n "供应商 (可选): "
    read -r provider

    echo -n "模型 (可选): "
    read -r model

    local request_data="{\"parameters\": $param_input"
    if [ -n "$provider" ]; then
        request_data="$request_data, \"provider\": \"$provider\""
    fi
    if [ -n "$model" ]; then
        request_data="$request_data, \"model\": \"$model\""
    fi
    request_data="$request_data}"

    local response
    response=$(api_request "POST" "parameters/validate" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "参数验证失败"
        return 1
    fi

    local validation
    validation=$(echo "$response" | jq -r '.data.validation')

    if echo "$validation" | jq -e '.valid' | grep -q true; then
        log_success "✅ 参数验证通过"
    else
        log_error "❌ 参数验证失败"
        echo "$validation" | jq -r '.errors[]' | sed 's/^/  - /'
    fi

    if echo "$validation" | jq -e '.warnings' | grep -q '\[]'; then
        echo ""
        log_warn "⚠️ 参数警告:"
        echo "$validation" | jq -r '.warnings[]' | sed 's/^/  - /'
    fi
}

# 优化参数
optimize_parameters() {
    log_header "🚀 参数优化"

    echo -n "请输入要优化的参数 (JSON格式): "
    read -r param_input

    if [ -z "$param_input" ]; then
        log_error "参数不能为空"
        return 1
    fi

    if ! echo "$param_input" | jq . >/dev/null 2>&1; then
        log_error "参数格式不正确，必须是有效的JSON"
        return 1
    fi

    echo -n "任务类型 (creative/coding/analytical/conversational/translation/summarization): "
    read -r task_type

    echo -n "模型 (可选): "
    read -r model

    local request_data="{\"parameters\": $param_input"
    if [ -n "$task_type" ]; then
        request_data="$request_data, \"taskType\": \"$task_type\""
    fi
    if [ -n "$model" ]; then
        request_data="$request_data, \"model\": \"$model\""
    fi
    request_data="$request_data}"

    local response
    response=$(api_request "POST" "parameters/optimize" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "参数优化失败"
        return 1
    fi

    local data
    data=$(echo "$response" | jq -r '.data')

    log_success "✅ 参数优化完成"

    echo ""
    echo "📊 优化结果:"
    echo "原始参数: $(echo "$data" | jq -r '.original')"
    echo "优化参数: $(echo "$data" | jq -r '.optimized')"

    local improvements
    improvements=$(echo "$data" | jq -r '.improvements[]')
    if [ -n "$improvements" ]; then
        echo ""
        echo "🎯 优化改进:"
        echo "$improvements" | sed 's/^/  - /'
    fi
}

# 测试参数配置
test_parameters() {
    log_header "🧪 参数测试"

    echo -n "供应商: "
    read -r provider

    echo -n "模型: "
    read -r model

    if [ -z "$provider" ] || [ -z "$model" ]; then
        log_error "供应商和模型都是必需的"
        return 1
    fi

    echo -n "测试消息 (可选): "
    read -r message

    echo -n "任务类型 (可选): "
    read -r task_type

    echo -n "自定义参数 (JSON格式，可选): "
    read -r param_input

    local request_data="{\"provider\": \"$provider\", \"model\": \"$model\""
    if [ -n "$message" ]; then
        request_data="$request_data, \"message\": \"$message\""
    fi
    if [ -n "$task_type" ]; then
        request_data="$request_data, \"taskType\": \"$task_type\""
    fi
    if [ -n "$param_input" ]; then
        if ! echo "$param_input" | jq . >/dev/null 2>&1; then
            log_error "参数格式不正确"
            return 1
        fi
        request_data="$request_data, \"parameters\": $param_input"
    fi
    request_data="$request_data}"

    local response
    response=$(api_request "POST" "parameters/test" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "参数测试失败"
        return 1
    fi

    log_success "✅ 参数测试完成"

    local data
    data=$(echo "$response" | jq -r '.data')

    echo ""
    echo "📋 测试结果:"
    echo "使用的参数: $(echo "$data" | jq -r '.parameters')"
    echo "验证结果: $(echo "$data" | jq -r '.validation.valid')"
    echo "模拟响应: $(echo "$data" | jq -r '.mockResponse.success')"
}

# 显示参数规则
show_rules() {
    log_header "📏 参数规则"

    echo -n "查看特定参数规则 (留空查看所有): "
    read -r param_name

    local endpoint="parameters/rules"
    if [ -n "$param_name" ]; then
        endpoint="$endpoint?parameter=$param_name"
    fi

    local response
    response=$(api_request "GET" "$endpoint")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取参数规则失败"
        return 1
    fi

    local data
    data=$(echo "$response" | jq -r '.data')

    if [ -n "$param_name" ]; then
        echo "参数: $param_name"
        echo "范围: $(echo "$data" | jq -r '.min // "N/A"') - $(echo "$data" | jq -r '.max // "N/A"')"
        echo "默认值: $(echo "$data" | jq -r '.default // "N/A"')"
        echo "描述: $(echo "$data" | jq -r '.description // "N/A"')"
    else
        echo "$data" | jq -r 'to_entries[] | "🔧 \(.key): \(.value.min // "N/A") - \(.value.max // "N/A") (默认: \(.value.default // "N/A"))\n   \(.value.description // "N/A")\n"'
    fi
}

# 显示供应商映射
show_mappings() {
    log_header "🔄 参数映射"

    echo -n "查看特定供应商映射 (留空查看所有): "
    read -r provider_name

    local endpoint="parameters/mappings"
    if [ -n "$provider_name" ]; then
        endpoint="$endpoint?provider=$provider_name"
    fi

    local response
    response=$(api_request "GET" "$endpoint")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取参数映射失败"
        return 1
    fi

    local data
    data=$(echo "$response" | jq -r '.data')

    if [ -n "$provider_name" ]; then
        echo "供应商: $provider_name"
        echo "$data" | jq -r 'to_entries[] | "  \(.key) → \(.value // "不支持")"'
    else
        echo "支持的供应商:"
        echo "$data" | jq -r '.providers | keys[]' | sed 's/^/  - /'
        echo ""
        echo "输入供应商名称查看详细映射"
    fi
}

# 显示使用示例
show_examples() {
    log_header "💡 使用示例"

    cat << 'EOF'
🔥 热门使用场景:

1. 🎨 创意写作
   参数预设: creative
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "gpt-4",
       "messages": [{"role": "user", "content": "写一首关于AI的诗"}],
       "parameter_preset": "creative"
     }'

2. 💻 代码生成
   参数预设: coding
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "deepseek-coder",
       "messages": [{"role": "user", "content": "写一个快速排序算法"}],
       "parameter_preset": "coding"
     }'

3. 📊 数据分析
   参数预设: analytical
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "gpt-4",
       "messages": [{"role": "user", "content": "分析这份销售数据"}],
       "parameter_preset": "analytical"
     }'

4. 💬 日常对话
   参数预设: conversational
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "kimi",
       "messages": [{"role": "user", "content": "你好，今天怎么样？"}],
       "parameter_preset": "conversational"
     }'

5. 🔠 文本翻译
   参数预设: translation
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "qwen-max",
       "messages": [{"role": "user", "content": "翻译: Hello world"}],
       "parameter_preset": "translation"
     }'

✨ 高级用法:

6. 自定义参数
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "gpt-4",
       "messages": [{"role": "user", "content": "自定义参数示例"}],
       "parameters": {
         "temperature": 0.7,
         "top_p": 0.9,
         "frequency_penalty": 0.1,
         "max_tokens": 1000
       }
     }'

7. 任务类型优化
   API调用:
   curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
     -H "x-task-type: creative" \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-key" \
     -d '{
       "model": "claude-3-opus",
       "messages": [{"role": "user", "content": "写一个短故事"}]
     }'

EOF
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 参数管理脚本

用法:
    ./manage-parameters.sh [选项]

选项:
    -p, --presets      显示所有参数预设
    -v, --validate     验证参数配置
    -o, --optimize     优化参数配置
    -t, --test         测试参数配置
    -r, --rules        显示参数验证规则
    -m, --mappings     显示供应商参数映射
    -e, --examples     显示使用示例
    -h, --help         显示此帮助信息

环境变量:
    ADMIN_HOST         管理API主机 (默认: localhost)
    ADMIN_PORT         管理API端口 (默认: 9876)

示例:
    # 显示参数预设
    ./manage-parameters.sh --presets

    # 验证参数
    ./manage-parameters.sh --validate

    # 优化参数
    ./manage-parameters.sh --optimize

    # 查看使用示例
    ./manage-parameters.sh --examples

EOF
}

# 主函数
main() {
    log_header "🎛️ Sira AI网关 - 参数管理工具"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 参数处理
    case "${1:-}" in
        -p|--presets)
            show_presets
            ;;
        -v|--validate)
            validate_parameters
            ;;
        -o|--optimize)
            optimize_parameters
            ;;
        -t|--test)
            test_parameters
            ;;
        -r|--rules)
            show_rules
            ;;
        -m|--mappings)
            show_mappings
            ;;
        -e|--examples)
            show_examples
            ;;
        -h|--help|*)
            show_help
            ;;
    esac

    log_success "🎉 参数管理任务完成"
}

# 执行主函数
main "$@"
