const logger = require('../logger').admin
const eventBus = require('../eventBus')
const express = require('express')

module.exports = function ({ plugins, config } = {}) {
  const cfg = (config || require('../config')).gatewayConfig

  if (!cfg.admin || cfg.admin.port === undefined || cfg.admin.port === null) {
    logger.verbose('Admin server is not configured, launch canceled')
    return
  }
  if (cfg.admin.hostname) {
    logger.warn('Warning! use of hostname is deprecated in admin section, use host instead')
  }

  // Remove the default in the code when we will not support both properties anymore.
  cfg.admin.host = cfg.admin.hostname || cfg.admin.host || 'localhost'

  const app = express()
  app.set('x-powered-by', false)
  app.use(express.json())

  if (process.env.LOG_LEVEL === 'debug') {
    app.use((req, res, next) => {
      logger.debug(`${req.url} ${req.method}`)
      req.body && logger.debug(JSON.stringify(req.body, undefined, 2))
      next()
    })
  }

  if (plugins && plugins.adminRoutes && plugins.adminRoutes.length) {
    plugins.adminRoutes.forEach(ext => ext(app))
  }
  app.use('/users', require('./routes/users')())
  app.use('/apps', require('./routes/apps')())
  app.use('/scopes', require('./routes/scopes')())
  app.use('/credentials', require('./routes/credentials')())
  app.use('/tokens', require('./routes/tokens')())
  app.use('/api-endpoints', require('./routes/api-endpoints')({ config }))
  app.use('/service-endpoints', require('./routes/service-endpoints')({ config }))
  app.use('/pipelines', require('./routes/pipelines')({ config }))
  app.use('/policies', require('./routes/policies')({ config }))
  app.use('/schemas', require('./routes/schemas')())
  app.use('/', require('./routes/analytics')())
  app.use('/', require('./routes/parameters')())
  app.use('/', require('./routes/prompt-templates')())
  app.use('/', require('./routes/benchmark')())
  app.use('/', require('./routes/api-keys')())
  app.use('/', require('./routes/game-ai')())
  app.use('/', require('./routes/image-generator')())
  app.use('/', require('./routes/voice-processor')())
  app.use('/', require('./routes/price-monitor')())
  app.use('/', require('./routes/conversation-manager')())
  app.use('/ab-tests', require('./routes/ab-tests')())
  app.use('/webhooks', require('./routes/webhooks')())
  app.use('/rules', require('./routes/rules')())
  app.use('/reports', require('./routes/reports')())
  app.use('/intelligent-routing', require('./routes/intelligent-routing')())
  app.use('/multilingual', require('./routes/multilingual')())
  app.use('/batch-processing', require('./routes/batch-processing')())
  app.use('/model-training', require('./routes/model-training')())

  app.use((err, req, res, next) => {
    logger.debug(err.stack)
    if (err.code === 'INVALID_CONFIG') {
      return res.status(422).send(err.message)
    }
    res.status(500).send(err.message || 'admin API error')
  })

  return new Promise(resolve => {
    const { port, host, backlog } = cfg.admin
    const srv = app.listen(port, host, backlog, () => {
      const { address, port } = srv.address()
      logger.info(`admin http server listening on ${address}:${port}`)
      eventBus.emit('admin-ready', { adminServer: srv })
      resolve(srv)
    })
  })
}
