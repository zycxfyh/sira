#!/bin/bash

# API Gateway V2 Development Environment Setup Script
# This script sets up a complete development environment with all necessary services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

log_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        log_info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        log_info "Visit: https://nodejs.org/"
        exit 1
    fi

    # Check Node.js version
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed."
        exit 1
    fi

    log_success "All prerequisites met!"
}

# Setup environment
setup_environment() {
    log_header "Setting up Development Environment"

    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log_info "Creating .env file from template..."
        cp env.template .env

        # Add development-specific settings
        cat >> .env << EOF

# Development overrides
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://dev:devpassword@mongodb:27017/api-gateway-dev
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=devpassword

# Development API keys (replace with your actual test keys)
OPENAI_API_KEY=sk-test-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-test-your-anthropic-key-here
AZURE_OPENAI_API_KEY=your-test-azure-key-here

# JWT Secret for development
JWT_SECRET=dev-jwt-secret-key-change-in-production-32-chars-minimum

# Development quotas
DEFAULT_REQUESTS_PER_HOUR=10000
DEFAULT_REQUESTS_PER_DAY=100000
DEFAULT_TOKENS_PER_MONTH=10000000
DEFAULT_COST_LIMIT_PER_MONTH=1000.0
EOF

        log_warning ".env file created. Please update with your actual API keys!"
    else
        log_info ".env file already exists"
    fi

    # Install dependencies
    log_info "Installing Node.js dependencies..."
    npm install

    log_success "Environment setup completed!"
}

# Start development services
start_services() {
    log_header "Starting Development Services"

    # Create external networks if they don't exist
    docker network create api-gateway-dev 2>/dev/null || true

    # Start services
    log_info "Starting MongoDB, Redis, and API Gateway..."
    docker-compose -f docker-compose.dev.yml up -d

    # Wait for services to be healthy
    log_info "Waiting for services to start up..."
    sleep 10

    # Check service health
    check_service_health

    log_success "All services started successfully!"
}

# Check service health
check_service_health() {
    log_info "Checking service health..."

    # Check MongoDB
    if docker-compose -f docker-compose.dev.yml exec -T mongodb mongosh --eval "db.adminCommand('ping')" &>/dev/null; then
        log_success "MongoDB is healthy"
    else
        log_error "MongoDB is not responding"
    fi

    # Check Redis
    if docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping | grep -q PONG; then
        log_success "Redis is healthy"
    else
        log_error "Redis is not responding"
    fi

    # Check API Gateway
    if curl -f http://localhost:3000/health &>/dev/null; then
        log_success "API Gateway is healthy"
    else
        log_error "API Gateway is not responding"
    fi
}

# Setup development tools
setup_dev_tools() {
    log_header "Setting up Development Tools"

    # Install git hooks
    if [ -d ".git" ]; then
        log_info "Setting up git hooks..."
        npm run prepare 2>/dev/null || true

        # Create pre-commit hook if husky is available
        if command -v husky &> /dev/null; then
            npx husky install
            echo "#!/usr/bin/env sh" > .husky/pre-commit
            echo ". \"\$(dirname -- \"\$0\")/_/husky.sh\"" >> .husky/pre-commit
            echo "npm run lint && npm test" >> .husky/pre-commit
            chmod +x .husky/pre-commit
            log_success "Git hooks configured"
        fi
    fi

    # Setup VS Code settings if .vscode doesn't exist
    if [ ! -d ".vscode" ]; then
        log_info "Creating VS Code workspace settings..."
        mkdir -p .vscode

        # Create settings.json
        cat > .vscode/settings.json << EOF
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.associations": {
    "*.env*": "properties"
  },
  "emmet.includeLanguages": {
    "javascript": "html"
  },
  "javascript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.importModuleSpecifier": "relative"
}
EOF

        # Create launch.json for debugging
        cat > .vscode/launch.json << EOF
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API Gateway",
      "type": "node",
      "request": "launch",
      "program": "\${workspaceFolder}/src/index.js",
      "skipFiles": [
        "<node_internals>/**"
      ],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "\${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
EOF

        log_success "VS Code settings created"
    fi

    log_success "Development tools setup completed!"
}

# Show usage information
show_info() {
    log_header "Development Environment Ready!"

    echo -e "${CYAN}🚀 API Gateway V2 Development Environment${NC}"
    echo ""
    echo -e "${GREEN}Services:${NC}"
    echo "  • API Gateway: http://localhost:3000"
    echo "  • Health Check: http://localhost:3000/health"
    echo "  • Metrics: http://localhost:3000/metrics"
    echo "  • MongoDB Admin: http://localhost:8082 (admin/admin123)"
    echo "  • Redis Admin: http://localhost:8081"
    echo ""
    echo -e "${GREEN}Development Commands:${NC}"
    echo "  • Start services: docker-compose -f docker-compose.dev.yml up -d"
    echo "  • Stop services: docker-compose -f docker-compose.dev.yml down"
    echo "  • View logs: docker-compose -f docker-compose.dev.yml logs -f"
    echo "  • Run tests: npm test"
    echo "  • Run lint: npm run lint"
    echo "  • Debug: npm run debug"
    echo ""
    echo -e "${GREEN}Useful Scripts:${NC}"
    echo "  • Performance test: npm run test:perf"
    echo "  • Load test: npm run test:load"
    echo "  • Code coverage: npm run test:coverage"
    echo ""
    echo -e "${YELLOW}⚠️  Remember to update your API keys in .env file!${NC}"
    echo ""
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo "  • API Docs: ./docs/api.md"
    echo "  • Development: ./docs/development.md"
    echo "  • Deployment: ./docs/deployment.md"
}

# Main function
main() {
    case "${1:-setup}" in
        "setup")
            check_prerequisites
            setup_environment
            setup_dev_tools
            start_services
            show_info
            ;;
        "start")
            start_services
            show_info
            ;;
        "stop")
            log_info "Stopping development services..."
            docker-compose -f docker-compose.dev.yml down
            log_success "Services stopped"
            ;;
        "restart")
            log_info "Restarting development services..."
            docker-compose -f docker-compose.dev.yml restart
            check_service_health
            log_success "Services restarted"
            ;;
        "status")
            check_service_health
            ;;
        "clean")
            log_warning "This will remove all development data!"
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                log_info "Cleaning development environment..."
                docker-compose -f docker-compose.dev.yml down -v
                rm -f .env
                log_success "Development environment cleaned"
            fi
            ;;
        "help"|"-h"|"--help")
            echo "API Gateway V2 Development Setup Script"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  setup   - Initial setup (default)"
            echo "  start   - Start development services"
            echo "  stop    - Stop development services"
            echo "  restart - Restart development services"
            echo "  status  - Check service status"
            echo "  clean   - Clean development environment"
            echo "  help    - Show this help"
            ;;
        *)
            log_error "Unknown command: $1"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
