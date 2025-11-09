module.exports = {
  env: {
    node: true,
    es6: true,
    jest: true, // 启用Jest环境，这样jest、describe、it、beforeEach等都可用
  },
  globals: {
    jest: "readonly", // 明确声明jest为全局只读变量
    describe: "readonly",
    it: "readonly",
    test: "readonly",
    expect: "readonly",
    beforeEach: "readonly",
    afterEach: "readonly",
    beforeAll: "readonly",
    afterAll: "readonly",
    before: "readonly", // Jest before hook
    after: "readonly", // Jest after hook
  },
  extends: [
    "standard",
    "prettier", // 必须放在最后，确保Prettier规则覆盖ESLint规则
  ],
  plugins: ["prettier"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  rules: {
    // Prettier规则冲突解决
    "prettier/prettier": "error",

    // 自定义规则
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",

    // 代码质量规则
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-arrow-callback": "error",
    "prefer-destructuring": ["error", { object: true, array: false }],
    "no-useless-concat": "error",
    "no-useless-return": "error",
  },
  ignorePatterns: [
    "node_modules/",
    "coverage/",
    "reports/",
    "*.min.js",
    "dist/",
    "build/",
    ".nx/",
    "tmp/",
  ],
};
