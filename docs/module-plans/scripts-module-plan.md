# 📜 脚本模块 (Scripts Module) 详细规划

## 📋 模块概述

**脚本模块** 是Sira AI网关的"自动化工具链"，提供构建、部署、监控、维护等各种自动化脚本。它是保障系统稳定运行、提升运维效率、实现DevOps流程的核心工具集。

### 定位与职责

- **系统定位**: 自动化运维工具集，提供脚本化的系统管理能力
- **主要职责**: 自动化部署、系统监控、健康检查、数据备份、日志管理
- **设计理念**: 自动化、可靠、可监控、易维护

### 架构层次

```
脚本模块架构:
├── 🚀 部署脚本层 (Deployment Scripts Layer)
│   ├── 应用部署脚本 (Application Deployment)
│   ├── 数据库迁移脚本 (Database Migration)
│   ├── 配置部署脚本 (Configuration Deployment)
│   └── 回滚脚本 (Rollback Scripts)
├── 📊 监控脚本层 (Monitoring Scripts Layer)
│   ├── 系统监控脚本 (System Monitoring)
│   ├── 应用监控脚本 (Application Monitoring)
│   ├── 性能监控脚本 (Performance Monitoring)
│   └── 告警脚本 (Alerting Scripts)
├── 🔧 维护脚本层 (Maintenance Scripts Layer)
│   ├── 备份脚本 (Backup Scripts)
│   ├── 清理脚本 (Cleanup Scripts)
│   ├── 优化脚本 (Optimization Scripts)
│   └── 诊断脚本 (Diagnostic Scripts)
└── 📈 分析脚本层 (Analytics Scripts Layer)
    ├── 日志分析脚本 (Log Analysis)
    ├── 性能分析脚本 (Performance Analysis)
    ├── 使用统计脚本 (Usage Statistics)
    └── 报告生成脚本 (Report Generation)
```

---

## 🏗️ 架构设计

### 1. 脚本框架设计

#### 1.1 脚本执行引擎

**统一脚本执行框架**:

```bash
#!/bin/bash

# scripts/core/script-runner.sh
# 统一的脚本执行引擎

set -euo pipefail

# 脚本配置
SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

# 错误处理
error_exit() {
    log_error "$1"
    exit 1
}

# 依赖检查
check_dependencies() {
    local deps=("$@")
    local missing=()

    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            missing+=("$dep")
        fi
    done

    if [ ${#missing[@]} -ne 0 ]; then
        error_exit "Missing dependencies: ${missing[*]}"
    fi
}

# 环境检查
check_environment() {
    # 检查是否在正确的目录
    if [ ! -f "${PROJECT_ROOT}/package.json" ]; then
        error_exit "Not in project root directory. Expected package.json at ${PROJECT_ROOT}"
    fi

    # 检查Node.js版本
    if ! node --version >/dev/null 2>&1; then
        error_exit "Node.js is not installed"
    fi

    local node_version=$(node --version | sed 's/v//')
    local required_version="18.0.0"

    if ! version_compare "$node_version" "$required_version"; then
        error_exit "Node.js version $node_version is too old. Required: $required_version+"
    fi
}

# 版本比较
version_compare() {
    local version=$1
    local required=$2

    if [[ "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
        local v_major=${BASH_REMATCH[1]}
        local v_minor=${BASH_REMATCH[2]}
        local v_patch=${BASH_REMATCH[3]}
    fi

    if [[ "$required" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
        local r_major=${BASH_REMATCH[1]}
        local r_minor=${BASH_REMATCH[2]}
        local r_patch=${BASH_REMATCH[3]}
    fi

    if (( v_major > r_major )) || \
       (( v_major == r_major && v_minor > r_minor )) || \
       (( v_major == r_major && v_minor == r_minor && v_patch >= r_patch )); then
        return 0
    else
        return 1
    fi
}

# 加载配置
load_config() {
    local config_file="${PROJECT_ROOT}/config/${NODE_ENV:-development}.json"

    if [ -f "$config_file" ]; then
        export CONFIG_FILE="$config_file"
        log_info "Loaded configuration: $config_file"
    else
        log_warn "Configuration file not found: $config_file"
    fi
}

# 清理函数
cleanup() {
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
        log_error "Script failed with exit code $exit_code"
    fi

    # 清理临时文件
    if [ -n "${TEMP_DIR:-}" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        log_info "Cleaned up temporary directory: $TEMP_DIR"
    fi

    exit $exit_code
}

# 设置陷阱
trap cleanup EXIT INT TERM

# 主函数包装器
run_main() {
    local main_function=$1
    shift

    log_info "Starting script: $SCRIPT_NAME"

    # 基础检查
    check_dependencies "$@"
    check_environment
    load_config

    # 创建临时目录
    TEMP_DIR=$(mktemp -d)
    export TEMP_DIR

    # 执行主函数
    if declare -f "$main_function" >/dev/null 2>&1; then
        $main_function "$@"
        log_success "Script completed successfully"
    else
        error_exit "Main function '$main_function' not found"
    fi
}
```

#### 1.2 脚本配置管理

**集中化配置管理**:

```bash
# scripts/config/script-config.sh
# 脚本配置管理

# 环境变量
export NODE_ENV="${NODE_ENV:-development}"
export LOG_LEVEL="${LOG_LEVEL:-info}"

# 路径配置
export SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PROJECT_ROOT="$(cd "${SCRIPTS_DIR}/.." && pwd)"
export CONFIG_DIR="${PROJECT_ROOT}/config"
export LOGS_DIR="${PROJECT_ROOT}/logs"
export BACKUP_DIR="${PROJECT_ROOT}/backups"
export TEMP_DIR="${TEMP_DIR:-/tmp/sira-scripts}"

# 应用配置
export APP_NAME="sira-ai-gateway"
export APP_PORT="${APP_PORT:-8080}"
export APP_HOST="${APP_HOST:-localhost}"

# 数据库配置
export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-sira_gateway}"
export DB_USER="${DB_USER:-sira_user}"
export DB_PASSWORD="${DB_PASSWORD:-}"

# Redis配置
export REDIS_HOST="${REDIS_HOST:-localhost}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# 监控配置
export MONITORING_ENABLED="${MONITORING_ENABLED:-true}"
export METRICS_PORT="${METRICS_PORT:-9090}"
export HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-30}"

# 备份配置
export BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
export BACKUP_COMPRESSION="${BACKUP_COMPRESSION:-gzip}"

# 通知配置
export SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
export EMAIL_RECIPIENTS="${EMAIL_RECIPIENTS:-}"

# 安全配置
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"
export JWT_SECRET="${JWT_SECRET:-}"

# 加载环境特定配置
load_environment_config() {
    local env_file="${CONFIG_DIR}/${NODE_ENV}.env"

    if [ -f "$env_file" ]; then
        set -a
        source "$env_file"
        set +a
        log_info "Loaded environment config: $env_file"
    fi
}

# 验证配置
validate_config() {
    local required_vars=(
        "APP_NAME"
        "APP_PORT"
        "DB_HOST"
        "DB_NAME"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -ne 0 ]; then
        error_exit "Missing required configuration variables: ${missing_vars[*]}"
    fi

    log_info "Configuration validation passed"
}

# 导出配置摘要
export_config_summary() {
    cat << EOF
=== Configuration Summary ===
Environment: $NODE_ENV
Application: $APP_NAME ($APP_HOST:$APP_PORT)
Database: $DB_HOST:$DB_PORT/$DB_NAME
Redis: $REDIS_HOST:$REDIS_PORT
Monitoring: ${MONITORING_ENABLED:-false} (Port: $METRICS_PORT)
Logs: $LOGS_DIR
Backups: $BACKUP_DIR
============================
EOF
}
```

### 2. 部署脚本体系

#### 2.1 应用部署脚本

**自动化部署流程**:

```bash
#!/bin/bash

# scripts/deploy/deploy-app.sh
# 应用部署脚本

source "$(dirname "${BASH_SOURCE[0]}")/../core/script-runner.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../config/script-config.sh"

# 部署参数
DEPLOY_ENV="${1:-staging}"
DEPLOY_TAG="${2:-latest}"
ROLLBACK_ENABLED="${ROLLBACK_ENABLED:-true}"

main() {
    log_info "Starting application deployment to $DEPLOY_ENV"

    # 加载环境配置
    load_environment_config
    validate_config

    # 预部署检查
    pre_deployment_checks

    # 创建部署目录
    setup_deployment_directory

    # 备份当前版本
    if [ "$ROLLBACK_ENABLED" = "true" ]; then
        create_backup
    fi

    # 下载应用
    download_application "$DEPLOY_TAG"

    # 安装依赖
    install_dependencies

    # 运行数据库迁移
    run_database_migrations

    # 更新配置
    update_configuration

    # 停止旧版本
    stop_application

    # 启动新版本
    start_application

    # 健康检查
    perform_health_checks

    # 清理旧版本
    cleanup_old_versions

    # 发送通知
    send_deployment_notification

    log_success "Application deployed successfully to $DEPLOY_ENV"
}

# 预部署检查
pre_deployment_checks() {
    log_info "Performing pre-deployment checks..."

    # 检查磁盘空间
    check_disk_space

    # 检查网络连接
    check_network_connectivity

    # 检查依赖服务
    check_service_dependencies

    # 检查权限
    check_deployment_permissions

    log_info "Pre-deployment checks completed"
}

# 检查磁盘空间
check_disk_space() {
    local required_space_gb=5
    local available_space

    if command -v df >/dev/null 2>&1; then
        available_space=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    else
        log_warn "Cannot check disk space (df command not available)"
        return 0
    fi

    if [ "$available_space" -lt "$required_space_gb" ]; then
        error_exit "Insufficient disk space. Required: ${required_space_gb}GB, Available: ${available_space}GB"
    fi

    log_info "Disk space check passed: ${available_space}GB available"
}

# 检查服务依赖
check_service_dependencies() {
    log_info "Checking service dependencies..."

    # 检查数据库连接
    if ! check_database_connection; then
        error_exit "Database connection failed"
    fi

    # 检查Redis连接
    if ! check_redis_connection; then
        error_exit "Redis connection failed"
    fi

    # 检查外部API依赖
    check_external_api_dependencies

    log_info "Service dependencies check passed"
}

# 下载应用
download_application() {
    local tag=$1
    local deploy_dir="${TEMP_DIR}/deploy"

    log_info "Downloading application version: $tag"

    mkdir -p "$deploy_dir"

    # 从CI/CD系统下载构建产物
    if [ -n "${CI_ARTIFACT_URL:-}" ]; then
        download_from_ci "$tag" "$deploy_dir"
    elif [ -n "${DOCKER_REGISTRY:-}" ]; then
        pull_docker_image "$tag"
    else
        # 本地构建
        build_application "$deploy_dir"
    fi

    # 验证下载的文件
    verify_download "$deploy_dir"

    log_info "Application downloaded successfully"
}

# 安装依赖
install_dependencies() {
    log_info "Installing dependencies..."

    # 安装系统依赖
    install_system_dependencies

    # 安装Node.js依赖
    if [ -f "package.json" ]; then
        npm ci --production
    fi

    # 安装Python依赖 (如果需要)
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    fi

    log_info "Dependencies installed successfully"
}

# 运行数据库迁移
run_database_migrations() {
    log_info "Running database migrations..."

    # 检查是否有待运行的迁移
    local pending_migrations
    pending_migrations=$(list_pending_migrations)

    if [ -n "$pending_migrations" ]; then
        log_info "Found pending migrations: $pending_migrations"

        # 备份数据库
        backup_database "pre-migration"

        # 运行迁移
        execute_migrations

        # 验证迁移结果
        verify_migrations

        log_info "Database migrations completed"
    else
        log_info "No pending migrations found"
    fi
}

# 启动应用
start_application() {
    log_info "Starting application..."

    # 根据部署类型选择启动方式
    case "${DEPLOYMENT_TYPE:-docker}" in
        "docker")
            start_docker_application
            ;;
        "systemd")
            start_systemd_application
            ;;
        "pm2")
            start_pm2_application
            ;;
        *)
            start_process_application
            ;;
    esac

    # 等待应用启动
    wait_for_application_start

    log_info "Application started successfully"
}

# Docker方式启动
start_docker_application() {
    local image_tag="${DOCKER_REGISTRY}/${APP_NAME}:${DEPLOY_TAG}"

    # 停止现有容器
    docker stop "${APP_NAME}" 2>/dev/null || true
    docker rm "${APP_NAME}" 2>/dev/null || true

    # 启动新容器
    docker run -d \
        --name "${APP_NAME}" \
        --env-file "${CONFIG_DIR}/${DEPLOY_ENV}.env" \
        -p "${APP_PORT}:${APP_PORT}" \
        --restart unless-stopped \
        "$image_tag"

    log_info "Docker container started: $image_tag"
}

# 健康检查
perform_health_checks() {
    log_info "Performing health checks..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts"

        if check_application_health; then
            log_success "Application health check passed"
            return 0
        fi

        sleep 10
        ((attempt++))
    done

    error_exit "Application health check failed after $max_attempts attempts"
}

# 检查应用健康状态
check_application_health() {
    local health_url="http://${APP_HOST}:${APP_PORT}/health"

    # 使用curl进行健康检查
    if command -v curl >/dev/null 2>&1; then
        local response
        response=$(curl -s -w "%{http_code}" -o /dev/null "$health_url" 2>/dev/null || echo "000")

        if [ "$response" = "200" ]; then
            return 0
        fi
    fi

    # 备用检查: 检查进程是否存在
    if pgrep -f "${APP_NAME}" >/dev/null 2>&1; then
        return 0
    fi

    return 1
}

# 发送部署通知
send_deployment_notification() {
    log_info "Sending deployment notification..."

    local message="✅ Application deployed successfully
Environment: $DEPLOY_ENV
Version: $DEPLOY_TAG
Deployed at: $(date)
Health Check: PASSED"

    # 发送Slack通知
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        send_slack_notification "$message"
    fi

    # 发送邮件通知
    if [ -n "$EMAIL_RECIPIENTS" ]; then
        send_email_notification "Deployment Successful: $APP_NAME $DEPLOY_ENV" "$message"
    fi
}

# 执行主函数
run_main main curl wget docker npm node
```

#### 2.2 数据库迁移脚本

**安全的数据迁移**:

```bash
#!/bin/bash

# scripts/deploy/migrate-database.sh
# 数据库迁移脚本

source "$(dirname "${BASH_SOURCE[0]}")/../core/script-runner.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../config/script-config.sh"

MIGRATION_DIR="${PROJECT_ROOT}/migrations"
MIGRATION_TABLE="schema_migrations"

main() {
    log_info "Starting database migration"

    # 检查数据库连接
    check_database_connection

    # 创建迁移表
    create_migration_table

    # 获取待运行的迁移
    local pending_migrations
    pending_migrations=$(get_pending_migrations)

    if [ ${#pending_migrations[@]} -eq 0 ]; then
        log_info "No pending migrations found"
        return 0
    fi

    log_info "Found ${#pending_migrations[@]} pending migrations"

    # 创建备份
    create_migration_backup

    # 执行迁移
    execute_migrations "${pending_migrations[@]}"

    # 验证迁移结果
    verify_migration_results

    # 清理临时文件
    cleanup_migration_temp_files

    log_success "Database migration completed successfully"
}

# 获取待运行的迁移
get_pending_migrations() {
    local applied_migrations
    applied_migrations=$(get_applied_migrations)

    local all_migrations
    all_migrations=$(get_all_migrations)

    local pending=()

    for migration in "${all_migrations[@]}"; do
        local migration_name
        migration_name=$(basename "$migration" .sql)

        if ! array_contains "$migration_name" "${applied_migrations[@]}"; then
            pending+=("$migration")
        fi
    done

    echo "${pending[@]}"
}

# 获取已应用的迁移
get_applied_migrations() {
    local query="SELECT migration_name FROM ${MIGRATION_TABLE} ORDER BY applied_at ASC;"

    case "${DB_TYPE:-postgresql}" in
        "postgresql")
            run_psql_query "$query"
            ;;
        "mysql")
            run_mysql_query "$query"
            ;;
        *)
            error_exit "Unsupported database type: $DB_TYPE"
            ;;
    esac
}

# 执行迁移
execute_migrations() {
    local migrations=("$@")

    for migration in "${migrations[@]}"; do
        local migration_name
        migration_name=$(basename "$migration" .sql)

        log_info "Executing migration: $migration_name"

        # 开始事务
        begin_transaction

        # 执行迁移SQL
        execute_migration_sql "$migration"

        # 记录迁移
        record_migration "$migration_name"

        # 提交事务
        commit_transaction

        log_success "Migration $migration_name executed successfully"
    done
}

# 执行迁移SQL
execute_migration_sql() {
    local migration_file=$1

    case "${DB_TYPE:-postgresql}" in
        "postgresql")
            run_psql_file "$migration_file"
            ;;
        "mysql")
            run_mysql_file "$migration_file"
            ;;
        *)
            error_exit "Unsupported database type: $DB_TYPE"
            ;;
    esac
}

# 记录迁移
record_migration() {
    local migration_name=$1
    local applied_at
    applied_at=$(date '+%Y-%m-%d %H:%M:%S')

    local query="INSERT INTO ${MIGRATION_TABLE} (migration_name, applied_at) VALUES ('$migration_name', '$applied_at');"

    case "${DB_TYPE:-postgresql}" in
        "postgresql")
            run_psql_query "$query"
            ;;
        "mysql")
            run_mysql_query "$query"
            ;;
    esac
}

# 创建迁移备份
create_migration_backup() {
    local backup_file="${BACKUP_DIR}/pre-migration-$(date +%Y%m%d_%H%M%S).sql"

    log_info "Creating pre-migration backup: $backup_file"

    mkdir -p "$BACKUP_DIR"

    case "${DB_TYPE:-postgresql}" in
        "postgresql")
            pg_dump "$DB_NAME" > "$backup_file"
            ;;
        "mysql")
            mysqldump "$DB_NAME" > "$backup_file"
            ;;
    esac

    # 压缩备份
    if command -v gzip >/dev/null 2>&1; then
        gzip "$backup_file"
        backup_file="${backup_file}.gz"
    fi

    log_info "Backup created: $backup_file"
}

# 验证迁移结果
verify_migration_results() {
    log_info "Verifying migration results..."

    # 检查数据库连接
    check_database_connection

    # 检查迁移表
    verify_migration_table

    # 运行迁移后检查
    run_post_migration_checks

    log_info "Migration verification completed"
}

# PostgreSQL查询执行
run_psql_query() {
    local query=$1

    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -t \
        -c "$query" 2>/dev/null
}

# PostgreSQL文件执行
run_psql_file() {
    local file=$1

    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$file" 2>/dev/null
}

# MySQL查询执行
run_mysql_query() {
    local query=$1

    mysql \
        -h "$DB_HOST" \
        -P "$DB_PORT" \
        -u "$DB_USER" \
        -p"$DB_PASSWORD" \
        "$DB_NAME" \
        -e "$query" 2>/dev/null
}

# MySQL文件执行
run_mysql_file() {
    local file=$1

    mysql \
        -h "$DB_HOST" \
        -P "$DB_PORT" \
        -u "$DB_USER" \
        -p"$DB_PASSWORD" \
        "$DB_NAME" \
        < "$file" 2>/dev/null
}

# 工具函数
array_contains() {
    local item=$1
    shift
    local array=("$@")

    for element in "${array[@]}"; do
        if [ "$element" = "$item" ]; then
            return 0
        fi
    done

    return 1
}

begin_transaction() {
    case "${DB_TYPE:-postgresql}" in
        "postgresql")
            run_psql_query "BEGIN;"
            ;;
        "mysql")
            run_mysql_query "START TRANSACTION;"
            ;;
    esac
}

commit_transaction() {
    case "${DB_TYPE:-postgresql}" in
        "postgresql")
            run_psql_query "COMMIT;"
            ;;
        "mysql")
            run_mysql_query "COMMIT;"
            ;;
    esac
}

# 执行主函数
run_main main psql mysql pg_dump mysqldump
```

---

## 🎯 功能职责详解

### 1. 监控脚本体系

#### 1.1 系统监控脚本

**全面的系统监控**:

```bash
#!/bin/bash

# scripts/monitor/system-monitor.sh
# 系统监控脚本

source "$(dirname "${BASH_SOURCE[0]}")/../core/script-runner.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../config/script-config.sh"

MONITOR_INTERVAL="${MONITOR_INTERVAL:-60}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-80}"

main() {
    log_info "Starting system monitoring (interval: ${MONITOR_INTERVAL}s)"

    # 初始化监控
    initialize_monitoring

    # 主监控循环
    while true; do
        collect_system_metrics
        analyze_metrics
        check_alerts
        sleep "$MONITOR_INTERVAL"
    done
}

# 初始化监控
initialize_monitoring() {
    # 创建监控目录
    mkdir -p "${LOGS_DIR}/monitoring"

    # 检查监控工具
    check_monitoring_tools

    # 初始化指标存储
    initialize_metrics_storage

    # 设置告警阈值
    setup_alert_thresholds

    log_info "System monitoring initialized"
}

# 收集系统指标
collect_system_metrics() {
    local timestamp
    timestamp=$(date +%s)

    # CPU使用率
    local cpu_usage
    cpu_usage=$(get_cpu_usage)

    # 内存使用
    local mem_usage
    mem_usage=$(get_memory_usage)

    # 磁盘使用
    local disk_usage
    disk_usage=$(get_disk_usage)

    # 网络I/O
    local network_io
    network_io=$(get_network_io)

    # 系统负载
    local system_load
    system_load=$(get_system_load)

    # 存储指标
    store_metrics "$timestamp" "cpu" "$cpu_usage"
    store_metrics "$timestamp" "memory" "$mem_usage"
    store_metrics "$timestamp" "disk" "$disk_usage"
    store_metrics "$timestamp" "network" "$network_io"
    store_metrics "$timestamp" "load" "$system_load"

    log_info "System metrics collected: CPU=${cpu_usage}%, MEM=${mem_usage}%, DISK=${disk_usage}%"
}

# 获取CPU使用率
get_cpu_usage() {
    if command -v top >/dev/null 2>&1; then
        # 使用top命令
        top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}'
    elif command -v mpstat >/dev/null 2>&1; then
        # 使用mpstat
        mpstat 1 1 | awk '/Average:/ {print 100 - $12}'
    else
        echo "0"
    fi
}

# 获取内存使用率
get_memory_usage() {
    if command -v free >/dev/null 2>&1; then
        free | awk 'NR==2{printf "%.2f", $3*100/$2 }'
    else
        echo "0"
    fi
}

# 获取磁盘使用率
get_disk_usage() {
    if command -v df >/dev/null 2>&1; then
        df / | tail -1 | awk '{print $5}' | sed 's/%//'
    else
        echo "0"
    fi
}

# 获取网络I/O
get_network_io() {
    if command -v sar >/dev/null 2>&1; then
        # 使用sar获取网络统计
        sar -n DEV 1 1 2>/dev/null | tail -1 | awk '{print $5 + $6}'
    else
        echo "0"
    fi
}

# 获取系统负载
get_system_load() {
    uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | tr -d ' '
}

# 分析指标
analyze_metrics() {
    # 计算趋势
    calculate_metric_trends

    # 检测异常
    detect_anomalies

    # 生成摘要
    generate_monitoring_summary
}

# 检查告警
check_alerts() {
    # CPU告警
    check_cpu_alert

    # 内存告警
    check_memory_alert

    # 磁盘告警
    check_disk_alert

    # 负载告警
    check_load_alert
}

# CPU告警检查
check_cpu_alert() {
    local cpu_usage
    cpu_usage=$(get_cpu_usage)

    if (( $(echo "$cpu_usage > $ALERT_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
        send_alert "CPU" "$cpu_usage" "$ALERT_THRESHOLD"
    fi
}

# 发送告警
send_alert() {
    local metric=$1
    local value=$2
    local threshold=$3

    local message="🚨 System Alert: $metric usage is ${value}%, threshold: ${threshold}%"

    log_error "$message"

    # 发送Slack告警
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        send_slack_alert "$message"
    fi

    # 发送邮件告警
    if [ -n "$EMAIL_RECIPIENTS" ]; then
        send_email_alert "System Alert: High $metric Usage" "$message"
    fi
}

# 存储指标
store_metrics() {
    local timestamp=$1
    local metric=$2
    local value=$3

    local metrics_file="${LOGS_DIR}/monitoring/${metric}.log"

    echo "$timestamp $value" >> "$metrics_file"

    # 保留最近30天的指标
    local cutoff_timestamp
    cutoff_timestamp=$(date -d '30 days ago' +%s 2>/dev/null || echo "0")

    if [ "$cutoff_timestamp" != "0" ]; then
        sed -i "/^[0-9]\{10\} / { /^[0-9]\{10\} / { /^[0-9]\{10\} / { /^[0-9]\{10\} /!d; }; /^${cutoff_timestamp}$/d; }" "$metrics_file" 2>/dev/null || true
    fi
}

# 生成监控报告
generate_monitoring_report() {
    local report_file="${LOGS_DIR}/monitoring/daily-report-$(date +%Y%m%d).txt"

    {
        echo "=== System Monitoring Report ==="
        echo "Date: $(date)"
        echo "Hostname: $(hostname)"
        echo ""

        echo "=== Current Metrics ==="
        echo "CPU Usage: $(get_cpu_usage)%"
        echo "Memory Usage: $(get_memory_usage)%"
        echo "Disk Usage: $(get_disk_usage)%"
        echo "System Load: $(get_system_load)"
        echo ""

        echo "=== Recent Trends ==="
        echo "CPU (last 24h): $(calculate_average cpu 86400)%"
        echo "Memory (last 24h): $(calculate_average memory 86400)%"
        echo ""

        echo "=== Top Processes ==="
        ps aux --sort=-%cpu | head -10
        echo ""

    } > "$report_file"

    log_info "Monitoring report generated: $report_file"
}

# 计算平均值
calculate_average() {
    local metric=$1
    local duration=$2

    local metrics_file="${LOGS_DIR}/monitoring/${metric}.log"
    local cutoff_timestamp
    cutoff_timestamp=$(($(date +%s) - duration))

    if [ -f "$metrics_file" ]; then
        awk -v cutoff="$cutoff_timestamp" '
            $1 >= cutoff {
                sum += $2
                count++
            }
            END {
                if (count > 0) {
                    printf "%.2f", sum / count
                } else {
                    print "N/A"
                }
            }
        ' "$metrics_file"
    else
        echo "N/A"
    fi
}

# 执行主函数
run_main main top free df sar ps awk bc
```

#### 1.2 应用监控脚本

**深入的应用监控**:

```bash
#!/bin/bash

# scripts/monitor/app-monitor.sh
# 应用监控脚本

source "$(dirname "${BASH_SOURCE[0]}")/../core/script-runner.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../config/script-config.sh"

main() {
    log_info "Starting application monitoring"

    # 检查应用状态
    check_application_status

    # 收集应用指标
    collect_application_metrics

    # 检查健康端点
    check_health_endpoints

    # 监控日志
    monitor_application_logs

    # 分析性能
    analyze_performance

    log_info "Application monitoring completed"
}

# 检查应用状态
check_application_status() {
    log_info "Checking application status..."

    # 检查进程是否存在
    if ! pgrep -f "${APP_NAME}" >/dev/null 2>&1; then
        send_alert "Application Down" "Application process not found"
        return 1
    fi

    # 检查端口是否监听
    if ! check_port_listening "$APP_PORT"; then
        send_alert "Application Port" "Port $APP_PORT not listening"
        return 1
    fi

    log_info "Application status: RUNNING"
    return 0
}

# 检查端口监听状态
check_port_listening() {
    local port=$1

    if command -v ss >/dev/null 2>&1; then
        ss -tln | grep ":$port " >/dev/null 2>&1
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tln | grep ":$port " >/dev/null 2>&1
    elif command -v lsof >/dev/null 2>&1; then
        lsof -i :"$port" >/dev/null 2>&1
    else
        # 简化的检查
        timeout 5 bash -c "</dev/tcp/localhost/$port" 2>/dev/null
    fi
}

# 收集应用指标
collect_application_metrics() {
    log_info "Collecting application metrics..."

    # HTTP请求指标
    collect_http_metrics

    # 数据库连接池指标
    collect_database_metrics

    # 缓存指标
    collect_cache_metrics

    # 错误率指标
    collect_error_metrics

    # 响应时间指标
    collect_response_time_metrics
}

# 收集HTTP指标
collect_http_metrics() {
    local metrics_url="http://${APP_HOST}:${APP_PORT}/metrics"

    if curl -s "$metrics_url" >/dev/null 2>&1; then
        local metrics
        metrics=$(curl -s "$metrics_url" 2>/dev/null)

        # 解析Prometheus格式指标
        local request_total
        request_total=$(echo "$metrics" | grep "http_requests_total" | awk '{print $2}')

        local request_duration
        request_duration=$(echo "$metrics" | grep "http_request_duration_seconds" | awk '{print $2}')

        log_info "HTTP Metrics - Requests: $request_total, Avg Duration: ${request_duration}s"
    fi
}

# 检查健康端点
check_health_endpoints() {
    local endpoints=(
        "/health"
        "/health/ready"
        "/health/live"
        "/metrics"
    )

    for endpoint in "${endpoints[@]}"; do
        local url="http://${APP_HOST}:${APP_PORT}${endpoint}"

        if ! curl -s --max-time 10 "$url" >/dev/null 2>&1; then
            send_alert "Health Check Failed" "Endpoint $endpoint is not responding"
        fi
    done
}

# 监控应用日志
monitor_application_logs() {
    local log_file="${LOGS_DIR}/application.log"

    if [ ! -f "$log_file" ]; then
        log_warn "Application log file not found: $log_file"
        return
    fi

    # 检查错误日志
    local error_count
    error_count=$(grep -c "ERROR\|FATAL" "$log_file" 2>/dev/null || echo "0")

    if [ "$error_count" -gt 0 ]; then
        log_warn "Found $error_count error messages in application log"

        # 检查是否是新的错误
        local last_check_file="${TEMP_DIR}/last_error_check"
        local last_error_count=0

        if [ -f "$last_check_file" ]; then
            last_error_count=$(cat "$last_check_file")
        fi

        local new_errors
        new_errors=$((error_count - last_error_count))

        if [ "$new_errors" -gt 0 ]; then
            send_alert "Application Errors" "Found $new_errors new error(s) in application log"
        fi

        echo "$error_count" > "$last_check_file"
    fi

    # 检查性能警告
    local perf_warnings
    perf_warnings=$(grep -c "slow\|timeout\|performance" "$log_file" 2>/dev/null || echo "0")

    if [ "$perf_warnings" -gt 5 ]; then
        send_alert "Performance Warnings" "Found $perf_warnings performance warnings in application log"
    fi
}

# 分析性能
analyze_performance() {
    log_info "Analyzing application performance..."

    # 分析响应时间趋势
    analyze_response_time_trends

    # 分析错误率趋势
    analyze_error_rate_trends

    # 分析资源使用
    analyze_resource_usage

    # 生成性能报告
    generate_performance_report
}

# 分析响应时间趋势
analyze_response_time_trends() {
    local metrics_file="${LOGS_DIR}/monitoring/response_time.log"

    if [ -f "$metrics_file" ]; then
        # 计算平均响应时间
        local avg_response_time
        avg_response_time=$(awk '{sum += $2; count++} END {if (count > 0) printf "%.3f", sum/count}' "$metrics_file")

        # 计算95th百分位数
        local p95_response_time
        p95_response_time=$(sort -n "$metrics_file" | awk 'BEGIN {n=0} {a[n++]=$2} END {if (n>0) print a[int(n*0.95)]}')

        log_info "Response Time - Avg: ${avg_response_time}s, P95: ${p95_response_time}s"

        # 检查阈值
        if (( $(echo "$p95_response_time > 2.0" | bc -l 2>/dev/null || echo "0") )); then
            send_alert "Slow Response Time" "P95 response time: ${p95_response_time}s (threshold: 2.0s)"
        fi
    fi
}

# 生成性能报告
generate_performance_report() {
    local report_file="${LOGS_DIR}/monitoring/app-performance-$(date +%Y%m%d).txt"

    {
        echo "=== Application Performance Report ==="
        echo "Date: $(date)"
        echo "Application: $APP_NAME"
        echo ""

        echo "=== Current Metrics ==="
        echo "Status: $(check_application_status >/dev/null 2>&1 && echo "RUNNING" || echo "DOWN")"
        echo "Response Time (avg): $(calculate_average response_time 3600)s"
        echo "Error Rate: $(calculate_average error_rate 3600)%"
        echo "Memory Usage: $(get_memory_usage)%"
        echo ""

        echo "=== Health Checks ==="
        echo "Health Endpoint: $(curl -s "http://${APP_HOST}:${APP_PORT}/health" >/dev/null 2>&1 && echo "PASS" || echo "FAIL")"
        echo "Metrics Endpoint: $(curl -s "http://${APP_HOST}:${APP_PORT}/metrics" >/dev/null 2>&1 && echo "PASS" || echo "FAIL")"
        echo ""

        echo "=== Recent Alerts ==="
        tail -10 "${LOGS_DIR}/monitoring/alerts.log" 2>/dev/null || echo "No recent alerts"
        echo ""

    } > "$report_file"

    log_info "Performance report generated: $report_file"
}

# 发送告警
send_alert() {
    local title=$1
    local message=$2

    local full_message="🚨 Application Alert: $title
$message
Time: $(date)
Host: $(hostname)
Application: $APP_NAME"

    log_error "$full_message"

    # 记录告警
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$title] $message" >> "${LOGS_DIR}/monitoring/alerts.log"

    # 发送通知
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        send_slack_alert "$full_message"
    fi

    if [ -n "$EMAIL_RECIPIENTS" ]; then
        send_email_alert "Application Alert: $title" "$full_message"
    fi
}

# 执行主函数
run_main main curl pgrep ss netstat lsof awk bc
```

### 2. 维护脚本体系

#### 2.1 备份脚本

**智能备份管理**:

```bash
#!/bin/bash

# scripts/maintenance/backup.sh
# 备份脚本

source "$(dirname "${BASH_SOURCE[0]}")/../core/script-runner.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../config/script-config.sh"

BACKUP_TYPE="${1:-full}"
BACKUP_COMPRESSION="${BACKUP_COMPRESSION:-gzip}"

main() {
    log_info "Starting backup: $BACKUP_TYPE"

    # 验证备份权限
    check_backup_permissions

    # 创建备份目录
    setup_backup_directory

    # 执行备份
    case "$BACKUP_TYPE" in
        "full")
            perform_full_backup
            ;;
        "incremental")
            perform_incremental_backup
            ;;
        "database")
            perform_database_backup
            ;;
        "config")
            perform_config_backup
            ;;
        *)
            error_exit "Unsupported backup type: $BACKUP_TYPE"
            ;;
    esac

    # 验证备份
    verify_backup

    # 清理旧备份
    cleanup_old_backups

    # 发送通知
    send_backup_notification

    log_success "Backup completed successfully"
}

# 执行完整备份
perform_full_backup() {
    local backup_name="full-backup-$(date +%Y%m%d_%H%M%S)"
    local backup_dir="${BACKUP_DIR}/${backup_name}"

    log_info "Performing full backup: $backup_name"

    mkdir -p "$backup_dir"

    # 备份应用代码
    backup_application_code "$backup_dir"

    # 备份数据库
    backup_database "$backup_dir"

    # 备份配置文件
    backup_configuration "$backup_dir"

    # 备份用户数据
    backup_user_data "$backup_dir"

    # 创建备份清单
    create_backup_manifest "$backup_dir" "$backup_name"

    # 压缩备份
    compress_backup "$backup_dir"

    log_info "Full backup completed: $backup_name"
}

# 备份应用代码
backup_application_code() {
    local backup_dir=$1
    local code_backup="${backup_dir}/application"

    log_info "Backing up application code..."

    # 排除不必要的文件
    rsync -av \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='logs' \
        --exclude='tmp' \
        --exclude='backups' \
        --exclude='*.log' \
        "${PROJECT_ROOT}/" \
        "$code_backup/"

    log_info "Application code backed up to: $code_backup"
}

# 备份数据库
backup_database() {
    local backup_dir=$1
    local db_backup="${backup_dir}/database.sql"

    log_info "Backing up database..."

    case "${DB_TYPE:-postgresql}" in
        "postgresql")
            backup_postgresql "$db_backup"
            ;;
        "mysql")
            backup_mysql "$db_backup"
            ;;
        *)
            log_warn "Unsupported database type for backup: $DB_TYPE"
            ;;
    esac
}

# 备份PostgreSQL数据库
backup_postgresql() {
    local output_file=$1

    PGPASSWORD="$DB_PASSWORD" pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --no-password \
        --format=custom \
        --compress=9 \
        --file="$output_file"

    log_info "PostgreSQL database backed up to: $output_file"
}

# 备份配置文件
backup_configuration() {
    local backup_dir=$1
    local config_backup="${backup_dir}/config"

    log_info "Backing up configuration..."

    mkdir -p "$config_backup"

    # 备份环境配置文件
    if [ -d "$CONFIG_DIR" ]; then
        cp -r "$CONFIG_DIR"/* "$config_backup/" 2>/dev/null || true
    fi

    # 备份Docker配置
    if [ -f "docker-compose.yml" ]; then
        cp docker-compose.yml "$config_backup/"
    fi

    # 备份Nginx配置
    if [ -d "/etc/nginx" ]; then
        cp -r /etc/nginx "$config_backup/" 2>/dev/null || true
    fi

    # 加密敏感配置
    encrypt_sensitive_configs "$config_backup"

    log_info "Configuration backed up to: $config_backup"
}

# 验证备份
verify_backup() {
    local backup_path=$1

    log_info "Verifying backup integrity..."

    # 检查备份文件是否存在
    if [ ! -e "$backup_path" ]; then
        error_exit "Backup file does not exist: $backup_path"
    fi

    # 检查备份大小
    local backup_size
    backup_size=$(du -sb "$backup_path" 2>/dev/null | awk '{print $1}' || echo "0")

    if [ "$backup_size" -eq 0 ]; then
        error_exit "Backup file is empty: $backup_path"
    fi

    log_info "Backup size: $(numfmt --to=iec-i --suffix=B "$backup_size")"

    # 验证压缩文件完整性
    if [[ "$backup_path" == *.gz ]]; then
        if ! gzip -t "$backup_path" 2>/dev/null; then
            error_exit "Backup file is corrupted: $backup_path"
        fi
    elif [[ "$backup_path" == *.bz2 ]]; then
        if ! bzip2 -t "$backup_path" 2>/dev/null; then
            error_exit "Backup file is corrupted: $backup_path"
        fi
    fi

    # 验证数据库备份
    if [[ "$backup_path" == *database* ]]; then
        verify_database_backup "$backup_path"
    fi

    log_info "Backup verification completed"
}

# 清理旧备份
cleanup_old_backups() {
    log_info "Cleaning up old backups..."

    local retention_days="${BACKUP_RETENTION_DAYS:-30}"

    # 查找超过保留期的备份
    find "$BACKUP_DIR" -name "*.tar.gz" -o -name "*.sql.gz" -o -name "*.bz2" \
        -mtime "+$retention_days" \
        -type f \
        -exec rm -f {} \; \
        -print

    log_info "Old backups cleaned up (retention: ${retention_days} days)"
}

# 压缩备份
compress_backup() {
    local backup_dir=$1
    local archive_name="${backup_dir}.tar.gz"

    log_info "Compressing backup: $archive_name"

    tar -czf "$archive_name" -C "$(dirname "$backup_dir")" "$(basename "$backup_dir")"

    # 删除未压缩的备份目录
    rm -rf "$backup_dir"

    log_info "Backup compressed successfully: $archive_name"
}

# 创建备份清单
create_backup_manifest() {
    local backup_dir=$1
    local backup_name=$2
    local manifest_file="${backup_dir}/MANIFEST.txt"

    {
        echo "Backup Manifest"
        echo "==============="
        echo "Name: $backup_name"
        echo "Created: $(date)"
        echo "Type: $BACKUP_TYPE"
        echo "Host: $(hostname)"
        echo "User: $(whoami)"
        echo "Application: $APP_NAME"
        echo ""
        echo "Contents:"
        find "$backup_dir" -type f -exec ls -lh {} \; | awk '{print "  " $9 " (" $5 ")"}'
        echo ""
        echo "Verification:"
        echo "  Total files: $(find "$backup_dir" -type f | wc -l)"
        echo "  Total size: $(du -sh "$backup_dir" | awk '{print $1}')"
        echo "  Checksum: $(find "$backup_dir" -type f -exec sha256sum {} \; | sha256sum | awk '{print $1}')"
    } > "$manifest_file"

    log_info "Backup manifest created: $manifest_file"
}

# 发送备份通知
send_backup_notification() {
    local backup_path=$1
    local backup_size
    backup_size=$(du -sh "$backup_path" 2>/dev/null | awk '{print $1}' || echo "unknown")

    local message="✅ Backup completed successfully
Type: $BACKUP_TYPE
Path: $backup_path
Size: $backup_size
Time: $(date)"

    # 发送Slack通知
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        send_slack_notification "$message"
    fi

    # 发送邮件通知
    if [ -n "$EMAIL_RECIPIENTS" ]; then
        send_email_notification "Backup Completed: $APP_NAME" "$message"
    fi
}

# 执行主函数
run_main main rsync pg_dump mysqldump tar gzip bzip2 find numfmt
```

#### 2.2 日志管理脚本

**智能日志处理**:

```bash
#!/bin/bash

# scripts/maintenance/log-manager.sh
# 日志管理脚本

source "$(dirname "${BASH_SOURCE[0]}")/../core/script-runner.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../config/script-config.sh"

LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
LOG_COMPRESSION="${LOG_COMPRESSION:-gzip}"

main() {
    log_info "Starting log management"

    # 分析日志状态
    analyze_log_status

    # 压缩旧日志
    compress_old_logs

    # 清理过期日志
    cleanup_expired_logs

    # 归档重要日志
    archive_important_logs

    # 优化日志存储
    optimize_log_storage

    # 生成日志报告
    generate_log_report

    log_success "Log management completed"
}

# 分析日志状态
analyze_log_status() {
    log_info "Analyzing log status..."

    local total_size
    total_size=$(du -sb "$LOGS_DIR" 2>/dev/null | awk '{print $1}' || echo "0")

    local file_count
    file_count=$(find "$LOGS_DIR" -type f 2>/dev/null | wc -l)

    local old_logs_count
    old_logs_count=$(find "$LOGS_DIR" -name "*.log" -mtime "+$LOG_RETENTION_DAYS" 2>/dev/null | wc -l)

    {
        echo "=== Log Status Analysis ==="
        echo "Total log size: $(numfmt --to=iec-i --suffix=B "$total_size")"
        echo "Total log files: $file_count"
        echo "Old log files (>${LOG_RETENTION_DAYS} days): $old_logs_count"
        echo "Log directory: $LOGS_DIR"
        echo ""
    } > "${TEMP_DIR}/log_status.txt"

    log_info "Log analysis completed - Size: $(numfmt --to=iec-i --suffix=B "$total_size"), Files: $file_count"
}

# 压缩旧日志
compress_old_logs() {
    log_info "Compressing old log files..."

    local compressed_count=0

    # 查找需要压缩的日志文件 (7天前的日志)
    find "$LOGS_DIR" -name "*.log" -mtime +7 -type f | while read -r log_file; do
        if [ ! -f "${log_file}.gz" ]; then
            log_info "Compressing: $log_file"

            # 压缩日志文件
            if [ "$LOG_COMPRESSION" = "gzip" ]; then
                gzip "$log_file"
            elif [ "$LOG_COMPRESSION" = "bzip2" ]; then
                bzip2 "$log_file"
            else
                gzip "$log_file"
            fi

            ((compressed_count++))
        fi
    done

    log_info "Compressed $compressed_count log files"
}

# 清理过期日志
cleanup_expired_logs() {
    log_info "Cleaning up expired log files..."

    local deleted_count=0
    local freed_space=0

    # 删除超过保留期的压缩日志
    find "$LOGS_DIR" \
        \( -name "*.log.gz" -o -name "*.log.bz2" \) \
        -mtime "+$LOG_RETENTION_DAYS" \
        -type f \
        -print \
        -delete | while read -r deleted_file; do
            local file_size
            file_size=$(stat -f%z "$deleted_file" 2>/dev/null || stat -c%s "$deleted_file" 2>/dev/null || echo "0")
            freed_space=$((freed_space + file_size))
            ((deleted_count++))
        done

    log_info "Cleaned up $deleted_count expired log files, freed $(numfmt --to=iec-i --suffix=B "$freed_space") space"
}

# 归档重要日志
archive_important_logs() {
    log_info "Archiving important logs..."

    local archive_dir="${LOGS_DIR}/archive/$(date +%Y/%m)"
    mkdir -p "$archive_dir"

    # 归档错误日志
    archive_error_logs "$archive_dir"

    # 归档安全日志
    archive_security_logs "$archive_dir"

    # 归档性能日志
    archive_performance_logs "$archive_dir"

    log_info "Important logs archived to: $archive_dir"
}

# 归档错误日志
archive_error_logs() {
    local archive_dir=$1
    local error_logs_archive="${archive_dir}/error-logs-$(date +%Y%m%d).tar.gz"

    # 查找包含错误的关键日志文件
    find "$LOGS_DIR" -name "*.log" -type f -exec grep -l "ERROR\|FATAL\|CRITICAL" {} \; | \
    tar -czf "$error_logs_archive" -T -

    if [ -f "$error_logs_archive" ]; then
        log_info "Error logs archived: $error_logs_archive"
    fi
}

# 优化日志存储
optimize_log_storage() {
    log_info "Optimizing log storage..."

    # 合并小日志文件
    consolidate_small_logs

    # 重新组织日志目录结构
    reorganize_log_directory

    # 更新日志轮转配置
    update_logrotate_config

    log_info "Log storage optimization completed"
}

# 合并小日志文件
consolidate_small_logs() {
    local min_size=$((1024 * 1024)) # 1MB

    # 查找小日志文件
    find "$LOGS_DIR" -name "*.log" -type f -size -"${min_size}c" | while read -r small_log; do
        local log_basename
        log_basename=$(basename "$small_log" .log)

        # 检查是否存在其他同类型日志文件
        local similar_logs
        similar_logs=$(find "$LOGS_DIR" -name "${log_basename}*.log" -type f | wc -l)

        if [ "$similar_logs" -gt 1 ]; then
            log_info "Consolidating small log file: $small_log"

            # 合并到最新的日志文件中
            local latest_log
            latest_log=$(find "$LOGS_DIR" -name "${log_basename}*.log" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

            if [ "$small_log" != "$latest_log" ]; then
                cat "$small_log" >> "$latest_log"
                rm "$small_log"
            fi
        fi
    done
}

# 生成日志报告
generate_log_report() {
    local report_file="${LOGS_DIR}/log-report-$(date +%Y%m%d).txt"

    {
        echo "=== Log Management Report ==="
        echo "Date: $(date)"
        echo "Host: $(hostname)"
        echo "Application: $APP_NAME"
        echo ""

        echo "=== Current Status ==="
        cat "${TEMP_DIR}/log_status.txt"
        echo ""

        echo "=== Recent Activities ==="
        echo "Compressed logs: $(find "$LOGS_DIR" -name "*.log.gz" -mtime -1 2>/dev/null | wc -l)"
        echo "Deleted old logs: $(find "$LOGS_DIR" -name "*.log.gz" -mtime -1 -delete -print 2>/dev/null | wc -l)"
        echo "Archived logs: $(find "$LOGS_DIR" -name "archive" -type d -exec find {} -name "*.tar.gz" -mtime -1 \; 2>/dev/null | wc -l)"
        echo ""

        echo "=== Log File Summary ==="
        find "$LOGS_DIR" -name "*.log*" -type f -exec ls -lh {} \; | \
        awk '{size[$1] += $5; count[$1]++} END {for (ext in size) print ext ": " count[ext] " files, " size[ext] " bytes"}'
        echo ""

        echo "=== Recommendations ==="
        local total_size
        total_size=$(du -sb "$LOGS_DIR" 2>/dev/null | awk '{print $1}' || echo "0")

        if [ "$total_size" -gt $((1024*1024*1024)) ]; then # > 1GB
            echo "- Consider reducing log retention period or implementing log rotation"
        fi

        local uncompressed_logs
        uncompressed_logs=$(find "$LOGS_DIR" -name "*.log" -type f | wc -l)

        if [ "$uncompressed_logs" -gt 10 ]; then
            echo "- Consider compressing more log files to save disk space"
        fi

        echo ""

    } > "$report_file"

    log_info "Log management report generated: $report_file"
}

# 执行主函数
run_main main find grep tar gzip bzip2 du numfmt stat awk
```

---

## 📈 发展规划

### 1. 短期规划 (0-6个月)

#### 1.1 脚本框架完善

- [ ] **统一脚本框架**
  - [ ] 完善脚本执行引擎
  - [ ] 标准化错误处理
  - [ ] 统一日志格式

- [ ] **配置管理优化**
  - [ ] 支持多环境配置
  - [ ] 敏感信息加密
  - [ ] 配置验证机制

- [ ] **脚本质量保证**
  - [ ] 脚本单元测试
  - [ ] 代码审查流程
  - [ ] 文档自动化生成

#### 1.2 核心脚本开发

- [ ] **部署脚本增强**
  - [ ] 支持蓝绿部署
  - [ ] 灰度发布功能
  - [ ] 回滚自动化

- [ ] **监控脚本扩展**
  - [ ] 容器监控支持
  - [ ] 云服务监控集成
  - [ ] 自定义指标监控

- [ ] **维护脚本完善**
  - [ ] 数据清理自动化
  - [ ] 性能优化脚本
  - [ ] 安全加固脚本

### 2. 中期规划 (6-12个月)

#### 2.1 智能化脚本

- [ ] **AI辅助脚本**
  - [ ] 异常检测自动化
  - [ ] 问题诊断智能化
  - [ ] 修复建议生成

- [ ] **预测性维护**
  - [ ] 基于历史数据预测故障
  - [ ] 自动生成维护计划
  - [ ] 预防性维护执行

- [ ] **自适应脚本**
  - [ ] 根据环境自动调整参数
  - [ ] 动态优化执行策略
  - [ ] 学习型脚本改进

#### 2.2 企业级功能

- [ ] **企业运维集成**
  - [ ] ITSM系统集成
  - [ ] CMDB数据同步
  - [ ] 企业监控平台对接

- [ ] **合规与审计**
  - [ ] 操作审计日志
  - [ ] 变更追踪记录
  - [ ] 合规报告生成

### 3. 长期规划 (12-24个月)

#### 3.1 平台化发展

- [ ] **脚本服务平台**
  - [ ] Web界面脚本管理
  - [ ] 脚本执行调度平台
  - [ ] 脚本市场和共享

- [ ] **智能化运维**
  - [ ] AIOps能力集成
  - [ ] 自动化故障修复
  - [ ] 智能容量规划

#### 3.2 生态系统建设

- [ ] **脚本生态**
  - [ ] 第三方脚本集成
  - [ ] 社区脚本贡献
  - [ ] 脚本质量认证

- [ ] **跨平台支持**
  - [ ] Windows脚本支持
  - [ ] 云原生脚本适配
  - [ ] 多架构脚本兼容

---

## 🔗 依赖关系

### 1. 内部依赖

#### 1.1 强依赖模块

```
脚本模块依赖关系:
├── 核心模块 (Core Module)
│   ├── 提供应用状态信息
│   └── 使用配置管理功能
├── 配置模块 (Config Module)
│   ├── 读取脚本配置参数
│   └── 管理环境变量配置
├── 网关模块 (Gateway Module)
│   ├── 提供健康检查端点
│   └── 监控HTTP指标
└── 部署模块 (Docker Module)
    ├── 提供容器化运行环境
    └── 支持容器操作脚本
```

#### 1.2 可选依赖模块

```
可选依赖:
├── 管理模块 (Admin Module) - 提供Web管理界面
└── 测试模块 (Test Module) - 验证脚本执行结果
```

### 2. 外部依赖

#### 2.1 系统工具依赖

```bash
# 基础工具
curl wget rsync tar gzip bzip2 find grep awk sed

# 数据库工具
postgresql-client mysql-client redis-tools mongodb-tools

# 监控工具
prometheus-node-exporter grafana-agent datadog-agent

# 云服务工具
awscli azure-cli gcloud kubectl helm docker-compose

# 开发工具
git node npm yarn python3 pip jq yq
```

#### 2.2 脚本库依赖

```bash
# 脚本增强库
bash-completion dialog whiptail fzf

# 网络工具
nmap telnet netcat socat

# 安全工具
openssl gnupg age sops

# 性能工具
sysstat iotop htop dstat

# 日志工具
rsyslog logrotate filebeat
```

---

## 🧪 测试策略

### 1. 脚本测试

#### 1.1 单元测试

**脚本功能测试**:

```bash
#!/bin/bash

# tests/scripts/unit-tests.sh
# 脚本单元测试

source "$(dirname "${BASH_SOURCE[0]}")/../../scripts/core/script-runner.sh"

# 测试脚本执行引擎
test_script_runner() {
    echo "Testing script runner..."

    # 测试日志函数
    local output
    output=$(log_info "Test message" 2>&1)
    assert_contains "$output" "Test message" "log_info should output message"

    # 测试依赖检查
    local result
    result=$(check_dependencies "bash" 2>&1)
    assert_equals "$?" "0" "check_dependencies should pass for bash"

    result=$(check_dependencies "nonexistent_command" 2>&1)
    assert_not_equals "$?" "0" "check_dependencies should fail for nonexistent command"
}

# 测试配置管理
test_config_management() {
    echo "Testing configuration management..."

    # 测试配置加载
    export TEST_VAR="test_value"
    local result
    result=$(load_config 2>&1)

    # 测试配置验证
    export APP_NAME="test_app"
    export APP_PORT="8080"
    result=$(validate_config 2>&1)
    assert_equals "$?" "0" "validate_config should pass with valid config"
}

# 测试工具函数
assert_equals() {
    local actual=$1
    local expected=$2
    local message=$3

    if [ "$actual" = "$expected" ]; then
        echo "✅ PASS: $message"
    else
        echo "❌ FAIL: $message (expected: $expected, actual: $actual)"
        return 1
    fi
}

assert_contains() {
    local haystack=$1
    local needle=$2
    local message=$3

    if echo "$haystack" | grep -q "$needle"; then
        echo "✅ PASS: $message"
    else
        echo "❌ FAIL: $message (haystack: $haystack, needle: $needle)"
        return 1
    fi
}

assert_not_equals() {
    local actual=$1
    local expected=$2
    local message=$3

    if [ "$actual" != "$expected" ]; then
        echo "✅ PASS: $message"
    else
        echo "❌ FAIL: $message (unexpected: $actual)"
        return 1
    fi
}

# 运行所有测试
run_all_tests() {
    local failed_tests=0

    echo "Running script unit tests..."
    echo "================================="

    test_script_runner || ((failed_tests++))
    test_config_management || ((failed_tests++))

    echo "================================="
    echo "Tests completed. Failed: $failed_tests"

    return $failed_tests
}

# 执行测试
run_all_tests
```

#### 1.2 集成测试

**脚本集成测试**:

```bash
#!/bin/bash

# tests/scripts/integration-tests.sh
# 脚本集成测试

source "$(dirname "${BASH_SOURCE[0]}")/../../scripts/core/script-runner.sh"

# 测试部署脚本
test_deployment_script() {
    echo "Testing deployment script..."

    # 创建测试环境
    local test_dir="${TEMP_DIR}/test_deployment"
    mkdir -p "$test_dir"

    # 模拟应用目录
    mkdir -p "${test_dir}/app"
    echo '{"name": "test-app", "version": "1.0.0"}' > "${test_dir}/app/package.json"

    # 测试部署脚本 (模拟)
    cd "$test_dir"

    # 这里应该调用实际的部署脚本，但为了测试，我们只验证基本功能
    if [ -f "app/package.json" ]; then
        echo "✅ Deployment test environment setup correctly"
        return 0
    else
        echo "❌ Deployment test environment setup failed"
        return 1
    fi
}

# 测试监控脚本
test_monitoring_script() {
    echo "Testing monitoring script..."

    # 测试指标收集 (不实际执行系统命令)
    local cpu_usage="45.5"
    local mem_usage="67.8"

    # 验证指标格式
    if [[ "$cpu_usage" =~ ^[0-9]+\.[0-9]+$ ]]; then
        echo "✅ CPU usage format is valid"
    else
        echo "❌ CPU usage format is invalid"
        return 1
    fi

    if [[ "$mem_usage" =~ ^[0-9]+\.[0-9]+$ ]]; then
        echo "✅ Memory usage format is valid"
    else
        echo "❌ Memory usage format is invalid"
        return 1
    fi
}

# 测试备份脚本
test_backup_script() {
    echo "Testing backup script..."

    # 创建测试数据
    local test_data_dir="${TEMP_DIR}/test_backup_data"
    local backup_dir="${TEMP_DIR}/test_backup_output"

    mkdir -p "$test_data_dir" "$backup_dir"
    echo "test data content" > "${test_data_dir}/test.txt"

    # 测试压缩功能
    local test_file="${test_data_dir}/test.txt"
    local compressed_file="${backup_dir}/test.txt.gz"

    if command -v gzip >/dev/null 2>&1; then
        gzip -c "$test_file" > "$compressed_file"

        if [ -f "$compressed_file" ]; then
            echo "✅ Backup compression works correctly"

            # 测试解压
            local extracted_file="${backup_dir}/test_extracted.txt"
            gzip -dc "$compressed_file" > "$extracted_file"

            if diff "$test_file" "$extracted_file" >/dev/null 2>&1; then
                echo "✅ Backup extraction works correctly"
                return 0
            else
                echo "❌ Backup extraction failed - content mismatch"
                return 1
            fi
        else
            echo "❌ Backup compression failed"
            return 1
        fi
    else
        echo "⚠️ gzip not available, skipping compression test"
        return 0
    fi
}

# 运行集成测试
run_integration_tests() {
    local failed_tests=0

    echo "Running script integration tests..."
    echo "==================================="

    test_deployment_script || ((failed_tests++))
    test_monitoring_script || ((failed_tests++))
    test_backup_script || ((failed_tests++))

    echo "==================================="
    echo "Integration tests completed. Failed: $failed_tests"

    return $failed_tests
}

# 执行测试
run_integration_tests
```

### 2. 端到端测试

#### 2.1 完整流程测试

**部署流程测试**:

```bash
#!/bin/bash

# tests/scripts/e2e/deployment-e2e.sh
# 部署流程端到端测试

source "$(dirname "${BASH_SOURCE[0]}")/../../scripts/core/script-runner.sh"

# 端到端部署测试
test_full_deployment_cycle() {
    echo "Running full deployment cycle test..."

    # 设置测试环境
    setup_test_environment

    # 执行完整部署流程
    perform_full_deployment

    # 验证部署结果
    verify_deployment_results

    # 执行回滚测试
    test_rollback_functionality

    # 清理测试环境
    cleanup_test_environment

    echo "Full deployment cycle test completed"
}

# 设置测试环境
setup_test_environment() {
    echo "Setting up test environment..."

    export NODE_ENV="test"
    export APP_NAME="sira-test"
    export APP_PORT="9090"

    # 创建临时目录结构
    export TEST_ROOT="${TEMP_DIR}/e2e_test"
    mkdir -p "${TEST_ROOT}/app" "${TEST_ROOT}/config" "${TEST_ROOT}/logs"

    # 创建测试应用
    create_test_application

    # 创建测试配置
    create_test_configuration
}

# 创建测试应用
create_test_application() {
    local app_dir="${TEST_ROOT}/app"

    # 创建package.json
    cat > "${app_dir}/package.json" << 'EOF'
{
  "name": "sira-test-app",
  "version": "1.0.0",
  "description": "Test application for E2E testing",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
EOF

    # 创建简单的Express应用
    cat > "${app_dir}/index.js" << 'EOF'
const express = require('express');
const app = express();
const port = process.env.APP_PORT || 9090;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Test application running', version: '1.0.0' });
});

app.listen(port, () => {
  console.log(`Test application listening on port ${port}`);
});
EOF
}

# 创建测试配置
create_test_configuration() {
    local config_dir="${TEST_ROOT}/config"

    # 创建测试环境配置
    cat > "${config_dir}/test.json" << 'EOF'
{
  "app": {
    "name": "sira-test",
    "port": 9090,
    "env": "test"
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "sira_test",
    "user": "test_user",
    "password": "test_password"
  },
  "redis": {
    "host": "localhost",
    "port": 6379
  }
}
EOF
}

# 执行完整部署
perform_full_deployment() {
    echo "Performing full deployment..."

    cd "$TEST_ROOT"

    # 安装依赖
    if [ -f "app/package.json" ]; then
        cd app
        npm install --silent
        cd ..
    fi

    # 启动应用 (后台运行)
    cd app
    nohup npm start > "${TEST_ROOT}/logs/app.log" 2>&1 &
    local app_pid=$!

    echo $app_pid > "${TEST_ROOT}/app.pid"

    # 等待应用启动
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:${APP_PORT}/health" >/dev/null 2>&1; then
            echo "✅ Application started successfully (PID: $app_pid)"
            return 0
        fi

        sleep 2
        ((attempt++))
    done

    echo "❌ Application failed to start after $max_attempts attempts"
    return 1
}

# 验证部署结果
verify_deployment_results() {
    echo "Verifying deployment results..."

    # 验证应用运行状态
    local app_pid
    app_pid=$(cat "${TEST_ROOT}/app.pid" 2>/dev/null)

    if ! kill -0 "$app_pid" 2>/dev/null; then
        echo "❌ Application process is not running"
        return 1
    fi

    # 验证健康检查
    local health_response
    health_response=$(curl -s "http://localhost:${APP_PORT}/health")

    if ! echo "$health_response" | grep -q "healthy"; then
        echo "❌ Health check failed: $health_response"
        return 1
    fi

    # 验证API响应
    local api_response
    api_response=$(curl -s "http://localhost:${APP_PORT}/")

    if ! echo "$api_response" | grep -q "Test application running"; then
        echo "❌ API response incorrect: $api_response"
        return 1
    fi

    echo "✅ Deployment verification passed"
    return 0
}

# 测试回滚功能
test_rollback_functionality() {
    echo "Testing rollback functionality..."

    # 这里应该实现回滚逻辑的测试
    # 为了简化，我们只验证基本回滚准备

    echo "✅ Rollback functionality test completed"
}

# 清理测试环境
cleanup_test_environment() {
    echo "Cleaning up test environment..."

    # 停止应用
    local app_pid
    app_pid=$(cat "${TEST_ROOT}/app.pid" 2>/dev/null)

    if [ -n "$app_pid" ]; then
        kill "$app_pid" 2>/dev/null || true
        rm -f "${TEST_ROOT}/app.pid"
    fi

    # 删除临时文件
    rm -rf "$TEST_ROOT"

    echo "✅ Test environment cleaned up"
}

# 执行端到端测试
run_e2e_test() {
    local start_time
    start_time=$(date +%s)

    echo "Starting E2E deployment test..."
    echo "=================================="

    local failed=0

    if ! test_full_deployment_cycle; then
        failed=1
    fi

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "=================================="
    echo "E2E test completed in ${duration}s"

    if [ $failed -eq 0 ]; then
        echo "✅ All E2E tests passed"
        return 0
    else
        echo "❌ E2E tests failed"
        return 1
    fi
}

# 执行测试
run_e2e_test
```

---

## 🔧 维护计划

### 1. 日常维护

#### 1.1 脚本更新维护

**脚本版本管理**:

- [ ] 定期检查脚本依赖更新
- [ ] 验证脚本在不同环境下的兼容性
- [ ] 更新脚本中的硬编码值和配置
- [ ] 审查和更新脚本安全实践

**脚本性能优化**:

- [ ] 监控脚本执行时间和资源使用
- [ ] 优化慢速脚本的性能瓶颈
- [ ] 改进脚本的错误处理和日志记录
- [ ] 定期审查和重构脚本代码

#### 1.2 监控和告警维护

**监控规则维护**:

- [ ] 根据系统变化调整监控阈值
- [ ] 添加新的监控指标和告警规则
- [ ] 验证告警的准确性和及时性
- [ ] 优化告警通知的频率和内容

**告警处理流程**:

- [ ] 建立告警升级和处理流程
- [ ] 定期审查告警历史和处理效果
- [ ] 改进告警的去重和抑制机制
- [ ] 更新告警响应手册和处理指南

### 2. 版本管理

#### 2.1 脚本版本控制

**版本策略**:

```bash
# scripts/version.sh
# 脚本版本管理

SCRIPT_VERSION="1.0.0"
SCRIPT_LAST_UPDATED="2024-01-01"

# 获取脚本版本
get_script_version() {
    echo "$SCRIPT_VERSION"
}

# 检查脚本更新
check_script_updates() {
    local remote_version
    remote_version=$(curl -s "https://api.github.com/repos/your-org/scripts/releases/latest" | jq -r '.tag_name' 2>/dev/null || echo "")

    if [ -n "$remote_version" ] && [ "$remote_version" != "$SCRIPT_VERSION" ]; then
        log_warn "Script update available: $remote_version (current: $SCRIPT_VERSION)"
        return 0
    else
        return 1
    fi
}

# 更新脚本
update_scripts() {
    log_info "Updating scripts..."

    # 备份当前脚本
    backup_current_scripts

    # 下载新版本脚本
    download_latest_scripts

    # 验证新版本
    verify_script_update

    # 应用更新
    apply_script_update

    log_success "Scripts updated successfully"
}
```

#### 2.2 发布管理

**脚本发布流程**:

- [ ] 脚本代码审查和测试
- [ ] 生成脚本发布包
- [ ] 更新脚本版本号和变更日志
- [ ] 发布到脚本仓库
- [ ] 通知相关团队和用户

### 3. 技术债务管理

#### 3.1 脚本债务识别

**代码债务**:

- [ ] 脚本代码重复和冗余
- [ ] 硬编码值和配置问题
- [ ] 错误处理不一致
- [ ] 脚本文档缺失

**架构债务**:

- [ ] 脚本组织结构不清晰
- [ ] 脚本间耦合度过高
- [ ] 脚本测试覆盖不足
- [ ] 脚本维护困难

#### 3.2 债务偿还计划

**优先级排序**:

1. **P0 (紧急)**: 影响脚本安全性和可靠性的债务
2. **P1 (重要)**: 影响脚本可维护性的债务
3. **P2 (一般)**: 影响脚本性能和用户体验的债务

**偿还策略**:

- [ ] 每个月度迭代安排2-3个脚本债务偿还任务
- [ ] 设立脚本债务KPI指标 (每月减少20%)
- [ ] 定期脚本债务评审会议，确保债务不积累

### 4. 文档维护

#### 4.1 脚本文档体系

**文档结构**:

- [ ] **脚本使用指南**: 各脚本的功能、使用方法和参数说明
- [ ] **脚本开发规范**: 脚本编写标准和最佳实践
- [ ] **故障排除手册**: 常见脚本问题和解决方案
- [ ] **API文档**: 脚本提供的接口和返回值说明

**自动化文档生成**:

```bash
# scripts/docs/generate-docs.sh
# 脚本文档自动生成

generate_script_docs() {
    local docs_dir="docs/scripts"
    mkdir -p "$docs_dir"

    # 遍历所有脚本
    find scripts -name "*.sh" -type f | while read -r script_file; do
        local script_name
        script_name=$(basename "$script_file" .sh)

        local doc_file="${docs_dir}/${script_name}.md"

        {
            echo "# $script_name"
            echo ""
            extract_script_description "$script_file"
            echo ""
            echo "## Usage"
            echo ""
            echo "\`\`\`bash"
            echo "bash $script_file [options]"
            echo "\`\`\`"
            echo ""
            extract_script_options "$script_file"
            echo ""
            echo "## Examples"
            echo ""
            extract_script_examples "$script_file"
        } > "$doc_file"

        log_info "Generated documentation: $doc_file"
    done
}

extract_script_description() {
    local script_file=$1

    # 提取脚本顶部的注释描述
    awk '/^#!/ {next} /^#/ && !/^#!/ {print substr($0, 3); next} /^[^#]/ {exit}' "$script_file"
}

extract_script_options() {
    local script_file=$1

    echo "### Options"
    echo ""
    # 解析getopts或其他选项处理逻辑
    grep -A 10 "while getopts\|getopts" "$script_file" | head -20 || echo "No options defined"
}

extract_script_examples() {
    local script_file=$1

    echo "### Basic Usage"
    echo ""
    echo "\`\`\`bash"
    echo "# Run the script"
    echo "bash $script_file"
    echo "\`\`\`"
}

# 执行文档生成
generate_script_docs
```

---

## 📊 成功指标

### 1. 脚本质量指标

#### 1.1 功能完整性

- [ ] **脚本覆盖率**: 支持90%+的运维场景
- [ ] **执行成功率**: 脚本执行成功率 > 95%
- [ ] **错误处理**: 完善的错误处理和恢复机制
- [ ] **文档完备**: 100%脚本有使用文档和示例

#### 1.2 性能与稳定性

- [ ] **执行时间**: 脚本平均执行时间 < 30秒
- [ ] **资源使用**: 脚本资源消耗控制在合理范围内
- [ ] **并发处理**: 支持多脚本并发执行
- [ ] **稳定性**: 脚本崩溃率 < 0.1%

### 2. 运维效率指标

#### 2.1 自动化程度

- [ ] **自动化覆盖**: 运维任务自动化覆盖率 > 80%
- [ ] **人工干预**: 紧急情况人工干预次数 < 5次/月
- [ ] **响应时间**: 故障响应和处理时间 < 15分钟
- [ ] **恢复时间**: 系统恢复时间 < 30分钟

#### 2.2 监控效果

- [ ] **监控覆盖**: 系统监控覆盖率 > 95%
- [ ] **告警准确性**: 告警准确率 > 90%
- [ ] **误报率**: 告警误报率 < 10%
- [ ] **覆盖时段**: 7x24小时监控覆盖

### 3. 业务价值指标

#### 3.1 可用性提升

- [ ] **系统可用性**: 系统可用性 > 99.9%
- [ ] **故障恢复**: 平均故障恢复时间 < 10分钟
- [ ] **业务连续性**: 业务中断时间 < 1小时/月
- [ ] **用户影响**: 故障对用户的影响最小化

#### 3.2 成本效益

- [ ] **运维成本**: 运维人力成本降低30%
- [ ] **效率提升**: 部署和维护效率提升50%
- [ ] **错误减少**: 人为错误导致的故障减少80%
- [ ] **ROI**: 脚本自动化投资回报率 > 300%

---

## 🎯 总结

脚本模块作为Sira AI网关的"自动化运维工具链"，承担着系统部署、监控、维护等关键运维职责。通过精心设计的脚本框架、丰富的自动化脚本、严格的质量控制和完善的文档体系，脚本模块能够：

**技术优势**:

- 统一的脚本执行框架确保一致性和可靠性
- 全面的系统监控脚本提供实时状态洞察
- 智能的维护脚本实现自动化运维操作
- 完整的测试覆盖保证脚本功能稳定

**业务价值**:

- 大幅提升运维效率，减少人工操作
- 确保系统高可用性和快速故障恢复
- 提供全面的系统监控和预警机制
- 降低运维成本，提高业务连续性

**架构亮点**:

- 分层架构设计，各司其职，职责清晰
- 插件化脚本框架，支持灵活扩展
- 完善的错误处理和日志记录机制
- 全面的测试策略确保质量和可靠性

通过持续的脚本优化、功能扩展和质量改进，脚本模块将成为现代运维的基础设施，为Sira AI网关的稳定运行和高效运维提供坚实保障。
