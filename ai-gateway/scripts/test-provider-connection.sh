#!/bin/bash

# Sira AI网关 - AI供应商连接测试脚本
# 测试已配置供应商的连接状态和性能

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
CONFIG_DIR="$SCRIPT_DIR/../config"
RETRY_COUNT=3
TIMEOUT=30

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

# 检查配置文件是否存在
check_config_file() {
    local config_file="$1"
    if [ ! -f "$config_file" ]; then
        log_error "配置文件不存在: $config_file"
        return 1
    fi
    return 0
}

# 读取配置文件
read_config() {
    local config_file="$1"
    local key="$2"

    if ! check_config_file "$config_file"; then
        return 1
    fi

    # 使用简单的grep和sed提取配置值
    grep "^$key:" "$config_file" | sed "s/^$key: *//" | tr -d '"' || echo ""
}

# 测试OpenAI连接
test_openai() {
    local config_file="$1"
    local provider_name="OpenAI"

    local base_url=$(read_config "$config_file" "  base_url")
    local api_key=$(read_config "$config_file" "  api_key")
    local model=$(read_config "$config_file" "  selected_model")

    if [ -z "$base_url" ] || [ -z "$api_key" ] || [ -z "$model" ]; then
        log_error "$provider_name 配置不完整"
        return 1
    fi

    log_info "测试 $provider_name 连接..."

    local start_time=$(date +%s%N)
    local response=$(curl -s --max-time $TIMEOUT -X POST "$base_url/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $api_key" \
        -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\",\"max_tokens\":5}]}" 2>/dev/null)

    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # 毫秒

    if echo "$response" | jq -e '.choices[0].message.content' >/dev/null 2>&1; then
        log_success "$provider_name 连接成功 (响应时间: ${duration}ms)"
        return 0
    else
        local error_msg=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null)
        log_error "$provider_name 连接失败: $error_msg"
        return 1
    fi
}

# 测试Anthropic连接
test_anthropic() {
    local config_file="$1"
    local provider_name="Anthropic"

    local base_url=$(read_config "$config_file" "  base_url")
    local api_key=$(read_config "$config_file" "  api_key")
    local model=$(read_config "$config_file" "  selected_model")

    if [ -z "$base_url" ] || [ -z "$api_key" ] || [ -z "$model" ]; then
        log_error "$provider_name 配置不完整"
        return 1
    fi

    log_info "测试 $provider_name 连接..."

    local start_time=$(date +%s%N)
    local response=$(curl -s --max-time $TIMEOUT -X POST "$base_url/messages" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $api_key" \
        -H "anthropic-version: 2023-06-01" \
        -d "{\"model\":\"$model\",\"max_tokens\":5,\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}" 2>/dev/null)

    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))

    if echo "$response" | jq -e '.content[0].text' >/dev/null 2>&1; then
        log_success "$provider_name 连接成功 (响应时间: ${duration}ms)"
        return 0
    else
        local error_msg=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null)
        log_error "$provider_name 连接失败: $error_msg"
        return 1
    fi
}

# 测试Google Gemini连接
test_google_gemini() {
    local config_file="$1"
    local provider_name="Google Gemini"

    local base_url=$(read_config "$config_file" "  base_url")
    local api_key=$(read_config "$config_file" "  api_key")
    local model=$(read_config "$config_file" "  selected_model")

    if [ -z "$base_url" ] || [ -z "$api_key" ] || [ -z "$model" ]; then
        log_error "$provider_name 配置不完整"
        return 1
    fi

    log_info "测试 $provider_name 连接..."

    local start_time=$(date +%s%N)
    local response=$(curl -s --max-time $TIMEOUT -X POST "$base_url/models/$model:generateContent?key=$api_key" \
        -H "Content-Type: application/json" \
        -d "{\"contents\":[{\"parts\":[{\"text\":\"Hello\"}]}]}" 2>/dev/null)

    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))

    if echo "$response" | jq -e '.candidates[0].content.parts[0].text' >/dev/null 2>&1; then
        log_success "$provider_name 连接成功 (响应时间: ${duration}ms)"
        return 0
    else
        local error_msg=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null)
        log_error "$provider_name 连接失败: $error_msg"
        return 1
    fi
}

# 测试通用OpenAI兼容接口
test_openai_compatible() {
    local config_file="$1"
    local provider_name="$2"

    local base_url=$(read_config "$config_file" "  base_url")
    local api_key=$(read_config "$config_file" "  api_key")
    local model=$(read_config "$config_file" "  selected_model")

    if [ -z "$base_url" ] || [ -z "$api_key" ] || [ -z "$model" ]; then
        log_error "$provider_name 配置不完整"
        return 1
    fi

    log_info "测试 $provider_name 连接..."

    local start_time=$(date +%s%N)
    local response=$(curl -s --max-time $TIMEOUT -X POST "$base_url/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $api_key" \
        -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"max_tokens\":5}" 2>/dev/null)

    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))

    if echo "$response" | jq -e '.choices[0].message.content' >/dev/null 2>&1; then
        log_success "$provider_name 连接成功 (响应时间: ${duration}ms)"
        return 0
    else
        local error_msg=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null)
        log_error "$provider_name 连接失败: $error_msg"
        return 1
    fi
}

# 测试Azure OpenAI连接
test_azure_openai() {
    local config_file="$1"
    local provider_name="Azure OpenAI"

    local base_url=$(read_config "$config_file" "  base_url")
    local api_key=$(read_config "$config_file" "  api_key")
    local model=$(read_config "$config_file" "  selected_model")

    if [ -z "$base_url" ] || [ -z "$api_key" ] || [ -z "$model" ]; then
        log_error "$provider_name 配置不完整"
        return 1
    fi

    log_info "测试 $provider_name 连接..."

    local start_time=$(date +%s%N)
    local response=$(curl -s --max-time $TIMEOUT -X POST "$base_url/chat/completions?api-version=2023-12-01-preview" \
        -H "Content-Type: application/json" \
        -H "api-key: $api_key" \
        -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"max_tokens\":5}" 2>/dev/null)

    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))

    if echo "$response" | jq -e '.choices[0].message.content' >/dev/null 2>&1; then
        log_success "$provider_name 连接成功 (响应时间: ${duration}ms)"
        return 0
    else
        local error_msg=$(echo "$response" | jq -r '.error.message // "未知错误"' 2>/dev/null)
        log_error "$provider_name 连接失败: $error_msg"
        return 1
    fi
}

# 通用测试函数
test_provider() {
    local provider="$1"
    local config_file="$CONFIG_DIR/provider-$provider.yml"

    if [ ! -f "$config_file" ]; then
        log_warn "供应商 $provider 配置文件不存在，跳过测试"
        return 1
    fi

    case $provider in
        openai)
            test_openai "$config_file"
            ;;
        anthropic)
            test_anthropic "$config_file"
            ;;
        google_gemini)
            test_google_gemini "$config_file"
            ;;
        azure_openai)
            test_azure_openai "$config_file"
            ;;
        deepseek|kimi|qwen|glm|doubao|hunyuan|qianfan)
            local provider_name=$(read_config "$config_file" "  name")
            test_openai_compatible "$config_file" "$provider_name"
            ;;
        *)
            log_warn "供应商 $provider 暂不支持自动测试"
            return 1
            ;;
    esac
}

# 重试机制
test_with_retry() {
    local provider="$1"
    local max_retries="$RETRY_COUNT"
    local attempt=1

    while [ $attempt -le $max_retries ]; do
        log_info "测试 $provider (尝试 $attempt/$max_retries)"

        if test_provider "$provider"; then
            return 0
        fi

        if [ $attempt -lt $max_retries ]; then
            log_warn "测试失败，$((max_retries - attempt)) 秒后重试..."
            sleep $((attempt * 2))
        fi

        attempt=$((attempt + 1))
    done

    log_error "供应商 $provider 测试失败，已达到最大重试次数"
    return 1
}

# 生成测试报告
generate_test_report() {
    local report_file="provider-test-report-$(date +%Y%m%d-%H%M%S).md"
    local tested_providers=("$@")

    log_info "生成测试报告: $report_file"

    cat > "$report_file" << EOF
# Sira AI网关 - 供应商连接测试报告

**生成时间**: $(date)
**测试状态**: ✅ 完成

## 📊 测试结果汇总

| 供应商 | 状态 | 响应时间 | 最后测试时间 |
|--------|------|----------|--------------|
EOF

    # 查找所有配置文件
    local config_files=$(find "$CONFIG_DIR" -name "provider-*.yml" 2>/dev/null)

    for config_file in $config_files; do
        local provider=$(basename "$config_file" | sed 's/provider-\(.*\)\.yml/\1/')
        local provider_name=$(read_config "$config_file" "  name")
        local status=$(read_config "$config_file" "  test_result")
        local last_tested=$(read_config "$config_file" "  last_tested")

        if [[ " ${tested_providers[*]} " =~ " $provider " ]]; then
            echo "| $provider_name | ✅ 成功 | - | $last_tested |" >> "$report_file"
        else
            echo "| $provider_name | ❌ 未测试 | - | - |" >> "$report_file"
        fi
    done

    cat >> "$report_file" << 'EOF'

## 🔍 测试详情

### 测试配置
- 重试次数: 3次
- 超时时间: 30秒
- 测试内容: API连接和基础响应

### 常见错误及解决方案

#### 1. 网络连接错误
```
错误: Connection timeout
解决: 检查网络连接，确认API端点可访问
```

#### 2. API密钥错误
```
错误: Invalid API key
解决: 检查API密钥是否正确，是否有足够余额
```

#### 3. 配额不足错误
```
错误: Rate limit exceeded / Quota exceeded
解决: 检查API使用配额，等待重置或升级套餐
```

#### 4. 模型不可用错误
```
错误: Model not found / Model not available
解决: 确认模型名称正确，选择其他可用模型
```

### 🚀 优化建议

1. **定期测试**: 设置定时任务定期测试供应商连接
2. **监控告警**: 配置告警机制，及时发现连接问题
3. **备用供应商**: 配置多个供应商，确保服务可用性
4. **负载均衡**: 根据测试结果调整供应商权重

---

*此报告由 Sira AI网关测试脚本自动生成*
EOF

    log_success "测试报告已生成: $report_file"
    echo "📄 报告文件: $(pwd)/$report_file"
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 供应商连接测试脚本

用法:
    ./test-provider-connection.sh [选项] [供应商...]

选项:
    -a, --all          测试所有已配置的供应商
    -r, --report       生成测试报告
    -p, --provider     指定测试的供应商
    -h, --help         显示此帮助信息

参数:
    供应商              要测试的供应商ID (openai, anthropic, deepseek等)

示例:
    ./test-provider-connection.sh --all                    # 测试所有供应商
    ./test-provider-connection.sh -p openai anthropic      # 测试指定供应商
    ./test-provider-connection.sh --report                 # 生成测试报告

支持的供应商:
    国际: openai, anthropic, azure_openai, google_gemini
    国内: deepseek, qwen, ernie, glm, kimi, doubao, hunyuan, qianfan

EOF
}

# 主函数
main() {
    log_header "🔗 Sira AI网关 - 供应商连接测试"

    # 检查jq是否安装
    if ! command -v jq &> /dev/null; then
        log_error "需要安装jq工具: sudo apt-get install jq"
        exit 1
    fi

    local providers_to_test=()
    local generate_report=false

    # 参数处理
    while [[ $# -gt 0 ]]; do
        case $1 in
            -a|--all)
                # 查找所有配置文件
                local config_files=$(find "$CONFIG_DIR" -name "provider-*.yml" 2>/dev/null)
                for config_file in $config_files; do
                    local provider=$(basename "$config_file" | sed 's/provider-\(.*\)\.yml/\1/')
                    providers_to_test+=("$provider")
                done
                shift
                ;;
            -r|--report)
                generate_report=true
                shift
                ;;
            -p|--provider)
                shift
                while [[ $# -gt 0 && ! $1 =~ ^- ]]; do
                    providers_to_test+=("$1")
                    shift
                done
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                providers_to_test+=("$1")
                shift
                ;;
        esac
    done

    # 如果没有指定供应商，默认测试所有
    if [ ${#providers_to_test[@]} -eq 0 ]; then
        log_info "未指定供应商，测试所有已配置的供应商"
        local config_files=$(find "$CONFIG_DIR" -name "provider-*.yml" 2>/dev/null)
        for config_file in $config_files; do
            local provider=$(basename "$config_file" | sed 's/provider-\(.*\)\.yml/\1/')
            providers_to_test+=("$provider")
        done
    fi

    # 执行测试
    local tested_providers=()
    local success_count=0
    local total_count=${#providers_to_test[@]}

    log_info "开始测试 ${total_count} 个供应商..."

    for provider in "${providers_to_test[@]}"; do
        if test_with_retry "$provider"; then
            success_count=$((success_count + 1))
            tested_providers+=("$provider")

            # 更新配置文件状态
            local config_file="$CONFIG_DIR/provider-$provider.yml"
            if [ -f "$config_file" ]; then
                sed -i "s/test_result:.*/test_result: \"success\"/" "$config_file"
                sed -i "s/last_tested:.*/last_tested: \"$(date +%Y-%m-%dT%H:%M:%SZ)\"/" "$config_file"
            fi
        else
            # 更新配置文件状态
            local config_file="$CONFIG_DIR/provider-$provider.yml"
            if [ -f "$config_file" ]; then
                sed -i "s/test_result:.*/test_result: \"failed\"/" "$config_file"
                sed -i "s/last_tested:.*/last_tested: \"$(date +%Y-%m-%dT%H:%M:%SZ)\"/" "$config_file"
            fi
        fi
    done

    # 显示测试结果
    log_header "📊 测试结果"
    echo "总计供应商: $total_count"
    echo "测试成功: $success_count"
    echo "测试失败: $((total_count - success_count))"
    echo "成功率: $((success_count * 100 / total_count))%"

    # 生成报告
    if [ "$generate_report" = true ]; then
        generate_test_report "${tested_providers[@]}"
    fi

    # 返回状态
    if [ $success_count -eq $total_count ]; then
        log_success "🎉 所有供应商测试完成！"
        exit 0
    else
        log_warn "⚠️ 部分供应商测试失败，请检查配置"
        exit 1
    fi
}

# 执行主函数
main "$@"
