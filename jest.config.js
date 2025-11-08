module.exports = {
  // 测试环境设置
  testEnvironment: 'node',
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },

  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/src/test/**/*.test.js',
    '<rootDir>/src/test/**/*.spec.js',
    '<rootDir>/src/test/**/*.test.ts',
    '<rootDir>/src/test/**/*.spec.ts'
  ],

  // 忽略的文件和目录
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/src/test/e2e/', // E2E测试使用Playwright
    '<rootDir>/coverage/',
    '<rootDir>/reports/'
  ],

  // 模块映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/core/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1'
  },

  // 转换器
  transform: {
    '^.+\\.(js|ts)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', {
          targets: { node: '18' },
          modules: 'commonjs'
        }]
      ]
    }]
  },

  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json', 'ts'],

  // 收集覆盖率的文件
  collectCoverageFrom: [
    'src/core/**/*.js',
    'src/bin/**/*.js',
    '!src/core/config/**/*.json',
    '!src/core/locales/**/*.json',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/reports/**'
  ],

  // 覆盖率报告配置
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json',
    'clover'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // 测试设置
  setupFilesAfterEnv: ['<rootDir>/src/test/setup/jest.setup.js'],
  testTimeout: 10000,

  // 并行执行
  maxWorkers: '50%',

  // 检测测试泄漏
  detectOpenHandles: true,
  detectMemoryLeaks: true,

  // 快照配置
  snapshotSerializers: [],

  // 全局设置
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },

  // 自定义环境
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/test/unit/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/test/integration/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/src/test/setup/integration.setup.js']
    },
    {
      displayName: 'component',
      testMatch: ['<rootDir>/src/test/component/**/*.test.js'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/src/test/setup/component.setup.js']
    },
    {
      displayName: 'contract',
      testMatch: ['<rootDir>/src/test/contract/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/test/performance/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 30000
    }
  ],

  // 报告器
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'reports/junit',
      outputName: 'jest-junit.xml',
      suiteName: 'Sira AI Gateway Tests'
    }]
  ],

  // 缓存配置
  cacheDirectory: '<rootDir>/.jest/cache',

  // 错误处理
  bail: false, // 不要在第一个失败时停止
  verbose: true,

  // 清理
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
}
