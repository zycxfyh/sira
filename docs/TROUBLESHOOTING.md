# Sira 故障排除指南

## 📋 概述

这个指南帮助你诊断和解决Sira使用过程中遇到的问题。遇到问题时，请按以下步骤排查：

1. **检查日志** - 查看错误信息
2. **验证配置** - 确认环境变量和配置文件
3. **测试连接** - 检查服务连通性
4. **查看文档** - 参考相关文档

## 🚨 常见问题

### 启动失败

#### 问题：`npm install` 失败

**错误信息：**

```
npm ERR! code ENOTFOUND
npm ERR! errno ENOTFOUND
```

**解决方案：**

```bash
# 检查网络连接
ping registry.npmjs.org

# 清理npm缓存
npm cache clean --force

# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 重新安装
npm install
```

#### 问题：Docker容器无法启动

**错误信息：**

```
ERROR: Couldn't connect to Docker daemon
```

**解决方案：**

```bash
# 启动Docker服务
sudo systemctl start docker  # Linux
# 或在Windows/Mac上启动Docker Desktop

# 检查Docker状态
docker --version
docker-compose --version
```

### 配置问题

#### 问题：环境变量未设置

**错误信息：**

```
Error: OPENAI_API_KEY is not set
```

**解决方案：**

```bash
# 创建环境变量文件
cp env.template .env

# 编辑环境变量
nano .env

# 确保包含必要变量：
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GATEWAY_API_KEY=your_gateway_key
```

#### 问题：Redis连接失败

**错误信息：**

```
Error: Redis connection failed
```

**解决方案：**

```bash
# 检查Redis服务状态
docker-compose ps redis

# 查看Redis日志
docker-compose logs redis

# 测试Redis连接
docker-compose exec redis redis-cli ping
```

### AI服务问题

#### 问题：AI API调用失败

**错误信息：**

```
Error: 401 Unauthorized - Invalid API key
```

**解决方案：**

```bash
# 检查API密钥格式
echo $OPENAI_API_KEY | head -c 10  # 应该以sk-开头

# 验证密钥权限
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

#### 问题：配额超限

**错误信息：**

```
Error: 429 Too Many Requests
```

**解决方案：**

- 检查API使用量：https://platform.openai.com/usage
- 降低请求频率
- 考虑升级API计划
- 使用缓存减少重复请求

#### 问题：模型不可用

**错误信息：**

```
Error: Model not found
```

**解决方案：**

```bash
# 检查支持的模型
curl http://localhost:8080/api/v1/ai/models \
  -H "x-api-key: your_gateway_key"

# 更新到支持的模型名称
# gpt-4 → gpt-4-turbo (如果gpt-4不可用)
```

### 网关问题

#### 问题：无法访问网关

**错误信息：**

```
Connection refused
```

**解决方案：**

```bash
# 检查网关状态
docker-compose ps ai-gateway

# 查看网关日志
docker-compose logs ai-gateway

# 测试健康检查
curl http://localhost:8080/health
```

#### 问题：Kong配置错误

**错误信息：**

```
Policy configuration invalid
```

**解决方案：**

```bash
# 验证Kong配置
docker-compose exec kong kong config db_import /kong.yml

# 检查Kong日志
docker-compose logs kong

# 重新加载配置
docker-compose restart kong
```

### 监控问题

#### 问题：Prometheus指标缺失

**错误信息：**

```
No metrics found
```

**解决方案：**

```bash
# 检查Prometheus配置
docker-compose exec prometheus cat /etc/prometheus/prometheus.yml

# 验证目标状态
curl http://localhost:9090/api/v1/targets

# 重启Prometheus
docker-compose restart prometheus
```

#### 问题：Grafana无法连接

**解决方案：**

```bash
# 检查Grafana状态
docker-compose ps grafana

# 查看Grafana日志
docker-compose logs grafana

# 默认凭据：admin/admin123
```

### 性能问题

#### 问题：响应时间过长

**排查步骤：**

```bash
# 检查AI服务响应时间
curl -w "@curl-format.txt" http://localhost:8080/api/v1/ai/chat/completions \
  -H "x-api-key: your_key" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}'

# 查看缓存命中率
curl http://localhost:9090/api/v1/query?query=ai_gateway_cache_hit_ratio

# 检查系统资源
docker stats
```

#### 问题：内存使用过高

**解决方案：**

```bash
# 检查Node.js内存使用
docker-compose exec ai-gateway ps aux

# 调整Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
```

### 网络问题

#### 问题：容器间网络不通

**解决方案：**

```bash
# 检查网络状态
docker network ls
docker network inspect ai-gateway_default

# 重启网络
docker-compose down
docker-compose up -d
```

#### 问题：外部访问失败

**解决方案：**

```bash
# 检查端口映射
docker-compose ps

# 验证防火墙设置
sudo ufw status  # Linux
# 或检查Windows防火墙
```

## 🛠️ 调试工具

### 日志收集

```bash
# 收集所有服务日志
docker-compose logs > debug-logs.txt

# 实时监控日志
docker-compose logs -f ai-gateway

# 按时间过滤日志
docker-compose logs --since "1h" kong
```

### 配置验证

```bash
# 验证package.json
npm audit --audit-level=moderate

# 检查环境变量
env | grep -E "(OPENAI|ANTHROPIC|GATEWAY)"

# 验证Docker配置
docker-compose config
```

### 网络诊断

```bash
# 测试服务连通性
curl -v http://localhost:8080/health

# DNS解析测试
nslookup api.openai.com

# 网络延迟测试
ping -c 4 api.openai.com
```

## 📞 获取帮助

### 快速自查清单

- [ ] 环境变量是否正确设置
- [ ] Docker服务是否正常运行
- [ ] 网络连接是否正常
- [ ] API密钥是否有效
- [ ] 日志中是否有错误信息

### 联系支持

如果以上方法都无法解决问题：

1. **收集诊断信息**：

   ```bash
   # 系统信息
   uname -a
   docker --version
   node --version

   # 服务状态
   docker-compose ps
   docker stats

   # 完整日志
   docker-compose logs > full-logs.txt
   ```

2. **提交Issue**：在GitHub项目中详细描述问题
3. **联系维护者**：
   - 📧 邮箱: 1666384464@qq.com
   - 📱 电话: 17855398215

## 🚀 预防措施

### 定期维护

1. **更新依赖**：`npm audit fix`
2. **监控资源**：`docker stats`
3. **备份配置**：定期备份重要配置
4. **日志轮转**：防止日志文件过大

### 最佳实践

1. **使用环境隔离**：开发/测试/生产环境分离
2. **设置监控告警**：及时发现问题
3. **定期重启**：清理内存和缓存
4. **备份策略**：重要数据定期备份

---

**记住**：大多数问题都有解决方案，多查看日志是解决问题的关键！

📝 _最后更新: 2025年11月7日_
