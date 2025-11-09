/**
 * Sira AI网关 - 模型参数管理模块
 * 统一管理和转换AI模型的微调参数
 */

const EventEmitter = require("node:events");

class ParameterManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableValidation: options.enableValidation !== false,
      enableOptimization: options.enableOptimization !== false,
      strictMode: options.strictMode || false,
      ...options,
    };

    // 参数映射配置
    this.parameterMappings = this.initializeParameterMappings();

    // 参数验证规则
    this.validationRules = this.initializeValidationRules();

    // 参数优化配置
    this.optimizationRules = this.initializeOptimizationRules();

    // 预设参数模板
    this.parameterPresets = this.initializeParameterPresets();

    this.emit("initialized");
    console.log("✅ 参数管理模块初始化完成");
  }

  /**
   * 初始化参数映射配置
   */
  initializeParameterMappings() {
    return {
      // 通用参数映射
      common: {
        temperature: "temperature",
        top_p: "top_p",
        top_k: "top_k",
        max_tokens: "max_tokens",
        frequency_penalty: "frequency_penalty",
        presence_penalty: "presence_penalty",
        stop: "stop",
        stream: "stream",
        seed: "seed",
      },

      // 供应商特定映射
      providers: {
        openai: {
          temperature: "temperature",
          top_p: "top_p",
          max_tokens: "max_tokens",
          frequency_penalty: "frequency_penalty",
          presence_penalty: "presence_penalty",
          stop: "stop",
          stream: "stream",
          seed: "seed",
          top_k: null, // 不支持
          min_p: null, // 不支持
        },
        anthropic: {
          temperature: "temperature",
          top_p: null, // 不支持top_p
          top_k: "top_k",
          max_tokens: "max_tokens_to_sample",
          frequency_penalty: null, // 不支持
          presence_penalty: null, // 不支持
          stop: "stop_sequences",
          stream: null, // 不同格式
          seed: null, // 不支持
          min_p: null, // 不支持
        },
        google_gemini: {
          temperature: "temperature",
          top_p: "topP",
          top_k: "topK",
          max_tokens: "maxOutputTokens",
          frequency_penalty: null, // 不支持
          presence_penalty: null, // 不支持
          stop: "stopSequences",
          stream: "stream",
          seed: null, // 不支持
          min_p: null, // 不支持
        },
        deepseek: {
          temperature: "temperature",
          top_p: "top_p",
          max_tokens: "max_tokens",
          frequency_penalty: "frequency_penalty",
          presence_penalty: "presence_penalty",
          stop: "stop",
          stream: "stream",
          seed: null, // 不支持
          top_k: null, // 不支持
          min_p: null, // 不支持
        },
        qwen: {
          temperature: "temperature",
          top_p: "top_p",
          max_tokens: "max_tokens",
          frequency_penalty: "repetition_penalty",
          presence_penalty: null, // 不支持
          stop: "stop",
          stream: "incremental_output",
          seed: null, // 不支持
          top_k: "top_k",
          min_p: null, // 不支持
        },
        ernie: {
          temperature: "temperature",
          top_p: "top_p",
          max_tokens: "max_output_tokens",
          frequency_penalty: "penalty_score",
          presence_penalty: null, // 不支持
          stop: "stop",
          stream: null, // 不同格式
          seed: null, // 不支持
          top_k: null, // 不支持
          min_p: null, // 不支持
        },
        glm: {
          temperature: "temperature",
          top_p: "top_p",
          max_tokens: "max_tokens",
          frequency_penalty: "repetition_penalty",
          presence_penalty: null, // 不支持
          stop: "stop",
          stream: null, // 不同格式
          seed: null, // 不支持
          top_k: null, // 不支持
          min_p: null, // 不支持
        },
        kimi: {
          temperature: "temperature",
          top_p: "top_p",
          max_tokens: "max_tokens",
          frequency_penalty: "frequency_penalty",
          presence_penalty: "presence_penalty",
          stop: "stop",
          stream: "stream",
          seed: null, // 不支持
          top_k: null, // 不支持
          min_p: null, // 不支持
        },
        doubao: {
          temperature: "temperature",
          top_p: "top_p",
          max_tokens: "max_tokens",
          frequency_penalty: "repetition_penalty",
          presence_penalty: null, // 不支持
          stop: "stop",
          stream: "stream",
          seed: null, // 不支持
          top_k: "top_k",
          min_p: null, // 不支持
        },
      },
    };
  }

  /**
   * 初始化参数验证规则
   */
  initializeValidationRules() {
    return {
      temperature: {
        min: 0,
        max: 2,
        default: 1.0,
        description: "控制输出的随机性，0-1之间降低随机性，1-2之间增加随机性",
      },
      top_p: {
        min: 0,
        max: 1,
        default: 1.0,
        description: "核采样参数，与temperature结合使用",
      },
      top_k: {
        min: 1,
        max: 1000,
        default: null,
        description: "从前K个最可能的token中采样",
      },
      min_p: {
        min: 0,
        max: 1,
        default: null,
        description: "最小概率阈值，过滤低概率token",
      },
      max_tokens: {
        min: 1,
        max: 32768,
        default: 4096,
        description: "最大输出token数量",
      },
      frequency_penalty: {
        min: -2.0,
        max: 2.0,
        default: 0,
        description: "减少重复token的惩罚系数",
      },
      presence_penalty: {
        min: -2.0,
        max: 2.0,
        default: 0,
        description: "减少已出现token的惩罚系数",
      },
      seed: {
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
        default: null,
        description: "随机种子，确保输出可重现",
      },
    };
  }

  /**
   * 初始化参数优化规则
   */
  initializeOptimizationRules() {
    return {
      // 任务类型优化建议
      taskOptimization: {
        creative_writing: {
          temperature: 0.8,
          top_p: 0.9,
          frequency_penalty: 0.3,
          presence_penalty: 0.1,
        },
        code_generation: {
          temperature: 0.2,
          top_p: 0.1,
          frequency_penalty: 0.5,
          max_tokens: 2048,
        },
        data_analysis: {
          temperature: 0.1,
          top_p: 0.1,
          frequency_penalty: 0.2,
          max_tokens: 4096,
        },
        chat_conversation: {
          temperature: 0.7,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
        },
        translation: {
          temperature: 0.3,
          top_p: 0.5,
          frequency_penalty: 0.2,
          max_tokens: 2048,
        },
        summarization: {
          temperature: 0.1,
          top_p: 0.2,
          frequency_penalty: 0.3,
          max_tokens: 1024,
        },
      },

      // 模型特定优化
      modelOptimization: {
        "gpt-4": {
          max_tokens: 8192,
          temperature: { optimal: [0.1, 0.9] },
        },
        "claude-3-opus": {
          max_tokens: 4096,
          temperature: { optimal: [0.1, 1.0] },
        },
        "deepseek-chat": {
          max_tokens: 4096,
          temperature: { optimal: [0.1, 0.9] },
        },
        "qwen-max": {
          max_tokens: 6144,
          temperature: { optimal: [0.1, 1.0] },
        },
      },
    };
  }

  /**
   * 初始化预设参数模板
   */
  initializeParameterPresets() {
    return {
      // 创作类任务
      creative: {
        name: "创意写作",
        description: "适合小说、故事、诗歌创作",
        parameters: {
          temperature: 0.9,
          top_p: 0.9,
          frequency_penalty: 0.3,
          presence_penalty: 0.1,
          max_tokens: 2048,
        },
      },

      // 编程类任务
      coding: {
        name: "代码生成",
        description: "适合编程、代码解释、调试",
        parameters: {
          temperature: 0.2,
          top_p: 0.1,
          frequency_penalty: 0.5,
          presence_penalty: 0.0,
          max_tokens: 2048,
        },
      },

      // 分析类任务
      analytical: {
        name: "数据分析",
        description: "适合逻辑推理、数据分析、科学研究",
        parameters: {
          temperature: 0.1,
          top_p: 0.1,
          frequency_penalty: 0.2,
          presence_penalty: 0.0,
          max_tokens: 4096,
        },
      },

      // 对话类任务
      conversational: {
        name: "日常对话",
        description: "适合聊天、客服、日常问答",
        parameters: {
          temperature: 0.7,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
          max_tokens: 1024,
        },
      },

      // 翻译类任务
      translation: {
        name: "文本翻译",
        description: "适合中英文翻译、专业翻译",
        parameters: {
          temperature: 0.3,
          top_p: 0.5,
          frequency_penalty: 0.2,
          presence_penalty: 0.0,
          max_tokens: 2048,
        },
      },

      // 总结类任务
      summarization: {
        name: "内容总结",
        description: "适合文章摘要、会议纪要",
        parameters: {
          temperature: 0.1,
          top_p: 0.2,
          frequency_penalty: 0.3,
          presence_penalty: 0.0,
          max_tokens: 1024,
        },
      },

      // 自定义模板
      custom: {
        name: "自定义参数",
        description: "用户自定义参数设置",
        parameters: {
          temperature: 1.0,
          top_p: 1.0,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
          max_tokens: 4096,
        },
      },
    };
  }

  /**
   * 验证参数
   */
  validateParameters(parameters) {
    const errors = [];
    const warnings = [];

    if (!parameters || typeof parameters !== "object") {
      errors.push("参数必须是对象类型");
      return { valid: false, errors, warnings };
    }

    // 逐个验证参数
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const rule = this.validationRules[paramName];

      if (!rule) {
        warnings.push(`未知参数: ${paramName}`);
        continue;
      }

      // 类型检查
      if (
        typeof paramValue !== "number" &&
        paramValue !== null &&
        paramValue !== undefined
      ) {
        errors.push(`${paramName} 必须是数字类型`);
        continue;
      }

      // 范围检查
      if (paramValue !== null && paramValue !== undefined) {
        if (rule.min !== undefined && paramValue < rule.min) {
          errors.push(`${paramName} 不能小于 ${rule.min}`);
        }
        if (rule.max !== undefined && paramValue > rule.max) {
          errors.push(`${paramName} 不能大于 ${rule.max}`);
        }
      }

      // 特殊检查
      if (
        paramName === "top_p" &&
        parameters.temperature &&
        parameters.temperature > 0.5 &&
        paramValue < 0.5
      ) {
        warnings.push("temperature较高时，建议top_p不要设置过低");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 转换参数到供应商格式
   */
  transformParameters(parameters, provider, model) {
    const providerMapping = this.parameterMappings.providers[provider];

    if (!providerMapping) {
      throw new Error(`不支持的供应商: ${provider}`);
    }

    const transformed = {};

    // 逐个转换参数
    for (const [commonParam, value] of Object.entries(parameters)) {
      const providerParam = providerMapping[commonParam];

      // 如果供应商不支持此参数，跳过
      if (providerParam === null) {
        continue;
      }

      // 如果参数名相同，直接使用
      if (providerParam === commonParam) {
        transformed[commonParam] = value;
      } else if (providerParam) {
        // 否则使用映射的参数名
        transformed[providerParam] = value;
      }
    }

    // 供应商特定转换
    this.applyProviderSpecificTransformations(transformed, provider, model);

    return transformed;
  }

  /**
   * 应用供应商特定的转换
   */
  applyProviderSpecificTransformations(parameters, provider, _model) {
    switch (provider) {
      case "anthropic":
        // Anthropic 使用不同的max_tokens参数名
        if (parameters.max_tokens_to_sample) {
          parameters.max_tokens = parameters.max_tokens_to_sample;
          delete parameters.max_tokens_to_sample;
        }
        // Anthropic 的stop参数是数组
        if (
          parameters.stop_sequences &&
          !Array.isArray(parameters.stop_sequences)
        ) {
          parameters.stop_sequences = [parameters.stop_sequences];
        }
        break;

      case "google_gemini":
        // Gemini 的stop参数是数组
        if (
          parameters.stopSequences &&
          !Array.isArray(parameters.stopSequences)
        ) {
          parameters.stopSequences = [parameters.stopSequences];
        }
        break;

      case "qwen":
        // Qwen 使用repetition_penalty替代frequency_penalty
        if (parameters.repetition_penalty !== undefined) {
          // 转换逻辑：frequency_penalty = 1 + repetition_penalty
          // 这里保持原值，具体转换由用户控制
        }
        break;

      case "ernie":
        // ERNIE 使用不同的参数名
        if (parameters.max_output_tokens) {
          parameters.max_tokens = parameters.max_output_tokens;
          delete parameters.max_output_tokens;
        }
        break;
    }
  }

  /**
   * 优化参数
   */
  optimizeParameters(parameters, taskType, model) {
    if (!this.options.enableOptimization) {
      return parameters;
    }

    const optimized = { ...parameters };

    // 任务类型优化
    if (taskType && this.optimizationRules.taskOptimization[taskType]) {
      const taskDefaults = this.optimizationRules.taskOptimization[taskType];
      for (const [param, defaultValue] of Object.entries(taskDefaults)) {
        if (optimized[param] === undefined || optimized[param] === null) {
          optimized[param] = defaultValue;
        }
      }
    }

    // 模型特定优化
    if (model && this.optimizationRules.modelOptimization[model]) {
      const modelRules = this.optimizationRules.modelOptimization[model];
      if (
        modelRules.max_tokens &&
        optimized.max_tokens > modelRules.max_tokens
      ) {
        optimized.max_tokens = modelRules.max_tokens;
      }
      if (modelRules.temperature?.optimal) {
        const temp = optimized.temperature;
        const [min, max] = modelRules.temperature.optimal;
        if (temp < min || temp > max) {
          optimized.temperature = Math.max(min, Math.min(max, temp));
        }
      }
    }

    // 智能参数调整
    this.applySmartAdjustments(optimized);

    return optimized;
  }

  /**
   * 应用智能参数调整
   */
  applySmartAdjustments(parameters) {
    // 如果同时设置了temperature和top_p，给出建议
    if (parameters.temperature > 0.8 && parameters.top_p < 0.5) {
      parameters.top_p = Math.max(parameters.top_p, 0.7);
    }

    // 避免参数冲突
    if (parameters.top_k && parameters.top_p) {
      // 如果同时设置了top_k和top_p，优先使用top_p
      delete parameters.top_k;
    }

    // 确保max_tokens合理
    if (parameters.max_tokens > 10000) {
      parameters.max_tokens = 10000; // 设置上限
    }
  }

  /**
   * 获取参数预设
   */
  getParameterPreset(presetName) {
    return this.parameterPresets[presetName] || this.parameterPresets.custom;
  }

  /**
   * 获取所有预设
   */
  getAllPresets() {
    return this.parameterPresets;
  }

  /**
   * 分析参数使用情况
   */
  analyzeParameterUsage(parameters, provider, model) {
    const analysis = {
      supported: [],
      unsupported: [],
      warnings: [],
      suggestions: [],
    };

    const providerMapping = this.parameterMappings.providers[provider];

    for (const param of Object.keys(parameters)) {
      if (providerMapping[param] !== null) {
        analysis.supported.push(param);
      } else {
        analysis.unsupported.push(param);
      }
    }

    // 生成建议
    if (analysis.unsupported.length > 0) {
      analysis.warnings.push(
        `${provider}不支持以下参数: ${analysis.unsupported.join(", ")}`,
      );
    }

    // 模型特定建议
    if (model && this.optimizationRules.modelOptimization[model]) {
      const modelRules = this.optimizationRules.modelOptimization[model];
      if (
        modelRules.max_tokens &&
        parameters.max_tokens > modelRules.max_tokens
      ) {
        analysis.suggestions.push(
          `建议将max_tokens降低到 ${modelRules.max_tokens} 以获得更好的性能`,
        );
      }
    }

    return analysis;
  }

  /**
   * 获取参数说明
   */
  getParameterDescription(paramName) {
    const rule = this.validationRules[paramName];
    return rule ? rule.description : `未知参数: ${paramName}`;
  }

  /**
   * 获取参数范围
   */
  getParameterRange(paramName) {
    const rule = this.validationRules[paramName];
    return rule
      ? { min: rule.min, max: rule.max, default: rule.default }
      : null;
  }

  /**
   * 导出参数配置
   */
  exportConfiguration() {
    return {
      mappings: this.parameterMappings,
      validationRules: this.validationRules,
      optimizationRules: this.optimizationRules,
      presets: this.parameterPresets,
      version: "1.0.0",
    };
  }

  /**
   * 导入参数配置
   */
  importConfiguration(config) {
    if (config.mappings) this.parameterMappings = config.mappings;
    if (config.validationRules) this.validationRules = config.validationRules;
    if (config.optimizationRules)
      this.optimizationRules = config.optimizationRules;
    if (config.presets) this.parameterPresets = config.presets;

    this.emit("configurationImported");
  }

  /**
   * 清理资源（用于测试）
   */
  cleanup() {
    // 清理事件监听器
    this.removeAllListeners();

    // 清理缓存
    this.cache.clear();
  }
}

// 创建全局实例
const parameterManager = new ParameterManager();

// 导出类和实例
module.exports = {
  ParameterManager,
  parameterManager,
};
