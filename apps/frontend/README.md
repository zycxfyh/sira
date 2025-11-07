# 🎨 前端应用 (Frontend) - 工业级Vue 3 SPA

## 📋 概述

创世星环的前端应用是一个**工业级**的Vue 3单页应用(SPA)，提供完整的用户界面来支持AI驱动的交互式叙事游戏体验。应用采用响应式设计，支持实时WebSocket通信，并集成了完整的用户认证、游戏管理和工业级监控功能。

[![Industrial Ready](https://img.shields.io/badge/industrial-ready-brightgreen.svg)](../../docs/System-Technical-Specification.md)
[![Tested](https://img.shields.io/badge/tested-✅-brightgreen.svg)](../../industrial-test-results/)

## 🛠️ 技术栈

### 核心框架
- **🎯 框架**: Vue 3 (Composition API) + `<script setup>`
- **⚡ 构建工具**: Vite 5.x (现代化构建)
- **🎪 状态管理**: Pinia (Vuex 5替代方案)
- **🧭 路由**: Vue Router 4 (组合式API支持)
- **🌐 HTTP客户端**: Axios + TanStack Query
- **🔴 实时通信**: Socket.IO Client (WebSocket + 降级支持)

### 开发工具链
- **🎨 样式**: 现代CSS + Flexbox/Grid + CSS变量
- **🧪 测试**: Vitest + Vue Test Utils + Playwright (E2E)
- **🔍 代码质量**: ESLint + TypeScript严格模式
- **📦 包管理**: pnpm (高效的包管理器)
- **🏭 CI/CD**: GitHub Actions + Turbo (智能缓存)

### 工业级特性
- **📊 监控**: Sentry前端监控 + 性能追踪
- **🔒 安全**: CSP头 + 输入验证 + XSS防护
- **♿ 无障碍**: WCAG 2.1 AA合规
- **🌐 国际化**: Vue I18n准备 (多语言支持)

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

## 🚀 开发指南

### 环境要求

- **Node.js**: 20.19.5+ (推荐使用nvm管理)
- **包管理器**: pnpm 9.6.0+ (高效且可靠)
- **Git**: 2.30+ (版本控制)

### 快速开始

```bash
# 1. 克隆项目
git clone <repository-url>
cd creation-ring

# 2. 安装依赖 (使用pnpm workspace)
pnpm install

# 3. 启动开发环境
pnpm dev:frontend

# 4. 浏览器访问
open http://localhost:5173
```

### 🧪 测试与质量保证

#### 单元测试
```bash
# 运行前端单元测试
pnpm test --filter=@tuheg/frontend

# 带覆盖率报告
pnpm test --coverage
```

#### 工业级测试套件
```bash
# 运行完整工业测试 (推荐)
pnpm industrial-test

# 仅前端相关测试
pnpm industrial-test:frontend

# 快速失败模式 (CI环境)
pnpm industrial-test:quick
```

#### 代码质量检查
```bash
# ESLint检查 (0错误标准)
pnpm lint

# 自动修复
pnpm lint:fix

# TypeScript严格检查
pnpm type-check
```

### 🏗️ 构建与部署

#### 开发构建
```bash
pnpm build:dev
```

#### 生产构建
```bash
pnpm build

# 分析包大小
pnpm build:analyze
```

#### Docker构建
```bash
# 构建Docker镜像
docker build -f Dockerfile.frontend -t creation-ring-frontend .

# 运行容器
docker run -p 80:80 creation-ring-frontend
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
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

## ⚡ 性能优化 - 工业级标准

### 🚀 核心性能指标

- **🏆 Lighthouse评分**: ≥95 (性能/无障碍/SEO)
- **📦 首屏加载**: <2秒 (Core Web Vitals)
- **🎯 运行时性能**: <100ms交互延迟
- **📱 响应式**: 移动端优先设计

### 🧩 代码分割策略

#### 路由级懒加载
```typescript
// 自动代码分割
const routes = [
  {
    path: '/game',
    component: () => import('./views/GameView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/creation',
    component: () => import('./views/CreationHubView.vue')
  }
];
```

#### 组件级分割
```vue
<script setup>
// AI组件按需加载
const AiConfigCard = defineAsyncComponent(() =>
  import('./components/common/AiConfigCard.vue')
);
</script>
```

### 💾 缓存策略

#### HTTP缓存优化
```nginx
# Nginx配置示例
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### 应用级缓存
- **Pinia状态**: 持久化用户会话
- **TanStack Query**: 智能API缓存
- **WebSocket**: 实时状态同步

### 📦 打包优化

#### Vite高级优化
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'pinia'],
          ai: ['socket.io-client', 'axios']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
};
```

#### 资源优化
- **🖼️ 图片**: WebP格式 + 响应式图片
- **🎨 CSS**: 关键CSS内联 + 未使用代码移除
- **📜 JavaScript**: 树摇优化 + 代码分割

## 🧪 测试策略 - 工业级覆盖

### 📊 测试覆盖指标

- **单元测试覆盖**: ≥80% (语句/分支/函数)
- **集成测试**: API + WebSocket通信
- **E2E测试**: 关键用户流程完整覆盖
- **性能测试**: Lighthouse CI自动化

### 🔬 单元测试

#### 组件测试
```typescript
// 组件逻辑测试示例
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AiConfigCard from './AiConfigCard.vue';

describe('AiConfigCard', () => {
  it('renders AI configuration correctly', () => {
    const wrapper = mount(AiConfigCard, {
      props: { config: mockAiConfig }
    });
    expect(wrapper.text()).toContain('GPT-4');
  });
});
```

#### Store测试
- Pinia状态变更测试
- Action/S getter逻辑验证
- 状态持久化测试

#### 服务层测试
- API调用mock测试
- WebSocket通信测试
- 错误处理和重试逻辑

### 🔗 集成测试

#### API集成
```typescript
// API服务集成测试
describe('GameAPI Integration', () => {
  it('creates new game successfully', async () => {
    const response = await apiService.games.create(mockGameData);
    expect(response.id).toBeDefined();
  });
});
```

#### WebSocket集成
- 实时消息传递测试
- 连接状态管理测试
- 断线重连机制测试

### 🌐 E2E测试 (Playwright)

#### 用户流程测试
```typescript
// E2E用户旅程测试
test('complete game creation flow', async ({ page }) => {
  await page.goto('/creation');
  await page.fill('[data-testid="concept-input"]', '太空冒险');
  await page.click('[data-testid="create-game"]');
  await page.waitForURL('/game/*');
  expect(page.url()).toMatch(/\/game\/\d+/);
});
```

#### 性能监控
- Lighthouse自动评分
- Core Web Vitals监控
- 内存泄漏检测

## 🚀 部署说明 - 工业级标准

### 🐳 多阶段Docker构建

#### 优化的Dockerfile
```dockerfile
# 多阶段构建 - 工业级优化
FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

# 安全配置
COPY nginx.conf /etc/nginx/nginx.conf
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

#### 构建命令
```bash
# 构建优化版本
docker build \
  --target runner \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -f Dockerfile.frontend \
  -t creation-ring-frontend:latest \
  .

# 运行健康检查
docker run --rm -p 8080:80 creation-ring-frontend:latest
curl http://localhost:8080/health
```

### ☸️ Kubernetes部署

#### Helm Chart结构
```
charts/frontend/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   └── hpa.yaml
```

#### 部署命令
```bash
# 使用Helm部署
helm upgrade --install frontend ./charts/frontend \
  --namespace production \
  --set image.tag=v1.0.0 \
  --set ingress.enabled=true

# 验证部署
kubectl get pods -l app=frontend
kubectl logs -f deployment/frontend
```

### 🔧 Nginx配置优化

#### 工业级Nginx配置
```nginx
# /etc/nginx/nginx.conf
worker_processes auto;
worker_rlimit_nofile 10240;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 性能优化
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # 缓存策略
    map $sent_http_content_type $expires {
        default off;
        text/html epoch;
        text/css 1y;
        application/javascript 1y;
        image/png 1y;
        image/jpg 1y;
        image/jpeg 1y;
        image/gif 1y;
        image/svg+xml 1y;
        font/woff2 1y;
    }

    expires $expires;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Referrer-Policy strict-origin-when-cross-origin;

        # SPA路由处理
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API代理 (开发环境)
        location /api/ {
            proxy_pass http://backend:3000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # WebSocket代理
        location /socket.io/ {
            proxy_pass http://backend:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
    }
}
```

### 📊 监控和可观测性

#### 前端监控集成
```javascript
// Sentry配置
import * as Sentry from '@sentry/vue';

Sentry.init({
  app: app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.BrowserTracing({
      routingInstrumentation: Sentry.vueRouterInstrumentation(router),
    }),
    new Sentry.Replay(),
  ],
});
```

#### 性能监控
- **Core Web Vitals**: LCP, FID, CLS自动监控
- **错误追踪**: 自动错误捕获和用户反馈
- **用户行为**: 会话回放和热力图分析

## 🌐 浏览器兼容性

- **Chrome**: 100+ (推荐)
- **Firefox**: 95+ (推荐)
- **Safari**: 15+ (推荐)
- **Edge**: 100+ (推荐)
- **移动端**: iOS Safari 15+, Chrome Mobile 100+

## 🤝 贡献指南 - 工业级标准

### 📋 开发工作流

1. **环境准备**
   ```bash
   # 安装依赖
   pnpm install

   # 运行工业级测试
   pnpm industrial-test

   # 启动开发环境
   pnpm dev:frontend
   ```

2. **代码开发**
   ```bash
   # 创建特性分支
   git checkout -b feature/amazing-ui-component

   # 开发并测试
   pnpm test --watch
   pnpm lint --fix
   ```

3. **质量验证**
   ```bash
   # 完整测试套件
   pnpm industrial-test

   # 性能检查
   pnpm build:analyze

   # Lighthouse评分
   pnpm lighthouse
   ```

4. **提交代码**
   ```bash
   # 规范提交
   git commit -m 'feat: add amazing UI component with tests'

   # 推送到分支
   git push origin feature/amazing-ui-component
   ```

### 🧪 质量标准

#### 代码质量
- **ESLint**: 0错误 (警告可接受)
- **TypeScript**: 严格模式检查通过
- **测试覆盖**: ≥80% (组件/服务/工具函数)
- **性能**: Lighthouse评分 ≥95

#### 提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具配置
```

#### PR要求
- ✅ 工业级测试通过
- ✅ 代码审查通过
- ✅ 文档更新完成
- ✅ 向后兼容保证

### 🐛 常见问题

#### 开发环境问题

**Q: 热重载不工作？**
```bash
# 清除缓存
rm -rf node_modules/.vite
pnpm dev:frontend
```

**Q: WebSocket连接失败？**
```javascript
// 检查环境变量
console.log(import.meta.env.VITE_WS_URL);

// 验证后端服务运行状态
curl http://localhost:3000/health
```

#### 构建部署问题

**Q: 构建产物过大？**
```bash
# 分析包大小
pnpm build:analyze

# 优化策略：
# 1. 使用动态导入
# 2. 配置代码分割
# 3. 移除未使用的依赖
```

**Q: Docker构建失败？**
```bash
# 检查Dockerfile语法
docker build --no-cache -f Dockerfile.frontend .

# 验证构建上下文
ls -la apps/frontend/
```

#### 性能优化问题

**Q: 如何提升Lighthouse评分？**
- 优化图片: WebP格式 + 响应式加载
- 代码分割: 路由级懒加载
- 缓存策略: HTTP缓存头配置
- 压缩优化: Gzip + Brotli

### 📚 相关文档

| 文档 | 说明 |
| ---- | ---- |
| [🏭 系统技术规格书](../../docs/System-Technical-Specification.md) | 完整技术规范 |
| [🏗️ 架构设计](../../ARCHITECTURE.md) | 系统架构说明 |
| [🧪 工业测试](../../industrial-test-results/) | 测试报告和结果 |
| [🚀 部署指南](../../deployment/) | 生产环境部署 |
| [🔒 安全指南](../../SECURITY.md) | 安全策略和实践 |

---

**🎨 前端应用已达到工业级标准，为用户提供卓越的AI叙事体验！**
