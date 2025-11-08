#!/bin/bash

# Sira AI Gateway - Health Check Script
# This script performs basic health checks on the project

set -e

echo "🔍 Performing Sira AI Gateway Health Check..."
echo "=============================================="

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo "✅ Node.js version: $NODE_VERSION (✓ meets requirement >= $REQUIRED_VERSION)"
else
    echo "❌ Node.js version: $NODE_VERSION (✗ requires >= $REQUIRED_VERSION)"
    exit 1
fi

# Check npm
echo "📦 Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm version: $NPM_VERSION"
else
    echo "❌ npm not found"
    exit 1
fi

# Check project structure
echo "🏗️  Checking project structure..."

# Required directories
REQUIRED_DIRS=(
    "src/core"
    "src/config"
    "src/test"
    "docs"
    "scripts/utilities"
    "infrastructure"
    ".github/workflows"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ Directory exists: $dir"
    else
        echo "❌ Directory missing: $dir"
        exit 1
    fi
done

# Required files
REQUIRED_FILES=(
    "package.json"
    "README.md"
    "LICENSE"
    ".gitignore"
    ".github/workflows/ci.yml"
    "src/core/index.js"
    "src/config/gateway.config.yml"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ File exists: $file"
    else
        echo "❌ File missing: $file"
        exit 1
    fi
done

# Check package.json validity
echo "📦 Checking package.json..."
if npm run --silent test:unit --dry-run &> /dev/null; then
    echo "✅ package.json scripts are valid"
else
    echo "⚠️  Some package.json scripts may have issues"
fi

# Check for common security issues
echo "🔒 Checking for security issues..."
if [ -f ".env" ]; then
    echo "⚠️  .env file found - ensure it's not committed"
fi

if grep -r "password\|secret\|key" .env* &> /dev/null 2>&1; then
    echo "⚠️  Sensitive data found in .env files"
fi

# Check git status
echo "📝 Checking git status..."
if [ -d ".git" ]; then
    if git status --porcelain | grep -v "^??" | head -5 | grep . &> /dev/null; then
        echo "⚠️  There are staged/uncommitted changes"
    else
        echo "✅ Git working directory is clean"
    fi
else
    echo "⚠️  Not a git repository"
fi

echo ""
echo "🎉 Health check completed successfully!"
echo "=============================================="
echo "📊 Summary:"
echo "   ✅ Project structure is valid"
echo "   ✅ Required dependencies are available"
echo "   ✅ Configuration files are present"
echo ""
echo "🚀 Ready for development and deployment!"
