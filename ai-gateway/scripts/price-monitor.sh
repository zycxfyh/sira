#!/bin/bash

# Sira AI网关 - AI供应商价格监控脚本
# 定期检查各AI供应商的价格更新

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 检查网络连接
check_network() {
    if ! curl -s --head --connect-timeout 5 https://www.google.com > /dev/null; then
        log_error "网络连接失败，请检查网络连接"
        exit 1
    fi
}

# 检查供应商价格文档可访问性
check_price_docs() {
    local provider=$1
    local url=$2

    log_info "检查 $provider 价格文档: $url"

    if curl -s --head --connect-timeout 10 "$url" > /dev/null; then
        log_success "$provider 价格文档可访问"
        return 0
    else
        log_error "$provider 价格文档无法访问: $url"
        return 1
    fi
}

# 生成价格监控报告
generate_price_report() {
    local report_file="price-monitor-report-$(date +%Y%m%d-%H%M%S).md"

    cat > "$report_file" << 'EOF'
# Sira AI网关 - 价格监控报告

**生成时间**: $(date)
**检查状态**: ✅ 完成

## 📋 AI供应商价格文档状态

### 🇺🇸 国际供应商

| 供应商 | 价格文档链接 | 状态 | 更新频率 | 计费方式 |
|--------|-------------|------|----------|----------|
EOF

    # 添加国际供应商状态
    check_price_docs "OpenAI" "https://openai.com/api/pricing/" && echo "| **OpenAI** | [🔗 链接](https://openai.com/api/pricing/) | ✅ 可访问 | 实时 | Token-based |" >> "$report_file" || echo "| **OpenAI** | [🔗 链接](https://openai.com/api/pricing/) | ❌ 不可访问 | 实时 | Token-based |" >> "$report_file"

    check_price_docs "Anthropic" "https://www.anthropic.com/api#pricing" && echo "| **Anthropic** | [🔗 链接](https://www.anthropic.com/api#pricing) | ✅ 可访问 | 实时 | Token-based |" >> "$report_file" || echo "| **Anthropic** | [🔗 链接](https://www.anthropic.com/api#pricing) | ❌ 不可访问 | 实时 | Token-based |" >> "$report_file"

    check_price_docs "Azure OpenAI" "https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/" && echo "| **Azure OpenAI** | [🔗 链接](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) | ✅ 可访问 | 月度 | Token-based |" >> "$report_file" || echo "| **Azure OpenAI** | [🔗 链接](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) | ❌ 不可访问 | 月度 | Token-based |" >> "$report_file"

    check_price_docs "Google Gemini" "https://ai.google.dev/pricing" && echo "| **Google Gemini** | [🔗 链接](https://ai.google.dev/pricing) | ✅ 可访问 | 实时 | Token-based |" >> "$report_file" || echo "| **Google Gemini** | [🔗 链接](https://ai.google.dev/pricing) | ❌ 不可访问 | 实时 | Token-based |" >> "$report_file"

    check_price_docs "Cohere" "https://cohere.com/pricing" && echo "| **Cohere** | [🔗 链接](https://cohere.com/pricing) | ✅ 可访问 | 实时 | Token-based |" >> "$report_file" || echo "| **Cohere** | [🔗 链接](https://cohere.com/pricing) | ❌ 不可访问 | 实时 | Token-based |" >> "$report_file"

    check_price_docs "AI21 Labs" "https://www.ai21.com/pricing" && echo "| **AI21 Labs** | [🔗 链接](https://www.ai21.com/pricing) | ✅ 可访问 | 实时 | Token-based |" >> "$report_file" || echo "| **AI21 Labs** | [🔗 链接](https://www.ai21.com/pricing) | ❌ 不可访问 | 实时 | Token-based |" >> "$report_file"

    check_price_docs "Stability AI" "https://platform.stability.ai/account/billing" && echo "| **Stability AI** | [🔗 链接](https://platform.stability.ai/account/billing) | ✅ 可访问 | 实时 | Credits |" >> "$report_file" || echo "| **Stability AI** | [🔗 链接](https://platform.stability.ai/account/billing) | ❌ 不可访问 | 实时 | Credits |" >> "$report_file"

    check_price_docs "Midjourney" "https://docs.midjourney.com/docs/plans" && echo "| **Midjourney** | [🔗 链接](https://docs.midjourney.com/docs/plans) | ✅ 可访问 | 实时 | Credits |" >> "$report_file" || echo "| **Midjourney** | [🔗 链接](https://docs.midjourney.com/docs/plans) | ❌ 不可访问 | 实时 | Credits |" >> "$report_file"

    check_price_docs "Replicate" "https://replicate.com/pricing" && echo "| **Replicate** | [🔗 链接](https://replicate.com/pricing) | ✅ 可访问 | 实时 | Credits |" >> "$report_file" || echo "| **Replicate** | [🔗 链接](https://replicate.com/pricing) | ❌ 不可访问 | 实时 | Credits |" >> "$report_file"

    # 添加国内供应商状态
    cat >> "$report_file" << 'EOF'

### 🇨🇳 国内供应商

| 供应商 | 价格文档链接 | 状态 | 更新频率 | 计费方式 |
|--------|-------------|------|----------|----------|
EOF

    check_price_docs "DeepSeek" "https://platform.deepseek.com/api-docs/pricing" && echo "| **DeepSeek** | [🔗 链接](https://platform.deepseek.com/api-docs/pricing) | ✅ 可访问 | 实时 | Token-based |" >> "$report_file" || echo "| **DeepSeek** | [🔗 链接](https://platform.deepseek.com/api-docs/pricing) | ❌ 不可访问 | 实时 | Token-based |" >> "$report_file"

    check_price_docs "通义千问" "https://help.aliyun.com/zh/model-studio/developer-reference/tongyi-qianwen-pricing" && echo "| **通义千问** | [🔗 链接](https://help.aliyun.com/zh/model-studio/developer-reference/tongyi-qianwen-pricing) | ✅ 可访问 | 实时 | Token-based |" >> "$report_file" || echo "| **通义千问** | [🔗 链接](https://help.aliyun.com/zh/model-studio/developer-reference/tongyi-qianwen-pricing) | ❌ 不可访问 | 实时 | Token-based |" >> "$report_file"

    check_price_docs "文心一言" "https://cloud.baidu.com/doc/WENXINYIYAN/s/9lrzhegbe" && echo "| **文心一言** | [🔗 链接](https://cloud.baidu.com/doc/WENXINYIYAN/s/9lrzhegbe) | ✅ 可访问 | 月度 | Token-based |" >> "$report_file" || echo "| **文心一言** | [🔗 链接](https://cloud.baidu.com/doc/WENXINYIYAN/s/9lrzhegbe) | ❌ 不可访问 | 月度 | Token-based |" >> "$report_file"

    check_price_docs "智谱GLM" "https://open.bigmodel.cn/pricing" && echo "| **智谱GLM** | [🔗 链接](https://open.bigmodel.cn/pricing) | ✅ 可访问 | 实时 | Token-based |" >> "$report_file" || echo "| **智谱GLM** | [🔗 链接](https://open.bigmodel.cn/pricing) | ❌ 不可访问 | 实时 | Token-based |" >> "$report_file"

    check_price_docs "Kimi" "https://platform.moonshot.cn/docs/pricing" && echo "| **Kimi** | [🔗 链接](https://platform.moonshot.cn/docs/pricing) | ✅ 可访问 | 实时 | Token-based |" >> "$report_file" || echo "| **Kimi** | [🔗 链接](https://platform.moonshot.cn/docs/pricing) | ❌ 不可访问 | 实时 | Token-based |" >> "$report_file"

    check_price_docs "豆包" "https://www.volcengine.com/product/doubao" && echo "| **豆包** | [🔗 链接](https://www.volcengine.com/product/doubao) | ✅ 可访问 | 月度 | Token-based |" >> "$report_file" || echo "| **豆包** | [🔗 链接](https://www.volcengine.com/product/doubao) | ❌ 不可访问 | 月度 | Token-based |" >> "$report_file"

    check_price_docs "腾讯混元" "https://cloud.tencent.com/product/hunyuan/pricing" && echo "| **腾讯混元** | [🔗 链接](https://cloud.tencent.com/product/hunyuan/pricing) | ✅ 可访问 | 月度 | Token-based |" >> "$report_file" || echo "| **腾讯混元** | [🔗 链接](https://cloud.tencent.com/product/hunyuan/pricing) | ❌ 不可访问 | 月度 | Token-based |" >> "$report_file"

    check_price_docs "百度千帆" "https://cloud.baidu.com/product/wenxinworkshop" && echo "| **百度千帆** | [🔗 链接](https://cloud.baidu.com/product/wenxinworkshop) | ✅ 可访问 | 月度 | Token-based |" >> "$report_file" || echo "| **百度千帆** | [🔗 链接](https://cloud.baidu.com/product/wenxinworkshop) | ❌ 不可访问 | 月度 | Token-based |" >> "$report_file"

    # 添加监控建议
    cat >> "$report_file" << 'EOF'

## 💡 价格监控建议

### 🔄 定期检查项目

1. **每日监控**: 设置定时任务每日检查价格文档可访问性
2. **价格变动提醒**: 关注主要供应商的价格调整通知
3. **备用供应商**: 维护多个供应商的备用配置
4. **成本预算**: 设置月度AI使用预算和告警阈值

### 📊 成本优化策略

1. **智能路由**: 根据价格自动选择最经济的供应商
2. **缓存利用**: 减少重复请求，降低API调用成本
3. **批量处理**: 合并小请求为批量处理
4. **预付费方案**: 选择供应商的预付费优惠

### ⚠️ 注意事项

- 价格信息可能随时变动，以官方文档为准
- 国际供应商价格受汇率影响
- 部分供应商有免费额度限制
- 企业用户可申请批量优惠

---

*此报告由 Sira AI网关价格监控脚本自动生成*
EOF

    log_success "价格监控报告已生成: $report_file"
    echo "📄 报告文件: $(pwd)/$report_file"
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 价格监控脚本

用法:
    ./price-monitor.sh [选项]

选项:
    -c, --check     检查所有供应商价格文档可访问性
    -r, --report    生成价格监控报告
    -h, --help      显示此帮助信息

示例:
    ./price-monitor.sh --check     # 检查价格文档可访问性
    ./price-monitor.sh --report    # 生成监控报告

定时任务设置:
    # 每日早上9点执行价格监控
    0 9 * * * /path/to/sira/ai-gateway/scripts/price-monitor.sh --check

EOF
}

# 主函数
main() {
    log_info "🚀 Sira AI网关 - 价格监控脚本启动"

    # 检查网络连接
    check_network

    case "${1:-}" in
        -c|--check)
            log_info "🔍 开始检查AI供应商价格文档可访问性..."

            # 国际供应商检查
            log_info "🌍 检查国际供应商..."
            check_price_docs "OpenAI" "https://openai.com/api/pricing/"
            check_price_docs "Anthropic" "https://www.anthropic.com/api#pricing"
            check_price_docs "Azure OpenAI" "https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/"
            check_price_docs "Google Gemini" "https://ai.google.dev/pricing"
            check_price_docs "Cohere" "https://cohere.com/pricing"
            check_price_docs "AI21 Labs" "https://www.ai21.com/pricing"
            check_price_docs "Stability AI" "https://platform.stability.ai/account/billing"
            check_price_docs "Midjourney" "https://docs.midjourney.com/docs/plans"
            check_price_docs "Replicate" "https://replicate.com/pricing"

            # 国内供应商检查
            log_info "🇨🇳 检查国内供应商..."
            check_price_docs "DeepSeek" "https://platform.deepseek.com/api-docs/pricing"
            check_price_docs "通义千问" "https://help.aliyun.com/zh/model-studio/developer-reference/tongyi-qianwen-pricing"
            check_price_docs "文心一言" "https://cloud.baidu.com/doc/WENXINYIYAN/s/9lrzhegbe"
            check_price_docs "智谱GLM" "https://open.bigmodel.cn/pricing"
            check_price_docs "Kimi" "https://platform.moonshot.cn/docs/pricing"
            check_price_docs "豆包" "https://www.volcengine.com/product/doubao"
            check_price_docs "腾讯混元" "https://cloud.tencent.com/product/hunyuan/pricing"
            check_price_docs "百度千帆" "https://cloud.baidu.com/product/wenxinworkshop"

            log_success "✅ 价格文档可访问性检查完成"
            ;;

        -r|--report)
            log_info "📊 生成价格监控报告..."
            generate_price_report
            ;;

        -h|--help|*)
            show_help
            ;;
    esac

    log_info "✨ 价格监控脚本执行完成"
}

# 执行主函数
main "$@"
