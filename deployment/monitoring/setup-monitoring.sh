#!/bin/bash

# 监控系统设置脚本
# 使用方法: ./setup-monitoring.sh [environment]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT=${1:-staging}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    local missing_deps=()

    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi

    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("docker-compose")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "缺少依赖: ${missing_deps[*]}"
        exit 1
    fi

    log_success "依赖检查通过"
}

# 创建监控网络
create_monitoring_network() {
    log_info "创建监控网络..."

    if ! docker network ls | grep -q "tuheg-monitoring"; then
        docker network create tuheg-monitoring
        log_success "监控网络创建成功"
    else
        log_success "监控网络已存在"
    fi
}

# 启动Prometheus
start_prometheus() {
    log_info "启动Prometheus..."

    cat > docker-compose.monitoring.yml << EOF
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: tuheg-prometheus-${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - tuheg-monitoring

  alertmanager:
    image: prom/alertmanager:latest
    container_name: tuheg-alertmanager-${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    networks:
      - tuheg-monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: tuheg-grafana-${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=tuheg_monitoring_2024
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana-dashboard.json:/etc/grafana/provisioning/dashboards/tuheg-dashboard.json
    networks:
      - tuheg-monitoring

  node-exporter:
    image: prom/node-exporter:latest
    container_name: tuheg-node-exporter-${ENVIRONMENT}
    restart: unless-stopped
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - tuheg-monitoring

networks:
  tuheg-monitoring:
    external: true

volumes:
  prometheus_data:
  grafana_data:
EOF

    docker-compose -f docker-compose.monitoring.yml up -d
    log_success "Prometheus 启动成功"
}

# 配置Grafana
configure_grafana() {
    log_info "配置Grafana..."

    # 等待Grafana启动
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:3001/api/health >/dev/null 2>&1; then
            log_success "Grafana 已就绪"
            break
        fi

        log_info "等待Grafana启动... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "Grafana启动超时"
        return 1
    fi

    # 创建数据源
    curl -X POST -H "Content-Type: application/json" \
         -d '{
           "name": "Prometheus",
           "type": "prometheus",
           "url": "http://prometheus:9090",
           "access": "proxy",
           "isDefault": true
         }' \
         http://admin:tuheg_monitoring_2024@localhost:3001/api/datasources

    # 导入仪表板
    curl -X POST -H "Content-Type: application/json" \
         -d @monitoring/grafana-dashboard.json \
         http://admin:tuheg_monitoring_2024@localhost:3001/api/dashboards/db

    log_success "Grafana配置完成"
}

# 测试监控系统
test_monitoring() {
    log_info "测试监控系统..."

    # 测试Prometheus
    if curl -f -s http://localhost:9090/-/healthy >/dev/null 2>&1; then
        log_success "Prometheus 健康检查通过"
    else
        log_error "Prometheus 健康检查失败"
        return 1
    fi

    # 测试Alertmanager
    if curl -f -s http://localhost:9093/-/healthy >/dev/null 2>&1; then
        log_success "Alertmanager 健康检查通过"
    else
        log_error "Alertmanager 健康检查失败"
        return 1
    fi

    # 测试Grafana
    if curl -f -s http://localhost:3001/api/health >/dev/null 2>&1; then
        log_success "Grafana 健康检查通过"
    else
        log_error "Grafana 健康检查失败"
        return 1
    fi

    # 测试Node Exporter
    if curl -f -s http://localhost:9100/metrics | grep -q "node_cpu_seconds_total"; then
        log_success "Node Exporter 指标检查通过"
    else
        log_error "Node Exporter 指标检查失败"
        return 1
    fi

    log_success "监控系统测试完成"
}

# 显示访问信息
show_access_info() {
    log_info "监控系统访问信息:"

    echo ""
    echo "📊 Prometheus:     http://localhost:9090"
    echo "🚨 Alertmanager:   http://localhost:9093"
    echo "📈 Grafana:        http://localhost:3001"
    echo "   用户名: admin"
    echo "   密码: tuheg_monitoring_2024"
    echo ""
    echo "🔍 Node Exporter:  http://localhost:9100/metrics"
    echo ""

    log_info "常用查询示例:"
    echo "  - 服务健康: up{job=\"backend-gateway\"}"
    echo "  - HTTP请求率: rate(http_requests_total[5m])"
    echo "  - 错误率: rate(http_requests_total{status=~\"5..\"}[5m])"
    echo "  - 响应时间: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
}

# 清理函数
cleanup() {
    log_info "清理临时文件..."
    rm -f docker-compose.monitoring.yml
}

# 主函数
main() {
    log_info "开始设置监控系统 ($ENVIRONMENT)"

    # 陷阱函数：确保清理
    trap cleanup EXIT

    check_dependencies
    create_monitoring_network
    start_prometheus
    configure_grafana
    test_monitoring
    show_access_info

    log_success "🎉 监控系统设置完成！"
    log_info "系统将在后台运行，可通过上述地址访问"
}

# 显示帮助信息
show_help() {
    cat << EOF
监控系统设置脚本

使用方法:
  $0 [environment]

参数:
  environment   环境名称 (默认: staging)

功能:
  - 创建监控网络
  - 启动Prometheus、Alertmanager、Grafana
  - 配置数据源和仪表板
  - 测试监控系统功能

访问地址:
  - Prometheus:    http://localhost:9090
  - Alertmanager:  http://localhost:9093
  - Grafana:       http://localhost:3001 (admin/tuheg_monitoring_2024)

示例:
  $0 staging     # 设置staging环境监控
  $0 production  # 设置production环境监控

EOF
}

case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
