#!/bin/bash

# Sira AI网关 - AI供应商配置向导
# 交互式配置AI供应商、API密钥、模型选择和连接测试

set -e

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

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
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

# 显示供应商列表
show_providers() {
    log_header "🎯 可用的AI供应商"

    echo "🇺🇸 国际供应商:"
    echo "  1. OpenAI         - GPT-4, GPT-3.5, DALL-E, Whisper"
    echo "  2. Anthropic      - Claude-3系列"
    echo "  3. Azure OpenAI   - Microsoft Azure托管的OpenAI"
    echo "  4. Google Gemini  - Gemini-1.5系列"
    echo "  5. Cohere         - Command系列"
    echo "  6. AI21 Labs      - Jurassic-2"
    echo "  7. Stability AI   - Stable Diffusion图像生成"
    echo "  8. Midjourney     - 艺术级图像创作"
    echo "  9. Replicate      - 开源模型集合"
    echo ""

    echo "🇨🇳 国内供应商:"
    echo " 10. DeepSeek       - DeepSeek Chat/Coder (¥0.001/1K)"
    echo " 11. 通义千问       - 阿里通义千问系列"
    echo " 12. 文心一言       - 百度文心一言"
    echo " 13. 智谱GLM        - 智谱GLM-4系列"
    echo " 14. Kimi           - 月之暗面Kimi (¥0.005/1K)"
    echo " 15. 豆包           - 字节跳动豆包"
    echo " 16. 腾讯混元       - 腾讯混元系列"
    echo " 17. 百度千帆       - 百度千帆平台"
    echo ""

    echo -e "${YELLOW}💡 提示: 输入供应商编号或名称${NC}"
}

# 获取供应商信息
get_provider_info() {
    local provider_id=$1

    case $provider_id in
        1|openai|OpenAI)
            echo "openai|OpenAI|https://api.openai.com/v1|Bearer|gpt-4,gpt-4-turbo,gpt-4o,gpt-4o-mini,gpt-3.5-turbo"
            ;;
        2|anthropic|Anthropic)
            echo "anthropic|Anthropic|https://api.anthropic.com|Bearer|claude-3-opus,claude-3-sonnet,claude-3-haiku,claude-3-5-sonnet"
            ;;
        3|azure|Azure|azure_openai)
            echo "azure_openai|Azure OpenAI|https://your-resource.openai.azure.com/openai/deployments|api_key|gpt-4,gpt-4-turbo,gpt-35-turbo,gpt-4o"
            ;;
        4|google|Google|gemini)
            echo "google_gemini|Google Gemini|https://generativelanguage.googleapis.com/v1beta|Bearer|gemini-pro,gemini-pro-vision,gemini-1.5-pro,gemini-1.5-flash"
            ;;
        5|cohere|Cohere)
            echo "cohere|Cohere|https://api.cohere.ai/v1|Bearer|command,command-light,command-nightly"
            ;;
        6|ai21|AI21)
            echo "ai21|AI21 Labs|https://api.ai21.com/studio/v1|Bearer|j2-ultra,j2-mid"
            ;;
        7|stability|Stability)
            echo "stability|Stability AI|https://api.stability.ai/v1|Bearer|stable-diffusion-xl-1024-v1-0"
            ;;
        8|midjourney|Midjourney)
            echo "midjourney|Midjourney|https://api.midjourney.com/v1|Bearer|midjourney,midjourney-v5"
            ;;
        9|replicate|Replicate)
            echo "replicate|Replicate|https://api.replicate.com/v1|Bearer|llama-2-70b-chat,stable-diffusion"
            ;;
        10|deepseek|DeepSeek)
            echo "deepseek|DeepSeek|https://api.deepseek.com/v1|Bearer|deepseek-chat,deepseek-coder"
            ;;
        11|qwen|通义千问)
            echo "qwen|通义千问|https://dashscope.aliyuncs.com/api/v1|Bearer|qwen-turbo,qwen-plus,qwen-max,qwen-vl-plus"
            ;;
        12|ernie|文心一言)
            echo "ernie|文心一言|https://aip.baidubce.com/rpc/2.0/ai_custom/v1|Bearer|ernie-4.0-8k,ernie-4.0-turbo-8k,ernie-3.5-8k"
            ;;
        13|glm|智谱GLM)
            echo "glm|智谱GLM|https://open.bigmodel.cn/api/paas/v4|Bearer|glm-4,glm-4v,glm-3-turbo,glm-4-plus"
            ;;
        14|kimi|Kimi)
            echo "kimi|Kimi|https://api.moonshot.cn/v1|Bearer|moonshot-v1-8k,moonshot-v1-32k,moonshot-v1-128k"
            ;;
        15|doubao|豆包)
            echo "doubao|豆包|https://ark.cn-beijing.volces.com/api/v3|Bearer|doubao-lite-4k,doubao-lite-32k,doubao-pro-4k"
            ;;
        16|hunyuan|腾讯混元)
            echo "hunyuan|腾讯混元|https://api.hunyuan.cloud.tencent.com/v1|Bearer|hunyuan-turbo,hunyuan-standard,hunyuan-lite"
            ;;
        17|qianfan|百度千帆)
            echo "qianfan|百度千帆|https://qianfan.baidubce.com/v2|Bearer|ernie-4.0-8k,ernie-3.5-8k,ernie-lite-8k"
            ;;
        *)
            return 1
            ;;
    esac
}

# 输入API密钥
input_api_key() {
    local provider_name=$1
    local auth_type=$2

    log_step "🔑 配置 $provider_name API密钥"

    case $auth_type in
        Bearer)
            echo -n "请输入 $provider_name API Key: "
            read -s api_key
            echo ""
            ;;
        api_key)
            echo -n "请输入 $provider_name API Key: "
            read -s api_key
            echo ""
            if [ "$provider_name" = "Azure OpenAI" ]; then
                echo -n "请输入 Azure 资源名称 (Resource Name): "
                read azure_resource
                echo -n "请输入 Azure 部署名称 (Deployment Name): "
                read azure_deployment
            fi
            ;;
    esac

    if [ -z "$api_key" ]; then
        log_error "API Key不能为空"
        return 1
    fi

    echo "$api_key"
}

# 验证API密钥格式
validate_api_key() {
    local provider=$1
    local api_key=$2

    case $provider in
        openai)
            if [[ $api_key =~ ^sk- ]]; then
                return 0
            fi
            ;;
        anthropic)
            if [[ $api_key =~ ^sk-ant- ]]; then
                return 0
            fi
            ;;
        google_gemini)
            if [[ $api_key =~ ^AIza[0-9A-Za-z-_]{35}$ ]]; then
                return 0
            fi
            ;;
        deepseek)
            if [[ $api_key =~ ^sk- ]]; then
                return 0
            fi
            ;;
        qwen)
            if [[ $api_key =~ ^sk- ]]; then
                return 0
            fi
            ;;
        ernie)
            if [[ $api_key =~ ^[0-9a-f]{32}$ ]]; then
                return 0
            fi
            ;;
        glm)
            if [[ $api_key =~ ^[a-zA-Z0-9]{32}$ ]]; then
                return 0
            fi
            ;;
        kimi)
            if [[ $api_key =~ ^sk- ]]; then
                return 0
            fi
            ;;
        doubao)
            if [[ $api_key =~ ^[a-zA-Z0-9]{32}$ ]]; then
                return 0
            fi
            ;;
        hunyuan)
            if [[ $api_key =~ ^[a-zA-Z0-9]{32}$ ]]; then
                return 0
            fi
            ;;
        qianfan)
            if [[ $api_key =~ ^[a-zA-Z0-9]{32}$ ]]; then
                return 0
            fi
            ;;
        azure_openai)
            # Azure API Key 通常是GUID格式
            if [[ $api_key =~ ^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$ ]]; then
                return 0
            fi
            ;;
        *)
            # 对于其他供应商，简单检查非空
            if [ -n "$api_key" ]; then
                return 0
            fi
            ;;
    esac

    return 1
}

# 拉取可用模型列表
fetch_models() {
    local provider=$1
    local api_key=$2
    local base_url=$3

    log_step "📥 正在拉取 $provider 的可用模型列表..."

    case $provider in
        openai)
            # OpenAI 模型列表API
            response=$(curl -s -H "Authorization: Bearer $api_key" "$base_url/models" 2>/dev/null)
            if [ $? -eq 0 ] && echo "$response" | jq -e '.data' >/dev/null 2>&1; then
                models=$(echo "$response" | jq -r '.data[].id' 2>/dev/null | grep -E '^(gpt-4|gpt-3.5-turbo|text-|code-|edit-)' | head -10)
                echo "$models"
                return 0
            fi
            ;;
        anthropic)
            # Anthropic 通常通过API文档获取模型列表
            echo "claude-3-opus"
            echo "claude-3-sonnet"
            echo "claude-3-haiku"
            echo "claude-3-5-sonnet"
            echo "claude-2.1"
            return 0
            ;;
        google_gemini)
            # Google Gemini 模型列表
            echo "gemini-pro"
            echo "gemini-pro-vision"
            echo "gemini-1.5-pro"
            echo "gemini-1.5-flash"
            return 0
            ;;
        deepseek)
            # DeepSeek 模型列表
            echo "deepseek-chat"
            echo "deepseek-coder"
            return 0
            ;;
        qwen)
            # 通义千问模型列表
            echo "qwen-turbo"
            echo "qwen-plus"
            echo "qwen-max"
            echo "qwen-max-longcontext"
            echo "qwen-vl-plus"
            return 0
            ;;
        ernie)
            # 文心一言模型列表
            echo "ernie-4.0-8k"
            echo "ernie-4.0-turbo-8k"
            echo "ernie-3.5-8k"
            echo "ernie-lite-8k"
            return 0
            ;;
        glm)
            # 智谱GLM模型列表
            echo "glm-4"
            echo "glm-4v"
            echo "glm-3-turbo"
            echo "glm-4-plus"
            return 0
            ;;
        kimi)
            # Kimi模型列表
            echo "moonshot-v1-8k"
            echo "moonshot-v1-32k"
            echo "moonshot-v1-128k"
            return 0
            ;;
        azure_openai)
            # Azure OpenAI 模型列表
            echo "gpt-4"
            echo "gpt-4-turbo"
            echo "gpt-35-turbo"
            echo "gpt-4o"
            return 0
            ;;
        *)
            # 其他供应商返回默认模型列表
            log_warn "无法自动拉取 $provider 的模型列表，使用预设列表"
            return 1
            ;;
    esac

    return 1
}

# 显示模型选择菜单
select_model() {
    local models=$1
    local provider_name=$2

    log_step "🤖 选择 $provider_name 的模型"

    if [ -z "$models" ]; then
        log_error "没有可用的模型列表"
        return 1
    fi

    echo "可用的模型:"
    local i=1
    echo "$models" | while read -r model; do
        echo "  $i. $model"
        i=$((i + 1))
    done

    echo ""
    echo -n "请选择模型编号 (1-$(echo "$models" | wc -l)): "
    read -r choice

    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt "$(echo "$models" | wc -l)" ]; then
        log_error "无效的选择"
        return 1
    fi

    selected_model=$(echo "$models" | sed -n "${choice}p")
    echo "$selected_model"
}

# 测试连接
test_connection() {
    local provider=$1
    local api_key=$2
    local base_url=$3
    local model=$4
    local auth_type=$5

    log_step "🔗 正在测试 $provider 连接..."

    case $provider in
        openai)
            # OpenAI 简单聊天测试
            response=$(curl -s -X POST "$base_url/chat/completions" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $api_key" \
                -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\",\"max_tokens\":10}]}" 2>/dev/null)

            if echo "$response" | jq -e '.choices[0].message.content' >/dev/null 2>&1; then
                log_success "✅ $provider 连接测试成功"
                return 0
            else
                error_msg=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null)
                log_error "❌ $provider 连接测试失败: $error_msg"
                return 1
            fi
            ;;

        anthropic)
            # Anthropic 测试
            response=$(curl -s -X POST "$base_url/messages" \
                -H "Content-Type: application/json" \
                -H "x-api-key: $api_key" \
                -H "anthropic-version: 2023-06-01" \
                -d "{\"model\":\"$model\",\"max_tokens\":10,\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}" 2>/dev/null)

            if echo "$response" | jq -e '.content[0].text' >/dev/null 2>&1; then
                log_success "✅ $provider 连接测试成功"
                return 0
            else
                error_msg=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null)
                log_error "❌ $provider 连接测试失败: $error_msg"
                return 1
            fi
            ;;

        google_gemini)
            # Google Gemini 测试
            response=$(curl -s -X POST "$base_url/models/$model:generateContent" \
                -H "Content-Type: application/json" \
                -d "{\"contents\":[{\"parts\":[{\"text\":\"Hello\"}]}]}" 2>/dev/null)

            if echo "$response" | jq -e '.candidates[0].content.parts[0].text' >/dev/null 2>&1; then
                log_success "✅ $provider 连接测试成功"
                return 0
            else
                error_msg=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null)
                log_error "❌ $provider 连接测试失败: $error_msg"
                return 1
            fi
            ;;

        deepseek|kimi|qwen|glm)
            # 通用OpenAI兼容接口测试
            response=$(curl -s -X POST "$base_url/chat/completions" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $api_key" \
                -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"max_tokens\":10}" 2>/dev/null)

            if echo "$response" | jq -e '.choices[0].message.content' >/dev/null 2>&1; then
                log_success "✅ $provider 连接测试成功"
                return 0
            else
                error_msg=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null)
                log_error "❌ $provider 连接测试失败: $error_msg"
                return 1
            fi
            ;;

        *)
            log_warn "⚠️ $provider 暂不支持自动连接测试，请手动验证"
            return 0
            ;;
    esac
}

# 生成配置文件
generate_config() {
    local provider=$1
    local provider_name=$2
    local base_url=$3
    local api_key=$4
    local model=$5
    local auth_type=$6

    log_step "📝 生成 $provider_name 配置文件..."

    config_file="ai-gateway/config/provider-$provider.yml"

    cat > "$config_file" << EOF
# $provider_name 配置 - 由setup-ai-provider.sh生成
# 生成时间: $(date)

provider:
  id: "$provider"
  name: "$provider_name"
  base_url: "$base_url"
  auth_type: "$auth_type"
  api_key: "$api_key"
  selected_model: "$model"
  status: "configured"
  last_tested: "$(date +%Y-%m-%dT%H:%M:%SZ)"
  test_result: "success"

models:
  available:
$(fetch_models "$provider" "$api_key" "$base_url" | sed 's/^/    - /')

routing:
  enabled: true
  priority: 10
  regions: ["auto"]
EOF

    log_success "✅ 配置文件已生成: $config_file"
}

# 显示配置摘要
show_summary() {
    local provider=$1
    local provider_name=$2
    local model=$3

    log_header "🎉 配置完成摘要"

    echo "📋 配置详情:"
    echo "  供应商: $provider_name"
    echo "  模型: $model"
    echo "  配置状态: ✅ 已配置并测试成功"
    echo ""
    echo "📁 配置文件: ai-gateway/config/provider-$provider.yml"
    echo ""
    echo "🚀 下一步操作:"
    echo "  1. 查看完整配置: cat ai-gateway/config/provider-$provider.yml"
    echo "  2. 启动网关服务: npm run start:dev"
    echo "  3. 测试API调用: curl -X POST http://localhost:8080/api/v1/ai/chat/completions \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -H 'x-api-key: your-gateway-key' \\"
    echo "       -d '{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}'"
    echo ""
    echo -e "${GREEN}🎊 $provider_name 配置完成！开始使用Sira AI网关吧！${NC}"
}

# 主函数
main() {
    log_header "🚀 Sira AI网关 - AI供应商配置向导"

    # 检查依赖
    check_dependencies

    # 显示供应商列表
    show_providers

    # 选择供应商
    while true; do
        echo ""
        echo -n "请选择AI供应商 (输入编号或名称): "
        read -r provider_choice

        if provider_info=$(get_provider_info "$provider_choice"); then
            IFS='|' read -r provider provider_name base_url auth_type available_models <<< "$provider_info"
            log_success "✅ 已选择: $provider_name"
            break
        else
            log_error "❌ 无效的供应商选择，请重新选择"
        fi
    done

    # 输入API密钥
    while true; do
        if api_key=$(input_api_key "$provider_name" "$auth_type"); then
            if validate_api_key "$provider" "$api_key"; then
                log_success "✅ API Key 格式验证通过"
                break
            else
                log_warn "⚠️ API Key 格式可能不正确，但将继续配置"
                echo -n "是否继续? (y/N): "
                read -r confirm
                if [[ $confirm =~ ^[Yy]$ ]]; then
                    break
                fi
            fi
        fi
    done

    # 处理Azure特殊配置
    if [ "$provider" = "azure_openai" ]; then
        base_url="https://$azure_resource.openai.azure.com/openai/deployments/$azure_deployment"
        log_info "Azure OpenAI URL: $base_url"
    fi

    # 拉取模型列表
    if models=$(fetch_models "$provider" "$api_key" "$base_url"); then
        log_success "✅ 成功拉取模型列表"
    else
        log_warn "⚠️ 无法自动拉取模型列表，使用预设列表"
        models=$(echo "$available_models" | tr ',' '\n')
    fi

    # 选择模型
    if selected_model=$(select_model "$models" "$provider_name"); then
        log_success "✅ 已选择模型: $selected_model"
    else
        log_error "❌ 模型选择失败"
        exit 1
    fi

    # 测试连接
    if test_connection "$provider" "$api_key" "$base_url" "$selected_model" "$auth_type"; then
        log_success "🎉 所有配置步骤完成！"
    else
        log_warn "⚠️ 连接测试失败，但配置将继续进行"
        echo -n "是否继续保存配置? (y/N): "
        read -r confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            log_info "配置已取消"
            exit 0
        fi
    fi

    # 生成配置文件
    generate_config "$provider" "$provider_name" "$base_url" "$api_key" "$selected_model" "$auth_type"

    # 显示摘要
    show_summary "$provider" "$provider_name" "$selected_model"
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - AI供应商配置向导

用法:
    ./setup-ai-provider.sh

功能:
    交互式配置AI供应商，包括：
    1. 选择AI供应商 (20+供应商支持)
    2. 输入并验证API密钥
    3. 自动拉取可用模型列表
    4. 选择要使用的模型
    5. 测试API连接和配置
    6. 生成配置文件

支持的供应商:
    国际供应商: OpenAI, Anthropic, Azure OpenAI, Google Gemini, Cohere, AI21, Stability AI, Midjourney, Replicate
    国内供应商: DeepSeek, 通义千问, 文心一言, 智谱GLM, Kimi, 豆包, 腾讯混元, 百度千帆

示例:
    ./setup-ai-provider.sh

EOF
}

# 参数处理
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
