// 文件路径: .lighthouserc.js
// 灵感来源: Lighthouse CI (https://github.com/GoogleChrome/lighthouse-ci)
// 核心理念: 自动化性能审计，确保性能指标达标

module.exports = {
  ci: {
    collect: {
      // 要审计的 URL
      url: [
        'http://localhost:5173/',
        'http://localhost:5173/games',
        'http://localhost:5173/settings',
      ],
      // 启动服务器命令
      startServerCommand: 'pnpm --filter frontend dev',
      // 等待服务器启动
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
      // 审计次数
      numberOfRuns: 3,
    },
    assert: {
      // 性能阈值
      assertions: {
        // 性能评分
        'categories:performance': ['error', { minScore: 0.8 }],
        // 可访问性评分
        'categories:accessibility': ['error', { minScore: 0.9 }],
        // 最佳实践评分
        'categories:best-practices': ['error', { minScore: 0.9 }],
        // SEO 评分
        'categories:seo': ['error', { minScore: 0.8 }],
        // 首屏渲染时间
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        // 最大内容绘制
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        // 累积布局偏移
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        // 首次输入延迟
        'first-input-delay': ['error', { maxNumericValue: 100 }],
        // 总阻塞时间
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        // 速度指数
        'speed-index': ['error', { maxNumericValue: 3000 }],
      },
    },
    upload: {
      // 上传报告到临时存储（可选）
      target: 'temporary-public-storage',
    },
  },
};
