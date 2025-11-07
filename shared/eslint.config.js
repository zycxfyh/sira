// 文件路径: shared/eslint.config.js
// 共享的ESLint配置，用于所有NestJS应用
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const security = require('eslint-plugin-security');

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.d.ts', 'eslint.config.js', 'jest.config.js'],
  },
);
