#!/bin/bash

# Sira AI Gateway 监控运维脚本

set -e

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_MODE="${1:-docker}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 系统监控
monitor_system() {
    log_info "=== 系统监控 ==="

    echo "CPU 使用率:"
    if command -v mpstat &> /dev/null; then
        mpstat 1 1 | tail -1
    else
        top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}'
    fi

    echo -e "\n内存使用率:"
    free -h

    echo -e "\n磁盘使用率:"
    df -h

    echo -e "\n网络连接:"
    netstat -tuln | wc -l
}

# Docker 容器监控
monitor_docker() {
    log_info "=== Docker 容器监控 ==="

    echo "容器状态:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo -e "\n容器资源使用:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

    echo -e "\n容器日志大小:"
    docker ps --format "{{.Names}}" | xargs -I {} sh -c 'echo -n "{}: "; docker logs {} 2>/dev/null | wc -c' | sort -k2 -nr
}

# Kubernetes 监控
monitor_kubernetes() {
    log_info "=== Kubernetes 监控 ==="

    echo "Pod 状态:"
    kubectl get pods -n sira-gateway --no-headers | awk '{print $1, $3, $4, $5}'

    echo -e "\n服务状态:"
    kubectl get services -n sira-gateway

    echo -e "\n节点状态:"
    kubectl get nodes --no-headers | awk '{print $1, $2}'

    echo -e "\nPod 资源使用:"
    kubectl top pods -n sira-gateway --containers=true 2>/dev/null || echo "metrics-server 未安装"
}

# 应用监控
monitor_application() {
    log_info "=== 应用监控 ==="

    local gateway_url="http://localhost:8080"
    local admin_url="http://localhost:3001"

    echo "网关健康检查:"
    if curl -f -s "$gateway_url/health" > /dev/null; then
        echo "✅ 网关服务正常"
    else
        echo "❌ 网关服务异常"
    fi

    echo -e "\n管理接口健康检查:"
    if curl -f -s "$admin_url/api/health" > /dev/null; then
        echo "✅ 管理接口正常"
    else
        echo "❌ 管理接口异常"
    fi

    echo -e "\n应用指标:"
    curl -s "$gateway_url/metrics" 2>/dev/null | head -20 || echo "无法获取指标数据"
}

# 性能监控
monitor_performance() {
    log_info "=== 性能监控 ==="

    echo "当前进程:"
    ps aux --sort=-%cpu | head -10

    echo -e "\n网络连接统计:"
    netstat -ant | awk '/^tcp/ {++S[$NF]} END {for(a in S) print a, S[a]}'

    echo -e "\n系统负载:"
    uptime

    echo -e "\nI/O 统计:"
    iostat -x 1 1 2>/dev/null || echo "iostat 不可用"
}

# 告警检查
check_alerts() {
    log_info "=== 告警检查 ==="

    local alerts_found=0

    # 检查系统资源
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        log_warning "CPU 使用率过高: ${cpu_usage}%"
        alerts_found=$((alerts_found + 1))
    fi

    local mem_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
    if (( $(echo "$mem_usage > 85" | bc -l) )); then
        log_warning "内存使用率过高: ${mem_usage}%"
        alerts_found=$((alerts_found + 1))
    fi

    # 检查磁盘空间
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        log_warning "磁盘使用率过高: ${disk_usage}%"
        alerts_found=$((alerts_found + 1))
    fi

    # 检查服务状态
    if ! curl -f -s http://localhost:8080/health > /dev/null; then
        log_error "网关服务不可用"
        alerts_found=$((alerts_found + 1))
    fi

    if [ $alerts_found -eq 0 ]; then
        log_success "未发现告警"
    else
        log_warning "发现 $alerts_found 个告警"
    fi
}

# 备份数据
backup_data() {
    log_info "=== 数据备份 ==="

    local backup_dir="$PROJECT_ROOT/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/backup_$timestamp.tar.gz"

    mkdir -p "$backup_dir"

    case $DEPLOY_MODE in
        docker)
            log_info "备份 Docker 数据卷..."
            docker run --rm -v sira_postgres_data:/data -v "$backup_dir":/backup alpine tar czf "/backup/postgres_$timestamp.tar.gz" -C /data .
            docker run --rm -v sira_redis_data:/data -v "$backup_dir":/backup alpine tar czf "/backup/redis_$timestamp.tar.gz" -C /data .
            ;;
        kubernetes)
            log_info "备份 Kubernetes 数据..."
            kubectl exec -n sira-gateway deployment/postgres -- pg_dump -U sira sira_gateway > "$backup_dir/postgres_$timestamp.sql"
            ;;
    esac

    # 备份配置文件和日志
    tar czf "$backup_file" -C "$PROJECT_ROOT" config/ data/ logs/

    log_success "备份完成: $backup_file"

    # 清理旧备份
    find "$backup_dir" -name "backup_*.tar.gz" -mtime +7 -delete
    find "$backup_dir" -name "postgres_*.sql" -mtime +7 -delete
    find "$backup_dir" -name "redis_*.tar.gz" -mtime +7 -delete
}

# 日志分析
analyze_logs() {
    log_info "=== 日志分析 ==="

    local log_file="$PROJECT_ROOT/logs/gateway.log"

    if [ ! -f "$log_file" ]; then
        log_warning "日志文件不存在: $log_file"
        return
    fi

    echo "日志统计 (最近24小时):"
    echo "总行数: $(wc -l < "$log_file")"

    echo -e "\n错误统计:"
    grep -i error "$log_file" | wc -l

    echo -e "\n警告统计:"
    grep -i warn "$log_file" | wc -l

    echo -e "\n请求统计:"
    grep "HTTP" "$log_file" | wc -l

    echo -e "\nTop 10 错误信息:"
    grep -i error "$log_file" | cut -d' ' -f4- | sort | uniq -c | sort -nr | head -10

    echo -e "\n响应时间分布:"
    grep "HTTP" "$log_file" | awk '{print $NF}' | sort -n | awk '
        BEGIN {bin_width=100; max=0}
        {bins[int($1/bin_width)]++}
        $1>max{max=$1}
        END {
            for (i=0; i<=int(max/bin_width)+1; i++) {
                start=i*bin_width
                end=(i+1)*bin_width
                printf "%4d-%4dms: %d\n", start, end, bins[i] ? bins[i] : 0
            }
        }
    '
}

# 清理资源
cleanup_resources() {
    log_info "=== 资源清理 ==="

    case $DEPLOY_MODE in
        docker)
            log_info "清理 Docker 资源..."
            docker system prune -f
            docker volume prune -f
            ;;
        kubernetes)
            log_info "清理 Kubernetes 资源..."
            kubectl delete pods --field-selector=status.phase=Succeeded -n sira-gateway
            kubectl delete pods --field-selector=status.phase=Failed -n sira-gateway
            ;;
    esac

    # 清理日志文件
    find "$PROJECT_ROOT/logs" -name "*.log" -mtime +30 -delete

    # 清理临时文件
    find "$PROJECT_ROOT/temp" -type f -mtime +7 -delete

    log_success "资源清理完成"
}

# 生成报告
generate_report() {
    log_info "=== 生成监控报告 ==="

    local report_dir="$PROJECT_ROOT/reports/monitoring"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local report_file="$report_dir/report_$timestamp.md"

    mkdir -p "$report_dir"

    cat > "$report_file" << EOF
# Sira AI Gateway 监控报告
生成时间: $(date)

## 系统信息
- 主机名: $(hostname)
- 操作系统: $(uname -s) $(uname -r)
- 部署模式: $DEPLOY_MODE

## 资源使用情况

### CPU 使用率
\`\`\`
$(mpstat 1 1 2>/dev/null | tail -1 || echo "mpstat 不可用")
\`\`\`

### 内存使用情况
\`\`\`
$(free -h)
\`\`\`

### 磁盘使用情况
\`\`\`
$(df -h)
\`\`\`

## 服务状态

### 容器状态
\`\`\`
$(docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || kubectl get pods -n sira-gateway 2>/dev/null || echo "无法获取容器状态")
\`\`\`

## 性能指标

### 应用健康检查
- 网关服务: $(curl -f -s http://localhost:8080/health > /dev/null && echo "正常" || echo "异常")
- 管理接口: $(curl -f -s http://localhost:3001/api/health > /dev/null && echo "正常" || echo "异常")

## 告警信息
$(check_alerts 2>&1)

## 建议
1. 定期检查系统资源使用情况
2. 监控服务可用性和性能指标
3. 及时处理告警信息
4. 定期备份重要数据
5. 清理过期日志和临时文件

---
报告生成时间: $(date)
EOF

    log_success "监控报告已生成: $report_file"
}

# 显示帮助
show_help() {
    cat << EOF
Sira AI Gateway 监控运维脚本

用法: $0 [模式] [命令]

模式:
  docker         Docker 部署监控 (默认)
  kubernetes     Kubernetes 部署监控

命令:
  system         系统监控
  docker         Docker 容器监控
  kubernetes     Kubernetes 集群监控
  application    应用监控
  performance    性能监控
  alerts         告警检查
  backup         数据备份
  logs           日志分析
  cleanup        资源清理
  report         生成监控报告
  all            执行所有监控项目

示例:
  $0 docker system          # Docker 环境系统监控
  $0 kubernetes all         # Kubernetes 环境完整监控
  $0 alerts                 # 检查告警
  $0 report                 # 生成监控报告

EOF
}

# 主函数
main() {
    local command="${2:-system}"

    case $command in
        system)
            monitor_system
            ;;
        docker)
            monitor_docker
            ;;
        kubernetes)
            monitor_kubernetes
            ;;
        application)
            monitor_application
            ;;
        performance)
            monitor_performance
            ;;
        alerts)
            check_alerts
            ;;
        backup)
            backup_data
            ;;
        logs)
            analyze_logs
            ;;
        cleanup)
            cleanup_resources
            ;;
        report)
            generate_report
            ;;
        all)
            monitor_system
            echo
            case $DEPLOY_MODE in
                docker)
                    monitor_docker
                    ;;
                kubernetes)
                    monitor_kubernetes
                    ;;
            esac
            echo
            monitor_application
            echo
            monitor_performance
            echo
            check_alerts
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
