#!/bin/bash

# Sira Production Deployment Script
# Zero-downtime deployment with blue-green strategy

set -e

echo "🚀 Starting Sira production deployment..."

# Configuration
COMPOSE_FILE="docker/production/docker-compose.yml"
PROJECT_NAME="ai-gateway-prod"
ENV_FILE=".env.production"
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Deployment strategy
DEPLOYMENT_STRATEGY="${DEPLOYMENT_STRATEGY:-rolling}" # rolling, blue-green, canary

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-deployment validation
validate_environment() {
    print_status "Validating production environment..."

    # Check required environment variables
    required_vars=("OPENAI_API_KEY" "GATEWAY_API_KEY" "REDIS_PASSWORD" "DOMAIN")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set"
            exit 1
        fi
    done

    # Validate domain format
    if ! echo "$DOMAIN" | grep -qE '^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'; then
        print_warning "Domain $DOMAIN does not appear to be valid"
    fi

    # Check Docker and Docker Compose
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running"
        exit 1
    fi

    print_status "Environment validation passed"
}

# Create backup
create_backup() {
    print_status "Creating backup..."

    mkdir -p "$BACKUP_DIR"

    # Backup configuration
    cp -r config "$BACKUP_DIR/"
    cp .env.production "$BACKUP_DIR/" 2>/dev/null || true

    # Backup database (if using PostgreSQL)
    if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps postgres | grep -q "Up"; then
        print_status "Backing up PostgreSQL database..."
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres \
            pg_dump -U "$POSTGRES_USER" ai_gateway_prod > "$BACKUP_DIR/database.sql"
    fi

    print_status "Backup created in $BACKUP_DIR"
}

# Rolling deployment
rolling_deployment() {
    print_status "Starting rolling deployment..."

    # Update services one by one
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --no-deps ai-gateway

    # Wait for health checks
    print_status "Waiting for services to be healthy..."
    local max_wait=600
    local wait_time=0

    while [ $wait_time -lt $max_wait ]; do
        local healthy_count=$(docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps ai-gateway | grep -c "healthy" || true)

        if [ "$healthy_count" -ge 3 ]; then
            print_status "All instances are healthy"
            break
        fi

        sleep 10
        wait_time=$((wait_time + 10))
        print_status "Waiting... (${wait_time}s/${max_wait}s) - $healthy_count/3 healthy"
    done

    if [ $wait_time -ge $max_wait ]; then
        print_error "Rolling deployment failed - services did not become healthy"
        rollback_deployment
        exit 1
    fi

    print_status "Rolling deployment completed successfully"
}

# Blue-green deployment
blue_green_deployment() {
    print_status "Starting blue-green deployment..."

    # Create green environment
    local green_project="${PROJECT_NAME}-green"

    # Deploy to green environment
    EG_HTTP_PORT=8081 docker-compose -f "$COMPOSE_FILE" -p "$green_project" up -d

    # Wait for green environment to be ready
    print_status "Waiting for green environment to be ready..."
    sleep 30

    # Test green environment
    if curl -f -s "http://localhost:8081/health" > /dev/null; then
        print_status "Green environment is healthy"

        # Switch traffic to green (update load balancer)
        switch_traffic_to_green

        # Keep blue environment running for rollback capability
        print_status "Blue environment kept running for rollback capability"

    else
        print_error "Green environment failed health check"
        docker-compose -f "$COMPOSE_FILE" -p "$green_project" down
        exit 1
    fi
}

# Switch traffic to green environment
switch_traffic_to_green() {
    print_status "Switching traffic to green environment..."

    # This would typically involve updating load balancer configuration
    # For now, we'll simulate this
    print_warning "Traffic switching simulation - update load balancer in production"
}

# Rollback deployment
rollback_deployment() {
    print_warning "Initiating rollback..."

    # Stop the failed deployment
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down

    # Restore from backup if available
    if [ -d "$BACKUP_DIR" ]; then
        print_status "Restoring from backup..."
        cp -r "$BACKUP_DIR/config" ./
        # Restore database if needed
    fi

    # Restart previous version
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d

    print_warning "Rollback completed"
}

# Post-deployment tests
run_post_deployment_tests() {
    print_status "Running post-deployment tests..."

    # Basic connectivity test
    if ! curl -f -s "http://localhost:${EG_HTTP_PORT:-8080}/health" > /dev/null; then
        print_error "Health check failed"
        return 1
    fi

    # API functionality test
    local test_response=$(curl -s \
        -X POST \
        -H "Content-Type: application/json" \
        -H "x-api-key: $GATEWAY_API_KEY" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}' \
        --max-time 30 \
        "http://localhost:${EG_HTTP_PORT:-8080}/api/v1/ai/chat/completions")

    if echo "$test_response" | grep -q '"choices"'; then
        print_status "API functionality test passed"
    else
        print_error "API functionality test failed"
        return 1
    fi

    # Load test
    print_status "Running light load test..."
    for i in {1..5}; do
        curl -s \
            -X POST \
            -H "Content-Type: application/json" \
            -H "x-api-key: $GATEWAY_API_KEY" \
            -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Test '$i'"}]}' \
            --max-time 10 \
            "http://localhost:${EG_HTTP_PORT:-8080}/api/v1/ai/chat/completions" > /dev/null &
    done

    wait
    print_status "Load test completed"

    return 0
}

# Monitor deployment
monitor_deployment() {
    print_status "Monitoring deployment for 5 minutes..."

    local start_time=$(date +%s)
    local errors=0

    while [ $(($(date +%s) - start_time)) -lt 300 ]; do
        # Check error rate
        local error_rate=$(curl -s "http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])/rate(http_requests_total[5m])" | jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")

        if (( $(echo "$error_rate > 0.1" | bc -l 2>/dev/null || echo "0") )); then
            ((errors++))
            print_warning "High error rate detected: ${error_rate}"
        fi

        # Check response time
        local p95_response_time=$(curl -s "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))" | jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0")

        if (( $(echo "$p95_response_time > 10" | bc -l 2>/dev/null || echo "0") )); then
            print_warning "High response time detected: ${p95_response_time}s"
        fi

        sleep 30
    done

    if [ $errors -gt 0 ]; then
        print_warning "Deployment monitoring detected $errors issues"
        print_warning "Consider rollback if issues persist"
    else
        print_status "Deployment monitoring completed successfully"
    fi
}

# Main deployment
main() {
    echo "🔧 Deployment Strategy: $DEPLOYMENT_STRATEGY"
    echo "🌐 Domain: ${DOMAIN:-ai-gateway.company.com}"
    echo "📊 Project: $PROJECT_NAME"
    echo

    # Validate environment
    validate_environment

    # Create backup
    create_backup

    # Execute deployment based on strategy
    case $DEPLOYMENT_STRATEGY in
        "rolling")
            rolling_deployment
            ;;
        "blue-green")
            blue_green_deployment
            ;;
        "canary")
            print_error "Canary deployment not implemented yet"
            exit 1
            ;;
        *)
            print_error "Unknown deployment strategy: $DEPLOYMENT_STRATEGY"
            exit 1
            ;;
    esac

    # Post-deployment tests
    if run_post_deployment_tests; then
        print_status "✅ Post-deployment tests passed"
    else
        print_error "❌ Post-deployment tests failed"
        print_warning "Consider rollback"
        exit 1
    fi

    # Monitor deployment
    monitor_deployment

    print_status "🎉 Production deployment completed successfully!"
    print_status ""
    print_status "Service URLs:"
    print_status "  - Sira: https://${DOMAIN:-ai-gateway.company.com}"
    print_status "  - Admin API: https://${DOMAIN:-ai-gateway.company.com}:9876"
    print_status "  - Grafana: https://grafana.${DOMAIN:-company.com}"
    print_status "  - Prometheus: https://prometheus.${DOMAIN:-company.com}"
    print_status ""
    print_status "Useful commands:"
    print_status "  - View logs: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f ai-gateway"
    print_status "  - Scale: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d --scale ai-gateway=5"
    print_status "  - Rollback: ./scripts/rollback-production.sh"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Sira Production Deployment Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --strategy STRATEGY    Deployment strategy (rolling, blue-green, canary)"
        echo "  --domain DOMAIN        Production domain"
        echo "  --help, -h            Show this help"
        echo ""
        echo "Environment Variables:"
        echo "  DEPLOYMENT_STRATEGY    Deployment strategy (default: rolling)"
        echo "  DOMAIN                 Production domain"
        echo "  EG_HTTP_PORT          Gateway port (default: 8080)"
        echo "  OPENAI_API_KEY        OpenAI API key"
        echo "  GATEWAY_API_KEY       Gateway API key"
        echo "  REDIS_PASSWORD        Redis password"
        exit 0
        ;;
    --strategy)
        DEPLOYMENT_STRATEGY="$2"
        shift 2
        ;;
    --domain)
        DOMAIN="$2"
        shift 2
        ;;
esac

main "$@"
