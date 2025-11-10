module.exports = {
  testMatch: [
    '**/tests/**/*.test.js',
    '**/packages/**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.js',
    'packages/**/*.js',
    '!src/test/**',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json'],
  // 处理ES模块问题
  transformIgnorePatterns: ['node_modules'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  // 设置测试环境变量
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  // 模块映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@sira/(.*)$': '<rootDir>/packages/$1',
  },
  // 快速失败
  bail: true,
  maxWorkers: 4,
  // 检测慢测试
  slowTestThreshold: 5000,
  // 资源泄露检测
  detectLeaks: false,
  // 使用默认测试环境
  testEnvironment: 'node',
};
