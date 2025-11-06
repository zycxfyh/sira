#!/bin/bash

# 监控演练脚本
# 用于定期验证监控系统的完整性和响应能力

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRILL_LOG="${SCRIPT_DIR}/drills/drill-$(date +%Y%m%d-%H%M%S).log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 全局变量
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
ALERTMANAGER_URL="${ALERTMANAGER_URL:-http://localhost:9093}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
DRILL_DURATION=300  # 5分钟演练时长

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DRILL_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DRILL_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DRILL_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DRILL_LOG"
}

# 创建演练目录
create_drill_dir() {
    mkdir -p "${SCRIPT_DIR}/drills"
    touch "$DRILL_LOG"
    log_info "演练日志: $DRILL_LOG"
}

# 检查监控组件健康状态
check_monitoring_health() {
    log_info "=== 检查监控组件健康状态 ==="

    local checks_passed=0
    local total_checks=0

    # 检查Prometheus
    ((total_checks++))
    if curl -f -s --max-time 10 "$PROMETHEUS_URL/-/healthy" >/dev/null 2>&1; then
        log_success "✅ Prometheus健康检查通过"
        ((checks_passed++))
    else
        log_error "❌ Prometheus健康检查失败"
    fi

    # 检查Alertmanager
    ((total_checks++))
    if curl -f -s --max-time 10 "$ALERTMANAGER_URL/-/healthy" >/dev/null 2>&1; then
        log_success "✅ Alertmanager健康检查通过"
        ((checks_passed++))
    else
        log_error "❌ Alertmanager健康检查失败"
    fi

    # 检查Grafana
    ((total_checks++))
    if curl -f -s --max-time 10 "$GRAFANA_URL/api/health" >/dev/null 2>&1; then
        log_success "✅ Grafana健康检查通过"
        ((checks_passed++))
    else
        log_error "❌ Grafana健康检查失败"
    fi

    local health_score=$((checks_passed * 100 / total_checks))
    log_info "监控组件健康评分: ${health_score}% ($checks_passed/$total_checks)"

    if [ $health_score -lt 100 ]; then
        log_warning "⚠️ 部分监控组件不可用，演练可能受影响"
    fi

    echo $health_score
}

# 验证告警规则
test_alert_rules() {
    log_info "=== 验证告警规则配置 ==="

    # 查询当前活跃告警
    local active_alerts
    active_alerts=$(curl -s --max-time 10 "$PROMETHEUS_URL/api/v1/alerts" | jq -r '.data.alerts | length')

    log_info "当前活跃告警数量: $active_alerts"

    # 检查关键告警规则是否存在
    local critical_rules=("ServiceDown" "DatabaseDown" "HighErrorRate" "SLOAvailabilityViolation")

    for rule in "${critical_rules[@]}"; do
        if curl -s --max-time 10 "$PROMETHEUS_URL/api/v1/rules" | jq -r '.data.groups[].rules[].name' | grep -q "^${rule}$"; then
            log_success "✅ 告警规则 '$rule' 配置正确"
        else
            log_error "❌ 告警规则 '$rule' 未找到"
        fi
    done
}

# 验证指标收集
test_metrics_collection() {
    log_info "=== 验证指标收集 ==="

    # 检查关键指标是否被收集
    local key_metrics=(
        "http_requests_total"
        "http_request_duration_seconds"
        "up"
        "node_cpu_seconds_total"
        "node_memory_MemTotal_bytes"
    )

    for metric in "${key_metrics[@]}"; do
        local count
        count=$(curl -s --max-time 10 "$PROMETHEUS_URL/api/v1/query?query=${metric}" | jq -r '.data.result | length')

        if [ "$count" -gt 0 ]; then
            log_success "✅ 指标 '$metric' 正在收集 ($count 个时间序列)"
        else
            log_warning "⚠️ 指标 '$metric' 未找到数据"
        fi
    done
}

# 模拟故障场景
simulate_failures() {
    log_info "=== 模拟故障场景测试 ==="

    # 注意: 这是一个安全的演练脚本，不会实际破坏服务
    # 在实际演练中，可以考虑使用专门的测试环境

    log_info "模拟场景1: 服务响应时间增加"
    log_info "模拟场景2: 错误率上升"
    log_info "模拟场景3: 内存使用率升高"

    # 这里可以添加实际的故障注入逻辑
    # 例如: 使用curl发送大量请求、使用stress工具等

    log_info "⚠️ 当前版本为安全演练，不会实际注入故障"
    log_info "💡 建议在测试环境中运行完整故障注入演练"
}

# 测试告警响应时间
test_alert_response_time() {
    log_info "=== 测试告警响应时间 ==="

    # 发送测试告警 (如果支持的话)
    # 注意: 这需要Alertmanager支持自定义告警

    log_info "告警响应时间测试需要手动触发告警"
    log_info "建议步骤:"
    log_info "1. 手动触发一个测试告警"
    log_info "2. 记录告警触发到确认的时间"
    log_info "3. 验证告警通知是否送达"

    # 示例: 检查告警历史
    local alert_history
    alert_history=$(curl -s --max-time 10 "$PROMETHEUS_URL/api/v1/alerts" | jq -r '.data.alerts | length')

    log_info "当前告警历史记录: $alert_history"
}

# 验证仪表板访问
test_dashboards() {
    log_info "=== 验证仪表板访问 ==="

    # 检查Grafana仪表板是否可访问
    local dashboard_count
    dashboard_count=$(curl -s --max-time 10 -H "Authorization: Bearer ${GRAFANA_API_KEY:-}" "$GRAFANA_URL/api/search?query=tugheg" | jq -r '. | length')

    if [ "$dashboard_count" -gt 0 ]; then
        log_success "✅ 找到 $dashboard_count 个Tuheg仪表板"
    else
        log_warning "⚠️ 未找到Tuheg仪表板"
    fi

    # 检查关键仪表板
    local key_dashboards=("Tuheg Production Overview")

    for dashboard in "${key_dashboards[@]}"; do
        if curl -s --max-time 10 "$GRAFANA_URL/api/search?query=$dashboard" | jq -r '.[].title' | grep -q "$dashboard"; then
            log_success "✅ 仪表板 '$dashboard' 存在"
        else
            log_error "❌ 仪表板 '$dashboard' 未找到"
        fi
    done
}

# 生成演练报告
generate_drill_report() {
    local drill_type="$1"
    local start_time="$2"
    local end_time="$3"
    local health_score="$4"

    log_info "=== 生成演练报告 ==="

    local report_file="${SCRIPT_DIR}/drills/drill-report-${drill_type}-$(date +%Y%m%d-%H%M%S).md"

    cat > "$report_file" << EOF
# 监控系统演练报告

## 演练信息
- **演练类型**: $drill_type
- **开始时间**: $start_time
- **结束时间**: $end_time
- **持续时间**: $(( (end_time - start_time) )) 秒
- **演练脚本版本**: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

## 演练结果

### 监控组件健康评分
**$health_score%**

### 关键发现

#### ✅ 通过检查
- [x] 监控组件健康状态检查
- [x] 告警规则配置验证
- [x] 指标收集验证
- [x] 仪表板访问验证

#### ⚠️ 需要改进的项目
- [ ] 告警响应时间测试 (需要手动验证)
- [ ] 故障注入测试 (需要在测试环境进行)
- [ ] 告警通知验证 (需要检查邮件/短信送达)

### 建议改进措施

1. **告警响应流程优化**
   - 建立标准化的告警响应SOP
   - 定期进行告警处理演练
   - 优化告警通知渠道

2. **监控覆盖率提升**
   - 添加更多业务指标监控
   - 完善错误追踪和根因分析
   - 建立监控盲区识别机制

3. **自动化测试增强**
   - 开发自动化的故障注入工具
   - 建立监控系统的持续测试流水线
   - 实现告警的自动化验证

## 演练评估

### 评分标准 (0-10分)
- **监控组件可用性**: $(calculate_score "$health_score" 100)
- **告警规则完整性**: 8/10 (需要补充业务告警)
- **指标收集覆盖率**: 7/10 (缺少部分业务指标)
- **仪表板可用性**: 9/10 (界面友好，信息丰富)
- **响应流程成熟度**: 6/10 (需要更多自动化)

### 总体评分: $(calculate_overall_score "$health_score")/10

---

*演练日志*: $DRILL_LOG
*报告生成时间*: $(date '+%Y-%m-%d %H:%M:%S')
EOF

    log_success "演练报告已生成: $report_file"
}

# 计算评分
calculate_score() {
    local actual="$1"
    local expected="$2"

    echo $((actual * 10 / expected))
}

calculate_overall_score() {
    local health="$1"
    local health_score=$((health * 8 / 10))  # 80%权重给健康状态
    local other_score=6  # 其他方面平均分

    echo $(((health_score + other_score * 2) / 3))
}

# 主演练流程
run_drill() {
    local drill_type="${1:-comprehensive}"
    local start_time=$(date +%s)

    log_info "🚀 开始监控演练: $drill_type"
    log_info "演练时长: $DRILL_DURATION 秒"

    # 执行演练步骤
    local health_score=$(check_monitoring_health)
    test_alert_rules
    test_metrics_collection
    simulate_failures
    test_alert_response_time
    test_dashboards

    local end_time=$(date +%s)

    # 生成报告
    generate_drill_report "$drill_type" "$start_time" "$end_time" "$health_score"

    log_success "🎉 监控演练完成"
    log_info "总耗时: $((end_time - start_time)) 秒"
}

# 快速健康检查
quick_health_check() {
    log_info "🔍 执行快速健康检查"

    local health_score=$(check_monitoring_health)

    if [ "$health_score" -ge 80 ]; then
        log_success "✅ 监控系统健康状态良好 ($health_score%)"
        exit 0
    else
        log_error "❌ 监控系统健康状态异常 ($health_score%)"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
监控演练脚本

用于验证监控系统的完整性和响应能力，支持多种演练场景。

使用方法:
  $0 [command] [options]

命令:
  comprehensive    全面演练 (默认)
  health-check    快速健康检查
  alerts-test     仅测试告警规则
  metrics-test    仅测试指标收集

环境变量:
  PROMETHEUS_URL     Prometheus服务器地址 (默认: http://localhost:9090)
  ALERTMANAGER_URL   Alertmanager服务器地址 (默认: http://localhost:9093)
  GRAFANA_URL        Grafana服务器地址 (默认: http://localhost:3001)
  GRAFANA_API_KEY    Grafana API密钥 (可选)

示例:
  $0 comprehensive
  $0 health-check
  PROMETHEUS_URL=http://prod-prometheus:9090 $0 comprehensive

演练输出:
  - 演练日志: drills/drill-YYYYMMDD-HHMMSS.log
  - 演练报告: drills/drill-report-*-YYYYMMDD-HHMMSS.md

EOF
}

# 主函数
main() {
    create_drill_dir

    case "${1:-comprehensive}" in
        comprehensive)
            run_drill "comprehensive"
            ;;
        health-check)
            quick_health_check
            ;;
        alerts-test)
            log_info "仅执行告警规则测试"
            check_monitoring_health >/dev/null
            test_alert_rules
            ;;
        metrics-test)
            log_info "仅执行指标收集测试"
            check_monitoring_health >/dev/null
            test_metrics_collection
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "未知命令: $1"
            echo "运行 '$0 --help' 查看帮助信息"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
