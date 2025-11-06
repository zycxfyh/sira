# 前端应用 (Frontend)

## 概述

创世星环的前端应用是一个现代化的Vue 3单页应用(SPA)，提供完整的用户界面来支持AI驱动的交互式叙事游戏体验。应用采用响应式设计，支持实时WebSocket通信，并集成了完整的用户认证和游戏管理功能。

## 技术栈

- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **HTTP客户端**: Axios
- **实时通信**: Socket.IO Client
- **样式**: 自定义CSS + Flexbox/Grid
- **测试**: Vitest + Vue Test Utils
- **代码质量**: ESLint

## 架构设计

### 目录结构

```
apps/frontend/
├── src/
│   ├── assets/           # 静态资源 (CSS, 图片等)
│   ├── components/       # Vue组件
│   │   ├── common/       # 通用组件
│   │   ├── creation/     # 创世流程组件
│   │   ├── game/         # 游戏界面组件
│   │   └── nexus/        # 主导航组件
│   ├── composables/      # Vue组合式函数
│   ├── router/           # 路由配置
│   ├── services/         # 外部服务接口
│   ├── stores/           # Pinia状态管理
│   ├── views/            # 页面视图组件
│   └── main.js           # 应用入口
├── public/               # 公共静态资源
├── tests/                # 端到端测试
├── package.json
├── vite.config.js        # Vite配置
└── README.md
```

### 核心组件架构

#### 1. 视图层 (Views)

**WelcomeView.vue** - 欢迎页面
- 应用入口点
- 引导用户开始使用

**LoginView.vue** - 登录页面
- 用户认证入口
- 支持注册和登录

**NexusHubView.vue** - 主导航中心
- 已保存游戏列表
- 快速访问游戏设置
- 导航到创世中心

**CreationHubView.vue** - 创世中心
- 游戏世界创建入口
- 支持角色驱动和叙事驱动两种创建模式

**GameView.vue** - 游戏界面
- 主游戏交互界面
- 实时显示AI生成的叙事内容

#### 2. 组件层 (Components)

##### 通用组件 (common/)
- **AiConfigCard.vue** - AI配置卡片
- **AISettingsModal.vue** - AI设置模态框
- **CharacterSheetModal.vue** - 角色卡模态框
- **JournalModal.vue** - 游戏日志模态框
- **ProcessingOverlay.vue** - 处理状态遮罩
- **WeaverConsoleModal.vue** - 开发者控制台

##### 创世组件 (creation/)
- **CreationForm.vue** - 创世表单
- **CharacterDrivenPath.vue** - 角色驱动创建流程
- **NarrativeDrivenPath.vue** - 叙事驱动创建流程

##### 游戏组件 (game/)
- **CharacterHUD.vue** - 角色状态显示
- **MainInteractionPanel.vue** - 主交互面板
- **WorldHUD.vue** - 世界状态显示

##### 导航组件 (nexus/)
- **SaveList.vue** - 保存游戏列表

#### 3. 状态管理 (Stores)

**auth.store.js** - 认证状态
- 用户登录状态管理
- JWT令牌处理
- 自动登录逻辑

**game.store.js** - 游戏状态
- 当前游戏数据
- 游戏历史记录
- 角色信息管理

**realtime.store.js** - 实时通信状态
- WebSocket连接管理
- 实时消息处理
- 连接状态监控

**settings.store.js** - 设置状态
- AI配置管理
- 用户偏好设置

**ui.store.js** - UI状态
- 全局UI状态
- 模态框管理
- 路由状态同步

**app.store.js** - 应用全局状态
- 临时数据存储
- 跨组件状态共享

#### 4. 服务层 (Services)

**api.service.js** - HTTP API服务
- 统一的API接口封装
- 请求/响应拦截器
- 错误处理和重试逻辑
- 认证令牌自动注入

**realtime.service.js** - 实时通信服务
- Socket.IO客户端封装
- 事件订阅/发布
- 连接状态管理

#### 5. 组合式函数 (Composables)

**useGameQuery.js** - 游戏查询逻辑
**useRouteLoader.ts** - 路由加载器
**useToast.js** - 消息提示
**useAssets.js** - 资源管理

## 核心功能

### 1. 用户认证流程

```javascript
// 登录流程
const handleLogin = async (credentials) => {
  try {
    const response = await apiService.auth.login(credentials);
    authStore.setToken(response.token);
    authStore.setUser(response.user);
    router.push('/nexus');
  } catch (error) {
    // 处理登录错误
  }
};
```

### 2. 游戏创建流程

支持两种创建模式：
- **角色驱动**: 从角色设定开始创建世界
- **叙事驱动**: 从故事概念开始构建世界

### 3. 实时游戏交互

```javascript
// 提交玩家行动
const submitAction = async (action) => {
  try {
    const response = await apiService.games.submitAction(gameId, action);
    // 处理AI响应
    handleAiResponse(response);
  } catch (error) {
    // 处理错误
  }
};
```

### 4. WebSocket实时通信

```javascript
// 实时消息处理
realtimeStore.on('game:update', (data) => {
  gameStore.updateGameState(data);
});
```

## 开发指南

### 环境要求

- Node.js 18+
- pnpm (推荐)

### 安装依赖

```bash
pnpm install
```

### 开发环境启动

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

### 代码检查

```bash
pnpm lint
```

### 测试

```bash
pnpm test
```

## 配置说明

### 环境变量

```bash
# API基础URL
VITE_API_BASE_URL=http://localhost:3000

# WebSocket URL (可选，默认使用API URL)
VITE_WS_URL=ws://localhost:3000
```

### 代理配置

在 `vite.config.js` 中配置开发环境代理：

```javascript
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});
```

## 性能优化

### 代码分割

- 路由级别的懒加载
- 第三方库的按需导入

### 缓存策略

- HTTP缓存头配置
- Service Worker缓存 (计划中)

### 打包优化

- Vite的树摇优化
- 代码压缩和混淆
- 图片优化

## 测试策略

### 单元测试

- 组件逻辑测试
- Store状态测试
- 服务层测试

### 集成测试

- API集成测试
- 路由测试

### E2E测试

- Playwright端到端测试
- 用户流程测试

## 部署说明

### Docker构建

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Nginx配置

支持静态资源缓存、Gzip压缩、HTTPS重定向等。

## 监控和错误追踪

### Sentry集成

- 前端错误监控
- 性能监控
- 用户行为追踪

### 自定义错误处理

- 全局错误边界
- API错误统一处理
- 用户友好的错误提示

## 浏览器兼容性

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 常见问题

### Q: 如何处理跨域问题？
A: 在开发环境中通过Vite代理解决，生产环境通过Nginx配置CORS。

### Q: WebSocket连接失败如何处理？
A: 应用会自动重试连接，并在连接失败时降级到HTTP轮询。

### Q: 如何自定义主题样式？
A: 修改 `src/assets/main.css` 中的CSS变量。

## 相关文档

- [后端API文档](../backend-gateway/README.md)
- [项目架构文档](../../docs/architecture/)
- [部署指南](../../deployment/)
