// Artillery test data processor
// This file generates dynamic test data for load testing

const casual = require('casual');

// Initialize casual with seed for reproducible results
casual.seed(123);

// Haiku topics for creative writing tests
const haikuTopics = [
  'autumn leaves', 'mountain stream', 'cherry blossoms', 'winter snow',
  'summer breeze', 'ocean waves', 'morning dew', 'night sky',
  'bamboo forest', 'lotus flower', 'rising sun', 'falling rain'
];

// Sample texts for summarization
const summaryTexts = [
  'Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think like humans and mimic their actions. The term may also be applied to any machine that exhibits traits associated with a human mind such as learning and problem-solving.',
  'Machine learning is a subset of artificial intelligence (AI) that provides systems the ability to automatically learn and improve from experience without being explicitly programmed. Machine learning focuses on the development of computer programs that can access data and use it to learn for themselves.',
  'Deep learning is part of a broader family of machine learning methods based on artificial neural networks with representation learning. Learning can be supervised, semi-supervised or unsupervised. Deep learning architectures such as deep neural networks, deep belief networks, recurrent neural networks and convolutional neural networks have been applied to fields including computer vision, speech recognition, natural language processing, audio recognition, social network filtering, machine translation, bioinformatics, drug design, medical image analysis, material inspection and board game programs, where they have produced results comparable to and in some cases surpassing human expert performance.'
];

// Embedding texts for vector generation
const embeddingSampleTexts = [
  'The quick brown fox jumps over the lazy dog.',
  'Machine learning is transforming industries worldwide.',
  'Natural language processing enables human-computer interaction.',
  'Artificial intelligence systems learn from data patterns.',
  'Neural networks mimic biological brain structures.',
  'Computer vision algorithms recognize visual patterns.',
  'Reinforcement learning optimizes decision-making processes.',
  'Deep learning models require significant computational resources.',
  'Transfer learning applies knowledge across different domains.',
  'Generative AI creates new content from learned patterns.'
];

module.exports = {
  // Generate random haiku topic
  generateHaikuTopic: function(context, events, done) {
    context.vars.haiku_topic = casual.random_element(haikuTopics);
    return done();
  },

  // Generate random summary text
  generateSummaryText: function(context, events, done) {
    context.vars.summary_text = casual.random_element(summaryTexts);
    return done();
  },

  // Generate random embedding texts (array)
  generateEmbeddingTexts: function(context, events, done) {
    const count = casual.integer(1, 5); // 1-5 texts per request
    context.vars.embedding_texts = [];

    for (let i = 0; i < count; i++) {
      context.vars.embedding_texts.push(casual.random_element(embeddingSampleTexts));
    }

    return done();
  },

  // Generate random user ID for multi-tenant testing
  generateUserId: function(context, events, done) {
    context.vars.user_id = casual.uuid;
    return done();
  },

  // Generate random model selection
  generateRandomModel: function(context, events, done) {
    const models = ['gpt-3.5-turbo', 'gpt-4', 'claude-3-haiku', 'claude-3-sonnet'];
    context.vars.model = casual.random_element(models);
    return done();
  },

  // Generate random temperature
  generateRandomTemperature: function(context, events, done) {
    context.vars.temperature = casual.double(0, 2);
    return done();
  },

  // Generate random max tokens
  generateRandomMaxTokens: function(context, events, done) {
    const tokens = [50, 100, 200, 500, 1000];
    context.vars.max_tokens = casual.random_element(tokens);
    return done();
  },

  // Before request hook - set dynamic headers
  beforeRequest: function(requestParams, context, ee, next) {
    // Add dynamic user ID header
    requestParams.headers['x-user-id'] = context.vars.user_id || 'test-user';

    // Add request timestamp for latency tracking
    context.vars.requestStartTime = Date.now();

    return next();
  },

  // After response hook - collect metrics
  afterResponse: function(requestParams, response, context, ee, next) {
    const responseTime = Date.now() - context.vars.requestStartTime;

    // Log slow requests (>1 second)
    if (responseTime > 1000) {
      console.log(`Slow request: ${requestParams.url} took ${responseTime}ms`);
    }

    // Collect custom metrics
    if (response.statusCode >= 200 && response.statusCode < 300) {
      ee.emit('counter', 'successful_requests', 1);
      ee.emit('histogram', 'response_time', responseTime);
    } else {
      ee.emit('counter', 'failed_requests', 1);
      ee.emit('histogram', 'error_response_time', responseTime);
    }

    // Check for specific response patterns
    if (response.body && typeof response.body === 'string') {
      try {
        const body = JSON.parse(response.body);

        // Check if this was a batched request
        if (body.batch_id) {
          ee.emit('counter', 'batched_requests', 1);
        }

        // Check if this was served from cache
        if (body.cached === true) {
          ee.emit('counter', 'cache_hits', 1);
        } else {
          ee.emit('counter', 'cache_misses', 1);
        }
      } catch (e) {
        // Not JSON or parsing error
      }
    }

    return next();
  },

  // Custom validation function
  validateResponse: function(requestParams, response, context, ee, next) {
    // Basic validation
    if (response.statusCode !== 200) {
      ee.emit('counter', 'http_errors', 1);
      console.log(`HTTP Error ${response.statusCode} for ${requestParams.url}`);
    }

    // Response time validation
    const responseTime = Date.now() - context.vars.requestStartTime;
    if (responseTime > 5000) { // 5 seconds
      ee.emit('counter', 'slow_responses', 1);
    }

    return next();
  }
};
