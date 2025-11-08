module.exports = {
  parserOptions: { ecmaVersion: 2020 },
  extends: ['standard'],
  rules: {
    'no-unused-vars': 'warn',
    camelcase: ['error', { properties: 'never', ignoreDestructuring: true, allow: ['max_tokens', 'x_api_key', 'x_request_id', 'x_trace_id', 'x_parent_span_id', 'x_span_id', 'x_cache_status', 'x_cache_key', 'x_cached_at', 'x_ratelimit_limit', 'x_ratelimit_remaining', 'x_ratelimit_reset'] }]
  },
  env: {
    node: true,
    es6: true
  },
  globals: {
    describe: 'readonly',
    it: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    expect: 'readonly',
    sinon: 'readonly'
  }
}
