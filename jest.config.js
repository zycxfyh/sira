const failFastConfig = require('./test-fail-fast.config');

module.exports = {
  // 基础配置 - 先让测试能运行起来
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/test/**/*.test.js', '<rootDir>/src/test/**/*.spec.js'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/src/test/e2e/'],

  // 测试快速失败机制 - GitHub社区最佳实践
  // 根据测试类型应用相应的快速失败策略
  ...failFastConfig.getConfig(process.env.TEST_TYPE || 'unit'),

  // 暂时禁用复杂的配置
  setupFilesAfterEnv: ['<rootDir>/src/test/setup/jest.setup.js'],
  verbose: true,

  // 处理异步操作和定时器
  forceExit: true, // 强制退出，避免悬挂的异步操作
  detectOpenHandles: false, // 禁用检测打开的句柄，避免不必要的警告
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // 全局设置
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
