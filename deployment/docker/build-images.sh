#!/bin/bash

# Docker镜像构建脚本
# 使用方法: ./build-images.sh [version] [registry]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

VERSION=${1:-$(date +%Y%m%d_%H%M%S)}
REGISTRY=${2:-tuheg}
TAG=${VERSION}

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

# 服务列表
SERVICES=(
    "backend-gateway"
    "creation-agent"
    "logic-agent"
    "narrative-agent"
    "frontend"
)

# 构建单个服务镜像
build_service_image() {
    local service=$1
    local version=$2
    local registry=$3

    log_info "构建镜像: $registry/$service:$version"

    # 检查Dockerfile是否存在
    if [ ! -f "$PROJECT_ROOT/Dockerfile" ]; then
        log_error "Dockerfile不存在: $PROJECT_ROOT/Dockerfile"
        return 1
    fi

    # 构建镜像
    docker build \
        --target "${service//-/_}_prod" \
        --tag "$registry/$service:$version" \
        --tag "$registry/$service:latest" \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from "$registry/$service:latest" \
        --label "version=$version" \
        --label "build_date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --label "git_commit=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
        "$PROJECT_ROOT"

    if [ $? -eq 0 ]; then
        log_success "镜像构建成功: $registry/$service:$version"
        return 0
    else
        log_error "镜像构建失败: $registry/$service:$version"
        return 1
    fi
}

# 推送镜像到仓库
push_service_image() {
    local service=$1
    local version=$2
    local registry=$3

    log_info "推送镜像: $registry/$service:$version"

    # 推送版本标签
    docker push "$registry/$service:$version"

    # 推送latest标签
    docker push "$registry/$service:latest"

    if [ $? -eq 0 ]; then
        log_success "镜像推送成功: $registry/$service:$version"
        return 0
    else
        log_error "镜像推送失败: $registry/$service:$version"
        return 1
    fi
}

# 验证镜像
verify_image() {
    local service=$1
    local version=$2
    local registry=$3

    log_info "验证镜像: $registry/$service:$version"

    # 检查镜像是否存在
    if ! docker image inspect "$registry/$service:$version" >/dev/null 2>&1; then
        log_error "镜像不存在: $registry/$service:$version"
        return 1
    fi

    # 检查镜像标签
    local image_labels
    image_labels=$(docker image inspect "$registry/$service:$version" --format '{{json .Config.Labels}}')

    if echo "$image_labels" | grep -q '"version":'; then
        log_success "镜像验证通过: $registry/$service:$version"
        return 0
    else
        log_warning "镜像缺少版本标签: $registry/$service:$version"
        return 0  # 不作为错误处理
    fi
}

# 清理构建缓存
cleanup_build_cache() {
    log_info "清理构建缓存..."

    # 清理悬空镜像
    docker image prune -f

    # 清理构建缓存
    docker builder prune -f

    log_success "构建缓存清理完成"
}

# 生成镜像清单
generate_image_manifest() {
    local version=$1
    local registry=$2
    local manifest_file="image_manifest_$version.json"

    log_info "生成镜像清单: $manifest_file"

    cat > "$manifest_file" << EOF
{
  "version": "$version",
  "registry": "$registry",
  "build_date": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "images": [
EOF

    for service in "${SERVICES[@]}"; do
        local image_info
        image_info=$(docker image inspect "$registry/$service:$version" --format '{
  "name": "{{.RepoTags[0]}}",
  "size": {{.Size}},
  "created": "{{.Created}}",
  "labels": {{json .Config.Labels}}
}' 2>/dev/null || echo 'null')

        if [ "$image_info" != "null" ]; then
            cat >> "$manifest_file" << EOF
    $image_info,
EOF
        fi
    done

    # 移除最后一个逗号
    sed -i '$ s/,$//' "$manifest_file"

    cat >> "$manifest_file" << EOF
  ],
  "build_info": {
    "docker_version": "$(docker --version)",
    "buildkit_enabled": "$(docker buildx version 2>/dev/null || echo 'not available')",
    "platform": "$(uname -s)-$(uname -m)"
  }
}
EOF

    log_success "镜像清单生成完成: $manifest_file"
}

# 主构建流程
main() {
    log_info "开始Docker镜像构建流程"
    log_info "版本: $VERSION"
    log_info "仓库: $REGISTRY"

    local failed_services=()

    # 构建所有服务镜像
    for service in "${SERVICES[@]}"; do
        log_info "处理服务: $service"

        if build_service_image "$service" "$VERSION" "$REGISTRY"; then
            if push_service_image "$service" "$VERSION" "$REGISTRY"; then
                verify_image "$service" "$VERSION" "$REGISTRY"
            else
                failed_services+=("$service-push")
            fi
        else
            failed_services+=("$service-build")
        fi

        echo ""
    done

    # 生成镜像清单
    generate_image_manifest "$VERSION" "$REGISTRY"

    # 清理缓存
    cleanup_build_cache

    # 汇总结果
    if [ ${#failed_services[@]} -eq 0 ]; then
        log_success "🎉 所有镜像构建和推送成功！"
        log_info "镜像版本: $VERSION"
        log_info "镜像仓库: $REGISTRY"

        for service in "${SERVICES[@]}"; do
            echo "  - $REGISTRY/$service:$VERSION"
        done

        exit 0
    else
        log_error "❌ 以下服务构建/推送失败:"
        for failed in "${failed_services[@]}"; do
            echo "  - $failed"
        done

        exit 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
Docker镜像构建脚本

使用方法:
  $0 [version] [registry]

参数:
  version   镜像版本标签 (默认: 当前时间戳)
  registry  镜像仓库地址 (默认: tuheg)

示例:
  $0                          # 使用默认版本和仓库
  $0 v1.2.3                   # 指定版本
  $0 v1.2.3 myregistry.com    # 指定版本和仓库

功能:
  - 构建所有服务的Docker镜像
  - 推送镜像到指定仓库
  - 生成镜像清单文件
  - 清理构建缓存

EOF
}

# 参数处理
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
