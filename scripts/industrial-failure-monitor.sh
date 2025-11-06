#!/bin/bash

set -euo pipefail

# 工业级快速失败监控系统 v2.0
# 自动检测失败模式，触发快速失败机制，生成智能报告

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
MONITOR_LOG="logs/industrial-monitor.log"
FAILURE_DB=".industrial-cache/failure-patterns.json"
ALERT_HISTORY=".industrial-cache/alert-history.json"
METRICS_DB=".industrial-cache/pipeline-metrics.json"

# 初始化监控系统
init_monitor() {
    echo "🚀 Initializing Industrial Failure Monitor v2.0"
    mkdir -p logs .industrial-cache industrial-reports

    # 初始化失败模式数据库
    if [ ! -f "$FAILURE_DB" ]; then
        cat > "$FAILURE_DB" << 'EOF'
{
  "failure_patterns": {
    "dependency_conflicts": {
      "pattern": "ERR_PNPM_OUTDATED_LOCKFILE|Cannot resolve dependency",
      "severity": "high",
      "failure_strategy": "immediate",
      "description": "Dependency resolution conflicts - critical infrastructure issue"
    },
    "type_errors": {
      "pattern": "TS[0-9]+.*error|Property.*does not exist|Cannot find module",
      "severity": "high",
      "failure_strategy": "immediate",
      "description": "TypeScript compilation errors - code quality issue"
    },
    "lint_failures": {
      "pattern": "error.*eslint|ESLint.*error|lint.*failed",
      "severity": "medium",
      "failure_strategy": "warn_and_continue",
      "description": "Code style and quality violations"
    },
    "test_failures": {
      "pattern": "FAILED.*tests|test.*failed|coverage.*below",
      "severity": "critical",
      "failure_strategy": "immediate",
      "description": "Unit/integration test failures - functionality broken"
    },
    "security_vulnerabilities": {
      "pattern": "high.*vulnerability|critical.*security|security.*alert",
      "severity": "critical",
      "failure_strategy": "immediate",
      "description": "Security vulnerabilities detected - immediate action required"
    },
    "performance_regression": {
      "pattern": "performance.*degraded|benchmark.*failed|timeout.*exceeded",
      "severity": "medium",
      "failure_strategy": "warn_and_continue",
      "description": "Performance benchmarks not met"
    },
    "integration_breaks": {
      "pattern": "integration.*failed|service.*unavailable|connection.*refused",
      "severity": "high",
      "failure_strategy": "retry",
      "description": "Service integration issues - may be transient"
    }
  },
  "failure_statistics": {
    "total_failures": 0,
    "patterns_detected": {},
    "failure_trends": [],
    "last_updated": ""
  }
}
EOF
    fi

    # 初始化告警历史
    if [ ! -f "$ALERT_HISTORY" ]; then
        cat > "$ALERT_HISTORY" << 'EOF'
{
  "alerts": [],
  "escalation_levels": {
    "low": {"threshold": 3, "notify_channels": ["log"]},
    "medium": {"threshold": 5, "notify_channels": ["log", "slack"]},
    "high": {"threshold": 10, "notify_channels": ["log", "slack", "email"]},
    "critical": {"threshold": 15, "notify_channels": ["log", "slack", "email", "sms"]}
  }
}
EOF
    fi

    # 初始化指标数据库
    if [ ! -f "$METRICS_DB" ]; then
        cat > "$METRICS_DB" << 'EOF'
{
  "pipeline_metrics": {
    "total_runs": 0,
    "successful_runs": 0,
    "failed_runs": 0,
    "average_execution_time": 0,
    "failure_rate": 0,
    "stage_failure_rates": {},
    "performance_trends": []
  },
  "quality_metrics": {
    "average_coverage": 0,
    "lint_error_trend": [],
    "test_pass_rate": 0,
    "security_score": 0
  }
}
EOF
    fi

    log_monitor "Industrial Failure Monitor initialized successfully"
}

# 记录监控日志
log_monitor() {
    local message="$1"
    local level="${2:-INFO}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] [$level] $message" >> "$MONITOR_LOG"

    case "$level" in
        "CRITICAL") echo -e "${RED}[CRITICAL]${NC} $message" >&2 ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" >&2 ;;
        "WARN") echo -e "${YELLOW}[WARN]${NC} $message" >&2 ;;
        "INFO") echo -e "${BLUE}[INFO]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
        *) echo -e "${BLUE}[$level]${NC} $message" ;;
    esac
}

# 分析日志并检测失败模式
analyze_failure_patterns() {
    local log_content="$1"
    local detected_patterns=()

    log_monitor "Analyzing failure patterns in log content..."

    # 读取失败模式配置
    local patterns
    patterns=$(jq -r '.failure_patterns | keys[]' "$FAILURE_DB")

    for pattern_key in $patterns; do
        local pattern_config
        pattern_config=$(jq -r ".failure_patterns.\"$pattern_key\"" "$FAILURE_DB")

        local pattern_regex
        pattern_regex=$(echo "$pattern_config" | jq -r '.pattern')

        local severity
        severity=$(echo "$pattern_config" | jq -r '.severity')

        local description
        description=$(echo "$pattern_config" | jq -r '.description')

        # 检查是否匹配模式
        if echo "$log_content" | grep -qE "$pattern_regex"; then
            detected_patterns+=("$pattern_key")
            log_monitor "Pattern detected: $pattern_key ($severity) - $description" "WARN"

            # 更新统计信息
            update_failure_statistics "$pattern_key"
        fi
    done

    echo "${detected_patterns[@]}"
}

# 更新失败统计信息
update_failure_statistics() {
    local pattern_key="$1"

    # 增加总失败次数
    jq '.failure_statistics.total_failures += 1' "$FAILURE_DB" > "${FAILURE_DB}.tmp" && mv "${FAILURE_DB}.tmp" "$FAILURE_DB"

    # 增加模式检测次数
    jq --arg pattern "$pattern_key" '.failure_statistics.patterns_detected[$pattern] = (.failure_statistics.patterns_detected[$pattern] // 0) + 1' "$FAILURE_DB" > "${FAILURE_DB}.tmp" && mv "${FAILURE_DB}.tmp" "$FAILURE_DB"

    # 更新最后更新时间
    jq --arg time "$(date)" '.failure_statistics.last_updated = $time' "$FAILURE_DB" > "${FAILURE_DB}.tmp" && mv "${FAILURE_DB}.tmp" "$FAILURE_DB"
}

# 确定失败策略
determine_failure_strategy() {
    local detected_patterns=("$@")
    local highest_severity="low"
    local recommended_strategy="warn_and_continue"

    for pattern in "${detected_patterns[@]}"; do
        local severity
        severity=$(jq -r ".failure_patterns.\"$pattern\".severity" "$FAILURE_DB")

        # 确定最高严重程度
        case "$severity" in
            "critical") highest_severity="critical" ;;
            "high") [ "$highest_severity" != "critical" ] && highest_severity="high" ;;
            "medium") [ "$highest_severity" = "low" ] && highest_severity="medium" ;;
        esac

        # 确定推荐策略
        local strategy
        strategy=$(jq -r ".failure_patterns.\"$pattern\".failure_strategy" "$FAILURE_DB")

        if [ "$strategy" = "immediate" ]; then
            recommended_strategy="immediate"
        elif [ "$strategy" = "retry" ] && [ "$recommended_strategy" != "immediate" ]; then
            recommended_strategy="retry"
        fi
    done

    echo "$highest_severity:$recommended_strategy"
}

# 执行快速失败机制
execute_fast_failure() {
    local severity="$1"
    local strategy="$2"
    local detected_patterns=("${@:3}")

    log_monitor "Executing fast failure mechanism - Severity: $severity, Strategy: $strategy" "CRITICAL"

    # 生成快速失败报告
    generate_failure_report "$severity" "$strategy" "${detected_patterns[@]}"

    # 根据策略执行相应动作
    case "$strategy" in
        "immediate")
            log_monitor "IMMEDIATE FAILURE: Terminating pipeline immediately" "CRITICAL"
            echo "IMMEDIATE_FAILURE_TRIGGERED"
            exit 1
            ;;
        "retry")
            log_monitor "RETRY STRATEGY: Will attempt retry in next stage" "WARN"
            echo "RETRY_SCHEDULED"
            ;;
        "warn_and_continue")
            log_monitor "WARNING: Continuing with warnings - manual review recommended" "WARN"
            echo "WARNING_ISSUED"
            ;;
        *)
            log_monitor "Unknown failure strategy: $strategy" "ERROR"
            echo "STRATEGY_UNKNOWN"
            ;;
    esac
}

# 生成失败报告
generate_failure_report() {
    local severity="$1"
    local strategy="$2"
    local detected_patterns=("${@:3}")

    local report_file="industrial-reports/failure-report-$(date +%Y%m%d_%H%M%S).md"

    log_monitor "Generating failure analysis report: $report_file"

    cat > "$report_file" << EOF
# Industrial Fast Failure Analysis Report

## Failure Summary
- **Detection Time**: $(date '+%Y-%m-%d %H:%M:%S')
- **Severity Level**: $severity
- **Failure Strategy**: $strategy
- **Detected Patterns**: ${#detected_patterns[@]}

## Detected Failure Patterns

EOF

    for pattern in "${detected_patterns[@]}"; do
        local config
        config=$(jq -r ".failure_patterns.\"$pattern\"" "$FAILURE_DB")
        local description
        description=$(echo "$config" | jq -r '.description')

        cat >> "$report_file" << EOF
### $pattern
- **Description**: $description
- **Configuration**: $config

EOF
    done

    cat >> "$report_file" << EOF

## Recommended Actions

EOF

    case "$strategy" in
        "immediate")
            cat >> "$report_file" << EOF
### 🚨 IMMEDIATE ACTION REQUIRED

The pipeline has been terminated due to critical failure patterns:

$(for pattern in "${detected_patterns[@]}"; do
    echo "- **$pattern**: $(jq -r ".failure_patterns.\"$pattern\".description" "$FAILURE_DB")"
done)

**Immediate Steps:**
1. Review the detected failure patterns above
2. Check the full pipeline logs for detailed error messages
3. Address the root causes identified
4. Rerun the pipeline after fixes are implemented

EOF
            ;;
        "retry")
            cat >> "$report_file" << EOF
### 🔄 RETRY STRATEGY ACTIVATED

Non-critical failures detected that may be transient:

$(for pattern in "${detected_patterns[@]}"; do
    echo "- **$pattern**: $(jq -r ".failure_patterns.\"$pattern\".description" "$FAILURE_DB")"
done)

**Next Steps:**
1. Automatic retry will be attempted
2. Monitor retry results
3. If retries fail, manual intervention may be required

EOF
            ;;
        "warn_and_continue")
            cat >> "$report_file" << EOF
### ⚠️ WARNING ISSUED - CONTINUING EXECUTION

Quality issues detected but not critical enough to stop the pipeline:

$(for pattern in "${detected_patterns[@]}"; do
    echo "- **$pattern**: $(jq -r ".failure_patterns.\"$pattern\".description" "$FAILURE_DB")"
done)

**Recommendations:**
1. Address these issues in the next development cycle
2. Consider adding automated fixes for these patterns
3. Monitor for trend increases that may require immediate action

EOF
            ;;
    esac

    cat >> "$report_file" << EOF

## Failure Statistics

\`\`\`json
$(jq '.failure_statistics' "$FAILURE_DB")
\`\`\`

## Pattern Analysis

### Most Common Failures
$(jq -r '.failure_statistics.patterns_detected | to_entries | sort_by(.value) | reverse | .[0:5][] | "- \(.key): \(.value) occurrences"' "$FAILURE_DB")

### Failure Trends
- Total Failures: $(jq -r '.failure_statistics.total_failures' "$FAILURE_DB")
- Last Updated: $(jq -r '.failure_statistics.last_updated' "$FAILURE_DB")

---
*Generated by Industrial Failure Monitor v2.0*
EOF

    log_monitor "Failure report generated: $report_file"
}

# 发送告警通知
send_alert_notification() {
    local severity="$1"
    local strategy="$2"
    local report_file="$3"

    log_monitor "Sending alert notification for $severity failure"

    # 记录告警到历史
    jq --arg severity "$severity" \
       --arg strategy "$strategy" \
       --arg report "$report_file" \
       --arg time "$(date)" \
       '.alerts += [{"severity": $severity, "strategy": $strategy, "report": $report, "timestamp": $time}]' \
       "$ALERT_HISTORY" > "${ALERT_HISTORY}.tmp" && mv "${ALERT_HISTORY}.tmp" "$ALERT_HISTORY"

    # 这里可以集成各种通知渠道
    # Slack, Email, SMS等

    # 示例：Slack通知
    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        local slack_message="{
            \"attachments\": [{
                \"color\": \"danger\",
                \"title\": \"Industrial Pipeline Failure Alert\",
                \"fields\": [
                    {\"title\": \"Severity\", \"value\": \"$severity\", \"short\": true},
                    {\"title\": \"Strategy\", \"value\": \"$strategy\", \"short\": true},
                    {\"title\": \"Report\", \"value\": \"$report_file\", \"short\": false}
                ]
            }]
        }"

        curl -X POST -H 'Content-type: application/json' \
             --data "$slack_message" \
             "${SLACK_WEBHOOK_URL:-}" || true
    fi
}

# 主监控函数
monitor_pipeline() {
    local pipeline_log="$1"

    if [ ! -f "$pipeline_log" ]; then
        log_monitor "Pipeline log file not found: $pipeline_log" "ERROR"
        exit 1
    fi

    log_monitor "Starting pipeline monitoring for: $pipeline_log"

    # 读取日志内容
    local log_content
    log_content=$(cat "$pipeline_log")

    # 分析失败模式
    IFS=' ' read -ra detected_patterns <<< "$(analyze_failure_patterns "$log_content")"

    if [ ${#detected_patterns[@]} -eq 0 ]; then
        log_monitor "No failure patterns detected - pipeline appears healthy" "SUCCESS"
        echo "NO_FAILURES_DETECTED"
        return 0
    fi

    log_monitor "Detected ${#detected_patterns[@]} failure patterns" "WARN"

    # 确定失败策略
    local strategy_info
    strategy_info=$(determine_failure_strategy "${detected_patterns[@]}")

    IFS=':' read -r severity strategy <<< "$strategy_info"

    log_monitor "Failure analysis complete - Severity: $severity, Strategy: $strategy"

    # 生成报告
    local report_file
    report_file=$(generate_failure_report "$severity" "$strategy" "${detected_patterns[@]}")

    # 发送告警
    send_alert_notification "$severity" "$strategy" "$report_file"

    # 执行快速失败机制
    execute_fast_failure "$severity" "$strategy" "${detected_patterns[@]}"
}

# 显示监控统计信息
show_statistics() {
    echo "📊 Industrial Failure Monitor Statistics"
    echo "========================================"

    if [ -f "$FAILURE_DB" ]; then
        echo "Total Failures: $(jq -r '.failure_statistics.total_failures' "$FAILURE_DB")"
        echo "Last Updated: $(jq -r '.failure_statistics.last_updated' "$FAILURE_DB")"
        echo ""
        echo "Pattern Detection Counts:"
        jq -r '.failure_statistics.patterns_detected | to_entries[] | "  \(.key): \(.value)"' "$FAILURE_DB" 2>/dev/null || echo "  No patterns detected yet"
    fi
}

# 主函数
main() {
    case "${1:-}" in
        "init")
            init_monitor
            ;;
        "monitor")
            if [ -z "${2:-}" ]; then
                echo "Usage: $0 monitor <pipeline_log_file>"
                exit 1
            fi
            monitor_pipeline "$2"
            ;;
        "stats")
            show_statistics
            ;;
        "patterns")
            echo "📋 Available Failure Patterns:"
            jq -r '.failure_patterns | keys[]' "$FAILURE_DB" 2>/dev/null || echo "No patterns configured"
            ;;
        "help"|"-h"|"--help")
            echo "Industrial Failure Monitor v2.0"
            echo ""
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  init                 Initialize the monitoring system"
            echo "  monitor <logfile>    Monitor a pipeline log file for failures"
            echo "  stats                Show failure statistics"
            echo "  patterns             List available failure patterns"
            echo "  help                 Show this help message"
            ;;
        *)
            echo "Unknown command: ${1:-}"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# 如果直接运行脚本，执行主函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
