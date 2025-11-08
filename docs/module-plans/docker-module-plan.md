# 🐳 部署模块 (Docker Module) 详细规划

## 📋 模块概述

**部署模块** 是Sira AI网关的"基础设施引擎"，基于Docker和容器化技术，提供完整的部署、编排、监控和运维解决方案。它是系统的运行基础，确保应用能够在各种环境中稳定、高效地运行。

### 定位与职责

- **系统定位**: 容器化部署和基础设施管理的核心平台
- **主要职责**: 容器化、编排部署、环境管理、监控运维
- **设计理念**: 云原生、自动化、可扩展、安全可靠

### 架构层次

```
部署模块架构:
├── 🏗️ 容器化层 (Containerization Layer)
│   ├── Docker镜像构建 (Image Building)
│   ├── 多阶段构建 (Multi-stage Build)
│   ├── 镜像优化 (Image Optimization)
│   └── 安全加固 (Security Hardening)
├── 🎼 编排层 (Orchestration Layer)
│   ├── Docker Compose编排 (Compose Orchestration)
│   ├── Kubernetes部署 (K8s Deployment)
│   ├── 服务发现 (Service Discovery)
│   └── 负载均衡 (Load Balancing)
├── 📊 监控运维层 (Monitoring & Operations Layer)
│   ├── 容器监控 (Container Monitoring)
│   ├── 日志聚合 (Log Aggregation)
│   ├── 性能监控 (Performance Monitoring)
│   └── 自动化运维 (Automated Operations)
└── ☁️ 云服务层 (Cloud Services Layer)
    ├── 云提供商集成 (Cloud Provider Integration)
    ├── 弹性伸缩 (Auto Scaling)
    ├── 备份恢复 (Backup & Recovery)
    └── 灾难恢复 (Disaster Recovery)
```

---

## 🏗️ 架构设计

### 1. 容器化架构

#### 1.1 Docker镜像设计

**多阶段构建策略**:

```dockerfile
# Dockerfile - 多阶段构建
# =========================

# 构建阶段 - 使用Node.js构建应用
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖 (包括devDependencies用于构建)
RUN npm ci --only=production=false

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 运行阶段 - 使用轻量级Node.js运行时
FROM node:18-alpine AS runtime

# 安装必要的系统依赖
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 设置工作目录
WORKDIR /app

# 从构建阶段复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# 切换到非root用户
USER nextjs

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8080

# 使用dumb-init启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
```

**镜像优化策略**:

```dockerfile
# Dockerfile.optimized - 进一步优化版本
FROM node:18-alpine AS base

# 安装系统依赖
RUN apk add --no-cache \
    dumb-init \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# 设置时区
ENV TZ=Asia/Shanghai

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

FROM base AS runtime
WORKDIR /app

# 创建应用用户
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# 复制应用文件
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# 设置正确的权限
RUN chown -R appuser:appgroup /app
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

#### 1.2 镜像安全加固

**安全最佳实践**:

```dockerfile
# Dockerfile.security - 安全加固版本
FROM node:18-alpine AS base

# 更新包管理器并安装安全补丁
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/* /tmp/*

# 创建专用用户和组
RUN addgroup -g 10001 appgroup && \
    adduser -u 10001 -S appuser -G appgroup -h /home/appuser

# 设置工作目录权限
WORKDIR /app
RUN chown -R appuser:appgroup /app

# 复制应用文件 (在切换用户之前)
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup dist ./dist

# 安装运行时依赖
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# 移除不必要的文件和权限
RUN rm -rf /usr/local/lib/node_modules/npm && \
    chmod -R 755 /app && \
    chmod 644 /app/package.json

# 切换到非特权用户
USER appuser

# 设置安全环境变量
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512 --max-http-header-size=16384"

# 只暴露必要端口
EXPOSE 8080

# 设置资源限制
LABEL maintainer="Sira Team <team@sira.ai>"
LABEL version="1.0.0"
LABEL description="Sira AI Gateway - Secure Container Image"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f -H "User-Agent: HealthCheck" http://localhost:8080/health || exit 1

# 使用exec格式的CMD
CMD ["dumb-init", "node", "dist/index.js"]
```

### 2. 编排部署架构

#### 2.1 Docker Compose编排

**完整环境编排**:

```yaml
# docker-compose.yml - 完整开发环境
version: '3.8'

services:
  # 主应用服务
  app:
    build:
      context: ..
      dockerfile: Dockerfile
      target: runtime
    ports:
      - '8080:8080'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://db:5432/sira
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
      - monitoring
    networks:
      - sira-network
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL数据库
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=sira
      - POSTGRES_USER=sira
      - POSTGRES_PASSWORD=${DB_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - '5432:5432'
    networks:
      - sira-network
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U sira -d sira']
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis缓存
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-changeme}
    volumes:
      - redis_data:/data
    ports:
      - '6379:6379'
    networks:
      - sira-network
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'redis-cli', '--raw', 'incr', 'ping']
      interval: 30s
      timeout: 10s
      retries: 3

  # 监控栈
  monitoring:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    ports:
      - '9090:9090'
    networks:
      - sira-network
    restart: unless-stopped

  # Grafana可视化
  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    ports:
      - '3000:3000'
    depends_on:
      - monitoring
    networks:
      - sira-network
    restart: unless-stopped

  # 日志聚合
  loki:
    image: grafana/loki:latest
    volumes:
      - ./monitoring/loki/config.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    ports:
      - '3100:3100'
    networks:
      - sira-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
  loki_data:

networks:
  sira-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

#### 2.2 Kubernetes部署

**K8s原生部署**:

```yaml
# k8s/deployment.yml - Kubernetes部署配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sira-gateway
  labels:
    app: sira-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sira-gateway
  template:
    metadata:
      labels:
        app: sira-gateway
    spec:
      containers:
        - name: sira-gateway
          image: sira/gateway:latest
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: NODE_ENV
              value: 'production'
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: sira-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: sira-secrets
                  key: redis-url
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          securityContext:
            allowPrivilegeEscalation: false
            runAsNonRoot: true
            runAsUser: 10001
            capabilities:
              drop:
                - ALL
      securityContext:
        fsGroup: 10001
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - sira-gateway
                topologyKey: kubernetes.io/hostname

---
apiVersion: v1
kind: Service
metadata:
  name: sira-gateway-service
spec:
  selector:
    app: sira-gateway
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
  type: LoadBalancer

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sira-gateway-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: 'letsencrypt-prod'
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.sira.ai
      secretName: sira-tls
  rules:
    - host: api.sira.ai
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: sira-gateway-service
                port:
                  number: 80
```

#### 2.3 服务网格集成

**Istio服务网格配置**:

```yaml
# istio/gateway.yml - Istio Gateway配置
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: sira-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - api.sira.ai
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: sira-tls
      hosts:
        - api.sira.ai

---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: sira-gateway
spec:
  hosts:
    - api.sira.ai
  gateways:
    - sira-gateway
  http:
    - match:
        - uri:
            prefix: '/api/v1'
      route:
        - destination:
            host: sira-gateway
            port:
              number: 8080
      timeout: 30s
      retries:
        attempts: 3
        perTryTimeout: 10s
    - match:
        - uri:
            prefix: '/health'
      route:
        - destination:
            host: sira-gateway
            port:
              number: 8080

---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: sira-gateway-auth
  namespace: default
spec:
  selector:
    matchLabels:
      app: sira-gateway
  action: ALLOW
  rules:
    - from:
        - source:
            requestPrincipals: ['*']
      to:
        - operation:
            methods: ['GET', 'POST']
            paths: ['/api/v1/*', '/health']
```

---

## 🎯 功能职责详解

### 1. 容器化部署

#### 1.1 镜像构建与优化

**自动化镜像构建流程**:

```javascript
class DockerImageBuilder {
  constructor(options = {}) {
    this.docker = new Docker();
    this.registry = options.registry || 'docker.io';
    this.namespace = options.namespace || 'sira';
    this.buildArgs = options.buildArgs || {};
  }

  // 构建多架构镜像
  async buildMultiArch(imageName, context, dockerfile = 'Dockerfile') {
    const platforms = ['linux/amd64', 'linux/arm64'];
    const tags = await this.generateTags(imageName);

    console.log(`Building multi-arch image: ${imageName}`);

    // 构建每个架构的镜像
    const builds = platforms.map(async platform => {
      const platformTag = `${imageName}-${platform.replace('/', '-')}`;

      await this.docker.buildImage({
        context,
        dockerfile,
        t: platformTag,
        buildargs: {
          ...this.buildArgs,
          TARGETPLATFORM: platform,
        },
        platform,
      });

      return platformTag;
    });

    await Promise.all(builds);

    // 创建manifest并推送多架构镜像
    await this.createAndPushManifest(imageName, platforms, tags);

    console.log(`✅ Multi-arch image built and pushed: ${imageName}`);
  }

  // 镜像安全扫描
  async scanImage(imageName) {
    console.log(`Scanning image for vulnerabilities: ${imageName}`);

    try {
      const scanResult = await this.runTrivyScan(imageName);

      if (scanResult.vulnerabilities.high > 0) {
        throw new Error(
          `High-severity vulnerabilities found: ${scanResult.vulnerabilities.high}`
        );
      }

      console.log('✅ Image security scan passed');
      return scanResult;
    } catch (error) {
      console.error('❌ Image security scan failed:', error.message);
      throw error;
    }
  }

  // 镜像大小优化
  async optimizeImage(imageName) {
    console.log(`Optimizing image size: ${imageName}`);

    // 分析镜像层
    const layers = await this.analyzeImageLayers(imageName);

    // 识别优化机会
    const optimizations = this.identifyOptimizations(layers);

    // 应用优化
    const optimizedImage = await this.applyOptimizations(
      imageName,
      optimizations
    );

    // 验证优化效果
    const originalSize = await this.getImageSize(imageName);
    const optimizedSize = await this.getImageSize(optimizedImage);
    const reduction = ((originalSize - optimizedSize) / originalSize) * 100;

    console.log(`✅ Image optimized: ${reduction.toFixed(1)}% size reduction`);
    console.log(`   Original: ${this.formatBytes(originalSize)}`);
    console.log(`   Optimized: ${this.formatBytes(optimizedSize)}`);

    return optimizedImage;
  }

  // 生成镜像标签
  async generateTags(imageName) {
    const tags = [imageName];

    // 添加版本标签
    const version = await this.getPackageVersion();
    tags.push(`${imageName}:${version}`);

    // 添加latest标签 (仅主分支)
    if (await this.isMainBranch()) {
      tags.push(`${imageName}:latest`);
    }

    // 添加Git标签
    const gitTag = await this.getGitTag();
    if (gitTag) {
      tags.push(`${imageName}:${gitTag}`);
    }

    // 添加时间戳标签
    const timestamp = new Date().toISOString().split('T')[0];
    tags.push(`${imageName}:${timestamp}`);

    return tags;
  }
}
```

#### 1.2 镜像分发与管理

**镜像仓库管理**:

```javascript
class ImageRegistryManager {
  constructor(config = {}) {
    this.registries = new Map();
    this.defaultRegistry = config.defaultRegistry || 'docker.io';

    // 支持多个镜像仓库
    this.addRegistry('dockerhub', {
      url: 'https://index.docker.io/v1/',
      auth: config.dockerhubAuth,
    });

    this.addRegistry('ecr', {
      url: config.ecrUrl,
      auth: config.ecrAuth,
      type: 'aws',
    });

    this.addRegistry('gcr', {
      url: config.gcrUrl,
      auth: config.gcrAuth,
      type: 'gcp',
    });
  }

  // 推送镜像到多个仓库
  async pushToRegistries(imageName, tags, registries = null) {
    const targetRegistries = registries || Array.from(this.registries.keys());

    for (const registryName of targetRegistries) {
      const registry = this.registries.get(registryName);
      if (!registry) continue;

      console.log(`Pushing to registry: ${registryName}`);

      for (const tag of tags) {
        const fullImageName = `${registry.url}/${imageName}:${tag}`;

        try {
          await this.authenticateRegistry(registry);
          await this.docker.push(fullImageName);
          console.log(`✅ Pushed: ${fullImageName}`);
        } catch (error) {
          console.error(`❌ Failed to push to ${registryName}:`, error.message);
        }
      }
    }
  }

  // 镜像清理策略
  async cleanupOldImages(imageName, keepVersions = 10) {
    console.log(`Cleaning up old images for: ${imageName}`);

    // 获取所有标签
    const allTags = await this.listImageTags(imageName);

    // 按版本排序
    const sortedTags = this.sortTagsByVersion(allTags);

    // 保留最新版本
    const tagsToDelete = sortedTags.slice(keepVersions);

    // 删除旧版本
    for (const tag of tagsToDelete) {
      try {
        await this.deleteImageTag(imageName, tag);
        console.log(`🗑️ Deleted old image: ${imageName}:${tag}`);
      } catch (error) {
        console.warn(`Failed to delete ${tag}:`, error.message);
      }
    }

    console.log(
      `✅ Cleanup completed. Kept ${keepVersions} versions, deleted ${tagsToDelete.length} old versions`
    );
  }

  // 镜像漏洞监控
  async monitorVulnerabilities(imageName) {
    const vulnerabilities = await this.scanImageVulnerabilities(imageName);

    // 按严重程度分类
    const critical = vulnerabilities.filter(v => v.severity === 'CRITICAL');
    const high = vulnerabilities.filter(v => v.severity === 'HIGH');

    if (critical.length > 0 || high.length > 0) {
      console.warn(`🚨 Security vulnerabilities found in ${imageName}:`);
      console.warn(`   Critical: ${critical.length}`);
      console.warn(`   High: ${high.length}`);

      // 发送告警
      await this.sendSecurityAlert(imageName, vulnerabilities);
    }

    return {
      total: vulnerabilities.length,
      critical: critical.length,
      high: high.length,
      medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
      low: vulnerabilities.filter(v => v.severity === 'LOW').length,
    };
  }
}
```

### 2. 编排与扩展

#### 2.1 弹性伸缩

**自动扩缩容策略**:

```javascript
class AutoScaler {
  constructor(k8sClient, options = {}) {
    this.k8s = k8sClient;
    this.options = {
      minReplicas: options.minReplicas || 1,
      maxReplicas: options.maxReplicas || 10,
      targetCPUUtilizationPercentage: options.targetCPU || 70,
      targetMemoryUtilizationPercentage: options.targetMemory || 80,
      scaleUpThreshold: options.scaleUpThreshold || 80,
      scaleDownThreshold: options.scaleDownThreshold || 50,
      stabilizationWindowSeconds: options.stabilizationWindow || 300,
      ...options,
    };

    this.metricsHistory = new Map();
  }

  // 监控和扩缩容
  async monitorAndScale(deploymentName, namespace = 'default') {
    const metrics = await this.getCurrentMetrics(deploymentName, namespace);
    this.updateMetricsHistory(deploymentName, metrics);

    const currentReplicas = await this.getCurrentReplicas(
      deploymentName,
      namespace
    );
    const recommendedReplicas = this.calculateRecommendedReplicas(
      metrics,
      currentReplicas
    );

    if (recommendedReplicas !== currentReplicas) {
      await this.scaleDeployment(
        deploymentName,
        namespace,
        recommendedReplicas
      );

      console.log(
        `🔄 Scaled ${deploymentName} from ${currentReplicas} to ${recommendedReplicas} replicas`
      );
      console.log(
        `   CPU: ${metrics.cpu}%, Memory: ${metrics.memory}%, Requests: ${metrics.requestsPerSecond} RPS`
      );
    }

    return recommendedReplicas;
  }

  // 计算推荐副本数
  calculateRecommendedReplicas(metrics, currentReplicas) {
    const cpuScale = metrics.cpu / this.options.targetCPUUtilizationPercentage;
    const memoryScale =
      metrics.memory / this.options.targetMemoryUtilizationPercentage;
    const requestScale = metrics.requestsPerSecond / 100; // 假设100 RPS需要1个副本

    // 取最大值作为扩缩容因子
    const scaleFactor = Math.max(cpuScale, memoryScale, requestScale);

    let recommendedReplicas = Math.ceil(currentReplicas * scaleFactor);

    // 应用约束
    recommendedReplicas = Math.max(
      this.options.minReplicas,
      recommendedReplicas
    );
    recommendedReplicas = Math.min(
      this.options.maxReplicas,
      recommendedReplicas
    );

    // 检查稳定窗口
    if (!this.isStabilizationPeriodPassed(recommendedReplicas)) {
      return currentReplicas; // 不进行扩缩容
    }

    return recommendedReplicas;
  }

  // 执行扩缩容
  async scaleDeployment(deploymentName, namespace, replicas) {
    const appsApi = this.k8s.api.apps.v1;

    const deployment = await appsApi
      .namespaces(namespace)
      .deployments(deploymentName)
      .get();

    deployment.spec.replicas = replicas;

    await appsApi.namespaces(namespace).deployments(deploymentName).patch({
      spec: {
        replicas,
      },
    });

    // 记录扩缩容事件
    await this.recordScalingEvent(deploymentName, namespace, replicas);
  }

  // 预测性扩缩容
  async predictiveScaling(deploymentName, namespace) {
    const historicalData = await this.getHistoricalMetrics(
      deploymentName,
      namespace
    );
    const prediction = await this.predictFutureLoad(historicalData);

    if (prediction.confidence > 0.8) {
      const predictedReplicas = this.calculateRecommendedReplicas(
        prediction.metrics,
        await this.getCurrentReplicas(deploymentName, namespace)
      );

      if (
        Math.abs(
          predictedReplicas -
            (await this.getCurrentReplicas(deploymentName, namespace))
        ) > 1
      ) {
        console.log(
          `🔮 Predictive scaling: ${predictedReplicas} replicas (confidence: ${(prediction.confidence * 100).toFixed(1)}%)`
        );
        await this.scaleDeployment(
          deploymentName,
          namespace,
          predictedReplicas
        );
      }
    }
  }

  // 获取当前指标
  async getCurrentMetrics(deploymentName, namespace) {
    const metricsApi = this.k8s.api.metrics.k8s.io.v1beta1;

    try {
      const pods = await this.k8s.api.v1.namespaces(namespace).pods.get({
        qs: {
          labelSelector: `app=${deploymentName}`,
        },
      });

      let totalCPU = 0;
      let totalMemory = 0;
      let podCount = 0;

      for (const pod of pods.items) {
        const podMetrics = await metricsApi
          .namespaces(namespace)
          .pods(pod.metadata.name)
          .get();

        if (podMetrics.containers && podMetrics.containers.length > 0) {
          const container = podMetrics.containers[0];
          totalCPU += parseInt(container.usage.cpu.replace('n', '')) / 1000000; // 转换为millicores
          totalMemory +=
            parseInt(container.usage.memory.replace('Ki', '')) / 1024; // 转换为Mi
          podCount++;
        }
      }

      return {
        cpu: podCount > 0 ? ((totalCPU / podCount) * 100) / 1000 : 0, // 转换为百分比
        memory: podCount > 0 ? totalMemory / podCount : 0,
        podCount,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return { cpu: 0, memory: 0, podCount: 0 };
    }
  }
}
```

#### 2.2 服务发现与负载均衡

**智能服务发现**:

```javascript
class ServiceDiscovery {
  constructor(options = {}) {
    this.providers = new Map();
    this.cache = new Map();
    this.ttl = options.ttl || 30000; // 30秒缓存

    // 注册服务发现提供者
    this.registerProvider('kubernetes', new KubernetesServiceDiscovery());
    this.registerProvider('consul', new ConsulServiceDiscovery());
    this.registerProvider('etcd', new EtcdServiceDiscovery());
  }

  // 服务注册
  async registerService(serviceName, serviceInfo) {
    const provider = this.getProvider();

    await provider.register(serviceName, {
      id: serviceInfo.id || `${serviceName}-${Date.now()}`,
      name: serviceName,
      address: serviceInfo.address,
      port: serviceInfo.port,
      tags: serviceInfo.tags || [],
      meta: serviceInfo.meta || {},
      check: serviceInfo.check || this.createDefaultCheck(serviceInfo),
    });

    console.log(
      `✅ Service registered: ${serviceName} at ${serviceInfo.address}:${serviceInfo.port}`
    );
  }

  // 服务发现
  async discoverServices(serviceName, options = {}) {
    const cacheKey = `${serviceName}:${JSON.stringify(options)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.services;
    }

    const provider = this.getProvider();
    const services = await provider.discover(serviceName, options);

    // 应用负载均衡策略
    const balancedServices = this.applyLoadBalancing(
      services,
      options.strategy || 'round-robin'
    );

    // 更新缓存
    this.cache.set(cacheKey, {
      services: balancedServices,
      timestamp: Date.now(),
    });

    return balancedServices;
  }

  // 健康检查
  async healthCheck(serviceId) {
    const provider = this.getProvider();
    return await provider.healthCheck(serviceId);
  }

  // 服务注销
  async deregisterService(serviceId) {
    const provider = this.getProvider();
    await provider.deregister(serviceId);
    console.log(`✅ Service deregistered: ${serviceId}`);
  }

  // 负载均衡策略
  applyLoadBalancing(services, strategy) {
    const healthyServices = services.filter(s => s.status === 'passing');

    switch (strategy) {
      case 'round-robin':
        return this.roundRobinBalance(healthyServices);
      case 'least-connections':
        return this.leastConnectionsBalance(healthyServices);
      case 'weighted':
        return this.weightedBalance(healthyServices);
      case 'random':
        return this.randomBalance(healthyServices);
      default:
        return healthyServices;
    }
  }

  roundRobinBalance(services) {
    // 简单的轮询策略
    const sorted = services.sort(
      (a, b) => (a.roundRobinIndex || 0) - (b.roundRobinIndex || 0)
    );
    const selected = sorted[0];

    // 更新轮询索引
    services.forEach(s => {
      s.roundRobinIndex = (s.roundRobinIndex || 0) + 1;
    });

    return [selected];
  }

  leastConnectionsBalance(services) {
    return services.sort(
      (a, b) => (a.activeConnections || 0) - (b.activeConnections || 0)
    );
  }

  weightedBalance(services) {
    const totalWeight = services.reduce((sum, s) => sum + (s.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const service of services) {
      random -= service.weight || 1;
      if (random <= 0) {
        return [service];
      }
    }

    return [services[0]];
  }

  randomBalance(services) {
    const randomIndex = Math.floor(Math.random() * services.length);
    return [services[randomIndex]];
  }
}
```

---

## 🛠️ 技术实现详解

### 1. 基础设施即代码

#### 1.1 部署配置管理

**基础设施即代码实现**:

```javascript
class InfrastructureAsCode {
  constructor() {
    this.templates = new Map();
    this.environments = new Map();
    this.variables = new Map();
  }

  // 定义环境
  defineEnvironment(name, config) {
    this.environments.set(name, {
      name,
      config,
      templates: [],
      variables: new Map(),
      hooks: {
        preDeploy: [],
        postDeploy: [],
        preDestroy: [],
        postDestroy: [],
      },
    });
  }

  // 注册基础设施模板
  registerTemplate(name, template) {
    this.templates.set(name, {
      name,
      content: template,
      variables: this.extractVariables(template),
      metadata: {
        description: template.description,
        version: template.version,
        author: template.author,
      },
    });
  }

  // 生成部署配置
  async generateDeployment(environmentName, options = {}) {
    const environment = this.environments.get(environmentName);
    if (!environment) {
      throw new Error(`Environment '${environmentName}' not found`);
    }

    const deployment = {
      environment: environmentName,
      timestamp: new Date().toISOString(),
      resources: [],
      variables: {},
      metadata: {},
    };

    // 合并变量
    const allVariables = this.mergeVariables(
      environment,
      options.variables || {}
    );
    deployment.variables = allVariables;

    // 生成每个模板的资源
    for (const templateName of environment.templates) {
      const template = this.templates.get(templateName);
      if (!template) continue;

      const resource = await this.renderTemplate(template, allVariables);
      deployment.resources.push(resource);
    }

    // 应用部署策略
    deployment.strategy = this.determineDeploymentStrategy(
      environment,
      options
    );

    return deployment;
  }

  // 部署执行
  async deploy(deploymentConfig, options = {}) {
    console.log(`🚀 Starting deployment to ${deploymentConfig.environment}`);

    try {
      // 预部署钩子
      await this.executeHooks(deploymentConfig.environment, 'preDeploy');

      // 验证部署配置
      await this.validateDeployment(deploymentConfig);

      // 创建部署计划
      const plan = await this.createDeploymentPlan(deploymentConfig);

      // 执行部署
      const result = await this.executeDeployment(plan, options);

      // 后部署钩子
      await this.executeHooks(deploymentConfig.environment, 'postDeploy');

      console.log(`✅ Deployment completed successfully`);
      return result;
    } catch (error) {
      console.error(`❌ Deployment failed:`, error.message);

      // 回滚处理
      if (options.rollbackOnFailure) {
        await this.rollback(deploymentConfig);
      }

      throw error;
    }
  }

  // 部署验证
  async validateDeployment(deployment) {
    const issues = [];

    // 验证必需变量
    for (const [key, value] of Object.entries(deployment.variables)) {
      if (value === undefined || value === null || value === '') {
        issues.push(`Missing required variable: ${key}`);
      }
    }

    // 验证资源配置
    for (const resource of deployment.resources) {
      const resourceIssues = await this.validateResource(resource);
      issues.push(...resourceIssues);
    }

    // 验证依赖关系
    const dependencyIssues = this.validateDependencies(deployment.resources);
    issues.push(...dependencyIssues);

    if (issues.length > 0) {
      throw new ValidationError('Deployment validation failed', issues);
    }

    return true;
  }

  // 创建部署计划
  async createDeploymentPlan(deployment) {
    const plan = {
      phases: [],
      resources: deployment.resources,
      rollbackPlan: [],
      estimatedDuration: 0,
    };

    // 分析依赖关系
    const dependencyGraph = this.buildDependencyGraph(deployment.resources);

    // 分阶段执行
    const phases = this.groupByPhases(dependencyGraph);

    for (const phase of phases) {
      plan.phases.push({
        name: phase.name,
        resources: phase.resources,
        parallel: phase.parallel,
        timeout: phase.timeout || 300000, // 5分钟
      });

      plan.estimatedDuration += phase.estimatedDuration || 60000; // 1分钟
    }

    // 生成回滚计划
    plan.rollbackPlan = this.generateRollbackPlan(phases);

    return plan;
  }

  // 执行部署
  async executeDeployment(plan, options) {
    const results = {
      phases: [],
      totalDuration: 0,
      success: true,
      errors: [],
    };

    const startTime = Date.now();

    for (const phase of plan.phases) {
      console.log(`📦 Executing phase: ${phase.name}`);

      const phaseStart = Date.now();

      try {
        const phaseResult = await this.executePhase(phase, options);
        results.phases.push(phaseResult);

        const phaseDuration = Date.now() - phaseStart;
        console.log(`✅ Phase '${phase.name}' completed in ${phaseDuration}ms`);
      } catch (error) {
        console.error(`❌ Phase '${phase.name}' failed:`, error.message);
        results.errors.push({
          phase: phase.name,
          error: error.message,
          timestamp: new Date(),
        });

        results.success = false;

        // 停止执行后续阶段
        break;
      }
    }

    results.totalDuration = Date.now() - startTime;

    // 记录部署结果
    await this.recordDeploymentResult(results);

    return results;
  }

  // 执行部署阶段
  async executePhase(phase, options) {
    const result = {
      name: phase.name,
      resources: [],
      duration: 0,
      success: true,
    };

    const startTime = Date.now();

    if (phase.parallel) {
      // 并行执行
      const promises = phase.resources.map(resource =>
        this.deployResource(resource, options)
      );

      const resourceResults = await Promise.allSettled(promises);

      for (let i = 0; i < resourceResults.length; i++) {
        const resourceResult = resourceResults[i];
        const resource = phase.resources[i];

        result.resources.push({
          name: resource.name,
          type: resource.type,
          success: resourceResult.status === 'fulfilled',
          error:
            resourceResult.status === 'rejected'
              ? resourceResult.reason.message
              : null,
          duration:
            resourceResult.status === 'fulfilled'
              ? resourceResult.value.duration
              : 0,
        });
      }

      result.success = result.resources.every(r => r.success);
    } else {
      // 串行执行
      for (const resource of phase.resources) {
        try {
          const resourceResult = await this.deployResource(resource, options);
          result.resources.push({
            name: resource.name,
            type: resource.type,
            success: true,
            duration: resourceResult.duration,
          });
        } catch (error) {
          result.resources.push({
            name: resource.name,
            type: resource.type,
            success: false,
            error: error.message,
          });

          result.success = false;
          break;
        }
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  // 部署单个资源
  async deployResource(resource, options) {
    const deployer = this.getResourceDeployer(resource.type);

    console.log(`  📋 Deploying ${resource.type}: ${resource.name}`);

    const startTime = Date.now();

    try {
      await deployer.deploy(resource, options);
      const duration = Date.now() - startTime;

      console.log(`    ✅ ${resource.name} deployed in ${duration}ms`);

      return { duration, success: true };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `    ❌ ${resource.name} deployment failed:`,
        error.message
      );

      throw error;
    }
  }
}
```

#### 1.2 配置漂移检测

**基础设施状态管理**:

```javascript
class InfrastructureDriftDetection {
  constructor() {
    this.baselines = new Map();
    this.driftHistory = [];
    this.tolerance = {
      cpu: 0.05, // 5% CPU使用率容忍度
      memory: 0.1, // 10% 内存使用率容忍度
      replicas: 0, // 副本数必须精确匹配
      image: 'exact', // 镜像版本必须完全匹配
    };
  }

  // 建立基线
  async establishBaseline(environment, resources) {
    const baseline = {
      environment,
      timestamp: new Date(),
      resources: {},
      checksum: null,
    };

    for (const resource of resources) {
      baseline.resources[resource.name] = {
        type: resource.type,
        spec: deepClone(resource.spec),
        status: await this.getCurrentState(resource),
      };
    }

    baseline.checksum = this.calculateChecksum(baseline.resources);
    this.baselines.set(environment, baseline);

    console.log(`📋 Baseline established for environment: ${environment}`);
    return baseline;
  }

  // 检测漂移
  async detectDrift(environment) {
    const baseline = this.baselines.get(environment);
    if (!baseline) {
      throw new Error(`No baseline found for environment: ${environment}`);
    }

    const currentState = await this.getCurrentEnvironmentState(environment);
    const drift = this.compareStates(baseline.resources, currentState);

    if (drift.hasDrift) {
      console.warn(`⚠️  Infrastructure drift detected in ${environment}`);
      drift.changes.forEach(change => {
        console.warn(
          `  ${change.type}: ${change.resource} - ${change.description}`
        );
      });

      // 记录漂移历史
      this.driftHistory.push({
        environment,
        timestamp: new Date(),
        baselineChecksum: baseline.checksum,
        currentChecksum: this.calculateChecksum(currentState),
        drift,
      });

      // 发送告警
      await this.sendDriftAlert(environment, drift);
    }

    return drift;
  }

  // 比较状态
  compareStates(baseline, current) {
    const changes = [];
    let hasDrift = false;

    for (const [resourceName, baselineResource] of Object.entries(baseline)) {
      const currentResource = current[resourceName];

      if (!currentResource) {
        changes.push({
          type: 'missing',
          resource: resourceName,
          description: 'Resource no longer exists',
        });
        hasDrift = true;
        continue;
      }

      const resourceDrift = this.compareResource(
        baselineResource,
        currentResource
      );
      if (resourceDrift.hasDrift) {
        changes.push(...resourceDrift.changes);
        hasDrift = true;
      }
    }

    // 检查新增资源
    for (const resourceName of Object.keys(current)) {
      if (!baseline[resourceName]) {
        changes.push({
          type: 'added',
          resource: resourceName,
          description: 'New resource added',
        });
        hasDrift = true;
      }
    }

    return { hasDrift, changes };
  }

  // 比较单个资源
  compareResource(baseline, current) {
    const changes = [];
    let hasDrift = false;

    // 比较规格
    const specDrift = this.compareSpecs(baseline.spec, current.spec);
    if (specDrift.hasDrift) {
      changes.push(...specDrift.changes);
      hasDrift = true;
    }

    // 比较状态 (根据容忍度)
    const statusDrift = this.compareStatus(baseline.status, current.status);
    if (statusDrift.hasDrift) {
      changes.push(...statusDrift.changes);
      hasDrift = true;
    }

    return { hasDrift, changes };
  }

  // 比较规格 (必须完全匹配)
  compareSpecs(baselineSpec, currentSpec) {
    const changes = [];
    let hasDrift = false;

    // 递归比较对象
    const compare = (baseline, current, path = '') => {
      if (typeof baseline !== typeof current) {
        changes.push({
          type: 'type_mismatch',
          resource: path,
          description: `Type changed from ${typeof baseline} to ${typeof current}`,
        });
        hasDrift = true;
        return;
      }

      if (typeof baseline === 'object' && baseline !== null) {
        const baselineKeys = Object.keys(baseline).sort();
        const currentKeys = Object.keys(current).sort();

        if (!arraysEqual(baselineKeys, currentKeys)) {
          changes.push({
            type: 'keys_mismatch',
            resource: path,
            description: `Keys changed from [${baselineKeys.join(',')}] to [${currentKeys.join(',')}]`,
          });
          hasDrift = true;
          return;
        }

        for (const key of baselineKeys) {
          compare(baseline[key], current[key], path ? `${path}.${key}` : key);
        }
      } else if (baseline !== current) {
        changes.push({
          type: 'value_changed',
          resource: path,
          description: `Value changed from '${baseline}' to '${current}'`,
        });
        hasDrift = true;
      }
    };

    compare(baselineSpec, currentSpec);
    return { hasDrift, changes };
  }

  // 比较状态 (考虑容忍度)
  compareStatus(baselineStatus, currentStatus) {
    const changes = [];
    let hasDrift = false;

    // CPU使用率比较
    if (Math.abs(baselineStatus.cpu - currentStatus.cpu) > this.tolerance.cpu) {
      changes.push({
        type: 'cpu_drift',
        resource: 'cpu',
        description: `CPU usage changed from ${baselineStatus.cpu}% to ${currentStatus.cpu}%`,
      });
      hasDrift = true;
    }

    // 内存使用率比较
    if (
      Math.abs(baselineStatus.memory - currentStatus.memory) >
      this.tolerance.memory
    ) {
      changes.push({
        type: 'memory_drift',
        resource: 'memory',
        description: `Memory usage changed from ${baselineStatus.memory}% to ${currentStatus.memory}%`,
      });
      hasDrift = true;
    }

    // 副本数比较
    if (baselineStatus.replicas !== currentStatus.replicas) {
      changes.push({
        type: 'replicas_drift',
        resource: 'replicas',
        description: `Replicas changed from ${baselineStatus.replicas} to ${currentStatus.replicas}`,
      });
      hasDrift = true;
    }

    // 镜像版本比较
    if (
      this.tolerance.image === 'exact' &&
      baselineStatus.image !== currentStatus.image
    ) {
      changes.push({
        type: 'image_drift',
        resource: 'image',
        description: `Image changed from ${baselineStatus.image} to ${currentStatus.image}`,
      });
      hasDrift = true;
    }

    return { hasDrift, changes };
  }

  // 自动修复漂移
  async autoRemediate(environment, drift) {
    console.log(`🔧 Starting auto-remediation for ${environment}`);

    const remediationPlan = this.generateRemediationPlan(drift);

    for (const step of remediationPlan) {
      try {
        console.log(`  📋 Executing: ${step.description}`);
        await step.execute();
        console.log(`  ✅ Completed: ${step.description}`);
      } catch (error) {
        console.error(`  ❌ Failed: ${step.description} - ${error.message}`);

        if (!step.continueOnFailure) {
          throw error;
        }
      }
    }

    console.log(`✅ Auto-remediation completed for ${environment}`);
  }

  // 生成修复计划
  generateRemediationPlan(drift) {
    const plan = [];

    for (const change of drift.changes) {
      switch (change.type) {
        case 'cpu_drift':
        case 'memory_drift':
          plan.push({
            description: `Adjusting autoscaling for ${change.resource}`,
            execute: () =>
              this.adjustAutoscaling(change.resource, drift.baseline),
            continueOnFailure: true,
          });
          break;

        case 'replicas_drift':
          plan.push({
            description: `Scaling ${change.resource} back to ${drift.baseline.replicas} replicas`,
            execute: () =>
              this.scaleToBaseline(change.resource, drift.baseline),
            continueOnFailure: false,
          });
          break;

        case 'image_drift':
          plan.push({
            description: `Rolling back ${change.resource} to image ${drift.baseline.image}`,
            execute: () => this.rollbackImage(change.resource, drift.baseline),
            continueOnFailure: false,
          });
          break;

        case 'missing':
          plan.push({
            description: `Recreating missing resource ${change.resource}`,
            execute: () =>
              this.recreateResource(change.resource, drift.baseline),
            continueOnFailure: false,
          });
          break;
      }
    }

    return plan;
  }
}
```

---

## 📈 发展规划

### 1. 短期规划 (0-6个月)

#### 1.1 容器化完善

- [ ] **镜像优化**
  - [ ] 实现多阶段构建优化
  - [ ] 添加镜像大小分析工具
  - [ ] 实现镜像分层优化
  - [ ] 支持多架构镜像构建

- [ ] **安全加固**
  - [ ] 实施容器安全扫描
  - [ ] 添加镜像签名验证
  - [ ] 实现运行时安全策略
  - [ ] 容器漏洞自动修复

- [ ] **性能调优**
  - [ ] 容器启动时间优化
  - [ ] 内存使用优化
  - [ ] CPU使用优化
  - [ ] 网络性能优化

#### 1.2 编排能力增强

- [ ] **Docker Compose增强**
  - [ ] 支持环境变量覆盖
  - [ ] 实现服务依赖管理
  - [ ] 添加健康检查配置
  - [ ] 支持服务扩展配置

- [ ] **Kubernetes集成**
  - [ ] 完善K8s部署模板
  - [ ] 实现Helm Chart
  - [ ] 添加K8s Operator
  - [ ] 支持K8s服务网格

- [ ] **服务发现优化**
  - [ ] 实现智能服务发现
  - [ ] 支持多注册中心
  - [ ] 添加服务健康监控
  - [ ] 实现负载均衡策略

### 2. 中期规划 (6-12个月)

#### 2.1 云原生转型

- [ ] **多云支持**
  - [ ] AWS EKS集成
  - [ ] Google GKE集成
  - [ ] Azure AKS集成
  - [ ] 云服务抽象层

- [ ] **GitOps实践**
  - [ ] 实现GitOps工作流
  - [ ] 集成ArgoCD
  - [ ] 基础设施即代码
  - [ ] 自动化部署流水线

- [ ] **可观测性增强**
  - [ ] 分布式追踪集成
  - [ ] 日志聚合优化
  - [ ] 监控面板定制
  - [ ] 告警策略优化

#### 2.2 智能化运维

- [ ] **自动化运维**
  - [ ] 智能扩缩容算法
  - [ ] 自动故障恢复
  - [ ] 预测性维护
  - [ ] 自愈系统

- [ ] **成本优化**
  - [ ] 资源使用优化
  - [ ] 自动成本控制
  - [ ] 闲置资源清理
  - [ ] 多云成本比较

### 3. 长期规划 (12-24个月)

#### 3.1 平台化发展

- [ ] **部署平台**
  - [ ] Web界面部署管理
  - [ ] 一键部署体验
  - [ ] 部署模板市场
  - [ ] 部署历史管理

- [ ] **生态系统建设**
  - [ ] 第三方集成支持
  - [ ] 部署工具插件化
  - [ ] 开源贡献者工具
  - [ ] 社区最佳实践

#### 3.2 下一代基础设施

- [ ] **Serverless集成**
  - [ ] FaaS平台集成
  - [ ] 事件驱动架构
  - [ ] 自动弹性伸缩
  - [ ] 成本优化算法

- [ ] **边缘计算支持**
  - [ ] 边缘节点部署
  - [ ] 地理位置路由
  - [ ] 离线处理能力
  - [ ] 边缘数据同步

---

## 🔗 依赖关系

### 1. 内部依赖

#### 1.1 强依赖模块

```
部署模块依赖关系:
├── 核心模块 (Core Module)
│   ├── 部署AI路由逻辑
│   └── 提供配置模板
├── 配置模块 (Config Module)
│   ├── 读取部署配置
│   └── 管理环境变量
├── 测试模块 (Test Module)
│   ├── 集成部署测试
│   └── 性能测试环境
└── 管理模块 (Admin Module)
    ├── 提供部署管理界面
    └── 监控部署状态
```

#### 1.2 可选依赖模块

```
可选依赖:
├── 工具模块 (Bin Module) - 提供部署工具
└── 文档模块 (Docs Module) - 生成部署文档
```

### 2. 外部依赖

#### 2.1 容器化依赖

```json
{
  "Docker": {
    "docker": "^20.10.0",
    "docker-compose": "^2.0.0",
    "buildx": "^0.10.0"
  },
  "容器工具": {
    "dockerode": "^3.3.0",
    "docker-compose-viz": "^1.0.0"
  }
}
```

#### 2.2 编排依赖

```json
{
  "Kubernetes": {
    "@kubernetes/client-node": "^0.18.0",
    "kubernetes-models": "^4.0.0",
    "kubectl": "^1.0.0"
  },
  "Helm": {
    "@kubernetes/helm": "^1.0.0",
    "js-yaml": "^4.1.0"
  },
  "Istio": {
    "istio-models": "^1.0.0"
  }
}
```

#### 2.3 云服务依赖

```json
{
  "AWS": {
    "@aws-sdk/client-ecs": "^3.360.0",
    "@aws-sdk/client-ecr": "^3.360.0",
    "@aws-sdk/client-eks": "^3.360.0"
  },
  "Google Cloud": {
    "@google-cloud/container": "^4.0.0",
    "@google-cloud/artifact-registry": "^2.0.0"
  },
  "Azure": {
    "@azure/arm-containerservice": "^19.0.0",
    "@azure/container-registry": "^1.0.0"
  }
}
```

#### 2.4 监控运维依赖

```json
{
  "Prometheus": {
    "prom-client": "^14.0.0",
    "prometheus-api-metrics": "^3.2.2"
  },
  "Grafana": {
    "@grafana/runtime": "^10.0.0",
    "@grafana/ui": "^10.0.0"
  },
  "ELK Stack": {
    "winston": "^3.8.0",
    "@elastic/elasticsearch": "^8.0.0"
  }
}
```

---

## 🧪 测试策略

### 1. 部署测试

#### 1.1 容器测试

**镜像测试策略**:

```javascript
class ContainerTestSuite {
  // 镜像构建测试
  static async testImageBuild(dockerfile, context) {
    console.log('🏗️ Testing Docker image build...');

    const buildResult = await docker.buildImage({
      context,
      dockerfile,
      t: 'test-image:latest',
    });

    // 验证镜像构建成功
    const image = docker.getImage('test-image:latest');
    const imageInfo = await image.inspect();

    // 检查镜像大小
    expect(imageInfo.Size).toBeLessThan(500 * 1024 * 1024); // 500MB

    // 检查健康检查
    expect(imageInfo.Config.Healthcheck).toBeDefined();

    // 检查安全配置
    expect(imageInfo.Config.User).not.toBe('root');

    console.log('✅ Image build test passed');
  }

  // 容器运行测试
  static async testContainerRun(imageName) {
    console.log('🚀 Testing container runtime...');

    const container = await docker.createContainer({
      Image: imageName,
      Cmd: ['npm', 'test'],
      Env: ['NODE_ENV=test'],
    });

    await container.start();

    // 等待容器完成
    const result = await container.wait();

    // 检查退出码
    expect(result.StatusCode).toBe(0);

    // 检查容器日志
    const logs = await container.logs({
      stdout: true,
      stderr: true,
    });

    expect(logs).not.toContain('ERROR');
    expect(logs).toContain('All tests passed');

    await container.remove();
    console.log('✅ Container runtime test passed');
  }

  // 镜像安全测试
  static async testImageSecurity(imageName) {
    console.log('🔒 Testing image security...');

    // 运行Trivy安全扫描
    const scanResult = await exec(`trivy image --format json ${imageName}`);

    const vulnerabilities = JSON.parse(scanResult);

    // 检查高危漏洞
    const highSeverity = vulnerabilities.filter(v => v.Severity === 'HIGH');
    expect(highSeverity.length).toBe(0);

    // 检查关键漏洞
    const criticalSeverity = vulnerabilities.filter(
      v => v.Severity === 'CRITICAL'
    );
    expect(criticalSeverity.length).toBe(0);

    console.log('✅ Image security test passed');
  }

  // 镜像性能测试
  static async testImagePerformance(imageName) {
    console.log('⚡ Testing image performance...');

    const container = await docker.createContainer({
      Image: imageName,
      Cmd: ['node', '-e', 'console.log("warmup")'],
    });

    const startTime = Date.now();
    await container.start();
    await container.wait();
    const startupTime = Date.now() - startTime;

    // 检查启动时间
    expect(startupTime).toBeLessThan(5000); // 5秒内启动

    await container.remove();
    console.log('✅ Image performance test passed');
  }
}
```

#### 1.2 编排测试

**Docker Compose测试**:

```javascript
class ComposeTestSuite {
  // Compose文件验证
  static async testComposeFile(composeFile) {
    console.log('📋 Testing Docker Compose configuration...');

    // 验证YAML语法
    const composeConfig = yaml.load(fs.readFileSync(composeFile, 'utf8'));

    // 检查必需的服务
    expect(composeConfig.services).toHaveProperty('app');
    expect(composeConfig.services).toHaveProperty('db');

    // 验证服务配置
    for (const [serviceName, serviceConfig] of Object.entries(
      composeConfig.services
    )) {
      // 检查镜像或构建配置
      expect(serviceConfig.image || serviceConfig.build).toBeDefined();

      // 检查端口映射
      if (serviceConfig.ports) {
        serviceConfig.ports.forEach(port => {
          expect(port).toMatch(/^\d+:\d+$/);
        });
      }

      // 检查环境变量
      if (serviceConfig.environment) {
        Object.values(serviceConfig.environment).forEach(env => {
          expect(typeof env).toBe('string');
        });
      }

      // 检查健康检查
      if (serviceConfig.healthcheck) {
        expect(serviceConfig.healthcheck.test).toBeDefined();
        expect(serviceConfig.healthcheck.interval).toBeDefined();
      }
    }

    console.log('✅ Compose configuration test passed');
  }

  // Compose部署测试
  static async testComposeDeployment(composeFile, projectName) {
    console.log('🚀 Testing Docker Compose deployment...');

    try {
      // 启动服务
      await exec(`docker-compose -f ${composeFile} -p ${projectName} up -d`);

      // 等待服务就绪
      await this.waitForServices(projectName, 30000);

      // 验证服务健康
      await this.verifyServiceHealth(projectName);

      console.log('✅ Compose deployment test passed');
    } finally {
      // 清理资源
      await exec(`docker-compose -f ${composeFile} -p ${projectName} down -v`);
    }
  }

  // Kubernetes部署测试
  static async testK8sDeployment(manifests) {
    console.log('☸️ Testing Kubernetes deployment...');

    try {
      // 应用清单
      for (const manifest of manifests) {
        await exec(`kubectl apply -f ${manifest}`);
      }

      // 等待部署就绪
      await exec(
        'kubectl wait --for=condition=available --timeout=300s deployment/sira-gateway'
      );

      // 验证服务
      await this.verifyK8sServices();

      // 运行集成测试
      await this.runIntegrationTestsInK8s();

      console.log('✅ Kubernetes deployment test passed');
    } finally {
      // 清理资源
      for (const manifest of manifests.reverse()) {
        await exec(`kubectl delete -f ${manifest} --ignore-not-found=true`);
      }
    }
  }
}
```

---

## 🔧 维护计划

### 1. 日常维护

#### 1.1 容器维护

**镜像管理**:

- [ ] 定期清理未使用镜像
- [ ] 更新基础镜像版本
- [ ] 监控镜像大小变化
- [ ] 安全补丁及时应用

**容器监控**:

- [ ] 容器资源使用监控
- [ ] 容器健康状态检查
- [ ] 容器日志收集分析
- [ ] 异常容器自动重启

#### 1.2 编排维护

**Docker Compose维护**:

- [ ] 服务配置定期审查
- [ ] 环境变量安全检查
- [ ] 网络配置优化
- [ ] 存储卷清理策略

**Kubernetes维护**:

- [ ] 集群版本升级规划
- [ ] 资源配额管理
- [ ] 网络策略审查
- [ ] 安全上下文检查

### 2. 版本管理

#### 2.1 镜像版本管理

**语义化版本策略**:

```
镜像版本格式: MAJOR.MINOR.PATCH-TAG
- MAJOR: 重大架构变更或不兼容更新
- MINOR: 新功能添加或向后兼容改进
- PATCH: 缺陷修复或小幅优化
- TAG: 环境标识 (latest, staging, production)
```

**版本管理流程**:

```javascript
class ImageVersionManager {
  // 生成版本号
  generateVersion(changes, currentVersion) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    // 分析变更类型
    const hasBreakingChanges = changes.some(c => c.type === 'breaking');
    const hasNewFeatures = changes.some(c => c.type === 'feature');
    const hasBugFixes = changes.some(c => c.type === 'fix');

    if (hasBreakingChanges) {
      return `${major + 1}.0.0`;
    } else if (hasNewFeatures) {
      return `${major}.${minor + 1}.0`;
    } else if (hasBugFixes) {
      return `${major}.${minor}.${patch + 1}`;
    } else {
      return currentVersion; // 无需版本更新
    }
  }

  // 发布镜像
  async releaseImage(imageName, version, tags = []) {
    const fullImageName = `${imageName}:${version}`;

    // 推送主版本
    await docker.push(fullImageName);

    // 推送标签版本
    for (const tag of tags) {
      const taggedImage = `${imageName}:${tag}`;
      await docker.tag(fullImageName, taggedImage);
      await docker.push(taggedImage);
    }

    // 更新最新标签
    if (tags.includes('latest')) {
      await docker.tag(fullImageName, `${imageName}:latest`);
      await docker.push(`${imageName}:latest`);
    }

    // 记录发布信息
    await this.recordRelease(version, tags);
  }

  // 清理旧版本
  async cleanupOldVersions(imageName, keepVersions = 10) {
    const allTags = await this.listImageTags(imageName);
    const sortedVersions = this.sortVersions(allTags);

    const versionsToDelete = sortedVersions.slice(keepVersions);

    for (const version of versionsToDelete) {
      try {
        await docker.removeImage(`${imageName}:${version}`);
        console.log(`🗑️ Removed old image: ${imageName}:${version}`);
      } catch (error) {
        console.warn(`Failed to remove ${version}:`, error.message);
      }
    }
  }
}
```

#### 2.2 部署配置管理

**配置版本控制**:

```javascript
class DeploymentConfigManager {
  // 配置版本化
  async versionDeploymentConfig(config, environment) {
    const version = this.generateConfigVersion(config);
    const snapshot = {
      version,
      environment,
      config: deepClone(config),
      timestamp: new Date(),
      checksum: this.calculateConfigChecksum(config),
      author: this.getCurrentUser(),
    };

    await this.store.saveDeploymentVersion(snapshot);
    return version;
  }

  // 配置变更检测
  async detectConfigChanges(environment) {
    const currentConfig = await this.getCurrentDeploymentConfig(environment);
    const baselineConfig = await this.getBaselineConfig(environment);

    return this.compareConfigs(baselineConfig, currentConfig);
  }

  // 配置回滚
  async rollbackDeploymentConfig(environment, version) {
    const snapshot = await this.store.getDeploymentVersion(
      environment,
      version
    );

    // 验证配置
    await this.validateDeploymentConfig(snapshot.config);

    // 应用配置
    await this.applyDeploymentConfig(environment, snapshot.config);

    // 记录回滚
    await this.recordRollback(environment, version);
  }
}
```

### 3. 技术债务管理

#### 3.1 部署债务识别

**容器化债务**:

- [ ] 镜像大小超标
- [ ] 安全漏洞未修复
- [ ] 依赖包版本过旧
- [ ] 构建时间过长

**编排债务**:

- [ ] 配置复杂度过高
- [ ] 环境差异未隔离
- [ ] 扩展性设计不足
- [ ] 监控覆盖不全

#### 3.2 债务偿还计划

**优先级排序**:

1. **P0 (紧急)**: 影响部署稳定性的债务
2. **P1 (重要)**: 影响部署效率的债务
3. **P2 (一般)**: 影响代码可维护性的债务

**偿还策略**:

- [ ] 每个月度发布前偿还至少3个部署债务项
- [ ] 设立部署债务KPI指标 (每月减少15%)
- [ ] 定期部署债务评审会议

### 4. 文档维护

#### 4.1 部署文档体系

**文档结构**:

- [ ] **快速开始**: 5分钟本地部署指南
- [ ] **部署手册**: 详细部署配置说明
- [ ] **运维指南**: 日常运维和故障排除
- [ ] **最佳实践**: 部署优化和性能调优

**自动化文档生成**:

```javascript
class DeploymentDocumentationGenerator {
  // 生成部署指南
  async generateDeploymentGuide() {
    const environments = await this.getSupportedEnvironments();
    const guide = {
      introduction: 'Sira AI Gateway Deployment Guide',
      prerequisites: await this.generatePrerequisites(),
      environments: {},
      troubleshooting: await this.generateTroubleshooting(),
    };

    for (const env of environments) {
      guide.environments[env.name] = await this.generateEnvironmentGuide(env);
    }

    return guide;
  }

  // 生成环境特定指南
  async generateEnvironmentGuide(environment) {
    return {
      name: environment.name,
      description: environment.description,
      requirements: environment.requirements,
      steps: await this.generateDeploymentSteps(environment),
      configuration: await this.generateConfigurationGuide(environment),
      verification: await this.generateVerificationSteps(environment),
    };
  }

  // 生成故障排除指南
  async generateTroubleshooting() {
    const commonIssues = await this.getCommonDeploymentIssues();

    return commonIssues.map(issue => ({
      problem: issue.problem,
      symptoms: issue.symptoms,
      causes: issue.causes,
      solutions: issue.solutions,
      prevention: issue.prevention,
    }));
  }
}
```

---

## 📊 成功指标

### 1. 部署质量指标

#### 1.1 容器化指标

- [ ] **镜像大小**: < 200MB (运行时镜像)
- [ ] **构建时间**: < 5分钟 (CI环境)
- [ ] **启动时间**: < 30秒 (冷启动)
- [ ] **安全漏洞**: 0个高危漏洞

#### 1.2 编排指标

- [ ] **部署成功率**: > 99% (自动化部署)
- [ ] **服务可用性**: > 99.9% (生产环境)
- [ ] **扩缩容时间**: < 2分钟 (自动扩缩容)
- [ ] **配置一致性**: 100% (多环境配置)

### 2. 运维效率指标

#### 2.1 监控覆盖指标

- [ ] **容器监控**: 100% 容器资源监控
- [ ] **应用监控**: 100% 应用性能监控
- [ ] **告警响应**: < 5分钟 平均响应时间
- [ ] **问题定位**: < 15分钟 平均定位时间

#### 2.2 自动化程度指标

- [ ] **部署自动化**: 100% 生产部署自动化
- [ ] **回滚自动化**: 100% 故障回滚自动化
- [ ] **监控自动化**: 95% 异常检测自动化
- [ ] **维护自动化**: 90% 日常维护自动化

### 3. 成本效益指标

#### 3.1 资源利用指标

- [ ] **CPU利用率**: 60-80% (生产环境平均)
- [ ] **内存利用率**: 70-85% (生产环境平均)
- [ ] **存储利用率**: < 80% (长期存储)
- [ ] **网络利用率**: < 70% (峰值带宽)

#### 3.2 成本控制指标

- [ ] **部署成本**: < $0.1/小时 (基础配置)
- [ ] **运维成本**: < $0.05/小时 (自动化运维)
- [ ] **故障恢复成本**: < $100/次 (自动化恢复)
- [ ] **扩展成本**: 线性扩展 (资源使用线性增长)

---

## 🎯 总结

部署模块作为Sira AI网关的"基础设施引擎"，承担着容器化、编排部署、监控运维等关键职责。通过精心设计的Docker镜像策略、Kubernetes编排方案、监控运维体系，部署模块能够：

**技术优势**:

- 多阶段构建优化镜像大小和安全
- 灵活的编排方案支持多种部署环境
- 智能的弹性伸缩和自动运维
- 全面的可观测性和故障自愈

**业务价值**:

- 简化部署流程，提升交付效率
- 保障系统稳定性，确保高可用性
- 优化资源使用，控制运营成本
- 提供完整运维能力，支持快速故障恢复

**架构亮点**:

- 基础设施即代码实现自动化部署
- 配置漂移检测保障环境一致性
- 渐进式部署策略确保平滑升级
- 多层次监控实现全方位可观测

通过持续的技术创新和最佳实践应用，部署模块将成为现代化应用部署的标准解决方案，为团队提供稳定、高效、自动化的基础设施管理能力。
