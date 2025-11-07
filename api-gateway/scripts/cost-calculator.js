#!/usr/bin/env node

/**
 * API Gateway Cost Calculator
 * 根据手册中的成本模型计算中转站的成本节省效果
 */

class CostCalculator {
  constructor() {
    // 默认参数配置
    this.defaultParams = {
      // 每月原始请求次数
      N_raw: 1000000,

      // 缓存命中率 (0-1)
      HR: 0.4,

      // 合并/批处理减少率 (0-1)
      BR: 0.6,

      // 中转站运行成本 (月, 元)
      O_cost: 800,

      // 模型单价 (元/次)
      C_unit: 0.02
    };

    // 不同场景的参数配置
    this.scenarios = {
      conservative: {
        N_raw: 100000,
        HR: 0.2,
        BR: 0.3,
        O_cost: 500,
        C_unit: 0.015
      },
      moderate: {
        N_raw: 500000,
        HR: 0.35,
        BR: 0.5,
        O_cost: 700,
        C_unit: 0.02
      },
      aggressive: {
        N_raw: 2000000,
        HR: 0.5,
        BR: 0.7,
        O_cost: 1200,
        C_unit: 0.025
      }
    };
  }

  /**
   * 计算成本节省
   * @param {Object} params - 计算参数
   * @returns {Object} - 计算结果
   */
  calculate(params = {}) {
    // 合并参数
    const config = { ...this.defaultParams, ...params };

    // 直接调用成本
    const Cost_direct = config.N_raw * config.C_unit;

    // 中转站后的有效外部调用次数
    const N_effective = config.N_raw * (1 - config.HR) * config.BR;

    // 厂商计费部分
    const Cost_vendor = N_effective * config.C_unit;

    // 总成本
    const Cost_total = Cost_vendor + config.O_cost;

    // 成本节省
    const SaveRate = 1 - (Cost_total / Cost_direct);
    const SaveAmount = Cost_direct - Cost_total;

    return {
      input: config,
      output: {
        Cost_direct: Math.round(Cost_direct * 100) / 100,
        N_effective: Math.round(N_effective),
        Cost_vendor: Math.round(Cost_vendor * 100) / 100,
        O_cost: config.O_cost,
        Cost_total: Math.round(Cost_total * 100) / 100,
        SaveAmount: Math.round(SaveAmount * 100) / 100,
        SaveRate: Math.round(SaveRate * 10000) / 100, // 百分比
        SaveRateDecimal: SaveRate
      }
    };
  }

  /**
   * 灵敏度分析
   * @param {Object} baseParams - 基准参数
   * @param {Object} variations - 参数变化
   * @returns {Array} - 分析结果
   */
  sensitivityAnalysis(baseParams = {}, variations = {}) {
    const base = this.calculate(baseParams);
    const results = [base];

    // 分析每个参数的变化
    Object.keys(variations).forEach(param => {
      const variation = variations[param];
      variation.forEach(value => {
        const newParams = { ...baseParams };
        newParams[param] = value;
        const result = this.calculate(newParams);
        result.variation = {
          param,
          value,
          change: value - baseParams[param],
          saveRateChange: result.output.SaveRate - base.output.SaveRate
        };
        results.push(result);
      });
    });

    return results;
  }

  /**
   * 打印计算结果
   * @param {Object} result - 计算结果
   */
  printResult(result) {
    console.log('\n=== API中转站成本测算结果 ===\n');

    console.log('输入参数:');
    console.log(`  每月请求次数: ${result.input.N_raw.toLocaleString()}`);
    console.log(`  缓存命中率: ${(result.input.HR * 100).toFixed(1)}%`);
    console.log(`  批处理减少率: ${(result.input.BR * 100).toFixed(1)}%`);
    console.log(`  单次请求成本: ¥${result.input.C_unit}`);
    console.log(`  中转站运行成本: ¥${result.input.O_cost}/月`);

    console.log('\n计算结果:');
    console.log(`  直接调用成本: ¥${result.output.Cost_direct.toLocaleString()}`);
    console.log(`  有效外部调用: ${result.output.N_effective.toLocaleString()} 次`);
    console.log(`  厂商API成本: ¥${result.output.Cost_vendor.toLocaleString()}`);
    console.log(`  中转站运行成本: ¥${result.output.O_cost}`);
    console.log(`  总成本: ¥${result.output.Cost_total.toLocaleString()}`);
    console.log(`  节省金额: ¥${result.output.SaveAmount.toLocaleString()}`);
    console.log(`  节省比例: ${result.output.SaveRate}%`);

    console.log('\n=== 投资回报分析 ===');
    const paybackMonths = result.input.O_cost > 0 ?
      Math.ceil(result.input.O_cost / result.output.SaveAmount) : 0;
    console.log(`  月均节省: ¥${result.output.SaveAmount}`);
    console.log(`  投资回收期: ${paybackMonths} 个月`);
    console.log(`  年化节省: ¥${(result.output.SaveAmount * 12).toLocaleString()}`);
  }

  /**
   * 运行预定义场景
   */
  runScenarios() {
    console.log('=== 不同使用场景的成本测算 ===\n');

    Object.keys(this.scenarios).forEach(scenario => {
      console.log(`\n--- ${scenario.toUpperCase()} 场景 ---`);
      const result = this.calculate(this.scenarios[scenario]);
      this.printResult(result);
    });
  }

  /**
   * 生成成本趋势图表数据
   * @param {Object} params - 参数
   * @param {number} months - 月份数
   * @returns {Array} - 图表数据
   */
  generateTrendData(params = {}, months = 12) {
    const data = [];
    const config = { ...this.defaultParams, ...params };

    for (let month = 1; month <= months; month++) {
      // 假设请求量每月增长5%
      const monthlyRequests = config.N_raw * Math.pow(1.05, month - 1);
      const monthlyParams = { ...config, N_raw: monthlyRequests };
      const result = this.calculate(monthlyParams);

      data.push({
        month,
        requests: Math.round(monthlyRequests),
        directCost: result.output.Cost_direct,
        totalCost: result.output.Cost_total,
        savings: result.output.SaveAmount,
        saveRate: result.output.SaveRate
      });
    }

    return data;
  }
}

// CLI 接口
function main() {
  const calculator = new CostCalculator();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // 默认运行场景分析
    calculator.runScenarios();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'scenario':
      if (args[1] && calculator.scenarios[args[1]]) {
        const result = calculator.calculate(calculator.scenarios[args[1]]);
        calculator.printResult(result);
      } else {
        console.log('可用场景:', Object.keys(calculator.scenarios).join(', '));
      }
      break;

    case 'custom':
      // 自定义参数计算
      const customParams = {};
      for (let i = 1; i < args.length; i += 2) {
        if (args[i + 1]) {
          const key = args[i].replace('--', '');
          const value = parseFloat(args[i + 1]);
          if (!isNaN(value)) {
            customParams[key] = value;
          }
        }
      }
      const result = calculator.calculate(customParams);
      calculator.printResult(result);
      break;

    case 'sensitivity':
      // 灵敏度分析
      const baseParams = args[1] ? calculator.scenarios[args[1]] : calculator.defaultParams;
      const variations = {
        HR: [0.2, 0.3, 0.4, 0.5, 0.6],
        BR: [0.3, 0.4, 0.5, 0.6, 0.7],
        C_unit: [0.01, 0.015, 0.02, 0.025, 0.03]
      };
      const sensitivityResults = calculator.sensitivityAnalysis(baseParams, variations);
      console.log('=== 灵敏度分析 ===');
      sensitivityResults.forEach(r => {
        if (r.variation) {
          console.log(`${r.variation.param}: ${r.variation.value} -> 节省率: ${r.output.SaveRate}% (变化: ${r.variation.saveRateChange > 0 ? '+' : ''}${r.variation.saveRateChange.toFixed(2)}%)`);
        }
      });
      break;

    case 'trend':
      // 生成趋势数据
      const months = parseInt(args[1]) || 12;
      const trendData = calculator.generateTrendData(calculator.defaultParams, months);
      console.log('=== 成本趋势预测 ===');
      console.log('月份,请求次数,直接成本,总成本,节省金额,节省率');
      trendData.forEach(row => {
        console.log(`${row.month},${row.requests},${row.directCost},${row.totalCost},${row.savings},${row.saveRate}%`);
      });
      break;

    default:
      console.log('使用方法:');
      console.log('  npm run cost:calc                    # 运行场景分析');
      console.log('  npm run cost:calc scenario moderate  # 指定场景');
      console.log('  npm run cost:calc custom --N_raw 500000 --HR 0.4  # 自定义参数');
      console.log('  npm run cost:calc sensitivity        # 灵敏度分析');
      console.log('  npm run cost:calc trend 12          # 趋势预测');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = CostCalculator;
