const log = require('../../logger').policy

module.exports = function (params) {
  log.warn(`The headers policy has been marked as deprecated and will be removed in the next major release. Please
  consider using the request transformer to do the same thing`)
  return (req, res, next) => {
    for (const key in params.forwardHeaders) {
      const val = params.forwardHeaders[key]
      const headerName = params.headersPrefix + key
      log.debug(`Adding ${headerName} header to the request`)
      try {
        // Use safe evaluation instead of dangerous run method
        req.headers[headerName] = req.egContext.safeEval(val)
      } catch (error) {
        log.warn(`Failed to evaluate header value for ${headerName}:`, error.message)
        // Skip header if evaluation fails
      }
    }
    next()
  }
}
