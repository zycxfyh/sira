/**
 * Extensions Module
 * 统一管理文档、国际化、模板等扩展功能
 */

// 快速失败：验证Node.js版本
const requiredNodeVersion = 18;
if (parseInt(process.versions.node.split(".")[0], 10) < requiredNodeVersion) {
  console.error(
    `❌ Node.js版本过低。需要Node.js ${requiredNodeVersion}+，当前版本: ${process.versions.node}`,
  );
  process.exit(1);
}

// 快速失败：验证必需的环境变量
const requiredEnvVars = ["NODE_ENV"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ 缺少必需的环境变量: ${envVar}`);
    process.exit(1);
  }
}

// 快速失败：验证依赖模块
const requiredModules = [
  "./doc-generator",
  "./knowledge-base",
  "./search-system",
  "./i18n-manager",
  "./template-engine",
];

for (const modulePath of requiredModules) {
  try {
    require.resolve(modulePath);
  } catch (error) {
    console.error(`❌ 无法加载必需模块: ${modulePath}`, error.message);
    process.exit(1);
  }
}

const { DocGenerator } = require("./doc-generator");
const { KnowledgeBase } = require("./knowledge-base");
const { SearchSystem } = require("./search-system");
const { I18nManager, i18nManager: i18n } = require("./i18n-manager");
const { TemplateEngine } = require("./template-engine");

// 快速失败：验证构造函数存在
if (
  !DocGenerator ||
  !KnowledgeBase ||
  !SearchSystem ||
  !I18nManager ||
  !TemplateEngine
) {
  console.error("❌ 核心组件加载失败");
  process.exit(1);
}

class ExtensionsManager {
  constructor(options = {}) {
    // 快速失败：验证选项参数
    if (typeof options !== "object" || options === null) {
      throw new Error("ExtensionsManager选项必须是有效的对象");
    }

    try {
      // 初始化文档系统
      console.log("📚 初始化文档系统...");
      this.docGenerator = new DocGenerator();
      if (
        !this.docGenerator ||
        typeof this.docGenerator.generate !== "function"
      ) {
        throw new Error("DocGenerator初始化失败");
      }

      this.knowledgeBase = new KnowledgeBase();
      if (
        !this.knowledgeBase ||
        typeof this.knowledgeBase.search !== "function"
      ) {
        throw new Error("KnowledgeBase初始化失败");
      }

      this.searchSystem = new SearchSystem();
      if (!this.searchSystem || typeof this.searchSystem.index !== "function") {
        throw new Error("SearchSystem初始化失败");
      }

      // 初始化国际化系统
      console.log("🌍 初始化国际化系统...");
      this.i18nManager = new I18nManager(options.i18n);
      if (!this.i18nManager || typeof this.i18nManager.t !== "function") {
        throw new Error("I18nManager初始化失败");
      }

      // 初始化模板系统
      console.log("📝 初始化模板系统...");
      this.templateEngine = new TemplateEngine();
      if (
        !this.templateEngine ||
        typeof this.templateEngine.render !== "function"
      ) {
        throw new Error("TemplateEngine初始化失败");
      }

      console.log("✅ ExtensionsManager初始化完成");
    } catch (error) {
      console.error("❌ ExtensionsManager初始化失败:", error.message);
      throw error; // 重新抛出错误，实现快速失败
    }
  }

  // 文档相关方法
  generateDocs(outputPath) {
    return this.docGenerator.generate(outputPath);
  }

  searchDocs(query) {
    return this.searchSystem.search(query);
  }

  // 国际化相关方法
  translate(key, replacements = {}) {
    return this.i18nManager ? this.i18nManager.t(key, replacements) : key;
  }

  setLocale(locale) {
    return this.i18nManager ? this.i18nManager.setLocale(locale) : false;
  }

  // 模板相关方法
  scaffoldProject(template, destination) {
    return this.templateEngine
      ? this.templateEngine.scaffold(template, destination)
      : Promise.reject(new Error("Template engine not available"));
  }

  generateCode(type, options) {
    return this.templateEngine
      ? this.templateEngine.generate(type, options)
      : Promise.reject(new Error("Template engine not available"));
  }
}

const extensionsManager = new ExtensionsManager();

module.exports = {
  ExtensionsManager,
  extensionsManager,

  // 便捷导出
  DocGenerator,
  KnowledgeBase,
  SearchSystem,
  I18nManager,
  TemplateEngine,

  // 便捷函数
  t: extensionsManager.translate.bind(extensionsManager),
  generateDocs: extensionsManager.generateDocs.bind(extensionsManager),
  scaffoldProject: extensionsManager.scaffoldProject.bind(extensionsManager),
};
