# 🎮 Sira AI Gateway - 演示指南

## 🚀 快速演示

### 在线演示
访问我们的在线演示站点体验Sira AI Gateway的功能：

🔗 **演示站点**: [https://sira-ai-gateway-demo.vercel.app](https://sira-ai-gateway-demo.vercel.app)

### 功能展示
- 🤖 **AI对话**: 体验多模型智能路由
- 📊 **实时监控**: 查看系统性能指标
- 🎛️ **管理面板**: 完整的后台管理功能
- 🌐 **多语言支持**: 切换不同语言界面

## 🛠️ 本地演示设置

### 1. 环境准备
```bash
# 克隆项目
git clone https://github.com/your-repo/sira-ai-gateway.git
cd sira-ai-gateway

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置必要的API密钥
```

### 2. 启动演示服务
```bash
# 使用演示配置启动
npm run demo:start

# 服务将在 http://localhost:8080 启动
```

### 3. 访问演示
- **主应用**: http://localhost:8080
- **管理面板**: http://localhost:8080/admin
- **API文档**: http://localhost:8080/docs
- **性能监控**: http://localhost:8080/metrics

## 🎯 演示场景

### 场景1: 智能路由演示
1. 打开主页面
2. 发送一个复杂的技术问题
3. 观察路由决策和响应时间
4. 查看管理面板中的路由统计

### 场景2: 多语言支持演示
1. 访问管理面板
2. 切换不同的语言选项
3. 观察界面和API响应的语言变化

### 场景3: 性能监控演示
1. 使用压力测试工具发送大量请求
2. 实时查看系统性能指标
3. 观察缓存命中率和响应时间变化

### 场景4: 故障恢复演示
1. 手动停止一个AI服务提供商
2. 发送请求观察自动故障转移
3. 查看熔断器状态和恢复过程

## 📱 移动端演示

### 响应式设计
Sira的管理面板完全支持移动设备访问：
- 📱 iOS Safari
- 📱 Android Chrome
- 📱 微信浏览器

### PWA支持
项目支持渐进式Web应用(PWA)特性：
- 🏠 桌面快捷方式
- 🔄 离线访问
- 📢 推送通知

## 🎬 演示视频

### 功能介绍视频
- 📹 [Sira AI Gateway 功能演示](https://youtu.be/demo-video-1)
- 📹 [智能路由工作原理](https://youtu.be/demo-video-2)
- 📹 [性能监控面板详解](https://youtu.be/demo-video-3)

### 安装部署视频
- 📹 [Docker快速部署](https://youtu.be/install-video-1)
- 📹 [Kubernetes集群部署](https://youtu.be/install-video-2)
- 📹 [云服务一键部署](https://youtu.be/install-video-3)

## 🔧 开发者演示

### API调用演示
```bash
# 基本对话API
curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo_key" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "解释什么是AI网关"}
    ]
  }'
```

### 监控API演示
```bash
# 获取系统状态
curl http://localhost:8080/api/system/health

# 获取业务指标
curl http://localhost:8080/api/business/metrics

# 获取性能数据
curl http://localhost:8080/api/performance/stats
```

## 📊 演示数据

### 预置演示数据
项目包含预置的演示数据用于展示：
- 📈 历史性能数据
- 👥 模拟用户行为
- 💰 成本消耗统计
- 🎯 路由决策记录

### 数据重置
```bash
# 重置演示数据
npm run demo:reset

# 生成新的演示数据
npm run demo:generate
```

## 🌟 高级演示功能

### A/B测试演示
```bash
# 启用A/B测试
curl -X POST http://localhost:8080/api/admin/ab-test/enable \
  -H "X-API-Key: admin_key" \
  -d '{"experiment": "model-comparison"}'

# 查看测试结果
curl http://localhost:8080/api/admin/ab-test/results
```

### 自定义路由演示
```bash
# 设置路由规则
curl -X POST http://localhost:8080/api/admin/routing/rules \
  -H "X-API-Key: admin_key" \
  -d '{
    "rules": [
      {
        "condition": "complexity > 0.8",
        "action": "route_to_gpt4"
      }
    ]
  }'
```

## 🏆 演示亮点

### 🚀 高性能展示
- **响应时间**: < 300ms (演示环境)
- **并发处理**: 支持1000+并发请求
- **缓存效率**: 95%+ 缓存命中率

### 🛡️ 企业级特性
- **高可用**: 99.9%+ 可用性保证
- **安全性**: 完整的认证和授权
- **可观测性**: 全链路监控和告警

### 🌐 国际化支持
- **5种语言**: 中文、英文、日语、韩语、德语
- **自动检测**: 基于浏览器语言自动切换
- **API响应**: 多语言错误消息和响应

## 📞 获取演示支持

### 技术支持
- 📧 **邮件**: demo@sira-ai-gateway.com
- 💬 **在线聊天**: 演示站点内建即时通讯
- 📱 **电话**: +86 178-5539-8215

### 定制演示
需要针对特定场景的定制演示？
- 📋 [演示需求表单](https://forms.sira-ai-gateway.com/demo-request)
- 👥 [预约演示会议](https://calendly.com/sira-ai-gateway/demo)

## 🔄 演示更新

### 最新版本
- **版本**: 2.1.0-beta.1
- **更新日期**: 2025-01-10
- **新增功能**: 多语言API文档、增强的监控面板

### 更新日志
- ✅ 新增日语和韩语界面支持
- ✅ 优化移动端响应式设计
- ✅ 增加演示数据生成工具
- ✅ 支持PWA离线访问

---

**体验Sira AI Gateway的强大功能** 🚀

*让AI集成变得简单、高效、经济*
