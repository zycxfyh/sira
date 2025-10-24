// 文件路径: apps/frontend/playwright.config.ts (已修正并转为TS)

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// pnpm --filter <package_name> dev 
const PORT = process.env.PORT || 5173;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  
  timeout: 60 * 1000,
  
  expect: {
    timeout: 5000,
  },
  
  fullyParallel: true,
  
  retries: process.env.CI ? 2 : 0,
  
  workers: process.env.CI ? 1 : undefined,
  
  reporter: 'html',
  
  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  webServer: {
    // [核心修正] 使用 pnpm exec 来确保命令在正确的工作区内执行
    command: 'pnpm --filter frontend exec vite dev',
    url: baseURL,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});