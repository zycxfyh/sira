const jsonParser = require('express').json()
const urlEncoded = require('express').urlencoded({ extended: true })
const { PassThrough } = require('stream')
const transformObject = require('./transform-object')
const formurlencoded = require('form-urlencoded').default

module.exports = {
  schema: require('./schema'),
  policy: params => {
    return (req, res, next) => {
      // SECURITY CRITICAL: Request transformer policy disabled due to RCE vulnerability
      const error = new Error('Request transformer policy is DISABLED for security reasons. Arbitrary code execution in transformations is not allowed.')
      error.statusCode = 403
      next(error)
    }
  }
}
