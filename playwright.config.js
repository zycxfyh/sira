/**
 * Playwright配置文件
 * 用于端到端测试和视觉回归测试
 */

const { defineConfig, devices } = require('@playwright/test');
const failFastConfig = require('./test-fail-fast.config');

module.exports = defineConfig({
  // 测试发现
  testDir: './test/e2e',
  testMatch: '**/*.e2e.test.js',

  // 测试快速失败机制 - GitHub社区最佳实践
  // 根据测试类型应用相应的快速失败策略
  bail: failFastConfig.getConfig(process.env.TEST_TYPE || 'e2e').bail,

  // 并行执行
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  // 失败重试
  retries: process.env.CI ? 2 : 0,

  // 报告器
  reporter: [
    ['html'],
    ['junit', { outputFile: 'reports/playwright-junit.xml' }],
    ['json', { outputFile: 'reports/playwright-results.json' }],
  ],

  // 共享设置
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3004',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // 项目配置
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // 视觉回归测试项目
    {
      name: 'visual-regression',
      testMatch: '**/*.visual.test.js',
      use: {
        ...devices['Desktop Chrome'],
        screenshot: 'on',
      },
    },

    // 可访问性测试项目
    {
      name: 'accessibility',
      testMatch: '**/*.accessibility.test.js',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // 全局设置
  globalSetup: require.resolve('./test/setup/e2e-global-setup.js'),
  globalTeardown: require.resolve('./test/setup/e2e-global-teardown.js'),

  // 期望超时
  expect: {
    timeout: 10000,
  },

  // 全局超时
  timeout: 30000,

  // 输出目录
  outputDir: 'test-results/',

  // 快照配置
  snapshotDir: 'test/snapshots',

  // 忽略HTTPS错误（用于开发环境）
  ignoreHTTPSErrors: true,

  // Web服务器配置
  webServer: {
    command: 'npm run mock:server',
    port: 3002,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
