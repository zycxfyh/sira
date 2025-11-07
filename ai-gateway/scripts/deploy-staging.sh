#!/bin/bash

# Sira Staging Deployment Script
# This script deploys the Sira to the staging environment

set -e

echo "🚀 Starting Sira staging deployment..."

# Configuration
COMPOSE_FILE="docker/staging/docker-compose.yml"
PROJECT_NAME="ai-gateway-staging"
ENV_FILE=".env.staging"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env.staging file exists
if [ ! -f "$ENV_FILE" ]; then
    print_warning "Environment file $ENV_FILE not found. Creating from template..."
    if [ -f "env.template" ]; then
        cp env.template .env.staging
        print_warning "Please edit .env.staging with your staging configuration before proceeding."
        exit 1
    else
        print_error "env.template not found. Cannot create staging environment."
        exit 1
    fi
fi

# Load environment variables
set -a
source $ENV_FILE
set +a

print_status "Environment variables loaded from $ENV_FILE"

# Pre-deployment checks
print_status "Running pre-deployment checks..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available."
    exit 1
fi

# Stop existing containers
print_status "Stopping existing staging containers..."
docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down || true

# Remove old images (optional, for clean deployment)
print_status "Cleaning up old images..."
docker image prune -f || true

# Build and start services
print_status "Building and starting staging services..."
docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d --build

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
MAX_WAIT=300
WAIT_TIME=0

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    # Check Sira health
    if curl -f -s http://localhost:${EG_HTTP_PORT:-8080}/health > /dev/null 2>&1; then
        print_status "Sira is healthy!"
        break
    fi

    sleep 10
    WAIT_TIME=$((WAIT_TIME + 10))
    print_status "Waiting... (${WAIT_TIME}s/${MAX_WAIT}s)"
done

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    print_error "Services failed to become healthy within ${MAX_WAIT} seconds."
    print_error "Checking service logs..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs ai-gateway
    exit 1
fi

# Run smoke tests
print_status "Running smoke tests..."
if [ -f "test-ai-gateway.js" ]; then
    # Set test environment variables
    export GATEWAY_URL="http://localhost:${EG_HTTP_PORT:-8080}"
    export API_KEY="${GATEWAY_API_KEY:-test-api-key-123}"

    node test-ai-gateway.js
    if [ $? -eq 0 ]; then
        print_status "Smoke tests passed!"
    else
        print_warning "Smoke tests failed. Please check the application logs."
    fi
else
    print_warning "Smoke test script not found. Skipping smoke tests."
fi

# Start monitoring stack (optional)
read -p "Do you want to start the monitoring stack? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting monitoring stack..."
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME --profile monitoring up -d
    print_status "Monitoring stack started."
    print_status "  - Grafana: http://localhost:3001 (admin/admin123)"
    print_status "  - Prometheus: http://localhost:9090"
    print_status "  - AlertManager: http://localhost:9093"
fi

print_status "🎉 Staging deployment completed successfully!"
print_status ""
print_status "Service URLs:"
print_status "  - Sira: http://localhost:${EG_HTTP_PORT:-8080}"
print_status "  - Admin API: http://localhost:${EG_ADMIN_PORT:-9876}"
print_status ""
print_status "Useful commands:"
print_status "  - View logs: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f"
print_status "  - Stop services: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down"
print_status "  - Restart services: docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME restart"
