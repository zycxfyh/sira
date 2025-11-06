#!/bin/bash

# 文件路径: deployment/deploy-production.sh
# 职责: 执行完整的生产环境部署流程

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置
DEPLOYMENT_TYPE="${1:-rolling}"  # rolling, blue-green, canary
VERSION="${2:-v1.0.0}"
ENVIRONMENT="production"

# 检查部署条件
check_deployment_prerequisites() {
    log_info "检查部署先决条件..."

    # 检查必要的环境变量
    required_vars=("KUBECONFIG" "DOCKER_REGISTRY" "K8S_NAMESPACE")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "缺少必需的环境变量: $var"
            exit 1
        fi
    done

    # 检查kubectl连接
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "无法连接到Kubernetes集群"
        exit 1
    fi

    # 检查Docker registry访问
    if ! docker login "$DOCKER_REGISTRY" --username "$DOCKER_USERNAME" --password "$DOCKER_PASSWORD" >/dev/null 2>&1; then
        log_error "无法访问Docker registry"
        exit 1
    fi

    log_success "部署先决条件检查通过"
}

# 构建和推送Docker镜像
build_and_push_images() {
    log_info "构建和推送Docker镜像..."

    local services=("backend-gateway" "creation-agent" "logic-agent" "narrative-agent" "frontend")

    for service in "${services[@]}"; do
        log_info "构建 $service:$VERSION..."

        # 构建镜像
        docker build -f Dockerfile \
            --target "${service}-prod" \
            --tag "$DOCKER_REGISTRY/tuheg/${service}:${VERSION}" \
            --tag "$DOCKER_REGISTRY/tuheg/${service}:latest" \
            .

        # 推送镜像
        docker push "$DOCKER_REGISTRY/tuheg/${service}:${VERSION}"
        docker push "$DOCKER_REGISTRY/tuheg/${service}:latest"

        log_success "$service 镜像构建和推送完成"
    done
}

# 滚动部署
rolling_deployment() {
    log_info "执行滚动部署..."

    # 更新Kubernetes部署
    sed "s/v1\.0\.0/${VERSION}/g" deployment/production-deployment.yml | kubectl apply -f -

    # 等待部署完成
    kubectl rollout status deployment/tuheg-backend-gateway -n "$K8S_NAMESPACE" --timeout=600s

    # 验证部署
    verify_deployment

    log_success "滚动部署完成"
}

# 蓝绿部署
blue_green_deployment() {
    log_info "执行蓝绿部署..."

    # 获取当前活跃环境
    local active_color
    active_color=$(kubectl get configmap deployment-config -n "$K8S_NAMESPACE" -o jsonpath='{.data.ACTIVE_COLOR}' 2>/dev/null || echo "blue")

    local inactive_color
    if [ "$active_color" = "blue" ]; then
        inactive_color="green"
    else
        inactive_color="blue"
    fi

    log_info "当前活跃环境: $active_color, 部署到: $inactive_color"

    # 部署到非活跃环境
    if [ "$inactive_color" = "green" ]; then
        # 更新green环境镜像
        kubectl set image deployment/tuheg-backend-green backend-gateway="$DOCKER_REGISTRY/tuheg/backend-gateway:$VERSION" -n "$K8S_NAMESPACE"

        # 扩容green环境
        kubectl scale deployment tuheg-backend-green --replicas=3 -n "$K8S_NAMESPACE"

        # 等待green环境就绪
        kubectl wait --for=condition=available --timeout=300s deployment/tuheg-backend-green -n "$K8S_NAMESPACE"
    else
        # 更新blue环境镜像
        kubectl set image deployment/tuheg-backend-blue backend-gateway="$DOCKER_REGISTRY/tuheg/backend-gateway:$VERSION" -n "$K8S_NAMESPACE"

        # 扩容blue环境
        kubectl scale deployment tuheg-backend-blue --replicas=3 -n "$K8S_NAMESPACE"

        # 等待blue环境就绪
        kubectl wait --for=condition=available --timeout=300s deployment/tuheg-backend-blue -n "$K8S_NAMESPACE"
    fi

    # 执行切换前的验证
    log_info "验证 $inactive_color 环境..."
    verify_environment "$inactive_color"

    # 切换流量
    log_info "切换流量到 $inactive_color 环境..."
    kubectl patch service tuheg-backend-gateway -n "$K8S_NAMESPACE" -p "{\"spec\":{\"selector\":{\"app\":\"backend-gateway\",\"color\":\"$inactive_color\"}}}"

    # 等待切换完成
    sleep 30

    # 验证切换后的服务
    verify_deployment

    # 更新配置
    kubectl patch configmap deployment-config -n "$K8S_NAMESPACE" --type merge -p "{\"data\":{\"ACTIVE_COLOR\":\"$inactive_color\"}}"

    # 缩容旧环境
    if [ "$active_color" = "blue" ]; then
        kubectl scale deployment tuheg-backend-blue --replicas=0 -n "$K8S_NAMESPACE"
    else
        kubectl scale deployment tuheg-backend-green --replicas=0 -n "$K8S_NAMESPACE"
    fi

    log_success "蓝绿部署完成，活跃环境: $inactive_color"
}

# 金丝雀部署
canary_deployment() {
    log_info "执行金丝雀部署..."

    local canary_weight="${CANARY_WEIGHT:-10}"  # 默认10%流量

    log_info "金丝雀流量权重: ${canary_weight}%"

    # 部署新版本到green环境
    kubectl set image deployment/tuheg-backend-green backend-gateway="$DOCKER_REGISTRY/tuheg/backend-gateway:$VERSION" -n "$K8S_NAMESPACE"
    kubectl scale deployment tuheg-backend-green --replicas=1 -n "$K8S_NAMESPACE"

    # 等待green环境就绪
    kubectl wait --for=condition=available --timeout=300s deployment/tuheg-backend-green -n "$K8S_NAMESPACE"

    # 创建金丝雀Ingress
    cat > canary-ingress.yml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tuheg-canary-ingress
  namespace: $K8S_NAMESPACE
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "$canary_weight"
spec:
  rules:
  - host: api.tuheg.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: tuheg-backend-green
            port:
              number: 80
EOF

    kubectl apply -f canary-ingress.yml

    # 监控金丝雀部署
    log_info "监控金丝雀部署效果..."
    monitor_canary_deployment "$canary_weight"

    log_success "金丝雀部署完成"
}

# 验证部署
verify_deployment() {
    log_info "验证部署..."

    # 等待服务就绪
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if kubectl get pods -n "$K8S_NAMESPACE" -l app=backend-gateway -o jsonpath='{.items[*].status.phase}' | grep -v "Running" | wc -l | grep -q "^0$"; then
            log_success "所有Pods运行正常"
            break
        fi

        log_info "等待Pods就绪... ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "Pods启动超时"
        kubectl get pods -n "$K8S_NAMESPACE" -l app=backend-gateway
        exit 1
    fi

    # 检查服务端点
    local service_url
    service_url=$(kubectl get ingress -n "$K8S_NAMESPACE" -o jsonpath='{.items[0].spec.rules[0].host}' 2>/dev/null || echo "localhost")

    if curl -f -s "http://$service_url/health" >/dev/null 2>&1; then
        log_success "服务端点验证通过"
    else
        log_error "服务端点验证失败"
        exit 1
    fi

    log_success "部署验证完成"
}

# 验证特定环境
verify_environment() {
    local color="$1"
    log_info "验证 $color 环境..."

    # 检查Pods状态
    local pod_count
    pod_count=$(kubectl get pods -n "$K8S_NAMESPACE" -l app=backend-gateway,color="$color" --no-headers | wc -l)

    if [ "$pod_count" -eq 3 ]; then
        log_success "$color 环境有 $pod_count 个正常Pods"
    else
        log_error "$color 环境Pods数量异常: $pod_count"
        exit 1
    fi
}

# 监控金丝雀部署
monitor_canary_deployment() {
    local expected_weight="$1"
    log_info "监控金丝雀部署效果..."

    # 等待一段时间让流量稳定
    sleep 60

    # 这里可以集成监控系统来检查实际流量分布
    # 例如: 检查Prometheus指标，验证流量是否按预期分布

    log_info "金丝雀部署监控完成，流量权重: ${expected_weight}%"
}

# 执行数据库迁移
run_database_migrations() {
    log_info "执行数据库迁移..."

    # 使用Job执行迁移
    cat > migration-job.yml << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration-${VERSION//./-}
  namespace: $K8S_NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: migration
        image: $DOCKER_REGISTRY/tuheg/backend-gateway:$VERSION
        command: ["npm", "run", "migration:run"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
      restartPolicy: Never
EOF

    kubectl apply -f migration-job.yml

    # 等待迁移完成
    kubectl wait --for=condition=complete --timeout=300s job/db-migration-${VERSION//./-} -n "$K8S_NAMESPACE"

    log_success "数据库迁移完成"
}

# 发送部署通知
send_deployment_notification() {
    local status="$1"
    local deployment_type="$2"

    log_info "发送部署通知..."

    # 这里可以集成Slack、邮件或其他通知系统
    # 示例：发送到Slack

    if command -v curl >/dev/null 2>&1 && [ -n "$SLACK_WEBHOOK_URL" ]; then
        local message="🚀 Production Deployment $status\\nType: $deployment_type\\nVersion: $VERSION\\nEnvironment: $ENVIRONMENT"

        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
}

# 回滚函数
rollback_deployment() {
    local reason="$1"
    log_error "部署失败，执行回滚: $reason"

    case "$DEPLOYMENT_TYPE" in
        "blue-green")
            # 切换回之前的环境
            local current_color
            current_color=$(kubectl get configmap deployment-config -n "$K8S_NAMESPACE" -o jsonpath='{.data.ACTIVE_COLOR}' 2>/dev/null || echo "blue")

            local rollback_color
            if [ "$current_color" = "blue" ]; then
                rollback_color="green"
            else
                rollback_color="blue"
            fi

            log_info "回滚到 $rollback_color 环境..."
            kubectl patch service tuheg-backend-gateway -n "$K8S_NAMESPACE" -p "{\"spec\":{\"selector\":{\"app\":\"backend-gateway\",\"color\":\"$rollback_color\"}}}"
            ;;

        "canary")
            # 移除金丝雀Ingress
            kubectl delete ingress tuheg-canary-ingress -n "$K8S_NAMESPACE" --ignore-not-found=true
            kubectl scale deployment tuheg-backend-green --replicas=0 -n "$K8S_NAMESPACE"
            ;;

        "rolling")
            # 回滚到上一版本
            kubectl rollout undo deployment/tuheg-backend-gateway -n "$K8S_NAMESPACE"
            ;;
    esac

    send_deployment_notification "FAILED (Rolled back)" "$DEPLOYMENT_TYPE"
    exit 1
}

# 主函数
main() {
    log_info "开始生产环境部署..."
    log_info "部署类型: $DEPLOYMENT_TYPE"
    log_info "版本: $VERSION"
    log_info "环境: $ENVIRONMENT"

    # 设置错误处理
    trap 'rollback_deployment "Unexpected error"' ERR

    # 执行部署流程
    check_deployment_prerequisites
    build_and_push_images
    run_database_migrations

    case "$DEPLOYMENT_TYPE" in
        "rolling")
            rolling_deployment
            ;;
        "blue-green")
            blue_green_deployment
            ;;
        "canary")
            canary_deployment
            ;;
        *)
            log_error "不支持的部署类型: $DEPLOYMENT_TYPE"
            echo "支持的类型: rolling, blue-green, canary"
            exit 1
            ;;
    esac

    # 发送成功通知
    send_deployment_notification "SUCCESS" "$DEPLOYMENT_TYPE"

    log_success "🎉 生产环境部署完成！"
    log_info "部署类型: $DEPLOYMENT_TYPE"
    log_info "版本: $VERSION"
    log_info "活跃环境: $(kubectl get configmap deployment-config -n "$K8S_NAMESPACE" -o jsonpath='{.data.ACTIVE_COLOR}' 2>/dev/null || echo 'N/A')"

    # 清理临时文件
    rm -f canary-ingress.yml migration-job.yml
}

# 参数验证
if [ $# -lt 1 ]; then
    echo "用法: $0 <部署类型> [版本]"
    echo "部署类型: rolling (滚动), blue-green (蓝绿), canary (金丝雀)"
    echo "版本: 默认 v1.0.0"
    exit 1
fi

# 执行主函数
main "$@"
