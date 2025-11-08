# 📄 模板模块 (Templates Module) 详细规划

## 📋 模块概述

**模板模块** 是Sira AI网关的"代码模板库"，提供可重用的代码模板、项目脚手架、配置模板等开发资源。它是提升开发效率、保证代码质量、维护项目一致性的重要工具。

### 定位与职责

- **系统定位**: 开发资源模板库，提供标准化、可复用的开发资产
- **主要职责**: 模板管理、代码生成、配置模板、项目结构标准化
- **设计理念**: 标准化、易维护、高复用、版本化

### 架构层次

```
模板模块架构:
├── 📝 模板引擎层 (Template Engine Layer)
│   ├── 模板解析器 (Template Parser)
│   ├── 变量处理器 (Variable Processor)
│   ├── 模板渲染器 (Template Renderer)
│   └── 模板验证器 (Template Validator)
├── 📚 模板库层 (Template Library Layer)
│   ├── 项目模板 (Project Templates)
│   ├── 组件模板 (Component Templates)
│   ├── 配置模板 (Configuration Templates)
│   └── 文档模板 (Documentation Templates)
├── 🔧 模板管理层 (Template Management Layer)
│   ├── 模板注册 (Template Registration)
│   ├── 版本控制 (Version Control)
│   ├── 依赖管理 (Dependency Management)
│   └── 更新机制 (Update Mechanism)
└── 📊 模板分析层 (Template Analytics Layer)
    ├── 使用统计 (Usage Statistics)
    ├── 质量评估 (Quality Assessment)
    ├── 性能监控 (Performance Monitoring)
    └── 改进建议 (Improvement Suggestions)
```

---

## 🏗️ 架构设计

### 1. 模板引擎设计

#### 1.1 模板解析器

**多格式模板支持**:

```javascript
class TemplateParser {
  constructor() {
    this.parsers = new Map();
    this.registerBuiltInParsers();
  }

  // 注册模板解析器
  registerParser(format, parser) {
    this.parsers.set(format, parser);
  }

  // 解析模板
  async parse(templateContent, format = 'auto') {
    // 自动检测格式
    if (format === 'auto') {
      format = this.detectFormat(templateContent);
    }

    const parser = this.parsers.get(format);
    if (!parser) {
      throw new Error(`Unsupported template format: ${format}`);
    }

    return await parser.parse(templateContent);
  }

  // 检测模板格式
  detectFormat(content) {
    const trimmed = content.trim();

    // EJS模板
    if (trimmed.includes('<%') && trimmed.includes('%>')) {
      return 'ejs';
    }

    // Handlebars模板
    if (trimmed.includes('{{') && trimmed.includes('}}')) {
      return 'handlebars';
    }

    // Mustache模板
    if (trimmed.includes('{{') && !trimmed.includes('<%')) {
      return 'mustache';
    }

    // JSON模板 (变量替换)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed.replace(/\{\{\w+\}\}/g, '"dummy"'));
        return 'json';
      } catch {}
    }

    // 默认作为纯文本
    return 'text';
  }

  // 注册内置解析器
  registerBuiltInParsers() {
    // EJS解析器
    this.registerParser('ejs', {
      parse: async content => ({
        type: 'ejs',
        content,
        variables: this.extractEJSVariables(content),
        includes: this.extractEJSIncludes(content),
      }),
    });

    // Handlebars解析器
    this.registerParser('handlebars', {
      parse: async content => ({
        type: 'handlebars',
        content,
        variables: this.extractHandlebarsVariables(content),
        partials: this.extractHandlebarsPartials(content),
      }),
    });

    // JSON解析器
    this.registerParser('json', {
      parse: async content => {
        const template = JSON.parse(content);
        return {
          type: 'json',
          content: template,
          variables: this.extractJSONVariables(template),
        };
      },
    });
  }

  // 提取变量方法
  extractEJSVariables(content) {
    const variableRegex = /<%=\s*(\w+(?:\.\w+)*)\s*%>/g;
    const variables = new Set();

    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  extractHandlebarsVariables(content) {
    const variableRegex = /\{\{\s*(\w+(?:\.\w+)*)\s*\}\}/g;
    const variables = new Set();

    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  extractJSONVariables(obj, prefix = '') {
    const variables = [];

    if (typeof obj === 'string' && obj.includes('{{')) {
      const varMatch = obj.match(/\{\{(\w+(?:\.\w+)*)\}\}/);
      if (varMatch) {
        variables.push({
          name: varMatch[1],
          path: prefix,
          defaultValue: null,
        });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        variables.push(
          ...this.extractJSONVariables(item, `${prefix}[${index}]`)
        );
      });
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        variables.push(
          ...this.extractJSONVariables(value, prefix ? `${prefix}.${key}` : key)
        );
      }
    }

    return variables;
  }
}
```

#### 1.2 模板渲染器

**高效模板渲染**:

```javascript
class TemplateRenderer {
  constructor() {
    this.renderers = new Map();
    this.cache = new Map();
    this.registerBuiltInRenderers();
  }

  // 注册渲染器
  registerRenderer(type, renderer) {
    this.renderers.set(type, renderer);
  }

  // 渲染模板
  async render(template, variables, options = {}) {
    const {
      cache = true,
      validate = true,
      preprocess = true,
      postprocess = true,
    } = options;

    // 缓存检查
    const cacheKey = this.generateCacheKey(template, variables);
    if (cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 预处理
    let processedTemplate = template;
    let processedVariables = variables;

    if (preprocess) {
      ({ template: processedTemplate, variables: processedVariables } =
        await this.preprocess(template, variables));
    }

    // 验证变量
    if (validate) {
      this.validateVariables(processedTemplate.variables, processedVariables);
    }

    // 渲染
    const renderer = this.renderers.get(processedTemplate.type);
    if (!renderer) {
      throw new Error(
        `No renderer found for template type: ${processedTemplate.type}`
      );
    }

    let result = await renderer.render(
      processedTemplate.content,
      processedVariables
    );

    // 后处理
    if (postprocess) {
      result = await this.postprocess(
        result,
        processedTemplate,
        processedVariables
      );
    }

    // 缓存结果
    if (cache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  // 注册内置渲染器
  registerBuiltInRenderers() {
    // EJS渲染器
    this.registerRenderer('ejs', {
      render: async (content, variables) => {
        const ejs = await import('ejs');
        return ejs.render(content, variables, {
          async: false,
          cache: false,
        });
      },
    });

    // Handlebars渲染器
    this.registerRenderer('handlebars', {
      render: async (content, variables) => {
        const handlebars = await import('handlebars');
        const template = handlebars.compile(content);
        return template(variables);
      },
    });

    // Mustache渲染器
    this.registerRenderer('mustache', {
      render: async (content, variables) => {
        const mustache = await import('mustache');
        return mustache.render(content, variables);
      },
    });

    // JSON渲染器 (变量替换)
    this.registerRenderer('json', {
      render: async (content, variables) => {
        let result = JSON.stringify(content, null, 2);

        // 替换变量
        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          result = result.replace(regex, JSON.stringify(value));
        }

        return JSON.parse(result);
      },
    });
  }

  // 预处理
  async preprocess(template, variables) {
    // 变量类型转换
    const processedVariables = { ...variables };
    for (const [key, value] of Object.entries(processedVariables)) {
      if (typeof value === 'string') {
        // 尝试转换常见类型
        if (value === 'true') processedVariables[key] = true;
        else if (value === 'false') processedVariables[key] = false;
        else if (/^\d+$/.test(value)) processedVariables[key] = parseInt(value);
        else if (/^\d*\.\d+$/.test(value))
          processedVariables[key] = parseFloat(value);
      }
    }

    return { template, variables: processedVariables };
  }

  // 后处理
  async postprocess(result, template, variables) {
    // 格式化代码
    if (template.type === 'ejs' || this.isCodeTemplate(template)) {
      result = await this.formatCode(result, template.language || 'javascript');
    }

    // 验证生成结果
    if (template.type === 'json') {
      try {
        JSON.parse(result);
      } catch (error) {
        throw new Error(`Generated JSON is invalid: ${error.message}`);
      }
    }

    return result;
  }

  // 验证变量
  validateVariables(requiredVars, providedVars) {
    const missingVars = requiredVars.filter(
      varName =>
        !(varName in providedVars) &&
        providedVars[varName] !== null &&
        providedVars[varName] !== undefined
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required template variables: ${missingVars.join(', ')}`
      );
    }

    // 类型验证
    for (const varName of requiredVars) {
      const value = providedVars[varName];
      const expectedType = this.inferVariableType(varName);

      if (expectedType && typeof value !== expectedType) {
        console.warn(
          `Variable ${varName} type mismatch: expected ${expectedType}, got ${typeof value}`
        );
      }
    }
  }

  // 生成缓存键
  generateCacheKey(template, variables) {
    const templateHash = crypto
      .createHash('md5')
      .update(JSON.stringify(template))
      .digest('hex');

    const variablesHash = crypto
      .createHash('md5')
      .update(JSON.stringify(variables))
      .digest('hex');

    return `${templateHash}:${variablesHash}`;
  }

  // 辅助方法
  isCodeTemplate(template) {
    return (
      template.fileName &&
      (template.fileName.endsWith('.js') ||
        template.fileName.endsWith('.ts') ||
        template.fileName.endsWith('.py'))
    );
  }

  inferVariableType(varName) {
    // 简单的类型推断逻辑
    if (
      varName.includes('Count') ||
      varName.includes('Size') ||
      varName.includes('Length')
    ) {
      return 'number';
    }
    if (varName.includes('Enabled') || varName.includes('Disabled')) {
      return 'boolean';
    }
    return null; // 无法推断
  }
}
```

### 2. 模板库管理系统

#### 2.1 模板分类和组织

**层次化模板库**:

```javascript
class TemplateLibrary {
  constructor() {
    this.templates = new Map();
    this.categories = new Map();
    this.tags = new Map();

    this.initializeCategories();
  }

  // 初始化分类
  initializeCategories() {
    this.categories.set('project', {
      name: 'Project Templates',
      description: 'Complete project templates',
      icon: '📁',
      templates: [],
    });

    this.categories.set('component', {
      name: 'Component Templates',
      description: 'Reusable component templates',
      icon: '🧩',
      templates: [],
    });

    this.categories.set('config', {
      name: 'Configuration Templates',
      description: 'Configuration file templates',
      icon: '⚙️',
      templates: [],
    });

    this.categories.set('api', {
      name: 'API Templates',
      description: 'API endpoint templates',
      icon: '🔌',
      templates: [],
    });

    this.categories.set('test', {
      name: 'Test Templates',
      description: 'Test file templates',
      icon: '🧪',
      templates: [],
    });

    this.categories.set('docs', {
      name: 'Documentation Templates',
      description: 'Documentation templates',
      icon: '📚',
      templates: [],
    });
  }

  // 注册模板
  registerTemplate(id, template) {
    const templateInfo = {
      id,
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags || [],
      version: template.version || '1.0.0',
      author: template.author,
      license: template.license || 'MIT',
      repository: template.repository,
      variables: template.variables || [],
      files: template.files || [],
      dependencies: template.dependencies || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      downloads: 0,
      rating: 0,
      ...template,
    };

    this.templates.set(id, templateInfo);

    // 添加到分类
    if (template.category && this.categories.has(template.category)) {
      this.categories.get(template.category).templates.push(id);
    }

    // 添加标签索引
    for (const tag of templateInfo.tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, []);
      }
      this.tags.get(tag).push(id);
    }

    return templateInfo;
  }

  // 搜索模板
  searchTemplates(query, options = {}) {
    const {
      category,
      tags = [],
      author,
      limit = 20,
      sortBy = 'downloads',
    } = options;

    let candidates = Array.from(this.templates.values());

    // 分类过滤
    if (category) {
      candidates = candidates.filter(t => t.category === category);
    }

    // 标签过滤
    if (tags.length > 0) {
      candidates = candidates.filter(t =>
        tags.every(tag => t.tags.includes(tag))
      );
    }

    // 作者过滤
    if (author) {
      candidates = candidates.filter(t => t.author === author);
    }

    // 文本搜索
    if (query) {
      const searchTerm = query.toLowerCase();
      candidates = candidates.filter(
        t =>
          t.name.toLowerCase().includes(searchTerm) ||
          t.description.toLowerCase().includes(searchTerm) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // 排序
    candidates.sort((a, b) => {
      switch (sortBy) {
        case 'downloads':
          return b.downloads - a.downloads;
        case 'rating':
          return b.rating - a.rating;
        case 'updated':
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return candidates.slice(0, limit);
  }

  // 获取模板详情
  getTemplate(id) {
    return this.templates.get(id);
  }

  // 更新模板统计
  updateTemplateStats(id, stats) {
    const template = this.templates.get(id);
    if (template) {
      Object.assign(template, stats);
      template.updatedAt = new Date();
    }
  }

  // 获取分类统计
  getCategoryStats() {
    const stats = {};

    for (const [categoryId, category] of this.categories) {
      stats[categoryId] = {
        name: category.name,
        icon: category.icon,
        templateCount: category.templates.length,
        totalDownloads: category.templates.reduce((sum, templateId) => {
          const template = this.templates.get(templateId);
          return sum + (template ? template.downloads : 0);
        }, 0),
      };
    }

    return stats;
  }

  // 获取热门标签
  getPopularTags(limit = 10) {
    const tagStats = [];

    for (const [tag, templateIds] of this.tags) {
      const totalDownloads = templateIds.reduce((sum, templateId) => {
        const template = this.templates.get(templateId);
        return sum + (template ? template.downloads : 0);
      }, 0);

      tagStats.push({
        tag,
        templateCount: templateIds.length,
        totalDownloads,
      });
    }

    tagStats.sort((a, b) => b.totalDownloads - a.totalDownloads);
    return tagStats.slice(0, limit);
  }
}
```

#### 2.2 模板依赖管理

**智能依赖解析**:

```javascript
class TemplateDependencyManager {
  constructor() {
    this.dependencies = new Map();
    this.resolver = new DependencyResolver();
  }

  // 解析模板依赖
  async resolveDependencies(templateId, variables = {}) {
    const template = await this.getTemplate(templateId);
    const resolved = new Map();

    // 递归解析依赖
    await this.resolveTemplateDependencies(
      template,
      resolved,
      variables,
      new Set()
    );

    return Array.from(resolved.values());
  }

  // 递归解析依赖
  async resolveTemplateDependencies(template, resolved, variables, visiting) {
    if (resolved.has(template.id)) {
      return;
    }

    if (visiting.has(template.id)) {
      throw new Error(`Circular dependency detected: ${template.id}`);
    }

    visiting.add(template.id);

    // 解析直接依赖
    for (const [depName, depVersion] of Object.entries(
      template.dependencies || {}
    )) {
      const dependency = await this.resolver.resolve(depName, depVersion);

      if (dependency.type === 'template') {
        // 模板依赖
        const depTemplate = await this.getTemplate(dependency.id);
        await this.resolveTemplateDependencies(
          depTemplate,
          resolved,
          variables,
          visiting
        );
      } else {
        // 包依赖
        resolved.set(dependency.id, {
          type: 'package',
          name: depName,
          version: depVersion,
          resolved: dependency,
        });
      }
    }

    visiting.delete(template.id);

    // 添加当前模板
    resolved.set(template.id, {
      type: 'template',
      template,
      variables,
    });
  }

  // 安装依赖
  async installDependencies(dependencies, targetPath) {
    const packageDeps = dependencies.filter(dep => dep.type === 'package');
    const templateDeps = dependencies.filter(dep => dep.type === 'template');

    // 安装包依赖
    if (packageDeps.length > 0) {
      await this.installPackageDependencies(packageDeps, targetPath);
    }

    // 安装模板依赖
    for (const dep of templateDeps) {
      await this.installTemplateDependency(dep, targetPath);
    }
  }

  // 安装包依赖
  async installPackageDependencies(dependencies, targetPath) {
    const packageJsonPath = path.join(targetPath, 'package.json');
    let packageJson = {};

    // 读取现有package.json
    if (await fs.pathExists(packageJsonPath)) {
      packageJson = await fs.readJson(packageJsonPath);
    }

    // 添加依赖
    packageJson.dependencies = packageJson.dependencies || {};
    for (const dep of dependencies) {
      packageJson.dependencies[dep.name] = dep.version;
    }

    // 写入package.json
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

    // 运行npm install
    await this.runNpmInstall(targetPath);
  }

  // 安装模板依赖
  async installTemplateDependency(dependency, targetPath) {
    const { template, variables } = dependency;

    // 渲染模板文件
    for (const file of template.files) {
      const filePath = path.join(targetPath, file.path);
      const content = await this.renderer.render(file.template, variables);

      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content);
    }
  }

  // 检查依赖兼容性
  checkDependencyCompatibility(dependencies) {
    const issues = [];

    // 检查版本冲突
    const versionConflicts = this.detectVersionConflicts(dependencies);
    issues.push(...versionConflicts);

    // 检查平台兼容性
    const platformIssues = this.checkPlatformCompatibility(dependencies);
    issues.push(...platformIssues);

    // 检查安全漏洞
    const securityIssues = this.checkSecurityVulnerabilities(dependencies);
    issues.push(...securityIssues);

    return issues;
  }

  // 检测版本冲突
  detectVersionConflicts(dependencies) {
    const conflicts = [];
    const versionMap = new Map();

    for (const dep of dependencies) {
      if (dep.type === 'package') {
        const key = dep.name;
        if (versionMap.has(key)) {
          const existingVersion = versionMap.get(key);
          if (existingVersion !== dep.version) {
            conflicts.push({
              type: 'version_conflict',
              package: key,
              versions: [existingVersion, dep.version],
            });
          }
        } else {
          versionMap.set(key, dep.version);
        }
      }
    }

    return conflicts;
  }
}
```

---

## 🎯 功能职责详解

### 1. 模板生成和管理

#### 1.1 项目模板生成

**智能项目脚手架**:

```javascript
class ProjectTemplateGenerator {
  // 生成完整项目
  async generateProject(templateId, variables, options = {}) {
    const template = await this.templateLibrary.getTemplate(templateId);
    if (!template.category !== 'project') {
      throw new Error(`Template ${templateId} is not a project template`);
    }

    const {
      targetPath = process.cwd(),
      installDeps = true,
      initializeGit = true,
      overwrite = false,
    } = options;

    const projectPath = path.join(targetPath, variables.name || 'new-project');

    // 检查目标目录
    if ((await fs.pathExists(projectPath)) && !overwrite) {
      throw new Error(`Directory ${projectPath} already exists`);
    }

    // 创建项目目录
    await fs.ensureDir(projectPath);

    try {
      // 解析和安装依赖
      const dependencies = await this.dependencyManager.resolveDependencies(
        templateId,
        variables
      );
      await this.dependencyManager.installDependencies(
        dependencies,
        projectPath
      );

      // 渲染模板文件
      for (const file of template.files) {
        const filePath = path.join(projectPath, file.path);
        const content = await this.renderer.render(file.template, variables);

        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
      }

      // 执行后处理
      await this.postProcessProject(projectPath, template, variables);

      // 安装依赖
      if (installDeps) {
        await this.installProjectDependencies(projectPath);
      }

      // 初始化Git
      if (initializeGit) {
        await this.initializeGitRepository(projectPath);
      }

      // 记录模板使用
      await this.recordTemplateUsage(templateId);

      return {
        projectPath,
        template: templateId,
        variables,
        generatedAt: new Date(),
      };
    } catch (error) {
      // 清理失败的项目
      await fs.remove(projectPath);
      throw error;
    }
  }

  // 项目后处理
  async postProcessProject(projectPath, template, variables) {
    // 格式化代码
    await this.formatProjectCode(projectPath);

    // 验证生成的项目
    await this.validateGeneratedProject(projectPath, template);

    // 生成README
    await this.generateProjectReadme(projectPath, template, variables);

    // 设置文件权限
    await this.setProjectPermissions(projectPath);
  }

  // 验证生成的项目
  async validateGeneratedProject(projectPath, template) {
    const issues = [];

    // 检查必需文件
    for (const requiredFile of template.requiredFiles || []) {
      const filePath = path.join(projectPath, requiredFile);
      if (!(await fs.pathExists(filePath))) {
        issues.push(`Missing required file: ${requiredFile}`);
      }
    }

    // 检查包依赖
    if (template.dependencies) {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        for (const [dep, version] of Object.entries(template.dependencies)) {
          if (!packageJson.dependencies?.[dep]) {
            issues.push(`Missing dependency: ${dep}@${version}`);
          }
        }
      }
    }

    // 运行模板验证脚本
    if (template.validationScript) {
      try {
        await this.runValidationScript(projectPath, template.validationScript);
      } catch (error) {
        issues.push(`Validation script failed: ${error.message}`);
      }
    }

    if (issues.length > 0) {
      throw new Error(`Project validation failed:\n${issues.join('\n')}`);
    }
  }

  // 生成项目README
  async generateProjectReadme(projectPath, template, variables) {
    const readmeContent = await this.renderer.render('project-readme', {
      projectName: variables.name,
      description: variables.description,
      template: template.name,
      author: variables.author,
      createdAt: new Date().toISOString(),
      dependencies: template.dependencies,
      scripts: template.scripts,
    });

    const readmePath = path.join(projectPath, 'README.md');
    await fs.writeFile(readmePath, readmeContent);
  }
}
```

#### 1.2 组件模板生成

**模块化组件生成**:

```javascript
class ComponentTemplateGenerator {
  // 生成组件
  async generateComponent(componentType, variables, options = {}) {
    const templateId = `component-${componentType}`;
    const template = await this.templateLibrary.getTemplate(templateId);

    if (!template) {
      throw new Error(`Component template ${componentType} not found`);
    }

    const {
      targetPath = 'src/components',
      fileExtension = 'js',
      styleExtension = 'css',
      testFramework = 'jest',
    } = options;

    // 准备组件变量
    const componentVars = {
      ...variables,
      componentName: this.pascalCase(variables.name),
      fileName: this.kebabCase(variables.name),
      fileExtension,
      styleExtension,
      testFramework,
      currentYear: new Date().getFullYear(),
    };

    // 生成文件列表
    const files = [
      {
        path: `${targetPath}/${componentVars.fileName}/index.${fileExtension}`,
        template: template.files.find(f => f.name === 'index').template,
      },
      {
        path: `${targetPath}/${componentVars.fileName}/${componentVars.fileName}.${fileExtension}`,
        template: template.files.find(f => f.name === 'component').template,
      },
      {
        path: `${targetPath}/${componentVars.fileName}/${componentVars.fileName}.styles.${styleExtension}`,
        template: template.files.find(f => f.name === 'styles').template,
      },
      {
        path: `${targetPath}/${componentVars.fileName}/${componentVars.fileName}.test.${fileExtension}`,
        template: template.files.find(f => f.name === 'test').template,
      },
      {
        path: `${targetPath}/${componentVars.fileName}/README.md`,
        template: template.files.find(f => f.name === 'readme').template,
      },
    ];

    // 渲染和写入文件
    for (const file of files) {
      const content = await this.renderer.render(file.template, componentVars);
      const filePath = path.resolve(file.path);

      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content);
    }

    // 更新组件索引文件
    await this.updateComponentIndex(targetPath, componentVars);

    return {
      componentName: componentVars.componentName,
      files: files.map(f => f.path),
      generatedAt: new Date(),
    };
  }

  // 更新组件索引
  async updateComponentIndex(componentsPath, componentVars) {
    const indexPath = path.join(componentsPath, 'index.js');
    let indexContent = '';

    if (await fs.pathExists(indexPath)) {
      indexContent = await fs.readFile(indexPath, 'utf8');
    }

    // 添加导出语句
    const exportStatement = `export { default as ${componentVars.componentName} } from './${componentVars.fileName}';\n`;

    if (!indexContent.includes(exportStatement)) {
      indexContent += exportStatement;
      await fs.writeFile(indexPath, indexContent);
    }
  }

  // 辅助方法
  pascalCase(str) {
    return str
      .split(/[-\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  kebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}
```

### 2. 配置模板管理

#### 2.1 环境配置模板

**多环境配置生成**:

```javascript
class ConfigurationTemplateGenerator {
  // 生成环境配置
  async generateEnvironmentConfig(environment, variables, options = {}) {
    const templateId = `config-${environment}`;
    const template = await this.templateLibrary.getTemplate(templateId);

    // 环境特定的变量
    const envVars = {
      ...variables,
      environment,
      isProduction: environment === 'production',
      isDevelopment: environment === 'development',
      isStaging: environment === 'staging',
      timestamp: new Date().toISOString(),
      version: options.version || '1.0.0',
    };

    // 敏感信息处理
    if (options.encryptSecrets) {
      envVars = await this.encryptSecrets(envVars);
    }

    // 生成配置文件
    const configFiles = [];

    for (const file of template.files) {
      const filePath = options.targetPath
        ? path.join(options.targetPath, file.path)
        : file.path;

      const content = await this.renderer.render(file.template, envVars);

      configFiles.push({
        path: filePath,
        content,
      });
    }

    // 写入文件
    for (const file of configFiles) {
      await fs.ensureDir(path.dirname(file.path));
      await fs.writeFile(file.path, file.content);
    }

    // 生成环境变量文件
    if (options.generateEnvFile) {
      await this.generateEnvFile(environment, envVars, options);
    }

    return {
      environment,
      files: configFiles.map(f => f.path),
      generatedAt: new Date(),
    };
  }

  // 生成环境变量文件
  async generateEnvFile(environment, variables, options) {
    const envFilePath = options.envFilePath || `.env.${environment}`;
    const envContent = this.generateEnvContent(variables);

    await fs.writeFile(envFilePath, envContent);

    return envFilePath;
  }

  // 生成.env文件内容
  generateEnvContent(variables) {
    const lines = [
      `# Environment: ${variables.environment}`,
      `# Generated at: ${variables.timestamp}`,
      '',
    ];

    // 递归处理变量
    this.flattenVariables(variables).forEach(({ key, value }) => {
      if (typeof value === 'string' && value.includes('\n')) {
        // 多行值
        lines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}=${value}`);
      }
    });

    return lines.join('\n');
  }

  // 扁平化嵌套变量
  flattenVariables(obj, prefix = '') {
    const flattened = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix
        ? `${prefix}_${key.toUpperCase()}`
        : key.toUpperCase();

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flattened.push(...this.flattenVariables(value, fullKey));
      } else {
        flattened.push({ key: fullKey, value });
      }
    }

    return flattened;
  }

  // 加密敏感信息
  async encryptSecrets(variables) {
    const encrypted = { ...variables };

    // 递归查找敏感字段
    this.traverseAndEncrypt(encrypted);

    return encrypted;
  }

  traverseAndEncrypt(obj, path = []) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = [...path, key];

      if (this.isSecretField(currentPath)) {
        if (typeof value === 'string') {
          obj[key] = this.encryptValue(value);
        }
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.traverseAndEncrypt(value, currentPath);
      }
    }
  }

  isSecretField(path) {
    const secretPatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /credential/i,
    ];

    const pathString = path.join('.');
    return secretPatterns.some(pattern => pattern.test(pathString));
  }

  encryptValue(value) {
    // 简单的加密实现，实际应该使用更安全的加密方法
    return `ENC(${Buffer.from(value).toString('base64')})`;
  }
}
```

#### 2.2 API文档模板

**自动API文档生成**:

```javascript
class APIDocumentationGenerator {
  // 生成API文档
  async generateAPIDocs(apiSpec, options = {}) {
    const {
      format = 'markdown',
      includeExamples = true,
      includeSchemas = true,
      targetPath = './docs/api',
    } = options;

    const docs = {
      overview: await this.generateAPIOverview(apiSpec),
      endpoints: await this.generateEndpointDocs(apiSpec),
      schemas: includeSchemas ? await this.generateSchemaDocs(apiSpec) : null,
      examples: includeExamples
        ? await this.generateExampleDocs(apiSpec)
        : null,
    };

    // 生成文档文件
    await fs.ensureDir(targetPath);

    const files = [];
    for (const [section, content] of Object.entries(docs)) {
      if (content) {
        const fileName = `${section}.${format}`;
        const filePath = path.join(targetPath, fileName);

        let fileContent;
        if (format === 'markdown') {
          fileContent = this.renderMarkdown(content);
        } else if (format === 'html') {
          fileContent = this.renderHTML(content);
        }

        await fs.writeFile(filePath, fileContent);
        files.push(filePath);
      }
    }

    // 生成索引文件
    const indexContent = this.generateIndexFile(docs, format);
    const indexPath = path.join(targetPath, `index.${format}`);
    await fs.writeFile(indexPath, indexContent);
    files.push(indexPath);

    return { files, generatedAt: new Date() };
  }

  // 生成API概览
  async generateAPIOverview(apiSpec) {
    return {
      title: apiSpec.info?.title || 'API Documentation',
      version: apiSpec.info?.version || '1.0.0',
      description: apiSpec.info?.description || '',
      servers: apiSpec.servers || [],
      security: apiSpec.security || [],
      tags: apiSpec.tags || [],
      externalDocs: apiSpec.externalDocs,
    };
  }

  // 生成端点文档
  async generateEndpointDocs(apiSpec) {
    const endpoints = {};

    for (const [path, pathItem] of Object.entries(apiSpec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const endpointKey = `${method.toUpperCase()} ${path}`;
          endpoints[endpointKey] = {
            method: method.toUpperCase(),
            path,
            summary: operation.summary || '',
            description: operation.description || '',
            parameters: operation.parameters || [],
            requestBody: operation.requestBody,
            responses: operation.responses || {},
            security: operation.security || [],
          };
        }
      }
    }

    return endpoints;
  }

  // 生成数据模式文档
  async generateSchemaDocs(apiSpec) {
    const schemas = {};

    for (const [name, schema] of Object.entries(
      apiSpec.components?.schemas || {}
    )) {
      schemas[name] = {
        name,
        type: schema.type,
        properties: schema.properties || {},
        required: schema.required || [],
        example: schema.example,
      };
    }

    return schemas;
  }

  // 生成示例文档
  async generateExampleDocs(apiSpec) {
    const examples = {};

    // 从响应和请求体中提取示例
    for (const [path, pathItem] of Object.entries(apiSpec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (operation.responses) {
          for (const [statusCode, response] of Object.entries(
            operation.responses
          )) {
            if (response.content) {
              for (const [contentType, mediaType] of Object.entries(
                response.content
              )) {
                if (mediaType.example) {
                  const key = `${method.toUpperCase()} ${path} - ${statusCode}`;
                  examples[key] = {
                    endpoint: `${method.toUpperCase()} ${path}`,
                    statusCode,
                    contentType,
                    example: mediaType.example,
                  };
                }
              }
            }
          }
        }
      }
    }

    return examples;
  }

  // 渲染Markdown
  renderMarkdown(data) {
    // 简化的Markdown渲染实现
    if (data.title) {
      let md = `# ${data.title}\n\n`;
      if (data.description) md += `${data.description}\n\n`;

      if (data.endpoints) {
        md += '## Endpoints\n\n';
        for (const [endpoint, info] of Object.entries(data.endpoints)) {
          md += `### ${endpoint}\n\n`;
          if (info.summary) md += `${info.summary}\n\n`;
          if (info.description) md += `${info.description}\n\n`;
          // 添加更多详细信息...
        }
      }

      return md;
    }

    return JSON.stringify(data, null, 2);
  }

  // 生成索引文件
  generateIndexFile(docs, format) {
    const index = {
      title: 'API Documentation Index',
      sections: Object.keys(docs).filter(key => docs[key]),
      generatedAt: new Date().toISOString(),
    };

    if (format === 'markdown') {
      let md = '# API Documentation Index\n\n';
      md += `Generated: ${index.generatedAt}\n\n`;
      md += '## Sections\n\n';

      index.sections.forEach(section => {
        md += `- [${section}](./${section}.md)\n`;
      });

      return md;
    }

    return JSON.stringify(index, null, 2);
  }
}
```

---

## 📈 发展规划

### 1. 短期规划 (0-6个月)

#### 1.1 模板引擎完善

- [ ] **多格式支持**
  - [ ] 支持更多模板引擎 (Nunjucks, Pug)
  - [ ] 添加模板预编译功能
  - [ ] 实现模板语法检查

- [ ] **模板管理优化**
  - [ ] 实现模板版本控制
  - [ ] 添加模板依赖解析
  - [ ] 支持模板继承和组合

- [ ] **代码生成增强**
  - [ ] 基于AST的智能代码生成
  - [ ] 支持多语言代码生成
  - [ ] 实现代码质量检查

#### 1.2 模板库建设

- [ ] **核心模板开发**
  - [ ] 完善项目模板库
  - [ ] 丰富组件模板集合
  - [ ] 建立配置模板体系

- [ ] **质量保证**
  - [ ] 建立模板评审流程
  - [ ] 实现模板自动化测试
  - [ ] 添加模板使用统计

### 2. 中期规划 (6-12个月)

#### 2.1 智能化模板

- [ ] **AI辅助生成**
  - [ ] 基于描述的模板推荐
  - [ ] 模板自动完善和优化
  - [ ] 代码生成AI集成

- [ ] **自适应模板**
  - [ ] 基于项目特征的模板定制
  - [ ] 模板使用模式学习
  - [ ] 动态模板更新

- [ ] **模板生态**
  - [ ] 第三方模板市场
  - [ ] 模板贡献者激励
  - [ ] 模板质量认证体系

#### 2.2 企业级功能

- [ ] **企业模板管理**
  - [ ] 企业私有模板库
  - [ ] 模板治理和审批
  - [ ] 企业级模板定制

- [ ] **合规与安全**
  - [ ] 模板安全审计
  - [ ] 代码生成安全检查
  - [ ] 企业合规模板库

### 3. 长期规划 (12-24个月)

#### 3.1 平台化发展

- [ ] **模板平台**
  - [ ] Web界面模板管理
  - [ ] 模板协作开发环境
  - [ ] 模板版本发布流程

- [ ] **智能化平台**
  - [ ] AI驱动的模板生成
  - [ ] 自动化模板维护
  - [ ] 模板效果预测分析

#### 3.2 开源生态

- [ ] **全球模板社区**
  - [ ] 多语言模板支持
  - [ ] 国际化模板协作
  - [ ] 模板标准制定

- [ ] **模板即服务**
  - [ ] 云端模板服务
  - [ ] 模板SaaS平台
  - [ ] API驱动的模板生成

---

## 🔗 依赖关系

### 1. 内部依赖

#### 1.1 强依赖模块

```
模板模块依赖关系:
├── 工具模块 (Bin Module)
│   ├── 提供代码生成能力
│   └── 调用模板管理功能
├── 核心模块 (Core Module)
│   ├── 使用配置模板
│   └── 提供模板化服务
├── 管理模块 (Admin Module)
│   ├── 使用UI模板
│   └── 管理模板资源
└── 测试模块 (Test Module)
    ├── 使用测试模板
    └── 验证模板生成结果
```

#### 1.2 可选依赖模块

```
可选依赖:
├── 文档模块 (Docs Module) - 生成模板文档
└── 部署模块 (Docker Module) - 容器化模板运行环境
```

### 2. 外部依赖

#### 2.1 模板引擎依赖

```json
{
  "核心引擎": {
    "ejs": "^3.1.9",
    "handlebars": "^4.7.8",
    "mustache": "^4.2.0",
    "nunjucks": "^3.2.4"
  },
  "代码处理": {
    "@babel/parser": "^7.22.0",
    "@babel/generator": "^7.22.0",
    "prettier": "^3.0.0",
    "eslint": "^8.45.0"
  },
  "文件处理": {
    "fs-extra": "^11.1.0",
    "glob": "^10.3.0",
    "chokidar": "^3.5.0"
  }
}
```

#### 2.2 工具库依赖

```json
{
  "数据处理": {
    "lodash": "^4.17.0",
    "crypto-js": "^4.1.0",
    "uuid": "^9.0.0"
  },
  "格式转换": {
    "js-yaml": "^4.1.0",
    "csv-parser": "^3.0.0",
    "xml2js": "^0.6.0"
  },
  "网络请求": {
    "axios": "^1.4.0",
    "node-fetch": "^3.3.0"
  }
}
```

---

## 🧪 测试策略

### 1. 模板测试

#### 1.1 模板渲染测试

**模板引擎测试**:

```javascript
describe('Template Engine', () => {
  let engine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('EJS Templates', () => {
    test('should render simple variables', async () => {
      const template = 'Hello, <%= name %>!';
      const variables = { name: 'World' };
      const result = await engine.render(template, variables, 'ejs');

      expect(result).toBe('Hello, World!');
    });

    test('should handle complex expressions', async () => {
      const template =
        '<% if (user.isAdmin) { %>Admin<% } else { %>User<% } %>';
      const variables = { user: { isAdmin: true } };
      const result = await engine.render(template, variables, 'ejs');

      expect(result).toBe('Admin');
    });

    test('should handle loops', async () => {
      const template =
        '<% items.forEach(item => { %><li><%= item %></li><% }); %>';
      const variables = { items: ['a', 'b', 'c'] };
      const result = await engine.render(template, variables, 'ejs');

      expect(result).toBe('<li>a</li><li>b</li><li>c</li>');
    });
  });

  describe('Variable Validation', () => {
    test('should validate required variables', async () => {
      const template = {
        content: 'Hello, <%= name %>!',
        variables: ['name'],
      };

      await expect(engine.render(template, {}, 'ejs')).rejects.toThrow(
        'Missing required variables'
      );
    });

    test('should handle optional variables', async () => {
      const template = {
        content: 'Hello, <%= name || "Guest" %>!',
        variables: [],
      };

      const result = await engine.render(template, {}, 'ejs');
      expect(result).toBe('Hello, Guest!');
    });
  });

  describe('Error Handling', () => {
    test('should handle template syntax errors', async () => {
      const template = 'Hello, <%= invalid.syntax %>!';
      const variables = {};

      await expect(engine.render(template, variables, 'ejs')).rejects.toThrow();
    });

    test('should handle missing helpers', async () => {
      const template = '<%= unknownHelper() %>';
      const variables = {};

      await expect(engine.render(template, variables, 'ejs')).rejects.toThrow();
    });
  });
});
```

#### 1.2 模板库测试

**模板管理测试**:

```javascript
describe('Template Library', () => {
  let library;

  beforeEach(() => {
    library = new TemplateLibrary();
  });

  describe('Template Registration', () => {
    test('should register template successfully', () => {
      const template = {
        name: 'Test Template',
        description: 'A test template',
        category: 'component',
        tags: ['test', 'component'],
        variables: ['name'],
        files: [{ path: 'index.js', template: 'console.log("<%= name %>");' }],
      };

      const result = library.registerTemplate('test-template', template);

      expect(result.id).toBe('test-template');
      expect(result.name).toBe('Test Template');
      expect(result.category).toBe('component');
      expect(result.tags).toEqual(['test', 'component']);
    });

    test('should categorize templates correctly', () => {
      const template = {
        name: 'Component Template',
        category: 'component',
        files: [],
      };

      library.registerTemplate('component-template', template);

      const categories = library.getCategories();
      expect(categories.component.templates).toContain('component-template');
    });
  });

  describe('Template Search', () => {
    beforeEach(() => {
      library.registerTemplate('react-component', {
        name: 'React Component',
        tags: ['react', 'component', 'ui'],
        category: 'component',
      });

      library.registerTemplate('vue-component', {
        name: 'Vue Component',
        tags: ['vue', 'component', 'ui'],
        category: 'component',
      });
    });

    test('should search by name', () => {
      const results = library.searchTemplates('React');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('React Component');
    });

    test('should search by tags', () => {
      const results = library.searchTemplates('', { tags: ['ui'] });

      expect(results).toHaveLength(2);
    });

    test('should filter by category', () => {
      const results = library.searchTemplates('', { category: 'component' });

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.category).toBe('component');
      });
    });
  });
});
```

### 2. 集成测试

#### 2.1 项目生成测试

**端到端项目生成**:

```javascript
describe('Project Generation E2E', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp('/tmp/template-test-');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('should generate complete project structure', async () => {
    const generator = new ProjectGenerator();
    const projectName = 'test-project';

    await generator.generateProject(
      'basic-api',
      {
        name: projectName,
        description: 'A test project',
        author: 'Test Author',
      },
      {
        targetPath: tempDir,
      }
    );

    const projectPath = path.join(tempDir, projectName);

    // 检查项目结构
    expect(await fs.pathExists(path.join(projectPath, 'package.json'))).toBe(
      true
    );
    expect(await fs.pathExists(path.join(projectPath, 'src/index.js'))).toBe(
      true
    );
    expect(await fs.pathExists(path.join(projectPath, 'README.md'))).toBe(true);
    expect(await fs.pathExists(path.join(projectPath, 'test'))).toBe(true);
  });

  test('should generate valid package.json', async () => {
    const generator = new ProjectGenerator();

    await generator.generateProject(
      'basic-api',
      {
        name: 'test-package',
        version: '1.0.0',
      },
      {
        targetPath: tempDir,
      }
    );

    const packageJsonPath = path.join(tempDir, 'test-package', 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);

    expect(packageJson.name).toBe('test-package');
    expect(packageJson.version).toBe('1.0.0');
    expect(packageJson.dependencies).toBeDefined();
    expect(packageJson.scripts).toBeDefined();
  });

  test('should install dependencies correctly', async () => {
    const generator = new ProjectGenerator();

    await generator.generateProject(
      'basic-api',
      {
        name: 'test-deps',
      },
      {
        targetPath: tempDir,
        installDeps: true,
      }
    );

    const nodeModulesPath = path.join(tempDir, 'test-deps', 'node_modules');
    expect(await fs.pathExists(nodeModulesPath)).toBe(true);
  });
});
```

---

## 🔧 维护计划

### 1. 日常维护

#### 1.1 模板库维护

**模板更新**:

- [ ] 定期检查模板依赖更新
- [ ] 验证模板生成结果有效性
- [ ] 更新过时的模板内容
- [ ] 添加新的模板类型

**模板质量**:

- [ ] 定期审查模板代码质量
- [ ] 测试模板在不同环境的兼容性
- [ ] 收集用户对模板的反馈
- [ ] 优化模板生成性能

#### 1.2 引擎维护

**引擎优化**:

- [ ] 监控模板渲染性能
- [ ] 优化模板解析算法
- [ ] 更新模板引擎依赖
- [ ] 改进错误处理机制

**缓存管理**:

- [ ] 定期清理过期缓存
- [ ] 监控缓存命中率
- [ ] 优化缓存策略
- [ ] 处理缓存一致性问题

### 2. 版本管理

#### 2.1 模板版本控制

**版本策略**:

```javascript
class TemplateVersionManager {
  // 模板版本管理
  async createTemplateVersion(templateId, changes, options = {}) {
    const template = await this.templateLibrary.getTemplate(templateId);
    const version = this.generateVersion(template.version, changes);

    const versionData = {
      templateId,
      version,
      changes,
      timestamp: new Date(),
      author: options.author || 'system',
      checksum: await this.calculateTemplateChecksum(template),
      backwardCompatible: this.isBackwardCompatible(changes),
    };

    await this.store.saveTemplateVersion(versionData);

    // 更新模板版本
    template.version = version;
    template.updatedAt = new Date();

    await this.templateLibrary.updateTemplate(templateId, template);

    return versionData;
  }

  // 版本兼容性检查
  isBackwardCompatible(changes) {
    // 检查破坏性变更
    const breakingChanges = changes.filter(
      change =>
        change.type === 'breaking' ||
        change.type === 'remove' ||
        change.type === 'rename'
    );

    return breakingChanges.length === 0;
  }

  // 生成版本号
  generateVersion(currentVersion, changes) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    const hasBreaking = changes.some(c => c.type === 'breaking');
    const hasFeatures = changes.some(c => c.type === 'feature');
    const hasFixes = changes.some(c => c.type === 'fix');

    if (hasBreaking) {
      return `${major + 1}.0.0`;
    } else if (hasFeatures) {
      return `${major}.${minor + 1}.0`;
    } else if (hasFixes) {
      return `${major}.${minor}.${patch + 1}`;
    }

    return currentVersion;
  }

  // 回滚模板版本
  async rollbackTemplateVersion(templateId, version) {
    const versionData = await this.store.getTemplateVersion(
      templateId,
      version
    );
    const template = await this.templateLibrary.getTemplate(templateId);

    // 恢复模板内容
    const restoredTemplate = {
      ...template,
      ...versionData.templateSnapshot,
      version,
      updatedAt: new Date(),
    };

    await this.templateLibrary.updateTemplate(templateId, restoredTemplate);

    return restoredTemplate;
  }
}
```

#### 2.2 发布管理

**模板发布流程**:

- [ ] 模板代码审查
- [ ] 自动化测试验证
- [ ] 兼容性测试
- [ ] 版本号分配
- [ ] 发布到模板仓库
- [ ] 更新文档和示例

### 3. 技术债务管理

#### 3.1 模板债务识别

**代码债务**:

- [ ] 模板代码重复问题
- [ ] 模板结构不一致
- [ ] 变量命名不规范
- [ ] 模板测试覆盖不足

**架构债务**:

- [ ] 模板引擎耦合度高
- [ ] 模板解析性能瓶颈
- [ ] 模板缓存策略不优
- [ ] 模板版本管理复杂

#### 3.2 债务偿还计划

**优先级排序**:

1. **P0 (紧急)**: 影响模板生成正确性的债务
2. **P1 (重要)**: 影响模板使用体验的债务
3. **P2 (一般)**: 影响模板维护效率的债务

**偿还策略**:

- [ ] 每个月度发布周期安排2-3个模板债务偿还任务
- [ ] 设立模板债务KPI指标 (每月减少15%)
- [ ] 定期模板债务评审会议，确保债务不积累

### 4. 文档维护

#### 4.1 模板文档体系

**文档结构**:

- [ ] **模板指南**: 模板使用和开发指南
- [ ] **API文档**: 模板引擎API文档
- [ ] **示例库**: 丰富的使用示例
- [ ] **最佳实践**: 模板设计和使用最佳实践

**自动化文档生成**:

```javascript
class TemplateDocumentationGenerator {
  // 生成模板文档
  async generateTemplateDocs(templateId) {
    const template = await this.templateLibrary.getTemplate(templateId);

    return {
      overview: {
        name: template.name,
        description: template.description,
        category: template.category,
        version: template.version,
        author: template.author,
      },
      variables: await this.documentVariables(template.variables),
      files: await this.documentFiles(template.files),
      usage: await this.generateUsageExamples(template),
      changelog: await this.generateChangelog(templateId),
    };
  }

  // 文档化变量
  async documentVariables(variables) {
    return variables.map(variable => ({
      name: variable.name,
      type: variable.type,
      description: variable.description,
      required: variable.required !== false,
      default: variable.default,
      validation: variable.validation,
    }));
  }

  // 文档化文件
  async documentFiles(files) {
    return files.map(file => ({
      path: file.path,
      description: file.description,
      template: file.template.substring(0, 100) + '...',
    }));
  }

  // 生成使用示例
  async generateUsageExamples(template) {
    const examples = [];

    // 基本使用示例
    examples.push({
      title: 'Basic Usage',
      description: 'Simple template usage example',
      code: await this.generateBasicExample(template),
    });

    // 高级使用示例
    if (template.variables.length > 3) {
      examples.push({
        title: 'Advanced Usage',
        description: 'Complex template usage with all variables',
        code: await this.generateAdvancedExample(template),
      });
    }

    return examples;
  }

  // 生成变更日志
  async generateChangelog(templateId) {
    const versions = await this.versionManager.getTemplateVersions(templateId);

    return versions.map(version => ({
      version: version.version,
      date: version.timestamp,
      changes: version.changes,
      author: version.author,
    }));
  }
}
```

---

## 📊 成功指标

### 1. 模板质量指标

#### 1.1 功能完整性

- [ ] **模板覆盖率**: 支持10+ 项目类型和组件类型
- [ ] **变量完备性**: 模板变量覆盖率 > 90%
- [ ] **生成成功率**: 模板生成成功率 > 95%
- [ ] **代码质量**: 生成代码通过Lint检查

#### 1.2 使用体验

- [ ] **生成速度**: 模板生成时间 < 5秒
- [ ] **错误友好**: 明确的错误提示和修复建议
- [ ] **文档完备**: 100%模板有使用文档
- [ ] **示例丰富**: 每个模板至少2个使用示例

### 2. 模板库指标

#### 2.1 模板丰富度

- [ ] **模板数量**: 100+ 可用模板
- [ ] **分类完整**: 覆盖所有主要开发场景
- [ ] **版本控制**: 所有模板都有版本管理
- [ ] **依赖管理**: 模板依赖关系清晰

#### 2.2 社区活跃度

- [ ] **下载量**: 月下载量 1000+
- [ ] **贡献者**: 20+ 活跃模板贡献者
- [ ] **使用反馈**: 月均50+ 用户反馈
- [ ] **更新频率**: 每周有模板更新

### 3. 引擎性能指标

#### 3.1 渲染性能

- [ ] **渲染速度**: 模板渲染时间 < 1秒
- [ ] **内存使用**: 渲染内存占用 < 50MB
- [ ] **并发处理**: 支持100+ 并发渲染
- [ ] **缓存效率**: 缓存命中率 > 80%

#### 3.2 可靠性指标

- [ ] **渲染成功率**: 模板渲染成功率 > 99%
- [ ] **错误处理**: 完善的错误处理和恢复机制
- [ ] **向后兼容**: 模板引擎向后兼容性100%
- [ ] **安全检查**: 模板渲染安全检查覆盖率100%

---

## 🎯 总结

模板模块作为Sira AI网关的"代码模板库"，承担着开发资源模板化、代码生成自动化、项目结构标准化的重要职责。通过精心设计的模板引擎、丰富的模板库、严格的质量控制和完善的文档体系，模板模块能够：

**技术优势**:

- 多格式模板引擎支持灵活的代码生成
- 智能模板管理实现高效的模板组织和搜索
- 自动化的依赖解析和安装简化项目初始化
- 版本控制和质量保证确保模板的稳定性和可靠性

**业务价值**:

- 大幅提升开发效率，减少重复性工作
- 保证项目结构一致性，提高代码质量
- 降低新成员上手成本，加速团队扩张
- 建立标准化开发流程，提升团队协作效率

**架构亮点**:

- 分层架构设计，各司其职，易于维护和扩展
- 插件化模板引擎，支持多种模板格式和自定义扩展
- 智能缓存和性能优化，确保高效的模板处理
- 完整的测试覆盖和质量监控，保证系统稳定性

通过持续的模板积累、质量优化和社区建设，模板模块将成为现代软件开发不可或缺的基础设施，为开发者提供强大而灵活的代码生成和项目管理能力。
