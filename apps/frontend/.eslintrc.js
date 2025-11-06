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
        // Browser environment globals
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
        // Node environment (for config and build files)
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      // Basic code quality rules
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // Code style rules (warning level)
      'prefer-const': 'warn',
      'no-var': 'warn',
      'eqeqeq': ['warn', 'always'],
      'curly': ['warn', 'all'],

      // Potential error rules
      'no-unreachable': 'error',
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
        // Browser environment globals
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
        // Vue environment
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly',
        // Node environment (for config and build files)
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        global: 'readonly'
      }
    },
    rules: {
      // Basic code quality rules
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // Code style rules (warning level)
      'prefer-const': 'warn',
      'no-var': 'warn',
      'eqeqeq': ['warn', 'always'],

      // Potential error rules
      'no-unreachable': 'error',
      'valid-typeof': 'error'
    }
  }
];
