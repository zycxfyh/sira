#!/usr/bin/env node

/**
 * Sira AI网关 - 工业级测试演示
 * 展示如何使用工业级测试框架进行各种类型的测试
 */

const { IndustrialTestRunner } = require('./run-industrial-tests')
const { LoadTestingTool } = require('./lib/load-testing')
const { StressTestingTool } = require('./lib/stress-testing')
const { PerformanceTestingTool } = require('./lib/performance-testing')

class IndustrialTestingDemo {
  constructor() {
    this.runner = null
  }

  async initialize() {
    console.log('🎬 欢迎使用Sira AI网关工业级测试演示')
    console.log('=' .repeat(60))

    this.runner = new IndustrialTestRunner()
    await this.runner.initialize()
  }

  async runDemo() {
    try {
      console.log('\n📋 演示内容:')
      console.log('1. 快速测试套件')
      console.log('2. 性能基准测试')
      console.log('3. 负载测试演示')
      console.log('4. 压力测试演示')
      console.log('5. 综合测试报告')
      console.log('6. 自定义测试场景')
      console.log('')

      // 1. 快速测试演示
      await this.demoQuickTest()

      // 2. 性能基准测试演示
      await this.demoPerformanceBenchmark()

      // 3. 负载测试演示
      await this.demoLoadTest()

      // 4. 压力测试演示
      await this.demoStressTest()

      // 5. 综合报告演示
      await this.demoReportGeneration()

      // 6. 自定义场景演示
      await this.demoCustomScenario()

      console.log('\n🎉 工业级测试演示完成!')
      console.log('查看 reports/ 目录中的详细报告')

    } catch (error) {
      console.error('演示过程中发生错误:', error.message)
      console.log('提示: 确保网关服务正在运行 (npm start)')
    }
  }

  async demoQuickTest() {
    console.log('\n🔬 演示 1: 快速测试套件')
    console.log('-'.repeat(40))

    const startTime = Date.now()

    try {
      const result = await this.runner.runQuickTest({
        format: 'json'
      })

      const duration = Date.now() - startTime

      console.log(`✅ 快速测试完成 (${duration}ms)`)
      console.log(`   状态: ${result.success ? '通过' : '失败'}`)
      console.log(`   测试数量: ${result.results.length}`)
      console.log(`   报告位置: ${result.report.reports.json.path}`)

    } catch (error) {
      console.log(`⚠️  快速测试跳过: ${error.message}`)
      console.log('   提示: 这需要运行中的网关服务')
    }
  }

  async demoPerformanceBenchmark() {
    console.log('\n📊 演示 2: 性能基准测试')
    console.log('-'.repeat(40))

    try {
      const result = await this.runner.runPerformanceBenchmark({
        format: 'json'
      })

      console.log(`✅ 性能基准测试完成`)
      console.log(`   测试场景: ${result.results.length} 个`)
      console.log(`   总体状态: ${result.success ? '通过' : '失败'}`)

      result.results.forEach(r => {
        console.log(`   ${r.scenario}: ${r.success ? '✅' : '❌'}`)
      })

    } catch (error) {
      console.log(`⚠️  性能测试跳过: ${error.message}`)
    }
  }

  async demoLoadTest() {
    console.log('\n📈 演示 3: 负载测试 (轻量级)')
    console.log('-'.repeat(40))

    try {
      const result = await this.runner.runLoadTest({
        targetRPS: 10,  // 降低负载以便演示
        duration: 30,   // 缩短测试时间
        format: 'json'
      })

      console.log(`✅ 负载测试完成`)
      console.log(`   目标RPS: 10`)
      console.log(`   测试时长: 30秒`)
      console.log(`   实际RPS: ${result.result.summary.averageRPS}`)
      console.log(`   错误率: ${result.result.summary.errorRate}`)

    } catch (error) {
      console.log(`⚠️  负载测试跳过: ${error.message}`)
    }
  }

  async demoStressTest() {
    console.log('\n💥 演示 4: 压力测试 (轻量级)')
    console.log('-'.repeat(40))

    try {
      const result = await this.runner.runStressTest({
        scenario: 'memory_stress',
        intensity: 'low',  // 使用低强度以便演示
        duration: 20,      // 缩短测试时间
        format: 'json'
      })

      console.log(`✅ 压力测试完成`)
      console.log(`   测试场景: memory_stress`)
      console.log(`   强度级别: low`)
      console.log(`   系统中断次数: ${result.result.summary.totalOutages}`)

    } catch (error) {
      console.log(`⚠️  压力测试跳过: ${error.message}`)
    }
  }

  async demoReportGeneration() {
    console.log('\n📋 演示 5: 测试报告生成')
    console.log('-'.repeat(40))

    try {
      // 生成一个模拟的测试结果
      const mockResults = [
        { name: '单元测试', success: true, duration: 1500, type: 'unit' },
        { name: '集成测试', success: true, duration: 3000, type: 'integration' },
        { name: 'E2E测试', success: false, duration: 8000, type: 'e2e', error: '页面加载超时' }
      ]

      const { TestReportGenerator } = require('./lib/test-report-generator')
      const reporter = new TestReportGenerator()

      const report = await reporter.generateReport(mockResults, {
        format: 'html',
        testType: 'demo',
        includeCharts: false,
        includeTrends: false
      })

      console.log(`✅ 报告生成完成`)
      console.log(`   HTML报告: ${report.reports.html.path}`)
      console.log(`   测试摘要: ${report.summary.totalTests} 测试, 成功率 ${report.summary.successRate}`)

    } catch (error) {
      console.log(`⚠️  报告生成演示失败: ${error.message}`)
    }
  }

  async demoCustomScenario() {
    console.log('\n🎭 演示 6: 自定义测试场景')
    console.log('-'.repeat(40))

    // 添加自定义测试场景
    this.runner.framework.addScenario('custom_demo', {
      name: '自定义演示场景',
      endpoint: '/health',
      method: 'GET',
      headers: { 'X-Custom-Header': 'demo' },
      weight: 1.0
    })

    // 创建自定义测试套件
    this.runner.framework.registerTestSuite('custom_demo_suite', {
      name: '自定义演示套件',
      environment: 'unit'
    })

    // 添加测试用例
    this.runner.framework.addTest('custom_demo_suite', {
      name: '自定义健康检查测试',
      type: 'unit',
      execute: async () => {
        try {
          const axios = require('axios')
          const response = await axios.get('http://localhost:8080/health', {
            headers: { 'X-Custom-Header': 'demo' },
            timeout: 5000
          })

          return {
            success: response.status === 200,
            duration: 100,
            result: { status: response.status, data: response.data }
          }
        } catch (error) {
          return {
            success: false,
            duration: 100,
            error: error.message
          }
        }
      }
    })

    try {
      const results = await this.runner.framework.runTests({
        suites: ['custom_demo_suite'],
        parallel: false
      })

      console.log(`✅ 自定义测试场景完成`)
      console.log(`   测试结果: ${results[0].success ? '通过' : '失败'}`)

      if (!results[0].success) {
        console.log(`   错误信息: ${results[0].error}`)
      }

    } catch (error) {
      console.log(`⚠️  自定义场景演示失败: ${error.message}`)
    }
  }

  showUsageExamples() {
    console.log('\n💡 使用示例:')
    console.log('=' .repeat(60))
    console.log('')
    console.log('# 运行完整工业级测试')
    console.log('npm run test:industrial')
    console.log('')
    console.log('# 运行快速测试')
    console.log('npm run test:industrial:quick')
    console.log('')
    console.log('# 运行性能基准测试')
    console.log('npm run test:industrial:performance')
    console.log('')
    console.log('# 运行负载测试 (50 RPS, 60秒)')
    console.log('npm run test:industrial:load')
    console.log('')
    console.log('# 使用命令行工具')
    console.log('node run-industrial-tests.js comprehensive --format html')
    console.log('')
    console.log('# 使用Shell脚本 (CI/CD)')
    console.log('./scripts/industrial-testing.sh --test-type comprehensive --coverage')
    console.log('')
    console.log('# 查看测试报告')
    console.log('open ai-gateway/reports/html/test-report-*.html')
    console.log('')
  }

  async showSystemInfo() {
    console.log('\n🖥️  系统信息:')
    console.log('-'.repeat(40))

    const os = require('os')
    const process = require('process')

    console.log(`操作系统: ${os.type()} ${os.release()}`)
    console.log(`架构: ${os.arch()}`)
    console.log(`CPU核心数: ${os.cpus().length}`)
    console.log(`总内存: ${Math.round(os.totalmem() / 1024 / 1024)} MB`)
    console.log(`可用内存: ${Math.round(os.freemem() / 1024 / 1024)} MB`)
    console.log(`Node.js版本: ${process.version}`)
    console.log(`进程内存使用: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`)
  }
}

// 主函数
async function main() {
  const demo = new IndustrialTestingDemo()

  try {
    await demo.initialize()
    await demo.showSystemInfo()
    await demo.runDemo()
    demo.showUsageExamples()

    console.log('\n🎯 提示:')
    console.log('- 运行完整测试前，请确保网关服务正在运行 (npm start)')
    console.log('- 第一次运行可能需要下载浏览器和依赖项')
    console.log('- 测试报告保存在 ai-gateway/reports/ 目录中')
    console.log('- 如需自定义测试，请编辑 test-config.json 文件')

  } catch (error) {
    console.error('演示失败:', error.message)
    console.log('\n🔧 故障排除:')
    console.log('1. 确保Node.js版本 >= 18')
    console.log('2. 运行 npm ci 安装依赖')
    console.log('3. 检查端口8080是否被占用')
    console.log('4. 查看详细日志: DEBUG=* npm run test:industrial:quick')
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { IndustrialTestingDemo }
