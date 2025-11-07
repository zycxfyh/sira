#!/bin/bash

# Sira System Monitoring Script
# Comprehensive monitoring for production deployment

set -e

# Configuration
MONITOR_INTERVAL="${MONITOR_INTERVAL:-30}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-80}"
LOG_FILE="${LOG_FILE:-/var/log/sira/monitor.log}"
METRICS_FILE="${METRICS_FILE:-/tmp/sira-metrics.json}"

# Service endpoints
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') ${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Create necessary directories
setup_directories() {
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$METRICS_FILE")"
    touch "$LOG_FILE"
}

# Check service health
check_service_health() {
    local service_name="$1"
    local url="$2"
    local timeout="${3:-10}"

    if curl -f -s --max-time "$timeout" "$url" > /dev/null 2>&1; then
        echo "healthy"
    else
        echo "unhealthy"
    fi
}

# Get system metrics
get_system_metrics() {
    # CPU usage
    local cpu_usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')

    # Memory usage
    local mem_total mem_used mem_free
    read -r mem_total mem_used mem_free <<< "$(free -m | awk 'NR==2{printf "%.0f %.0f %.0f", $2, $3, $7}')"
    local mem_usage_percent
    mem_usage_percent=$(echo "scale=2; ($mem_used / $mem_total) * 100" | bc -l 2>/dev/null || echo "0")

    # Disk usage
    local disk_usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

    # Network I/O (simplified)
    local rx_bytes tx_bytes
    rx_bytes=$(cat /sys/class/net/eth0/statistics/rx_bytes 2>/dev/null || echo "0")
    tx_bytes=$(cat /sys/class/net/eth0/statistics/tx_bytes 2>/dev/null || echo "0")

    # Load average
    local load_avg
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}')

    cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "cpu_usage_percent": $cpu_usage,
  "memory": {
    "total_mb": $mem_total,
    "used_mb": $mem_used,
    "free_mb": $mem_free,
    "usage_percent": $mem_usage_percent
  },
  "disk_usage_percent": $disk_usage,
  "network": {
    "rx_bytes": $rx_bytes,
    "tx_bytes": $tx_bytes
  },
  "load_average": $load_avg
}
EOF
}

# Get application metrics
get_application_metrics() {
    # Gateway health
    local gateway_health
    gateway_health=$(check_service_health "gateway" "$GATEWAY_URL/health")

    # Prometheus health
    local prometheus_health
    prometheus_health=$(check_service_health "prometheus" "$PROMETHEUS_URL/-/healthy")

    # Grafana health
    local grafana_health
    grafana_health=$(check_service_health "grafana" "$GRAFANA_URL/api/health")

    # Get Prometheus metrics (if available)
    local prometheus_metrics="{}"
    if [ "$prometheus_health" = "healthy" ]; then
        prometheus_metrics=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=up" | jq '.data.result[] | {name: .metric.__name__, value: .value[1]}' 2>/dev/null || echo "{}")
    fi

    # Gateway specific metrics
    local gateway_requests_total=0
    local gateway_requests_errors=0
    local gateway_response_time_avg=0

    if [ "$gateway_health" = "healthy" ]; then
        # These would be actual metrics from your application
        gateway_requests_total=$(curl -s "$GATEWAY_URL/metrics" | grep "http_requests_total" | awk '{print $2}' 2>/dev/null || echo "0")
        gateway_requests_errors=$(curl -s "$GATEWAY_URL/metrics" | grep "http_requests_errors_total" | awk '{print $2}' 2>/dev/null || echo "0")
        gateway_response_time_avg=$(curl -s "$GATEWAY_URL/metrics" | grep "http_request_duration_seconds" | awk '{print $2}' 2>/dev/null || echo "0")
    fi

    cat << EOF
{
  "timestamp": "$(date -Iseconds)",
  "services": {
    "gateway": "$gateway_health",
    "prometheus": "$prometheus_health",
    "grafana": "$grafana_health"
  },
  "gateway": {
    "requests_total": $gateway_requests_total,
    "requests_errors": $gateway_requests_errors,
    "response_time_avg": $gateway_response_time_avg
  },
  "prometheus": $prometheus_metrics
}
EOF
}

# Check thresholds and send alerts
check_alerts() {
    local system_metrics="$1"
    local app_metrics="$2"

    # Parse JSON and check thresholds
    local cpu_usage disk_usage
    cpu_usage=$(echo "$system_metrics" | jq -r '.cpu_usage_percent' 2>/dev/null || echo "0")
    disk_usage=$(echo "$system_metrics" | jq -r '.disk_usage_percent' 2>/dev/null || echo "0")

    local gateway_health
    gateway_health=$(echo "$app_metrics" | jq -r '.services.gateway' 2>/dev/null || echo "unknown")

    # CPU alert
    if (( $(echo "$cpu_usage > $ALERT_THRESHOLD" | bc -l 2>/dev/null) )); then
        log_error "HIGH CPU USAGE: $cpu_usage% (threshold: $ALERT_THRESHOLD%)"
        # In production, send alert to monitoring system
    fi

    # Disk alert
    if (( $(echo "$disk_usage > $ALERT_THRESHOLD" | bc -l 2>/dev/null) )); then
        log_error "HIGH DISK USAGE: $disk_usage% (threshold: $ALERT_THRESHOLD%)"
        # In production, send alert to monitoring system
    fi

    # Service health alert
    if [ "$gateway_health" != "healthy" ]; then
        log_error "GATEWAY SERVICE UNHEALTHY: $gateway_health"
        # In production, send alert to monitoring system
    fi
}

# Generate monitoring report
generate_report() {
    local report_file="system-report-$(date +%Y%m%d-%H%M%S).txt"

    log_info "Generating system monitoring report..."

    {
        echo "Sira System Monitoring Report"
        echo "============================="
        echo "Generated: $(date)"
        echo "Monitoring Period: $MONITOR_INTERVAL seconds"
        echo "Alert Threshold: $ALERT_THRESHOLD%"
        echo ""
        echo "System Status:"
        echo "=============="

        # Show current system metrics
        echo "System Metrics:"
        get_system_metrics | jq -r '
            "  CPU Usage: \(.cpu_usage_percent)%",
            "  Memory: \(.memory.used_mb)MB / \(.memory.total_mb)MB (\(.memory.usage_percent)%)",
            "  Disk Usage: \(.disk_usage_percent)%",
            "  Load Average: \(.load_average)",
            ""
        '

        echo "Service Status:"
        get_application_metrics | jq -r '
            "  Gateway: \(.services.gateway)",
            "  Prometheus: \(.services.prometheus)",
            "  Grafana: \(.services.grafana)",
            ""
        '

        echo "Recent Log Entries:"
        echo "==================="
        tail -20 "$LOG_FILE" 2>/dev/null || echo "No log entries found"

    } > "$report_file"

    log_success "System report saved to $report_file"
}

# Display real-time dashboard
show_dashboard() {
    clear
    echo "Sira System Monitor Dashboard"
    echo "============================="
    echo "Time: $(date)"
    echo ""

    # System metrics
    echo "System Resources:"
    get_system_metrics | jq -r '
        "  CPU: \(.cpu_usage_percent)%",
        "  Memory: \(.memory.used_mb)MB / \(.memory.total_mb)MB (\(.memory.usage_percent)%)",
        "  Disk: \(.disk_usage_percent)%",
        "  Load: \(.load_average)",
        ""
    '

    # Service status
    echo "Service Status:"
    get_application_metrics | jq -r '
        "  Gateway: \(.services.gateway)",
        "  Prometheus: \(.services.prometheus)",
        "  Grafana: \(.services.grafana)",
        ""
    '

    # Recent alerts
    echo "Recent Alerts:"
    tail -5 "$LOG_FILE" 2>/dev/null | grep -E "(ERROR|WARN)" | sed 's/.*\[//' | sed 's/\].*//' | head -5 || echo "  No recent alerts"
    echo ""
}

# Main monitoring loop
main() {
    log_info "Starting Sira System Monitor"
    setup_directories

    # Check for required tools
    command -v curl >/dev/null 2>&1 || { log_error "curl is required but not installed."; exit 1; }
    command -v jq >/dev/null 2>&1 || { log_error "jq is required but not installed."; exit 1; }
    command -v bc >/dev/null 2>&1 || { log_error "bc is required but not installed."; exit 1; }

    log_info "Monitoring interval: $MONITOR_INTERVAL seconds"
    log_info "Alert threshold: $ALERT_THRESHOLD%"

    while true; do
        # Collect metrics
        system_metrics=$(get_system_metrics)
        app_metrics=$(get_application_metrics)

        # Save metrics to file
        echo "{\"system\": $system_metrics, \"application\": $app_metrics}" > "$METRICS_FILE"

        # Check for alerts
        check_alerts "$system_metrics" "$app_metrics"

        # Show dashboard if interactive
        if [ -t 1 ]; then
            show_dashboard
        fi

        # Wait for next interval
        sleep "$MONITOR_INTERVAL"
    done
}

# Handle command line arguments
case "${1:-}" in
    "report")
        generate_report
        ;;
    "dashboard")
        while true; do
            show_dashboard
            sleep 5
        done
        ;;
    "check")
        log_info "Performing health check..."
        system_metrics=$(get_system_metrics)
        app_metrics=$(get_application_metrics)

        echo "System Health:"
        echo "$system_metrics" | jq '.'

        echo "Application Health:"
        echo "$app_metrics" | jq '.'

        check_alerts "$system_metrics" "$app_metrics"
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [COMMAND] [OPTIONS]"
        echo ""
        echo "Commands:"
        echo "  (no command)    Start continuous monitoring"
        echo "  report          Generate system report"
        echo "  dashboard       Show real-time dashboard"
        echo "  check           Perform single health check"
        echo "  help            Show this help message"
        echo ""
        echo "Options:"
        echo "  MONITOR_INTERVAL=N    Monitoring interval in seconds (default: 30)"
        echo "  ALERT_THRESHOLD=N     Alert threshold percentage (default: 80)"
        echo "  LOG_FILE=PATH         Log file path (default: /var/log/sira/monitor.log)"
        echo "  METRICS_FILE=PATH     Metrics file path (default: /tmp/sira-metrics.json)"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac