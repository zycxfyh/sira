// 文件路径: shared/jest.config.js
// 共享的Jest配置，用于所有NestJS应用
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../tsconfig.base.json');

const baseModuleNameMapper = pathsToModuleNameMapper(compilerOptions.paths || {}, {
  prefix: '<rootDir>/../../..',
});

module.exports = {
  // 指定 ts-jest 作为所有 .ts 和 .tsx 文件的处理器
  preset: 'ts-jest',
  // 指定测试环境为 node
  testEnvironment: 'node',
  // Jest 应该在哪里寻找测试文件
  testRegex: '.*\\.spec\\.ts$',
  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  // 根目录
  rootDir: 'src',
  moduleNameMapper: baseModuleNameMapper,
  // 覆盖率收集
  collectCoverageFrom: ['**/*.ts', '!**/*.d.ts'],
  // ts-jest 配置
  globals: {
    'ts-jest': {},
  },
  // 处理ESM和动态导入
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
    },
  },
  // 转换器配置
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  // 模块配置
  moduleNameMapper: {
    ...baseModuleNameMapper,
    // Mock external libraries to avoid dynamic import issues
    '^langfuse-core$': '/c/Users/16663/Desktop/tuheg/tests/mocks/langfuse-core.ts',
    '^langfuse-core/(.*)$': '/c/Users/16663/Desktop/tuheg/tests/mocks/langfuse-core.ts',
    '^jsonrepair$': '/c/Users/16663/Desktop/tuheg/tests/mocks/jsonrepair.ts',
  },
};
