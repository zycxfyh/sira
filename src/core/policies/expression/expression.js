'use strict'

module.exports = (actionParams) => (req, res, next) => {
  // SECURITY CRITICAL: Expression policy disabled due to RCE vulnerability
  const error = new Error('Expression policy is DISABLED for security reasons. Arbitrary code execution is not allowed.')
  error.statusCode = 403
  next(error)
}
