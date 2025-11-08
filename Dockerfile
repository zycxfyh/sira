# Simple and efficient Docker build for Sira AI Gateway
# Based on Express Gateway's proven approach

FROM node:18-alpine

# Set metadata
LABEL maintainer="Sira AI Gateway Team"
LABEL description="A lightweight, intelligent AI API Gateway"

# Set environment variables
ENV NODE_ENV=production
ENV NODE_PATH=/usr/local/lib/node_modules
ENV EG_CONFIG_DIR=/app/config
ENV CHOKIDAR_USEPOLLING=true

# Create app directory
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    && update-ca-certificates

# Copy package files
COPY package*.json ./

# Install production dependencies only (with legacy peer deps to resolve conflicts)
RUN npm install --production --legacy-peer-deps && \
    npm cache clean --force

# Copy application source code
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY docs/ ./docs/

# Create necessary directories
RUN mkdir -p \
    /app/data \
    /app/logs \
    /app/config \
    /app/temp \
    && chmod -R 755 /app

# Create volume for persistent data
VOLUME ["/app/data", "/app/logs", "/app/config"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-9090}/health || exit 1

# Expose ports (main gateway and admin)
EXPOSE ${PORT:-9090} ${ADMIN_PORT:-9999}

# Start the application
CMD ["node", "src/index.js"]