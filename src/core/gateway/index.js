const express = require("express");
const chalk = require("chalk");
const log = require("../logger").gateway;
const servers = require("./server");
const pipelines = require("./pipelines");
const eventBus = require("../eventBus");
const policies = require("../policies");
const conditions = require("../conditions");
const passport = require("passport");
const pluginsLoader = require("../plugins");

module.exports = ({ plugins, config } = {}) => {
  const appPromises = [];
  const apps = {};
  config = config || require("../config");

  console.log("配置中的HTTP端口:", config.gatewayConfig?.http?.port);
  console.log("环境变量PORT:", process.env.PORT);

  return bootstrap({ plugins, config }).then(({ httpServer, httpsServer }) => {
    [
      {
        serverConfig: config.gatewayConfig.http,
        server: httpServer,
        appProperty: "httpApp",
        eventName: "http-ready",
      },
      {
        serverConfig: config.gatewayConfig.https,
        server: httpsServer,
        appProperty: "httpsApp",
        eventName: "https-ready",
      },
    ].forEach(({ serverConfig, server, appProperty, eventName }) => {
      if (serverConfig && server) {
        appPromises.push(
          new Promise((resolve) => {
            const runningApp = server.listen(
              serverConfig.port,
              serverConfig.hostname,
              () => {
                const addressInfo = runningApp.address();
                const adInfo =
                  typeof addressInfo === "string"
                    ? addressInfo
                    : `${addressInfo.address}:${addressInfo.port}`;
                log.info(
                  `gateway ${appProperty.startsWith("https") ? "https" : "http"} server listening on ${adInfo}`,
                );

                eventBus.emit(eventName, { httpServer: runningApp });

                apps[appProperty] = runningApp;
                resolve(runningApp);
              },
            );
          }),
        );
      }
    });

    return Promise.all(appPromises).then(() => {
      return {
        app: apps.httpApp,
        httpsApp: apps.httpsApp,
      };
    });
  });
};

const bootstrapPolicies = ({ app, plugins, config } = {}) => {
  if (plugins?.policies?.length) {
    plugins.policies.forEach((policy) => {
      if (!policies[policy.name]) {
        log.verbose(
          `registering policy ${chalk.green(policy.name)} from ${plugins.name} plugin`,
        );
        policies.register(policy);
      } else
        log.verbose(
          `policy ${chalk.magenta(policy.name)} from ${plugins.name} is already loaded`,
        );
    });
  }

  // Load policies present in config
  policies.load(config.gatewayConfig.policies);

  // Load all routes from policies
  // TODO: after all complext policies will go to plugin this code can be removed
  // NOTE: plugins have mechanism to provide custom routes
  config.gatewayConfig.policies?.forEach((policyName) => {
    const policy = policies.resolve(policyName);
    if (policy.routes) {
      policy.routes(app, config);
    }
  });

  if (plugins?.gatewayRoutes?.length) {
    log.debug("registering gatewayRoute");
    plugins.gatewayRoutes.forEach((ext) => ext(app));
  }

  const conditionEngine = conditions.init();
  if (plugins?.conditions?.length) {
    plugins.conditions.forEach((cond) => {
      log.debug(`registering condition ${cond.name}`);
      conditionEngine.register(cond);
    });
  }
};

async function bootstrap({ plugins, config } = {}) {
  let rootRouter;
  const app = express();
  app.set("x-powered-by", false);

  app.use(passport.initialize());

  // 初始化国际化管理器
  const { I18nManager } = require("../i18n-manager");
  const { LanguageRouter } = require("../language-router");

  const i18nManager = new I18nManager();
  await i18nManager.initialize();

  const languageRouter = new LanguageRouter(i18nManager);

  // 添加国际化中间件
  app.use(languageRouter.getMiddleware());

  // 添加语言路由
  app.use("/api/i18n", languageRouter.getRouter());

  console.log("正在注册路由...");

  // 在管道系统之前添加健康检查
  app.get("/health", (_req, res) => {
    console.log("健康检查被调用");
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "2.0.0",
      environment: process.env.NODE_ENV || "development",
      gateway: "Sira AI Gateway",
      services: {
        core: "running",
        gateway: "running",
        cache: "running",
      },
    });
  });

  // 添加一个简单的测试路由
  app.get("/test", (_req, res) => {
    console.log("测试路由被调用");
    res.send("Test route works");
  });

  console.log("路由注册完成，检查路由栈:", app._router.stack.length);

  // 添加catch-all路由用于调试
  app.use("*", (req, res) => {
    console.log(`Catch-all: ${req.method} ${req.path}`);
    res.status(404).send("Route not found");
  });

  bootstrapPolicies({ app, plugins, config });
  rootRouter = await pipelines.bootstrap({ app: express.Router(), config });
  app.use((req, res, next) => rootRouter(req, res, next));

  eventBus.on("hot-reload", async (hotReloadContext) => {
    const oldConfig = config;
    const oldPlugins = plugins;
    const oldRootRouter = rootRouter;
    try {
      const newConfig = hotReloadContext.config;
      bootstrapPolicies({
        app,
        plugins: pluginsLoader.load(newConfig),
        config: newConfig,
      });
      rootRouter = await pipelines.bootstrap({
        app: express.Router(),
        config: newConfig,
      });
      log.info("hot-reload config completed");
    } catch (err) {
      log.error(
        `Could not hot-reload gateway.config.yml. Configuration is invalid. ${err}`,
      );
      bootstrapPolicies({ app, plugins: oldPlugins, config: oldConfig });
      rootRouter = oldRootRouter;
    }
  });

  if (!process.env.EG_DISABLE_CONFIG_WATCH) {
    config.watch();
  }

  return servers.bootstrap(app);
}
