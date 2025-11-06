const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const vueParser = require('vue-eslint-parser');

module.exports = [
  {
    ignores: [
      'dist/',
      'node_modules/',
      'eslint.config.js',
      '**/*.min.js',
      '**/*.config.js',
      'coverage/',
      '.vite/'
    ]
  },
  {
    files: ['src/**/*.{js,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      globals: {
        // 浏览器环境全局变量
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        // Vue环境
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly',
        // Node环境 (配置和构建文件)
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      // 基础代码质量规则
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // 代码风格规则 (警告级别)
      'prefer-const': 'warn',
      'no-var': 'warn',
      'eqeqeq': ['warn', 'always'],
      'curly': ['warn', 'all'],

      // 潜在错误规则
      'no-unreachable': 'error',
      'no-duplicate-imports': 'warn',
      'valid-typeof': 'error'
    }
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: 'module',
        ecmaVersion: 'latest'
      },
      globals: {
        // 浏览器环境全局变量
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        // Vue环境
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly',
        // Node环境 (配置和构建文件)
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      // 基础代码质量规则
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // 代码风格规则 (警告级别)
      'prefer-const': 'warn',
      'no-var': 'warn',
      'eqeqeq': ['warn', 'always'],

      // 潜在错误规则
      'no-unreachable': 'error',
      'valid-typeof': 'error'
    }
  }
];