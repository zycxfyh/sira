# 📄 Templates 模板系统模块

## 📋 概述

Templates模块提供了统一的模板管理系统，支持报告生成、提示词模板、配置文件模板等多种模板类型。该模块采用插件化设计，支持自定义模板引擎和动态模板渲染，提供了企业级的模板管理解决方案。

## 🏗️ 架构组成

```
templates/
├── reports/           # 报告模板目录
│   └── (自定义报告模板)
├── prompts/           # 提示词模板目录 (计划中)
├── config/            # 配置文件模板 (计划中)
└── emails/            # 邮件模板 (计划中)
```

### 🔗 相关组件

**报告生成器 (ReportGenerator)**:
- 位于: `src/core/report-generator.js`
- 功能: 基于模板生成各类报告

**提示词模板管理器 (PromptTemplateManager)**:
- 位于: `src/core/prompt-template-manager.js`
- 功能: AI提示词模板管理和渲染

## 🚀 核心功能

### 1. 报告模板系统

**内置HTML模板**:
```html
<!DOCTYPE html>
<html>
<head>
    <title>{{report.type}} Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{report.type}} Report</h1>
        <p>Generated: {{report.generatedAt}}</p>
        <p>Time Range: {{report.timeRange}}</p>
    </div>
    <div class="summary">
        <!-- 动态生成摘要内容 -->
    </div>
</body>
</html>
```

**报告类型支持**:
- ✅ **使用情况摘要** `usage-summary` - API调用统计
- ✅ **性能分析** `performance-analysis` - 响应时间和吞吐量
- ✅ **错误分析** `error-analysis` - 错误率和错误类型
- ✅ **成本分析** `cost-analysis` - API使用成本
- ✅ **用户行为** `user-behavior` - 用户交互模式
- ✅ **供应商对比** `provider-comparison` - AI供应商性能对比
- ✅ **趋势分析** `trend-analysis` - 时间序列趋势
- ✅ **自定义仪表板** `custom-dashboard` - 用户自定义报告

### 2. 提示词模板系统

**模板分类**:
```javascript
const templates = {
  creative: {},     // 创意写作
  coding: {},       // 编程开发
  business: {},     // 商业应用
  education: {},    // 教育学习
  communication: {}, // 沟通交流
  analysis: {},     // 数据分析
  custom: {}        // 用户自定义
}
```

**模板结构**:
```javascript
const storyTemplate = {
  name: '故事作家',
  description: '专业的小说和故事写作助手',
  template: `你是一位专业的故事作家，请根据以下要求创作一个引人入胜的故事：

故事主题：{{theme}}
故事类型：{{genre}}
主要人物：{{characters}}
...

请开始创作：`,
  variables: ['theme', 'genre', 'characters', 'setting', 'plot_points', 'word_count'],
  defaultValues: {
    theme: '友谊与背叛',
    genre: '奇幻冒险',
    characters: '年轻的魔法师、神秘的导师、邪恶的反派',
    word_count: '2000'
  },
  tags: ['小说', '故事', '创意写作', '文学创作']
}
```

**变量替换**:
```javascript
// 模板渲染
const prompt = templateManager.render('creative.story_writer', {
  theme: '时空穿越',
  genre: '科幻冒险',
  characters: '年轻科学家、时间旅行者、未来AI',
  word_count: '1500'
});
```

### 3. 内置变量处理器

**预定义变量**:
```javascript
this.variableProcessors = {
  date: () => new Date().toLocaleDateString('zh-CN'),
  time: () => new Date().toLocaleTimeString('zh-CN'),
  datetime: () => new Date().toLocaleString('zh-CN'),
  random: (min = 1, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
  uuid: () => require('crypto').randomUUID()
}
```

**使用示例**:
```javascript
// 在模板中使用
const template = `
今天是：{{date}}
当前时间：{{time}}
随机数：{{random}}
唯一ID：{{uuid}}
`;

// 渲染结果
// 今天是：2025/11/8
// 当前时间：14:30:25
// 随机数：42
// 唯一ID：a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

## ⚙️ 配置选项

### 报告生成器配置

```javascript
const reportGenerator = new ReportGenerator({
  configPath: './config/reports.json',     // 报告配置文件路径
  reportsPath: './data/reports',           // 报告输出目录
  templatesPath: './templates/reports',    // 模板目录

  // 缓存配置
  cacheEnabled: true,                      // 启用缓存
  cacheTTL: 300000,                       // 缓存时间(5分钟)

  // 定时报告配置
  scheduledReports: {
    enabled: true,
    checkInterval: 3600000                // 检查间隔(1小时)
  },

  // 导出格式配置
  exportFormats: ['json', 'html', 'csv'], // 支持的导出格式
  defaultFormat: 'json'                    // 默认格式
});
```

### 提示词模板管理器配置

```javascript
const templateManager = new PromptTemplateManager({
  templatesDir: './templates/prompts',    // 模板目录
  enableCaching: true,                    // 启用缓存
  maxCacheSize: 100,                      // 最大缓存大小

  // 自定义变量处理器
  customVariableProcessors: {
    weather: async () => {
      // 获取天气信息
      return await getCurrentWeather();
    },
    user_info: (userId) => {
      // 获取用户信息
      return getUserInfo(userId);
    }
  },

  // 模板验证配置
  validation: {
    enabled: true,
    strictMode: false,    // 严格模式 - 缺少变量时报错
    allowUndefined: true  // 允许未定义变量
  }
});
```

## 🔧 使用指南

### 1. 创建自定义报告模板

```javascript
// 1. 在templates/reports目录下创建模板文件
// custom-report.html
const customTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>{{report.title}}</title>
    <style>
        .custom-chart { width: 100%; height: 400px; }
    </style>
</head>
<body>
    <h1>{{report.title}}</h1>
    <div class="custom-chart">
        <!-- 图表内容 -->
    </div>
    <div class="metrics">
        {{#each metrics}}
        <div class="metric">
            <h3>{{name}}</h3>
            <p>{{value}}</p>
        </div>
        {{/each}}
    </div>
</body>
</html>
`;

// 2. 注册自定义报告类型
reportGenerator.registerCustomReport('custom-report', {
  template: 'custom-report.html',
  generator: async (options) => {
    // 生成报告数据的逻辑
    return {
      title: 'Custom Report',
      metrics: [
        { name: 'Metric 1', value: 100 },
        { name: 'Metric 2', value: 200 }
      ]
    };
  }
});
```

### 2. 扩展提示词模板

```javascript
// 添加新的模板分类
templateManager.addCategory('medical', '医疗应用');

// 添加模板
templateManager.addTemplate('medical.diagnosis', {
  name: '医疗诊断助手',
  description: '专业的医疗诊断辅助模板',
  template: `你是一位经验丰富的医生，请根据以下患者信息进行诊断：

患者年龄：{{age}}
性别：{{gender}}
主要症状：{{symptoms}}
病史：{{medical_history}}
检查结果：{{test_results}}

请提供：
1. 可能的诊断
2. 治疗建议
3. 注意事项

诊断分析：`,
  variables: ['age', 'gender', 'symptoms', 'medical_history', 'test_results'],
  tags: ['医疗', '诊断', '健康']
});
```

### 3. 自定义变量处理器

```javascript
// 注册自定义变量处理器
templateManager.registerVariableProcessor('stock_price', async (symbol) => {
  // 获取股票价格
  const price = await getStockPrice(symbol);
  return `$${price.toFixed(2)}`;
});

templateManager.registerVariableProcessor('exchange_rate', async (from, to) => {
  // 获取汇率
  const rate = await getExchangeRate(from, to);
  return rate.toFixed(4);
});

// 在模板中使用
const template = `
股票 {{symbol}} 当前价格：{{stock_price(symbol)}}
汇率 USD/CNY：{{exchange_rate(USD,CNY)}}
`;
```

## 📊 模板统计

| 模板类型 | 模板数量 | 变量总数 | 使用频率 | 状态 |
|----------|----------|----------|----------|------|
| 报告模板 | 8个内置 | 50+变量 | 高频 | ✅ 完成 |
| 创意写作 | 5个模板 | 25变量 | 中频 | ✅ 完成 |
| 编程开发 | 8个模板 | 40变量 | 高频 | ✅ 完成 |
| 商业应用 | 6个模板 | 30变量 | 中频 | ✅ 完成 |
| 教育学习 | 4个模板 | 20变量 | 低频 | ✅ 完成 |
| 数据分析 | 3个模板 | 15变量 | 中频 | ✅ 完成 |
| **总计** | **34个模板** | **180+变量** | **-** | **✅ 完成** |

## 🧪 测试验证

### 模板渲染测试
```javascript
describe('Template Rendering', () => {
  it('should render template with variables correctly', () => {
    const template = 'Hello {{name}}, today is {{date}}';
    const result = templateManager.render(template, { name: 'World' });

    expect(result).toContain('Hello World');
    expect(result).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/);
  });

  it('should handle missing variables gracefully', () => {
    const template = 'Hello {{name}}, age: {{age}}';
    const result = templateManager.render(template, { name: 'John' });

    // 严格模式下应该抛出错误
    expect(() => templateManager.render(template, { name: 'John' }, { strict: true }))
      .toThrow('Missing variable: age');
  });
});
```

### 报告生成测试
```javascript
describe('Report Generation', () => {
  it('should generate usage summary report', async () => {
    const report = await reportGenerator.generateReport('usage-summary', {
      timeRange: '24h',
      format: 'json'
    });

    expect(report).toHaveProperty('type', 'usage-summary');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('data');
  });

  it('should export report to HTML format', async () => {
    const report = await reportGenerator.generateReport('usage-summary');
    const html = await reportGenerator.exportReport(report, 'html');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('usage-summary');
  });
});
```

### 性能测试
```javascript
describe('Template Performance', () => {
  it('should render templates within time limit', async () => {
    const templates = Array(100).fill('Template {{var1}} {{var2}}');
    const variables = { var1: 'value1', var2: 'value2' };

    const startTime = Date.now();
    await Promise.all(templates.map(t => templateManager.render(t, variables)));
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000); // 1秒内完成
  });
});
```

## 🔗 相关链接

- **[主README](../README.md)** - 项目总览
- **[报告生成器](../report-generator.md)** - 详细报告功能
- **[提示词模板](../prompt-templates.md)** - 模板使用指南
- **[配置系统](../config.md)** - 系统配置

## 🤝 贡献指南

### 添加新模板
1. 确定模板分类和用途
2. 设计模板变量和默认值
3. 编写模板内容和说明文档
4. 添加相应的单元测试
5. 更新模板统计表

### 模板质量标准
- 变量命名清晰易懂
- 提供完整的默认值
- 包含详细的描述信息
- 支持国际化标签
- 经过性能测试验证

### 自定义模板引擎
```javascript
// 实现自定义模板引擎
class CustomTemplateEngine {
  async render(template, variables) {
    // 自定义渲染逻辑
    return this.customRender(template, variables);
  }

  async validate(template) {
    // 模板验证逻辑
    return this.customValidate(template);
  }
}

// 注册自定义引擎
templateManager.registerEngine('custom', new CustomTemplateEngine());
```

---

*最后更新: 2025年11月8日* | 🔙 [返回模块列表](../README.md#模块导航)
