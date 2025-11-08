// AI Queue Policy
// Asynchronous request processing using NATS for AI requests

const { connect, StringCodec } = require('nats')

module.exports = function (params, config) {
  const logger = config.logger || console
  const sc = StringCodec()

  // Queue configuration
  const queueConfig = Object.assign({
    natsUrl: 'nats://localhost:4222',
    queueName: 'ai.requests',
    maxConcurrent: 10,
    maxQueueSize: 1000,
    timeout: 300000
  }, params)

  let nc = null
  let js = null

  // Initialize NATS connection
  async function initNats () {
    try {
      nc = await connect({ servers: [queueConfig.natsUrl] })
      js = nc.jetstream()
      logger.info('NATS connection established')
    } catch (error) {
      logger.error('Failed to connect to NATS', error)
      throw error
    }
  }

  async function aiQueue (req, res, next) {
    try {
      if (!nc) await initNats()

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const message = {
        id: requestId,
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        timestamp: Date.now()
      }

      if (js) {
        await js.publish(`${queueConfig.queueName}.requests`, sc.encode(JSON.stringify(message)))
      }

      res.set('x-request-id', requestId)
      res.set('x-queue-status', 'queued')
      res.json({
        status: 'queued',
        requestId: requestId,
        message: 'Request has been queued for processing'
      })
    } catch (error) {
      logger.error('Failed to queue request', error)
      res.status(500).json({ error: 'Failed to queue request' })
    }
  }

  // Status endpoint
  config.queueStatus = {
    getQueueStats: async () => {
      return { queueName: queueConfig.queueName, status: nc ? 'connected' : 'disconnected' }
    }
  }

  // Cleanup
  process.on('SIGTERM', async () => {
    if (nc) await nc.close()
  })

  process.on('SIGINT', async () => {
    if (nc) await nc.close()
  })

  return aiQueue
}
