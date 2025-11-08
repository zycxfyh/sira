# 🌍 国际化模块 (Locales Module) 详细规划

## 📋 模块概述

**国际化模块** 是Sira AI网关的全球化支持系统，负责多语言界面、本地化内容、时区处理和文化适应。它确保产品在全球不同地区都能提供优质的用户体验。

### 定位与职责

- **系统定位**: 全球化支持的基础设施，提供多语言和本地化能力
- **主要职责**: 语言包管理、翻译系统、格式本地化、时区处理
- **设计理念**: 轻量高效、易于扩展、维护友好、性能优化

### 架构层次

```
国际化模块架构:
├── 🌐 语言包层 (Language Pack Layer)
│   ├── 翻译文件管理 (Translation Files)
│   ├── 语言包加载 (Language Loading)
│   ├── 热更新机制 (Hot Reloading)
│   └── 回退策略 (Fallback Strategy)
├── 🔧 本地化层 (Localization Layer)
│   ├── 文本本地化 (Text Localization)
│   ├── 数字格式化 (Number Formatting)
│   ├── 日期时间 (Date & Time)
│   └── 货币格式 (Currency Formatting)
├── 🎯 上下文感知层 (Context Aware Layer)
│   ├── 用户偏好检测 (User Preference Detection)
│   ├── 自动语言切换 (Auto Language Switching)
│   ├── 地理位置适配 (Geo-based Adaptation)
│   └── 文化敏感内容 (Culture-sensitive Content)
└── 📊 运营管理层 (Operations Layer)
    ├── 翻译质量监控 (Translation Quality Monitoring)
    ├── 使用统计分析 (Usage Statistics)
    ├── 翻译任务管理 (Translation Task Management)
    └── 性能监控 (Performance Monitoring)
```

---

## 🏗️ 架构设计

### 1. 语言包管理系统

#### 1.1 翻译文件架构

**JSON格式语言包**:

```json
// src/locales/en-US.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success"
  },
  "dashboard": {
    "title": "AI Gateway Dashboard",
    "metrics": {
      "requests": "Total Requests",
      "latency": "Average Latency",
      "errors": "Error Rate"
    }
  },
  "navigation": {
    "home": "Home",
    "settings": "Settings",
    "monitoring": "Monitoring",
    "management": "Management"
  },
  "errors": {
    "network": "Network connection failed",
    "timeout": "Request timeout",
    "unauthorized": "Unauthorized access",
    "notFound": "Resource not found"
  }
}
```

**中文语言包**:

```json
// src/locales/zh-CN.json
{
  "common": {
    "save": "保存",
    "cancel": "取消",
    "delete": "删除",
    "edit": "编辑",
    "loading": "加载中...",
    "error": "错误",
    "success": "成功"
  },
  "dashboard": {
    "title": "AI网关控制台",
    "metrics": {
      "requests": "总请求数",
      "latency": "平均延迟",
      "errors": "错误率"
    }
  },
  "navigation": {
    "home": "首页",
    "settings": "设置",
    "monitoring": "监控",
    "management": "管理"
  },
  "errors": {
    "network": "网络连接失败",
    "timeout": "请求超时",
    "unauthorized": "未经授权的访问",
    "notFound": "资源未找到"
  }
}
```

#### 1.2 语言包加载器

**动态语言包管理**:

```javascript
class LanguagePackLoader {
  constructor() {
    this.packs = new Map();
    this.loading = new Map();
    this.cache = new Map();
    this.localesPath = path.join(__dirname, 'locales');
  }

  // 异步加载语言包
  async loadLanguagePack(locale) {
    // 检查缓存
    if (this.cache.has(locale)) {
      return this.cache.get(locale);
    }

    // 防止重复加载
    if (this.loading.has(locale)) {
      return this.loading.get(locale);
    }

    const loadPromise = this.doLoadLanguagePack(locale);
    this.loading.set(locale, loadPromise);

    try {
      const pack = await loadPromise;
      this.cache.set(locale, pack);
      this.loading.delete(locale);
      return pack;
    } catch (error) {
      this.loading.delete(locale);
      throw error;
    }
  }

  // 执行语言包加载
  async doLoadLanguagePack(locale) {
    const filePath = path.join(this.localesPath, `${locale}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const pack = JSON.parse(content);

      // 验证语言包结构
      await this.validateLanguagePack(pack, locale);

      // 合并父级语言包
      const parentPack = await this.getParentLanguagePack(locale);
      const mergedPack = this.mergeLanguagePacks(parentPack, pack);

      return {
        locale,
        data: mergedPack,
        loadedAt: new Date(),
        checksum: this.calculateChecksum(content),
      };
    } catch (error) {
      console.error(`Failed to load language pack ${locale}:`, error.message);
      throw new LanguagePackLoadError(locale, error.message);
    }
  }

  // 获取父级语言包 (如 zh-CN 的父级是 zh)
  async getParentLanguagePack(locale) {
    const parts = locale.split('-');
    if (parts.length > 1) {
      const parentLocale = parts[0];
      return await this.loadLanguagePack(parentLocale);
    }
    return null;
  }

  // 合并语言包
  mergeLanguagePacks(parent, child) {
    if (!parent) return child;

    return this.deepMerge(parent.data, child);
  }

  // 深度合并对象
  deepMerge(target, source) {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // 验证语言包结构
  async validateLanguagePack(pack, locale) {
    const requiredKeys = ['common', 'errors'];

    for (const key of requiredKeys) {
      if (!pack[key]) {
        throw new ValidationError(`Missing required key '${key}' in ${locale}`);
      }
    }

    // 检查翻译值不为空
    this.validateTranslationValues(pack, locale);
  }

  // 热重载语言包
  async reloadLanguagePack(locale) {
    this.cache.delete(locale);
    return await this.loadLanguagePack(locale);
  }

  // 预加载常用语言包
  async preloadCommonLocales() {
    const commonLocales = ['en-US', 'zh-CN', 'es-ES', 'fr-FR', 'de-DE'];

    const promises = commonLocales.map(locale =>
      this.loadLanguagePack(locale).catch(error => {
        console.warn(`Failed to preload ${locale}:`, error.message);
        return null;
      })
    );

    await Promise.allSettled(promises);
  }
}
```

### 2. 本地化服务

#### 2.1 文本本地化服务

**翻译查找和插值**:

```javascript
class LocalizationService {
  constructor(languagePackLoader) {
    this.loader = languagePackLoader;
    this.currentLocale = 'en-US';
    this.fallbackLocale = 'en-US';
  }

  // 翻译文本
  async translate(key, options = {}) {
    const { locale = this.currentLocale, params = {}, fallback } = options;

    try {
      const pack = await this.loader.loadLanguagePack(locale);
      const translation = this.lookupTranslation(pack.data, key);

      if (!translation) {
        // 尝试回退语言包
        if (locale !== this.fallbackLocale) {
          const fallbackPack = await this.loader.loadLanguagePack(
            this.fallbackLocale
          );
          const fallbackTranslation = this.lookupTranslation(
            fallbackPack.data,
            key
          );
          if (fallbackTranslation) {
            return this.interpolate(fallbackTranslation, params);
          }
        }

        // 使用自定义回退或键名
        return fallback || key;
      }

      return this.interpolate(translation, params);
    } catch (error) {
      console.error(`Translation error for key '${key}':`, error.message);
      return fallback || key;
    }
  }

  // 查找翻译
  lookupTranslation(data, key) {
    const keys = key.split('.');
    let current = data;

    for (const k of keys) {
      if (current && typeof current === 'object') {
        current = current[k];
      } else {
        return null;
      }
    }

    return current;
  }

  // 参数插值
  interpolate(text, params) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  // 批量翻译
  async translateBatch(keys, options = {}) {
    const translations = {};

    for (const key of keys) {
      translations[key] = await this.translate(key, options);
    }

    return translations;
  }

  // 设置当前语言
  setLocale(locale) {
    this.currentLocale = locale;
  }

  // 获取支持的语言列表
  async getSupportedLocales() {
    // 扫描语言包文件
    const localesDir = path.join(__dirname, 'locales');
    const files = await fs.readdir(localesDir);

    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }
}
```

#### 2.2 格式本地化服务

**数字、日期、货币格式化**:

```javascript
class FormattingService {
  constructor() {
    this.formatters = new Map();
    this.locales = new Map();

    this.initializeFormatters();
  }

  // 初始化格式化器
  initializeFormatters() {
    // 数字格式化器
    this.formatters.set('number', new Intl.NumberFormat());
    this.formatters.set('currency', new Intl.NumberFormat());
    this.formatters.set('percent', new Intl.NumberFormat());

    // 日期格式化器
    this.formatters.set('date', new Intl.DateTimeFormat());
    this.formatters.set('time', new Intl.DateTimeFormat());
    this.formatters.set('datetime', new Intl.DateTimeFormat());

    // 相对时间格式化器
    this.formatters.set('relativeTime', new Intl.RelativeTimeFormat());
  }

  // 格式化数字
  formatNumber(number, options = {}) {
    const {
      locale = this.currentLocale,
      style = 'decimal',
      ...formatOptions
    } = options;

    const formatter = new Intl.NumberFormat(locale, {
      style,
      ...formatOptions,
    });

    return formatter.format(number);
  }

  // 格式化货币
  formatCurrency(amount, currency = 'USD', options = {}) {
    const { locale = this.currentLocale } = options;

    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...options,
    });

    return formatter.format(amount);
  }

  // 格式化百分比
  formatPercent(value, options = {}) {
    const { locale = this.currentLocale } = options;

    const formatter = new Intl.NumberFormat(locale, {
      style: 'percent',
      ...options,
    });

    return formatter.format(value);
  }

  // 格式化日期
  formatDate(date, options = {}) {
    const { locale = this.currentLocale, format = 'date' } = options;

    let formatterOptions;
    switch (format) {
      case 'time':
        formatterOptions = { hour: '2-digit', minute: '2-digit' };
        break;
      case 'datetime':
        formatterOptions = {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        };
        break;
      default:
        formatterOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    }

    const formatter = new Intl.DateTimeFormat(locale, formatterOptions);
    return formatter.format(new Date(date));
  }

  // 格式化相对时间
  formatRelativeTime(date, options = {}) {
    const { locale = this.currentLocale, style = 'long' } = options;

    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const formatter = new Intl.RelativeTimeFormat(locale, { style });
    return formatter.format(diffDays, 'day');
  }

  // 解析本地化输入
  parseLocalizedNumber(value, locale = this.currentLocale) {
    // 移除本地化的分隔符
    const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.');

    // 处理欧洲格式 (1.234,56)
    if (locale.startsWith('de') || locale.startsWith('fr')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }

    // 处理美式格式 (1,234.56)
    return parseFloat(cleaned.replace(/,/g, ''));
  }

  // 解析本地化日期
  parseLocalizedDate(value, locale = this.currentLocale) {
    // 使用浏览器原生解析，结合locale信息
    return new Date(value);
  }
}
```

---

## 🎯 功能职责详解

### 1. 多语言支持

#### 1.1 语言检测和切换

**自动语言检测**:

```javascript
class LanguageDetector {
  constructor() {
    this.detectors = [
      new URLParameterDetector(),
      new CookieDetector(),
      new HeaderDetector(),
      new BrowserDetector(),
      new GeoIPDetector(),
    ];
  }

  // 检测用户语言偏好
  async detectLanguage(request) {
    for (const detector of this.detectors) {
      try {
        const language = await detector.detect(request);
        if (language && (await this.isLanguageSupported(language))) {
          return language;
        }
      } catch (error) {
        console.debug(
          `Language detector ${detector.constructor.name} failed:`,
          error.message
        );
      }
    }

    // 返回默认语言
    return 'en-US';
  }

  // 检查语言是否支持
  async isLanguageSupported(language) {
    const supportedLocales =
      await this.localizationService.getSupportedLocales();
    return supportedLocales.includes(language);
  }
}

// URL参数检测器
class URLParameterDetector {
  async detect(request) {
    return request.query.lang || request.query.locale;
  }
}

// Cookie检测器
class CookieDetector {
  async detect(request) {
    return request.cookies?.locale || request.cookies?.lang;
  }
}

// 请求头检测器
class HeaderDetector {
  async detect(request) {
    const acceptLanguage = request.headers['accept-language'];
    if (acceptLanguage) {
      // 解析 Accept-Language 头
      return this.parseAcceptLanguage(acceptLanguage);
    }
    return null;
  }

  parseAcceptLanguage(header) {
    // 解析 "zh-CN,zh;q=0.9,en;q=0.8" 格式
    const languages = header.split(',').map(lang => {
      const [locale, quality = '1'] = lang.trim().split(';q=');
      return { locale, quality: parseFloat(quality) };
    });

    languages.sort((a, b) => b.quality - a.quality);
    return languages[0]?.locale;
  }
}

// 浏览器检测器
class BrowserDetector {
  async detect(request) {
    const userAgent = request.headers['user-agent'];
    if (userAgent) {
      // 基于User-Agent检测语言
      if (userAgent.includes('zh-CN') || userAgent.includes('zh-Hans')) {
        return 'zh-CN';
      }
      // 其他语言检测逻辑...
    }
    return null;
  }
}
```

#### 1.2 语言包管理

**翻译维护工作流**:

```javascript
class TranslationManager {
  constructor() {
    this.translations = new Map();
    this.pendingUpdates = new Map();
    this.reviewQueue = new Set();
  }

  // 添加翻译
  async addTranslation(locale, key, value, metadata = {}) {
    const translation = {
      key,
      value,
      locale,
      addedAt: new Date(),
      addedBy: metadata.user || 'system',
      status: 'draft',
      metadata,
    };

    await this.saveTranslation(translation);
    await this.notifyTranslators(locale, key);

    return translation;
  }

  // 更新翻译
  async updateTranslation(locale, key, newValue, user) {
    const existing = await this.getTranslation(locale, key);

    if (!existing) {
      throw new Error(`Translation not found: ${locale}.${key}`);
    }

    const updated = {
      ...existing,
      value: newValue,
      updatedAt: new Date(),
      updatedBy: user,
      status: 'pending_review',
    };

    await this.saveTranslation(updated);
    this.reviewQueue.add(`${locale}.${key}`);

    return updated;
  }

  // 批量导入翻译
  async importTranslations(locale, translations, options = {}) {
    const results = {
      imported: 0,
      updated: 0,
      errors: [],
    };

    for (const [key, value] of Object.entries(translations)) {
      try {
        const existing = await this.getTranslation(locale, key);

        if (existing) {
          if (options.overwrite) {
            await this.updateTranslation(
              locale,
              key,
              value,
              options.user || 'importer'
            );
            results.updated++;
          }
        } else {
          await this.addTranslation(locale, key, value, {
            user: options.user || 'importer',
            source: 'import',
          });
          results.imported++;
        }
      } catch (error) {
        results.errors.push({
          key,
          error: error.message,
        });
      }
    }

    return results;
  }

  // 导出翻译
  async exportTranslations(locale, options = {}) {
    const translations = await this.getAllTranslations(locale);

    if (options.format === 'csv') {
      return this.exportAsCSV(translations);
    }

    return this.exportAsJSON(translations);
  }

  // 翻译一致性检查
  async checkConsistency(locales = null) {
    const targetLocales = locales || (await this.getSupportedLocales());
    const issues = [];

    // 获取基准语言包 (通常是英文)
    const baseTranslations = await this.getAllTranslations('en-US');

    for (const locale of targetLocales) {
      if (locale === 'en-US') continue;

      const localeTranslations = await this.getAllTranslations(locale);

      // 检查缺失翻译
      for (const [key, baseValue] of Object.entries(baseTranslations)) {
        if (!localeTranslations[key]) {
          issues.push({
            type: 'missing',
            locale,
            key,
            baseValue,
          });
        }
      }

      // 检查未使用的翻译
      for (const key of Object.keys(localeTranslations)) {
        if (!baseTranslations[key]) {
          issues.push({
            type: 'unused',
            locale,
            key,
            value: localeTranslations[key],
          });
        }
      }
    }

    return issues;
  }
}
```

### 2. 本地化服务

#### 2.1 时区处理

**时区感知服务**:

```javascript
class TimezoneService {
  constructor() {
    this.timezones = Intl.supportedValuesOf('timeZone');
    this.userTimezone = null;
  }

  // 检测用户时区
  detectTimezone(request) {
    // 1. 从请求头获取
    const tzHeader = request.headers['x-timezone'];
    if (tzHeader && this.isValidTimezone(tzHeader)) {
      return tzHeader;
    }

    // 2. 从JavaScript Date对象估算
    // 注意: 这需要在前端获取并发送给后端

    // 3. 从IP地址估算 (需要GeoIP服务)
    // const geoIP = await this.getGeoIPInfo(request.ip);
    // return geoIP.timezone;

    // 4. 使用默认时区
    return 'UTC';
  }

  // 转换时间到用户时区
  convertToUserTimezone(date, userTimezone = this.userTimezone) {
    const utcDate = new Date(date);
    const userTime = new Date(
      utcDate.toLocaleString('en-US', {
        timeZone: userTimezone,
      })
    );

    return userTime;
  }

  // 格式化用户友好的时间
  formatUserFriendlyTime(date, locale = 'en-US', timezone = null) {
    const targetTimezone = timezone || this.userTimezone;
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: targetTimezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return formatter.format(new Date(date));
  }

  // 获取时区偏移
  getTimezoneOffset(timezone, date = new Date()) {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const targetDate = new Date(
      date.toLocaleString('en-US', { timeZone: timezone })
    );

    return targetDate.getTime() - utcDate.getTime();
  }

  // 验证时区
  isValidTimezone(timezone) {
    return this.timezones.includes(timezone);
  }

  // 获取所有支持的时区
  getSupportedTimezones() {
    return [...this.timezones];
  }

  // 获取时区信息
  getTimezoneInfo(timezone) {
    // 这里可以返回时区的详细信息
    // 如: 城市名称、UTC偏移、国家等
    return {
      name: timezone,
      offset: this.getTimezoneOffset(timezone),
      cities: this.getTimezoneCities(timezone),
      country: this.getTimezoneCountry(timezone),
    };
  }
}
```

#### 2.2 文化适应

**文化敏感内容处理**:

```javascript
class CulturalAdaptationService {
  constructor() {
    this.culturalRules = new Map();
    this.loadCulturalRules();
  }

  // 加载文化规则
  loadCulturalRules() {
    // 颜色文化差异
    this.culturalRules.set('colors', {
      'zh-CN': {
        lucky: ['red', 'gold', 'yellow'],
        unlucky: ['white', 'black'],
        wedding: 'red',
      },
      'en-US': {
        lucky: ['green', 'blue'],
        unlucky: ['black'],
        wedding: 'white',
      },
      'ar-SA': {
        lucky: ['green'],
        unlucky: ['black'],
        wedding: 'white',
      },
    });

    // 数字文化差异
    this.culturalRules.set('numbers', {
      'zh-CN': {
        lucky: [6, 8, 9],
        unlucky: [4],
      },
      'en-US': {
        lucky: [7],
        unlucky: [13],
      },
      'ja-JP': {
        lucky: [7, 8],
        unlucky: [4, 9],
      },
    });

    // 日期格式偏好
    this.culturalRules.set('dateFormats', {
      'en-US': 'MM/DD/YYYY',
      'zh-CN': 'YYYY年MM月DD日',
      'de-DE': 'DD.MM.YYYY',
      'fr-FR': 'DD/MM/YYYY',
    });
  }

  // 文化适应文本处理
  adaptText(text, locale) {
    // 示例: 处理文化敏感内容
    if (locale === 'zh-CN') {
      // 中文特殊处理
      text = text.replace(/Monday/g, '星期一');
      text = text.replace(/Friday/g, '星期五');
    }

    return text;
  }

  // 文化适应颜色方案
  adaptColorScheme(colorScheme, locale) {
    const colorRules = this.culturalRules.get('colors')[locale];

    if (colorRules) {
      // 检查是否使用了不合适的文化颜色
      for (const color of colorScheme) {
        if (colorRules.unlucky.includes(color.toLowerCase())) {
          console.warn(
            `Color '${color}' may be culturally inappropriate in ${locale}`
          );
        }
      }
    }

    return colorScheme;
  }

  // 文化适应内容过滤
  filterContent(content, locale) {
    // 示例: 根据文化规范过滤内容
    const rules = this.culturalRules.get('content')?.[locale];

    if (rules) {
      // 应用内容过滤规则
      return this.applyContentFilters(content, rules);
    }

    return content;
  }

  // 获取文化偏好设置
  getCulturalPreferences(locale) {
    return {
      colors: this.culturalRules.get('colors')[locale] || {},
      numbers: this.culturalRules.get('numbers')[locale] || {},
      dateFormat: this.culturalRules.get('dateFormats')[locale] || 'MM/DD/YYYY',
      textDirection: this.getTextDirection(locale),
      calendar: this.getCalendarType(locale),
    };
  }

  // 获取文字方向
  getTextDirection(locale) {
    const rtlLocales = ['ar', 'he', 'fa', 'ur'];
    const language = locale.split('-')[0];

    return rtlLocales.includes(language) ? 'rtl' : 'ltr';
  }

  // 获取日历类型
  getCalendarType(locale) {
    const islamicLocales = ['ar-SA', 'ar-AE', 'ar-BH', 'ar-QA'];
    const buddhistLocales = ['th-TH'];

    if (islamicLocales.includes(locale)) return 'islamic';
    if (buddhistLocales.includes(locale)) return 'buddhist';

    return 'gregorian';
  }
}
```

---

## 🛠️ 技术实现详解

### 1. 中间件集成

#### 1.1 Express中间件

**国际化中间件**:

```javascript
class I18nMiddleware {
  constructor(localizationService, languageDetector) {
    this.localizationService = localizationService;
    this.languageDetector = languageDetector;
  }

  // Express中间件函数
  middleware() {
    return async (req, res, next) => {
      try {
        // 检测用户语言
        const language = await this.languageDetector.detectLanguage(req);

        // 设置语言上下文
        req.locale = language;
        req.localization = {
          translate: (key, params) =>
            this.localizationService.translate(key, {
              locale: language,
              params,
            }),
          formatNumber: (number, options) =>
            this.formattingService.formatNumber(number, {
              locale: language,
              ...options,
            }),
          formatDate: (date, options) =>
            this.formattingService.formatDate(date, {
              locale: language,
              ...options,
            }),
        };

        // 设置响应头
        res.setHeader('Content-Language', language);

        // 添加翻译助手到响应对象
        res.locals.t = req.localization.translate;
        res.locals.formatNumber = req.localization.formatNumber;
        res.locals.formatDate = req.localization.formatDate;

        next();
      } catch (error) {
        console.error('I18n middleware error:', error);
        // 使用默认语言继续
        req.locale = 'en-US';
        req.localization = this.getDefaultLocalization();
        next();
      }
    };
  }

  getDefaultLocalization() {
    return {
      translate: key => key,
      formatNumber: number => number.toString(),
      formatDate: date => date.toISOString(),
    };
  }
}

// 使用示例
const i18nMiddleware = new I18nMiddleware(
  localizationService,
  languageDetector
);
app.use(i18nMiddleware.middleware());
```

#### 1.2 前端集成

**React国际化集成**:

```typescript
// i18n配置
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    lng: 'en-US',
    fallbackLng: 'en-US',
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false, // React已经转义
    },

    backend: {
      loadPath: '/locales/{{lng}}.json',
    },

    react: {
      useSuspense: false,
    },
  });

// 使用钩子
function MyComponent() {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.metrics.requests')}</p>
      <button onClick={() => changeLanguage('zh-CN')}>
        {t('common.switchLanguage')}
      </button>
    </div>
  );
}
```

### 2. 性能优化

#### 2.1 缓存策略

**翻译缓存优化**:

```javascript
class TranslationCache {
  constructor() {
    this.memoryCache = new Map();
    this.redisCache = null;
    this.ttl = 3600000; // 1小时TTL
  }

  // 获取缓存的翻译
  async get(locale, key) {
    const cacheKey = `${locale}:${key}`;

    // 内存缓存
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.value;
    }

    // Redis缓存
    if (this.redisCache) {
      try {
        const redisEntry = await this.redisCache.get(cacheKey);
        if (redisEntry) {
          const parsed = JSON.parse(redisEntry);
          this.memoryCache.set(cacheKey, parsed); // 提升到内存缓存
          return parsed.value;
        }
      } catch (error) {
        console.warn('Redis cache error:', error.message);
      }
    }

    return null;
  }

  // 设置缓存
  async set(locale, key, value) {
    const cacheKey = `${locale}:${key}`;
    const entry = {
      value,
      timestamp: Date.now(),
      ttl: this.ttl,
    };

    // 内存缓存
    this.memoryCache.set(cacheKey, entry);

    // Redis缓存
    if (this.redisCache) {
      try {
        await this.redisCache.setex(
          cacheKey,
          this.ttl / 1000,
          JSON.stringify(entry)
        );
      } catch (error) {
        console.warn('Redis cache error:', error.message);
      }
    }
  }

  // 批量预热缓存
  async preloadCache(locale, keys) {
    const translations = await this.localizationService.translateBatch(keys, {
      locale,
    });

    for (const [key, translation] of Object.entries(translations)) {
      await this.set(locale, key, translation);
    }
  }

  // 清理过期缓存
  cleanup() {
    const now = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }

  isExpired(entry) {
    return Date.now() - entry.timestamp > entry.ttl;
  }
}
```

#### 2.2 延迟加载

**按需加载语言包**:

```javascript
class LazyLanguageLoader {
  constructor() {
    this.loadedLocales = new Set(['en-US']); // 默认语言始终加载
    this.loadingPromises = new Map();
  }

  // 按需加载语言包
  async loadOnDemand(locale) {
    if (this.loadedLocales.has(locale)) {
      return; // 已加载
    }

    if (this.loadingPromises.has(locale)) {
      return this.loadingPromises.get(locale); // 正在加载
    }

    const loadPromise = this.doLoadOnDemand(locale);
    this.loadingPromises.set(locale, loadPromise);

    try {
      await loadPromise;
      this.loadedLocales.add(locale);
      this.loadingPromises.delete(locale);
    } catch (error) {
      this.loadingPromises.delete(locale);
      throw error;
    }
  }

  async doLoadOnDemand(locale) {
    // 动态导入语言包
    try {
      const languagePack = await import(`./locales/${locale}.json`);
      await this.localizationService.registerLanguagePack(
        locale,
        languagePack.default
      );
    } catch (error) {
      // 尝试加载压缩版本
      const compressedPack = await import(`./locales/${locale}.min.json`);
      await this.localizationService.registerLanguagePack(
        locale,
        compressedPack.default
      );
    }
  }

  // 预加载高频语言
  async preloadFrequentLocales() {
    const frequentLocales = ['zh-CN', 'es-ES', 'fr-FR', 'de-DE'];

    await Promise.allSettled(
      frequentLocales.map(locale => this.loadOnDemand(locale))
    );
  }

  // 智能预加载 (基于用户行为)
  async smartPreload(userHistory) {
    const localeFrequency = this.analyzeUserLocaleHistory(userHistory);
    const topLocales = Object.keys(localeFrequency)
      .sort((a, b) => localeFrequency[b] - localeFrequency[a])
      .slice(0, 3);

    await Promise.allSettled(
      topLocales.map(locale => this.loadOnDemand(locale))
    );
  }
}
```

---

## 📈 发展规划

### 1. 短期规划 (0-6个月)

#### 1.1 基础功能完善

- [ ] **语言包管理**
  - [ ] 完善语言包加载机制
  - [ ] 支持语言包热更新
  - [ ] 实现翻译键验证
  - [ ] 添加语言包压缩

- [ ] **本地化服务**
  - [ ] 完善文本翻译服务
  - [ ] 实现数字和日期格式化
  - [ ] 支持货币格式本地化
  - [ ] 添加时区处理

- [ ] **用户体验优化**
  - [ ] 实现自动语言检测
  - [ ] 支持语言切换持久化
  - [ ] 优化翻译加载性能
  - [ ] 添加翻译缺失提醒

#### 1.2 质量保障

- [ ] **翻译质量**
  - [ ] 建立翻译审核流程
  - [ ] 实现翻译一致性检查
  - [ ] 添加翻译测试覆盖
  - [ ] 支持翻译版本控制

- [ ] **测试覆盖**
  - [ ] 单元测试覆盖80%
  - [ ] 翻译功能测试
  - [ ] 本地化格式测试
  - [ ] 端到端语言切换测试

### 2. 中期规划 (6-12个月)

#### 2.1 高级功能

- [ ] **智能翻译**
  - [ ] 集成AI翻译服务
  - [ ] 支持上下文感知翻译
  - [ ] 实现翻译记忆库
  - [ ] 添加翻译建议功能

- [ ] **文化适应**
  - [ ] 实现文化敏感内容检测
  - [ ] 支持本地化图片和媒体
  - [ ] 添加文化偏好学习
  - [ ] 实现个性化本地化

- [ ] **多模态本地化**
  - [ ] 语音内容本地化
  - [ ] 图像和视频本地化
  - [ ] 手势和表情本地化
  - [ ] 多媒体内容适配

#### 2.2 生态系统建设

- [ ] **翻译协作平台**
  - [ ] 构建翻译贡献者社区
  - [ ] 实现翻译任务分配
  - [ ] 支持专业翻译服务集成
  - [ ] 添加翻译质量评估

- [ ] **开发者工具**
  - [ ] 翻译提取和管理系统
  - [ ] 本地化开发工具集成
  - [ ] 翻译测试自动化工具
  - [ ] CI/CD本地化流水线

### 3. 长期规划 (12-24个月)

#### 3.1 智能化本地化

- [ ] **AI驱动本地化**
  - [ ] 自动翻译质量评估
  - [ ] 个性化翻译模型
  - [ ] 实时翻译优化
  - [ ] 多语言内容生成

- [ ] **高级文化适应**
  - [ ] 深度文化理解
  - [ ] 跨文化沟通优化
  - [ ] 文化冲突检测和解决
  - [ ] 全球用户体验分析

#### 3.2 全球化平台

- [ ] **全球化基础设施**
  - [ ] 支持200+语言和地区
  - [ ] 全球CDN本地化分发
  - [ ] 实时多语言协作
  - [ ] 国际化标准合规

- [ ] **生态系统扩展**
  - [ ] 第三方本地化服务集成
  - [ ] 本地化服务市场
  - [ ] 全球开发者社区
  - [ ] 开源本地化项目

---

## 🔗 依赖关系

### 1. 内部依赖

#### 1.1 强依赖模块

```
国际化模块依赖关系:
├── 管理模块 (Admin Module)
│   ├── 提供管理界面本地化
│   └── 支持多语言用户界面
├── 核心模块 (Core Module)
│   ├── 使用本地化服务
│   └── 提供国际化API响应
├── 配置模块 (Config Module)
│   ├── 读取国际化配置
│   └── 管理语言包配置
└── 网关模块 (Gateway Module)
    ├── 处理语言偏好检测
    └── 提供本地化HTTP头
```

#### 1.2 可选依赖模块

```
可选依赖:
├── 测试模块 (Test Module) - 国际化测试支持
└── 部署模块 (Docker Module) - 多语言镜像支持
```

### 2. 外部依赖

#### 2.1 核心依赖

```json
{
  "i18n核心": {
    "i18next": "^22.0.0",
    "i18next-http-middleware": "^3.2.0",
    "i18next-browser-languagedetector": "^7.0.0"
  },
  "格式化": {
    "intl": "^1.2.5",
    "@formatjs/intl": "^2.5.0"
  },
  "翻译管理": {
    "locize": "^3.0.0",
    "transifex": "^4.0.0"
  }
}
```

#### 2.2 前端依赖

```json
{
  "React集成": {
    "react-i18next": "^12.0.0",
    "i18next-react": "^2.0.0"
  },
  "UI组件": {
    "react-intl": "^6.2.0",
    "@mui/locale": "^5.10.0"
  }
}
```

---

## 🧪 测试策略

### 1. 国际化测试

#### 1.1 翻译测试

**翻译完整性测试**:

```javascript
describe('Translation Completeness', () => {
  const locales = ['en-US', 'zh-CN', 'es-ES', 'fr-FR'];
  const requiredKeys = ['common.save', 'common.cancel', 'errors.network'];

  locales.forEach(locale => {
    describe(`Locale: ${locale}`, () => {
      requiredKeys.forEach(key => {
        test(`should have translation for ${key}`, async () => {
          const translation = await localizationService.translate(key, {
            locale,
          });
          expect(translation).toBeDefined();
          expect(translation).not.toBe(key); // 不是返回key本身
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        });
      });
    });
  });
});

describe('Translation Interpolation', () => {
  test('should interpolate parameters correctly', async () => {
    const result = await localizationService.translate('welcome.message', {
      name: 'Alice',
      locale: 'en-US',
    });

    expect(result).toBe('Welcome, Alice!');
  });

  test('should handle missing parameters', async () => {
    const result = await localizationService.translate('welcome.message', {
      locale: 'en-US',
    });

    expect(result).toBe('Welcome, {{name}}!');
  });
});
```

#### 1.2 本地化测试

**格式化测试**:

```javascript
describe('Number Formatting', () => {
  test('should format numbers according to locale', () => {
    expect(formattingService.formatNumber(1234.56, { locale: 'en-US' })).toBe(
      '1,234.56'
    );
    expect(formattingService.formatNumber(1234.56, { locale: 'de-DE' })).toBe(
      '1.234,56'
    );
    expect(formattingService.formatNumber(1234.56, { locale: 'zh-CN' })).toBe(
      '1,234.56'
    );
  });

  test('should format currencies correctly', () => {
    expect(
      formattingService.formatCurrency(99.99, 'USD', { locale: 'en-US' })
    ).toBe('$99.99');
    expect(
      formattingService.formatCurrency(99.99, 'EUR', { locale: 'de-DE' })
    ).toBe('99,99 €');
    expect(
      formattingService.formatCurrency(99.99, 'CNY', { locale: 'zh-CN' })
    ).toBe('￥99.99');
  });
});

describe('Date Formatting', () => {
  const testDate = new Date('2023-12-25T10:30:00Z');

  test('should format dates according to locale', () => {
    expect(formattingService.formatDate(testDate, { locale: 'en-US' })).toBe(
      '12/25/2023'
    );
    expect(formattingService.formatDate(testDate, { locale: 'zh-CN' })).toBe(
      '2023年12月25日'
    );
    expect(formattingService.formatDate(testDate, { locale: 'de-DE' })).toBe(
      '25.12.2023'
    );
  });

  test('should format times correctly', () => {
    expect(
      formattingService.formatDate(testDate, {
        locale: 'en-US',
        format: 'time',
      })
    ).toBe('10:30 AM');
  });
});
```

### 2. 端到端测试

#### 2.1 语言切换测试

**完整语言切换流程**:

```javascript
describe('Language Switching E2E', () => {
  test('should switch language and persist preference', async () => {
    // 启动应用
    const app = await startTestApp();

    // 初始语言 (英文)
    let response = await request(app).get('/');
    expect(response.headers['content-language']).toBe('en-US');
    expect(response.text).toContain('Welcome');

    // 切换到中文
    await request(app)
      .post('/api/language')
      .send({ locale: 'zh-CN' })
      .expect(200);

    // 验证语言切换
    response = await request(app)
      .get('/')
      .set('Cookie', response.headers['set-cookie']);

    expect(response.headers['content-language']).toBe('zh-CN');
    expect(response.text).toContain('欢迎');

    // 重启应用后验证持久化
    await restartTestApp();
    response = await request(app)
      .get('/')
      .set('Cookie', response.headers['set-cookie']);

    expect(response.headers['content-language']).toBe('zh-CN');

    await stopTestApp();
  });
});
```

---

## 🔧 维护计划

### 1. 日常维护

#### 1.1 语言包维护

**翻译更新流程**:

- [ ] 每周检查新增翻译需求
- [ ] 定期更新翻译质量
- [ ] 维护翻译一致性
- [ ] 处理翻译反馈和修正

**语言包优化**:

- [ ] 定期清理未使用的翻译
- [ ] 优化语言包大小
- [ ] 更新过时的翻译内容
- [ ] 添加新的语言变体支持

#### 1.2 性能监控

**国际化性能监控**:

- [ ] 语言包加载时间监控
- [ ] 翻译查找性能监控
- [ ] 格式化操作性能监控
- [ ] 缓存命中率监控

**告警设置**:

```javascript
const i18nAlerts = {
  slowTranslationLookup: {
    condition: 'translation_lookup_p95 > 100',
    severity: 'warning',
    message: 'Translation lookup performance degraded',
    channels: ['slack'],
  },
  missingTranslations: {
    condition: 'missing_translation_count > 10',
    severity: 'error',
    message: 'High number of missing translations detected',
    channels: ['slack', 'email'],
  },
  languagePackLoadFailure: {
    condition: 'language_pack_load_failures > 0',
    severity: 'error',
    message: 'Language pack loading failures',
    channels: ['slack', 'email'],
  },
};
```

### 2. 版本管理

#### 2.1 翻译版本控制

**翻译变更管理**:

```javascript
class TranslationVersionControl {
  // 翻译快照
  async createTranslationSnapshot(locale, message) {
    const translations =
      await this.translationManager.getAllTranslations(locale);
    const snapshot = {
      locale,
      translations,
      checksum: this.calculateChecksum(translations),
      timestamp: new Date(),
      message,
      author: this.currentUser,
    };

    await this.store.saveTranslationSnapshot(snapshot);
    return snapshot;
  }

  // 翻译差异比较
  async compareTranslationVersions(locale, version1, version2) {
    const snapshot1 = await this.store.getTranslationSnapshot(locale, version1);
    const snapshot2 = await this.store.getTranslationSnapshot(locale, version2);

    return this.diffTranslations(
      snapshot1.translations,
      snapshot2.translations
    );
  }

  // 回滚翻译
  async rollbackTranslations(locale, version) {
    const snapshot = await this.store.getTranslationSnapshot(locale, version);
    await this.translationManager.updateTranslations(
      locale,
      snapshot.translations
    );
  }
}
```

#### 2.2 本地化发布管理

**本地化发布流程**:

- [ ] 翻译审核和批准
- [ ] 本地化测试验证
- [ ] 渐进式发布策略
- [ ] 回滚计划准备

### 3. 技术债务管理

#### 3.1 国际化债务识别

**翻译债务**:

- [ ] 过时翻译清理
- [ ] 翻译键命名规范化
- [ ] 翻译上下文缺失
- [ ] 翻译测试覆盖不足

**代码债务**:

- [ ] 本地化逻辑耦合
- [ ] 硬编码文本清理
- [ ] 语言包结构优化
- [ ] 性能优化空间

#### 3.2 债务偿还计划

**优先级排序**:

1. **P0 (紧急)**: 影响国际化功能正常工作的债务
2. **P1 (重要)**: 影响翻译质量和用户体验的债务
3. **P2 (一般)**: 影响代码可维护性的债务

**偿还策略**:

- [ ] 每个月度迭代安排1-2个国际化债务偿还任务
- [ ] 设立国际化债务KPI指标 (每月减少10%)
- [ ] 定期国际化债务评审会议

### 4. 文档维护

#### 4.1 国际化文档体系

**文档结构**:

- [ ] **开发者指南**: 国际化开发最佳实践
- [ ] **翻译者手册**: 翻译工作流程和规范
- [ ] **用户指南**: 语言设置和偏好配置
- [ ] **API文档**: 国际化API使用说明

**自动化文档生成**:

```javascript
class I18nDocumentationGenerator {
  // 生成翻译文档
  async generateTranslationDocs() {
    const locales = await this.localizationService.getSupportedLocales();
    const docs = {};

    for (const locale of locales) {
      docs[locale] = {
        locale,
        totalTranslations:
          await this.translationManager.countTranslations(locale),
        categories: await this.categorizeTranslations(locale),
        completeness: await this.calculateCompleteness(locale),
        lastUpdated: await this.getLastUpdateTime(locale),
      };
    }

    return docs;
  }

  // 生成本地化指南
  async generateLocalizationGuide() {
    return {
      supportedLocales: await this.localizationService.getSupportedLocales(),
      formattingRules: await this.formattingService.getAllRules(),
      culturalGuidelines: await this.culturalService.getGuidelines(),
      bestPractices: this.getBestPractices(),
      faq: this.getFAQ(),
    };
  }

  // 生成翻译状态报告
  async generateTranslationStatusReport() {
    const locales = await this.localizationService.getSupportedLocales();
    const report = {
      summary: {
        totalLocales: locales.length,
        totalTranslations: 0,
        completeness: {},
      },
      details: {},
    };

    for (const locale of locales) {
      const status = await this.translationManager.getStatus(locale);
      report.details[locale] = status;
      report.summary.totalTranslations += status.totalCount;
      report.summary.completeness[locale] = status.completeness;
    }

    return report;
  }
}
```

---

## 📊 成功指标

### 1. 功能完整性指标

#### 1.1 语言支持指标

- [ ] **支持语言数量**: 10+ 主要语言
- [ ] **翻译覆盖率**: 95%+ 核心功能翻译完成
- [ ] **翻译准确性**: 98%+ 翻译质量达标
- [ ] **语言包加载成功率**: > 99.9%

#### 1.2 本地化质量指标

- [ ] **格式化正确性**: 100% 按locale正确格式化
- [ ] **文化适应度**: 90%+ 内容符合当地文化
- [ ] **时区处理准确性**: 100% 时区转换正确
- [ ] **编码支持**: UTF-8无乱码问题

### 2. 性能与稳定性指标

#### 2.1 性能指标

- [ ] **翻译查找时间**: < 10ms (P95)
- [ ] **语言包加载时间**: < 100ms (首次加载)
- [ ] **格式化操作时间**: < 5ms
- [ ] **内存使用**: < 10MB (语言包占用)

#### 2.2 稳定性指标

- [ ] **翻译服务可用性**: > 99.9%
- [ ] **语言切换成功率**: > 99.5%
- [ ] **格式化错误率**: < 0.1%
- [ ] **缓存命中率**: > 95%

### 3. 用户体验指标

#### 3.1 易用性指标

- [ ] **语言检测准确性**: > 90% 自动检测正确
- [ ] **切换响应时间**: < 2秒 语言切换完成
- [ ] **翻译缺失处理**: 100% 有适当回退
- [ ] **用户满意度**: NPS > 75 国际化体验

#### 3.2 全球化指标

- [ ] **地区覆盖**: 支持50+国家和地区
- [ ] **文化适应满意度**: > 85% 用户满意
- [ ] **无障碍访问**: 100% 支持RTL语言
- [ ] **SEO国际化**: 100% hreflang标签正确

---

## 🎯 总结

国际化模块作为Sira AI网关的"全球化桥梁"，承担着多语言支持、本地化服务、文化适应等关键职责。通过精心设计的语言包管理系统、智能本地化服务、上下文感知功能，国际化模块能够：

**技术优势**:

- 多层次语言包管理系统，支持动态加载和热更新
- 智能翻译查找和参数插值，提供丰富的本地化功能
- 文化敏感的内容处理，确保全球用户体验
- 高性能缓存和延迟加载，优化资源使用

**业务价值**:

- 打破语言障碍，支持全球用户使用
- 提供本地化的用户体验，提升用户满意度
- 支持国际化业务拓展，扩大市场覆盖
- 建立全球化品牌形象，提升企业竞争力

**架构亮点**:

- 分层架构设计，职责清晰，易于扩展
- 插件化语言检测，支持多种检测策略
- 缓存优化和性能监控，确保高性能表现
- 完整的测试覆盖，保证功能稳定可靠

通过持续的功能优化和全球化扩展，国际化模块将成为连接不同文化和语言用户的桥梁，为Sira AI网关的全球化发展奠定坚实基础。
