# 📚 文档模块 (Docs Module) 详细规划

## 📋 模块概述

**文档模块** 是Sira AI网关的"知识库与学习中心"，提供全面的技术文档、用户指南、API参考、教程等内容。它是连接开发者和用户的桥梁，确保项目的可理解性、可维护性和可扩展性。

### 定位与职责

- **系统定位**: 项目的知识管理和传播中心，提供全方位文档服务
- **主要职责**: 文档生成、版本管理、内容组织、知识共享
- **设计理念**: 自动化生成、持续更新、用户友好、多格式支持

### 架构层次

```
文档模块架构:
├── 📝 内容生成层 (Content Generation Layer)
│   ├── 代码文档生成 (Code Documentation)
│   ├── API文档生成 (API Documentation)
│   ├── 用户指南生成 (User Guide Generation)
│   └── 教程内容生成 (Tutorial Content)
├── 📚 内容管理层 (Content Management Layer)
│   ├── 文档版本控制 (Documentation Versioning)
│   ├── 内容组织结构 (Content Organization)
│   ├── 搜索和索引 (Search & Indexing)
│   └── 多语言支持 (Multi-language Support)
├── 🌐 发布分发层 (Publishing & Distribution Layer)
│   ├── 静态站点生成 (Static Site Generation)
│   ├── 多格式输出 (Multi-format Output)
│   ├── CDN分发 (CDN Distribution)
│   └── 离线文档包 (Offline Documentation)
└── 📊 分析洞察层 (Analytics & Insights Layer)
    ├── 使用统计分析 (Usage Analytics)
    ├── 内容质量评估 (Content Quality Assessment)
    ├── 用户反馈收集 (User Feedback Collection)
    └── 改进建议生成 (Improvement Recommendations)
```

---

## 🏗️ 架构设计

### 1. 文档生成系统

#### 1.1 代码文档自动生成

**智能文档提取**:

```javascript
class CodeDocumentationGenerator {
  constructor() {
    this.parsers = new Map();
    this.templates = new Map();
    this.initializeParsers();
  }

  // 初始化解析器
  initializeParsers() {
    // JavaScript/TypeScript解析器
    this.parsers.set('js', new JavaScriptParser());
    this.parsers.set('ts', new TypeScriptParser());

    // Python解析器
    this.parsers.set('py', new PythonParser());

    // Go解析器
    this.parsers.set('go', new GoParser());

    // 配置模板
    this.loadDocumentationTemplates();
  }

  // 生成代码文档
  async generateCodeDocumentation(sourcePath, options = {}) {
    const {
      format = 'markdown',
      includePrivate = false,
      includeExamples = true,
      outputPath = './docs/api',
    } = options;

    log_info(`Generating documentation for: ${sourcePath}`);

    // 解析源代码
    const documentation = await this.parseSourceCode(sourcePath, {
      includePrivate,
      includeExamples,
    });

    // 生成文档结构
    const docStructure = this.buildDocumentationStructure(documentation);

    // 渲染文档
    const renderedDocs = await this.renderDocumentation(docStructure, format);

    // 写入文件
    await this.writeDocumentationFiles(renderedDocs, outputPath);

    // 生成索引
    await this.generateDocumentationIndex(docStructure, outputPath);

    log_success(`Documentation generated successfully at: ${outputPath}`);

    return {
      files: renderedDocs.length,
      outputPath,
      format,
      generatedAt: new Date(),
    };
  }

  // 解析源代码
  async parseSourceCode(sourcePath, options) {
    const files = await this.findSourceFiles(sourcePath);
    const documentation = {
      modules: [],
      classes: [],
      functions: [],
      types: [],
      examples: [],
    };

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const extension = path.extname(file).slice(1);

      const parser = this.parsers.get(extension);
      if (parser) {
        const fileDocs = await parser.parse(content, file, options);
        this.mergeDocumentation(documentation, fileDocs);
      }
    }

    return documentation;
  }

  // 查找源文件
  async findSourceFiles(sourcePath) {
    const patterns = [
      '**/*.js',
      '**/*.ts',
      '**/*.py',
      '**/*.go',
      '!node_modules/**',
      '!dist/**',
      '!build/**',
      '!.git/**',
    ];

    const files = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: sourcePath });
      files.push(...matches.map(file => path.join(sourcePath, file)));
    }

    return files;
  }

  // 构建文档结构
  buildDocumentationStructure(documentation) {
    return {
      overview: this.generateOverview(documentation),
      modules: this.organizeByModules(documentation.modules),
      api: {
        classes: this.organizeClasses(documentation.classes),
        functions: this.organizeFunctions(documentation.functions),
        types: this.organizeTypes(documentation.types),
      },
      examples: documentation.examples,
      changelog: this.generateChangelog(),
      migration: this.generateMigrationGuide(),
    };
  }

  // 生成概览
  generateOverview(documentation) {
    const stats = {
      modules: documentation.modules.length,
      classes: documentation.classes.length,
      functions: documentation.functions.length,
      types: documentation.types.length,
    };

    return {
      title: 'API Overview',
      description: 'Complete API reference for the project',
      statistics: stats,
      quickStart: this.generateQuickStart(),
      gettingStarted: this.generateGettingStarted(),
    };
  }

  // 渲染文档
  async renderDocumentation(docStructure, format) {
    const rendered = [];

    for (const [section, content] of Object.entries(docStructure)) {
      const template = this.templates.get(`${section}.${format}`);
      if (template) {
        const renderedContent = await this.renderTemplate(template, content);
        rendered.push({
          section,
          content: renderedContent,
          filename: `${section}.${format === 'markdown' ? 'md' : format}`,
        });
      }
    }

    return rendered;
  }

  // 生成文档索引
  async generateDocumentationIndex(docStructure, outputPath) {
    const index = {
      title: 'Documentation Index',
      sections: Object.keys(docStructure).map(section => ({
        name: section,
        title: this.formatTitle(section),
        path: `${section}.md`,
      })),
      generatedAt: new Date().toISOString(),
    };

    const indexContent = await this.renderTemplate(
      this.templates.get('index.markdown'),
      index
    );

    await fs.writeFile(path.join(outputPath, 'README.md'), indexContent);
  }
}

// JavaScript文档解析器
class JavaScriptParser {
  async parse(content, filePath, options) {
    const documentation = {
      modules: [],
      classes: [],
      functions: [],
      types: [],
      examples: [],
    };

    // 使用抽象语法树解析
    const ast = await this.parseJavaScriptAST(content);

    // 提取JSDoc注释
    const jsdocComments = this.extractJSDocComments(ast);

    // 解析导出
    const exports = this.extractExports(ast);

    // 合并信息
    for (const exportItem of exports) {
      const jsdoc = jsdocComments.find(
        comment => comment.line === exportItem.line - 1
      );

      if (jsdoc) {
        const docItem = this.parseJSDoc(jsdoc, exportItem);
        this.categorizeDocumentationItem(docItem, documentation);
      }
    }

    return documentation;
  }

  // 解析JSDoc注释
  parseJSDoc(jsdoc, exportItem) {
    const parsed = {
      name: exportItem.name,
      type: exportItem.type,
      description: '',
      params: [],
      returns: null,
      examples: [],
      deprecated: false,
      since: null,
      file: exportItem.file,
      line: exportItem.line,
    };

    // 解析JSDoc标签
    const lines = jsdoc.comment.split('\n');
    let currentTag = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('@')) {
        currentTag = trimmed.split(' ')[0].slice(1);
        const content = trimmed.slice(currentTag.length + 1).trim();

        switch (currentTag) {
          case 'param':
            parsed.params.push(this.parseParam(content));
            break;
          case 'returns':
          case 'return':
            parsed.returns = this.parseReturn(content);
            break;
          case 'example':
            parsed.examples.push(content);
            break;
          case 'deprecated':
            parsed.deprecated = true;
            break;
          case 'since':
            parsed.since = content;
            break;
        }
      } else if (currentTag === 'example') {
        parsed.examples[parsed.examples.length - 1] += '\n' + trimmed;
      } else if (!parsed.description && trimmed) {
        parsed.description = trimmed;
      }
    }

    return parsed;
  }

  // 解析参数
  parseParam(paramString) {
    const match = paramString.match(/\{([^}]+)\}\s+(\w+)(\s+(.+))?/);
    if (match) {
      return {
        type: match[1],
        name: match[2],
        description: match[4] || '',
      };
    }
    return { name: paramString, type: 'any', description: '' };
  }

  // 解析返回值
  parseReturn(returnString) {
    const match = returnString.match(/\{([^}]+)\}\s+(.+)?/);
    if (match) {
      return {
        type: match[1],
        description: match[2] || '',
      };
    }
    return { type: 'any', description: returnString };
  }
}
```

#### 1.2 API文档生成

**RESTful API文档**:

```javascript
class APIDocumentationGenerator {
  constructor() {
    this.parsers = new Map();
    this.formatters = new Map();
    this.initializeComponents();
  }

  // 初始化组件
  initializeComponents() {
    // 支持的API规范
    this.parsers.set('openapi', new OpenAPIParser());
    this.parsers.set('swagger', new SwaggerParser());
    this.parsers.set('express', new ExpressRouteParser());

    // 输出格式
    this.formatters.set('markdown', new MarkdownFormatter());
    this.formatters.set('html', new HTMLFormatter());
    this.formatters.set('pdf', new PDFFormatter());
  }

  // 生成API文档
  async generateAPIDocumentation(apiSpec, options = {}) {
    const {
      format = 'markdown',
      includeExamples = true,
      includeSchemas = true,
      outputPath = './docs/api',
      theme = 'default',
    } = options;

    log_info('Generating API documentation...');

    // 解析API规范
    const parser = this.parsers.get(apiSpec.format || 'openapi');
    if (!parser) {
      throw new Error(`Unsupported API format: ${apiSpec.format}`);
    }

    const parsedAPI = await parser.parse(apiSpec);

    // 增强API信息
    const enhancedAPI = await this.enhanceAPIDocumentation(parsedAPI, options);

    // 生成文档结构
    const docStructure = this.buildAPIStructure(enhancedAPI);

    // 格式化输出
    const formatter = this.formatters.get(format);
    if (!formatter) {
      throw new Error(`Unsupported output format: ${format}`);
    }

    const formattedDocs = await formatter.format(docStructure, {
      theme,
      includeExamples,
      includeSchemas,
    });

    // 写入文件
    await this.writeAPIDocumentation(formattedDocs, outputPath);

    // 生成交互式文档
    if (options.generateInteractive) {
      await this.generateInteractiveDocs(docStructure, outputPath);
    }

    log_success(`API documentation generated at: ${outputPath}`);

    return {
      endpoints: docStructure.endpoints.length,
      schemas: docStructure.schemas.length,
      outputPath,
      format,
      generatedAt: new Date(),
    };
  }

  // 构建API文档结构
  buildAPIStructure(parsedAPI) {
    return {
      info: parsedAPI.info,
      servers: parsedAPI.servers,
      security: parsedAPI.security,
      endpoints: this.organizeEndpoints(parsedAPI.endpoints),
      schemas: this.organizeSchemas(parsedAPI.schemas),
      examples: parsedAPI.examples,
      changelog: this.generateAPIChangelog(parsedAPI),
      sdk: this.generateSDKDocumentation(parsedAPI),
    };
  }

  // 组织端点
  organizeEndpoints(endpoints) {
    const organized = {};

    for (const endpoint of endpoints) {
      const tag = endpoint.tags?.[0] || 'default';

      if (!organized[tag]) {
        organized[tag] = [];
      }

      organized[tag].push({
        method: endpoint.method,
        path: endpoint.path,
        summary: endpoint.summary,
        description: endpoint.description,
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responses: endpoint.responses,
        security: endpoint.security,
        examples: endpoint.examples,
      });
    }

    return organized;
  }

  // 组织数据模式
  organizeSchemas(schemas) {
    const organized = {
      models: [],
      enums: [],
      primitives: [],
    };

    for (const [name, schema] of Object.entries(schemas)) {
      const category = this.categorizeSchema(schema);

      organized[category].push({
        name,
        schema,
        description: schema.description,
        examples: schema.examples,
      });
    }

    return organized;
  }

  // 分类数据模式
  categorizeSchema(schema) {
    if (schema.enum) {
      return 'enums';
    }

    if (schema.type === 'object' && schema.properties) {
      return 'models';
    }

    return 'primitives';
  }

  // 生成交互式文档
  async generateInteractiveDocs(docStructure, outputPath) {
    const interactivePath = path.join(outputPath, 'interactive');

    // 生成HTML页面
    const htmlContent = await this.renderInteractiveHTML(docStructure);

    // 生成JavaScript
    const jsContent = await this.renderInteractiveJS(docStructure);

    // 生成CSS
    const cssContent = await this.renderInteractiveCSS();

    // 写入文件
    await fs.writeFile(path.join(interactivePath, 'index.html'), htmlContent);
    await fs.writeFile(path.join(interactivePath, 'app.js'), jsContent);
    await fs.writeFile(path.join(interactivePath, 'styles.css'), cssContent);

    log_info('Interactive API documentation generated');
  }

  // 增强API文档
  async enhanceAPIDocumentation(parsedAPI, options) {
    const enhanced = { ...parsedAPI };

    // 添加使用统计
    if (options.includeUsage) {
      enhanced.usage = await this.collectAPIUsageStatistics();
    }

    // 添加性能指标
    if (options.includePerformance) {
      enhanced.performance = await this.collectAPIPerformanceMetrics();
    }

    // 添加错误示例
    if (options.includeErrors) {
      enhanced.errors = await this.collectAPIErrorExamples();
    }

    // 添加最佳实践
    enhanced.bestPractices = this.generateAPIBestPractices();

    return enhanced;
  }

  // 生成API变更日志
  generateAPIChangelog(parsedAPI) {
    // 这里应该从Git历史或变更文件中生成
    return {
      versions: [
        {
          version: '1.0.0',
          date: '2024-01-01',
          changes: [
            'Initial API release',
            'Basic CRUD operations for all resources',
          ],
        },
      ],
    };
  }

  // 生成SDK文档
  generateSDKDocumentation(parsedAPI) {
    const sdks = ['javascript', 'python', 'java', 'go'];

    const sdkDocs = {};

    for (const language of sdks) {
      sdkDocs[language] = {
        installation: this.generateSDKInstallation(language),
        quickStart: this.generateSDKQuickStart(language, parsedAPI),
        examples: this.generateSDKExamples(language, parsedAPI),
        reference: this.generateSDKReference(language, parsedAPI),
      };
    }

    return sdkDocs;
  }
}

// OpenAPI解析器
class OpenAPIParser {
  async parse(spec) {
    // 解析OpenAPI 3.0规范
    const parsed = {
      info: spec.info,
      servers: spec.servers || [],
      security: spec.security || [],
      endpoints: [],
      schemas: spec.components?.schemas || {},
      examples: spec.components?.examples || {},
    };

    // 解析路径
    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          parsed.endpoints.push({
            method: method.toUpperCase(),
            path,
            ...operation,
          });
        }
      }
    }

    return parsed;
  }
}
```

### 2. 文档管理系统

#### 2.1 版本控制系统

**文档版本管理**:

```javascript
class DocumentationVersionControl {
  constructor() {
    this.repository = new GitRepository();
    this.versions = new Map();
    this.changelog = [];
  }

  // 初始化文档版本控制
  async initialize() {
    // 检查是否为Git仓库
    if (!(await this.repository.isGitRepository())) {
      throw new Error('Documentation must be in a Git repository');
    }

    // 加载版本历史
    await this.loadVersionHistory();

    // 设置版本钩子
    await this.setupVersionHooks();
  }

  // 创建文档版本
  async createVersion(version, changes, options = {}) {
    const {
      message = `Release version ${version}`,
      author = process.env.USER || 'system',
      branch = 'main',
    } = options;

    log_info(`Creating documentation version: ${version}`);

    // 验证版本号
    this.validateVersion(version);

    // 生成版本文件
    const versionFile = await this.generateVersionFile(version, changes);

    // 生成变更日志
    await this.updateChangelog(version, changes, author);

    // 提交版本
    await this.commitVersion(versionFile, message);

    // 创建标签
    await this.tagVersion(version, message);

    // 更新版本索引
    await this.updateVersionIndex(version);

    log_success(`Documentation version ${version} created`);

    return {
      version,
      files: [versionFile],
      changelog: this.changelog,
      createdAt: new Date(),
    };
  }

  // 生成版本文件
  async generateVersionFile(version, changes) {
    const versionDir = `docs/versions/${version}`;
    await fs.ensureDir(versionDir);

    const versionFile = `${versionDir}/index.json`;

    const versionData = {
      version,
      createdAt: new Date().toISOString(),
      changes: changes.map(change => ({
        type: change.type,
        description: change.description,
        files: change.files || [],
        breaking: change.breaking || false,
      })),
      checksums: await this.calculateFileChecksums(changes),
      metadata: {
        author: process.env.USER || 'system',
        branch: await this.repository.getCurrentBranch(),
        commit: await this.repository.getCurrentCommit(),
      },
    };

    await fs.writeJson(versionFile, versionData, { spaces: 2 });

    return versionFile;
  }

  // 更新变更日志
  async updateChangelog(version, changes, author) {
    const changelogEntry = {
      version,
      date: new Date().toISOString(),
      author,
      changes: changes.map(change => ({
        type: this.formatChangeType(change.type),
        description: change.description,
        scope: change.scope,
      })),
    };

    this.changelog.unshift(changelogEntry);

    // 保持最近50个版本的日志
    if (this.changelog.length > 50) {
      this.changelog = this.changelog.slice(0, 50);
    }

    // 写入CHANGELOG.md
    await this.writeChangelogFile();
  }

  // 写入变更日志文件
  async writeChangelogFile() {
    const changelogPath = 'docs/CHANGELOG.md';

    let content = '# Changelog\n\n';

    for (const entry of this.changelog) {
      content += `## [${entry.version}] - ${new Date(entry.date).toISOString().split('T')[0]}\n\n`;

      for (const change of entry.changes) {
        content += `- **${change.type}**: ${change.description}\n`;
      }

      content += '\n';
    }

    await fs.writeFile(changelogPath, content);
  }

  // 格式化变更类型
  formatChangeType(type) {
    const typeMap = {
      feat: 'Features',
      fix: 'Bug Fixes',
      docs: 'Documentation',
      style: 'Styles',
      refactor: 'Code Refactoring',
      perf: 'Performance Improvements',
      test: 'Tests',
      chore: 'Chores',
      breaking: 'Breaking Changes',
    };

    return typeMap[type] || type;
  }

  // 验证版本号
  validateVersion(version) {
    const semverRegex = /^\d+\.\d+\.\d+(-[\w\.\-]+)?(\+[\w\.\-]+)?$/;

    if (!semverRegex.test(version)) {
      throw new Error(
        `Invalid version format: ${version}. Expected semantic versioning (e.g., 1.0.0)`
      );
    }

    // 检查版本是否已存在
    if (this.versions.has(version)) {
      throw new Error(`Version ${version} already exists`);
    }
  }

  // 计算文件校验和
  async calculateFileChecksums(changes) {
    const checksums = {};

    for (const change of changes) {
      if (change.files) {
        for (const file of change.files) {
          if (await fs.pathExists(file)) {
            const content = await fs.readFile(file);
            const checksum = crypto
              .createHash('sha256')
              .update(content)
              .digest('hex');
            checksums[file] = checksum;
          }
        }
      }
    }

    return checksums;
  }

  // 加载版本历史
  async loadVersionHistory() {
    // 加载现有版本
    const versionsDir = 'docs/versions';
    if (await fs.pathExists(versionsDir)) {
      const versionFiles = await fs.readdir(versionsDir);

      for (const versionFile of versionFiles) {
        if (versionFile.endsWith('.json')) {
          const versionPath = path.join(versionsDir, versionFile);
          const versionData = await fs.readJson(versionPath);

          this.versions.set(versionData.version, versionData);
        }
      }
    }

    // 加载变更日志
    const changelogPath = 'docs/CHANGELOG.md';
    if (await fs.pathExists(changelogPath)) {
      this.changelog = await this.parseChangelogFile(changelogPath);
    }
  }

  // 解析变更日志文件
  async parseChangelogFile(changelogPath) {
    const content = await fs.readFile(changelogPath, 'utf8');
    const lines = content.split('\n');

    const changelog = [];
    let currentEntry = null;

    for (const line of lines) {
      if (line.startsWith('## [')) {
        // 新版本条目
        const versionMatch = line.match(/## \[([^\]]+)\]/);
        if (versionMatch) {
          if (currentEntry) {
            changelog.push(currentEntry);
          }

          currentEntry = {
            version: versionMatch[1],
            date: new Date().toISOString(), // 从行中提取或使用默认值
            changes: [],
          };
        }
      } else if (line.startsWith('- **') && currentEntry) {
        // 变更条目
        const changeMatch = line.match(/- \*\*([^:]+)\*\*: (.+)/);
        if (changeMatch) {
          currentEntry.changes.push({
            type: changeMatch[1],
            description: changeMatch[2],
          });
        }
      }
    }

    if (currentEntry) {
      changelog.push(currentEntry);
    }

    return changelog;
  }

  // 设置版本钩子
  async setupVersionHooks() {
    // Git钩子会在版本提交时自动更新文档
    const hooksDir = '.git/hooks';

    if (await fs.pathExists(hooksDir)) {
      // 提交后钩子
      const postCommitHook = `${hooksDir}/post-commit`;
      const hookContent = `#!/bin/bash
# Documentation version control hook

# 如果有文档变更，触发文档版本更新
if git diff --name-only HEAD~1 | grep -q "^docs/"; then
  echo "Documentation changes detected, updating version index..."
  # 这里可以调用文档版本更新脚本
fi
`;

      if (!(await fs.pathExists(postCommitHook))) {
        await fs.writeFile(postCommitHook, hookContent);
        await fs.chmod(postCommitHook, '755');
      }
    }
  }

  // 提交版本
  async commitVersion(versionFile, message) {
    await this.repository.add([versionFile, 'docs/CHANGELOG.md']);
    await this.repository.commit(message);
  }

  // 标记版本
  async tagVersion(version, message) {
    await this.repository.createTag(`docs-v${version}`, message);
  }

  // 更新版本索引
  async updateVersionIndex(version) {
    const indexFile = 'docs/versions/index.json';

    const index = {
      latest: version,
      versions: Array.from(this.versions.keys()).sort().reverse(),
      lastUpdated: new Date().toISOString(),
    };

    await fs.writeJson(indexFile, index, { spaces: 2 });
  }
}
```

#### 2.2 内容搜索系统

**智能文档搜索**:

```javascript
class DocumentationSearchEngine {
  constructor() {
    this.index = new Map();
    this.reverseIndex = new Map();
    this.stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
    ]);
  }

  // 构建搜索索引
  async buildSearchIndex(docsPath) {
    log_info('Building search index...');

    const files = await this.findDocumentationFiles(docsPath);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const metadata = await this.extractFileMetadata(file);

      // 索引文件内容
      await this.indexFile(file, content, metadata);
    }

    // 保存索引
    await this.saveIndex();

    log_success('Search index built successfully');
  }

  // 查找文档文件
  async findDocumentationFiles(docsPath) {
    const patterns = [
      '**/*.md',
      '**/*.html',
      '**/*.json',
      '!node_modules/**',
      '!dist/**',
      '!.git/**',
    ];

    const files = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: docsPath });
      files.push(...matches.map(file => path.join(docsPath, file)));
    }

    return files;
  }

  // 索引文件
  async indexFile(filePath, content, metadata) {
    const docId = this.generateDocumentId(filePath);

    // 提取文本内容
    const textContent = this.extractTextContent(content, metadata.format);

    // 分词
    const tokens = this.tokenize(textContent);

    // 移除停用词
    const filteredTokens = this.filterStopWords(tokens);

    // 建立索引
    const termFrequency = new Map();

    for (const token of filteredTokens) {
      const normalizedToken = token.toLowerCase();

      // 正向索引 (文档 -> 词项)
      if (!this.index.has(docId)) {
        this.index.set(docId, {
          path: filePath,
          metadata,
          terms: new Map(),
          content: textContent.substring(0, 1000), // 预览内容
        });
      }

      const docIndex = this.index.get(docId);
      docIndex.terms.set(
        normalizedToken,
        (docIndex.terms.get(normalizedToken) || 0) + 1
      );

      // 反向索引 (词项 -> 文档)
      if (!this.reverseIndex.has(normalizedToken)) {
        this.reverseIndex.set(normalizedToken, new Set());
      }

      this.reverseIndex.get(normalizedToken).add(docId);

      // 词频统计
      termFrequency.set(
        normalizedToken,
        (termFrequency.get(normalizedToken) || 0) + 1
      );
    }

    // 计算TF-IDF权重
    this.calculateTFIDFWeights(docId, termFrequency);
  }

  // 搜索文档
  async search(query, options = {}) {
    const { limit = 20, filters = {}, sortBy = 'relevance' } = options;

    log_info(`Searching for: "${query}"`);

    // 解析查询
    const searchTerms = this.parseSearchQuery(query);

    // 执行搜索
    const results = await this.executeSearch(searchTerms, filters);

    // 排序结果
    this.sortResults(results, sortBy);

    // 限制结果数量
    const limitedResults = results.slice(0, limit);

    // 添加高亮
    const highlightedResults = this.highlightResults(
      limitedResults,
      searchTerms
    );

    return {
      query,
      total: results.length,
      results: highlightedResults,
      took: Date.now() - Date.now(), // 计算耗时
    };
  }

  // 解析搜索查询
  parseSearchQuery(query) {
    // 简单查询解析 (支持引号精确匹配)
    const terms = [];
    const quotedRegex = /"([^"]+)"/g;
    const normalRegex = /\b(\w+)\b/g;

    let match;
    while ((match = quotedRegex.exec(query)) !== null) {
      terms.push({
        term: match[1],
        exact: true,
      });
    }

    // 处理非引号部分
    const unquotedQuery = query.replace(quotedRegex, '');
    while ((match = normalRegex.exec(unquotedQuery)) !== null) {
      terms.push({
        term: match[1],
        exact: false,
      });
    }

    return terms;
  }

  // 执行搜索
  async executeSearch(searchTerms, filters) {
    const scoredResults = new Map();

    for (const searchTerm of searchTerms) {
      const term = searchTerm.term.toLowerCase();
      const exact = searchTerm.exact;

      if (this.reverseIndex.has(term)) {
        const docIds = this.reverseIndex.get(term);

        for (const docId of docIds) {
          const docIndex = this.index.get(docId);

          // 应用过滤器
          if (!this.matchesFilters(docIndex, filters)) {
            continue;
          }

          // 计算相关性得分
          const score = this.calculateRelevanceScore(docIndex, searchTerm);

          if (scoredResults.has(docId)) {
            scoredResults.set(docId, {
              ...scoredResults.get(docId),
              score: scoredResults.get(docId).score + score,
            });
          } else {
            scoredResults.set(docId, {
              docId,
              score,
              document: docIndex,
            });
          }
        }
      }
    }

    return Array.from(scoredResults.values());
  }

  // 计算相关性得分
  calculateRelevanceScore(docIndex, searchTerm) {
    const term = searchTerm.term.toLowerCase();

    if (!docIndex.terms.has(term)) {
      return 0;
    }

    const tfidf = docIndex.tfidf.get(term) || 0;
    const termFrequency = docIndex.terms.get(term) || 0;

    // 精确匹配加分
    const exactBonus = searchTerm.exact ? 2.0 : 1.0;

    // 位置权重 (标题中出现加分)
    const titleBonus = docIndex.metadata.title?.toLowerCase().includes(term)
      ? 1.5
      : 1.0;

    return tfidf * termFrequency * exactBonus * titleBonus;
  }

  // 匹配过滤器
  matchesFilters(docIndex, filters) {
    // 格式过滤
    if (filters.format && docIndex.metadata.format !== filters.format) {
      return false;
    }

    // 语言过滤
    if (filters.language && docIndex.metadata.language !== filters.language) {
      return false;
    }

    // 版本过滤
    if (filters.version && docIndex.metadata.version !== filters.version) {
      return false;
    }

    // 分类过滤
    if (filters.category && docIndex.metadata.category !== filters.category) {
      return false;
    }

    // 日期过滤
    if (filters.since) {
      const docDate = new Date(docIndex.metadata.lastModified || 0);
      const sinceDate = new Date(filters.since);

      if (docDate < sinceDate) {
        return false;
      }
    }

    return true;
  }

  // 排序结果
  sortResults(results, sortBy) {
    results.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return b.score - a.score;
        case 'date':
          const aDate = new Date(a.document.metadata.lastModified || 0);
          const bDate = new Date(b.document.metadata.lastModified || 0);
          return bDate - aDate;
        case 'title':
          return (
            a.document.metadata.title?.localeCompare(
              b.document.metadata.title
            ) || 0
          );
        default:
          return b.score - a.score;
      }
    });
  }

  // 高亮结果
  highlightResults(results, searchTerms) {
    return results.map(result => ({
      ...result,
      highlights: this.generateHighlights(result.document, searchTerms),
    }));
  }

  // 生成高亮片段
  generateHighlights(document, searchTerms) {
    const highlights = [];
    const content = document.content;

    for (const searchTerm of searchTerms) {
      const term = searchTerm.term;
      const index = content.toLowerCase().indexOf(term.toLowerCase());

      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + term.length + 50);
        const snippet = content.substring(start, end);

        highlights.push({
          term,
          snippet: `...${snippet}...`,
          position: index,
        });
      }
    }

    return highlights.slice(0, 3); // 最多3个高亮片段
  }

  // 计算TF-IDF权重
  calculateTFIDFWeights(docId, termFrequency) {
    const docIndex = this.index.get(docId);
    const totalDocs = this.index.size;

    docIndex.tfidf = new Map();

    for (const [term, frequency] of termFrequency) {
      const df = this.reverseIndex.get(term)?.size || 1;
      const idf = Math.log(totalDocs / df);
      const tfidf = frequency * idf;

      docIndex.tfidf.set(term, tfidf);
    }
  }

  // 分词
  tokenize(text) {
    // 简单英文分词 (可扩展支持其他语言)
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  // 过滤停用词
  filterStopWords(tokens) {
    return tokens.filter(token => !this.stopWords.has(token));
  }

  // 提取文件元数据
  async extractFileMetadata(filePath) {
    const stats = await fs.stat(filePath);
    const extension = path.extname(filePath).toLowerCase();

    const metadata = {
      path: filePath,
      filename: path.basename(filePath),
      format: this.getFormatFromExtension(extension),
      size: stats.size,
      lastModified: stats.mtime,
      language: 'en', // 默认语言
    };

    // 尝试提取更多元数据
    if (extension === '.md') {
      metadata.title = await this.extractMarkdownTitle(filePath);
      metadata.language = await this.detectLanguage(filePath);
    }

    return metadata;
  }

  // 从扩展名获取格式
  getFormatFromExtension(extension) {
    const formatMap = {
      '.md': 'markdown',
      '.html': 'html',
      '.json': 'json',
      '.txt': 'text',
      '.yaml': 'yaml',
      '.yml': 'yaml',
    };

    return formatMap[extension] || 'unknown';
  }

  // 提取Markdown标题
  async extractMarkdownTitle(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines.slice(0, 5)) {
      const titleMatch = line.match(/^#\s+(.+)/);
      if (titleMatch) {
        return titleMatch[1].trim();
      }
    }

    return null;
  }

  // 检测语言
  async detectLanguage(filePath) {
    // 简单语言检测逻辑
    const content = await fs.readFile(filePath, 'utf8');

    // 检查中文字符
    if (/[\u4e00-\u9fff]/.test(content)) {
      return 'zh';
    }

    // 检查日文字符
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(content)) {
      return 'ja';
    }

    // 默认英文
    return 'en';
  }

  // 生成文档ID
  generateDocumentId(filePath) {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  // 保存索引
  async saveIndex() {
    const indexData = {
      documents: Object.fromEntries(this.index),
      reverseIndex: Object.fromEntries(
        Array.from(this.reverseIndex.entries()).map(([term, docIds]) => [
          term,
          Array.from(docIds),
        ])
      ),
      builtAt: new Date().toISOString(),
      totalDocuments: this.index.size,
      totalTerms: this.reverseIndex.size,
    };

    await fs.writeJson('docs/search-index.json', indexData, { spaces: 2 });
  }

  // 加载索引
  async loadIndex() {
    const indexPath = 'docs/search-index.json';

    if (await fs.pathExists(indexPath)) {
      const indexData = await fs.readJson(indexPath);

      this.index = new Map(Object.entries(indexData.documents));
      this.reverseIndex = new Map(
        Object.entries(indexData.reverseIndex).map(([term, docIds]) => [
          term,
          new Set(docIds),
        ])
      );

      log_info(
        `Loaded search index: ${indexData.totalDocuments} documents, ${indexData.totalTerms} terms`
      );
    }
  }
}
```

---

## 🎯 功能职责详解

### 1. 文档发布系统

#### 1.1 静态站点生成

**多格式文档发布**:

```javascript
class DocumentationPublisher {
  constructor() {
    this.generators = new Map();
    this.publishers = new Map();
    this.initializeGenerators();
  }

  // 初始化生成器
  initializeGenerators() {
    this.generators.set('static-site', new StaticSiteGenerator());
    this.generators.set('pdf', new PDFGenerator());
    this.generators.set('epub', new EPUBGenerator());
    this.generators.set('dash', new DashDocsetGenerator());

    this.publishers.set('github-pages', new GitHubPagesPublisher());
    this.publishers.set('netlify', new NetlifyPublisher());
    this.publishers.set('aws-s3', new S3Publisher());
  }

  // 发布文档
  async publishDocumentation(docsPath, options = {}) {
    const {
      format = 'static-site',
      publisher = 'github-pages',
      outputPath = './dist/docs',
      baseUrl = '/',
      theme = 'default',
    } = options;

    log_info(`Publishing documentation in format: ${format}`);

    // 生成文档
    const generator = this.generators.get(format);
    if (!generator) {
      throw new Error(`Unsupported format: ${format}`);
    }

    const generatedDocs = await generator.generate(docsPath, {
      outputPath,
      baseUrl,
      theme,
    });

    // 发布文档
    const publisherInstance = this.publishers.get(publisher);
    if (publisherInstance) {
      await publisherInstance.publish(generatedDocs, options);
    }

    // 生成sitemap
    await this.generateSitemap(generatedDocs, baseUrl);

    // 提交搜索引擎
    if (options.submitToSearchEngines) {
      await this.submitToSearchEngines(generatedDocs.baseUrl);
    }

    log_success(`Documentation published successfully`);

    return {
      format,
      outputPath,
      baseUrl,
      publishedAt: new Date(),
      urls: generatedDocs.urls,
    };
  }

  // 生成sitemap
  async generateSitemap(generatedDocs, baseUrl) {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${generatedDocs.urls
  .map(
    url => `  <url>
    <loc>${baseUrl}${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    await fs.writeFile(
      path.join(generatedDocs.outputPath, 'sitemap.xml'),
      sitemap
    );
  }

  // 提交搜索引擎
  async submitToSearchEngines(baseUrl) {
    const sitemapUrl = `${baseUrl}sitemap.xml`;

    // Google Search Console
    await this.pingSearchEngine('https://www.google.com/ping', sitemapUrl);

    // Bing Webmaster Tools
    await this.pingSearchEngine('https://www.bing.com/ping', sitemapUrl);

    log_info('Submitted sitemap to search engines');
  }

  async pingSearchEngine(pingUrl, sitemapUrl) {
    try {
      await axios.get(`${pingUrl}?sitemap=${encodeURIComponent(sitemapUrl)}`);
    } catch (error) {
      log_warn(`Failed to ping ${pingUrl}: ${error.message}`);
    }
  }
}

// 静态站点生成器
class StaticSiteGenerator {
  async generate(docsPath, options) {
    const { outputPath, baseUrl, theme } = options;

    // 清理输出目录
    await fs.emptyDir(outputPath);

    // 复制静态资源
    await this.copyStaticAssets(docsPath, outputPath, theme);

    // 处理Markdown文件
    const markdownFiles = await glob('**/*.md', { cwd: docsPath });
    const processedFiles = [];

    for (const file of markdownFiles) {
      const inputPath = path.join(docsPath, file);
      const outputFile = file.replace('.md', '.html');
      const outputFilePath = path.join(outputPath, outputFile);

      await fs.ensureDir(path.dirname(outputFilePath));

      const htmlContent = await this.convertMarkdownToHTML(inputPath, baseUrl);
      await fs.writeFile(outputFilePath, htmlContent);

      processedFiles.push(outputFile);
    }

    // 生成导航和索引
    const navigation = await this.generateNavigation(docsPath);
    await this.applyNavigationToFiles(outputPath, navigation);

    return {
      outputPath,
      urls: processedFiles,
      navigation,
    };
  }

  // 转换Markdown到HTML
  async convertMarkdownToHTML(markdownPath, baseUrl) {
    const markdown = await fs.readFile(markdownPath, 'utf8');

    // 使用markdown处理器转换
    const html = await this.processMarkdown(markdown);

    // 应用模板
    const template = await this.loadHTMLTemplate();
    const finalHTML = template
      .replace('{{content}}', html)
      .replace(/\{\{baseUrl\}\}/g, baseUrl);

    return finalHTML;
  }

  // 生成导航
  async generateNavigation(docsPath) {
    const navigation = {
      sections: [],
    };

    // 分析目录结构生成导航
    const structure = await this.analyzeDirectoryStructure(docsPath);
    navigation.sections = this.buildNavigationFromStructure(structure);

    return navigation;
  }
}
```

#### 1.2 多语言文档管理

**国际化文档支持**:

````javascript
class MultilingualDocumentationManager {
  constructor() {
    this.languages = new Map();
    this.translations = new Map();
    this.fallbackChain = new Map();
  }

  // 添加语言支持
  async addLanguage(languageCode, options = {}) {
    const { name, nativeName, direction = 'ltr', fallbackTo = 'en' } = options;

    this.languages.set(languageCode, {
      code: languageCode,
      name,
      nativeName,
      direction,
      fallbackTo,
      enabled: true,
    });

    // 设置回退链
    this.fallbackChain.set(languageCode, this.buildFallbackChain(languageCode));

    log_info(`Added language support: ${languageCode} (${nativeName})`);
  }

  // 构建回退链
  buildFallbackChain(languageCode) {
    const chain = [languageCode];
    let current = languageCode;

    while (current && current !== 'en') {
      const language = this.languages.get(current);
      if (language?.fallbackTo) {
        current = language.fallbackTo;
        if (!chain.includes(current)) {
          chain.push(current);
        }
      } else {
        break;
      }
    }

    // 确保英文在最后
    if (!chain.includes('en')) {
      chain.push('en');
    }

    return chain;
  }

  // 翻译文档
  async translateDocument(documentPath, targetLanguage, options = {}) {
    const {
      sourceLanguage = 'en',
      preserveStructure = true,
      autoTranslate = true,
    } = options;

    log_info(`Translating document ${documentPath} to ${targetLanguage}`);

    // 读取源文档
    const sourceContent = await fs.readFile(documentPath, 'utf8');

    // 解析文档结构
    const documentStructure = await this.parseDocumentStructure(
      sourceContent,
      sourceLanguage
    );

    // 翻译内容
    const translatedStructure = await this.translateDocumentStructure(
      documentStructure,
      sourceLanguage,
      targetLanguage,
      { autoTranslate }
    );

    // 生成目标文档
    const translatedContent = await this.generateTranslatedDocument(
      translatedStructure,
      targetLanguage,
      { preserveStructure }
    );

    // 保存翻译后的文档
    const translatedPath = this.getTranslatedPath(documentPath, targetLanguage);
    await fs.ensureDir(path.dirname(translatedPath));
    await fs.writeFile(translatedPath, translatedContent);

    // 缓存翻译
    await this.cacheTranslation(
      documentPath,
      targetLanguage,
      translatedContent
    );

    return translatedPath;
  }

  // 解析文档结构
  async parseDocumentStructure(content, language) {
    const extension = path.extname(content).toLowerCase();

    switch (extension) {
      case '.md':
        return await this.parseMarkdownStructure(content, language);
      case '.html':
        return await this.parseHTMLStructure(content, language);
      case '.json':
        return await this.parseJSONStructure(content, language);
      default:
        return await this.parsePlainTextStructure(content, language);
    }
  }

  // 解析Markdown结构
  async parseMarkdownStructure(content, language) {
    const lines = content.split('\n');
    const structure = {
      frontmatter: null,
      headings: [],
      paragraphs: [],
      codeBlocks: [],
      links: [],
      metadata: { language },
    };

    let inCodeBlock = false;
    let codeBlockStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Frontmatter
      if (i === 0 && line.trim() === '---') {
        const frontmatterEnd = lines.indexOf('---', 1);
        if (frontmatterEnd > 0) {
          structure.frontmatter = lines.slice(1, frontmatterEnd).join('\n');
          i = frontmatterEnd;
          continue;
        }
      }

      // 代码块
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          structure.codeBlocks.push({
            start: codeBlockStart,
            end: i,
            language: line.replace('```', '').trim(),
            content: lines.slice(codeBlockStart + 1, i).join('\n'),
          });
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeBlockStart = i;
        }
        continue;
      }

      if (inCodeBlock) continue;

      // 标题
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        structure.headings.push({
          level: headingMatch[1].length,
          text: headingMatch[2],
          line: i,
        });
        continue;
      }

      // 段落
      if (line.trim()) {
        structure.paragraphs.push({
          text: line,
          line: i,
        });
      }
    }

    return structure;
  }

  // 翻译文档结构
  async translateDocumentStructure(structure, sourceLang, targetLang, options) {
    const translated = {
      ...structure,
      metadata: { ...structure.metadata, language: targetLang },
    };

    // 翻译标题
    translated.headings = await Promise.all(
      structure.headings.map(async heading => ({
        ...heading,
        text: await this.translateText(heading.text, sourceLang, targetLang),
      }))
    );

    // 翻译段落
    translated.paragraphs = await Promise.all(
      structure.paragraphs.map(async paragraph => ({
        ...paragraph,
        text: await this.translateText(paragraph.text, sourceLang, targetLang),
      }))
    );

    // 翻译Frontmatter
    if (structure.frontmatter) {
      translated.frontmatter = await this.translateFrontmatter(
        structure.frontmatter,
        sourceLang,
        targetLang
      );
    }

    return translated;
  }

  // 翻译文本
  async translateText(text, sourceLang, targetLang) {
    // 检查是否已有翻译
    const cacheKey = `${sourceLang}:${targetLang}:${crypto.createHash('md5').update(text).digest('hex')}`;
    const cached = await this.getCachedTranslation(cacheKey);

    if (cached) {
      return cached;
    }

    // 检查是否是代码或特殊内容
    if (this.isNonTranslatableContent(text)) {
      return text;
    }

    // 使用翻译服务
    const translated = await this.callTranslationService(
      text,
      sourceLang,
      targetLang
    );

    // 缓存翻译结果
    await this.cacheTranslationResult(cacheKey, translated);

    return translated;
  }

  // 检查是否是不可翻译内容
  isNonTranslatableContent(text) {
    // 代码块
    if (text.includes('```') || text.includes('`')) {
      return true;
    }

    // URL
    if (text.match(/https?:\/\//)) {
      return true;
    }

    // 文件路径
    if (text.includes('/') || text.includes('\\') || text.includes('.')) {
      return false; // 可能需要翻译，但要小心处理
    }

    // 命令行代码
    if (text.startsWith('$ ') || text.startsWith('# ')) {
      return true;
    }

    return false;
  }

  // 调用翻译服务
  async callTranslationService(text, sourceLang, targetLang) {
    // 这里可以集成各种翻译服务
    // 如 Google Translate, DeepL, Azure Translator 等

    // 简化的实现
    if (this.translationService) {
      return await this.translationService.translate(
        text,
        sourceLang,
        targetLang
      );
    }

    // 回退到英文 (如果目标语言是英文)
    if (targetLang === 'en') {
      return text;
    }

    // 标记为需要人工翻译
    return `[TODO: Translate to ${targetLang}] ${text}`;
  }

  // 生成翻译后的文档
  async generateTranslatedDocument(structure, targetLanguage, options) {
    const { preserveStructure } = options;

    switch (structure.format) {
      case 'markdown':
        return this.generateTranslatedMarkdown(structure);
      case 'html':
        return this.generateTranslatedHTML(structure);
      case 'json':
        return this.generateTranslatedJSON(structure);
      default:
        return this.generateTranslatedPlainText(structure);
    }
  }

  // 生成翻译后的Markdown
  generateTranslatedMarkdown(structure) {
    const lines = [];

    // Frontmatter
    if (structure.frontmatter) {
      lines.push('---');
      lines.push(structure.frontmatter);
      lines.push('---');
      lines.push('');
    }

    // 重建文档结构
    let currentLine = structure.frontmatter
      ? structure.frontmatter.split('\n').length + 3
      : 0;

    // 添加标题
    for (const heading of structure.headings) {
      while (currentLine < heading.line) {
        lines.push('');
        currentLine++;
      }

      lines.push(`${'#'.repeat(heading.level)} ${heading.text}`);
      currentLine++;
    }

    // 添加段落
    for (const paragraph of structure.paragraphs) {
      while (currentLine < paragraph.line) {
        lines.push('');
        currentLine++;
      }

      lines.push(paragraph.text);
      currentLine++;
    }

    // 添加代码块
    for (const codeBlock of structure.codeBlocks) {
      while (currentLine < codeBlock.start) {
        lines.push('');
        currentLine++;
      }

      lines.push(`\`\`\`${codeBlock.language}`);
      lines.push(codeBlock.content);
      lines.push('```');
      currentLine = codeBlock.end + 1;
    }

    return lines.join('\n');
  }

  // 获取翻译后的路径
  getTranslatedPath(originalPath, targetLanguage) {
    const parsed = path.parse(originalPath);
    const translatedDir = path.join(parsed.dir, targetLanguage);
    return path.join(translatedDir, parsed.base);
  }

  // 缓存翻译
  async cacheTranslation(documentPath, language, content) {
    const cacheKey = `${documentPath}:${language}`;
    const cacheEntry = {
      documentPath,
      language,
      content,
      translatedAt: new Date().toISOString(),
      checksum: crypto.createHash('md5').update(content).digest('hex'),
    };

    await this.setCacheEntry(cacheKey, cacheEntry);
  }

  // 获取缓存的翻译
  async getCachedTranslation(cacheKey) {
    const cacheEntry = await this.getCacheEntry(cacheKey);

    if (cacheEntry) {
      // 检查文档是否已修改
      const currentChecksum = await this.calculateDocumentChecksum(
        cacheEntry.documentPath
      );

      if (currentChecksum === cacheEntry.checksum) {
        return cacheEntry.content;
      } else {
        // 文档已修改，删除缓存
        await this.deleteCacheEntry(cacheKey);
      }
    }

    return null;
  }

  // 计算文档校验和
  async calculateDocumentChecksum(documentPath) {
    if (await fs.pathExists(documentPath)) {
      const content = await fs.readFile(documentPath);
      return crypto.createHash('md5').update(content).digest('hex');
    }

    return null;
  }

  // 同步文档翻译
  async syncDocumentTranslations(documentPath, options = {}) {
    const { targetLanguages = ['zh', 'es', 'fr'] } = options;

    log_info(`Syncing translations for ${documentPath}`);

    const syncResults = {};

    for (const language of targetLanguages) {
      try {
        const translatedPath = await this.translateDocument(
          documentPath,
          language,
          options
        );
        syncResults[language] = {
          status: 'success',
          path: translatedPath,
        };
      } catch (error) {
        log_error(`Failed to translate to ${language}: ${error.message}`);
        syncResults[language] = {
          status: 'error',
          error: error.message,
        };
      }
    }

    return syncResults;
  }

  // 获取翻译状态
  async getTranslationStatus(documentPath) {
    const status = {
      original: documentPath,
      translations: {},
    };

    for (const [languageCode, language] of this.languages) {
      if (!language.enabled) continue;

      const translatedPath = this.getTranslatedPath(documentPath, languageCode);
      const exists = await fs.pathExists(translatedPath);

      let translationStatus = 'missing';
      let lastModified = null;
      let needsUpdate = false;

      if (exists) {
        const translatedStats = await fs.stat(translatedPath);
        const originalStats = await fs.stat(documentPath);

        lastModified = translatedStats.mtime;
        needsUpdate = translatedStats.mtime < originalStats.mtime;

        if (needsUpdate) {
          translationStatus = 'outdated';
        } else {
          translationStatus = 'up_to_date';
        }
      }

      status.translations[languageCode] = {
        status: translationStatus,
        path: translatedPath,
        lastModified,
        needsUpdate,
        language: language.nativeName,
      };
    }

    return status;
  }

  // 批量翻译文档
  async batchTranslateDocuments(documents, targetLanguage, options = {}) {
    const results = {
      total: documents.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    log_info(
      `Starting batch translation of ${documents.length} documents to ${targetLanguage}`
    );

    for (const document of documents) {
      try {
        // 检查翻译状态
        const status = await this.getTranslationStatus(document);

        if (status.translations[targetLanguage]?.status === 'up_to_date') {
          log_info(`Skipping ${document} - already up to date`);
          results.skipped++;
          continue;
        }

        // 执行翻译
        await this.translateDocument(document, targetLanguage, options);
        results.successful++;

        log_info(`Translated ${document} to ${targetLanguage}`);
      } catch (error) {
        log_error(`Failed to translate ${document}: ${error.message}`);
        results.failed++;
        results.errors.push({
          document,
          error: error.message,
        });
      }
    }

    log_info(
      `Batch translation completed: ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`
    );

    return results;
  }
}
````

---

## 📈 发展规划

### 1. 短期规划 (0-6个月)

#### 1.1 文档生成系统完善

- [ ] **代码文档生成**
  - [ ] 支持更多编程语言
  - [ ] 改进JSDoc解析
  - [ ] 添加类型定义文档

- [ ] **API文档生成**
  - [ ] 支持更多API规范
  - [ ] 增强交互式文档
  - [ ] 添加API测试集成

- [ ] **用户指南生成**
  - [ ] 自动化教程生成
  - [ ] 交互式示例集成
  - [ ] 多媒体内容支持

#### 1.2 文档管理系统优化

- [ ] **版本控制增强**
  - [ ] 分支版本管理
  - [ ] 文档审批流程
  - [ ] 版本对比功能

- [ ] **搜索系统改进**
  - [ ] 全文搜索优化
  - [ ] 语义搜索支持
  - [ ] 搜索建议功能

- [ ] **多语言支持完善**
  - [ ] 翻译质量评估
  - [ ] 翻译协作平台
  - [ ] 文化适应优化

### 2. 中期规划 (6-12个月)

#### 2.1 智能化文档

- [ ] **AI辅助写作**
  - [ ] 文档内容生成
  - [ ] 代码示例生成
  - [ ] 文档质量改进

- [ ] **智能推荐**
  - [ ] 个性化内容推荐
  - [ ] 学习路径规划
  - [ ] 相关文档发现

- [ ] **自动化维护**
  - [ ] 文档一致性检查
  - [ ] 过时内容检测
  - [ ] 自动更新机制

#### 2.2 协作平台建设

- [ ] **文档协作**
  - [ ] 在线编辑器集成
  - [ ] 审阅和评论系统
  - [ ] 版本控制协作

- [ ] **社区建设**
  - [ ] 贡献者激励机制
  - [ ] 文档翻译众包
  - [ ] 社区文档库

### 3. 长期规划 (12-24个月)

#### 3.1 知识图谱构建

- [ ] **知识图谱**
  - [ ] 文档关系图谱
  - [ ] 概念关联分析
  - [ ] 知识推理推荐

- [ ] **智能问答**
  - [ ] 文档知识库问答
  - [ ] 上下文感知回答
  - [ ] 多轮对话支持

#### 3.2 生态系统扩展

- [ ] **第三方集成**
  - [ ] 外部文档系统集成
  - [ ] API文档聚合
  - [ ] 企业知识库对接

- [ ] **平台化发展**
  - [ ] 文档即服务平台
  - [ ] SaaS文档平台
  - [ ] 企业文档管理

---

## 🔗 依赖关系

### 1. 内部依赖

#### 1.1 强依赖模块

```
文档模块依赖关系:
├── 核心模块 (Core Module)
│   ├── 提供应用信息和配置
│   └── 使用文档生成API
├── 网关模块 (Gateway Module)
│   ├── 提供文档访问接口
│   └── 文档访问权限控制
├── 管理模块 (Admin Module)
│   ├── 提供文档管理界面
│   └── 文档协作功能支持
└── 测试模块 (Test Module)
    ├── 生成测试文档
    └── 验证文档准确性
```

#### 1.2 可选依赖模块

```
可选依赖:
├── 工具模块 (Bin Module) - 文档生成工具
├── 脚本模块 (Scripts Module) - 文档发布脚本
├── 国际化模块 (Locales Module) - 多语言文档支持
└── 部署模块 (Docker Module) - 文档容器化部署
```

### 2. 外部依赖

#### 2.1 文档生成依赖

```json
{
  "文档处理": {
    "remark": "^14.0.0",
    "rehype": "^12.0.0",
    "unified": "^10.0.0",
    "jsdoc": "^4.0.0",
    "typedoc": "^0.24.0"
  },
  "API文档": {
    "@apidevtools/swagger-jsdoc": "^6.2.0",
    "swagger-ui-express": "^4.6.0",
    "redoc": "^2.0.0",
    "openapi-types": "^12.0.0"
  },
  "搜索和索引": {
    "lunr": "^2.3.9",
    "flexsearch": "^0.7.0",
    "fuse.js": "^6.6.0"
  }
}
```

#### 2.2 发布和分发依赖

```json
{
  "静态站点生成": {
    "next": "^13.0.0",
    "gatsby": "^5.0.0",
    "docusaurus": "^2.4.0",
    "vuepress": "^2.0.0"
  },
  "格式转换": {
    "puppeteer": "^20.0.0",
    "html-pdf": "^3.0.0",
    "ebook-convert": "^3.0.0"
  },
  "CDN和部署": {
    "@aws-sdk/client-s3": "^3.0.0",
    "@google-cloud/storage": "^6.0.0",
    "vercel": "^28.0.0",
    "netlify-cli": "^12.0.0"
  }
}
```

---

## 🧪 测试策略

### 1. 文档生成测试

#### 1.1 代码文档生成测试

**自动化文档生成验证**:

```javascript
describe('Code Documentation Generation', () => {
  let docGenerator;

  beforeEach(() => {
    docGenerator = new CodeDocumentationGenerator();
  });

  describe('JavaScript Documentation', () => {
    test('should generate documentation for simple function', async () => {
      const code = `
        /**
         * Adds two numbers
         * @param {number} a - First number
         * @param {number} b - Second number
         * @returns {number} Sum of the two numbers
         */
        function add(a, b) {
          return a + b;
        }
      `;

      const docs = await docGenerator.generateFromCode(code, 'js');

      expect(docs.functions).toHaveLength(1);
      expect(docs.functions[0].name).toBe('add');
      expect(docs.functions[0].description).toBe('Adds two numbers');
      expect(docs.functions[0].params).toHaveLength(2);
      expect(docs.functions[0].returns.type).toBe('number');
    });

    test('should handle class documentation', async () => {
      const code = `
        /**
         * User management class
         */
        class UserManager {
          /**
           * Creates a new user
           * @param {Object} userData - User information
           * @returns {User} Created user instance
           */
          createUser(userData) {
            return new User(userData);
          }
        }
      `;

      const docs = await docGenerator.generateFromCode(code, 'js');

      expect(docs.classes).toHaveLength(1);
      expect(docs.classes[0].name).toBe('UserManager');
      expect(docs.classes[0].methods).toHaveLength(1);
    });

    test('should generate markdown output', async () => {
      const code = `
        function greet(name) {
          return \`Hello, \${name}!\`;
        }
      `;

      const markdown = await docGenerator.generateMarkdown(code, 'js');

      expect(markdown).toContain('# greet');
      expect(markdown).toContain('function greet(name)');
      expect(markdown).toContain('**Parameters:**');
    });
  });

  describe('TypeScript Documentation', () => {
    test('should handle TypeScript types', async () => {
      const code = `
        interface User {
          id: number;
          name: string;
          email: string;
        }

        function getUser(id: number): Promise<User> {
          // implementation
        }
      `;

      const docs = await docGenerator.generateFromCode(code, 'ts');

      expect(docs.interfaces).toHaveLength(1);
      expect(docs.interfaces[0].name).toBe('User');
      expect(docs.interfaces[0].properties).toHaveLength(3);
      expect(docs.functions[0].returns.type).toBe('Promise<User>');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSDoc gracefully', async () => {
      const code = `
        /**
         * @param {invalid} param
         */
        function test(param) {}
      `;

      const docs = await docGenerator.generateFromCode(code, 'js');

      // Should not throw error, but may log warnings
      expect(docs.functions).toHaveLength(1);
    });

    test('should handle syntax errors in code', async () => {
      const code = 'function broken( { return "test"; }';

      await expect(docGenerator.generateFromCode(code, 'js')).rejects.toThrow();
    });
  });
});
```

#### 1.2 API文档生成测试

**OpenAPI规范验证**:

```javascript
describe('API Documentation Generation', () => {
  let apiDocGenerator;

  beforeEach(() => {
    apiDocGenerator = new APIDocumentationGenerator();
  });

  describe('OpenAPI Specification Parsing', () => {
    test('should parse basic OpenAPI spec', async () => {
      const openApiSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/users': {
            get: {
              summary: 'Get users',
              responses: {
                200: {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const docs = await apiDocGenerator.parseOpenAPISpec(openApiSpec);

      expect(docs.info.title).toBe('Test API');
      expect(docs.endpoints).toHaveLength(1);
      expect(docs.endpoints[0].path).toBe('/users');
      expect(docs.endpoints[0].method).toBe('GET');
      expect(docs.schemas.User).toBeDefined();
    });

    test('should handle complex response schemas', async () => {
      const spec = {
        paths: {
          '/users/{id}': {
            get: {
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  schema: { type: 'integer' },
                },
              ],
              responses: {
                200: {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
                404: {
                  description: 'User not found',
                },
              },
            },
          },
        },
      };

      const docs = await apiDocGenerator.parseOpenAPISpec(spec);

      expect(docs.endpoints[0].parameters).toHaveLength(1);
      expect(docs.endpoints[0].responses['200']).toBeDefined();
      expect(docs.endpoints[0].responses['404']).toBeDefined();
    });
  });

  describe('Documentation Rendering', () => {
    test('should generate HTML documentation', async () => {
      const docs = {
        info: { title: 'Test API', version: '1.0.0' },
        endpoints: [
          {
            method: 'GET',
            path: '/users',
            summary: 'Get users',
          },
        ],
      };

      const html = await apiDocGenerator.renderHTML(docs);

      expect(html).toContain('<html');
      expect(html).toContain('Test API');
      expect(html).toContain('GET /users');
      expect(html).toContain('Get users');
    });

    test('should generate Markdown documentation', async () => {
      const docs = {
        info: { title: 'Test API', version: '1.0.0' },
        endpoints: [
          {
            method: 'POST',
            path: '/users',
            summary: 'Create user',
          },
        ],
      };

      const markdown = await apiDocGenerator.renderMarkdown(docs);

      expect(markdown).toContain('# Test API');
      expect(markdown).toContain('## Endpoints');
      expect(markdown).toContain('### POST /users');
      expect(markdown).toContain('Create user');
    });
  });

  describe('Interactive Documentation', () => {
    test('should generate Swagger UI', async () => {
      const spec = {
        openapi: '3.0.0',
        info: { title: 'Test API' },
        paths: {},
      };

      const interactiveDocs = await apiDocGenerator.generateSwaggerUI(spec);

      expect(interactiveDocs.html).toContain('swagger-ui');
      expect(interactiveDocs.js).toContain('SwaggerUIBundle');
      expect(interactiveDocs.css).toContain('swagger-ui');
    });
  });
});
```

### 2. 文档管理系统测试

#### 2.1 版本控制测试

**文档版本管理验证**:

```javascript
describe('Documentation Version Control', () => {
  let versionControl;

  beforeEach(async () => {
    versionControl = new DocumentationVersionControl();
    await versionControl.initialize();
  });

  describe('Version Creation', () => {
    test('should create new version', async () => {
      const version = '1.0.0';
      const changes = [
        {
          type: 'feat',
          description: 'Add user authentication API',
          files: ['docs/api/auth.md'],
        },
      ];

      const result = await versionControl.createVersion(version, changes);

      expect(result.version).toBe(version);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('feat');
    });

    test('should validate version format', async () => {
      const invalidVersions = ['1.0', '1.0.0-beta', 'invalid'];

      for (const version of invalidVersions) {
        await expect(versionControl.createVersion(version, [])).rejects.toThrow(
          'Invalid version format'
        );
      }
    });

    test('should prevent duplicate versions', async () => {
      const version = '1.0.0';
      await versionControl.createVersion(version, []);

      await expect(versionControl.createVersion(version, [])).rejects.toThrow(
        'already exists'
      );
    });
  });

  describe('Changelog Management', () => {
    test('should update changelog', async () => {
      const version = '1.1.0';
      const changes = [
        { type: 'feat', description: 'Add new endpoint' },
        { type: 'fix', description: 'Fix authentication bug' },
      ];

      await versionControl.createVersion(version, changes);

      const changelog = versionControl.getChangelog();
      expect(changelog).toHaveLength(1);
      expect(changelog[0].version).toBe(version);
      expect(changelog[0].changes).toHaveLength(2);
    });

    test('should format change types correctly', async () => {
      const changes = [
        { type: 'feat', description: 'New feature' },
        { type: 'fix', description: 'Bug fix' },
        { type: 'docs', description: 'Documentation update' },
      ];

      await versionControl.createVersion('1.0.1', changes);

      const changelog = versionControl.getChangelog();
      expect(changelog[0].changes[0].type).toBe('Features');
      expect(changelog[0].changes[1].type).toBe('Bug Fixes');
      expect(changelog[0].changes[2].type).toBe('Documentation');
    });
  });

  describe('Version Comparison', () => {
    test('should compare versions', async () => {
      await versionControl.createVersion('1.0.0', [
        { type: 'feat', description: 'Initial release' },
      ]);
      await versionControl.createVersion('1.1.0', [
        { type: 'feat', description: 'New feature' },
      ]);

      const diff = await versionControl.compareVersions('1.0.0', '1.1.0');

      expect(diff.added).toHaveLength(1);
      expect(diff.removed).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
    });
  });
});
```

#### 2.2 搜索系统测试

**文档搜索功能验证**:

```javascript
describe('Documentation Search', () => {
  let searchEngine;

  beforeEach(async () => {
    searchEngine = new DocumentationSearchEngine();
  });

  describe('Index Building', () => {
    test('should build search index', async () => {
      const docs = [
        {
          id: 'doc1',
          content: 'This is a test document about API authentication.',
        },
        { id: 'doc2', content: 'Learn how to use the user management system.' },
      ];

      await searchEngine.buildIndex(docs);

      const index = searchEngine.getIndex();
      expect(index.size).toBeGreaterThan(0);
    });

    test('should handle special characters', async () => {
      const docs = [
        { id: 'doc1', content: 'API documentation for /users endpoint.' },
      ];

      await searchEngine.buildIndex(docs);

      // Should not throw error with special characters
      const index = searchEngine.getIndex();
      expect(index.has('doc1')).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      const docs = [
        {
          id: 'auth',
          content:
            'Authentication API allows users to login and manage sessions. Use JWT tokens for secure access.',
        },
        {
          id: 'users',
          content:
            'User management provides CRUD operations for user accounts. Create, read, update, and delete users.',
        },
        {
          id: 'payments',
          content:
            'Payment processing handles credit card transactions and billing. Supports Stripe integration.',
        },
      ];

      await searchEngine.buildIndex(docs);
    });

    test('should find exact matches', async () => {
      const results = await searchEngine.search('authentication');

      expect(results.total).toBeGreaterThan(0);
      expect(results.results[0].docId).toBe('auth');
    });

    test('should find partial matches', async () => {
      const results = await searchEngine.search('user');

      expect(results.total).toBeGreaterThan(0);
      const docIds = results.results.map(r => r.docId);
      expect(docIds).toContain('users');
    });

    test('should rank results by relevance', async () => {
      const results = await searchEngine.search('API');

      expect(results.results[0].score).toBeGreaterThanOrEqual(
        results.results[1].score
      );
    });

    test('should support phrase search', async () => {
      const results = await searchEngine.search('"JWT tokens"');

      expect(results.total).toBeGreaterThan(0);
      expect(results.results[0].docId).toBe('auth');
    });

    test('should handle no results', async () => {
      const results = await searchEngine.search('nonexistentterm');

      expect(results.total).toBe(0);
      expect(results.results).toHaveLength(0);
    });
  });

  describe('Search Filters', () => {
    beforeEach(async () => {
      const docs = [
        {
          id: 'api-doc',
          content: 'API documentation',
          metadata: { category: 'api', language: 'en' },
        },
        {
          id: 'guide',
          content: 'User guide',
          metadata: { category: 'guide', language: 'en' },
        },
        {
          id: 'api-doc-es',
          content: 'Documentación API',
          metadata: { category: 'api', language: 'es' },
        },
      ];

      await searchEngine.buildIndex(docs);
    });

    test('should filter by category', async () => {
      const results = await searchEngine.search('documentation', {
        filters: { category: 'api' },
      });

      expect(results.total).toBe(2);
      results.results.forEach(result => {
        expect(result.document.metadata.category).toBe('api');
      });
    });

    test('should filter by language', async () => {
      const results = await searchEngine.search('API', {
        filters: { language: 'es' },
      });

      expect(results.total).toBe(1);
      expect(results.results[0].docId).toBe('api-doc-es');
    });

    test('should combine multiple filters', async () => {
      const results = await searchEngine.search('API', {
        filters: { category: 'api', language: 'en' },
      });

      expect(results.total).toBe(1);
      expect(results.results[0].docId).toBe('api-doc');
    });
  });

  describe('Performance', () => {
    test('should handle large document sets', async () => {
      const largeDocs = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc${i}`,
        content: `This is document number ${i} with some searchable content.`,
      }));

      const startTime = Date.now();
      await searchEngine.buildIndex(largeDocs);
      const indexTime = Date.now() - startTime;

      expect(indexTime).toBeLessThan(5000); // Should index in less than 5 seconds

      const searchStartTime = Date.now();
      const results = await searchEngine.search('content');
      const searchTime = Date.now() - searchStartTime;

      expect(searchTime).toBeLessThan(1000); // Should search in less than 1 second
      expect(results.total).toBeGreaterThan(0);
    });
  });
});
```

---

## 🔧 维护计划

### 1. 日常维护

#### 1.1 文档生成维护

**自动化文档更新**:

- [ ] 定期检查代码变更并更新文档
- [ ] 验证API文档与实际接口的一致性
- [ ] 监控文档生成过程的性能和稳定性
- [ ] 清理过时的文档和示例

**文档质量保证**:

- [ ] 定期审查文档的准确性和完整性
- [ ] 检查文档链接的有效性
- [ ] 验证代码示例的可执行性
- [ ] 收集用户对文档的反馈和建议

#### 1.2 搜索系统维护

**索引维护**:

- [ ] 定期重建搜索索引以包含最新内容
- [ ] 监控搜索性能和响应时间
- [ ] 优化搜索算法和相关性排序
- [ ] 处理搜索查询日志和分析结果

**搜索优化**:

- [ ] 分析搜索查询模式和用户行为
- [ ] 改进搜索结果的相关性和准确性
- [ ] 添加新的搜索过滤器和排序选项
- [ ] 扩展搜索支持的语言和格式

### 2. 版本管理

#### 2.1 文档版本控制

**版本发布流程**:

```javascript
class DocumentationReleaseManager {
  // 文档发布管理
  async prepareRelease(version, options = {}) {
    const {
      branch = 'main',
      createTag = true,
      updateChangelog = true,
    } = options;

    log_info(`Preparing documentation release: ${version}`);

    // 验证发布条件
    await this.validateRelease(version);

    // 生成发布说明
    const releaseNotes = await this.generateReleaseNotes(version);

    // 准备发布分支
    await this.prepareReleaseBranch(version, branch);

    // 更新版本号
    await this.updateVersionNumbers(version);

    // 验证文档完整性
    await this.validateDocumentation();

    return {
      version,
      releaseNotes,
      branch: `release/docs-${version}`,
      ready: true,
    };
  }

  // 执行发布
  async executeRelease(version, options = {}) {
    const { dryRun = false, publish = true } = options;

    log_info(`Executing documentation release: ${version}`);

    if (dryRun) {
      log_info('DRY RUN: Simulating release process');
      return await this.simulateRelease(version);
    }

    // 合并发布分支
    await this.mergeReleaseBranch(version);

    // 创建发布标签
    await this.createReleaseTag(version);

    // 发布文档
    if (publish) {
      await this.publishDocumentation(version);
    }

    // 清理临时分支
    await this.cleanupReleaseBranches(version);

    // 发送发布通知
    await this.sendReleaseNotification(version);

    log_success(`Documentation release ${version} completed`);
  }

  // 生成发布说明
  async generateReleaseNotes(version) {
    const changes = await this.collectChanges(version);
    const contributors = await this.collectContributors(version);

    return {
      version,
      date: new Date().toISOString(),
      changes: this.categorizeChanges(changes),
      contributors,
      breaking: changes.some(c => c.breaking),
      highlights: this.extractHighlights(changes),
    };
  }

  // 验证发布条件
  async validateRelease(version) {
    // 检查版本格式
    if (!semver.valid(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }

    // 检查是否存在未解决的问题
    const issues = await this.checkReleaseBlockers(version);
    if (issues.length > 0) {
      throw new Error(`Release blocked by issues: ${issues.join(', ')}`);
    }

    // 验证所有必需的文档都已更新
    await this.validateRequiredDocumentation(version);

    // 检查翻译状态
    await this.validateTranslations(version);
  }

  // 收集变更
  async collectChanges(version) {
    const gitLog = await this.runGitCommand(
      `log --oneline --pretty=format:"%h %s" v${this.getPreviousVersion(version)}..HEAD`
    );

    return gitLog.split('\n').map(line => {
      const [hash, ...messageParts] = line.split(' ');
      const message = messageParts.join(' ');

      return {
        hash,
        message,
        type: this.parseCommitType(message),
        scope: this.parseCommitScope(message),
        breaking: message.includes('BREAKING CHANGE'),
      };
    });
  }

  // 分类变更
  categorizeChanges(changes) {
    const categories = {
      features: [],
      fixes: [],
      documentation: [],
      chores: [],
      breaking: [],
    };

    for (const change of changes) {
      if (change.breaking) {
        categories.breaking.push(change);
      } else {
        switch (change.type) {
          case 'feat':
            categories.features.push(change);
            break;
          case 'fix':
            categories.fixes.push(change);
            break;
          case 'docs':
            categories.documentation.push(change);
            break;
          default:
            categories.chores.push(change);
        }
      }
    }

    return categories;
  }

  // 提取亮点
  extractHighlights(changes) {
    // 识别重要的变更
    const highlights = changes.filter(
      change =>
        change.type === 'feat' ||
        change.breaking ||
        change.message.toLowerCase().includes('major') ||
        change.message.toLowerCase().includes('important')
    );

    return highlights.slice(0, 5); // 最多5个亮点
  }

  // 收集贡献者
  async collectContributors(version) {
    const contributors = await this.runGitCommand(
      `shortlog --summary --numbered --email v${this.getPreviousVersion(version)}..HEAD`
    );

    return contributors
      .split('\n')
      .map(line => {
        const match = line.trim().match(/(\d+)\s+(.+?)\s+<(.+)>/);
        if (match) {
          return {
            commits: parseInt(match[1]),
            name: match[2],
            email: match[3],
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  // 获取上一版本
  getPreviousVersion(currentVersion) {
    // 从版本历史中查找上一版本
    const versions = this.getVersionHistory().sort(semver.rcompare);
    const currentIndex = versions.indexOf(currentVersion);

    return currentIndex > 0 ? versions[currentIndex - 1] : '0.0.0';
  }
}
```

#### 2.2 文档协作管理

**贡献者管理**:

- [ ] 管理文档贡献者权限和角色
- [ ] 建立文档审查和批准流程
- [ ] 跟踪文档变更和贡献统计
- [ ] 激励文档贡献和质量改进

### 3. 技术债务管理

#### 3.1 文档债务识别

**内容债务**:

- [ ] 过时或不准确的文档内容
- [ ] 缺失的重要文档和示例
- [ ] 文档结构不清晰或组织混乱
- [ ] 文档覆盖率不足的代码区域

**技术债务**:

- [ ] 文档生成工具链过时或维护困难
- [ ] 文档搜索和导航功能不够完善
- [ ] 多语言文档同步和翻译质量问题
- [ ] 文档发布和分发流程复杂低效

#### 3.2 债务偿还计划

**优先级排序**:

1. **P0 (紧急)**: 影响文档准确性和用户体验的债务
2. **P1 (重要)**: 影响文档维护效率的债务
3. **P2 (一般)**: 影响文档扩展性和创新的债务

**偿还策略**:

- [ ] 每个月度迭代安排3-4个文档债务偿还任务
- [ ] 设立文档债务KPI指标 (每月减少25%)
- [ ] 定期文档债务评审会议，确保债务不积累

### 4. 文档国际化维护

#### 4.1 翻译质量管理

**翻译维护**:

- [ ] 定期检查翻译质量和一致性
- [ ] 更新过时的翻译内容
- [ ] 补充缺失的翻译
- [ ] 验证翻译的上下文准确性

**翻译协作**:

- [ ] 管理翻译贡献者和审阅者
- [ ] 建立翻译标准和指南
- [ ] 协调多语言文档的同步更新
- [ ] 收集翻译反馈和改进建议

#### 4.2 本地化优化

**文化适应**:

- [ ] 根据不同地区用户反馈优化内容
- [ ] 更新本地化示例和代码片段
- [ ] 调整文档结构以适应不同阅读习惯
- [ ] 改进多语言文档的导航和搜索

---

## 📊 成功指标

### 1. 文档质量指标

#### 1.1 内容完整性

- [ ] **文档覆盖率**: 核心功能文档覆盖率 > 95%
- [ ] **API文档完备**: 所有公开API都有完整文档
- [ ] **示例丰富度**: 每个主要功能至少3个使用示例
- [ ] **内容准确性**: 文档与代码一致性 > 98%

#### 1.2 技术指标

- [ ] **生成速度**: 文档生成时间 < 5分钟
- [ ] **搜索响应**: 文档搜索响应时间 < 500ms
- [ ] **可用性**: 文档网站可用性 > 99.9%
- [ ] **加载性能**: 文档页面加载时间 < 2秒

### 2. 用户体验指标

#### 2.1 易用性指标

- [ ] **搜索成功率**: 用户搜索找到相关内容的比例 > 80%
- [ ] **导航效率**: 用户找到所需信息的时间 < 3分钟
- [ ] **理解清晰度**: 用户反馈文档清晰易懂的比例 > 85%
- [ ] **完成度**: 用户按文档完成任务的成功率 > 90%

#### 2.2 国际化指标

- [ ] **语言覆盖**: 支持主要语言的数量 >= 5种
- [ ] **翻译质量**: 翻译准确性评分 > 4.5/5
- [ ] **本地化满意度**: 多语言用户满意度 > 80%
- [ ] **文化适应度**: 内容符合当地文化规范 > 90%

### 3. 社区和协作指标

#### 3.1 贡献活跃度

- [ ] **贡献者数量**: 活跃文档贡献者 > 10人
- [ ] **贡献频率**: 每月文档贡献次数 > 20次
- [ ] **审阅效率**: 文档审阅周期 < 2天
- [ ] **采纳率**: 社区贡献被采纳的比例 > 60%

#### 3.2 影响力和价值

- [ ] **用户增长**: 文档驱动的用户增长 > 15%
- [ ] **支持效率**: 自助解决问题的用户比例 > 70%
- [ ] **品牌认知**: 文档提升品牌认知的评分 > 4/5
- [ ] **商业价值**: 文档带来的商业价值量化评估

---

## 🎯 总结

文档模块作为Sira AI网关的"知识库与学习中心"，承担着全面的技术文档管理、用户指南提供、API参考维护、多语言支持等关键职责。通过精心设计的文档生成系统、版本控制系统、搜索系统和发布系统，文档模块能够：

**技术优势**:

- 自动化文档生成确保内容及时准确
- 智能搜索和导航提升用户查找效率
- 完善的版本控制保证文档变更可追踪
- 多语言支持和本地化适应全球用户需求

**业务价值**:

- 降低用户上手成本，加速产品采用
- 减少支持团队负担，提升服务效率
- 建立专业品牌形象，增强市场竞争力
- 促进内部知识共享，提高团队效率

**架构亮点**:

- 分层架构设计，各司其职，职责清晰
- 插件化文档生成器，支持灵活扩展
- 智能搜索系统，提供精准的内容发现
- 完善的国际化框架，支持全球本地化

通过持续的内容优化、功能扩展和技术创新，文档模块将成为连接开发者、用户与Sira AI网关的桥梁，为项目的成功发展和生态建设提供坚实支撑。
