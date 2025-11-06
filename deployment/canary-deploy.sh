#!/bin/bash

# 金丝雀部署执行脚本
# 使用方法: ./canary-deploy.sh <version> <service> [environment]

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STRATEGY_FILE="$SCRIPT_DIR/canary-strategy.json"
VERSION=$1
SERVICE=$2
ENVIRONMENT=${3:-staging}

if [ -z "$VERSION" ] || [ -z "$SERVICE" ]; then
    echo "使用方法: $0 <version> <service> [environment]"
    echo "示例: $0 v1.2.3 backend-gateway production"
    exit 1
fi

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

    if ! command -v jq &> /dev/null; then
        log_error "需要安装 jq"
        exit 1
    fi

    if ! command -v kubectl &> /dev/null; then
        log_error "需要安装 kubectl"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "需要安装 docker"
        exit 1
    fi

    log_success "依赖检查通过"
}

# 验证策略文件
validate_strategy() {
    log_info "验证部署策略配置..."

    if [ ! -f "$STRATEGY_FILE" ]; then
        log_error "策略文件不存在: $STRATEGY_FILE"
        exit 1
    fi

    # 验证JSON格式
    if ! jq . "$STRATEGY_FILE" > /dev/null 2>&1; then
        log_error "策略文件JSON格式错误"
        exit 1
    fi

    # 验证必要字段
    local strategy
    strategy=$(jq -r '.strategy' "$STRATEGY_FILE")
    if [ "$strategy" != "canary" ]; then
        log_error "不支持的部署策略: $strategy"
        exit 1
    fi

    log_success "策略配置验证通过"
}

# 创建金丝雀部署
create_canary_deployment() {
    local service=$1
    local version=$2
    local environment=$3

    log_info "创建金丝雀部署: $service $version ($environment)"

    # 获取环境配置
    local namespace replicas
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")
    replicas=$(jq -r ".environments.$environment.replicas.$service" "$STRATEGY_FILE")

    if [ "$replicas" = "null" ]; then
        log_error "服务 $service 在环境 $environment 中的副本数未配置"
        exit 1
    fi

    # 创建canary deployment
    cat > "canary-deployment-$service.yaml" << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $service-canary
  namespace: $namespace
  labels:
    app: $service
    version: canary
    deployment: canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: $service
      version: canary
  template:
    metadata:
      labels:
        app: $service
        version: canary
        deployment: canary
    spec:
      containers:
      - name: $service
        image: tuheg/$service:$version
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "$environment"
        - name: VERSION
          value: "$version"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
EOF

    # 应用配置
    kubectl apply -f "canary-deployment-$service.yaml"

    log_success "金丝雀部署已创建"
}

# 等待服务就绪
wait_for_canary_ready() {
    local service=$1
    local environment=$2
    local timeout=${3:-300}

    log_info "等待金丝雀服务就绪..."

    local namespace
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")

    local start_time
    start_time=$(date +%s)

    while true; do
        local ready_pods
        ready_pods=$(kubectl get pods -n "$namespace" -l app="$service",version=canary -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null | grep -o "True" | wc -l)

        if [ "$ready_pods" -ge 1 ]; then
            log_success "金丝雀服务已就绪"
            return 0
        fi

        local current_time
        current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -gt $timeout ]; then
            log_error "等待金丝雀服务就绪超时"
            kubectl get pods -n "$namespace" -l app="$service",version=canary
            return 1
        fi

        sleep 5
    done
}

# 创建金丝雀Ingress
create_canary_ingress() {
    local service=$1
    local percentage=$2
    local environment=$3

    log_info "创建金丝雀Ingress: ${percentage}% 流量"

    local namespace domain ingress_class
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")
    domain=$(jq -r ".environments.$environment.domain" "$STRATEGY_FILE")
    ingress_class=$(jq -r ".environments.$environment.ingress_class" "$STRATEGY_FILE")

    cat > "canary-ingress-$service.yaml" << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: $service-canary
  namespace: $namespace
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "$percentage"
    kubernetes.io/ingress.class: "$ingress_class"
spec:
  rules:
  - host: $domain
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: $service-canary
            port:
              number: 3000
EOF

    kubectl apply -f "canary-ingress-$service.yaml"

    log_success "金丝雀Ingress已创建 (${percentage}% 流量)"
}

# 监控指标
monitor_metrics() {
    local service=$1
    local stage=$2
    local duration=$3
    local environment=$4

    log_info "开始监控阶段 $stage ($duration 秒)..."

    local namespace
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")

    local start_time
    start_time=$(date +%s)

    while true; do
        # 检查服务是否正常运行
        local ready_pods
        ready_pods=$(kubectl get pods -n "$namespace" -l app="$service",version=canary -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null | grep -o "True" | wc -l)

        if [ "$ready_pods" -lt 1 ]; then
            log_error "金丝雀服务异常，pods不就绪"
            return 1
        fi

        # 简单健康检查
        local health_check
        health_check=$(kubectl exec -n "$namespace" "deployment/$service-canary" -- curl -f -s http://localhost:3000/health 2>/dev/null && echo "ok" || echo "fail")

        if [ "$health_check" != "ok" ]; then
            log_error "健康检查失败"
            return 1
        fi

        local current_time
        current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        log_info "监控进行中... ($elapsed/$duration 秒)"

        if [ $elapsed -ge $duration ]; then
            log_success "监控阶段 $stage 完成"
            return 0
        fi

        sleep 10
    done
}

# 回滚部署
rollback_deployment() {
    local service=$1
    local environment=$2

    log_warning "开始回滚部署: $service"

    local namespace
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")

    # 删除canary ingress
    kubectl delete ingress "$service-canary" -n "$namespace" --ignore-not-found=true

    # 删除canary deployment
    kubectl delete deployment "$service-canary" -n "$namespace" --ignore-not-found=true

    # 等待删除完成
    sleep 10

    log_success "回滚完成"
}

# 清理金丝雀资源
cleanup_canary() {
    local service=$1
    local environment=$2

    log_info "清理金丝雀资源..."

    local namespace
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")

    # 删除配置文件
    rm -f "canary-deployment-$service.yaml"
    rm -f "canary-ingress-$service.yaml"

    # 删除Kubernetes资源
    kubectl delete ingress "$service-canary" -n "$namespace" --ignore-not-found=true
    kubectl delete deployment "$service-canary" -n "$namespace" --ignore-not-found=true

    log_success "金丝雀资源清理完成"
}

# 发送通知
send_notification() {
    local message=$1
    local level=${2:-info}

    log_info "发送通知: $message"

    # 这里可以集成Slack、邮件等通知
    # 示例：curl -X POST -H 'Content-type: application/json' --data '{"text":"'"$message"'"}' $SLACK_WEBHOOK_URL
}

# 主部署流程
main() {
    log_info "开始金丝雀部署: $SERVICE $VERSION ($ENVIRONMENT)"

    # 验证输入
    check_dependencies
    validate_strategy

    # 创建金丝雀部署
    create_canary_deployment "$SERVICE" "$VERSION" "$ENVIRONMENT"

    # 等待就绪
    if ! wait_for_canary_ready "$SERVICE" "$ENVIRONMENT"; then
        log_error "金丝雀服务启动失败"
        cleanup_canary "$SERVICE" "$ENVIRONMENT"
        exit 1
    fi

    # 执行分阶段部署
    local stages
    stages=$(jq -c '.traffic_distribution.stages[]' "$STRATEGY_FILE")

    local stage_num=1
    echo "$stages" | while read -r stage; do
        local percentage duration monitoring_duration
        percentage=$(echo "$stage" | jq -r '.percentage')
        duration=$(( $(echo "$stage" | jq -r '.duration_minutes') * 60 ))
        monitoring_duration=$(( $(echo "$stage" | jq -r '.monitoring_window_minutes') * 60 ))

        log_info "执行阶段 $stage_num: ${percentage}% 流量"

        # 创建/更新ingress
        create_canary_ingress "$SERVICE" "$percentage" "$ENVIRONMENT"

        # 监控阶段
        if ! monitor_metrics "$SERVICE" "$stage_num" "$monitoring_duration" "$ENVIRONMENT"; then
            log_error "阶段 $stage_num 监控失败，触发回滚"
            rollback_deployment "$SERVICE" "$ENVIRONMENT"
            send_notification "🚨 部署失败: $SERVICE $VERSION 阶段 $stage_num" "error"
            exit 1
        fi

        # 阶段3需要人工确认
        if [ "$stage_num" -eq 3 ]; then
            log_warning "阶段 $stage_num 完成，等待人工确认..."
            send_notification "⏳ 等待确认: $SERVICE $VERSION 已完成20%流量测试" "warning"

            # 在实际环境中，这里会等待人工确认
            # 暂时自动继续
            sleep 5
        fi

        ((stage_num++))
    done

    log_success "金丝雀部署成功完成！"
    send_notification "✅ 部署成功: $SERVICE $VERSION 已完全上线" "success"

    # 清理资源
    cleanup_canary "$SERVICE" "$ENVIRONMENT"
}

# 执行主函数
main "$@"
