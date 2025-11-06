// 文件路径: apps/creation-agent/jest.config.js
const baseConfig = require('../../shared/jest.config.js');

module.exports = {
  ...baseConfig,
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^rebuff/src/lib/detect$': '<rootDir>/../../../tests/mocks/rebuff-detect.ts',
    '^langfuse$': '<rootDir>/../../../tests/mocks/langfuse.ts',
    '^langfuse/(.*)$': '<rootDir>/../../../tests/mocks/langfuse.ts',
  },
};
