const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');

/**
 * 自定义规则引擎 - 借鉴Drools和Node Rules的设计理念
 * 支持灵活的条件匹配、规则优先级、上下文感知的路由决策
 */
class RulesEngine {
  constructor(options = {}) {
    this.configPath = options.configPath || path.join(__dirname, '../config/rules.json');
    this.rules = new Map(); // ruleId -> rule配置
    this.ruleSets = new Map(); // ruleSetId -> ruleSet配置
    this.executionHistory = new Map(); // ruleId -> 执行历史
    this.initialized = false;

    // 规则执行统计
    this.stats = {
      totalExecutions: 0,
      successfulMatches: 0,
      failedMatches: 0,
      averageExecutionTime: 0,
      lastExecutionTime: null,
    };
  }

  /**
   * 初始化规则引擎
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 加载规则配置
      await this.loadRuleConfigurations();
      // 编译规则表达式
      this.compileRules();

      this.initialized = true;
      console.log(
        `✅ 规则引擎已初始化，加载了 ${this.rules.size} 个规则和 ${this.ruleSets.size} 个规则集`
      );
    } catch (error) {
      console.error('❌ 规则引擎初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 创建规则
   */
  async createRule(ruleConfig) {
    const ruleId = ruleConfig.id || this.generateRuleId();

    if (this.rules.has(ruleId)) {
      throw new Error(`规则 ${ruleId} 已存在`);
    }

    const rule = {
      id: ruleId,
      name: ruleConfig.name,
      description: ruleConfig.description,
      priority: ruleConfig.priority || 0, // 优先级，数字越大优先级越高
      conditions: ruleConfig.conditions || [], // 条件列表
      actions: ruleConfig.actions || [], // 动作列表
      context: ruleConfig.context || {}, // 规则上下文
      enabled: ruleConfig.enabled !== false, // 是否启用
      tags: ruleConfig.tags || [], // 标签，用于分类和搜索
      metadata: ruleConfig.metadata || {}, // 元数据
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0,
      lastExecutedAt: null,
      successCount: 0,
      failureCount: 0,
    };

    // 验证规则配置
    this.validateRuleConfig(rule);

    // 编译条件表达式
    rule.compiledConditions = this.compileConditions(rule.conditions);

    this.rules.set(ruleId, rule);
    await this.saveRuleConfigurations();

    console.log(`✅ 创建规则: ${ruleId} - ${rule.name}`);
    return rule;
  }

  /**
   * 创建规则集
   */
  async createRuleSet(ruleSetConfig) {
    const ruleSetId = ruleSetConfig.id || this.generateRuleSetId();

    if (this.ruleSets.has(ruleSetId)) {
      throw new Error(`规则集 ${ruleSetId} 已存在`);
    }

    const ruleSet = {
      id: ruleSetId,
      name: ruleSetConfig.name,
      description: ruleSetConfig.description,
      rules: ruleSetConfig.rules || [], // 规则ID列表
      executionMode: ruleSetConfig.executionMode || 'firstMatch', // firstMatch, allMatches, priority
      enabled: ruleSetConfig.enabled !== false,
      tags: ruleSetConfig.tags || [],
      metadata: ruleSetConfig.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0,
      lastExecutedAt: null,
    };

    // 验证规则集中的规则是否存在
    for (const ruleId of ruleSet.rules) {
      if (!this.rules.has(ruleId)) {
        throw new Error(`规则 ${ruleId} 不存在`);
      }
    }

    this.ruleSets.set(ruleSetId, ruleSet);
    await this.saveRuleConfigurations();

    console.log(`✅ 创建规则集: ${ruleSetId} - ${ruleSet.name}`);
    return ruleSet;
  }

  /**
   * 执行规则
   */
  async executeRules(context, options = {}) {
    const startTime = Date.now();
    const { ruleSetId } = options;
    const maxResults = options.maxResults || 10;
    const dryRun = options.dryRun || false;

    this.stats.totalExecutions++;

    let rulesToExecute = [];

    if (ruleSetId) {
      // 执行指定的规则集
      const ruleSet = this.ruleSets.get(ruleSetId);
      if (!ruleSet || !ruleSet.enabled) {
        return { matched: false, results: [], executionTime: Date.now() - startTime };
      }

      // 根据规则集的执行模式获取规则
      rulesToExecute = this.getRulesFromRuleSet(ruleSet);
    } else {
      // 执行所有启用的规则
      rulesToExecute = Array.from(this.rules.values())
        .filter(rule => rule.enabled)
        .sort((a, b) => b.priority - a.priority); // 按优先级降序排序
    }

    const results = [];
    const executionLog = [];

    for (const rule of rulesToExecute) {
      if (results.length >= maxResults) break;

      try {
        const ruleStartTime = Date.now();
        const matchResult = await this.evaluateRule(rule, context);

        rule.executionCount++;
        rule.lastExecutedAt = new Date().toISOString();

        const ruleExecutionTime = Date.now() - ruleStartTime;

        executionLog.push({
          ruleId: rule.id,
          ruleName: rule.name,
          matched: matchResult.matched,
          executionTime: ruleExecutionTime,
          conditions: matchResult.conditions,
          error: matchResult.error,
        });

        if (matchResult.matched) {
          rule.successCount++;
          this.stats.successfulMatches++;

          // 执行规则动作
          let actionResults = [];
          if (!dryRun) {
            actionResults = await this.executeRuleActions(rule, context, matchResult);
          }

          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            priority: rule.priority,
            actions: actionResults,
            metadata: matchResult.metadata,
            executionTime: ruleExecutionTime,
          });

          // 根据执行模式决定是否继续
          if (ruleSetId) {
            const ruleSet = this.ruleSets.get(ruleSetId);
            if (ruleSet.executionMode === 'firstMatch') {
              break;
            }
          }
        } else {
          rule.failureCount++;
        }
      } catch (error) {
        rule.failureCount++;
        this.stats.failedMatches++;

        executionLog.push({
          ruleId: rule.id,
          ruleName: rule.name,
          matched: false,
          error: error.message,
          executionTime: Date.now() - startTime,
        });

        console.warn(`规则执行失败: ${rule.id} - ${error.message}`);
      }
    }

    const totalExecutionTime = Date.now() - startTime;
    this.stats.averageExecutionTime = (this.stats.averageExecutionTime + totalExecutionTime) / 2;
    this.stats.lastExecutionTime = new Date().toISOString();

    // 保存统计信息
    await this.saveRuleConfigurations();

    return {
      matched: results.length > 0,
      results,
      executionTime: totalExecutionTime,
      executionLog: options.includeLog ? executionLog : undefined,
      stats: this.stats,
    };
  }

  /**
   * 更新规则
   */
  async updateRule(ruleId, updates) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`规则 ${ruleId} 不存在`);
    }

    // 不允许更新关键字段
    const restrictedFields = ['id', 'createdAt', 'executionCount', 'successCount', 'failureCount'];
    restrictedFields.forEach(field => {
      if (updates.hasOwnProperty(field)) {
        delete updates[field];
      }
    });

    Object.assign(rule, updates, {
      updatedAt: new Date().toISOString(),
    });

    // 如果条件更新了，重新编译
    if (updates.conditions) {
      rule.compiledConditions = this.compileConditions(rule.conditions);
    }

    // 重新验证配置
    this.validateRuleConfig(rule);

    await this.saveRuleConfigurations();
    console.log(`✅ 更新规则: ${ruleId}`);
    return rule;
  }

  /**
   * 删除规则
   */
  async deleteRule(ruleId) {
    if (!this.rules.has(ruleId)) {
      throw new Error(`规则 ${ruleId} 不存在`);
    }

    // 检查是否有规则集引用此规则
    for (const [ruleSetId, ruleSet] of this.ruleSets) {
      if (ruleSet.rules.includes(ruleId)) {
        throw new Error(`规则 ${ruleId} 被规则集 ${ruleSetId} 引用，无法删除`);
      }
    }

    this.rules.delete(ruleId);
    this.executionHistory.delete(ruleId);

    await this.saveRuleConfigurations();
    console.log(`🗑️ 删除规则: ${ruleId}`);
  }

  /**
   * 删除规则集
   */
  async deleteRuleSet(ruleSetId) {
    if (!this.ruleSets.has(ruleSetId)) {
      throw new Error(`规则集 ${ruleSetId} 不存在`);
    }

    this.ruleSets.delete(ruleSetId);
    await this.saveRuleConfigurations();
    console.log(`🗑️ 删除规则集: ${ruleSetId}`);
  }

  /**
   * 获取规则统计信息
   */
  getRuleStats(ruleId = null) {
    if (ruleId) {
      const rule = this.rules.get(ruleId);
      if (!rule) return null;

      const history = this.executionHistory.get(ruleId) || [];

      return {
        ruleId,
        name: rule.name,
        enabled: rule.enabled,
        priority: rule.priority,
        totalExecutions: rule.executionCount,
        successCount: rule.successCount,
        failureCount: rule.failureCount,
        successRate:
          rule.executionCount > 0
            ? ((rule.successCount / rule.executionCount) * 100).toFixed(2)
            : 0,
        lastExecutedAt: rule.lastExecutedAt,
        recentExecutions: history.slice(-10).reverse(),
      };
    }

    // 返回所有规则的统计
    const allStats = [];
    for (const [id, rule] of this.rules) {
      const history = this.executionHistory.get(id) || [];
      allStats.push({
        ruleId: id,
        name: rule.name,
        enabled: rule.enabled,
        priority: rule.priority,
        totalExecutions: rule.executionCount,
        successCount: rule.successCount,
        failureCount: rule.failureCount,
        successRate:
          rule.executionCount > 0
            ? ((rule.successCount / rule.executionCount) * 100).toFixed(2)
            : 0,
        lastExecutedAt: rule.lastExecutedAt,
      });
    }

    return allStats;
  }

  /**
   * 测试规则条件
   */
  async testRuleCondition(ruleId, context) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`规则 ${ruleId} 不存在`);
    }

    const result = await this.evaluateRule(rule, context);
    return {
      ruleId,
      ruleName: rule.name,
      matched: result.matched,
      conditions: result.conditions,
      metadata: result.metadata,
      error: result.error,
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 生成规则ID
   */
  generateRuleId() {
    return `rule_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 生成规则集ID
   */
  generateRuleSetId() {
    return `ruleset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 验证规则配置
   */
  validateRuleConfig(rule) {
    if (!rule.name) throw new Error('规则名称不能为空');
    if (!Array.isArray(rule.conditions)) throw new Error('conditions必须是数组');
    if (!Array.isArray(rule.actions)) throw new Error('actions必须是数组');

    if (rule.conditions.length === 0) {
      throw new Error('至少需要一个条件');
    }

    if (rule.actions.length === 0) {
      throw new Error('至少需要一个动作');
    }

    // 验证条件格式
    for (const condition of rule.conditions) {
      if (!condition.type || !condition.field) {
        throw new Error('条件必须包含type和field字段');
      }
    }

    // 验证动作格式
    for (const action of rule.actions) {
      if (!action.type) {
        throw new Error('动作必须包含type字段');
      }
    }
  }

  /**
   * 编译条件表达式
   */
  compileConditions(conditions) {
    return conditions.map(condition => {
      try {
        return this.compileCondition(condition);
      } catch (error) {
        throw new Error(`编译条件失败: ${error.message}`);
      }
    });
  }

  /**
   * 编译单个条件
   */
  compileCondition(condition) {
    const { type, field, operator, value, options = {} } = condition;

    switch (type) {
      case 'field':
        return this.compileFieldCondition(field, operator, value, options);
      case 'expression':
        return this.compileExpressionCondition(field, options);
      case 'script':
        return this.compileScriptCondition(field, options);
      default:
        throw new Error(`不支持的条件类型: ${type}`);
    }
  }

  /**
   * 编译字段条件
   */
  compileFieldCondition(field, operator, value, options) {
    return context => {
      const fieldValue = this.getFieldValue(context, field);
      return this.evaluateOperator(fieldValue, operator, value, options);
    };
  }

  /**
   * 编译表达式条件
   */
  compileExpressionCondition(expression, options) {
    // 简化的表达式解析器，支持基本的比较和逻辑运算
    return context => {
      try {
        // 这里可以实现更复杂的表达式解析
        // 目前只支持简单的字段比较
        return this.evaluateSimpleExpression(expression, context);
      } catch (error) {
        console.warn(`表达式评估失败: ${error.message}`);
        return false;
      }
    };
  }

  /**
   * 编译脚本条件
   */
  compileScriptCondition(script, options) {
    return context => {
      try {
        // 创建安全的执行环境
        const sandbox = {
          context,
          result: false,
          ...options.globals,
        };

        // 执行脚本 (使用vm沙箱环境，提高安全性)
        const context = vm.createContext({
          ...sandbox,
          console,
          require: () => {
            throw new Error('require() not allowed in sandbox');
          },
        });

        try {
          const result = vm.runInContext(script, context);
          return result;
        } catch (error) {
          throw new Error(`脚本执行错误: ${error.message}`);
        }
      } catch (error) {
        console.warn(`脚本执行失败: ${error.message}`);
        return false;
      }
    };
  }

  /**
   * 评估规则
   */
  async evaluateRule(rule, context) {
    const result = {
      matched: false,
      conditions: [],
      metadata: {},
      error: null,
    };

    try {
      // 检查所有条件
      for (const compiledCondition of rule.compiledConditions) {
        const conditionResult = compiledCondition(context);
        result.conditions.push(conditionResult);

        if (!conditionResult) {
          return result; // 任一条件不满足，规则就不匹配
        }
      }

      result.matched = true;
      result.metadata = this.extractRuleMetadata(rule, context);
    } catch (error) {
      result.error = error.message;
      console.warn(`规则评估失败: ${rule.id} - ${error.message}`);
    }

    return result;
  }

  /**
   * 执行规则动作
   */
  async executeRuleActions(rule, context, matchResult) {
    const results = [];

    for (const action of rule.actions) {
      try {
        const actionResult = await this.executeAction(action, context, matchResult);
        results.push({
          type: action.type,
          success: true,
          result: actionResult,
          metadata: action.metadata,
        });
      } catch (error) {
        results.push({
          type: action.type,
          success: false,
          error: error.message,
          metadata: action.metadata,
        });
        console.warn(`规则动作执行失败: ${action.type} - ${error.message}`);
      }
    }

    return results;
  }

  /**
   * 执行单个动作
   */
  async executeAction(action, context, matchResult) {
    const { type, params = {} } = action;

    switch (type) {
      case 'setField':
        return this.executeSetFieldAction(params, context);
      case 'transform':
        return this.executeTransformAction(params, context);
      case 'log':
        return this.executeLogAction(params, context, matchResult);
      case 'webhook':
        return this.executeWebhookAction(params, context, matchResult);
      case 'modifyRequest':
        return this.executeModifyRequestAction(params, context);
      case 'custom':
        return this.executeCustomAction(params, context, matchResult);
      default:
        throw new Error(`不支持的动作类型: ${type}`);
    }
  }

  /**
   * 获取字段值
   */
  getFieldValue(context, fieldPath) {
    const parts = fieldPath.split('.');
    let value = context;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 评估操作符
   */
  evaluateOperator(fieldValue, operator, expectedValue, options) {
    switch (operator) {
      case 'equals':
      case 'eq':
        return fieldValue === expectedValue;
      case 'notEquals':
      case 'ne':
        return fieldValue !== expectedValue;
      case 'greaterThan':
      case 'gt':
        return fieldValue > expectedValue;
      case 'greaterThanOrEqual':
      case 'gte':
        return fieldValue >= expectedValue;
      case 'lessThan':
      case 'lt':
        return fieldValue < expectedValue;
      case 'lessThanOrEqual':
      case 'lte':
        return fieldValue <= expectedValue;
      case 'contains':
        return Array.isArray(fieldValue)
          ? fieldValue.includes(expectedValue)
          : typeof fieldValue === 'string'
            ? fieldValue.includes(expectedValue)
            : false;
      case 'notContains':
        return Array.isArray(fieldValue)
          ? !fieldValue.includes(expectedValue)
          : typeof fieldValue === 'string'
            ? !fieldValue.includes(expectedValue)
            : true;
      case 'startsWith':
        return typeof fieldValue === 'string' && fieldValue.startsWith(expectedValue);
      case 'endsWith':
        return typeof fieldValue === 'string' && fieldValue.endsWith(expectedValue);
      case 'matches':
        return new RegExp(expectedValue).test(fieldValue);
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'notIn':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'notExists':
        return fieldValue === undefined || fieldValue === null;
      default:
        throw new Error(`不支持的操作符: ${operator}`);
    }
  }

  /**
   * 评估简单表达式
   */
  evaluateSimpleExpression(expression, context) {
    // 简化的表达式解析，实际应用中可以使用更强大的表达式引擎
    // 支持形如: user.tier == 'premium' && request.model == 'gpt-4'
    const sanitizedExpression = expression.replace(/(\w+)/g, match => {
      if (['&&', '||', '==', '!=', '>', '<', '>=', '<=', '(', ')'].includes(match)) {
        return match;
      }
      return `context.${match}`;
    });

    try {
      // 使用vm运行表达式，提高安全性
      const context = vm.createContext({
        ...context,
        console,
        require: () => {
          throw new Error('require() not allowed in expression');
        },
      });

      return vm.runInContext(`(${sanitizedExpression})`, context);
    } catch (error) {
      throw new Error(`表达式语法错误: ${error.message}`);
    }
  }

  /**
   * 获取规则集中的规则
   */
  getRulesFromRuleSet(ruleSet) {
    const rules = ruleSet.rules
      .map(ruleId => this.rules.get(ruleId))
      .filter(rule => rule && rule.enabled);

    // 根据执行模式排序
    if (ruleSet.executionMode === 'priority') {
      rules.sort((a, b) => b.priority - a.priority);
    }

    return rules;
  }

  /**
   * 提取规则元数据
   */
  extractRuleMetadata(rule, context) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      tags: rule.tags,
      matchedAt: new Date().toISOString(),
      contextFingerprint: this.generateContextFingerprint(context),
    };
  }

  /**
   * 生成上下文指纹
   */
  generateContextFingerprint(context) {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(context));
    return hash.digest('hex').substring(0, 8);
  }

  /**
   * 编译所有规则
   */
  compileRules() {
    for (const [ruleId, rule] of this.rules) {
      try {
        rule.compiledConditions = this.compileConditions(rule.conditions);
      } catch (error) {
        console.warn(`编译规则失败: ${ruleId} - ${error.message}`);
        rule.compiledConditions = [];
        rule.enabled = false;
      }
    }
  }

  // ==================== 动作执行方法 ====================

  executeSetFieldAction(params, context) {
    const { field, value } = params;
    this.setFieldValue(context, field, value);
    return { field, value };
  }

  executeTransformAction(params, context) {
    const { field, transform } = params;
    const originalValue = this.getFieldValue(context, field);
    const transformedValue = this.applyTransform(originalValue, transform);
    this.setFieldValue(context, field, transformedValue);
    return { field, originalValue, transformedValue };
  }

  executeLogAction(params, context, matchResult) {
    const { level = 'info', message, includeContext = false } = params;
    const logData = {
      message,
      ruleId: matchResult.metadata.ruleId,
      ...(includeContext && { context }),
    };

    console.log(`[${level.toUpperCase()}] ${message}`, logData);
    return { level, message, logged: true };
  }

  async executeWebhookAction(params, context, matchResult) {
    const { url, method = 'POST', headers = {}, body } = params;

    // 触发webhook事件
    if (global.webhookManager) {
      await global.webhookManager.triggerEvent(
        'rule.executed',
        {
          ruleId: matchResult.metadata.ruleId,
          ruleName: matchResult.metadata.ruleName,
          context,
          result: matchResult,
        },
        {
          source: 'rules-engine',
        }
      );
    }

    return { webhookTriggered: true, url, method };
  }

  executeModifyRequestAction(params, context) {
    const { modifications } = params;

    for (const mod of modifications) {
      if (mod.type === 'set') {
        this.setFieldValue(context, mod.field, mod.value);
      } else if (mod.type === 'transform') {
        const originalValue = this.getFieldValue(context, mod.field);
        const transformedValue = this.applyTransform(originalValue, mod.transform);
        this.setFieldValue(context, mod.field, transformedValue);
      }
    }

    return { modifications: modifications.length };
  }

  async executeCustomAction(params, context, matchResult) {
    const { function: func, args = [] } = params;

    if (typeof func === 'function') {
      return await func(context, matchResult, ...args);
    }

    throw new Error('自定义动作函数无效');
  }

  // ==================== 工具方法 ====================

  setFieldValue(obj, fieldPath, value) {
    const parts = fieldPath.split('.');
    const lastPart = parts.pop();
    let current = obj;

    for (const part of parts) {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    current[lastPart] = value;
  }

  applyTransform(value, transform) {
    const { type, params = {} } = transform;

    switch (type) {
      case 'toLowerCase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'toUpperCase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'substring':
        return typeof value === 'string' ? value.substring(params.start || 0, params.end) : value;
      case 'replace':
        return typeof value === 'string'
          ? value.replace(new RegExp(params.pattern, 'g'), params.replacement || '')
          : value;
      case 'multiply':
        return typeof value === 'number' ? value * (params.factor || 1) : value;
      case 'add':
        return typeof value === 'number' ? value + (params.value || 0) : value;
      default:
        return value;
    }
  }

  // ==================== 配置管理 ====================

  async loadRuleConfigurations() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(data);

      if (config.rules) {
        for (const [ruleId, rule] of Object.entries(config.rules)) {
          this.rules.set(ruleId, rule);
        }
      }

      if (config.ruleSets) {
        for (const [ruleSetId, ruleSet] of Object.entries(config.ruleSets)) {
          this.ruleSets.set(ruleSetId, ruleSet);
        }
      }

      if (config.stats) {
        this.stats = { ...this.stats, ...config.stats };
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('加载规则配置失败:', error.message);
      }
    }
  }

  async saveRuleConfigurations() {
    const config = {
      rules: Object.fromEntries(this.rules),
      ruleSets: Object.fromEntries(this.ruleSets),
      stats: this.stats,
    };

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }
}

module.exports = { RulesEngine };
