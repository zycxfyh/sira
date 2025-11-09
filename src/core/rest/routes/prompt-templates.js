const express = require("express");
const { promptTemplateManager } = require("../../prompt-template-manager");

/**
 * Prompt Templates API Routes
 * 提供提示词模板管理和使用的API接口
 */

module.exports = ({ logger }) => {
  const router = express.Router();
  /**
   * GET /prompt-templates
   * 获取所有提示词模板
   */
  router.get("/prompt-templates", async (req, res) => {
    try {
      const { category, tag, search } = req.query;

      let result;

      if (category) {
        // 获取指定分类的模板
        result = {
          category,
          templates: promptTemplateManager.getTemplatesByCategory(category),
        };
      } else if (tag) {
        // 根据标签搜索模板
        result = {
          tag,
          templates: promptTemplateManager.searchTemplatesByTag(tag),
        };
      } else if (search) {
        // 智能推荐模板
        result = {
          search,
          recommendations: promptTemplateManager.getRecommendedTemplates(
            search,
            10,
          ),
        };
      } else {
        // 获取所有模板
        result = {
          categories: promptTemplateManager.getCategories(),
          templates: promptTemplateManager.getAllTemplates(),
          stats: promptTemplateManager.getUsageStats(),
        };
      }

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取提示词模板失败:", error);
      res.status(500).json({
        success: false,
        error: "获取提示词模板失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /prompt-templates/categories
   * 获取所有模板分类
   */
  router.get("/prompt-templates/categories", async (_req, res) => {
    try {
      const categories = promptTemplateManager.getCategories();

      res.json({
        success: true,
        data: { categories },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取模板分类失败:", error);
      res.status(500).json({
        success: false,
        error: "获取模板分类失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /prompt-templates/categories/:category
   * 获取指定分类的模板
   */
  router.get("/prompt-templates/categories/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const templates = promptTemplateManager.getTemplatesByCategory(category);

      if (templates.length === 0) {
        return res.status(404).json({
          success: false,
          error: "分类不存在",
          message: `模板分类 '${category}' 不存在或为空`,
        });
      }

      res.json({
        success: true,
        data: {
          category,
          templates,
          count: templates.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取分类模板失败:", error);
      res.status(500).json({
        success: false,
        error: "获取分类模板失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /prompt-templates/:category/:templateId
   * 获取特定模板详情
   */
  router.get("/prompt-templates/:category/:templateId", async (req, res) => {
    try {
      const { category, templateId } = req.params;
      const template = promptTemplateManager.getTemplate(category, templateId);

      res.json({
        success: true,
        data: {
          category,
          templateId,
          template: {
            name: template.name,
            description: template.description,
            variables: template.variables,
            defaultValues: template.defaultValues,
            tags: template.tags,
            template: template.template,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取模板详情失败:", error);

      if (error.message.includes("不存在")) {
        return res.status(404).json({
          success: false,
          error: "模板不存在",
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: "获取模板详情失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /prompt-templates/render
   * 渲染提示词模板
   */
  router.post("/prompt-templates/render", async (req, res) => {
    try {
      const { category, templateId, variables } = req.body;

      if (!category || !templateId) {
        return res.status(400).json({
          success: false,
          error: "缺少必要参数",
          message: "category和templateId参数是必需的",
        });
      }

      // 渲染模板
      const result = promptTemplateManager.renderTemplate(
        category,
        templateId,
        variables || {},
      );

      res.json({
        success: true,
        data: {
          category,
          templateId,
          template: result.template,
          rendered: result.rendered,
          variables: result.variables,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("模板渲染失败:", error);

      if (error.message.includes("不存在")) {
        return res.status(404).json({
          success: false,
          error: "模板不存在",
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: "模板渲染失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /prompt-templates/validate
   * 验证模板变量
   */
  router.post("/prompt-templates/validate", async (req, res) => {
    try {
      const { category, templateId, variables } = req.body;

      if (!category || !templateId) {
        return res.status(400).json({
          success: false,
          error: "缺少必要参数",
          message: "category和templateId参数是必需的",
        });
      }

      // 验证模板变量
      const validation = promptTemplateManager.validateTemplateVariables(
        category,
        templateId,
        variables || {},
      );

      res.json({
        success: true,
        data: {
          category,
          templateId,
          validation,
          template: {
            name: validation.template.name,
            description: validation.template.description,
            variables: validation.template.variables,
            defaultValues: validation.template.defaultValues,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("模板验证失败:", error);

      if (error.message.includes("不存在")) {
        return res.status(404).json({
          success: false,
          error: "模板不存在",
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: "模板验证失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /prompt-templates/recommend
   * 获取推荐模板
   */
  router.post("/prompt-templates/recommend", async (req, res) => {
    try {
      const { taskDescription, limit = 5 } = req.body;

      if (!taskDescription) {
        return res.status(400).json({
          success: false,
          error: "缺少必要参数",
          message: "taskDescription参数是必需的",
        });
      }

      // 获取推荐模板
      const recommendations = promptTemplateManager.getRecommendedTemplates(
        taskDescription,
        limit,
      );

      res.json({
        success: true,
        data: {
          taskDescription,
          recommendations,
          count: recommendations.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取推荐模板失败:", error);
      res.status(500).json({
        success: false,
        error: "获取推荐模板失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /prompt-templates/custom
   * 添加自定义模板
   */
  router.post("/prompt-templates/custom", async (req, res) => {
    try {
      const { category, templateId, template } = req.body;

      if (!category || !templateId || !template) {
        return res.status(400).json({
          success: false,
          error: "缺少必要参数",
          message: "category、templateId和template参数都是必需的",
        });
      }

      // 添加自定义模板
      const _success = promptTemplateManager.addCustomTemplate(
        category,
        templateId,
        {
          ...template,
          tags: [...(template.tags || []), "自定义"],
        },
      );

      res.json({
        success: true,
        data: {
          category,
          templateId,
          message: "自定义模板添加成功",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("添加自定义模板失败:", error);
      res.status(500).json({
        success: false,
        error: "添加自定义模板失败",
        message: error.message,
      });
    }
  });

  /**
   * DELETE /prompt-templates/custom/:category/:templateId
   * 删除自定义模板
   */
  router.delete(
    "/prompt-templates/custom/:category/:templateId",
    async (req, res) => {
      try {
        const { category, templateId } = req.params;

        // 删除自定义模板
        const _success = promptTemplateManager.removeCustomTemplate(
          category,
          templateId,
        );

        res.json({
          success: true,
          data: {
            category,
            templateId,
            message: "自定义模板删除成功",
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("删除自定义模板失败:", error);

        if (error.message.includes("不存在")) {
          return res.status(404).json({
            success: false,
            error: "模板不存在",
            message: error.message,
          });
        }

        res.status(500).json({
          success: false,
          error: "删除自定义模板失败",
          message: error.message,
        });
      }
    },
  );

  /**
   * GET /prompt-templates/search
   * 搜索模板
   */
  router.get("/prompt-templates/search", async (req, res) => {
    try {
      const { q: query, tag, category, limit = 20 } = req.query;

      let results = [];

      if (query) {
        // 智能推荐搜索
        results = promptTemplateManager.getRecommendedTemplates(query, limit);
      } else if (tag) {
        // 标签搜索
        results = promptTemplateManager.searchTemplatesByTag(tag);
      } else if (category) {
        // 分类搜索
        results = promptTemplateManager.getTemplatesByCategory(category);
      } else {
        return res.status(400).json({
          success: false,
          error: "缺少搜索参数",
          message: "请提供搜索查询(q)、标签(tag)或分类(category)参数",
        });
      }

      res.json({
        success: true,
        data: {
          query: query || tag || category,
          results,
          count: results.length,
          limit: parseInt(limit, 10),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("搜索模板失败:", error);
      res.status(500).json({
        success: false,
        error: "搜索模板失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /prompt-templates/stats
   * 获取模板使用统计
   */
  router.get("/prompt-templates/stats", async (_req, res) => {
    try {
      const stats = promptTemplateManager.getUsageStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取模板统计失败:", error);
      res.status(500).json({
        success: false,
        error: "获取模板统计失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /prompt-templates/preview
   * 预览模板渲染结果
   */
  router.post("/prompt-templates/preview", async (req, res) => {
    try {
      const { category, templateId, variables, format = "full" } = req.body;

      if (!category || !templateId) {
        return res.status(400).json({
          success: false,
          error: "缺少必要参数",
          message: "category和templateId参数是必需的",
        });
      }

      // 渲染模板
      const result = promptTemplateManager.renderTemplate(
        category,
        templateId,
        variables || {},
      );

      // 根据格式返回不同内容
      let preview;
      switch (format) {
        case "content":
          preview = result.rendered;
          break;
        case "minimal":
          preview = {
            template: result.template.name,
            rendered_length: result.rendered.length,
            variables_used: Object.keys(result.variables).length,
          };
          break;
        default:
          preview = {
            template: {
              name: result.template.name,
              description: result.template.description,
            },
            variables: result.variables,
            rendered: result.rendered,
            rendered_length: result.rendered.length,
            rendered_lines: result.rendered.split("\n").length,
          };
          break;
      }

      res.json({
        success: true,
        data: {
          category,
          templateId,
          format,
          preview,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("模板预览失败:", error);

      if (error.message.includes("不存在")) {
        return res.status(404).json({
          success: false,
          error: "模板不存在",
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: "模板预览失败",
        message: error.message,
      });
    }
  });

  logger.info("Prompt Templates API routes loaded");
  return router;
};
