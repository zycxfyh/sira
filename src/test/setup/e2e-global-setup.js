/**
 * E2E测试全局设置
 * 在所有E2E测试开始前运行
 */

const { execSync } = require('child_process')
const fs = require('fs').promises
const path = require('path')

module.exports = async () => {
  console.log('🚀 设置E2E测试环境...')

  try {
    // 确保测试结果目录存在
    await fs.mkdir('test-results', { recursive: true })
    await fs.mkdir('test-results/screenshots', { recursive: true })
    await fs.mkdir('test-results/videos', { recursive: true })

    // 启动Mock AI服务器
    console.log('🤖 启动Mock AI服务器...')
    const mockServerProcess = execSync('node test/mock-ai-server.js', {
      detached: true,
      stdio: 'ignore'
    })

    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 验证服务器是否运行
    try {
      execSync('curl -f http://localhost:3002/health', { stdio: 'pipe' })
      console.log('✅ Mock AI服务器启动成功')
    } catch (error) {
      console.error('❌ Mock AI服务器启动失败')
      throw error
    }

    // 启动Sira网关
    console.log('🚀 启动Sira网关...')
    const gatewayProcess = execSync(
      'cross-env EG_CONFIG_DIR=config EG_HTTP_PORT=3004 EG_ADMIN_PORT=3005 node lib/index.js',
      {
        detached: true,
        stdio: 'ignore'
      }
    )

    // 等待网关启动
    await new Promise(resolve => setTimeout(resolve, 5000))

    // 验证网关是否运行
    try {
      execSync('curl -f http://localhost:3004/health', { stdio: 'pipe' })
      console.log('✅ Sira网关启动成功')
    } catch (error) {
      console.error('❌ Sira网关启动失败')
      throw error
    }

    // 设置测试数据
    console.log('📊 初始化测试数据...')
    await initializeTestData()

    console.log('🎯 E2E测试环境设置完成')

    // 返回清理函数
    return async () => {
      console.log('🧹 清理E2E测试环境...')

      try {
        // 停止Mock服务器
        execSync('pkill -f "node test/mock-ai-server.js"', { stdio: 'ignore' })
        console.log('✅ Mock AI服务器已停止')
      } catch (error) {
        console.warn('⚠️ 停止Mock AI服务器时出错:', error.message)
      }

      try {
        // 停止网关
        execSync('pkill -f "node lib/index.js"', { stdio: 'ignore' })
        console.log('✅ Sira网关已停止')
      } catch (error) {
        console.warn('⚠️ 停止Sira网关时出错:', error.message)
      }

      console.log('✨ E2E测试环境清理完成')
    }

  } catch (error) {
    console.error('❌ E2E测试环境设置失败:', error.message)
    throw error
  }
}

/**
 * 初始化测试数据
 */
async function initializeTestData() {
  // 这里可以添加初始化测试数据的逻辑
  // 例如：创建测试用户、API密钥、应用等

  // 创建测试API密钥
  const testApiKey = {
    key: 'sk_test_e2e_' + Date.now(),
    name: 'E2E Test Key',
    scopes: ['read', 'write'],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }

  // 保存到临时文件供测试使用
  const testDataPath = path.join(__dirname, '..', '..', 'test-results', 'test-data.json')
  await fs.writeFile(testDataPath, JSON.stringify({
    apiKey: testApiKey,
    timestamp: new Date().toISOString()
  }, null, 2))

  console.log('✅ 测试数据初始化完成')
}
