// Jest configuration for common-backend package
const baseConfig = require('../../shared/jest.config.js');

module.exports = {
  ...baseConfig,
  rootDir: '../..',
  setupFiles: ['<rootDir>/packages/common-backend/test/env-setup.js'],
  setupFilesAfterEnv: ['<rootDir>/packages/common-backend/test/setup.ts'],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^@tuheg/common-backend$': '<rootDir>/packages/common-backend/src/index.ts',
    '^@tuheg/common-backend/(.*)$': '<rootDir>/packages/common-backend/src/$1',
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'json', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
};