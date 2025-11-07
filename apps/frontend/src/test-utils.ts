// 文件路径: apps/frontend/src/test-utils.ts
// 核心理念: 用户中心的测试，优先使用可访问的查询方式

import { render, type RenderOptions } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import type { Component } from 'vue';

/**
 * @interface TestUtilsOptions
 * @description 测试工具选项
 */
export interface TestUtilsOptions extends RenderOptions {
  /** 路由配置 */
  routes?: Array<{ path: string; component: Component }>;
  /** 初始路由 */
  initialRoute?: string;
  /** 是否创建 Pinia store */
  createStore?: boolean;
}

/**
 * @function renderWithProviders
 * @description 使用 Testing Library 理念渲染组件
 * 提供路由、状态管理等完整上下文
 *
 * @example
 * ```typescript
 * const { getByRole, getByText } = renderWithProviders(MyComponent, {
 *   props: { title: 'Test' },
 *   routes: [{ path: '/', component: MyComponent }],
 * });
 *
 * expect(getByRole('heading')).toHaveTextContent('Test');
 * ```
 */
export function renderWithProviders(component: Component, options: TestUtilsOptions = {}) {
  const { routes = [], initialRoute = '/', createStore = true, ...renderOptions } = options;

  // 创建 Pinia store（如果需要）
  if (createStore) {
    const pinia = createPinia();
    setActivePinia(pinia);
    renderOptions.global = {
      ...renderOptions.global,
      plugins: [...(renderOptions.global?.plugins ?? []), pinia],
    };
  }

  // 创建路由（如果需要）
  if (routes.length > 0) {
    const router = createRouter({
      history: createWebHistory(),
      routes,
    });
    router.push(initialRoute);
    renderOptions.global = {
      ...renderOptions.global,
      plugins: [...(renderOptions.global?.plugins ?? []), router],
    };
  }

  return render(component, renderOptions);
}

/**
 * @function waitFor
 * @description 等待异步操作完成
 * 遵循 Testing Library 的异步等待模式
 */
export async function waitFor(
  callback: () => void | Promise<void>,
  options: {
    timeout?: number;
    interval?: number;
  } = {},
): Promise<void> {
  const { timeout = 1000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await callback();
      return;
    } catch (error) {
      if (Date.now() - startTime >= timeout) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(`waitFor timeout after ${timeout}ms`);
}

/**
 * @function findByRole
 * @description 通过角色查找元素（可访问性优先）
 */
export function findByRole(container: HTMLElement, role: string, options?: { name?: string }) {
  const elements = container.querySelectorAll(`[role="${role}"]`);

  if (options?.name) {
    return Array.from(elements).find((el) => el.textContent?.includes(options.name ?? ''));
  }

  return elements[0] ?? null;
}

/**
 * @function findByLabelText
 * @description 通过标签文本查找元素
 */
export function findByLabelText(container: HTMLElement, text: string): HTMLElement | null {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((l) => l.textContent?.includes(text));

  if (label && label.htmlFor) {
    return container.querySelector(`#${label.htmlFor}`);
  }

  return label ?? null;
}

/**
 * @function findByPlaceholderText
 * @description 通过占位符文本查找元素
 */
export function findByPlaceholderText(container: HTMLElement, text: string): HTMLElement | null {
  const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input, textarea'));
  return inputs.find((input) => input.placeholder?.includes(text)) ?? null;
}
