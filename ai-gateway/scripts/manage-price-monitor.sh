#!/bin/bash

# Sira AI网关 - 价格监控管理脚本
# 借鉴Prometheus和Grafana的设计理念，监控AI服务价格并优化路由

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

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/prices/health" > /dev/null; then
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

# 显示价格监控概览
show_overview() {
    log_header "📊 价格监控概览"

    local response
    response=$(api_request "GET" "prices/dashboard")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取概览数据失败"
        return 1
    fi

    local data
    data=$(echo "$response" | jq -r '.data')

    echo "📈 关键指标:"
    echo "  总提供商数: $(echo "$data" | jq -r '.metrics.totalProviders')"
    echo "  总模型数: $(echo "$data" | jq -r '.metrics.totalModels')"
    echo "  活跃告警数: $(echo "$data" | jq -r '.metrics.activeAlerts')"
    echo "  平均价格波动: $(printf "%.2f" $(echo "$data" | jq -r '.metrics.avgPriceChange * 100'))%"
    echo "  价格波动率: $(printf "%.2f" $(echo "$data" | jq -r '.metrics.priceVolatility * 100'))%"
    echo ""

    echo "🚨 最近告警 (前5个):"
    echo "$data" | jq -r '.recentAlerts[0:5][] | "  • \(.provider)/\(.model): \(.type) \(.changePercent*100 | floor)% at \(.timestamp)"'
    echo ""

    echo "💰 成本节约机会:"
    local savings_response
    savings_response=$(api_request "GET" "prices/cost-savings")

    if echo "$savings_response" | jq -e '.success' >/dev/null 2>&1; then
        local savings
        savings=$(echo "$savings_response" | jq -r '.data.savings')
        local total_savings
        total_savings=$(echo "$savings_response" | jq -r '.data.totalMonthlySavings')

        if [ "$(echo "$savings" | jq -r 'keys | length')" -gt 0 ]; then
            echo "  每月总节约: $${total_savings}"
            echo "$savings" | jq -r 'to_entries[] | "  • \(.key): $\(.value.monthlySavings) (\(.value.percentageSaving | floor)%)"'
        else
            echo "  当前所有路由都已是最优配置"
        fi
    fi
}

# 显示当前价格
show_current_prices() {
    log_header "💰 当前价格列表"

    local response
    response=$(api_request "GET" "prices/current")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取价格数据失败"
        return 1
    fi

    local prices
    prices=$(echo "$response" | jq -r '.data.prices[]')

    echo "提供商/模型                           价格 (USD)     趋势      波动率"
    echo "-------------------------------------------------------------------"

    echo "$prices" | jq -r '"\(.provider)/\(.model)                          "[:35] + "  $" + (.currentPrice | tostring)[:8] + "     " + .trend[:8] + "  " + (.volatility*100 | floor | tostring) + "%"' | sort

    echo ""
    echo "📊 统计信息:"
    echo "  总模型数: $(echo "$prices" | jq -r 'length')"
    echo "  提供商数: $(echo "$prices" | jq -r 'map(.provider) | unique | length')"
}

# 显示价格趋势
show_price_trends() {
    log_header "📈 价格趋势分析"

    local hours=${1:-24}

    local response
    response=$(api_request "GET" "prices/trends?hours=$hours")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取趋势数据失败"
        return 1
    fi

    local trends
    trends=$(echo "$response" | jq -r '.data.trends[]')

    echo "价格趋势分析 (过去 $hours 小时):"
    echo ""

    echo "📊 趋势概览:"
    echo "$trends" | jq -r '"\(.provider)/\(.model): \(.trendDirection) " + (.trendPercent*100 | floor | tostring) + "% (" + (.dataPoints | tostring) + " 个数据点)"'

    echo ""
    echo "💹 显著变化 (>5%):"
    echo "$trends" | jq -r 'select(.trendPercent > 0.05 or .trendPercent < -0.05) | "\(.provider)/\(.model): " + (.trendPercent*100 | floor | tostring) + "% (" + .trendDirection + ")"'

    echo ""
    echo "📈 上涨趋势:"
    echo "$trends" | jq -r 'select(.trendDirection == "up") | "\(.provider)/\(.model): +" + (.trendPercent*100 | floor | tostring) + "%"'

    echo ""
    echo "📉 下跌趋势:"
    echo "$trends" | jq -r 'select(.trendDirection == "down") | "\(.provider)/\(.model): " + (.trendPercent*100 | floor | tostring) + "%"'
}

# 查看价格历史
show_price_history() {
    log_header "📚 价格历史记录"

    echo -n "提供商 (openai/anthropic/google，默认: openai): "
    read -r provider
    provider=${provider:-"openai"}

    echo -n "模型 (gpt-3.5-turbo/gpt-4/claude-3-opus等，默认: gpt-3.5-turbo): "
    read -r model
    model=${model:-"gpt-3.5-turbo"}

    echo -n "时间范围 (小时，默认: 24): "
    read -r hours
    hours=${hours:-24}

    local response
    response=$(api_request "GET" "prices/history/$provider/$model?hours=$hours")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取价格历史失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local history
    history=$(echo "$response" | jq -r '.data.history[]')

    echo "$provider/$model 价格历史 (过去 $hours 小时):"
    echo ""

    if [ "$(echo "$history" | jq -r 'length')" -eq 0 ]; then
        echo "暂无历史数据"
        return
    fi

    echo "时间                      价格      变化"
    echo "--------------------------------------------------"

    echo "$history" | jq -r '"\(.timestamp[:19] | sub("T"; " "))    $" + (.price | tostring)[:6] + "   " + (if .changePercent > 0 then "+" else "" end) + (.changePercent*100 | floor | tostring) + "%"' | tail -20

    echo ""
    echo "📊 统计:"
    local count
    count=$(echo "$history" | jq -r 'length')
    local avg_price
    avg_price=$(echo "$history" | jq -r 'map(.price) | add / length | . * 100 | floor / 100')
    local max_change
    max_change=$(echo "$history" | jq -r 'map(.changePercent) | max * 100 | floor')

    echo "  数据点数量: $count"
    echo "  平均价格: $$avg_price"
    echo "  最大变化: ${max_change}%"
}

# 显示价格告警
show_price_alerts() {
    log_header "🚨 价格告警"

    local hours=${1:-24}

    local response
    response=$(api_request "GET" "prices/alerts?hours=$hours")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取告警数据失败"
        return 1
    fi

    local alerts
    alerts=$(echo "$response" | jq -r '.data.alerts[]')

    local stats
    stats=$(echo "$response" | jq -r '.data.stats')

    echo "价格告警 (过去 $hours 小时):"
    echo ""

    echo "📊 告警统计:"
    echo "  总告警数: $(echo "$stats" | jq -r '.total')"

    if [ "$(echo "$stats" | jq -r '.total')" -gt 0 ]; then
        echo "  按严重程度:"
        echo "$stats" | jq -r '.bySeverity | to_entries[] | "    \(.key): \(.value)"'

        echo "  按提供商:"
        echo "$stats" | jq -r '.byProvider | to_entries[] | "    \(.key): \(.value)"'

        echo "  按类型:"
        echo "$stats" | jq -r '.byType | to_entries[] | "    \(.key): \(.value)"'
    fi

    echo ""
    echo "🚨 最新告警:"

    if [ "$(echo "$alerts" | jq -r 'length')" -eq 0 ]; then
        echo "  无告警记录"
    else
        echo "$alerts" | jq -r '"• \(.timestamp[:19] | sub("T"; " ")) \(.provider)/\(.model) \(.type) " + (.changePercent*100 | floor | tostring) + "% (\(.severity))"' | head -10
    fi
}

# 获取最优路由
show_optimal_routes() {
    log_header "🎯 最优路由推荐"

    local response
    response=$(api_request "GET" "prices/route-optimization")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取路由优化失败"
        return 1
    fi

    local optimizations
    optimizations=$(echo "$response" | jq -r '.data.optimizations')

    echo "基于当前价格的最优路由配置:"
    echo ""

    echo "$optimizations" | jq -r 'to_entries[] | "🎯 \(.key):
  推荐提供商: \(.value.provider)
  模型: \(.value.model)
  价格: $\(.value.price)
  地区: \(.value.region)"'

    echo ""
    echo "💡 使用建议:"
    echo "  • 自动路由会根据这些推荐进行智能切换"
    echo "  • 手动调用时可参考这些建议选择提供商"
    echo "  • 价格实时变化，建议定期检查更新"
}

# 获取特定模型的最优路由
get_optimal_route() {
    log_header "🔍 查询最优路由"

    echo -n "模型类型 (gpt/claude/gemini/image/speech): "
    read -r model_type

    echo -n "最大价格限制 (USD，可选): "
    read -r max_price

    echo -n "要求地区 (可选): "
    read -r region

    if [ -z "$model_type" ]; then
        log_error "模型类型是必需的"
        return 1
    fi

    local query="modelType=$model_type"
    if [ -n "$max_price" ]; then
        query="$query&maxPrice=$max_price"
    fi
    if [ -n "$region" ]; then
        query="$query&requiredRegion=$region"
    fi

    local response
    response=$(api_request "GET" "prices/optimal-route?$query")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取最优路由失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local route
    route=$(echo "$response" | jq -r '.data.optimalRoute')

    echo "为 $model_type 类型推荐的最优路由:"
    echo ""

    echo "🏆 最优选择:"
    echo "  提供商: $(echo "$route" | jq -r '.provider')"
    echo "  模型: $(echo "$route" | jq -r '.model')"
    echo "  价格: $(echo "$route" | jq -r '.price')"
    echo "  地区: $(echo "$route" | jq -r '.region')"

    if [ -n "$max_price" ]; then
        echo "  价格限制: ≤$$max_price"
    fi

    if [ -n "$region" ]; then
        echo "  地区要求: $region"
    fi
}

# 显示成本预测
show_cost_prediction() {
    log_header "🔮 成本预测分析"

    echo -n "模型类型 (gpt/claude/gemini/image/speech): "
    read -r model_type

    echo -n "预测天数 (默认: 30): "
    read -r days
    days=${days:-30}

    if [ -z "$model_type" ]; then
        log_error "模型类型是必需的"
        return 1
    fi

    local response
    response=$(api_request "GET" "prices/prediction?modelType=$model_type&days=$days")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取成本预测失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local prediction
    prediction=$(echo "$response" | jq -r '.data.prediction')

    echo "基于历史数据的 $model_type 成本预测 ($days 天):"
    echo ""

    echo "📊 预测概览:"
    echo "  基于天数: $(echo "$prediction" | jq -r '.basedOnDays')"
    echo "  置信区间: $(printf "%.2f" $(echo "$prediction" | jq -r '.confidenceInterval.lower')) - $(printf "%.2f" $(echo "$prediction" | jq -r '.confidenceInterval.upper'))"
    echo ""

    echo "📈 未来价格预测:"
    echo "日期          预测价格    增长率"
    echo "----------------------------------"

    echo "$prediction" | jq -r '.predictions[] | "\(.date[:10])    $\(.predictedPrice | . * 100 | floor / 100)     " + (if .day > 1 then "+" + (((.predictedPrice - (../predictions[.day-2].predictedPrice // 0)) / (../predictions[.day-2].predictedPrice // 1)) * 100 | floor | tostring) + "%" else "-" end)' | head -10

    echo ""
    echo "💡 解读说明:"
    echo "  • 预测基于历史价格趋势和季节性模式"
    echo "  • 价格可能因市场竞争、需求变化而波动"
    echo "  • 建议结合实际使用情况调整预算"
}

# 创建告警规则
create_alert_rule() {
    log_header "🚨 创建价格告警规则"

    echo -n "提供商: "
    read -r provider

    echo -n "模型: "
    read -r model

    echo -n "变动阈值 (百分比，默认: 5): "
    read -r threshold
    threshold=${threshold:-5}

    echo -n "告警类型 (increase/decrease/both，默认: both): "
    read -r alert_type
    alert_type=${alert_type:-"both"}

    echo -n "严重程度 (low/medium/high，默认: medium): "
    read -r severity
    severity=${severity:-"medium"}

    if [ -z "$provider" ] || [ -z "$model" ]; then
        log_error "提供商和模型都是必需的"
        return 1
    fi

    local request_data="{
        \"provider\": \"$provider\",
        \"model\": \"$model\",
        \"threshold\": $threshold,
        \"type\": \"$alert_type\",
        \"severity\": \"$severity\"
    }"

    local response
    response=$(api_request "POST" "prices/alert-rules" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "创建告警规则失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    local rule
    rule=$(echo "$response" | jq -r '.data.rule')

    log_success "✅ 告警规则创建成功!"
    echo "规则ID: $(echo "$rule" | jq -r '.id')"
    echo "监控: $provider/$model"
    echo "阈值: ${threshold}%"
    echo "类型: $alert_type"
    echo "严重程度: $severity"
}

# 导出价格数据
export_price_data() {
    log_header "💾 导出价格数据"

    echo -n "导出格式 (json/csv，默认: json): "
    read -r format
    format=${format:-"json"}

    local filename="price-monitor-export-$(date +%Y%m%d-%H%M%S).$format"

    log_info "正在导出价格数据到 $filename..."

    local response
    response=$(api_request "GET" "prices/export?format=$format")

    if [ -z "$response" ]; then
        log_error "导出失败，响应为空"
        return 1
    fi

    echo "$response" > "$filename"

    log_success "✅ 价格数据已导出到 $filename"
    echo "文件大小: $(stat -f%z "$filename" 2>/dev/null || stat -c%s "$filename" 2>/dev/null) bytes"
}

# 手动更新价格
manual_update() {
    log_header "🔄 手动更新价格"

    log_info "正在触发价格数据更新..."

    local response
    response=$(api_request "POST" "prices/update")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "价格更新失败"
        echo "$response" | jq -r '.error'
        return 1
    fi

    log_success "✅ 价格数据更新完成"
    echo "更新时间: $(echo "$response" | jq -r '.timestamp')"
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 价格监控管理脚本

用法:
    ./manage-price-monitor.sh [选项]

选项:
    -o, --overview        显示价格监控概览
    -p, --prices          显示当前价格列表
    -t, --trends          显示价格趋势分析
    -h, --history         查看价格历史记录
    -a, --alerts          显示价格告警
    -r, --routes          显示最优路由推荐
    -g, --get-route       查询特定模型的最优路由
    -c, --prediction      显示成本预测分析
    -l, --alert-rule      创建价格告警规则
    -e, --export          导出价格数据
    -u, --update          手动更新价格
    --help                显示此帮助信息

快速开始:
    # 查看概览
    ./manage-price-monitor.sh --overview

    # 查看当前价格
    ./manage-price-monitor.sh --prices

    # 查看价格趋势
    ./manage-price-monitor.sh --trends

    # 查看告警
    ./manage-price-monitor.sh --alerts

    # 获取最优路由
    ./manage-price-monitor.sh --routes

    # 查看历史记录
    ./manage-price-monitor.sh --history

    # 成本预测
    ./manage-price-monitor.sh --prediction

    # 创建告警规则
    ./manage-price-monitor.sh --alert-rule

    # 导出数据
    ./manage-price-monitor.sh --export

支持的模型类型:
    gpt      - GPT系列模型 (OpenAI)
    claude   - Claude系列模型 (Anthropic)
    gemini   - Gemini系列模型 (Google)
    image    - 图像生成模型
    speech   - 语音处理模型

告警类型:
    increase - 价格上涨告警
    decrease - 价格下跌告警
    both     - 价格涨跌都告警

严重程度:
    low      - 低优先级
    medium   - 中优先级
    high     - 高优先级

EOF
}

# 主函数
main() {
    log_header "📊 Sira AI网关 - 价格监控管理工具"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 参数处理
    case "${1:-}" in
        -o|--overview)
            show_overview
            ;;
        -p|--prices)
            show_current_prices
            ;;
        -t|--trends)
            show_price_trends "${2:-24}"
            ;;
        -h|--history)
            show_price_history
            ;;
        -a|--alerts)
            show_price_alerts "${2:-24}"
            ;;
        -r|--routes)
            show_optimal_routes
            ;;
        -g|--get-route)
            get_optimal_route
            ;;
        -c|--prediction)
            show_cost_prediction
            ;;
        -l|--alert-rule)
            create_alert_rule
            ;;
        -e|--export)
            export_price_data
            ;;
        -u|--update)
            manual_update
            ;;
        --help|*)
            show_help
            ;;
    esac

    log_success "📊 价格监控管理任务完成"
}

# 执行主函数
main "$@"
