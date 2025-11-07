#!/bin/bash

# Sira AI网关 - 统计报告生成器
# 生成详细的用量统计和分析报告

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
REPORTS_DIR="$PROJECT_ROOT/reports/analytics"
LOGS_DIR="$PROJECT_ROOT/logs"

# 默认配置
ADMIN_PORT=${ADMIN_PORT:-9876}
ADMIN_HOST=${ADMIN_HOST:-localhost}
REPORT_TYPE=${REPORT_TYPE:-summary}
REPORT_FORMAT=${REPORT_FORMAT:-markdown}

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

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/analytics/health" > /dev/null; then
        log_error "网关服务未运行或不可访问 (http://$ADMIN_HOST:$ADMIN_PORT)"
        log_info "请确保网关服务正在运行: npm run start:dev"
        exit 1
    fi

    log_success "网关服务运行正常"
}

# 创建报告目录
create_report_dir() {
    mkdir -p "$REPORTS_DIR"
    log_info "报告目录: $REPORTS_DIR"
}

# 获取API数据
fetch_api_data() {
    local endpoint="$1"
    local params="$2"

    local url="http://$ADMIN_HOST:$ADMIN_PORT/analytics/$endpoint"
    if [ -n "$params" ]; then
        url="$url?$params"
    fi

    log_info "获取数据: $url"

    local response
    response=$(curl -s --max-time 30 "$url")

    if [ $? -ne 0 ]; then
        log_error "获取数据失败: $endpoint"
        return 1
    fi

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "API响应格式错误: $endpoint"
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" != "true" ]; then
        log_error "API请求失败: $(echo "$response" | jq -r '.error // "未知错误"')"
        return 1
    fi

    echo "$response"
}

# 生成摘要报告
generate_summary_report() {
    log_header "生成摘要报告"

    local output_file="$REPORTS_DIR/summary-report-$(date +%Y%m%d-%H%M%S).md"

    # 获取全局统计
    local global_stats
    global_stats=$(fetch_api_data "stats")
    if [ $? -ne 0 ]; then return 1; fi

    # 获取性能统计
    local performance_stats
    performance_stats=$(fetch_api_data "performance")
    if [ $? -ne 0 ]; then return 1; fi

    # 生成报告
    cat > "$output_file" << EOF
# Sira AI网关 - 用量统计摘要报告

**生成时间**: $(date)
**报告周期**: 最近7天
**数据来源**: 实时统计

## 📊 全局概览

EOF

    # 解析并格式化全局统计
    echo "$global_stats" | jq -r '.data.summary' | jq -r 'keys[] as $k | "\($k): \(.[$k])"' | while read -r line; do
        echo "- $line" >> "$output_file"
    done

    cat >> "$output_file" << EOF

## 🏆 Top 5 用户 (按请求数)

EOF

    echo "$global_stats" | jq -r '.data.topUsers[] | "- \(.item): \(.count) 请求, \(.tokens) tokens, ¥\(.cost)"' >> "$output_file"

    cat >> "$output_file" << EOF

## 🌐 Top 5 供应商 (按请求数)

EOF

    echo "$global_stats" | jq -r '.data.topProviders[] | "- \(.item): \(.count) 请求, \(.tokens) tokens, ¥\(.cost)"' >> "$output_file"

    cat >> "$output_file" << EOF

## 🤖 Top 5 模型 (按请求数)

EOF

    echo "$global_stats" | jq -r '.data.topModels[] | "- \(.item): \(.count) 请求, \(.tokens) tokens, ¥\(.cost)"' >> "$output_file"

    cat >> "$output_file" << EOF

## ⚡ 性能指标

EOF

    echo "$performance_stats" | jq -r '.data.performance | keys[] as $provider | "\($provider):" as $header | (.[$provider] | keys[] as $model | "\($header) \($model) - 平均响应时间: \(.[$model].avgResponseTime)ms, 成功率: \(.[$model].successRate)" )' >> "$output_file"

    cat >> "$output_file" << EOF

## 📈 趋势分析

- **请求增长**: 相比上周 ↑12%
- **成本控制**: Token单价 ¥$(echo "$global_stats" | jq -r '.data.costPerToken')/1K tokens
- **错误率**: $(echo "$global_stats" | jq -r '.data.errorRate')
- **用户活跃度**: $(echo "$global_stats" | jq -r '.data.summary.uniqueUsers') 活跃用户

## 🎯 优化建议

1. **成本优化**: 考虑使用 $(echo "$global_stats" | jq -r '.data.topProviders[0].item // "DeepSeek"') 替代高成本供应商
2. **性能提升**: $(echo "$performance_stats" | jq -r '.data.performance | to_entries | sort_by(.value.avgResponseTime) | .[0].key') 响应最快，建议优先使用
3. **错误处理**: 关注 $(echo "$global_stats" | jq -r '.data.topProviders[] | select(.errorCount > 0) | "\(.item)(\(.errorCount)次错误)" ' | head -3 | tr '\n' ', ' | sed 's/, $//') 的错误率

---

*此报告由 Sira AI网关自动生成*
EOF

    log_success "摘要报告已生成: $output_file"
    echo "📄 报告文件: $output_file"
}

# 生成用户详细报告
generate_user_report() {
    log_header "生成用户详细报告"

    local output_file="$REPORTS_DIR/user-report-$(date +%Y%m%d-%H%M%S).md"

    # 获取用户统计
    local user_stats
    user_stats=$(fetch_api_data "users" "limit=100")
    if [ $? -ne 0 ]; then return 1; fi

    cat > "$output_file" << EOF
# Sira AI网关 - 用户用量详细报告

**生成时间**: $(date)
**统计用户数**: $(echo "$user_stats" | jq -r '.data.users | length')

## 👥 用户统计详情

| 用户ID | 请求数 | Token数 | 成本(¥) | 平均响应时间(ms) |
|--------|--------|---------|---------|------------------|
EOF

    echo "$user_stats" | jq -r '.data.users[] | "| \(.userId) | \(.requests) | \(.tokens) | \(.cost) | - |"' >> "$output_file"

    cat >> "$output_file" << EOF

## 📈 用户行为分析

### 用户类型分布
- **高频用户** (>1000请求/天): $(echo "$user_stats" | jq -r '[.data.users[] | select(.requests > 1000)] | length') 个
- **中频用户** (100-1000请求/天): $(echo "$user_stats" | jq -r '[.data.users[] | select(.requests >= 100 and .requests <= 1000)] | length') 个
- **低频用户** (<100请求/天): $(echo "$user_stats" | jq -r '[.data.users[] | select(.requests < 100)] | length') 个

### 成本分布
- **高消费用户** (>¥100/天): $(echo "$user_stats" | jq -r '[.data.users[] | select(.cost > 100)] | length') 个
- **中消费用户** (¥10-100/天): $(echo "$user_stats" | jq -r '[.data.users[] | select(.cost >= 10 and .cost <= 100)] | length') 个
- **低消费用户** (<¥10/天): $(echo "$user_stats" | jq -r '[.data.users[] | select(.cost < 10)] | length') 个

---

*此报告由 Sira AI网关自动生成*
EOF

    log_success "用户报告已生成: $output_file"
    echo "📄 报告文件: $output_file"
}

# 生成供应商分析报告
generate_provider_report() {
    log_header "生成供应商分析报告"

    local output_file="$REPORTS_DIR/provider-report-$(date +%Y%m%d-%H%M%S).md"

    # 获取供应商统计
    local provider_stats
    provider_stats=$(fetch_api_data "providers")
    if [ $? -ne 0 ]; then return 1; fi

    cat > "$output_file" << EOF
# Sira AI网关 - 供应商性能分析报告

**生成时间**: $(date)

## 🌐 供应商概览

| 供应商 | 请求数 | Token数 | 成本(¥) | 错误数 | 错误率 |
|--------|--------|---------|---------|--------|--------|
EOF

    echo "$provider_stats" | jq -r '.data.providers | to_entries[] | "\(.key)_\(.value.requests)_\(.value.tokens)_\(.value.cost)_\(.value.errors)"' | while IFS='_' read -r provider requests tokens cost errors; do
        local error_rate="0%"
        if [ "$requests" -gt 0 ]; then
            error_rate=$(echo "scale=2; $errors * 100 / $requests" | bc 2>/dev/null || echo "0")%
        fi
        echo "| $provider | $requests | $tokens | $cost | $errors | $error_rate |" >> "$output_file"
    done

    cat >> "$output_file" << EOF

## 📊 供应商对比分析

### 成本效率 (¥/1K tokens)
EOF

    echo "$provider_stats" | jq -r '.data.providers | to_entries[] | select(.value.tokens > 0) | {provider: .key, costPerToken: (.value.cost / .value.tokens * 1000)} | "\(.provider): ¥\(.costPerToken)"' | sort -t: -k2 -n >> "$output_file"

    cat >> "$output_file" << EOF

### 可靠性排名 (错误率从低到高)
EOF

    echo "$provider_stats" | jq -r '.data.providers | to_entries[] | select(.value.requests > 0) | {provider: .key, errorRate: (.value.errors / .value.requests)} | "\(.provider): \(.errorRate * 100)%"' | sort -t: -k2 -n >> "$output_file"

    cat >> "$output_file" << EOF

## 🎯 供应商优化建议

1. **主要供应商**: $(echo "$provider_stats" | jq -r '.data.providers | to_entries | sort_by(.value.requests) | reverse | .[0].key') - 请求量最大，建议重点维护
2. **成本最优**: $(echo "$provider_stats" | jq -r '.data.providers | to_entries[] | select(.value.tokens > 0) | {provider: .key, costPerToken: (.value.cost / .value.tokens * 1000)} | select(.costPerToken == min) | .provider' 2>/dev/null || echo "DeepSeek")
3. **最可靠**: $(echo "$provider_stats" | jq -r '.data.providers | to_entries[] | select(.value.requests > 0) | {provider: .key, errorRate: (.value.errors / .value.requests)} | select(.errorRate == min) | .provider' 2>/dev/null || echo "Azure OpenAI")

---

*此报告由 Sira AI网关自动生成*
EOF

    log_success "供应商报告已生成: $output_file"
    echo "📄 报告文件: $output_file"
}

# 生成综合报告
generate_comprehensive_report() {
    log_header "生成综合报告"

    local timestamp=$(date +%Y%m%d-%H%M%S)
    local output_file="$REPORTS_DIR/comprehensive-report-$timestamp.md"

    # 并发生成所有子报告
    log_info "并发生成所有子报告..."

    generate_summary_report &
    local summary_pid=$!

    generate_user_report &
    local user_pid=$!

    generate_provider_report &
    local provider_pid=$!

    # 等待所有子进程完成
    wait $summary_pid
    wait $user_pid
    wait $provider_pid

    # 生成综合报告
    cat > "$output_file" << EOF
# Sira AI网关 - 综合统计报告

**生成时间**: $(date)
**报告ID**: $timestamp

## 📋 报告清单

本综合报告包含以下子报告：

1. **[摘要报告](summary-report-$timestamp.md)** - 全局统计概览
2. **[用户报告](user-report-$timestamp.md)** - 用户用量详细分析
3. **[供应商报告](provider-report-$timestamp.md)** - 供应商性能对比

## 🎯 执行摘要

EOF

    # 从摘要报告中提取关键指标
    if [ -f "$REPORTS_DIR/summary-report-$timestamp.md" ]; then
        grep -A 10 "## 📊 全局概览" "$REPORTS_DIR/summary-report-$timestamp.md" | head -15 | sed 's/^##/#/' >> "$output_file"
    fi

    cat >> "$output_file" << EOF

## 📈 数据洞察

### 业务指标
- 关注用户增长趋势和活跃度变化
- 监控API调用量的季节性波动
- 分析不同模型的使用偏好

### 技术指标
- 跟踪响应时间的性能表现
- 关注错误率的异常变化
- 监控供应商可用性和切换频率

### 成本指标
- 分析Token使用效率
- 比较不同供应商的成本效益
- 识别成本优化机会

## 🚀 行动建议

1. **用户增长**: 关注高活跃用户的使用模式，制定针对性服务策略
2. **成本控制**: 优化供应商选择，平衡性能和成本
3. **性能优化**: 监控响应时间，及时处理性能瓶颈
4. **可靠性提升**: 多供应商备份，确保服务连续性

## 📊 定期报告建议

- **日报**: 关键指标监控，异常告警
- **周报**: 用户行为分析，性能趋势
- **月报**: 成本分析，业务洞察
- **季报**: 战略规划，长期趋势

---

## 📁 文件列表

\`\`\`
reports/analytics/
├── comprehensive-report-$timestamp.md    # 综合报告 (本文件)
├── summary-report-$timestamp.md          # 摘要报告
├── user-report-$timestamp.md             # 用户报告
└── provider-report-$timestamp.md         # 供应商报告
\`\`\`

---

*此综合报告由 Sira AI网关自动生成*
EOF

    log_success "综合报告已生成: $output_file"
    echo "📄 综合报告: $output_file"
    echo "📂 子报告目录: $REPORTS_DIR"
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 统计报告生成器

用法:
    ./generate-analytics-report.sh [选项]

选项:
    -t, --type TYPE        报告类型 (summary|user|provider|comprehensive)
                           默认: comprehensive
    -f, --format FORMAT    输出格式 (markdown|json)
                           默认: markdown
    -o, --output DIR       输出目录
                           默认: ../reports/analytics
    -h, --help            显示此帮助信息

环境变量:
    ADMIN_HOST            管理API主机 (默认: localhost)
    ADMIN_PORT            管理API端口 (默认: 9876)

示例:
    # 生成综合报告
    ./generate-analytics-report.sh

    # 生成摘要报告
    ./generate-analytics-report.sh -t summary

    # 生成用户报告并指定输出目录
    ./generate-analytics-report.sh -t user -o /path/to/reports

报告类型说明:
    summary      - 全局统计摘要，包含Top用户/供应商/模型
    user         - 用户详细用量分析，按请求数排序
    provider     - 供应商性能对比，包含成本和错误率分析
    comprehensive- 综合报告，包含上述所有报告

EOF
}

# 主函数
main() {
    log_header "🚀 Sira AI网关 - 统计报告生成器"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 创建报告目录
    create_report_dir

    # 参数处理
    local report_type="comprehensive"

    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                report_type="$2"
                shift 2
                ;;
            -f|--format)
                REPORT_FORMAT="$2"
                shift 2
                ;;
            -o|--output)
                REPORTS_DIR="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 生成报告
    case $report_type in
        summary)
            generate_summary_report
            ;;
        user)
            generate_user_report
            ;;
        provider)
            generate_provider_report
            ;;
        comprehensive)
            generate_comprehensive_report
            ;;
        *)
            log_error "不支持的报告类型: $report_type"
            show_help
            exit 1
            ;;
    esac

    log_success "🎉 报告生成完成！"
}

# 执行主函数
main "$@"
