#!/bin/bash

# 文件路径: scripts/failure-config-manager.sh
# 职责: 快速失败机制配置管理工具

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

CONFIG_FILE="config/failure-strategies.json"
BACKUP_DIR="config/backups"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] [$level] $message"
}

# 显示帮助信息
show_help() {
    echo -e "${BLUE}快速失败配置管理工具${NC}"
    echo "=========================="
    echo ""
    echo "用法:"
    echo "  $0 <命令> [参数...]"
    echo ""
    echo "可用命令:"
    echo "  list                 显示所有失败策略"
    echo "  get <阶段>          获取指定阶段的配置"
    echo "  set <阶段> <属性> <值>  设置阶段配置"
    echo "  enable <阶段>       启用阶段的快速失败"
    echo "  disable <阶段>      禁用阶段的快速失败"
    echo "  backup              创建配置备份"
    echo "  restore <文件>      从备份恢复配置"
    echo "  validate            验证配置文件的有效性"
    echo "  export <格式>       导出配置 (json|yaml|table)"
    echo "  monitor             显示失败统计信息"
    echo "  reset               重置为默认配置"
    echo ""
    echo "示例:"
    echo "  $0 list"
    echo "  $0 get unit_tests"
    echo "  $0 set unit_tests allow_retry true"
    echo "  $0 enable integration_tests"
    echo "  $0 backup"
    echo "  $0 export table"
}

# 验证配置文件
validate_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log "ERROR" "配置文件不存在: $CONFIG_FILE"
        return 1
    fi

    # 检查JSON格式
    if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
        log "ERROR" "配置文件JSON格式无效"
        return 1
    fi

    log "SUCCESS" "配置文件验证通过"
    return 0
}

# 列出所有失败策略
list_strategies() {
    echo -e "${BLUE}工业化测试失败策略配置${NC}"
    echo "=========================="
    echo ""

    # 全局设置
    echo -e "${YELLOW}全局设置:${NC}"
    jq -r '.global_settings | to_entries[] | "  \(.key): \(.value)"' "$CONFIG_FILE"
    echo ""

    # 阶段策略
    echo -e "${YELLOW}阶段失败策略:${NC}"
    printf "%-20s %-15s %-10s %-10s\n" "阶段" "失败策略" "允许重试" "关键程度"
    printf "%-20s %-15s %-10s %-10s\n" "--------------------" "---------------" "----------" "----------"

    jq -r '.failure_strategies | to_entries[] | "\(.key)"' "$CONFIG_FILE" | while read -r stage; do
        local policy=$(jq -r ".failure_strategies.\"$stage\".failure_policy" "$CONFIG_FILE")
        local retry=$(jq -r ".failure_strategies.\"$stage\".allow_retry" "$CONFIG_FILE")
        local impact=$(jq -r ".failure_strategies.\"$stage\".critical_impact" "$CONFIG_FILE")

        printf "%-20s %-15s %-10s %-10s\n" "$stage" "$policy" "$retry" "$impact"
    done
}

# 获取阶段配置
get_stage_config() {
    local stage="$1"

    if ! jq -e ".failure_strategies.\"$stage\"" "$CONFIG_FILE" >/dev/null 2>&1; then
        log "ERROR" "阶段不存在: $stage"
        echo "可用阶段:"
        jq -r '.failure_strategies | keys[]' "$CONFIG_FILE"
        return 1
    fi

    echo -e "${BLUE}阶段配置: $stage${NC}"
    echo "=================="
    jq ".failure_strategies.\"$stage\"" "$CONFIG_FILE"
}

# 设置阶段配置
set_stage_config() {
    local stage="$1"
    local property="$2"
    local value="$3"

    # 创建备份
    backup_config

    # 验证阶段存在
    if ! jq -e ".failure_strategies.\"$stage\"" "$CONFIG_FILE" >/dev/null 2>&1; then
        log "ERROR" "阶段不存在: $stage"
        return 1
    fi

    # 更新配置
    if [[ "$value" == "true" ]] || [[ "$value" == "false" ]]; then
        # 布尔值
        jq ".failure_strategies.\"$stage\".\"$property\" = $value" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
    elif [[ "$value" =~ ^[0-9]+$ ]]; then
        # 数字
        jq ".failure_strategies.\"$stage\".\"$property\" = $value" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
    else
        # 字符串
        jq ".failure_strategies.\"$stage\".\"$property\" = \"$value\"" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
    fi

    mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

    log "SUCCESS" "已更新 $stage.$property = $value"
}

# 启用/禁用阶段快速失败
enable_stage() {
    local stage="$1"
    set_stage_config "$stage" "failure_policy" "immediate_stop"
    log "SUCCESS" "已启用 $stage 的快速失败"
}

disable_stage() {
    local stage="$1"
    set_stage_config "$stage" "failure_policy" "continue_with_warnings"
    log "SUCCESS" "已禁用 $stage 的快速失败"
}

# 创建配置备份
backup_config() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/failure-strategies-$timestamp.json"

    cp "$CONFIG_FILE" "$backup_file"
    log "INFO" "配置备份已创建: $backup_file"
}

# 从备份恢复配置
restore_config() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        log "ERROR" "备份文件不存在: $backup_file"
        return 1
    fi

    cp "$backup_file" "$CONFIG_FILE"
    log "SUCCESS" "配置已从备份恢复: $backup_file"
}

# 导出配置
export_config() {
    local format="$1"

    case "$format" in
        "json")
            cat "$CONFIG_FILE"
            ;;
        "yaml")
            # 需要安装yq或其他JSON到YAML转换工具
            if command -v yq >/dev/null 2>&1; then
                yq -P "$CONFIG_FILE"
            else
                log "ERROR" "需要安装 yq 来导出 YAML 格式"
                return 1
            fi
            ;;
        "table")
            echo "工业化测试失败策略配置导出"
            echo "=========================="
            echo ""
            list_strategies
            ;;
        *)
            log "ERROR" "不支持的导出格式: $format (支持: json, yaml, table)"
            return 1
            ;;
    esac
}

# 显示失败统计信息
show_monitoring() {
    echo -e "${BLUE}失败统计监控${NC}"
    echo "=============="

    # 检查日志目录
    local log_dir="industrial-test-results"
    if [ ! -d "$log_dir" ]; then
        echo "暂无测试执行记录"
        return 0
    fi

    echo "最近的测试执行:"
    find "$log_dir" -name "industrial-test-*.log" -type f -printf "%T@ %p\n" 2>/dev/null | sort -nr | head -5 | while read -r timestamp file; do
        local time_str=$(date -d "@$timestamp" '+%Y-%m-%d %H:%M:%S')
        local filename=$(basename "$file")
        echo "  $time_str - $filename"
    done

    echo ""
    echo "失败模式统计:"

    # 统计常见的失败模式
    local total_runs=$(find "$log_dir" -name "industrial-test-*.log" -type f | wc -l)
    local build_failures=$(grep -r "build.*failed" "$log_dir" 2>/dev/null | wc -l || echo 0)
    local test_failures=$(grep -r "test.*failed" "$log_dir" 2>/dev/null | wc -l || echo 0)
    local lint_failures=$(grep -r "lint.*failed" "$log_dir" 2>/dev/null | wc -l || echo 0)

    echo "  总执行次数: $total_runs"
    echo "  构建失败: $build_failures"
    echo "  测试失败: $test_failures"
    echo "  代码检查失败: $lint_failures"

    if [ "$total_runs" -gt 0 ]; then
        local failure_rate=$(( (build_failures + test_failures + lint_failures) * 100 / total_runs ))
        echo "  总体失败率: ${failure_rate}%"
    fi
}

# 重置为默认配置
reset_config() {
    echo -e "${RED}警告: 此操作将重置所有配置为默认值${NC}"
    read -p "确认要继续吗? (y/N): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "INFO" "操作已取消"
        return 0
    fi

    # 创建备份
    backup_config

    # 这里应该有默认配置的模板
    log "WARNING" "重置功能尚未实现，请手动恢复备份"
}

# 主函数
main() {
    local command="${1:-help}"

    case "$command" in
        "list")
            validate_config && list_strategies
            ;;
        "get")
            if [ $# -lt 2 ]; then
                log "ERROR" "用法: $0 get <阶段>"
                exit 1
            fi
            validate_config && get_stage_config "$2"
            ;;
        "set")
            if [ $# -lt 4 ]; then
                log "ERROR" "用法: $0 set <阶段> <属性> <值>"
                exit 1
            fi
            validate_config && set_stage_config "$2" "$3" "$4"
            ;;
        "enable")
            if [ $# -lt 2 ]; then
                log "ERROR" "用法: $0 enable <阶段>"
                exit 1
            fi
            validate_config && enable_stage "$2"
            ;;
        "disable")
            if [ $# -lt 2 ]; then
                log "ERROR" "用法: $0 disable <阶段>"
                exit 1
            fi
            validate_config && disable_stage "$2"
            ;;
        "backup")
            validate_config && backup_config
            ;;
        "restore")
            if [ $# -lt 2 ]; then
                log "ERROR" "用法: $0 restore <备份文件>"
                exit 1
            fi
            restore_config "$2"
            ;;
        "validate")
            validate_config
            ;;
        "export")
            local format="${2:-table}"
            validate_config && export_config "$format"
            ;;
        "monitor")
            show_monitoring
            ;;
        "reset")
            reset_config
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log "ERROR" "未知命令: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 检查jq是否安装
if ! command -v jq >/dev/null 2>&1; then
    log "ERROR" "需要安装 jq 工具来处理JSON配置"
    echo "安装方法:"
    echo "  Ubuntu/Debian: sudo apt-get install jq"
    echo "  macOS: brew install jq"
    echo "  CentOS/RHEL: sudo yum install jq"
    exit 1
fi

# 执行主函数
main "$@"
