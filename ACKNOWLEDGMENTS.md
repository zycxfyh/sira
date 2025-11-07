# Sira AI网关 - 开源技术致谢

## 🎉 致谢

Sira AI网关项目基于众多优秀的开源项目和技术构建而成。我们衷心感谢所有开源社区的贡献者们，没有你们的付出和奉献，这个项目将无法实现。

## 📚 核心依赖

### Web框架 & HTTP工具
- **[Express.js](https://github.com/expressjs/express)** - 快速、开放、极简的Web框架
- **[Axios](https://github.com/axios/axios)** - 基于Promise的HTTP库
- **[SuperAgent](https://github.com/ladjs/superagent)** - 轻量级渐进式AJAX API
- **[SuperAgent Logger](https://github.com/ladjs/superagent-logger)** - SuperAgent请求日志记录
- **[SuperAgent Prefix](https://github.com/ladjs/superagent-prefix)** - SuperAgent URL前缀插件
- **[Node Fetch](https://github.com/node-fetch/node-fetch)** - 在Node.js中使用Fetch API
- **[HTTP Proxy](https://github.com/http-party/node-http-proxy)** - Node.js HTTP代理
- **[Proxy Agent](https://github.com/TooTallNate/proxy-agent)** - HTTP/HTTPS代理支持
- **[Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)** - Express速率限制中间件
- **[Express Session](https://github.com/expressjs/session)** - Express会话管理
- **[Rate Limit Redis](https://github.com/wyattjoh/rate-limit-redis)** - Redis速率限制存储

### 身份验证 & 安全
- **[Passport.js](https://github.com/jaredhanson/passport)** - Node.js身份验证中间件
- **[Passport HTTP](https://github.com/jaredhanson/passport-http)** - HTTP基本认证策略
- **[Passport HTTP Bearer](https://github.com/jaredhanson/passport-http-bearer)** - HTTP Bearer认证策略
- **[Passport JWT](https://github.com/mikenicholson/passport-jwt)** - JWT认证策略
- **[Passport Local](https://github.com/jaredhanson/passport-local)** - 本地用户名/密码认证
- **[Passport OAuth2 Client Password](https://github.com/jaredhanson/passport-oauth2-client-password)** - OAuth2客户端密码策略
- **[JWT](https://github.com/auth0/node-jsonwebtoken)** - JSON Web Token实现
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** - 密码哈希库
- **[OAuth2orize](https://github.com/jaredhanson/oauth2orize)** - OAuth2服务器框架
- **[CORS](https://github.com/expressjs/cors)** - CORS中间件
- **[Connect Ensure Login](https://github.com/jaredhanson/connect-ensure-login)** - 确保用户登录的中间件
- **[Opossum](https://github.com/nodeshift/opossum)** - Node.js断路器模式实现

### 数据存储 & 缓存
- **[Redis](https://redis.io/)** - 高性能键值数据库
- **[Ioredis](https://github.com/luin/ioredis)** - Redis Node.js客户端
- **[Ioredis Mock](https://github.com/stipsan/ioredis-mock)** - Redis内存模拟器

### 配置 & 数据处理
- **[JS-YAML](https://github.com/nodeca/js-yaml)** - YAML解析器和字符串化器
- **[Yawn YAML](https://github.com/mohsen1/yawn-yaml)** - YAML编辑和格式化
- **[AJV](https://github.com/ajv-validator/ajv)** - JSON Schema验证器
- **[AJV Keywords](https://github.com/ajv-validator/ajv-keywords)** - AJV关键字扩展
- **[JSON Schema Ref Parser](https://github.com/APIDevTools/json-schema-ref-parser)** - JSON Schema引用解析器
- **[JSON Schema Merge AllOf](https://github.com/mokkabonna/json-schema-merge-allof)** - JSON Schema合并工具
- **[Lodash](https://lodash.com/)** - JavaScript工具库
- **[Lodash.flatmap](https://github.com/lodash/lodash)** - Lodash flatMap函数
- **[UUID](https://github.com/uuidjs/uuid)** - RFC4122 UUID生成器
- **[UUID62](https://github.com/SpiderStrategies/uuid62)** - UUID62编码器
- **[Semver](https://github.com/npm/node-semver)** - 语义化版本控制
- **[Minimatch](https://github.com/isaacs/minimatch)** - 通配符匹配库

### 日志 & 监控
- **[Winston](https://github.com/winstonjs/winston)** - 多传输异步日志库
- **[OpenTelemetry](https://opentelemetry.io/)** - 可观测性框架

### 开发工具 & 测试
- **[Mocha](https://github.com/mochajs/mocha)** - JavaScript测试框架
- **[Chai](https://github.com/chaijs/chai)** - BDD/TDD断言库
- **[Supertest](https://github.com/ladjs/supertest)** - HTTP端到端测试库
- **[Sinon.JS](https://github.com/sinonjs/sinon)** - 测试间谍、存根和模拟
- **[Puppeteer](https://github.com/puppeteer/puppeteer)** - 浏览器自动化工具
- **[NYC](https://github.com/istanbuljs/nyc)** - Istanbul命令行界面
- **[ESLint](https://eslint.org/)** - JavaScript代码检查工具
- **[Prettier](https://prettier.io/)** - 代码格式化工具

### 构建 & 部署工具
- **[Yeoman](https://yeoman.io/)** - 现代Web应用脚手架工具
- **[Cross-Env](https://github.com/kentcdodds/cross-env)** - 跨平台环境变量设置
- **[Rimraf](https://github.com/isaacs/rimraf)** - 深度删除工具
- **[Chokidar](https://github.com/paulmillr/chokidar)** - 文件监视库

## 🏗️ 基础设施

### API网关
- **[Kong](https://github.com/Kong/kong)** - 云原生API网关和微服务管理层

### 容器化
- **[Docker](https://www.docker.com/)** - 容器化平台
- **[Docker Compose](https://github.com/docker/compose)** - 多容器Docker应用程序定义和运行

### 监控 & 可观测性
- **[Prometheus](https://prometheus.io/)** - 开源监控和告警工具包
- **[Grafana](https://github.com/grafana/grafana)** - 开源分析和监控平台
- **[Alertmanager](https://github.com/prometheus/alertmanager)** - Prometheus告警管理器

### 消息队列
- **[NATS](https://nats.io/)** - 高性能云原生消息传递系统

## 🎨 前端 & UI

### 样式 & 图标
- **[Chalk](https://github.com/chalk/chalk)** - 终端字符串样式
- **[Color Convert](https://github.com/Qix-/color-convert)** - 颜色空间转换

### 模板引擎
- **[EJS](https://github.com/mde/ejs)** - 嵌入式JavaScript模板

## 📦 开发依赖

### 类型定义
- **[@types/express](https://github.com/DefinitelyTyped/DefinitelyTyped)** - Express.js TypeScript类型定义
- **[@types/json-schema](https://github.com/DefinitelyTyped/DefinitelyTyped)** - JSON Schema TypeScript类型定义

### 代码质量
- **[ESLint Config Standard](https://github.com/standard/eslint-config-standard)** - ESLint标准配置
- **[ESLint Plugin Import](https://github.com/import-js/eslint-plugin-import)** - ESLint导入插件
- **[ESLint Plugin Node](https://github.com/mysticatea/eslint-plugin-node)** - ESLint Node.js插件
- **[ESLint Plugin Promise](https://github.com/eslint-community/eslint-plugin-promise)** - ESLint Promise插件
- **[ESLint Plugin Standard](https://github.com/standard/eslint-plugin-standard)** - ESLint标准插件

### 测试框架 & 工具
- **[Chai](https://github.com/chaijs/chai)** - BDD/TDD断言库
- **[Should.js](https://github.com/shouldjs/should.js)** - 行为驱动的测试库
- **[Supertest](https://github.com/ladjs/supertest)** - HTTP端到端测试库
- **[Supertest Session](https://github.com/rjz/supertest-session)** - Supertest会话支持
- **[Mocha LCOV Reporter](https://github.com/StevenLooman/mocha-lcov-reporter)** - Mocha LCOV报告器
- **[Istanbul](https://github.com/gotwarlost/istanbul)** - JavaScript代码覆盖率工具

### 构建 & 部署工具
- **[CPR](https://github.com/davglass/cpr)** - 文件和目录复制工具
- **[Find Free Port](https://github.com/tapjs/find-free-port)** - 查找可用网络端口
- **[Husky](https://github.com/typicode/husky)** - Git钩子管理工具
- **[Lint Staged](https://github.com/okonet/lint-staged)** - 对暂存的git文件运行linter
- **[Codecov](https://github.com/codecov/codecov-node)** - 代码覆盖率报告工具
- **[TMP](https://github.com/raszi/node-tmp)** - 临时文件和目录管理

### 实用工具
- **[Clone](https://github.com/pvorb/clone)** - 深拷贝JavaScript对象
- **[Form URL Encoded](https://github.com/brandonhorst/form-urlencoded)** - 表单URL编码/解码
- **[Find Up](https://github.com/sindresorhus/find-up)** - 向上查找文件或目录
- **[Parent Require](https://github.com/floatdrop/parent-require)** - 从父级目录require模块
- **[Vhost](https://github.com/expressjs/vhost)** - Express虚拟主机中间件
- **[Yargs](https://github.com/yargs/yargs)** - 命令行参数解析

## 🤝 贡献框架

### 原始项目
- **[Express Gateway](https://github.com/ExpressGateway/express-gateway)** - 基于Express的API网关框架

## 📄 许可证

本项目中的开源组件使用各种许可证，包括但不限于：
- MIT License
- Apache License 2.0
- BSD License
- ISC License

## 🙏 特别感谢

我们特别感谢以下开源项目的维护者和贡献者：

- **Express.js团队** - 为Node.js生态系统提供了强大的Web框架
- **Kong团队** - 提供了优秀的API网关解决方案
- **Docker团队** - 让容器化技术普及化
- **Prometheus & Grafana团队** - 为监控和可视化提供了标准
- **所有Node.js模块的作者们** - 丰富了JavaScript生态系统

## 📞 联系我们

如果您是某个开源项目的维护者，发现我们使用不当或有其他问题，请通过以下方式联系我们：

- 邮箱: 1666384464@qq.com
- GitHub Issues: [提交Issue](https://github.com/zycxfyh/sira/issues)

---

*最后更新: 2025年11月8日 (补充完整开源技术清单)*

## 🔄 更新日志

### v2.0.0 (2025-11-08)
- 添加完整的开源技术致谢名单
- 分类整理所有依赖包和工具
- 包含基础设施和监控工具的致谢

### v2.0.1 (2025-11-08)
- 补充遗漏的开源技术：SuperAgent扩展、Passport策略、实用工具库
- 添加完整的开发依赖：ESLint插件、测试工具、构建工具等
- 完善开源技术清单，总计80+个开源项目
