#!/bin/bash

# Sira AI Gateway 维护脚本

set -e

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_MODE="${1:-docker}"

# 维护配置
BACKUP_RETENTION_DAYS=7
LOG_RETENTION_DAYS=30
TEMP_CLEANUP_DAYS=7
HEALTH_CHECK_INTERVAL=300  # 5分钟

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

# 健康检查
health_check() {
    log_info "=== 执行健康检查 ==="

    local services=("http://localhost:8080/health" "http://localhost:3001/api/health")
    local failed_services=()

    for service in "${services[@]}"; do
        if ! curl -f -s --max-time 10 "$service" > /dev/null; then
            failed_services+=("$service")
            log_warning "服务不可用: $service"
        else
            log_success "服务正常: $service"
        fi
    done

    if [ ${#failed_services[@]} -gt 0 ]; then
        log_error "发现 ${#failed_services[@]} 个服务异常"
        return 1
    else
        log_success "所有服务正常"
        return 0
    fi
}

# 备份数据
backup_data() {
    log_info "=== 备份数据 ==="

    local backup_dir="$PROJECT_ROOT/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/backup_$timestamp.tar.gz"

    mkdir -p "$backup_dir"

    case $DEPLOY_MODE in
        docker)
            log_info "备份 Docker 数据卷..."

            # 备份 PostgreSQL 数据
            if docker ps | grep -q sira-postgres; then
                log_info "备份 PostgreSQL 数据..."
                docker exec sira-postgres pg_dump -U sira sira_gateway > "$backup_dir/postgres_$timestamp.sql"
            fi

            # 备份 Redis 数据
            if docker ps | grep -q sira-redis; then
                log_info "备份 Redis 数据..."
                docker run --rm -v sira_redis_data:/data -v "$backup_dir":/backup alpine tar czf "/backup/redis_$timestamp.tar.gz" -C /data .
            fi
            ;;
        kubernetes)
            log_info "备份 Kubernetes 数据..."

            # 备份 PostgreSQL 数据
            kubectl exec -n sira-gateway deployment/postgres -- pg_dump -U sira sira_gateway > "$backup_dir/postgres_$timestamp.sql"

            # 备份 Redis 数据
            kubectl exec -n sira-gateway deployment/redis -- redis-cli save
            kubectl cp sira-gateway/redis-pod:/data/dump.rdb "$backup_dir/redis_$timestamp.rdb" -n sira-gateway
            ;;
    esac

    # 备份配置文件和日志
    log_info "备份配置文件和日志..."
    tar czf "$backup_file" -C "$PROJECT_ROOT" \
        config/ \
        data/ \
        logs/ \
        --exclude='*.tmp' \
        --exclude='*.log.*'

    local backup_size=$(du -h "$backup_file" | cut -f1)
    log_success "备份完成: $backup_file (${backup_size})"

    # 清理旧备份
    cleanup_old_backups
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理旧备份文件..."

    local backup_dir="$PROJECT_ROOT/backups"
    local deleted_count=0

    # 删除超过保留期的备份
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_count++))
        log_info "删除旧备份: $(basename "$file")"
    done < <(find "$backup_dir" \( -name "backup_*.tar.gz" -o -name "postgres_*.sql" -o -name "redis_*.rdb" \) -mtime +$BACKUP_RETENTION_DAYS -print0)

    if [ $deleted_count -gt 0 ]; then
        log_success "清理了 $deleted_count 个旧备份文件"
    else
        log_info "没有需要清理的旧备份文件"
    fi
}

# 清理日志
cleanup_logs() {
    log_info "=== 清理日志文件 ==="

    local log_dirs=("$PROJECT_ROOT/logs" "/var/log/sira-gateway")
    local deleted_count=0

    for log_dir in "${log_dirs[@]}"; do
        if [ -d "$log_dir" ]; then
            # 压缩旧日志
            find "$log_dir" -name "*.log" -mtime +1 -exec gzip {} \; 2>/dev/null || true

            # 删除过期的压缩日志
            while IFS= read -r -d '' file; do
                rm -f "$file"
                ((deleted_count++))
                log_info "删除过期日志: $(basename "$file")"
            done < <(find "$log_dir" \( -name "*.log.gz" -o -name "*.log.*.gz" \) -mtime +$LOG_RETENTION_DAYS -print0)
        fi
    done

    # 清理 Docker 日志
    case $DEPLOY_MODE in
        docker)
            log_info "清理 Docker 容器日志..."
            docker system prune --volumes -f > /dev/null 2>&1 || true
            ;;
        kubernetes)
            log_info "清理 Kubernetes 日志..."
            kubectl delete pods --field-selector=status.phase=Succeeded -n sira-gateway --ignore-not-found=true
            kubectl delete pods --field-selector=status.phase=Failed -n sira-gateway --ignore-not-found=true
            ;;
    esac

    if [ $deleted_count -gt 0 ]; then
        log_success "清理了 $deleted_count 个过期日志文件"
    else
        log_info "没有需要清理的过期日志文件"
    fi
}

# 清理临时文件
cleanup_temp() {
    log_info "=== 清理临时文件 ==="

    local temp_dirs=("$PROJECT_ROOT/temp" "$PROJECT_ROOT/tmp" "/tmp/sira-gateway")
    local deleted_count=0

    for temp_dir in "${temp_dirs[@]}"; do
        if [ -d "$temp_dir" ]; then
            # 删除过期的临时文件
            while IFS= read -r -d '' file; do
                rm -f "$file"
                ((deleted_count++))
            done < <(find "$temp_dir" -type f -mtime +$TEMP_CLEANUP_DAYS -print0 2>/dev/null)

            # 删除空的子目录
            find "$temp_dir" -type d -empty -delete 2>/dev/null || true
        fi
    done

    # 清理系统临时文件
    if command -v tmpwatch &> /dev/null; then
        tmpwatch -m $((TEMP_CLEANUP_DAYS * 24)) /tmp/sira-gateway 2>/dev/null || true
    fi

    if [ $deleted_count -gt 0 ]; then
        log_success "清理了 $deleted_count 个临时文件"
    else
        log_info "没有需要清理的临时文件"
    fi
}

# 优化数据库
optimize_database() {
    log_info "=== 数据库优化 ==="

    case $DEPLOY_MODE in
        docker)
            if docker ps | grep -q sira-postgres; then
                log_info "优化 PostgreSQL 数据库..."

                # 执行 VACUUM ANALYZE
                docker exec sira-postgres psql -U sira -d sira_gateway -c "VACUUM ANALYZE;" 2>/dev/null || true

                # 重新索引
                docker exec sira-postgres psql -U sira -d sira_gateway -c "REINDEX DATABASE sira_gateway;" 2>/dev/null || true

                log_success "PostgreSQL 数据库优化完成"
            fi

            if docker ps | grep -q sira-redis; then
                log_info "优化 Redis 缓存..."

                # 清理过期键
                docker exec sira-redis redis-cli KEYS "*" | xargs -n 100 docker exec sira-redis redis-cli DEL 2>/dev/null || true

                log_success "Redis 缓存优化完成"
            fi
            ;;
        kubernetes)
            log_info "优化 Kubernetes 数据库..."

            # PostgreSQL 优化
            kubectl exec -n sira-gateway deployment/postgres -- psql -U sira -d sira_gateway -c "VACUUM ANALYZE;" 2>/dev/null || true
            kubectl exec -n sira-gateway deployment/postgres -- psql -U sira -d sira_gateway -c "REINDEX DATABASE sira_gateway;" 2>/dev/null || true

            # Redis 优化
            kubectl exec -n sira-gateway deployment/redis -- redis-cli KEYS "*" | xargs -n 100 kubectl exec -n sira-gateway deployment/redis -- redis-cli DEL 2>/dev/null || true

            log_success "数据库优化完成"
            ;;
    esac
}

# 更新依赖
update_dependencies() {
    log_info "=== 更新依赖 ==="

    cd "$PROJECT_ROOT"

    # 检查 package.json 是否有更新
    if command -v npm-check-updates &> /dev/null; then
        log_info "检查可用的依赖更新..."
        npm-check-updates --target minor || true
    fi

    # 更新依赖
    log_info "更新生产依赖..."
    npm update --production

    log_info "更新开发依赖..."
    npm update --save-dev

    # 清理 npm 缓存
    npm cache clean --force

    log_success "依赖更新完成"
}

# 安全检查
security_check() {
    log_info "=== 安全检查 ==="

    local issues_found=0

    # 检查文件权限
    log_info "检查文件权限..."
    local world_writable=$(find "$PROJECT_ROOT" -type f -perm -002 2>/dev/null | wc -l)
    if [ "$world_writable" -gt 0 ]; then
        log_warning "发现 $world_writable 个全局可写文件"
        ((issues_found++))
    fi

    # 检查敏感文件
    local sensitive_files=(".env" "config/secrets.yml" "k8s/secrets.yml")
    for file in "${sensitive_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            local perms=$(stat -c "%a" "$PROJECT_ROOT/$file" 2>/dev/null || stat -f "%A" "$PROJECT_ROOT/$file" 2>/dev/null)
            if [ "${perms: -1}" != "0" ]; then
                log_warning "敏感文件权限过宽: $file (${perms})"
                ((issues_found++))
            fi
        fi
    done

    # 检查运行中的进程
    log_info "检查运行中的进程..."
    case $DEPLOY_MODE in
        docker)
            local running_containers=$(docker ps --format "{{.Names}}" | grep -c sira || echo 0)
            if [ "$running_containers" -lt 1 ]; then
                log_warning "没有发现正在运行的 Sira 容器"
                ((issues_found++))
            fi
            ;;
        kubernetes)
            local running_pods=$(kubectl get pods -n sira-gateway --no-headers 2>/dev/null | grep -c Running || echo 0)
            if [ "$running_pods" -lt 1 ]; then
                log_warning "没有发现正在运行的 Sira Pod"
                ((issues_found++))
            fi
            ;;
    esac

    # 检查网络安全
    log_info "检查网络安全..."
    if command -v nmap &> /dev/null; then
        # 检查常见端口是否暴露
        local exposed_ports=$(netstat -tln 2>/dev/null | grep -E ":80 |:443 |:8080 |:3001 " | wc -l)
        if [ "$exposed_ports" -gt 0 ]; then
            log_info "发现 $exposed_ports 个服务端口暴露"
        fi
    fi

    if [ $issues_found -gt 0 ]; then
        log_warning "发现 $issues_found 个安全问题，建议及时处理"
    else
        log_success "安全检查通过"
    fi
}

# 生成维护报告
generate_report() {
    log_info "=== 生成维护报告 ==="

    local report_dir="$PROJECT_ROOT/reports/maintenance"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local report_file="$report_dir/report_$timestamp.md"

    mkdir -p "$report_dir"

    cat > "$report_file" << EOF
# Sira AI Gateway 维护报告
生成时间: $(date)

## 系统信息
- 主机名: $(hostname)
- 操作系统: $(uname -s) $(uname -r)
- 部署模式: $DEPLOY_MODE
- 维护脚本版本: 1.0.0

## 维护结果

### 健康检查
$(health_check 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | sed 's/^\[.*\] //' || echo "健康检查失败")

### 备份状态
- 备份目录: $PROJECT_ROOT/backups
- 备份保留期: ${BACKUP_RETENTION_DAYS} 天
- 最新备份: $(ls -la $PROJECT_ROOT/backups/backup_*.tar.gz 2>/dev/null | head -1 | awk '{print $6, $7, $8}' || echo "无")

### 日志清理
- 日志目录: $PROJECT_ROOT/logs
- 日志保留期: ${LOG_RETENTION_DAYS} 天
- 日志文件数量: $(find $PROJECT_ROOT/logs -name "*.log*" 2>/dev/null | wc -l)

### 临时文件清理
- 临时文件保留期: ${TEMP_CLEANUP_DAYS} 天
- 清理的临时文件数: $(find $PROJECT_ROOT/temp -type f -mtime +$TEMP_CLEANUP_DAYS 2>/dev/null | wc -l)

### 资源使用情况
\`\`\`
磁盘使用:
$(df -h $PROJECT_ROOT | tail -1)

内存使用:
$(free -h | grep "^Mem:")

进程数量:
$(ps aux | wc -l)
\`\`\`

## 建议

### 定期维护任务
1. **每日**: 健康检查、日志清理
2. **每周**: 备份数据、临时文件清理
3. **每月**: 数据库优化、安全检查
4. **每季度**: 依赖更新、系统升级

### 监控要点
1. 服务可用性 (99.9% SLA)
2. 响应时间 (< 200ms)
3. 错误率 (< 0.1%)
4. 资源使用率 (CPU < 70%, 内存 < 80%)

### 备份策略
1. **每日**: 自动备份数据库和配置文件
2. **每周**: 完整系统备份
3. **每月**: 异地备份
4. **保留期**: 7天本地，30天异地

---
维护报告生成时间: $(date)
EOF

    log_success "维护报告已生成: $report_file"
}

# 定时维护任务
schedule_maintenance() {
    log_info "=== 设置定时维护任务 ==="

    local cron_file="/etc/cron.d/sira-maintenance"

    # 创建 cron 任务
    cat > "$cron_file" << EOF
# Sira AI Gateway 维护任务
# 每5分钟执行健康检查
*/5 * * * * root $SCRIPT_DIR/maintenance.sh $DEPLOY_MODE health

# 每日凌晨2点执行完整维护
0 2 * * * root $SCRIPT_DIR/maintenance.sh $DEPLOY_MODE daily

# 每周日凌晨3点执行深度清理
0 3 * * 0 root $SCRIPT_DIR/maintenance.sh $DEPLOY_MODE weekly

# 每月1日凌晨4点执行全面维护
0 4 1 * * root $SCRIPT_DIR/maintenance.sh $DEPLOY_MODE monthly
EOF

    chmod 644 "$cron_file"
    log_success "定时维护任务已设置: $cron_file"
}

# 显示帮助
show_help() {
    cat << EOF
Sira AI Gateway 维护脚本

用法: $0 [模式] [命令]

模式:
  docker         Docker 部署维护 (默认)
  kubernetes     Kubernetes 部署维护

命令:
  health         健康检查
  backup         数据备份
  logs           日志清理
  temp           临时文件清理
  database       数据库优化
  security       安全检查
  update         依赖更新
  daily          每日维护 (备份+清理+检查)
  weekly         每周维护 (深度清理+优化)
  monthly        每月维护 (全面维护+更新)
  schedule       设置定时维护任务
  report         生成维护报告
  all            执行所有维护任务

示例:
  $0 docker health         # Docker 环境健康检查
  $0 kubernetes daily      # Kubernetes 环境每日维护
  $0 schedule              # 设置定时维护任务
  $0 report                # 生成维护报告

EOF
}

# 主函数
main() {
    local command="${2:-health}"

    case $command in
        health)
            health_check
            ;;
        backup)
            backup_data
            ;;
        logs)
            cleanup_logs
            ;;
        temp)
            cleanup_temp
            ;;
        database)
            optimize_database
            ;;
        security)
            security_check
            ;;
        update)
            update_dependencies
            ;;
        daily)
            log_info "执行每日维护任务..."
            backup_data
            cleanup_logs
            cleanup_temp
            health_check
            ;;
        weekly)
            log_info "执行每周维护任务..."
            cleanup_logs
            cleanup_temp
            optimize_database
            security_check
            ;;
        monthly)
            log_info "执行每月维护任务..."
            update_dependencies
            optimize_database
            security_check
            ;;
        schedule)
            schedule_maintenance
            ;;
        report)
            generate_report
            ;;
        all)
            log_info "执行所有维护任务..."
            health_check
            backup_data
            cleanup_logs
            cleanup_temp
            optimize_database
            security_check
            generate_report
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
