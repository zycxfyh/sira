#!/bin/bash

# Sira AI Gateway 告警管理脚本

set -e

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 告警配置
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
ALERT_EMAIL_TO="${ALERT_EMAIL_TO:-admin@sira-gateway.com}"
SMTP_SERVER="${SMTP_SERVER:-localhost}"
SMTP_PORT="${SMTP_PORT:-587}"

# 告警级别
ALERT_LEVELS=("info" "warning" "error" "critical")
ALERT_COLORS=("\033[0;36m" "\033[1;33m" "\033[0;31m" "\033[1;31m")
NC='\033[0m'

# 日志函数
log_alert() {
    local level="$1"
    local message="$2"
    local color=""

    case $level in
        info) color="${ALERT_COLORS[0]}" ;;
        warning) color="${ALERT_COLORS[1]}" ;;
        error) color="${ALERT_COLORS[2]}" ;;
        critical) color="${ALERT_COLORS[3]}" ;;
    esac

    echo -e "${color}[ALERT ${level^^}]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $message"
}

# 发送告警到各种渠道
send_alert() {
    local level="$1"
    local title="$2"
    local message="$3"
    local details="${4:-}"

    log_alert "$level" "$title: $message"

    # 发送到 Webhook
    send_webhook_alert "$level" "$title" "$message" "$details"

    # 发送邮件告警
    if [ "$level" = "critical" ] || [ "$level" = "error" ]; then
        send_email_alert "$level" "$title" "$message" "$details"
    fi

    # 记录到日志文件
    log_alert_to_file "$level" "$title" "$message" "$details"
}

# 发送 Webhook 告警
send_webhook_alert() {
    local level="$1"
    local title="$2"
    local message="$3"
    local details="$4"

    if [ -z "$ALERT_WEBHOOK_URL" ]; then
        return
    fi

    local payload
    payload=$(cat <<EOF
{
  "level": "$level",
  "title": "$title",
  "message": "$message",
  "details": "$details",
  "timestamp": "$(date -Iseconds)",
  "source": "sira-gateway-alert-manager"
}
EOF
)

    if command -v curl &> /dev/null; then
        curl -X POST "$ALERT_WEBHOOK_URL" \
             -H "Content-Type: application/json" \
             -d "$payload" \
             --max-time 10 \
             --silent \
             --show-error || true
    fi
}

# 发送邮件告警
send_email_alert() {
    local level="$1"
    local title="$2"
    local message="$3"
    local details="$4"

    if ! command -v mail &> /dev/null && ! command -v sendmail &> /dev/null; then
        return
    fi

    local subject="[Sira Gateway ALERT] $level: $title"
    local body="告警级别: $level
告警标题: $title
告警消息: $message
详细信息: $details
发生时间: $(date)
来源: sira-gateway-alert-manager"

    echo "$body" | mail -s "$subject" "$ALERT_EMAIL_TO" || true
}

# 记录告警到文件
log_alert_to_file() {
    local level="$1"
    local title="$2"
    local message="$3"
    local details="$4"

    local log_file="$PROJECT_ROOT/logs/alerts.log"
    local log_entry="$(date '+%Y-%m-%d %H:%M:%S') [$level] $title: $message"

    if [ -n "$details" ]; then
        log_entry="$log_entry | Details: $details"
    fi

    echo "$log_entry" >> "$log_file"

    # 轮转日志文件
    if [ -f "$log_file" ] && [ $(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null) -gt 10485760 ]; then
        mv "$log_file" "$log_file.$(date +%Y%m%d_%H%M%S)"
        gzip "$log_file.$(date +%Y%m%d_%H%M%S)" || true
    fi
}

# 系统监控告警
check_system_alerts() {
    log_info "检查系统告警..."

    # CPU 使用率告警
    local cpu_usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')

    if (( $(echo "$cpu_usage > 90" | bc -l 2>/dev/null || echo 0) )); then
        send_alert "critical" "高CPU使用率" "CPU使用率达到 ${cpu_usage}%" "当前系统负载过高"
    elif (( $(echo "$cpu_usage > 75" | bc -l 2>/dev/null || echo 0) )); then
        send_alert "warning" "CPU使用率偏高" "CPU使用率达到 ${cpu_usage}%" "建议检查系统负载"
    fi

    # 内存使用率告警
    local mem_usage
    mem_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')

    if (( $(echo "$mem_usage > 90" | bc -l 2>/dev/null || echo 0) )); then
        send_alert "critical" "内存不足" "内存使用率达到 ${mem_usage}%" "系统内存严重不足"
    elif (( $(echo "$mem_usage > 80" | bc -l 2>/dev/null || echo 0) )); then
        send_alert "warning" "内存使用率偏高" "内存使用率达到 ${mem_usage}%" "建议检查内存使用情况"
    fi

    # 磁盘空间告警
    local disk_usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

    if [ "$disk_usage" -gt 95 ]; then
        send_alert "critical" "磁盘空间不足" "根分区使用率达到 ${disk_usage}%" "磁盘空间严重不足"
    elif [ "$disk_usage" -gt 85 ]; then
        send_alert "warning" "磁盘空间不足" "根分区使用率达到 ${disk_usage}%" "建议清理磁盘空间"
    fi
}

# 服务监控告警
check_service_alerts() {
    log_info "检查服务告警..."

    # 检查网关服务
    if ! curl -f -s --max-time 5 http://localhost:8080/health > /dev/null; then
        send_alert "critical" "网关服务异常" "网关服务无法访问" "检查网关服务状态和日志"
    fi

    # 检查管理接口
    if ! curl -f -s --max-time 5 http://localhost:3001/api/health > /dev/null; then
        send_alert "warning" "管理接口异常" "管理接口无法访问" "检查管理服务状态"
    fi

    # 检查数据库连接
    if command -v pg_isready &> /dev/null; then
        if ! pg_isready -h localhost -U sira -d sira_gateway &> /dev/null; then
            send_alert "error" "数据库连接异常" "PostgreSQL数据库连接失败" "检查数据库服务状态"
        fi
    fi

    # 检查Redis连接
    if command -v redis-cli &> /dev/null; then
        if ! redis-cli ping &> /dev/null; then
            send_alert "error" "缓存服务异常" "Redis缓存服务连接失败" "检查Redis服务状态"
        fi
    fi
}

# 性能监控告警
check_performance_alerts() {
    log_info "检查性能告警..."

    # 检查响应时间（需要从监控系统获取）
    local avg_response_time
    avg_response_time=$(curl -s http://localhost:9090/api/v1/query?query=http_request_duration_seconds%7Bquantile%3D%220.95%22%7D 2>/dev/null | \
                       jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")

    if (( $(echo "$avg_response_time > 5" | bc -l 2>/dev/null || echo 0) )); then
        send_alert "critical" "响应时间过长" "95%请求响应时间超过5秒" "检查服务性能瓶颈"
    elif (( $(echo "$avg_response_time > 2" | bc -l 2>/dev/null || echo 0) )); then
        send_alert "warning" "响应时间偏长" "95%请求响应时间超过2秒" "建议优化服务性能"
    fi

    # 检查错误率
    local error_rate
    error_rate=$(curl -s http://localhost:9090/api/v1/query?query=rate%28http_requests_total%7Bstatus%3D~%225..%22%7D%5B5m%5D%29%20%2F%20rate%28http_requests_total%5B5m%5D%29 2>/dev/null | \
                jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")

    if (( $(echo "$error_rate > 0.1" | bc -l 2>/dev/null || echo 0) )); then
        send_alert "critical" "高错误率" "请求错误率达到 ${(error_rate * 100)}%" "检查服务错误原因"
    elif (( $(echo "$error_rate > 0.05" | bc -l 2>/dev/null || echo 0) )); then
        send_alert "warning" "错误率偏高" "请求错误率达到 ${(error_rate * 100)}%" "建议检查服务稳定性"
    fi
}

# 网络监控告警
check_network_alerts() {
    log_info "检查网络告警..."

    # 检查网络连接
    if ! ping -c 1 -W 2 8.8.8.8 &> /dev/null; then
        send_alert "critical" "网络连接异常" "无法访问外部网络" "检查网络连接和DNS配置"
    fi

    # 检查端口监听
    local required_ports=(8080 3001 5432 6379)
    for port in "${required_ports[@]}"; do
        if ! netstat -tln 2>/dev/null | grep ":$port " > /dev/null; then
            send_alert "error" "服务端口未监听" "端口 $port 未被监听" "检查相应服务状态"
        fi
    done
}

# 安全监控告警
check_security_alerts() {
    log_info "检查安全告警..."

    # 检查失败的登录尝试
    local failed_logins
    failed_logins=$(grep "authentication failed" "$PROJECT_ROOT/logs/gateway.log" 2>/dev/null | wc -l || echo 0)

    if [ "$failed_logins" -gt 10 ]; then
        send_alert "warning" "多次登录失败" "检测到 $failed_logins 次登录失败" "检查是否存在暴力破解攻击"
    fi

    # 检查异常访问
    local suspicious_ips
    suspicious_ips=$(grep "blocked\|suspicious" "$PROJECT_ROOT/logs/gateway.log" 2>/dev/null | \
                    awk '{print $1}' | sort | uniq -c | sort -nr | head -5 | wc -l || echo 0)

    if [ "$suspicious_ips" -gt 3 ]; then
        send_alert "warning" "可疑访问检测" "检测到多个可疑IP地址" "检查是否存在攻击行为"
    fi

    # 检查证书过期
    if command -v openssl &> /dev/null; then
        local cert_file="$PROJECT_ROOT/ssl/cert.pem"
        if [ -f "$cert_file" ]; then
            local days_left
            days_left=$(openssl x509 -enddate -noout -in "$cert_file" 2>/dev/null | \
                       cut -d= -f2 | xargs -I {} date -d {} +%s 2>/dev/null)
            local now
            now=$(date +%s)
            local days_until_expiry=$(( (days_left - now) / 86400 ))

            if [ "$days_until_expiry" -lt 7 ]; then
                send_alert "critical" "SSL证书即将过期" "SSL证书还有 $days_until_expiry 天过期" "立即更新SSL证书"
            elif [ "$days_until_expiry" -lt 30 ]; then
                send_alert "warning" "SSL证书即将过期" "SSL证书还有 $days_until_expiry 天过期" "准备更新SSL证书"
            fi
        fi
    fi
}

# 自定义告警
send_custom_alert() {
    local level="$1"
    local title="$2"
    local message="$3"
    local details="$4"

    if [[ ! " ${ALERT_LEVELS[*]} " =~ " $level " ]]; then
        echo "无效的告警级别: $level"
        return 1
    fi

    send_alert "$level" "$title" "$message" "$details"
}

# 获取告警历史
get_alert_history() {
    local hours="${1:-24}"
    local level="${2:-}"

    echo "=== 最近 ${hours} 小时告警历史 ==="

    local log_file="$PROJECT_ROOT/logs/alerts.log"
    if [ ! -f "$log_file" ]; then
        echo "告警日志文件不存在"
        return
    fi

    local since
    since=$(date -d "$hours hours ago" +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -v-"${hours}H" +%Y-%m-%dT%H:%M:%S 2>/dev/null)

    if [ -n "$level" ]; then
        grep "[$level]" "$log_file" | while read -r line; do
            local timestamp
            timestamp=$(echo "$line" | cut -d' ' -f1-2)
            if [[ "$timestamp" > "$since" ]]; then
                echo "$line"
            fi
        done
    else
        while read -r line; do
            local timestamp
            timestamp=$(echo "$line" | cut -d' ' -f1-2)
            if [[ "$timestamp" > "$since" ]]; then
                echo "$line"
            fi
        done < "$log_file"
    fi
}

# 显示帮助
show_help() {
    cat << EOF
Sira AI Gateway 告警管理脚本

用法: $0 [命令] [选项]

命令:
  check-system      检查系统告警 (CPU、内存、磁盘)
  check-services    检查服务告警 (网关、管理接口、数据库)
  check-performance 检查性能告警 (响应时间、错误率)
  check-network     检查网络告警 (连接、端口)
  check-security    检查安全告警 (登录、访问、证书)
  check-all         执行所有告警检查
  custom <level> <title> <message> [details] 发送自定义告警
  history [hours] [level] 显示告警历史
  help              显示帮助信息

告警级别:
  info      信息
  warning   警告
  error     错误
  critical  严重

示例:
  $0 check-all                    # 执行所有告警检查
  $0 custom critical "服务宕机" "网关服务无法启动" # 发送自定义告警
  $0 history 48 error             # 显示过去48小时的错误告警

环境变量:
  ALERT_WEBHOOK_URL    Webhook告警URL
  ALERT_EMAIL_TO       邮件告警收件人
  SMTP_SERVER          SMTP服务器
  SMTP_PORT           SMTP端口

EOF
}

# 主函数
main() {
    local command="${1:-check-all}"

    case $command in
        check-system)
            check_system_alerts
            ;;
        check-services)
            check_service_alerts
            ;;
        check-performance)
            check_performance_alerts
            ;;
        check-network)
            check_network_alerts
            ;;
        check-security)
            check_security_alerts
            ;;
        check-all)
            check_system_alerts
            check_service_alerts
            check_performance_alerts
            check_network_alerts
            check_security_alerts
            ;;
        custom)
            if [ $# -lt 4 ]; then
                echo "用法: $0 custom <level> <title> <message> [details]"
                exit 1
            fi
            send_custom_alert "$2" "$3" "$4" "$5"
            ;;
        history)
            get_alert_history "$2" "$3"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
