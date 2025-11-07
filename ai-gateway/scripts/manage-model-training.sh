#!/bin/bash

# 模型训练管理脚本
# 借鉴Hugging Face和OpenAI的CLI工具设计理念，提供直观的命令行界面

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config/model-training.json"
DATASETS_DIR="$PROJECT_ROOT/data/datasets"
JOBS_DIR="$PROJECT_ROOT/data/training-jobs"
MODELS_DIR="$PROJECT_ROOT/data/models"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
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

log_header() {
    echo -e "${PURPLE}=== $1 ===${NC}"
}

# 检查依赖
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed. Please install curl."
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. JSON output will be unformatted."
    fi
}

# 获取API基础URL
get_api_url() {
    if [ -n "$GATEWAY_URL" ]; then
        echo "$GATEWAY_URL"
    else
        echo "http://localhost:8080"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
模型训练管理工具 - Sira AI Gateway

USAGE:
    $0 [COMMAND] [SUBCOMMAND] [OPTIONS]

COMMANDS:
    datasets                    数据集管理
    jobs                        训练作业管理
    models                      模型管理
    providers                   查看支持的提供商
    stats                       查看系统统计

DATASETS SUBCOMMANDS:
    list                        列出数据集
    upload <file>               上传数据集
    show <dataset_id>           显示数据集详情
    delete <dataset_id>         删除数据集

JOBS SUBCOMMANDS:
    list                        列出训练作业
    create                      创建训练作业
    show <job_id>               显示作业详情
    start <job_id>              启动训练作业
    stop <job_id>               停止训练作业
    status <job_id>             查看作业状态
    logs <job_id>               查看训练日志

MODELS SUBCOMMANDS:
    list                        列出用户模型
    deploy <job_id>             部署训练完成的模型
    delete <model_id>           删除部署的模型

OPTIONS:
    -h, --help                  显示帮助信息
    -u, --url URL               指定网关URL (默认: http://localhost:8080)
    -v, --verbose               详细输出

EXAMPLES:
    $0 datasets list
    $0 datasets upload data.jsonl --name "My Dataset"
    $0 jobs create --dataset ds_123 --model gpt-3.5-turbo
    $0 jobs start job_456
    $0 jobs status job_456
    $0 models deploy job_456
    $0 providers

EOF
}

# 发送HTTP请求的辅助函数
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local content_type="${4:-application/json}"

    local url="$(get_api_url)$endpoint"
    local curl_opts=(-s -X "$method" -H "Content-Type: $content_type")

    if [ -n "$data" ]; then
        curl_opts+=(-d "$data")
    fi

    if [ "$VERBOSE" = "true" ]; then
        log_info "API Request: $method $url"
        [ -n "$data" ] && log_info "Data: $data"
    fi

    local response
    if ! response=$(curl "${curl_opts[@]}" "$url" 2>/dev/null); then
        log_error "API请求失败: $method $url"
        return 1
    fi

    if [ "$VERBOSE" = "true" ]; then
        log_info "API Response: $response"
    fi

    echo "$response"
}

# 格式化JSON输出
format_json() {
    local json="$1"
    if command -v jq &> /dev/null; then
        echo "$json" | jq '.'
    else
        echo "$json"
    fi
}

# ==================== 数据集管理 ====================

cmd_datasets() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_datasets_list "$@" ;;
        upload) cmd_datasets_upload "$@" ;;
        show) cmd_datasets_show "$@" ;;
        delete) cmd_datasets_delete "$@" ;;
        "") cmd_datasets_list "$@" ;;
        *) log_error "未知的数据集子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_datasets_list() {
    log_header "数据集列表"

    local response
    if ! response=$(api_request "GET" "/model-training/datasets"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local datasets=$(echo "$response" | jq -r '.data[]')

        if [ -z "$datasets" ]; then
            log_info "暂无数据集"
            return 0
        fi

        printf "%-25s %-30s %-8s %-10s %-12s\n" "数据集ID" "名称" "格式" "大小(MB)" "记录数"
        echo "---------------------------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.name)\t\(.format)\t\((.size / 1024 / 1024) | round)\t\(.recordCount)"' | \
        while IFS=$'\t' read -r id name format size_mb records; do
            printf "%-25s %-30s %-8s %-10s %-12s\n" \
                "${id:0:25}" "${name:0:30}" "$format" "$size_mb" "$records"
        done

        local total=$(echo "$response" | jq -r '.pagination.total')
        log_success "共 $total 个数据集"
    else
        log_error "获取数据集列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_datasets_upload() {
    local file_path="$1"
    shift

    if [ -z "$file_path" ]; then
        log_error "请提供文件路径"
        show_help
        return 1
    fi

    if [ ! -f "$file_path" ]; then
        log_error "文件不存在: $file_path"
        return 1
    fi

    local name=""
    local description=""
    local format="jsonl"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --name) name="$2"; shift 2 ;;
            --description) description="$2"; shift 2 ;;
            --format) format="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$name" ]; then
        name=$(basename "$file_path" .jsonl)
        name=$(basename "$name" .json)
        name=$(basename "$name" .csv)
        name=$(basename "$name" .txt)
    fi

    log_header "上传数据集: $file_path"

    # 构建multipart/form-data请求
    local boundary="----FormBoundary7MA4YWxkTrZu0gW"
    local data=""
    data="${data}--${boundary}\r\n"
    data="${data}Content-Disposition: form-data; name=\"file\"; filename=\"$(basename "$file_path")\"\r\n"
    data="${data}Content-Type: application/octet-stream\r\n"
    data="${data}\r\n"
    data="${data}$(cat "$file_path")\r\n"
    data="${data}--${boundary}\r\n"
    data="${data}Content-Disposition: form-data; name=\"name\"\r\n"
    data="${data}\r\n"
    data="${data}$name\r\n"
    data="${data}--${boundary}\r\n"
    data="${data}Content-Disposition: form-data; name=\"description\"\r\n"
    data="${data}\r\n"
    data="${data}$description\r\n"
    data="${data}--${boundary}\r\n"
    data="${data}Content-Disposition: form-data; name=\"format\"\r\n"
    data="${data}\r\n"
    data="${data}$format\r\n"
    data="${data}--${boundary}--\r\n"

    local response
    if ! response=$(api_request "POST" "/model-training/datasets" "$data" "multipart/form-data; boundary=$boundary"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local dataset_id=$(echo "$response" | jq -r '.data.id')
        log_success "数据集上传成功: $dataset_id"
        format_json "$response"
    else
        log_error "上传数据集失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_datasets_show() {
    local dataset_id="$1"

    if [ -z "$dataset_id" ]; then
        log_error "请提供数据集ID"
        return 1
    fi

    log_header "数据集详情: $dataset_id"

    local response
    if ! response=$(api_request "GET" "/model-training/datasets/$dataset_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取数据集详情失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_datasets_delete() {
    local dataset_id="$1"

    if [ -z "$dataset_id" ]; then
        log_error "请提供数据集ID"
        return 1
    fi

    read -p "确定要删除数据集 $dataset_id 吗? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "操作已取消"
        return 0
    fi

    log_info "删除数据集: $dataset_id"

    local response
    if ! response=$(api_request "DELETE" "/model-training/datasets/$dataset_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "数据集删除成功"
    else
        log_error "删除数据集失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 训练作业管理 ====================

cmd_jobs() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_jobs_list "$@" ;;
        create) cmd_jobs_create "$@" ;;
        show) cmd_jobs_show "$@" ;;
        start) cmd_jobs_start "$@" ;;
        stop) cmd_jobs_stop "$@" ;;
        status) cmd_jobs_status "$@" ;;
        logs) cmd_jobs_logs "$@" ;;
        "") cmd_jobs_list "$@" ;;
        *) log_error "未知的作业子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_jobs_list() {
    log_header "训练作业列表"

    local response
    if ! response=$(api_request "GET" "/model-training/jobs"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local jobs=$(echo "$response" | jq -r '.data[]')

        if [ -z "$jobs" ]; then
            log_info "暂无训练作业"
            return 0
        fi

        printf "%-25s %-30s %-10s %-8s %-10s %-12s\n" "作业ID" "名称" "模型" "状态" "进度%" "创建时间"
        echo "-----------------------------------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.name)\t\(.baseModel)\t\(.status)\t\(.progress)\t\(.createdAt[:10])"' | \
        while IFS=$'\t' read -r id name model status progress created; do
            printf "%-25s %-30s %-10s %-8s %-10s %-12s\n" \
                "${id:0:25}" "${name:0:30}" "${model:0:10}" "$status" "$progress" "$created"
        done

        local total=$(echo "$response" | jq -r '.pagination.total')
        log_success "共 $total 个训练作业"
    else
        log_error "获取训练作业列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_jobs_create() {
    local dataset_id=""
    local base_model=""
    local name=""
    local epochs="3"
    local batch_size="16"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --dataset) dataset_id="$2"; shift 2 ;;
            --model) base_model="$2"; shift 2 ;;
            --name) name="$3"; shift 2 ;;
            --epochs) epochs="$2"; shift 2 ;;
            --batch-size) batch_size="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$dataset_id" ] || [ -z "$base_model" ]; then
        log_error "请提供数据集ID (--dataset) 和基础模型 (--model)"
        return 1
    fi

    if [ -z "$name" ]; then
        name="训练作业 - $(date +%Y%m%d_%H%M%S)"
    fi

    log_header "创建训练作业"

    local data=$(cat << EOF
{
    "name": "$name",
    "description": "通过CLI创建的训练作业",
    "datasetId": "$dataset_id",
    "baseModel": "$base_model",
    "config": {
        "epochs": $epochs,
        "batchSize": $batch_size
    }
}
EOF
)

    local response
    if ! response=$(api_request "POST" "/model-training/jobs" "$data"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local job_id=$(echo "$response" | jq -r '.data.id')
        log_success "训练作业创建成功: $job_id"
        format_json "$response"
    else
        log_error "创建训练作业失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_jobs_show() {
    local job_id="$1"

    if [ -z "$job_id" ]; then
        log_error "请提供作业ID"
        return 1
    fi

    log_header "训练作业详情: $job_id"

    local response
    if ! response=$(api_request "GET" "/model-training/jobs/$job_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取训练作业详情失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_jobs_start() {
    local job_id="$1"

    if [ -z "$job_id" ]; then
        log_error "请提供作业ID"
        return 1
    fi

    log_info "启动训练作业: $job_id"

    local response
    if ! response=$(api_request "POST" "/model-training/jobs/$job_id/start"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "训练作业启动成功"
    else
        log_error "启动训练作业失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_jobs_stop() {
    local job_id="$1"

    if [ -z "$job_id" ]; then
        log_error "请提供作业ID"
        return 1
    fi

    log_info "停止训练作业: $job_id"

    local response
    if ! response=$(api_request "POST" "/model-training/jobs/$job_id/stop"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "训练作业停止成功"
    else
        log_error "停止训练作业失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_jobs_status() {
    local job_id="$1"

    if [ -z "$job_id" ]; then
        log_error "请提供作业ID"
        return 1
    fi

    log_header "训练作业状态: $job_id"

    local response
    if ! response=$(api_request "GET" "/model-training/jobs/$job_id/status"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取训练作业状态失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_jobs_logs() {
    local job_id="$1"
    shift

    local limit="50"
    local level=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --limit) limit="$2"; shift 2 ;;
            --level) level="$2"; shift 2 ;;
            *) break ;;
        esac
    done

    if [ -z "$job_id" ]; then
        log_error "请提供作业ID"
        return 1
    fi

    log_header "训练日志: $job_id"

    local query="limit=$limit"
    [ -n "$level" ] && query="${query}&level=$level"

    local response
    if ! response=$(api_request "GET" "/model-training/jobs/$job_id/logs?$query"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        echo "$response" | jq -r '.data.logs[] | "\(.timestamp) [\(.level)] \(.message)"'
    else
        log_error "获取训练日志失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 模型管理 ====================

cmd_models() {
    local subcommand="$1"
    shift

    case $subcommand in
        list) cmd_models_list "$@" ;;
        deploy) cmd_models_deploy "$@" ;;
        delete) cmd_models_delete "$@" ;;
        "") cmd_models_list "$@" ;;
        *) log_error "未知的模型子命令: $subcommand"; show_help; exit 1 ;;
    esac
}

cmd_models_list() {
    log_header "用户模型列表"

    local response
    if ! response=$(api_request "GET" "/model-training/models"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local models=$(echo "$response" | jq -r '.data[]')

        if [ -z "$models" ]; then
            log_info "暂无部署的模型"
            return 0
        fi

        printf "%-25s %-30s %-12s %-8s %-15s\n" "模型ID" "名称" "基础模型" "状态" "部署时间"
        echo "-------------------------------------------------------------------------------------------------------------------"

        echo "$response" | jq -r '.data[] | "\(.id)\t\(.name)\t\(.baseModel)\t\(.status)\t\(.deployedAt[:10])"' | \
        while IFS=$'\t' read -r id name base_model status deployed; do
            printf "%-25s %-30s %-12s %-8s %-15s\n" \
                "${id:0:25}" "${name:0:30}" "${base_model:0:12}" "$status" "$deployed"
        done

        local total=$(echo "$response" | jq -r '.data | length')
        log_success "共 $total 个部署的模型"
    else
        log_error "获取用户模型列表失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_models_deploy() {
    local job_id="$1"

    if [ -z "$job_id" ]; then
        log_error "请提供作业ID"
        return 1
    fi

    log_header "部署训练完成的模型: $job_id"

    local response
    if ! response=$(api_request "POST" "/model-training/jobs/$job_id/deploy" "{}"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        local model_id=$(echo "$response" | jq -r '.data.id')
        log_success "模型部署启动成功: $model_id"
        format_json "$response"
    else
        log_error "部署模型失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_models_delete() {
    local model_id="$1"

    if [ -z "$model_id" ]; then
        log_error "请提供模型ID"
        return 1
    fi

    read -p "确定要删除模型 $model_id 吗? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "操作已取消"
        return 0
    fi

    log_info "删除模型: $model_id"

    local response
    if ! response=$(api_request "DELETE" "/model-training/models/$model_id"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        log_success "模型删除成功"
    else
        log_error "删除模型失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# ==================== 系统信息 ====================

cmd_providers() {
    log_header "支持的训练提供商"

    local response
    if ! response=$(api_request "GET" "/model-training/providers"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        echo "$response" | jq '.data'
    else
        log_error "获取训练提供商失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

cmd_stats() {
    log_header "模型训练系统统计"

    local response
    if ! response=$(api_request "GET" "/model-training/stats"); then
        return 1
    fi

    if [ "$(echo "$response" | jq -r '.success')" = "true" ]; then
        format_json "$response"
    else
        log_error "获取系统统计失败: $(echo "$response" | jq -r '.error')"
        return 1
    fi
}

# 主函数
main() {
    check_dependencies

    local command=""
    local verbose=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help; exit 0 ;;
            -u|--url) GATEWAY_URL="$2"; shift 2 ;;
            -v|--verbose) verbose=true; shift ;;
            *) command="$1"; shift; break ;;
        esac
    done

    export VERBOSE="$verbose"

    case $command in
        datasets) cmd_datasets "$@" ;;
        jobs) cmd_jobs "$@" ;;
        models) cmd_models "$@" ;;
        providers) cmd_providers "$@" ;;
        stats) cmd_stats "$@" ;;
        "") show_help ;;
        *) log_error "未知命令: $command"; show_help; exit 1 ;;
    esac
}

main "$@"
