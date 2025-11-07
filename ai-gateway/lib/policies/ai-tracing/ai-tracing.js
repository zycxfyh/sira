// AI Tracing Policy
// Distributed tracing for AI requests using OpenTelemetry

let opentelemetry, NodeTracerProvider, BatchSpanProcessor, Resource, SemanticResourceAttributes
let JaegerExporter, ZipkinExporter, OTLPTraceExporter, ConsoleSpanExporter, TraceIdRatioBasedSampler

try {
  opentelemetry = require('@opentelemetry/api')
  NodeTracerProvider = require('@opentelemetry/sdk-trace-node').NodeTracerProvider
  BatchSpanProcessor = require('@opentelemetry/sdk-trace-base').BatchSpanProcessor
  Resource = require('@opentelemetry/resources').Resource
  SemanticResourceAttributes = require('@opentelemetry/semantic-conventions').SemanticResourceAttributes

  // Optional exporters
  try {
    JaegerExporter = require('@opentelemetry/exporter-jaeger').JaegerExporter
  } catch (e) {
    JaegerExporter = null
  }

  try {
    ZipkinExporter = require('@opentelemetry/exporter-zipkin').ZipkinExporter
  } catch (e) {
    ZipkinExporter = null
  }

  try {
    OTLPTraceExporter = require('@opentelemetry/exporter-trace-otlp-proto').OTLPTraceExporter
  } catch (e) {
    OTLPTraceExporter = null
  }

  ConsoleSpanExporter = require('@opentelemetry/sdk-trace-base').ConsoleSpanExporter
  TraceIdRatioBasedSampler = require('@opentelemetry/sdk-trace-base').TraceIdRatioBasedSampler
} catch (error) {
  console.warn('OpenTelemetry dependencies not available, tracing disabled:', error.message)
  // Graceful degradation - tracing will be disabled
}

module.exports = function (params, config) {
  const logger = config.logger || console

  // Tracing configuration
  const tracingConfig = {
    serviceName: params.serviceName || 'ai-gateway',
    serviceVersion: params.serviceVersion || '1.0.0',
    environment: params.environment || 'development',
    exporter: params.exporter || 'console', // console, jaeger, zipkin, otlp
    sampleRate: params.sampleRate || 1.0, // 1.0 = 100% sampling
    jaegerEndpoint: params.jaegerEndpoint || 'http://localhost:14268/api/traces',
    zipkinEndpoint: params.zipkinEndpoint || 'http://localhost:9411/api/v2/spans',
    otlpEndpoint: params.otlpEndpoint || 'http://localhost:4318/v1/traces'
  }

  let tracer = null

  // Initialize tracer provider if not already done and OpenTelemetry is available
  if (opentelemetry && !opentelemetry.trace.getTracerProvider()) {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: tracingConfig.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: tracingConfig.serviceVersion,
      [SemanticResourceAttributes.SERVICE_ENVIRONMENT]: tracingConfig.environment
    })

    const provider = new NodeTracerProvider({ resource })

    // Configure exporter
    let exporter
    switch (tracingConfig.exporter) {
      case 'jaeger':
        const { JaegerExporter } = require('@opentelemetry/exporter-jaeger')
        exporter = new JaegerExporter({
          endpoint: tracingConfig.jaegerEndpoint
        })
        break
      case 'zipkin':
        const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin')
        exporter = new ZipkinExporter({
          url: tracingConfig.zipkinEndpoint
        })
        break
      case 'otlp':
        const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto')
        exporter = new OTLPTraceExporter({
          url: tracingConfig.otlpEndpoint
        })
        break
      default:
        const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base')
        exporter = new ConsoleSpanExporter()
    }

    provider.addSpanProcessor(new BatchSpanProcessor(exporter))
    provider.register()

    // Configure sampling
    if (tracingConfig.sampleRate < 1.0 && TraceIdRatioBasedSampler) {
      provider.sampler = new TraceIdRatioBasedSampler(tracingConfig.sampleRate)
    }

    logger.info('OpenTelemetry tracing initialized', {
      exporter: tracingConfig.exporter,
      sampleRate: tracingConfig.sampleRate,
      serviceName: tracingConfig.serviceName
    })
  }

  // Get tracer if OpenTelemetry is available
  if (opentelemetry) {
    tracer = opentelemetry.trace.getTracer(tracingConfig.serviceName)
  }

  return function aiTracing (req, res, next) {
    // Check if OpenTelemetry is available
    if (!opentelemetry || !tracer) {
      logger.debug('OpenTelemetry not available, skipping tracing')
      return next()
    }

    // Create main request span
    const span = tracer.startSpan(`ai-gateway ${req.method} ${req.path}`, {
      kind: opentelemetry.SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.scheme': req.protocol,
        'http.host': req.get('host'),
        'http.target': req.url,
        'http.user_agent': req.get('user-agent'),
        'http.request_content_length': req.get('content-length') || 0,
        'net.transport': 'ip_tcp',
        'net.peer.ip': req.ip,
        'net.peer.port': req.connection.remotePort,
        'ai.gateway.request_id': req.headers['x-request-id'] || generateRequestId(),
        'ai.gateway.user_id': req.user?.id || 'anonymous',
        'ai.gateway.api_key': req.headers['x-api-key'] ? 'present' : 'missing'
      }
    })

    // Set span context for downstream services
    const ctx = opentelemetry.trace.setSpan(opentelemetry.context.active(), span)
    req.traceContext = ctx

    // Add trace headers to request for propagation
    const carrier = {}
    opentelemetry.propagation.inject(ctx, carrier)
    req.traceHeaders = carrier

    // Extract AI-specific attributes
    if (req.body && typeof req.body === 'object') {
      const body = req.body

      if (body.model) {
        span.setAttribute('ai.model', body.model)
        span.setAttribute('ai.provider', detectProvider(body.model))
      }

      if (body.messages) {
        span.setAttribute('ai.messages.count', body.messages.length)
        span.setAttribute('ai.messages.total_length',
          body.messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0))
      }

      if (body.max_tokens) {
        span.setAttribute('ai.max_tokens', body.max_tokens)
      }

      if (body.temperature) {
        span.setAttribute('ai.temperature', body.temperature)
      }
    }

    // Track response
    const originalJson = res.json
    const originalSend = res.send
    const originalStatus = res.status

    let responseBody
    let statusCode = 200
    let responseSize = 0

    res.status = function (code) {
      statusCode = code
      span.setAttribute('http.status_code', code)

      // Set span status based on HTTP status
      if (code >= 400) {
        span.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: `HTTP ${code}`
        })
      }

      return originalStatus.call(this, code)
    }

    res.json = function (data) {
      responseBody = data
      responseSize = JSON.stringify(data).length

      span.setAttribute('http.response_content_length', responseSize)

      // Extract AI response metrics
      if (data && typeof data === 'object') {
        if (data.usage) {
          span.setAttribute('ai.usage.prompt_tokens', data.usage.prompt_tokens || 0)
          span.setAttribute('ai.usage.completion_tokens', data.usage.completion_tokens || 0)
          span.setAttribute('ai.usage.total_tokens', data.usage.total_tokens || 0)
        }

        if (data.choices && data.choices.length > 0) {
          span.setAttribute('ai.choices.count', data.choices.length)
          const firstChoice = data.choices[0]
          if (firstChoice.finish_reason) {
            span.setAttribute('ai.finish_reason', firstChoice.finish_reason)
          }
        }
      }

      span.end()
      return originalJson.call(this, data)
    }

    res.send = function (data) {
      if (typeof data === 'string') {
        responseSize = data.length
      } else if (Buffer.isBuffer(data)) {
        responseSize = data.length
      }

      span.setAttribute('http.response_content_length', responseSize)
      span.end()

      return originalSend.call(this, data)
    }

    // Handle request errors
    const originalOnError = req.on.bind(req)
    req.on = function (event, handler) {
      if (event === 'error') {
        return originalOnError(event, (error) => {
          span.recordException(error)
          span.setStatus({
            code: opentelemetry.SpanStatusCode.ERROR,
            message: error.message
          })
          handler(error)
        })
      }
      return originalOnError(event, handler)
    }

    // Add trace ID to response headers for debugging
    const traceId = span.spanContext().traceId
    res.set('x-trace-id', traceId)

    next()
  }

  // Detect AI provider from model name
  function detectProvider (model) {
    if (!model) return 'unknown'

    if (model.startsWith('gpt-')) return 'openai'
    if (model.startsWith('claude-')) return 'anthropic'
    if (model.includes('azure') || model.includes('embedding')) return 'azure'

    return 'unknown'
  }

  // Generate request ID
  function generateRequestId () {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Health check for tracing
  config.tracingHealth = {
    getStats: () => ({
      tracer: tracer ? 'active' : 'inactive',
      config: tracingConfig
    }),
    flush: async () => {
      // Force flush any pending spans
      const provider = opentelemetry.trace.getTracerProvider()
      if (provider && typeof provider.forceFlush === 'function') {
        await provider.forceFlush()
      }
    }
  }
}
