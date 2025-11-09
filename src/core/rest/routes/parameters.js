const express = require("express");
const { parameterManager } = require("../../parameter-manager");

/**
 * Parameters API Routes
 * 提供参数管理和查询相关的API接口
 */

module.exports = ({ logger }) => {
  const router = express.Router();
  /**
   * GET /parameters
   * 获取所有参数信息
   */
  router.get("/parameters", async (req, res) => {
    try {
      const { provider, model, preset, detailed = false } = req.query;

      const result = {};

      if (preset) {
        // 获取特定预设
        result.preset = parameterManager.getParameterPreset(preset);
      } else if (provider && model) {
        // 获取特定供应商和模型的参数映射
        result.mapping = parameterManager.parameterMappings.providers[provider];
        result.analysis = parameterManager.analyzeParameterUsage(
          {},
          provider,
          model,
        );
      } else {
        // 获取所有信息
        result.presets = parameterManager.getAllPresets();

        if (detailed === "true") {
          result.mappings = parameterManager.parameterMappings;
          result.validationRules = parameterManager.validationRules;
          result.optimizationRules = parameterManager.optimizationRules;
        }
      }

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取参数信息失败:", error);
      res.status(500).json({
        success: false,
        error: "获取参数信息失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /parameters/validate
   * 验证参数配置
   */
  router.post("/parameters/validate", async (req, res) => {
    try {
      const { parameters, provider, model } = req.body;

      if (!parameters || typeof parameters !== "object") {
        return res.status(400).json({
          success: false,
          error: "参数格式不正确",
          message: "parameters必须是对象",
        });
      }

      // 验证参数
      const validation = parameterManager.validateParameters(parameters);

      // 分析参数使用情况
      let analysis = {};
      if (provider) {
        analysis = parameterManager.analyzeParameterUsage(
          parameters,
          provider,
          model,
        );
      }

      res.json({
        success: true,
        data: {
          validation,
          analysis,
          parameters,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("参数验证失败:", error);
      res.status(500).json({
        success: false,
        error: "参数验证失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /parameters/optimize
   * 优化参数配置
   */
  router.post("/parameters/optimize", async (req, res) => {
    try {
      const { parameters, taskType, model, provider } = req.body;

      if (!parameters || typeof parameters !== "object") {
        return res.status(400).json({
          success: false,
          error: "参数格式不正确",
          message: "parameters必须是对象",
        });
      }

      // 优化参数
      const optimized = parameterManager.optimizeParameters(
        parameters,
        taskType,
        model,
      );

      // 验证优化后的参数
      const validation = parameterManager.validateParameters(optimized);

      // 如果指定了供应商，转换参数格式
      let transformed = null;
      if (provider) {
        try {
          transformed = parameterManager.transformParameters(
            optimized,
            provider,
            model,
          );
        } catch (error) {
          // 转换失败不影响优化结果
          logger.warn("参数转换失败:", error.message);
        }
      }

      res.json({
        success: true,
        data: {
          original: parameters,
          optimized,
          transformed,
          validation,
          improvements: getOptimizationImprovements(parameters, optimized),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("参数优化失败:", error);
      res.status(500).json({
        success: false,
        error: "参数优化失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /parameters/transform
   * 转换参数为供应商特定格式
   */
  router.post("/parameters/transform", async (req, res) => {
    try {
      const { parameters, provider, model } = req.body;

      if (!parameters || typeof parameters !== "object") {
        return res.status(400).json({
          success: false,
          error: "参数格式不正确",
          message: "parameters必须是对象",
        });
      }

      if (!provider) {
        return res.status(400).json({
          success: false,
          error: "缺少必要参数",
          message: "provider参数是必需的",
        });
      }

      // 转换参数
      const transformed = parameterManager.transformParameters(
        parameters,
        provider,
        model,
      );

      // 分析转换结果
      const analysis = parameterManager.analyzeParameterUsage(
        parameters,
        provider,
        model,
      );

      res.json({
        success: true,
        data: {
          original: parameters,
          transformed,
          provider,
          model,
          analysis,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("参数转换失败:", error);
      res.status(500).json({
        success: false,
        error: "参数转换失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /parameters/presets
   * 获取所有参数预设
   */
  router.get("/parameters/presets", async (_req, res) => {
    try {
      const presets = parameterManager.getAllPresets();

      res.json({
        success: true,
        data: {
          presets,
          count: Object.keys(presets).length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取参数预设失败:", error);
      res.status(500).json({
        success: false,
        error: "获取参数预设失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /parameters/presets/:name
   * 获取特定参数预设
   */
  router.get("/parameters/presets/:name", async (req, res) => {
    try {
      const { name } = req.params;
      const preset = parameterManager.getParameterPreset(name);

      if (!preset) {
        return res.status(404).json({
          success: false,
          error: "预设不存在",
          message: `参数预设 '${name}' 不存在`,
        });
      }

      res.json({
        success: true,
        data: {
          name,
          preset,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取参数预设失败:", error);
      res.status(500).json({
        success: false,
        error: "获取参数预设失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /parameters/rules
   * 获取参数验证规则
   */
  router.get("/parameters/rules", async (req, res) => {
    try {
      const { parameter } = req.query;

      let rules;
      if (parameter) {
        rules = parameterManager.getParameterRange(parameter);
        if (!rules) {
          return res.status(404).json({
            success: false,
            error: "参数不存在",
            message: `参数 '${parameter}' 的规则不存在`,
          });
        }
        rules.description = parameterManager.getParameterDescription(parameter);
      } else {
        rules = parameterManager.validationRules;
      }

      res.json({
        success: true,
        data: rules,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取参数规则失败:", error);
      res.status(500).json({
        success: false,
        error: "获取参数规则失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /parameters/mappings
   * 获取参数映射配置
   */
  router.get("/parameters/mappings", async (req, res) => {
    try {
      const { provider } = req.query;

      let mappings;
      if (provider) {
        mappings = parameterManager.parameterMappings.providers[provider];
        if (!mappings) {
          return res.status(404).json({
            success: false,
            error: "供应商不存在",
            message: `供应商 '${provider}' 的映射不存在`,
          });
        }
      } else {
        mappings = parameterManager.parameterMappings;
      }

      res.json({
        success: true,
        data: mappings,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取参数映射失败:", error);
      res.status(500).json({
        success: false,
        error: "获取参数映射失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /parameters/test
   * 测试参数配置（发送测试请求）
   */
  router.post("/parameters/test", async (req, res) => {
    try {
      const {
        parameters,
        provider,
        model,
        message = "Hello, this is a parameter test.",
        taskType,
      } = req.body;

      if (!provider || !model) {
        return res.status(400).json({
          success: false,
          error: "缺少必要参数",
          message: "provider和model参数是必需的",
        });
      }

      // 优化参数
      const optimizedParams = parameterManager.optimizeParameters(
        parameters || {},
        taskType,
        model,
      );

      // 验证参数
      const validation = parameterManager.validateParameters(optimizedParams);

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: "参数验证失败",
          data: { validation },
        });
      }

      // 这里可以实际发送测试请求
      // 为了演示，我们返回模拟结果
      const testResult = {
        parameters: optimizedParams,
        validation,
        mockResponse: {
          success: true,
          message: "Parameter test successful",
          model,
          provider,
          input: message,
          parameters_used: optimizedParams,
        },
      };

      res.json({
        success: true,
        data: testResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("参数测试失败:", error);
      res.status(500).json({
        success: false,
        error: "参数测试失败",
        message: error.message,
      });
    }
  });

  logger.info("Parameters API routes loaded");
  return router;
};

/**
 * 获取优化改进说明
 */
function getOptimizationImprovements(original, optimized) {
  const improvements = [];

  // 检查参数是否被优化
  for (const [key, value] of Object.entries(optimized)) {
    const originalValue = original[key];
    if (originalValue !== undefined && originalValue !== value) {
      improvements.push(`${key}: ${originalValue} → ${value}`);
    }
  }

  // 检查新增的参数
  for (const [key, value] of Object.entries(optimized)) {
    if (original[key] === undefined) {
      improvements.push(`新增 ${key}: ${value}`);
    }
  }

  return improvements;
}
