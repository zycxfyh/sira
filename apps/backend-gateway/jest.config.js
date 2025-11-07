// 文件路径: apps/backend-gateway/jest.config.js
const sharedConfig = require('../../shared/jest.config.js');

module.exports = {
  ...sharedConfig,
  setupFiles: ['<rootDir>/../../../packages/common-backend/test/env-setup.js'],
  setupFilesAfterEnv: ['<rootDir>/../../../packages/common-backend/test/setup.ts'],
  moduleNameMapper: {
    ...sharedConfig.moduleNameMapper,
    '^langfuse$': '<rootDir>/../../../tests/mocks/langfuse.ts',
    '^langfuse/(.*)$': '<rootDir>/../../../tests/mocks/langfuse.ts',
  },
};
