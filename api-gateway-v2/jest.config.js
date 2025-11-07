module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js', // Entry point
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/migrations/**',
    '!src/**/seeds/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'cobertura'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/docs/',
    '/scripts/',
    '/monitoring/'
  ],
  transformIgnorePatterns: [
    '/node_modules/'
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['jest-html-reporter', {
      pageTitle: 'API Gateway V2 Test Report',
      outputPath: 'test-results/test-report.html',
      includeFailureMsg: true,
      includeStackTrace: true,
      includeConsoleLog: true,
      styleOverridePath: 'tests/jest-html-reporter.css'
    }]
  ],
  // Performance settings
  maxWorkers: '50%',
  cache: true,
  // Error handling
  bail: false,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  // Coverage settings
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true
};
