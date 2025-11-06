#!/bin/bash

# 文件路径: scripts/failure-monitor.sh
# 职责: 快速失败机制监控和告警系统

set -euo pipefail

# 配置
MONITOR_INTERVAL=60  # 监控间隔（秒）
ALERT_THRESHOLD=3    # 连续失败次数阈值
LOG_FILE="logs/failure-monitor.log"
ALERT_FILE="logs/failure-alerts.log"
METRICS_FILE="logs/failure-metrics.json"

# 创建日志目录
mkdir -p logs

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 全局状态
declare -A FAILURE_COUNTS
declare -A LAST_FAILURE_TIME
declare -A ALERT_SENT

# 日志函数
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # 写入文件
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"

    # 控制台输出
    case "$level" in
        "INFO") echo -e "${BLUE}[$timestamp] [$level]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[$timestamp] [$level]${NC} $message" ;;
        "WARNING") echo -e "${YELLOW}[$timestamp] [$level]${NC} $message" ;;
        "ERROR") echo -e "${RED}[$timestamp] [$level]${NC} $message" ;;
        "CRITICAL") echo -e "${PURPLE}[$timestamp] [$level]${NC} $message" ;;
    esac
}

# 初始化监控系统
init_monitoring() {
    log "INFO" "初始化快速失败监控系统"

    # 初始化计数器
    FAILURE_COUNTS["dependencies"]=0
    FAILURE_COUNTS["local_validation"]=0
    FAILURE_COUNTS["static_checks"]=0
    FAILURE_COUNTS["unit_tests"]=0
    FAILURE_COUNTS["integration_tests"]=0

    # 初始化告警状态
    ALERT_SENT["dependencies"]=false
    ALERT_SENT["local_validation"]=false
    ALERT_SENT["static_checks"]=false
    ALERT_SENT["unit_tests"]=false
    ALERT_SENT["integration_tests"]=false

    # 创建初始指标文件
    create_initial_metrics

    log "SUCCESS" "监控系统初始化完成"
}

# 创建初始指标文件
create_initial_metrics() {
    cat > "$METRICS_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "monitoring_started": "$(date +%s)",
  "stages": {
    "dependencies": {
      "total_runs": 0,
      "failures": 0,
      "last_failure": null,
      "consecutive_failures": 0,
      "avg_duration": 0
    },
    "local_validation": {
      "total_runs": 0,
      "failures": 0,
      "last_failure": null,
      "consecutive_failures": 0,
      "avg_duration": 0
    },
    "static_checks": {
      "total_runs": 0,
      "failures": 0,
      "last_failure": null,
      "consecutive_failures": 0,
      "avg_duration": 0
    },
    "unit_tests": {
      "total_runs": 0,
      "failures": 0,
      "last_failure": null,
      "consecutive_failures": 0,
      "avg_duration": 0
    },
    "integration_tests": {
      "total_runs": 0,
      "failures": 0,
      "last_failure": null,
      "consecutive_failures": 0,
      "avg_duration": 0
    }
  },
  "system_health": {
    "overall_failure_rate": 0,
    "critical_alerts": 0,
    "last_health_check": "$(date +%s)"
  }
}
EOF
}

# 检查测试结果目录
check_test_results() {
    local results_dir="industrial-test-results"

    if [ ! -d "$results_dir" ]; then
        log "WARNING" "测试结果目录不存在: $results_dir"
        return 0
    fi

    # 查找最新的测试结果
    local latest_result
    latest_result=$(find "$results_dir" -name "industrial-test-*.log" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)

    if [ -z "$latest_result" ]; then
        log "INFO" "未找到新的测试结果"
        return 0
    fi

    log "INFO" "分析测试结果: $latest_result"

    # 分析测试结果
    analyze_test_result "$latest_result"
}

# 分析测试结果
analyze_test_result() {
    local result_file="$1"

    # 提取失败信息
    local failures
    failures=$(grep -c "\[CRITICAL\].*失败" "$result_file" 2>/dev/null || echo 0)

    if [ "$failures" -gt 0 ]; then
        log "WARNING" "检测到 $failures 个测试失败"

        # 分析具体的失败阶段
        while IFS= read -r line; do
            if [[ "$line" == *"[CRITICAL]"* ]] && [[ "$line" == *"失败"* ]]; then
                extract_failure_info "$line"
            fi
        done < "$result_file"
    else
        log "SUCCESS" "所有测试阶段通过"
        reset_failure_counts
    fi

    # 更新指标
    update_metrics "$result_file"
}

# 提取失败信息
extract_failure_info() {
    local log_line="$1"

    # 尝试提取阶段名称
    local stage=""
    if [[ "$log_line" == *"依赖"* ]]; then
        stage="dependencies"
    elif [[ "$log_line" == *"本地验证"* ]] || [[ "$log_line" == *"构建"* ]]; then
        stage="local_validation"
    elif [[ "$log_line" == *"静态"* ]] || [[ "$log_line" == *"lint"* ]]; then
        stage="static_checks"
    elif [[ "$log_line" == *"单元测试"* ]]; then
        stage="unit_tests"
    elif [[ "$log_line" == *"集成"* ]]; then
        stage="integration_tests"
    fi

    if [ -n "$stage" ]; then
        record_failure "$stage" "$log_line"
    fi
}

# 记录失败
record_failure() {
    local stage="$1"
    local failure_info="$2"

    # 更新失败计数
    ((FAILURE_COUNTS[$stage]++))
    LAST_FAILURE_TIME["$stage"]=$(date +%s)

    log "ERROR" "阶段 '$stage' 失败 (连续失败: ${FAILURE_COUNTS[$stage]})"

    # 检查是否需要告警
    check_alert_threshold "$stage" "$failure_info"
}

# 检查告警阈值
check_alert_threshold() {
    local stage="$1"
    local failure_info="$2"

    if [ "${FAILURE_COUNTS[$stage]}" -ge "$ALERT_THRESHOLD" ] && [ "${ALERT_SENT[$stage]}" = false ]; then
        send_alert "$stage" "$failure_info"
        ALERT_SENT["$stage"]=true
    fi
}

# 发送告警
send_alert() {
    local stage="$1"
    local failure_info="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    log "CRITICAL" "触发告警: 阶段 '$stage' 连续失败 ${FAILURE_COUNTS[$stage]} 次"

    # 记录告警
    echo "[$timestamp] ALERT: $stage - 连续失败 ${FAILURE_COUNTS[$stage]} 次 - $failure_info" >> "$ALERT_FILE"

    # 发送外部告警（如果配置了）
    send_external_alert "$stage" "$failure_info"
}

# 发送外部告警
send_external_alert() {
    local stage="$1"
    local failure_info="$2"

    # Slack告警
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local slack_message="🚨 *工业化测试告警* 🚨\\n阶段: $stage\\n连续失败: ${FAILURE_COUNTS[$stage]} 次\\n详情: $failure_info\\n时间: $(date)"

        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$slack_message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi

    # 邮件告警（如果配置了SMTP）
    if [ -n "${SMTP_SERVER:-}" ]; then
        send_email_alert "$stage" "$failure_info"
    fi

    # 其他告警渠道可以在这里添加
}

# 发送邮件告警
send_email_alert() {
    local stage="$1"
    local failure_info="$2"

    # 这里需要配置邮件发送逻辑
    # 可以使用 sendmail, postfix, 或第三方服务
    log "INFO" "邮件告警功能待实现 (阶段: $stage)"
}

# 重置失败计数
reset_failure_counts() {
    for stage in "${!FAILURE_COUNTS[@]}"; do
        if [ "${ALERT_SENT[$stage]}" = true ]; then
            log "INFO" "重置阶段 '$stage' 的失败计数 (测试通过)"
            FAILURE_COUNTS["$stage"]=0
            ALERT_SENT["$stage"]=false
        fi
    done
}

# 更新指标
update_metrics() {
    local result_file="$1"

    # 计算各阶段的统计信息
    for stage in dependencies local_validation static_checks unit_tests integration_tests; do
        local runs=0
        local failures=0
        local duration=0

        # 从日志中提取信息（这里是简化实现）
        if [ -f "$result_file" ]; then
            runs=$(grep -c "$stage.*开始\|$stage.*执行" "$result_file" 2>/dev/null || echo 0)
            failures=$(grep -c "$stage.*失败\|$stage.*error" "$result_file" 2>/dev/null || echo 0)

            # 提取耗时（如果日志中有的话）
            local duration_match
            duration_match=$(grep "$stage.*耗时" "$result_file" 2>/dev/null | sed 's/.*耗时: \([0-9]*\)s.*/\1/' | head -1 || echo 0)
            duration="${duration_match:-0}"
        fi

        # 更新JSON指标文件
        jq --arg stage "$stage" \
           --argjson runs "$runs" \
           --argjson failures "$failures" \
           --argjson duration "$duration" \
           '.stages[$stage].total_runs += $runs |
            .stages[$stage].failures += $failures |
            .stages[$stage].last_failure = (if $failures > 0 then $timestamp else .stages[$stage].last_failure end) |
            .stages[$stage].consecutive_failures = (if $failures > 0 then .stages[$stage].consecutive_failures + 1 else 0 end) |
            .stages[$stage].avg_duration = (($duration + .stages[$stage].avg_duration) / 2)' \
           "$METRICS_FILE" > "${METRICS_FILE}.tmp" && mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
    done

    # 更新系统健康状态
    local total_failures
    total_failures=$(jq '.stages | map(.failures) | add' "$METRICS_FILE")
    local total_runs
    total_runs=$(jq '.stages | map(.total_runs) | add' "$METRICS_FILE")

    if [ "$total_runs" -gt 0 ]; then
        local failure_rate=$((total_failures * 100 / total_runs))

        jq --argjson rate "$failure_rate" \
           --arg timestamp "$(date +%s)" \
           '.system_health.overall_failure_rate = $rate |
            .system_health.last_health_check = $timestamp' \
           "$METRICS_FILE" > "${METRICS_FILE}.tmp" && mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
    fi
}

# 生成健康报告
generate_health_report() {
    local report_file="reports/failure-health-report-$(date +%Y%m%d_%H%M%S).md"

    mkdir -p reports

    cat > "$report_file" << EOF
# 快速失败机制健康报告

## 生成时间
$(date)

## 系统概览

EOF

    # 从指标文件中提取信息
    if [ -f "$METRICS_FILE" ]; then
        jq -r '
            "总运行次数: \(.stages | map(.total_runs) | add)",
            "总失败次数: \(.stages | map(.failures) | add)",
            "整体失败率: \(.system_health.overall_failure_rate)%"
        ' "$METRICS_FILE" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## 阶段详情

| 阶段 | 运行次数 | 失败次数 | 连续失败 | 平均耗时 |
|------|----------|----------|----------|----------|
EOF

    if [ -f "$METRICS_FILE" ]; then
        jq -r '.stages | to_entries[] | "\(.key)|\(.value.total_runs)|\(.value.failures)|\(.value.consecutive_failures)|\(.value.avg_duration)"' "$METRICS_FILE" | \
        while IFS='|' read -r stage runs failures consecutive avg_duration; do
            printf "| %s | %s | %s | %s | %s |\n" "$stage" "$runs" "$failures" "$consecutive" "${avg_duration}s"
        done >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## 告警历史

EOF

    if [ -f "$ALERT_FILE" ]; then
        tail -20 "$ALERT_FILE" >> "$report_file" 2>/dev/null || echo "暂无告警记录" >> "$report_file"
    else
        echo "暂无告警记录" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## 建议

EOF

    # 基于指标生成建议
    if [ -f "$METRICS_FILE" ]; then
        local high_failure_stages
        high_failure_stages=$(jq -r '.stages | to_entries[] | select(.value.consecutive_failures > 2) | .key' "$METRICS_FILE")

        if [ -n "$high_failure_stages" ]; then
            echo "### 高风险阶段" >> "$report_file"
            echo "以下阶段连续失败次数过多，建议重点关注：" >> "$report_file"
            echo "$high_failure_stages" | while read -r stage; do
                echo "- $stage" >> "$report_file"
            done
            echo "" >> "$report_file"
        fi
    fi

    cat >> "$report_file" << EOF
### 一般建议
- 定期检查失败模式和趋势
- 优化最常失败的测试阶段
- 确保告警渠道正常工作
- 定期review失败策略配置

---
*此报告由自动监控系统生成*
EOF

    log "SUCCESS" "健康报告已生成: $report_file"
}

# 显示监控状态
show_status() {
    echo -e "${BLUE}快速失败监控系统状态${NC}"
    echo "=========================="
    echo ""

    echo -e "${YELLOW}当前失败计数:${NC}"
    for stage in "${!FAILURE_COUNTS[@]}"; do
        local count="${FAILURE_COUNTS[$stage]}"
        local status_icon="✅"

        if [ "$count" -ge "$ALERT_THRESHOLD" ]; then
            status_icon="🚨"
        elif [ "$count" -gt 0 ]; then
            status_icon="⚠️"
        fi

        printf "  %s %-20s %2d 次\n" "$status_icon" "$stage:" "$count"
    done

    echo ""
    echo -e "${YELLOW}告警状态:${NC}"
    for stage in "${!ALERT_SENT[@]}"; do
        local sent="${ALERT_SENT[$stage]}"
        local status_icon=$([ "$sent" = true ] && echo "📢" || echo "🔕")
        printf "  %s %-20s %s\n" "$status_icon" "$stage:" "$([ "$sent" = true ] && echo "已发送" || echo "未发送")"
    done

    echo ""
    echo -e "${YELLOW}系统指标:${NC}"
    if [ -f "$METRICS_FILE" ]; then
        jq -r '
            "  整体失败率: \(.system_health.overall_failure_rate)%",
            "  关键告警数: \(.system_health.critical_alerts)",
            "  最后检查: \(.system_health.last_health_check | strftime("%Y-%m-%d %H:%M:%S"))"
        ' "$METRICS_FILE" 2>/dev/null || echo "  指标文件读取失败"
    else
        echo "  指标文件不存在"
    fi
}

# 主监控循环
monitor_loop() {
    log "INFO" "启动监控循环 (间隔: ${MONITOR_INTERVAL}s)"

    while true; do
        check_test_results
        sleep "$MONITOR_INTERVAL"
    done
}

# 主函数
main() {
    local command="${1:-monitor}"

    case "$command" in
        "init")
            init_monitoring
            ;;
        "status")
            show_status
            ;;
        "report")
            generate_health_report
            ;;
        "monitor")
            init_monitoring
            monitor_loop
            ;;
        "check")
            check_test_results
            ;;
        "reset")
            log "WARNING" "重置所有失败计数器"
            for stage in "${!FAILURE_COUNTS[@]}"; do
                FAILURE_COUNTS["$stage"]=0
                ALERT_SENT["$stage"]=false
            done
            log "SUCCESS" "失败计数器已重置"
            ;;
        *)
            echo "用法: $0 <命令>"
            echo "命令:"
            echo "  init     初始化监控系统"
            echo "  monitor  启动监控循环"
            echo "  status   显示当前状态"
            echo "  check    检查一次测试结果"
            echo "  report   生成健康报告"
            echo "  reset    重置失败计数器"
            exit 1
            ;;
    esac
}

# 检查jq依赖
if ! command -v jq >/dev/null 2>&1; then
    echo "错误: 需要安装 jq 工具"
    echo "安装方法: apt-get install jq 或 brew install jq"
    exit 1
fi

# 执行主函数
main "$@"
