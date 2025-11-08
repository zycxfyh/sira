/**
 * E2E测试全局清理
 * 在所有E2E测试结束后运行
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🧹 开始E2E测试全局清理...');

  try {
    // 停止所有测试进程
    await stopTestProcesses();

    // 清理测试数据
    await cleanupTestData();

    // 生成测试报告摘要
    await generateTestSummary();

    console.log('✨ E2E测试全局清理完成');
  } catch (error) {
    console.error('❌ E2E测试全局清理失败:', error.message);
    throw error;
  }
};

/**
 * 停止测试进程
 */
async function stopTestProcesses() {
  const processes = [
    'node test/mock-ai-server.js',
    'node src/index.js',
    'EG_CONFIG_DIR=config EG_HTTP_PORT=3004',
  ];

  for (const processPattern of processes) {
    try {
      execSync(`pkill -f "${processPattern}"`, { stdio: 'ignore' });
      console.log(`✅ 停止进程: ${processPattern}`);
    } catch (error) {
      // 忽略进程不存在的错误
      if (!error.message.includes('No such process')) {
        console.warn(`⚠️ 停止进程 ${processPattern} 时出错:`, error.message);
      }
    }
  }

  // 额外等待确保进程完全停止
  await new Promise(resolve => setTimeout(resolve, 2000));
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
  const cleanupPaths = ['test-results/test-data.json', 'test-results/temp', 'test-results/cache'];

  for (const cleanupPath of cleanupPaths) {
    try {
      const fullPath = path.join(__dirname, '..', '..', cleanupPath);
      await fs.rm(fullPath, { recursive: true, force: true });
      console.log(`✅ 清理测试数据: ${cleanupPath}`);
    } catch (error) {
      // 忽略文件不存在的错误
      if (!error.message.includes('ENOENT')) {
        console.warn(`⚠️ 清理 ${cleanupPath} 时出错:`, error.message);
      }
    }
  }
}

/**
 * 生成测试报告摘要
 */
async function generateTestSummary() {
  try {
    const resultsDir = path.join(__dirname, '..', '..', 'test-results');
    const summaryPath = path.join(resultsDir, 'test-summary.json');

    // 收集测试结果
    const summary = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      results: {
        screenshots: await countFiles(path.join(resultsDir, 'screenshots')),
        videos: await countFiles(path.join(resultsDir, 'videos')),
        traces: await countFiles(path.join(resultsDir, 'traces')),
      },
    };

    // 读取Playwright结果
    try {
      const playwrightResults = path.join(
        __dirname,
        '..',
        '..',
        'reports',
        'playwright-results.json'
      );
      const resultsContent = await fs.readFile(playwrightResults, 'utf8');
      const results = JSON.parse(resultsContent);
      summary.playwright = results;
    } catch (error) {
      console.warn('⚠️ 无法读取Playwright结果:', error.message);
    }

    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    console.log('✅ 测试摘要已生成:', summaryPath);
  } catch (error) {
    console.warn('⚠️ 生成测试摘要时出错:', error.message);
  }
}

/**
 * 统计目录中的文件数量
 */
async function countFiles(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    return files.length;
  } catch (error) {
    return 0;
  }
}
