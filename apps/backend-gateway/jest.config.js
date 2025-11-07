// 文件路径: apps/backend-gateway/jest.config.js
const baseConfig = require('../../shared/jest.config.js');

module.exports = {
  ...baseConfig,
  setupFiles: ['<rootDir>/../../../packages/common-backend/test/env-setup.js'],
  setupFilesAfterEnv: ['<rootDir>/../../../packages/common-backend/test/setup.ts'],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^langfuse$': '<rootDir>/../../../tests/mocks/langfuse.ts',
    '^langfuse/(.*)$': '<rootDir>/../../../tests/mocks/langfuse.ts',
  },
};
