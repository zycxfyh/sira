const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: [
    '**/*.spec.ts', // 单元测试
    '**/*.e2e-spec.ts', // 集成测试
  ],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: [path.join(__dirname, 'test', 'setup.ts')],

  // 集成测试配置
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'src',
      testMatch: ['<rootDir>/**/*.spec.ts'],
      testPathIgnorePatterns: ['\\.e2e-spec\\.ts$'],
      setupFilesAfterEnv: [path.join(__dirname, 'test', 'setup.ts')],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'src',
      testMatch: ['<rootDir>/**/*.e2e-spec.ts'],
      testPathIgnorePatterns: ['\\.spec\\.ts$'],
      setupFilesAfterEnv: [path.join(__dirname, 'test', 'integration-setup.ts')],
    },
  ],
};
