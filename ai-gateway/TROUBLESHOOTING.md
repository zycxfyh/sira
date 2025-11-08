# 🔧 Sira AI Gateway - 故障排除指南

<div align="center">

## 🚨 问题排查与修复指南

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?style=for-the-badge&logo=kubernetes)](https://kubernetes.io/)

*基于实际项目经验总结的完整故障排除指南*

[快速诊断](#-快速诊断) • [启动问题](#-启动问题) • [运行时错误](#-运行时错误) • [性能问题](#-性能问题) • [网络问题](#-网络问题) • [数据问题](#-数据问题)

---

</div>

## 📋 目录

- [🔧 Sira AI Gateway - 故障排除指南](#-sira-ai-gateway---故障排除指南)
  - [🎯 排查原则](#-排查原则)
  - [⚡ 快速诊断](#-快速诊断)
  - [🚀 启动问题](#-启动问题)
  - [🔄 运行时错误](#-运行时错误)
  - [📊 性能问题](#-性能问题)
  - [🌐 网络问题](#-网络问题)
  - [💾 数据问题](#-数据问题)
  - [🔒 安全问题](#-安全问题)
  - [🐳 容器化问题](#-容器化问题)
  - [☸️ Kubernetes问题](#-kubernetes问题)
  - [📈 监控调试](#-监控调试)
  - [🆘 紧急情况](#-紧急情况)
  - [🛠️ 调试工具](#-调试工具)
  - [📞 获取帮助](#-获取帮助)

---

## 🎯 排查原则

### 分层诊断法

```
问题定位遵循以下优先级：
1. 🔍 观察现象 (What) - 问题表现
2. 📊 收集数据 (How) - 监控指标、日志
3. 🔍 分析根本原因 (Why) - 深入分析
4. 💡 制定解决方案 (Solution) - 修复方案
5. ✅ 验证修复效果 (Verify) - 确认解决
6. 📝 总结经验教训 (Document) - 记录避免复发
```

### 诊断工具链

| 工具 | 用途 | 使用频率 |
|------|------|----------|
| `kubectl logs` | 容器日志查看 | ⭐⭐⭐⭐⭐ |
| `curl` | API连通性测试 | ⭐⭐⭐⭐⭐ |
| `top/htop` | 系统资源监控 | ⭐⭐⭐⭐ |
| `netstat/ss` | 网络连接诊断 | ⭐⭐⭐⭐ |
| `journalctl` | 系统日志分析 | ⭐⭐⭐⭐ |
| `tcpdump` | 网络包抓取 | ⭐⭐⭐⭐ |

---

## ⚡ 快速诊断

### 一键诊断脚本

```bash
#!/bin/bash
# diagnose.sh - Sira Gateway快速诊断脚本

echo "🔍 开始Sira Gateway诊断..."

# 1. 检查服务状态
echo "📊 检查服务状态..."
kubectl get pods -l app=sira-gateway
kubectl get svc -l app=sira-gateway

# 2. 检查端口监听
echo "🔌 检查端口监听..."
netstat -tlnp | grep -E ":8080|:9876"

# 3. 检查健康状态
echo "🏥 检查健康状态..."
curl -s -w "HTTP %{http_code}\n" http://localhost:8080/health
curl -s -w "HTTP %{http_code}\n" http://localhost:9876/health

# 4. 检查关键指标
echo "📈 检查关键指标..."
kubectl exec -it $(kubectl get pods -l app=sira-gateway -o jsonpath='{.items[0].metadata.name}') -- \
  curl -s http://localhost:8080/metrics | grep -E "(ai_requests_total|ai_request_duration)"

# 5. 检查错误日志
echo "📋 检查错误日志..."
kubectl logs -l app=sira-gateway --tail=50 | grep -i error

echo "✅ 诊断完成"
```

### 健康检查清单

```bash
# 基础健康检查
curl -f http://localhost:8080/health || echo "❌ 网关健康检查失败"
curl -f http://localhost:9876/health || echo "❌ 管理接口健康检查失败"

# 数据库连接检查
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;" || echo "❌ 数据库连接失败"

# Redis连接检查
redis-cli -h $REDIS_HOST -p $REDIS_PORT PING | grep PONG || echo "❌ Redis连接失败"

# AI提供商连通性检查
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models | jq '.object' || echo "❌ OpenAI API连接失败"
```

---

## 🚀 启动问题

### 常见启动失败场景

#### 1. 端口被占用

**现象**: `Error: listen EADDRINUSE: address already in use :::8080`

**诊断**:
```bash
# 查找占用进程
lsof -i :8080
netstat -tlnp | grep :8080

# Windows环境下
netstat -ano | findstr :8080

# 强制终止进程 (Linux)
sudo kill -9 $(lsof -ti :8080)

# Windows环境下
taskkill /PID <PID> /F
```

**解决方案**:
```bash
# 修改端口配置
export EG_HTTP_PORT=8081
export EG_ADMIN_PORT=9877

# 或修改配置文件
# config/gateway.config.yml
http:
  port: ${EG_HTTP_PORT:-8081}
admin:
  port: ${EG_ADMIN_PORT:-9877}
```

#### 2. 依赖缺失

**现象**: `Error: Cannot find module 'multer'`

**诊断**:
```bash
# 检查node_modules
ls -la node_modules/multer

# 检查package.json
grep multer package.json

# 检查npm缓存
npm cache verify
```

**解决方案**:
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 或安装特定依赖
npm install multer --save

# 如果是权限问题
sudo npm install multer --unsafe-perm=true
```

#### 3. 配置文件错误

**现象**: `YAMLException: bad indentation of a mapping entry`

**诊断**:
```bash
# 验证YAML语法
npm install -g js-yaml
js-yaml config/gateway.config.yml

# 检查缩进
cat -n config/gateway.config.yml | grep -E "^[[:space:]]*[^[:space:]#]"
```

**解决方案**:
```yaml
# 正确的YAML缩进
http:
  port: 8080          # 正确：2个空格
  hostname: localhost # 正确：2个空格

admin:
  port: 9876          # 正确：2个空格
  host: localhost     # 正确：2个空格

# 错误的缩进 (会导致解析失败)
http:
port: 8080          # 错误：没有缩进
  hostname: localhost # 错误：不一致的缩进
```

#### 4. 数据库连接失败

**现象**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**诊断**:
```bash
# 检查数据库服务状态
systemctl status postgresql
# 或
sudo service postgresql status

# 检查端口监听
netstat -tlnp | grep :5432

# 测试连接
psql -h localhost -U sira -d sira_db -c "SELECT version();"
```

**解决方案**:
```bash
# 启动PostgreSQL服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 或使用Docker
docker run -d --name postgres \
  -e POSTGRES_DB=sira_db \
  -e POSTGRES_USER=sira \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:15

# 检查连接配置
export DATABASE_URL=postgresql://sira:password@localhost:5432/sira_db
```

---

## 🔄 运行时错误

### AI路由相关错误

#### 1. 提供商连接超时

**现象**: `Provider connection timeout`

**诊断**:
```bash
# 检查网络连接
ping api.openai.com

# 测试API密钥
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.openai.com/v1/models

# 检查代理设置
curl --proxy $http_proxy https://api.openai.com/v1/models
```

**解决方案**:
```javascript
// 调整超时配置
const providerConfig = {
  openai: {
    timeout: 60000,        // 增加超时时间
    retryAttempts: 3,      // 增加重试次数
    retryDelay: 1000       // 重试间隔
  }
}

// 更新配置
curl -X PUT http://localhost:9876/config/ai-providers \
  -H "Content-Type: application/json" \
  -d '{"openai": {"timeout": 60000, "retryAttempts": 3}}'
```

#### 2. API密钥无效

**现象**: `Error: 401 Unauthorized`

**诊断**:
```bash
# 检查环境变量
echo $OPENAI_API_KEY | head -c 10 && echo "..."

# 测试密钥有效性
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models | jq '.error'

# 检查密钥格式
echo $OPENAI_API_KEY | grep -E "^sk-" || echo "❌ 密钥格式错误"
```

**解决方案**:
```bash
# 更新API密钥
export OPENAI_API_KEY=sk-your-new-key-here

# 重启服务
kubectl rollout restart deployment/sira-gateway

# 或动态更新
curl -X PUT http://localhost:9876/config/secrets \
  -H "Content-Type: application/json" \
  -d '{"openai": {"apiKey": "sk-new-key"}}'
```

#### 3. 配额超限

**现象**: `Error: 429 Too Many Requests`

**诊断**:
```bash
# 检查当前使用情况
curl http://localhost:9876/metrics | grep ai_requests_total

# 查看配额限制
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/dashboard/billing/usage

# 检查速率限制配置
curl http://localhost:9876/config | jq '.policies.rateLimit'
```

**解决方案**:
```javascript
// 实施请求队列
const queue = new Queue({
  concurrency: 10,        // 限制并发数
  timeout: 30000,         // 请求超时
  throwOnTimeout: false   // 超时不抛出错误
});

// 智能路由到其他提供商
const fallbackProviders = ['anthropic', 'google', 'azure'];

// 实施缓存
const cache = new NodeCache({
  stdTTL: 3600,           // 1小时TTL
  checkperiod: 600        // 10分钟检查过期
});
```

### Express.js 相关错误

#### 1. 中间件错误

**现象**: `TypeError: Cannot read properties of undefined (reading 'get')`

**诊断**:
```bash
# 查看完整错误堆栈
kubectl logs -f deployment/sira-gateway

# 检查中间件顺序
cat lib/rest/index.js | grep -A5 -B5 "app.use"

# 验证路由定义
grep -r "router.get.*analytics" lib/rest/routes/
```

**解决方案**:
```javascript
// 检查路由定义顺序
app.use('/api', apiRoutes)      // API路由优先
app.use('/admin', adminRoutes)  // 管理路由
app.use('/', webRoutes)         // Web路由最后

// 添加错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
})
```

#### 2. 内存泄漏

**现象**: 内存使用持续增长，服务响应变慢

**诊断**:
```bash
# 监控内存使用
top -p $(pgrep node) -d 5

# Node.js内存分析
kubectl exec -it deployment/sira-gateway -- node --inspect --max-old-space-size=4096

# 检查堆快照
curl http://localhost:8080/debug/heapdump > heap.heapsnapshot

# 分析事件循环
curl http://localhost:8080/debug/event-loop
```

**解决方案**:
```javascript
// 实施内存监控
const memwatch = require('memwatch-next')

memwatch.on('leak', (info) => {
  console.error('Memory leak detected:', info)
  // 触发告警
  alertSystem.send('Memory Leak Alert', info)
})

// 定期垃圾回收
if (global.gc) {
  setInterval(() => {
    global.gc()
    console.log('Manual GC completed')
  }, 300000) // 5分钟
}

// 连接池限制
const pool = new Pool({
  max: 10,                // 最大连接数
  min: 2,                 // 最小连接数
  idleTimeoutMillis: 30000, // 空闲超时
  connectionTimeoutMillis: 2000
})
```

---

## 📊 性能问题

### 响应时间过长

#### 诊断步骤

```bash
# 1. 端到端响应时间测试
time curl http://localhost:8080/api/v1/ai/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# 2. 分段时间分析
curl -w "@curl-format.txt" http://localhost:8080/api/v1/ai/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# curl-format.txt
# time_namelookup: %{time_namelookup}\n
# time_connect: %{time_connect}\n
# time_appconnect: %{time_appconnect}\n
# time_pretransfer: %{time_pretransfer}\n
# time_redirect: %{time_redirect}\n
# time_starttransfer: %{time_starttransfer}\n
# time_total: %{time_total}\n
```

#### 性能瓶颈识别

```bash
# 检查数据库查询性能
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
EXPLAIN ANALYZE
SELECT * FROM ai_requests
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 100;
"

# 检查Redis性能
redis-cli --latency

# 检查网络延迟
ping api.openai.com -c 10

# 检查CPU密集型操作
kubectl exec -it deployment/sira-gateway -- top -H
```

#### 优化方案

```javascript
// 1. 实施缓存策略
const cacheStrategy = {
  l1: { ttl: 300, maxSize: 1000 },    // 内存缓存
  l2: { ttl: 3600, prefix: 'sira:' }, // Redis缓存
  l3: { ttl: 86400, compression: true } // 数据库缓存
}

// 2. 连接池优化
const optimizedPool = new Pool({
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  acquireTimeoutMillis: 60000
})

// 3. 异步处理优化
const asyncOptimizer = {
  concurrency: 10,         // 限制并发数
  timeout: 30000,          // 请求超时
  retryAttempts: 3,        // 重试次数
  circuitBreaker: {        // 熔断器
    failureThreshold: 5,
    recoveryTimeout: 60000
  }
}

// 4. 数据库查询优化
const queryOptimizer = {
  indexes: [
    'CREATE INDEX CONCURRENTLY idx_ai_requests_user_timestamp ON ai_requests (user_id, created_at DESC)',
    'CREATE INDEX CONCURRENTLY idx_ai_requests_provider_status ON ai_requests (provider, status)'
  ],
  partitioning: {
    table: 'ai_requests',
    partitionBy: 'RANGE (created_at)',
    interval: '1 month'
  }
}
```

### 高CPU使用率

**诊断**:
```bash
# 查找高CPU进程
ps aux --sort=-%cpu | head -10

# 分析Node.js CPU使用
kubectl exec -it deployment/sira-gateway -- node --prof app.js

# 生成火焰图
npx 0x app.js --output flamegraph.html

# 检查事件循环阻塞
curl http://localhost:8080/debug/event-loop
```

**解决方案**:
```javascript
// 实施CPU监控
const cpuMonitor = {
  threshold: 80,           // CPU阈值
  interval: 60000,         // 检查间隔
  alert: function(usage) {
    console.error(`High CPU usage: ${usage}%`)
    // 触发扩容
    autoScaler.scaleUp()
  }
}

// 优化计算密集型操作
const computeOptimizer = {
  // 使用Worker Threads处理CPU密集任务
  workerPool: new WorkerPool('./cpu-worker.js', {
    maxWorkers: 4,
    resourceLimits: {
      maxOldGenerationSizeMb: 512,
      maxYoungGenerationSizeMb: 256
    }
  }),

  // 实施任务队列
  taskQueue: new Queue({
    concurrency: 2,        // 限制并发
    timeout: 300000,       // 5分钟超时
    removeOnFail: true     // 失败自动移除
  })
}
```

---

## 🌐 网络问题

### 连接超时

#### 客户端连接超时

**现象**: `ECONNREFUSED` 或 `ETIMEDOUT`

**诊断**:
```bash
# 检查服务端口
netstat -tlnp | grep -E ":8080|:9876"

# 测试本地连接
curl -v http://localhost:8080/health

# 检查防火墙
sudo ufw status
sudo iptables -L

# 检查SELinux (RHEL/CentOS)
sestatus
sudo setenforce 0  # 临时禁用测试
```

**解决方案**:
```bash
# 开放端口
sudo ufw allow 8080/tcp
sudo ufw allow 9876/tcp

# 或iptables规则
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 9876 -j ACCEPT

# 检查服务绑定地址
# config/gateway.config.yml
http:
  hostname: 0.0.0.0    # 绑定所有接口
  port: 8080

admin:
  host: 0.0.0.0        # 绑定所有接口
  port: 9876
```

#### 外部API连接问题

**现象**: AI提供商连接失败

**诊断**:
```bash
# DNS解析测试
nslookup api.openai.com

# 路由测试
traceroute api.openai.com

# 证书验证
openssl s_client -connect api.openai.com:443 -servername api.openai.com

# 代理设置检查
env | grep -i proxy
curl --proxy $http_proxy https://api.openai.com/v1/models
```

**解决方案**:
```bash
# 配置代理 (如果需要)
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# 跳过SSL验证 (仅测试环境)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# 配置DNS服务器
echo "nameserver 8.8.8.8" >> /etc/resolv.conf

# 更新CA证书
sudo apt-get update && sudo apt-get install ca-certificates
```

### 负载均衡问题

**诊断**:
```bash
# 检查负载均衡器状态
curl -H "User-Agent: HealthCheck" http://loadbalancer/health

# 检查后端服务状态
curl http://localhost:8080/health
curl http://localhost:8081/health

# 查看连接分布
kubectl get endpoints
kubectl describe service sira-gateway
```

**解决方案**:
```yaml
# Nginx负载均衡配置优化
upstream sira_gateway {
    least_conn;                    # 最小连接算法
    server gateway-1:8080 weight=3 max_fails=3 fail_timeout=30s;
    server gateway-2:8080 weight=3 max_fails=3 fail_timeout=30s;
    server gateway-3:8080 weight=2 max_fails=3 fail_timeout=30s;
    server gateway-4:8080 weight=1 backup;  # 备用服务器
    keepalive 32;                 # 保持连接
}

server {
    listen 80;
    server_name api.sira-ai.com;

    location / {
        proxy_pass http://sira_gateway;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时配置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # 缓冲区配置
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
}
```

---

## 💾 数据问题

### 数据库连接池耗尽

**现象**: `timeout exceeded when trying to connect`

**诊断**:
```bash
# 检查连接池状态
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';
"

# 查看连接池配置
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SHOW max_connections;
SHOW shared_preload_libraries;
"

# 检查慢查询
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC
LIMIT 5;
"
```

**解决方案**:
```javascript
// 优化连接池配置
const optimizedPool = new Pool({
  max: 20,                        // 最大连接数
  min: 5,                         // 最小连接数
  idleTimeoutMillis: 30000,       // 空闲超时
  connectionTimeoutMillis: 2000,  // 连接超时
  acquireTimeoutMillis: 60000,    // 获取连接超时
  reapIntervalMillis: 1000,       // 清理间隔
  createRetryIntervalMillis: 200, // 重试间隔

  // 健康检查
  healthCheck: true,
  healthCheckInterval: 30000,

  // 连接验证
  allowExitOnIdle: true,
  evict: (client, done) => {
    client.query('SELECT 1', (err) => {
      done(err, !err)
    })
  }
})

// 连接泄漏检测
pool.on('connect', (client) => {
  console.log(`New client connected: ${client.processID}`)
})

pool.on('error', (err, client) => {
  console.error('Database pool error:', err)
  // 自动重连逻辑
  setTimeout(() => {
    pool.connect()
  }, 5000)
})
```

### Redis 连接问题

**现象**: `Redis connection timeout` 或 `MaxRetriesPerRequestError`

**诊断**:
```bash
# 检查Redis状态
redis-cli ping

# 查看连接信息
redis-cli info clients

# 检查内存使用
redis-cli info memory

# 查看慢查询
redis-cli slowlog get 10

# 网络连通性测试
telnet $REDIS_HOST $REDIS_PORT
```

**解决方案**:
```javascript
// Redis连接优化
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,

  // 连接选项
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('Redis server refused connection')
      return new Error('Redis server unavailable')
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      console.error('Redis retry time exhausted')
      return new Error('Retry time exhausted')
    }
    if (options.attempt > 10) {
      console.error('Redis retry attempts exhausted')
      return undefined
    }
    // 指数退避重试
    return Math.min(options.attempt * 100, 3000)
  },

  // 连接池
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: true,
  connectTimeout: 60000,

  // 集群支持 (如果使用Redis Cluster)
  cluster: {
    enableReadyCheck: false,
    redisOptions: {
      password: process.env.REDIS_PASSWORD
    }
  }
})

// 连接事件监听
redisClient.on('connect', () => console.log('Redis connected'))
redisClient.on('ready', () => console.log('Redis ready'))
redisClient.on('error', (err) => console.error('Redis error:', err))
redisClient.on('close', () => console.warn('Redis connection closed'))
redisClient.on('reconnecting', () => console.log('Redis reconnecting'))
```

---

## 🔒 安全问题

### API密钥泄露

**诊断**:
```bash
# 检查日志中的敏感信息
grep -r "sk-" logs/ | head -5

# 检查环境变量泄露
env | grep -E "(key|token|secret)" | head -5

# 检查配置文件权限
ls -la config/

# 检查网络传输
tcpdump -i any port 8080 -A | grep -i authorization
```

**解决方案**:
```bash
# 轮换API密钥
curl -X POST http://localhost:9876/api-keys/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"provider": "openai"}'

# 更新环境变量
export OPENAI_API_KEY=sk-new-key-here

# 重启服务
kubectl rollout restart deployment/sira-gateway

# 清理日志文件
find logs/ -name "*.log" -exec sed -i '/sk-/d' {} \;
```

### 权限提升攻击

**诊断**:
```bash
# 检查访问日志
grep "403\|401" logs/access.log | tail -10

# 验证JWT令牌
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:9876/debug/jwt

# 检查速率限制
curl http://localhost:9876/metrics | grep rate_limit
```

**解决方案**:
```javascript
// 实施多层安全防护
const securityLayers = {
  // API网关层
  gateway: {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"]
        }
      }
    }
  },

  // 认证授权层
  auth: {
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h',
      issuer: 'sira-gateway',
      algorithms: ['HS256', 'RS256']
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,                  // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    }
  },

  // 数据验证层
  validation: {
    sanitize: (input) => {
      return sanitizeHtml(input, {
        allowedTags: [],
        allowedAttributes: {}
      })
    },
    validate: (schema) => {
      return joi.object(schema).validate(data)
    }
  }
}
```

---

## 🐳 容器化问题

### Docker 构建失败

**诊断**:
```bash
# 检查Dockerfile语法
docker build --no-cache -t sira-test .

# 查看构建日志
docker build -t sira-test . 2>&1 | tee build.log

# 检查基础镜像
docker pull node:18-alpine
docker run --rm node:18-alpine node --version
```

**解决方案**:
```dockerfile
# 优化Dockerfile
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev \
    postgresql-dev

# 复制package文件
COPY package*.json ./

# 安装依赖 (生产环境)
RUN npm ci --only=production --no-audit --no-fund

# 复制源代码
COPY . .

# 构建阶段
FROM node:18-alpine AS production

# 设置工作目录
WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sira -u 1001

# 复制构建产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/config ./config
COPY --from=builder /app/package*.json ./

# 更改文件权限
RUN chown -R sira:nodejs /app
USER sira

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# 暴露端口
EXPOSE 8080 9876

# 启动命令
CMD ["node", "lib/index.js"]
```

### 容器资源不足

**诊断**:
```bash
# 检查容器资源使用
docker stats

# 查看容器日志
docker logs sira-gateway

# 检查OOM事件
dmesg | grep -i oom
journalctl | grep -i oom
```

**解决方案**:
```yaml
# Kubernetes资源限制
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sira-gateway
spec:
  template:
    spec:
      containers:
      - name: gateway
        image: sira/ai-gateway:latest
        resources:
          requests:
            cpu: 500m      # 保证可用CPU
            memory: 1Gi    # 保证可用内存
          limits:
            cpu: 2000m     # 最大CPU限制
            memory: 4Gi    # 最大内存限制
        env:
        - name: NODE_OPTIONS
          value: "--max-old-space-size=3072"  # 限制堆内存

# Docker Compose资源配置
version: '3.8'
services:
  sira-gateway:
    image: sira/ai-gateway:latest
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G
```

---

## ☸️ Kubernetes问题

### Pod 启动失败

**诊断**:
```bash
# 查看Pod状态
kubectl get pods -l app=sira-gateway

# 查看详细状态
kubectl describe pod sira-gateway-xxx

# 查看日志
kubectl logs sira-gateway-xxx --previous

# 检查事件
kubectl get events --sort-by=.metadata.creationTimestamp
```

**解决方案**:
```yaml
# 优化Pod配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sira-gateway
spec:
  template:
    spec:
      # 启动探针
      readinessProbe:
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3

      # 存活探针
      livenessProbe:
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 30
        periodSeconds: 30
        timeoutSeconds: 5
        failureThreshold: 3

      # 优雅关闭
      terminationGracePeriodSeconds: 30

      # 安全上下文
      securityContext:
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
        runAsNonRoot: true

      # 容器安全
      containers:
      - name: gateway
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
```

### 服务发现问题

**诊断**:
```bash
# 检查服务状态
kubectl get svc sira-gateway

# 检查端点
kubectl get endpoints sira-gateway

# 测试服务发现
kubectl run test-pod --image=busybox --rm -it -- \
  nslookup sira-gateway.default.svc.cluster.local

# 检查DNS配置
kubectl get configmap coredns -n kube-system -o yaml
```

**解决方案**:
```yaml
# 服务配置优化
apiVersion: v1
kind: Service
metadata:
  name: sira-gateway
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: 'true'
spec:
  type: LoadBalancer
  selector:
    app: sira-gateway
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP
  - name: admin
    port: 9876
    targetPort: 9876
    protocol: TCP

# 网络策略
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sira-gateway-policy
spec:
  podSelector:
    matchLabels:
      app: sira-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
```

---

## 📈 监控调试

### 自定义指标收集

```javascript
// 应用级指标
const appMetrics = {
  // 请求指标
  requestCounter: new promClient.Counter({
    name: 'sira_requests_total',
    help: 'Total number of requests',
    labelNames: ['method', 'route', 'status']
  }),

  // 响应时间直方图
  responseTimeHistogram: new promClient.Histogram({
    name: 'sira_request_duration_seconds',
    help: 'Request duration in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  }),

  // 活跃连接数
  activeConnections: new promClient.Gauge({
    name: 'sira_active_connections',
    help: 'Number of active connections'
  }),

  // AI提供商指标
  aiProviderMetrics: {
    requests: new promClient.Counter({
      name: 'sira_ai_provider_requests_total',
      help: 'AI provider requests',
      labelNames: ['provider', 'model', 'status']
    }),
    cost: new promClient.Counter({
      name: 'sira_ai_cost_total',
      help: 'Total AI API cost',
      labelNames: ['provider', 'currency']
    })
  }
}

// 中间件收集指标
app.use((req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000

    appMetrics.requestCounter
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .inc()

    appMetrics.responseTimeHistogram
      .labels(req.method, req.route?.path || req.path)
      .observe(duration)
  })

  next()
})
```

### 分布式追踪

```javascript
// OpenTelemetry配置
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node')
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger')
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base')

const provider = new NodeTracerProvider()
const exporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces'
})

provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
provider.register()

// 追踪中间件
const tracingMiddleware = (req, res, next) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.user_agent': req.get('User-Agent'),
      'user.id': req.user?.id
    }
  })

  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode)
    span.end()
  })

  req.span = span
  next()
}
```

---

## 🆘 紧急情况

### 生产环境宕机

**立即响应流程**:

```bash
# 1. 确认问题严重性
curl -f http://gateway.company.com/health || echo "❌ 服务不可用"

# 2. 通知相关团队
# Slack通知
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-type: application/json' \
  -d '{"text":"🚨 生产环境告警: Sira Gateway服务不可用"}'

# 邮件通知
sendmail -t <<EOF
To: ops@company.com
Subject: 🚨 紧急: Sira Gateway生产环境宕机

服务已在 $(date) 完全不可用，请立即处理。
EOF

# 3. 激活备用系统
kubectl scale deployment sira-gateway-backup --replicas=10

# 4. DNS切换
# 更新DNS记录指向备用集群
echo "切换到备用集群IP: 10.0.0.100"

# 5. 启动应急响应
echo "🆘 启动应急响应流程"
./scripts/emergency-response.sh
```

### 数据丢失应急

```bash
# 1. 停止服务防止数据污染
kubectl scale deployment sira-gateway --replicas=0

# 2. 评估数据丢失范围
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 3. 从备份恢复
./scripts/disaster-recovery.sh restore latest

# 4. 验证数据完整性
./scripts/data-integrity-check.sh

# 5. 逐步恢复服务
kubectl scale deployment sira-gateway --replicas=1
# 等待验证...
kubectl scale deployment sira-gateway --replicas=3
kubectl scale deployment sira-gateway --replicas=10
```

---

## 🛠️ 调试工具

### Node.js 调试

```bash
# 启用调试模式
node --inspect lib/index.js

# 远程调试
node --inspect=0.0.0.0:9229 lib/index.js

# 调试子进程
node --inspect-brk lib/index.js

# 使用Chrome DevTools
# 访问 chrome://inspect
```

### 性能分析

```bash
# CPU性能分析
node --prof lib/index.js
node --prof-process isolate-*.log > processed.txt

# 内存分析
node --inspect --max-old-space-size=4096 lib/index.js
# 在Chrome DevTools中查看内存使用

# 堆快照
kill -USR2 $PID  # 生成堆快照
```

### 网络调试

```bash
# HTTP请求调试
curl -v http://localhost:8080/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# TCP连接调试
telnet localhost 8080
GET /health HTTP/1.1
Host: localhost
Connection: close

# 网络包分析
tcpdump -i any port 8080 -w capture.pcap
wireshark capture.pcap
```

### 日志分析工具

```bash
# 使用jq分析JSON日志
cat logs/application.log | jq 'select(.level == "error") | .message'

# 时间范围过滤
cat logs/application.log | jq 'select(.timestamp | fromdateiso8601 > now - 3600)'

# 错误统计
cat logs/application.log | jq -r '.level' | sort | uniq -c

# 用户请求模式分析
cat logs/access.log | awk '{print $1, $7}' | sort | uniq -c | sort -nr | head -10
```

---

## 📞 获取帮助

### 社区支持

- 📚 **官方文档**: https://docs.sira-ai.com
- 💬 **GitHub Discussions**: 讨论问题和最佳实践
- 🐛 **GitHub Issues**: 报告bug和功能请求
- 📧 **邮件列表**: dev@sira-ai.com

### 企业支持

- 🏢 **企业版支持**: enterprise@sira-ai.com
- 📞 **电话支持**: +86-400-123-4567 (7×24小时)
- 💼 **技术顾问**: 提供现场技术支持

### 诊断信息收集

```bash
# 生成完整的诊断报告
./scripts/generate-diagnostic-report.sh

# 包含的信息：
# - 系统信息 (uname -a, df -h, free -h)
# - 服务状态 (systemctl status, docker ps)
# - 应用日志 (tail -100 logs/*.log)
# - 配置信息 (关键配置的匿名版本)
# - 网络状态 (netstat -tlnp, traceroute)
# - 性能指标 (top, iostat, iotop)
```

---

<div align="center">

## 🔧 快速修复清单

| 问题类型 | 快速诊断命令 | 常见解决方案 |
|---------|-------------|-------------|
| 启动失败 | `node lib/index.js 2>&1 \| head -20` | 检查依赖、端口、配置 |
| 连接超时 | `curl -v http://localhost:8080/health` | 检查网络、防火墙、DNS |
| 性能问题 | `top -p \$(pgrep node)` | 优化缓存、连接池、查询 |
| 内存泄漏 | `node --inspect --max-old-space-size=4096` | 检查事件监听器、缓存清理 |
| 数据库问题 | `psql -c "SELECT version();"` | 检查连接池、索引、查询优化 |

---

*最后更新: 2024年11月8日*

*版本: v2.0.0*

*基于实际项目经验编写*

</div>
