#!/bin/bash

# API Gateway V2 Deployment Script
# Usage: ./scripts/deploy.sh [environment] [action]
# Example: ./scripts/deploy.sh production deploy
# Example: ./scripts/deploy.sh staging rollback

set -e

ENVIRONMENT=${1:-development}
ACTION=${2:-deploy}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check if kubectl is available for Kubernetes deployment
    if [ "$DEPLOY_TARGET" = "kubernetes" ]; then
        if ! command -v kubectl &> /dev/null; then
            log_error "kubectl is not installed. Please install kubectl for Kubernetes deployment."
            exit 1
        fi
    fi

    log_success "Prerequisites check passed"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment: $ENVIRONMENT"

    # Create environment-specific .env file if it doesn't exist
    if [ ! -f ".env.$ENVIRONMENT" ]; then
        log_warning ".env.$ENVIRONMENT not found, copying from template"
        cp env.template .env.$ENVIRONMENT
        log_error "Please edit .env.$ENVIRONMENT with your actual configuration values"
        exit 1
    fi

    # Copy environment file
    cp .env.$ENVIRONMENT .env

    # Set environment variables
    export $(grep -v '^#' .env | xargs)

    log_success "Environment setup completed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."

    local tag="api-gateway-v2:$ENVIRONMENT-$(date +%Y%m%d-%H%M%S)"
    export IMAGE_TAG=$tag

    docker build -t $tag -t api-gateway-v2:latest .

    # Tag for registry if specified
    if [ ! -z "$REGISTRY_URL" ]; then
        docker tag $tag $REGISTRY_URL/api-gateway-v2:$ENVIRONMENT
        docker tag api-gateway-v2:latest $REGISTRY_URL/api-gateway-v2:latest
    fi

    log_success "Docker image built: $tag"
}

# Deploy to Docker Compose
deploy_docker_compose() {
    log_info "Deploying to Docker Compose..."

    # Create external networks if they don't exist
    docker network create api-gateway-network 2>/dev/null || true

    # Start services
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f docker-compose.yml up -d
    else
        docker-compose -f docker-compose.yml --profile monitoring up -d
    fi

    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30

    # Check health
    if curl -f http://localhost:$PORT/health &>/dev/null; then
        log_success "API Gateway is healthy"
    else
        log_error "API Gateway health check failed"
        exit 1
    fi

    log_success "Docker Compose deployment completed"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."

    # Replace image tag in deployment
    sed -i.bak "s|image: api-gateway-v2:latest|image: $IMAGE_TAG|g" k8s/deployment.yml

    # Apply Kubernetes manifests
    kubectl apply -f k8s/

    # Wait for rollout to complete
    kubectl rollout status deployment/api-gateway-v2 --timeout=300s

    # Check if pods are running
    local ready_pods=$(kubectl get pods -l app=api-gateway-v2 -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | grep -o "True" | wc -l)
    local total_pods=$(kubectl get pods -l app=api-gateway-v2 --no-headers | wc -l)

    if [ "$ready_pods" -eq "$total_pods" ]; then
        log_success "Kubernetes deployment completed. $ready_pods/$total_pods pods ready"
    else
        log_error "Kubernetes deployment failed. Only $ready_pods/$total_pods pods ready"
        kubectl get pods -l app=api-gateway-v2
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    if [ "$DEPLOY_TARGET" = "kubernetes" ]; then
        # Run migration job in Kubernetes
        kubectl apply -f k8s/migration-job.yml
        kubectl wait --for=condition=complete job/migration-job --timeout=300s
        kubectl delete job migration-job
    else
        # Run migration locally
        npm run db:migrate
    fi

    log_success "Database migrations completed"
}

# Run tests
run_tests() {
    log_info "Running tests..."

    if [ "$ENVIRONMENT" = "production" ]; then
        log_warning "Skipping tests in production environment"
        return
    fi

    # Run unit tests
    npm test

    # Run integration tests if enabled
    if [ "$RUN_INTEGRATION_TESTS" = "true" ]; then
        log_info "Running integration tests..."
        npm run test:integration
    fi

    # Run performance tests if enabled
    if [ "$RUN_PERFORMANCE_TESTS" = "true" ]; then
        log_info "Running performance tests..."
        npm run test:performance
    fi

    log_success "Tests completed"
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."

    if [ "$DEPLOY_TARGET" = "kubernetes" ]; then
        # Rollback Kubernetes deployment
        kubectl rollout undo deployment/api-gateway-v2
        kubectl rollout status deployment/api-gateway-v2 --timeout=300s
    else
        # Rollback Docker Compose deployment
        docker-compose restart api-gateway-v2
    fi

    log_success "Rollback completed"
}

# Cleanup old resources
cleanup_resources() {
    log_info "Cleaning up old resources..."

    # Remove old Docker images
    docker image prune -f

    # Remove old Kubernetes resources if specified
    if [ "$DEPLOY_TARGET" = "kubernetes" ] && [ "$CLEANUP_OLD_RESOURCES" = "true" ]; then
        kubectl delete pods --field-selector=status.phase=Succeeded
    fi

    log_success "Cleanup completed"
}

# Send deployment notification
send_notification() {
    local status=$1
    local message=$2

    if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"API Gateway V2 Deployment $status: $message\"}" \
            $SLACK_WEBHOOK_URL
    fi

    if [ ! -z "$DISCORD_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"content\":\"API Gateway V2 Deployment $status: $message\"}" \
            $DISCORD_WEBHOOK_URL
    fi
}

# Main deployment function
main() {
    log_info "Starting API Gateway V2 deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Action: $ACTION"

    # Determine deployment target
    DEPLOY_TARGET=${DEPLOY_TARGET:-docker-compose}

    case $ACTION in
        deploy)
            check_prerequisites
            setup_environment

            case $DEPLOY_TARGET in
                docker-compose)
                    build_image
                    run_migrations
                    run_tests
                    deploy_docker_compose
                    ;;
                kubernetes)
                    build_image
                    deploy_kubernetes
                    run_migrations
                    ;;
                *)
                    log_error "Unknown deployment target: $DEPLOY_TARGET"
                    exit 1
                    ;;
            esac

            cleanup_resources
            send_notification "SUCCESS" "Deployment to $ENVIRONMENT completed successfully"
            log_success "🎉 Deployment completed successfully!"
            ;;

        rollback)
            rollback_deployment
            send_notification "ROLLBACK" "Rollback in $ENVIRONMENT completed"
            log_success "Rollback completed"
            ;;

        build)
            check_prerequisites
            setup_environment
            build_image
            log_success "Build completed"
            ;;

        test)
            setup_environment
            run_tests
            log_success "Tests completed"
            ;;

        cleanup)
            cleanup_resources
            log_success "Cleanup completed"
            ;;

        *)
            log_error "Unknown action: $ACTION"
            echo "Usage: $0 [environment] [action]"
            echo "Actions: deploy, rollback, build, test, cleanup"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
