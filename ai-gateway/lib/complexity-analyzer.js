const crypto = require('crypto')

/**
 * 请求复杂度分析器
 * 借鉴Google Bard、Claude的复杂度分析和OpenRouter的智能路由理念
 * 通过多维度分析请求复杂度，智能选择最合适的AI模型
 */
class ComplexityAnalyzer {
  constructor (options = {}) {
    this.options = {
      maxTokensThreshold: options.maxTokensThreshold || 1000,
      technicalTermsThreshold: options.technicalTermsThreshold || 5,
      reasoningDepthThreshold: options.reasoningDepthThreshold || 3,
      codeSnippetThreshold: options.codeSnippetThreshold || 10,
      mathExpressionThreshold: options.mathExpressionThreshold || 3,
      ...options
    }

    // 技术术语库
    this.technicalTerms = new Set([
      'algorithm', 'function', 'variable', 'class', 'method', 'api', 'database',
      'server', 'client', 'protocol', 'framework', 'library', 'debug', 'compile',
      'optimization', 'architecture', 'design pattern', 'inheritance', 'polymorphism',
      'recursion', 'asynchronous', 'synchronization', 'thread', 'process', 'memory',
      'cache', 'index', 'query', 'transaction', 'authentication', 'authorization',
      'encryption', 'decryption', 'hash', 'signature', 'certificate', 'token',
      'microservice', 'container', 'orchestration', 'kubernetes', 'docker', 'ci/cd',
      'agile', 'scrum', 'kanban', 'refactor', 'testing', 'unit test', 'integration test',
      'deployment', 'monitoring', 'logging', 'tracing', 'metrics', 'alert', 'dashboard'
    ])

    // 推理深度关键词
    this.reasoningKeywords = [
      'analyze', 'evaluate', 'compare', 'contrast', 'explain why', 'justify',
      'critique', 'assess', 'determine', 'conclude', 'therefore', 'because',
      'however', 'although', 'nevertheless', 'consequently', 'furthermore',
      'moreover', 'in conclusion', 'to summarize', 'on the other hand'
    ]

    // 代码模式
    this.codePatterns = [
      /```[\s\S]*?```/g, // 代码块
      /`[^`]+`/g, // 内联代码
      /\b(function|class|def|public|private|protected)\b/g, // 编程关键词
      /\b(import|from|include|require)\b/g, // 导入语句
      /\b(if|else|for|while|do|switch|case)\b/g, // 控制流
      /\b(int|string|bool|float|double|char)\b/g, // 数据类型
      /[{}();[\]]/g, // 编程符号
      /\bSELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER\b/g, // SQL关键词
      /<\w+[^>]*>[\s\S]*?<\/\w+>/g, // HTML/XML标签
      /@\w+/g, // 装饰器/注解
      /#[a-fA-F0-9]{3,6}\b/g // 颜色代码
    ]

    // 数学表达式模式
    this.mathPatterns = [
      /\b\d+\s*[+\-*/]\s*\d+/g, // 基础运算
      /\b\d+\s*\^\s*\d+/g, // 幂运算
      /\bsqrt\(|sin\(|cos\(|tan\(|log\(|ln\(/g, // 数学函数
      /\b∫|∂|∑|∏|∞|≤|≥|≠|≈\b/g, // 数学符号
      /\b\d+\.\d+|\b\d+\/\d+\b/g, // 小数和分数
      /\b[a-zA-Z]\s*=\s*[^=]/g, // 变量赋值
      /\bequation|formula|calculate|compute|derive/g // 数学关键词
    ]

    // 任务类型识别模式
    this.taskPatterns = {
      coding: [
        /\b(code|programming|debug|compile|syntax|algorithm)\b/i,
        /\b(java|python|javascript|c\+\+|go|rust|php)\b/i,
        /\b(function|class|method|variable|loop|array)\b/i
      ],
      math: [
        /\b(math|mathematics|calculate|equation|formula|algebra)\b/i,
        /\b(geometry|calculus|statistics|probability|theorem)\b/i,
        /\b(prove|solve|integrate|differentiate|factor)\b/i
      ],
      creative: [
        /\b(write|create|design|story|poem|art|music)\b/i,
        /\b(imagine|fantasy|fiction|novel|character|plot)\b/i,
        /\b(creative|innovative|original|inspired|vision)\b/i
      ],
      analytical: [
        /\b(analyze|evaluate|assess|review|critique|compare)\b/i,
        /\b(data|research|study|investigation|evidence|conclusion)\b/i,
        /\b(trend|pattern|correlation|causation|impact)\b/i
      ],
      conversational: [
        /\b(hello|hi|how are you|thank you|please|help)\b/i,
        /\b(chat|talk|conversation|dialogue|discussion)\b/i,
        /\b(friendly|casual|informal|polite|courteous)\b/i
      ]
    }

    // 情感分析关键词
    this.sentimentKeywords = {
      urgent: ['urgent', 'emergency', 'asap', 'immediately', 'critical', 'deadline'],
      complex: ['complex', 'complicated', 'sophisticated', 'advanced', 'detailed'],
      simple: ['simple', 'basic', 'easy', 'straightforward', 'clear']
    }
  }

  /**
   * 分析请求复杂度
   */
  analyzeComplexity (request) {
    const analysis = {
      complexity: 'low',
      confidence: 0,
      factors: {},
      reasoning: [],
      taskType: 'general',
      estimatedTokens: 0,
      processingTime: 'fast',
      recommendedModels: [],
      metrics: {}
    }

    try {
      // 提取请求内容
      const content = this.extractContent(request)
      if (!content) {
        analysis.complexity = 'low'
        analysis.reasoning.push('Empty or invalid request content')
        return analysis
      }

      analysis.metrics.contentLength = content.length
      analysis.estimatedTokens = this.estimateTokens(content)

      // 分析各个复杂度维度
      const dimensions = {
        length: this.analyzeLengthComplexity(content),
        technical: this.analyzeTechnicalComplexity(content),
        reasoning: this.analyzeReasoningComplexity(content),
        code: this.analyzeCodeComplexity(content),
        math: this.analyzeMathComplexity(content),
        structure: this.analyzeStructuralComplexity(content),
        context: this.analyzeContextComplexity(request),
        urgency: this.analyzeUrgencyComplexity(content)
      }

      analysis.factors = dimensions

      // 识别任务类型
      analysis.taskType = this.identifyTaskType(content)

      // 计算综合复杂度
      const complexityScore = this.calculateComplexityScore(dimensions, analysis.taskType)

      analysis.complexity = this.classifyComplexity(complexityScore)
      analysis.confidence = this.calculateConfidence(dimensions)

      // 确定处理时间
      analysis.processingTime = this.determineProcessingTime(analysis.complexity, analysis.taskType)

      // 推荐模型
      analysis.recommendedModels = this.recommendModels(analysis.complexity, analysis.taskType, dimensions)

      // 生成推理说明
      analysis.reasoning = this.generateReasoning(analysis, dimensions)
    } catch (error) {
      console.error('Complexity analysis failed:', error)
      analysis.complexity = 'medium' // 出错时使用中等复杂度作为fallback
      analysis.reasoning.push(`Analysis error: ${error.message}`)
    }

    return analysis
  }

  /**
   * 提取请求内容
   */
  extractContent (request) {
    // 从不同格式的请求中提取内容
    if (typeof request === 'string') {
      return request
    }

    if (request.messages && Array.isArray(request.messages)) {
      // ChatGPT格式
      const lastMessage = request.messages[request.messages.length - 1]
      return lastMessage ? lastMessage.content || '' : ''
    }

    if (request.prompt) {
      return request.prompt
    }

    if (request.text) {
      return request.text
    }

    return ''
  }

  /**
   * 估算token数量
   */
  estimateTokens (text) {
    // 简单估算：英文大约1个token对应4个字符，中文大约1个token对应1.5个字符
    const englishChars = (text.match(/[a-zA-Z\s]/g) || []).length
    const otherChars = text.length - englishChars

    const englishTokens = Math.ceil(englishChars / 4)
    const otherTokens = Math.ceil(otherChars / 1.5)

    return englishTokens + otherTokens
  }

  /**
   * 分析长度复杂度
   */
  analyzeLengthComplexity (content) {
    const length = content.length
    const wordCount = content.split(/\s+/).length
    const sentenceCount = content.split(/[.!?]+/).length

    let score = 0
    const reasoning = []

    if (length > 5000) {
      score += 3
      reasoning.push('Very long content (>5000 chars)')
    } else if (length > 2000) {
      score += 2
      reasoning.push('Long content (2000-5000 chars)')
    } else if (length > 500) {
      score += 1
      reasoning.push('Medium content (500-2000 chars)')
    } else {
      reasoning.push('Short content (<500 chars)')
    }

    if (wordCount > 1000) {
      score += 2
      reasoning.push('High word count (>1000)')
    } else if (wordCount > 500) {
      score += 1
      reasoning.push('Medium word count (500-1000)')
    }

    return { score, reasoning, metrics: { length, wordCount, sentenceCount } }
  }

  /**
   * 分析技术复杂度
   */
  analyzeTechnicalComplexity (content) {
    const lowerContent = content.toLowerCase()
    let technicalTermCount = 0

    for (const term of this.technicalTerms) {
      const matches = (lowerContent.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length
      technicalTermCount += matches
    }

    let score = 0
    const reasoning = []

    if (technicalTermCount > this.options.technicalTermsThreshold * 2) {
      score += 3
      reasoning.push(`Very technical (${technicalTermCount} technical terms)`)
    } else if (technicalTermCount > this.options.technicalTermsThreshold) {
      score += 2
      reasoning.push(`Technical content (${technicalTermCount} technical terms)`)
    } else if (technicalTermCount > this.options.technicalTermsThreshold / 2) {
      score += 1
      reasoning.push(`Some technical terms (${technicalTermCount})`)
    } else {
      reasoning.push('Non-technical content')
    }

    return { score, reasoning, metrics: { technicalTermCount } }
  }

  /**
   * 分析推理复杂度
   */
  analyzeReasoningComplexity (content) {
    const lowerContent = content.toLowerCase()
    let reasoningIndicatorCount = 0

    for (const keyword of this.reasoningKeywords) {
      const matches = (lowerContent.match(new RegExp(keyword, 'gi')) || []).length
      reasoningIndicatorCount += matches
    }

    // 检查问题类型
    const questionPatterns = [
      /\b(why|how|what if|explain|analyze|evaluate)\b/gi,
      /\b(what are the|how does|why is|what would)\b/gi,
      /\b(compare|contrast|versus|vs\.?|difference between)\b/gi
    ]

    let questionCount = 0
    for (const pattern of questionPatterns) {
      questionCount += (content.match(pattern) || []).length
    }

    const totalIndicators = reasoningIndicatorCount + questionCount

    let score = 0
    const reasoning = []

    if (totalIndicators > 5) {
      score += 3
      reasoning.push(`High reasoning complexity (${totalIndicators} indicators)`)
    } else if (totalIndicators > 2) {
      score += 2
      reasoning.push(`Medium reasoning complexity (${totalIndicators} indicators)`)
    } else if (totalIndicators > 0) {
      score += 1
      reasoning.push(`Some reasoning elements (${totalIndicators} indicators)`)
    } else {
      reasoning.push('Straightforward request')
    }

    return { score, reasoning, metrics: { reasoningIndicatorCount, questionCount } }
  }

  /**
   * 分析代码复杂度
   */
  analyzeCodeComplexity (content) {
    let codeScore = 0
    let codeSnippetCount = 0

    for (const pattern of this.codePatterns) {
      const matches = content.match(pattern)
      if (matches) {
        codeSnippetCount += matches.length
        codeScore += matches.length
      }
    }

    // 检查是否包含完整代码块
    const codeBlocks = content.match(/```[\s\S]*?```/g)
    if (codeBlocks) {
      codeScore += codeBlocks.length * 2 // 代码块权重更高
      codeSnippetCount += codeBlocks.length
    }

    let score = 0
    const reasoning = []

    if (codeSnippetCount > this.options.codeSnippetThreshold) {
      score += 3
      reasoning.push(`High code complexity (${codeSnippetCount} code elements)`)
    } else if (codeSnippetCount > this.options.codeSnippetThreshold / 2) {
      score += 2
      reasoning.push(`Medium code complexity (${codeSnippetCount} code elements)`)
    } else if (codeSnippetCount > 0) {
      score += 1
      reasoning.push(`Some code elements (${codeSnippetCount})`)
    } else {
      reasoning.push('No code content')
    }

    return { score, reasoning, metrics: { codeSnippetCount, codeScore } }
  }

  /**
   * 分析数学复杂度
   */
  analyzeMathComplexity (content) {
    let mathScore = 0
    let mathElementCount = 0

    for (const pattern of this.mathPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        mathElementCount += matches.length
        mathScore += matches.length
      }
    }

    // 检查方程式和公式
    const equations = content.match(/[^\n]*=.*[^\n]*/g)
    if (equations) {
      for (const eq of equations) {
        if (eq.includes('=') && (eq.match(/[+\-*/^√∫∂∑∏]/g) || []).length > 1) {
          mathScore += 2
          mathElementCount++
        }
      }
    }

    let score = 0
    const reasoning = []

    if (mathElementCount > this.options.mathExpressionThreshold * 2) {
      score += 3
      reasoning.push(`High mathematical complexity (${mathElementCount} math elements)`)
    } else if (mathElementCount > this.options.mathExpressionThreshold) {
      score += 2
      reasoning.push(`Medium mathematical complexity (${mathElementCount} math elements)`)
    } else if (mathElementCount > 0) {
      score += 1
      reasoning.push(`Some mathematical content (${mathElementCount} elements)`)
    } else {
      reasoning.push('No mathematical content')
    }

    return { score, reasoning, metrics: { mathElementCount, mathScore } }
  }

  /**
   * 分析结构复杂度
   */
  analyzeStructuralComplexity (content) {
    // 检查列表和结构化内容
    const bulletPoints = (content.match(/^[\s]*[-*+]\s/gm) || []).length
    const numberedLists = (content.match(/^[\s]*\d+\.\s/gm) || []).length
    const headers = (content.match(/^#{1,6}\s/gm) || []).length
    const tables = (content.match(/\|.*\|.*\|/g) || []).length

    const structuralElements = bulletPoints + numberedLists + headers + tables

    let score = 0
    const reasoning = []

    if (structuralElements > 10) {
      score += 2
      reasoning.push(`Highly structured content (${structuralElements} elements)`)
    } else if (structuralElements > 5) {
      score += 1
      reasoning.push(`Structured content (${structuralElements} elements)`)
    } else {
      reasoning.push('Unstructured or simple content')
    }

    return {
      score,
      reasoning,
      metrics: { bulletPoints, numberedLists, headers, tables, structuralElements }
    }
  }

  /**
   * 分析上下文复杂度
   */
  analyzeContextComplexity (request) {
    let score = 0
    const reasoning = []

    // 检查消息历史长度
    if (request.messages && request.messages.length > 10) {
      score += 2
      reasoning.push('Long conversation history')
    } else if (request.messages && request.messages.length > 5) {
      score += 1
      reasoning.push('Medium conversation history')
    }

    // 检查系统提示
    if (request.system || (request.messages && request.messages[0]?.role === 'system')) {
      score += 1
      reasoning.push('System instructions present')
    }

    return { score, reasoning, metrics: { messageCount: request.messages?.length || 0 } }
  }

  /**
   * 分析紧急程度
   */
  analyzeUrgencyComplexity (content) {
    const lowerContent = content.toLowerCase()
    let urgencyScore = 0

    for (const word of this.sentimentKeywords.urgent) {
      if (lowerContent.includes(word)) {
        urgencyScore++
      }
    }

    let score = 0
    const reasoning = []

    if (urgencyScore > 2) {
      score += 2
      reasoning.push('High urgency indicators')
    } else if (urgencyScore > 0) {
      score += 1
      reasoning.push('Some urgency indicators')
    } else {
      reasoning.push('Normal priority')
    }

    return { score, reasoning, metrics: { urgencyScore } }
  }

  /**
   * 识别任务类型
   */
  identifyTaskType (content) {
    const lowerContent = content.toLowerCase()
    const scores = {}

    for (const [taskType, patterns] of Object.entries(this.taskPatterns)) {
      let score = 0
      for (const pattern of patterns) {
        const matches = (lowerContent.match(pattern) || []).length
        score += matches
      }
      scores[taskType] = score
    }

    // 找到最高分的任务类型
    let maxScore = 0
    let bestTask = 'general'

    for (const [task, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score
        bestTask = task
      }
    }

    return bestTask
  }

  /**
   * 计算综合复杂度分数
   */
  calculateComplexityScore (dimensions, taskType) {
    let totalScore = 0
    const weights = {
      length: 0.2,
      technical: 0.25,
      reasoning: 0.25,
      code: 0.3,
      math: 0.3,
      structure: 0.1,
      context: 0.15,
      urgency: 0.1
    }

    // 任务类型权重调整
    const taskWeights = {
      coding: { code: 0.4, technical: 0.3, reasoning: 0.2 },
      math: { math: 0.4, reasoning: 0.3, technical: 0.2 },
      analytical: { reasoning: 0.35, technical: 0.25, length: 0.25 },
      creative: { length: 0.3, reasoning: 0.2, structure: 0.2 },
      conversational: { length: 0.1, reasoning: 0.1, context: 0.3 }
    }

    const activeWeights = taskWeights[taskType] || weights

    for (const [dimension, data] of Object.entries(dimensions)) {
      const weight = activeWeights[dimension] || weights[dimension] || 0.1
      totalScore += data.score * weight
    }

    return totalScore
  }

  /**
   * 分类复杂度等级
   */
  classifyComplexity (score) {
    if (score >= 4.0) return 'very_high'
    if (score >= 2.5) return 'high'
    if (score >= 1.5) return 'medium'
    if (score >= 0.8) return 'low_medium'
    return 'low'
  }

  /**
   * 计算置信度
   */
  calculateConfidence (dimensions) {
    // 基于各维度的分析一致性计算置信度
    const scores = Object.values(dimensions).map(d => d.score)
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length
    const stdDev = Math.sqrt(variance)

    // 低方差表示分析结果一致，置信度高
    const confidence = Math.max(0, Math.min(1, 1 - (stdDev / mean)))

    return Math.round(confidence * 100) / 100
  }

  /**
   * 确定处理时间
   */
  determineProcessingTime (complexity, taskType) {
    const timeMap = {
      very_high: 'slow',
      high: 'medium',
      medium: 'medium',
      low_medium: 'fast',
      low: 'fast'
    }

    // 某些任务类型需要额外时间
    if (taskType === 'coding' && ['high', 'very_high'].includes(complexity)) {
      return 'slow'
    }

    if (taskType === 'math' && complexity === 'very_high') {
      return 'slow'
    }

    return timeMap[complexity] || 'medium'
  }

  /**
   * 推荐模型
   */
  recommendModels (complexity, taskType, dimensions) {
    const recommendations = []

    // 基于复杂度推荐模型
    switch (complexity) {
      case 'very_high':
        recommendations.push('gpt-4', 'claude-2')
        break
      case 'high':
        recommendations.push('gpt-4', 'claude-2', 'gpt-3.5-turbo')
        break
      case 'medium':
        recommendations.push('gpt-3.5-turbo', 'claude-2', 'gemini-pro')
        break
      case 'low_medium':
        recommendations.push('gpt-3.5-turbo', 'gemini-pro', 'claude-instant')
        break
      case 'low':
        recommendations.push('gpt-3.5-turbo', 'claude-instant', 'gemini-pro')
        break
    }

    // 任务类型特定的模型偏好
    const taskPreferences = {
      coding: ['gpt-4', 'claude-2', 'gpt-3.5-turbo'],
      math: ['gpt-4', 'claude-2', 'gpt-3.5-turbo'],
      creative: ['claude-2', 'gpt-4', 'gemini-pro'],
      analytical: ['gpt-4', 'claude-2', 'gpt-3.5-turbo'],
      conversational: ['gpt-3.5-turbo', 'claude-instant', 'gemini-pro']
    }

    if (taskPreferences[taskType]) {
      // 将任务偏好模型排在前面
      const preferred = taskPreferences[taskType]
      recommendations.sort((a, b) => {
        const aPreferred = preferred.includes(a) ? preferred.indexOf(a) : 999
        const bPreferred = preferred.includes(b) ? preferred.indexOf(b) : 999
        return aPreferred - bPreferred
      })
    }

    return [...new Set(recommendations)] // 去重
  }

  /**
   * 生成推理说明
   */
  generateReasoning (analysis, dimensions) {
    const reasoning = []

    reasoning.push(`综合复杂度: ${analysis.complexity} (置信度: ${analysis.confidence})`)
    reasoning.push(`任务类型: ${analysis.taskType}`)
    reasoning.push(`预估tokens: ${analysis.estimatedTokens}`)
    reasoning.push(`处理时间: ${analysis.processingTime}`)

    // 添加各维度的推理
    for (const [dimension, data] of Object.entries(dimensions)) {
      if (data.reasoning && data.reasoning.length > 0) {
        reasoning.push(`${dimension}: ${data.reasoning.join(', ')}`)
      }
    }

    if (analysis.recommendedModels.length > 0) {
      reasoning.push(`推荐模型: ${analysis.recommendedModels.join(', ')}`)
    }

    return reasoning
  }

  /**
   * 批量分析请求
   */
  analyzeBatch (requests) {
    const results = []

    for (const request of requests) {
      try {
        const analysis = this.analyzeComplexity(request)
        results.push({
          requestId: request.id || crypto.randomUUID(),
          analysis,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        results.push({
          requestId: request.id || crypto.randomUUID(),
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    return results
  }
}

module.exports = { ComplexityAnalyzer }
