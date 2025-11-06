// 文件路径: commitlint.config.js
// 灵感来源: Commitlint (https://github.com/conventional-changelog/commitlint)
// 核心理念: 规范化 Git 提交信息，提升代码库可维护性

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // 类型必须是小写
    "type-case": [2, "always", "lower-case"],
    
    // 类型不能为空
    "type-empty": [2, "never"],
    
    // 类型枚举
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新功能
        "fix", // 修复 bug
        "docs", // 文档变更
        "style", // 代码格式（不影响代码运行的变动）
        "refactor", // 重构（既不是新增功能，也不是修复 bug）
        "perf", // 性能优化
        "test", // 增加测试
        "chore", // 构建过程或辅助工具的变动
        "revert", // 回滚
        "build", // 构建系统或外部依赖的变更
        "ci", // CI 配置文件和脚本的变更
      ],
    ],
    
    // 主题不能为空
    "subject-empty": [2, "never"],
    
    // 主题不能以句号结尾
    "subject-full-stop": [2, "never", "."],
    
    // 主题最大长度
    "subject-max-length": [2, "always", 100],
    
    // 主题最小长度
    "subject-min-length": [2, "always", 10],
    
    // 正文每行最大长度
    "body-max-line-length": [2, "always", 200],
    
    // 页脚必须为空或遵循格式
    "footer-leading-blank": [2, "always"],
    
    // 页脚最大行长度
    "footer-max-line-length": [2, "always", 200],
    
    // 头部最大长度
    "header-max-length": [2, "always", 200],
    
    // 头部最小长度
    "header-min-length": [2, "always", 10],
    
    // 作用域必须是小写
    "scope-case": [2, "always", "lower-case"],
    
    // 作用域可以为空
    "scope-empty": [0],
  },
  
  // 自定义解析器（如果需要）
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w*)(?:\((.*)\))?: (.*)$/,
      headerCorrespondence: ["type", "scope", "subject"],
    },
  },
  
  // 帮助链接
  helpUrl: "https://github.com/conventional-changelog/commitlint/#what-is-commitlint",
};

