// 文件路径: packages/common-backend/vitest.config.ts
// 灵感来源: Vitest (https://github.com/vitest-dev/vitest)
// 核心理念: 快速测试执行，ESM 原生支持，Jest 兼容

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // 测试环境
    environment: "node",
    
    // 全局测试文件
    globals: true,
    
    // 测试文件匹配模式
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
    
    // 排除文件
    exclude: ["node_modules", "dist", ".turbo"],
    
    // 覆盖率配置
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/*.d.ts",
        "**/index.ts",
        "**/types/**",
      ],
      // 覆盖率阈值
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      // 报告目录
      reportsDirectory: "./coverage",
    },
    
    // 测试超时
    testTimeout: 10000,
    
    // 钩子超时
    hookTimeout: 10000,
    
    // 设置文件
    setupFiles: ["./src/test/setup.ts"],
    
    // 并行执行
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },
    
    // 重试配置
    retry: 2,
    
    // 报告器
    reporters: ["verbose", "junit"],
    outputFile: {
      junit: "./coverage/junit.xml",
    },
  },
  
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@tuheg/common-backend": resolve(__dirname, "./src"),
    },
  },
});

