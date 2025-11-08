#!/usr/bin/env node

/**
 * Sira AI网关 - 工业级测试演示
 * 展示如何使用工业级测试框架进行各种类型的测试
 */

const { IndustrialTestRunner } = require('./run-industrial-tests')

class IndustrialTestingDemo {
  constructor () {
    this.runner = null
  }

  async initialize () {
    console.log('🎬 欢迎使用Sira AI网关工业级测试演示')
    console.log('='.repeat(60))

    this.runner = new IndustrialTestRunner()
    await this.runner.initialize()
  }

  async runDemo () {
    try {
      console.log('\n📋 演示内容:')
      console.log('1. 快速测试套件 (快速失败机制演示)')
      console.log('2. 测试报告生成功能演示')
      console.log('3. 快速失败机制详细说明')
      console.log('')

      // 1. 快速测试演示 (重点演示快速失败机制)
      await this.demoQuickTest()

      // 2. 综合报告演示
      await this.demoReportGeneration()

      // 3. 快速失败机制说明
      await this.explainFailFast()

      console.log('\n🎉 工业级测试演示完成!')
      console.log('✅ 快速失败机制已成功演示')
      console.log('查看 reports/ 目录中的详细报告')
    } catch (error) {
      console.error('演示过程中发生错误:', error.message)
      console.log('提示: 这是一个演示，某些功能需要完整的环境支持')
    }
  }

  async demoQuickTest () {
    console.log('\n🔬 演示 1: 快速测试套件')
    console.log('-'.repeat(40))

    const startTime = Date.now()

    try {
      const result = await this.runner.runQuickTest({
        format: 'json',
        failFast: true,
        failFastThreshold: 1
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

  async demoReportGeneration () {
    console.log('\n📋 演示 2: 测试报告生成')
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

      console.log('✅ 报告生成完成')
      console.log(`   HTML报告: ${report.reports.html.path}`)
      console.log(`   测试摘要: ${report.summary.totalTests} 测试, 成功率 ${report.summary.successRate}`)
    } catch (error) {
      console.log(`⚠️  报告生成演示失败: ${error.message}`)
      console.log('   提示: 这是一个演示，报告生成功能需要完整环境')
    }
  }

  async explainFailFast () {
    console.log('\n🚫 演示 3: 快速失败机制说明')
    console.log('-'.repeat(40))

    console.log('✅ 快速失败机制已实现并启用')
    console.log('')
    console.log('🔧 机制特性:')
    console.log('   • 连续失败阈值控制 (默认: 1次快速测试, 3次综合测试)')
    console.log('   • 支持串行和并行测试的快速失败')
    console.log('   • 实时监控和状态跟踪')
    console.log('   • 事件驱动的通知机制')
    console.log('   • 测试执行提前终止')
    console.log('')
    console.log('📊 配置选项:')
    console.log('   • failFast: 启用/禁用快速失败模式')
    console.log('   • failFastThreshold: 连续失败次数阈值')
    console.log('   • continueOnError: 是否在错误时继续')
    console.log('')
    console.log('💡 使用方式:')
    console.log('   • 演示脚本: 默认启用 (阈值: 1)')
    console.log('   • 命令行: --fail-fast --fail-fast-threshold 2')
    console.log('   • 环境变量: FAIL_FAST=true FAIL_FAST_THRESHOLD=3')
    console.log('')
    console.log('🎯 优势:')
    console.log('   • 快速发现问题，节省测试时间')
    console.log('   • 避免无效测试执行')
    console.log('   • 提高CI/CD效率')
    console.log('   • 及早发现系统性问题')
  }

  showUsageExamples () {
    console.log('\n💡 使用示例:')
    console.log('='.repeat(60))
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

  async showSystemInfo () {
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
async function main () {
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
