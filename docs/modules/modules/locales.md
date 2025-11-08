# 🌐 Locales 国际化模块

## 📋 概述

Locales模块提供了完整的国际化(i18n)和本地化(l10n)解决方案，支持多语言界面和API响应本地化。该模块借鉴了Google Translate、Laravel i18n等优秀框架的设计理念，提供了企业级的多语言支持。

## 🏗️ 架构组成

```
locales/
├── en-US.json          # 英语(美国)语言包
└── zh-CN.json          # 中文(简体)语言包
```

### 🔗 相关组件

**多语言管理器 (MultilingualManager)**:
- 位于: `src/core/multilingual-manager.js`
- 功能: 语言检测、翻译、本地化管理

**本地化中间件 (LocalizationMiddleware)**:
- 位于: `src/core/middleware/localization.js`
- 功能: 自动检测用户语言并本地化API响应

## 🚀 核心功能

### 1. 语言包管理

**结构化翻译文件**:
```json
{
  "common": {
    "success": "Success",
    "error": "Error",
    "loading": "Loading..."
  },
  "auth": {
    "login": "Login",
    "logout": "Logout",
    "username": "Username"
  },
  "ai": {
    "model": "Model",
    "provider": "Provider",
    "temperature": "Temperature"
  }
}
```

**支持的语言**:
- ✅ **中文(简体)** `zh-CN` - 完整翻译
- ✅ **英语(美国)** `en-US` - 默认语言
- 🔄 **计划支持**: 日语、法语、德语、西班牙语等

### 2. 自动语言检测

**检测策略** (按优先级):
1. **用户明确指定** - 请求头/查询参数
2. **用户偏好设置** - 数据库存储的语言设置
3. **浏览器Accept-Language** - 浏览器语言偏好
4. **IP地理位置** - 基于IP的地理位置检测
5. **默认语言** - 回退到en-US

```javascript
// 语言检测示例
const languageDetection = multilingualManager.detectLanguage(req, {
  userId: req.headers['x-user-id'],
  ip: req.ip,
  sessionId: req.headers['x-session-id']
});

console.log(languageDetection);
// {
//   language: 'zh-CN',
//   confidence: 0.9,
//   method: 'header'
// }
```

### 3. API响应本地化

**自动本地化**:
```javascript
// 中间件会自动本地化JSON响应
app.use(localizationMiddleware({
  includeMetadata: true,  // 包含本地化元数据
  autoDetect: true       // 自动检测语言
}));

// 响应示例
{
  "success": true,
  "message": "操作成功",  // 自动翻译为中文
  "data": { ... },
  "_localization": {
    "language": "zh-CN",
    "confidence": 0.9,
    "method": "header",
    "timestamp": "2025-11-08T07:00:00.000Z"
  }
}
```

**手动本地化**:
```javascript
// 在路由处理器中使用
app.get('/api/user', async (req, res) => {
  const message = await res.localize('User profile loaded successfully');
  const errorMsg = await res.getLocalizedResource('notFound', 'errors');

  res.json({
    success: true,
    message: message,
    error: errorMsg
  });
});
```

### 4. 翻译管理

**实时翻译**:
```javascript
const multilingualManager = new MultilingualManager();

// 文本翻译
const translatedText = await multilingualManager.translate(
  'Hello World',
  'en-US',
  'zh-CN'
);

// 获取本地化资源
const localizedValue = await multilingualManager.getLocalizedResource(
  'success',
  'zh-CN',
  'common'
);
```

**批量翻译**:
```javascript
// 批量翻译整个对象
const originalData = {
  title: 'Welcome',
  description: 'This is a welcome message',
  buttons: {
    ok: 'OK',
    cancel: 'Cancel'
  }
};

const localizedData = await multilingualManager.localizeResponse(
  originalData,
  'zh-CN',
  { userId: 'user123' }
);
```

## ⚙️ 配置选项

### 多语言管理器配置

```javascript
const multilingualManager = new MultilingualManager({
  configPath: './config/multilingual.json',    // 配置文件路径
  localesPath: './src/locales',               // 语言包路径
  cachePath: './cache/translations',           // 翻译缓存路径

  // 翻译服务配置
  translationService: {
    provider: 'google-translate',              // 翻译服务提供商
    apiKey: process.env.GOOGLE_TRANSLATE_KEY,  // API密钥
    cacheEnabled: true,                        // 启用缓存
    cacheTTL: 86400000                         // 缓存时间(24小时)
  },

  // 语言检测配置
  languageDetection: {
    methods: ['header', 'query', 'cookie', 'browser', 'geoip'],
    defaultLanguage: 'en-US',
    fallbackLanguage: 'en-US'
  }
});
```

### 中间件配置

```javascript
app.use(localizationMiddleware({
  includeMetadata: true,         // 在响应中包含本地化元数据
  autoDetect: true,             // 自动检测语言
  forceLocalization: false,     // 强制本地化所有响应
  cacheTranslations: true,      // 缓存翻译结果
  supportedLanguages: ['en-US', 'zh-CN', 'ja-JP'], // 支持的语言列表
  defaultNamespace: 'common'    // 默认命名空间
}));
```

## 🔧 使用指南

### 1. 添加新语言

```bash
# 1. 创建新的语言包文件
cp src/locales/en-US.json src/locales/ja-JP.json

# 2. 编辑翻译内容
# 将en-US.json中的英文翻译为日语

# 3. 在MultilingualManager中注册语言
this.supportedLanguages['ja-JP'] = {
  name: '日本語',
  nativeName: '日本語',
  flag: '🇯🇵',
  fallback: 'en-US',
  rtl: false
};
```

### 2. 扩展翻译键

```javascript
// 在语言包中添加新的翻译键
{
  "notifications": {
    "emailSent": "Email sent successfully",
    "smsSent": "SMS sent successfully",
    "pushSent": "Push notification sent"
  }
}

// 使用新的翻译键
const message = await res.getLocalizedResource('emailSent', 'notifications');
```

### 3. 自定义翻译逻辑

```javascript
// 扩展MultilingualManager
class CustomMultilingualManager extends MultilingualManager {
  async translate(text, fromLang, toLang) {
    // 自定义翻译逻辑
    if (this.hasCustomTranslation(text, toLang)) {
      return this.getCustomTranslation(text, toLang);
    }

    // 调用父类默认翻译
    return super.translate(text, fromLang, toLang);
  }
}
```

## 📊 翻译覆盖率统计

| 命名空间 | 英文键数 | 中文翻译 | 覆盖率 | 状态 |
|----------|----------|----------|--------|------|
| common | 24 | 24 | 100% | ✅ 完成 |
| auth | 15 | 15 | 100% | ✅ 完成 |
| api | 14 | 14 | 100% | ✅ 完成 |
| validation | 12 | 12 | 100% | ✅ 完成 |
| ai | 18 | 18 | 100% | ✅ 完成 |
| routing | 12 | 12 | 100% | ✅ 完成 |
| training | 19 | 19 | 100% | ✅ 完成 |
| multilingual | 17 | 17 | 100% | ✅ 完成 |
| errors | 18 | 18 | 100% | ✅ 完成 |
| messages | 18 | 18 | 100% | ✅ 完成 |
| **总计** | **167** | **167** | **100%** | **✅ 完成** |

## 🧪 测试验证

### 单元测试
```bash
# 语言检测测试
npm test -- --grep "multilingual.*detect"

# 翻译功能测试
npm test -- --grep "multilingual.*translate"

# 中间件测试
npm test -- --grep "localization.*middleware"
```

### 集成测试
```bash
# API本地化端到端测试
npm run test:e2e -- --testPathPattern=localization

# 多语言界面测试
npm run test:integration -- --grep multilingual
```

### 性能测试
```javascript
// 翻译性能基准测试
describe('Translation Performance', () => {
  it('should translate 1000 texts within 5 seconds', async () => {
    const texts = Array(1000).fill('Hello World');
    const startTime = Date.now();

    await Promise.all(texts.map(text =>
      multilingualManager.translate(text, 'en-US', 'zh-CN')
    ));

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000);
  });
});
```

## 🔗 相关链接

- **[主README](../README.md)** - 项目总览
- **[API文档](../README-AI.md#api-使用)** - API使用说明
- **[中间件文档](../middleware.md)** - 中间件配置
- **[配置指南](../config.md)** - 系统配置

## 🤝 贡献指南

### 添加新语言
1. 创建新的语言包JSON文件
2. 确保所有现有键都有翻译
3. 在MultilingualManager中注册语言
4. 添加相应的测试用例
5. 更新文档

### 扩展翻译功能
1. 遵循现有的命名空间约定
2. 为新功能添加完整的翻译覆盖
3. 更新翻译统计表
4. 确保向后兼容性

### 翻译质量保证
- 使用专业翻译或母语翻译者
- 保持术语一致性
- 考虑文化差异和本地化习惯
- 定期审查和更新翻译

---

*最后更新: 2025年11月8日* | 🔙 [返回模块列表](../README.md#模块导航)
