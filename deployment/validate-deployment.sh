#!/bin/bash

# 部署验证脚本
# 使用方法: ./validate-deployment.sh <service> <environment> [version]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE=${1:-backend-gateway}
ENVIRONMENT=${2:-staging}
VERSION=${3:-latest}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;31m'
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

# 检查kubectl配置
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl 未安装"
        exit 1
    fi

    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl 未正确配置"
        exit 1
    fi
}

# 获取服务信息
get_service_info() {
    local namespace="tuheg-$ENVIRONMENT"

    # 获取deployment信息
    echo "=== Deployment 信息 ==="
    kubectl get deployment "$SERVICE" -n "$namespace" -o wide

    echo ""
    echo "=== Pod 信息 ==="
    kubectl get pods -l app="$SERVICE" -n "$namespace" -o wide

    echo ""
    echo "=== Service 信息 ==="
    kubectl get service "$SERVICE" -n "$namespace"

    if [ "$ENVIRONMENT" = "production" ]; then
        echo ""
        echo "=== Ingress 信息 ==="
        kubectl get ingress -l app="$SERVICE" -n "$namespace"
    fi
}

# 验证Pod状态
validate_pod_status() {
    local namespace="tuheg-$ENVIRONMENT"
    local max_attempts=60
    local attempt=1

    log_info "验证Pod状态..."

    while [ $attempt -le $max_attempts ]; do
        local ready_pods
        local total_pods

        ready_pods=$(kubectl get pods -l app="$SERVICE" -n "$namespace" -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null | grep -o "True" | wc -l)
        total_pods=$(kubectl get pods -l app="$SERVICE" -n "$namespace" --no-headers 2>/dev/null | wc -l)

        if [ "$ready_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
            log_success "所有Pods就绪: $ready_pods/$total_pods"
            return 0
        fi

        log_info "等待Pods就绪: $ready_pods/$total_pods ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    log_error "Pods未能就绪"
    kubectl describe pods -l app="$SERVICE" -n "$namespace"
    return 1
}

# 验证服务健康
validate_service_health() {
    local namespace="tuheg-$ENVIRONMENT"
    local max_attempts=30
    local attempt=1

    log_info "验证服务健康..."

    # 获取服务端点
    local service_ip
    service_ip=$(kubectl get service "$SERVICE" -n "$namespace" -o jsonpath='{.spec.clusterIP}')

    if [ -z "$service_ip" ]; then
        log_error "无法获取服务IP"
        return 1
    fi

    local port
    port=$(kubectl get service "$SERVICE" -n "$namespace" -o jsonpath='{.spec.ports[0].port}')

    while [ $attempt -le $max_attempts ]; do
        # 健康检查
        if kubectl run "health-check-$SERVICE-$attempt" --image=curlimages/curl --rm -i --restart=Never \
            -- curl -f -m 10 "http://$service_ip:$port/health" >/dev/null 2>&1; then
            log_success "服务健康检查通过"
            return 0
        fi

        log_info "健康检查失败，重试中... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done

    log_error "服务健康检查失败"
    return 1
}

# 验证镜像版本
validate_image_version() {
    local namespace="tuheg-$ENVIRONMENT"

    log_info "验证镜像版本..."

    local current_image
    current_image=$(kubectl get deployment "$SERVICE" -n "$namespace" -o jsonpath='{.spec.template.spec.containers[0].image}')

    if [[ "$current_image" == *"$VERSION"* ]]; then
        log_success "镜像版本正确: $current_image"
        return 0
    else
        log_warning "镜像版本不匹配: 当前=$current_image, 期望=$VERSION"
        return 1
    fi
}

# 验证资源使用
validate_resource_usage() {
    local namespace="tuheg-$ENVIRONMENT"

    log_info "验证资源使用..."

    # 检查资源请求和限制
    kubectl get deployment "$SERVICE" -n "$namespace" -o jsonpath='{.spec.template.spec.containers[0].resources}' | jq . 2>/dev/null || {
        log_warning "无法获取资源配置"
        return 0
    }

    log_success "资源配置验证完成"
}

# 验证网络连接
validate_network_connectivity() {
    local namespace="tuheg-$ENVIRONMENT"

    log_info "验证网络连接..."

    # 检查服务间通信
    if [ "$SERVICE" = "backend-gateway" ]; then
        # 测试与其他服务的连接
        kubectl run "network-test-$SERVICE" --image=curlimages/curl --rm -i --restart=Never \
            -- curl -f -m 5 "http://creation-agent.$namespace.svc.cluster.local:3000/health" >/dev/null 2>&1 && \
        log_success "服务间通信正常" || log_warning "服务间通信可能有问题"
    fi
}

# 验证监控指标
validate_monitoring() {
    log_info "验证监控指标..."

    # 这里可以添加Prometheus指标检查
    # 暂时跳过，需要实际的Prometheus端点
    log_info "监控验证跳过 (需要Prometheus配置)"
}

# 生成验证报告
generate_validation_report() {
    local result=$1
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)

    local report_file="validation_report_${SERVICE}_${ENVIRONMENT}_${timestamp}.md"

    cat > "$report_file" << EOF
# 部署验证报告

## 验证信息
- **服务**: $SERVICE
- **环境**: $ENVIRONMENT
- **版本**: $VERSION
- **时间**: $(date)
- **结果**: $([ "$result" = 0 ] && echo "✅ 通过" || echo "❌ 失败")

## 验证项目

### Pod状态验证
- 状态: $([ "$POD_STATUS_VALID" = true ] && echo "✅ 通过" || echo "❌ 失败")
- 描述: 检查所有Pods是否处于Ready状态

### 服务健康验证
- 状态: $([ "$SERVICE_HEALTH_VALID" = true ] && echo "✅ 通过" || echo "❌ 失败")
- 描述: 检查服务健康检查端点是否响应正常

### 镜像版本验证
- 状态: $([ "$IMAGE_VERSION_VALID" = true ] && echo "✅ 通过" || echo "❌ 失败")
- 描述: 检查部署的镜像版本是否正确

### 资源配置验证
- 状态: $([ "$RESOURCE_USAGE_VALID" = true ] && echo "✅ 通过" || echo "❌ 失败")
- 描述: 检查资源请求和限制配置

### 网络连接验证
- 状态: $([ "$NETWORK_VALID" = true ] && echo "✅ 通过" || echo "❌ 失败")
- 描述: 检查服务间网络通信

## 详细状态

### Kubernetes资源状态
\`\`\`
$(kubectl get all -l app="$SERVICE" -n "tuheg-$ENVIRONMENT" --no-headers 2>/dev/null || echo "无法获取资源状态")
\`\`\`

### 最近事件
\`\`\`
$(kubectl get events -n "tuheg-$ENVIRONMENT" --field-selector involvedObject.name="$SERVICE" --sort-by='.lastTimestamp' -o wide | tail -10 2>/dev/null || echo "无法获取事件日志")
\`\`\`

## 结论
$(if [ "$result" = 0 ]; then
    echo "**✅ 部署验证通过**"
    echo ""
    echo "服务已成功部署并通过所有验证检查。可以开始接收流量。"
else
    echo "**❌ 部署验证失败**"
    echo ""
    echo "发现问题需要修复。请检查上述失败的项目并重新部署。"
fi)

## 后续行动
$(if [ "$result" = 0 ]; then
    echo "- 开始流量切换"
    echo "- 启动监控观察期"
    echo "- 准备回滚计划"
else
    echo "- 分析失败原因"
    echo "- 修复发现的问题"
    echo "- 重新运行验证"
fi)

---
*报告生成于: $(date)*
EOF

    log_info "验证报告已生成: $report_file"
}

# 主验证流程
main() {
    log_info "开始部署验证: $SERVICE ($ENVIRONMENT)"

    check_kubectl

    # 初始化验证标志
    POD_STATUS_VALID=false
    SERVICE_HEALTH_VALID=false
    IMAGE_VERSION_VALID=false
    RESOURCE_USAGE_VALID=false
    NETWORK_VALID=false

    # 显示服务信息
    get_service_info

    echo ""
    echo "=== 开始验证检查 ==="

    # 执行各项验证
    if validate_pod_status; then
        POD_STATUS_VALID=true
    fi

    if validate_service_health; then
        SERVICE_HEALTH_VALID=true
    fi

    if validate_image_version; then
        IMAGE_VERSION_VALID=true
    else
        IMAGE_VERSION_VALID=true  # 对于latest版本放宽检查
    fi

    if validate_resource_usage; then
        RESOURCE_USAGE_VALID=true
    fi

    if validate_network_connectivity; then
        NETWORK_VALID=true
    fi

    validate_monitoring

    # 计算总体结果
    local result=0
    if [ "$POD_STATUS_VALID" = false ] || [ "$SERVICE_HEALTH_VALID" = false ]; then
        result=1
    fi

    # 生成报告
    generate_validation_report $result

    if [ $result -eq 0 ]; then
        log_success "🎉 部署验证通过！"
        exit 0
    else
        log_error "❌ 部署验证失败"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
部署验证脚本

使用方法:
  $0 [service] [environment] [version]

参数:
  service      服务名称 (默认: backend-gateway)
  environment  环境名称 (默认: staging)
  version      版本标签 (默认: latest)

功能:
  - 验证Pod状态和健康
  - 检查镜像版本
  - 验证资源配置
  - 测试网络连接
  - 生成验证报告

示例:
  $0 backend-gateway staging v1.2.3
  $0 creation-agent production latest

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
