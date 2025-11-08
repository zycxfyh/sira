const uuid62 = require('uuid62')
function EgContextBase () {
  this.requestID = uuid62.v4()
}
Object.defineProperty(EgContextBase.prototype, 'egContext', {
  get () {
    return this
  }
})

Object.defineProperty(EgContextBase.prototype, 'consumer', {
  get () {
    return this.req.user
  }
})

// Safe expression evaluator - only allows property access and basic comparisons
EgContextBase.prototype.safeEval = function (expression) {
  // Remove dangerous patterns
  if (/function|eval|require|import|process|global|this\.|new|class|=>|prototype|constructor/i.test(expression)) {
    throw new Error('Unsafe expression: contains forbidden keywords')
  }

  // Only allow basic property access and comparisons
  const allowedPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:\s*(?:===?|!==?|<=|>=|<|>)\s*(?:[a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*|['"`][^'"`]*['"`]|\d+(?:\.\d+)?))?$/i

  if (!allowedPattern.test(expression.trim())) {
    throw new Error('Unsafe expression: only property access and basic comparisons allowed')
  }

  try {
    // Use Function constructor with restricted context instead of vm
    const func = new Function('context', `with(context) { return ${expression}; }`)
    return func(this)
  } catch (error) {
    throw new Error(`Expression evaluation failed: ${error.message}`)
  }
}

EgContextBase.prototype.evaluateAsTemplateString = function (expression) {
  // Template strings are inherently unsafe - disable
  throw new Error('Template string evaluation is disabled for security reasons')
}

EgContextBase.prototype.match = function (expression) {
  try {
    const result = this.safeEval(expression)
    return !!result
  } catch (error) {
    console.warn('Expression evaluation failed:', error.message)
    return false
  }
}
EgContextBase.prototype.run = function (code, ctx) {
  // SECURITY CRITICAL: vm.runInNewContext is UNSAFE and allows RCE
  // This method has been disabled for security reasons
  throw new Error('Arbitrary code execution is disabled for security reasons. Use safe expression evaluation instead.')
}

module.exports = EgContextBase
