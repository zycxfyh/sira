const { MultilingualManager } = require("../multilingual-manager");

let multilingualManager = null;

/**
 * 本地化中间件
 * 自动检测用户语言偏好并本地化API响应
 * 借鉴Express i18n中间件和国际化框架的设计理念
 */
function localizationMiddleware(options = {}) {
  // 初始化多语言管理器（延迟初始化，避免循环依赖）
  if (!multilingualManager) {
    multilingualManager = new MultilingualManager(options);
    multilingualManager.initialize().catch(console.error);
  }

  return async (req, res, next) => {
    try {
      // 检测用户语言
      const languageDetection = multilingualManager.detectLanguage(req, {
        userId: req.headers["x-user-id"] || req.query.userId,
        ip: req.ip,
        sessionId: req.headers["x-session-id"],
      });

      // 将语言信息添加到请求对象
      req.language = languageDetection.language;
      req.languageConfidence = languageDetection.confidence;
      req.languageDetectionMethod = languageDetection.method;

      // 添加语言信息到响应头
      res.setHeader("X-Language", req.language);
      res.setHeader("X-Language-Confidence", req.languageConfidence);
      res.setHeader("X-Language-Detection-Method", req.languageDetectionMethod);

      // 保存原始的json方法
      const originalJson = res.json.bind(res);

      // 重写json方法以支持本地化
      res.json = async (data) => {
        try {
          // 检查是否需要本地化
          const shouldLocalize = shouldLocalizeResponse(req, res, data);

          if (shouldLocalize) {
            // 本地化响应数据
            const localizedData = await multilingualManager.localizeResponse(
              data,
              req.language,
              {
                userId: req.headers["x-user-id"],
                requestId: req.headers["x-request-id"],
                endpoint: req.path,
              },
            );

            // 添加本地化元数据
            if (options.includeMetadata !== false) {
              localizedData._localization = {
                language: req.language,
                confidence: req.languageConfidence,
                method: req.languageDetectionMethod,
                timestamp: new Date().toISOString(),
              };
            }

            return originalJson(localizedData);
          } else {
            return originalJson(data);
          }
        } catch (error) {
          console.error("响应本地化失败:", error);
          // 本地化失败时返回原始数据
          return originalJson(data);
        }
      };

      // 保存原始的send方法
      const originalSend = res.send.bind(res);

      // 重写send方法以支持本地化
      res.send = async (data) => {
        try {
          // 如果是JSON数据，尝试本地化
          if (typeof data === "object" && data !== null) {
            const shouldLocalize = shouldLocalizeResponse(req, res, data);

            if (shouldLocalize) {
              const localizedData = await multilingualManager.localizeResponse(
                data,
                req.language,
                {
                  userId: req.headers["x-user-id"],
                  requestId: req.headers["x-request-id"],
                  endpoint: req.path,
                },
              );

              return originalSend(JSON.stringify(localizedData));
            }
          }

          return originalSend(data);
        } catch (error) {
          console.error("响应本地化失败:", error);
          return originalSend(data);
        }
      };

      // 添加本地化助手方法到响应对象
      res.localize = async (text, fromLanguage = "en-US") => {
        return await multilingualManager.translate(
          text,
          fromLanguage,
          req.language,
        );
      };

      res.getLocalizedResource = async (key, namespace = "common") => {
        return await multilingualManager.getLocalizedResource(
          key,
          req.language,
          namespace,
        );
      };

      next();
    } catch (error) {
      console.error("本地化中间件错误:", error);
      // 中间件错误不应该阻塞请求处理
      next();
    }
  };
}

/**
 * 判断是否应该本地化响应
 */
function shouldLocalizeResponse(req, res, data) {
  // 检查是否为API响应
  if (!req.path.startsWith("/api") && !req.path.startsWith("/v1")) {
    return false;
  }

  // 检查是否为JSON响应
  const contentType = res.getHeader("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    return false;
  }

  // 检查是否为成功响应
  if (data && typeof data === "object" && data.success === false) {
    // 错误响应也需要本地化错误消息
    return true;
  }

  // 检查请求头是否明确要求本地化
  if (req.headers["x-localize"] === "true" || req.query.localize === "true") {
    return true;
  }

  // 检查请求头是否明确禁用本地化
  if (req.headers["x-localize"] === "false" || req.query.localize === "false") {
    return false;
  }

  // 检查用户语言是否不是默认语言
  if (req.language && req.language !== "en-US") {
    return true;
  }

  // 检查响应数据是否包含需要翻译的文本
  if (data && typeof data === "object") {
    return containsTranslatableText(data);
  }

  return false;
}

/**
 * 检查对象是否包含需要翻译的文本
 */
function containsTranslatableText(obj, depth = 0) {
  // 防止无限递归
  if (depth > 5) return false;

  for (const [key, value] of Object.entries(obj)) {
    // 跳过不需要翻译的字段
    if (
      [
        "id",
        "userId",
        "email",
        "phone",
        "url",
        "code",
        "status",
        "timestamp",
        "createdAt",
        "updatedAt",
        "version",
      ].includes(key)
    ) {
      continue;
    }

    if (typeof value === "string") {
      // 检查是否包含英文字符且不是纯数字/布尔值
      if (
        /[a-zA-Z]/.test(value) &&
        !/^\d+$/.test(value) &&
        !/^true|false$/i.test(value)
      ) {
        // 检查是否是较长的文本（避免翻译短的API字段名）
        if (value.length > 3) {
          return true;
        }
      }
    } else if (typeof value === "object" && value !== null) {
      if (containsTranslatableText(value, depth + 1)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 获取多语言管理器实例
 */
function getMultilingualManager() {
  return multilingualManager;
}

/**
 * 设置多语言管理器实例（用于测试）
 */
function setMultilingualManager(manager) {
  multilingualManager = manager;
}

module.exports = {
  localizationMiddleware,
  getMultilingualManager,
  setMultilingualManager,
};
