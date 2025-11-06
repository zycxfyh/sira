// 文件路径: apps/frontend/vite.config.bundle-analyzer.ts
// 灵感来源: rollup-plugin-visualizer, webpack-bundle-analyzer
// 核心理念: 可视化分析打包体积，识别优化机会

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    vue(),
    // Bundle Analyzer 插件
    visualizer({
      filename: "./dist/stats.html",
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: "treemap", // 或 "sunburst", "network"
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared-types": fileURLToPath(
        new URL("../../packages/shared-types/src", import.meta.url),
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vue-vendor": ["vue", "vue-router", "pinia"],
          "query-vendor": ["@tanstack/vue-query"],
          "socket-vendor": ["socket.io-client"],
        },
      },
    },
    // 生成 source map 用于分析
    sourcemap: true,
  },
});

