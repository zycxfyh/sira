// 文件路径: apps/frontend/tests/e2e/auth.spec.js (侦察模式)

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
  });

  test('should allow a user to log in and be redirected to the nexus hub', async ({ page }) => {
    // 1. 导航到登录页面
    await page.goto('/login');

    // [核心侦察] 在断言之前，打印出页面的HTML内容
    console.log(await page.content());

    // 2. 断言关键元素（登录表单）是否可见
    await expect(page.locator('.auth-form')).toBeVisible();

    // ... 后续步骤保持不变 ...
    await expect(page.locator('h2')).toHaveText('观测者登录');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).toHaveURL('/nexus');
    await expect(page.locator('h2')).toHaveText('观测者中枢');
  });
});
