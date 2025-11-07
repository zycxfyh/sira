/**
 * Sira AI网关 - 语音处理 REST API路由
 * 提供完整的语音转文字和文字转语音接口
 */

const express = require('express')
const multer = require('multer')
const path = require('path')
const { voiceProcessorManager, VOICE_STYLES, LANGUAGE_MAPPING, VOICE_PROVIDERS } = require('../../voice-processor-manager')

const router = express.Router()

// 中间件：异步错误处理
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// 中间件：验证任务ID
const validateJobId = (req, res, next) => {
  const { jobId } = req.params
  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: '缺少任务ID'
    })
  }

  const job = voiceProcessorManager.getJobStatus(jobId)
  if (!job) {
    return res.status(404).json({
      success: false,
      error: '任务不存在'
    })
  }

  req.job = job
  next()
}

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp/uploads') // 使用临时目录
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/mpga',
      'audio/m4a', 'audio/wav', 'audio/webm', 'audio/flac', 'audio/ogg'
    ]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的音频格式'), false)
    }
  }
})

// ==================== 语音转文字 (STT) ====================

/**
 * 上传音频文件并进行语音转文字
 * POST /voice/stt/upload
 */
router.post('/stt/upload', upload.single('audio'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: '没有上传音频文件'
    })
  }

  const {
    userId = 'anonymous',
    provider = 'openai_whisper',
    model = 'whisper-1',
    language = 'auto',
    outputFormat = 'json'
  } = req.body

  try {
    const jobId = await voiceProcessorManager.speechToText({
      userId,
      provider,
      model,
      audioFile: req.file.path,
      language,
      outputFormat
    })

    res.json({
      success: true,
      data: {
        jobId,
        message: '语音转文字任务已创建',
        estimatedWaitTime: '10-30秒'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 使用音频URL进行语音转文字
 * POST /voice/stt/url
 */
router.post('/stt/url', asyncHandler(async (req, res) => {
  const {
    userId = 'anonymous',
    audioUrl,
    provider = 'openai_whisper',
    model = 'whisper-1',
    language = 'auto',
    outputFormat = 'json'
  } = req.body

  if (!audioUrl) {
    return res.status(400).json({
      success: false,
      error: '缺少音频URL'
    })
  }

  try {
    // 这里需要下载音频文件，然后处理
    // 暂时返回模拟响应
    const jobId = await voiceProcessorManager.speechToText({
      userId,
      provider,
      model,
      audioFile: audioUrl, // 实际应该下载到本地
      language,
      outputFormat
    })

    res.json({
      success: true,
      data: {
        jobId,
        message: '语音转文字任务已创建'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

// ==================== 文字转语音 (TTS) ====================

/**
 * 文字转语音
 * POST /voice/tts
 */
router.post('/tts', asyncHandler(async (req, res) => {
  const {
    userId = 'anonymous',
    text,
    provider = 'openai_tts',
    model = 'tts-1',
    voice = 'alloy',
    style = 'natural',
    outputFormat = 'mp3',
    speed = 1.0,
    language = 'zh-CN'
  } = req.body

  if (!text) {
    return res.status(400).json({
      success: false,
      error: '缺少文本内容'
    })
  }

  if (text.length > 4096) {
    return res.status(400).json({
      success: false,
      error: '文本长度不能超过4096字符'
    })
  }

  try {
    const jobId = await voiceProcessorManager.textToSpeech({
      userId,
      provider,
      model,
      text,
      voice,
      style,
      outputFormat,
      speed,
      language
    })

    res.json({
      success: true,
      data: {
        jobId,
        message: '文字转语音任务已创建',
        estimatedWaitTime: '5-15秒'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

// ==================== 任务管理 ====================

/**
 * 获取任务状态
 * GET /voice/job/:jobId
 */
router.get('/job/:jobId', validateJobId, (req, res) => {
  const job = req.job

  res.json({
    success: true,
    data: {
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        provider: job.provider,
        model: job.model,
        outputFormat: job.outputFormat,
        language: job.language,
        voice: job.voice,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        result: job.result,
        error: job.error,
        metadata: job.metadata
      }
    }
  })
})

/**
 * 获取用户任务历史
 * GET /voice/history/:userId
 */
router.get('/history/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params
  const { limit = 20, type } = req.query

  try {
    let jobs = voiceProcessorManager.getUserJobs(userId, parseInt(limit))

    // 按类型过滤
    if (type) {
      jobs = jobs.filter(job => job.type === type)
    }

    res.json({
      success: true,
      data: {
        jobs,
        total: jobs.length
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 取消任务
 * DELETE /voice/job/:jobId
 */
router.delete('/job/:jobId', validateJobId, (req, res) => {
  const job = req.job

  // 检查任务是否可以取消
  if (['completed', 'failed'].includes(job.status)) {
    return res.status(400).json({
      success: false,
      error: '已完成或失败的任务无法取消'
    })
  }

  // 这里应该实现实际的取消逻辑
  // 暂时只返回成功响应

  res.json({
    success: true,
    message: '任务取消请求已提交'
  })
})

// ==================== 系统信息 ====================

/**
 * 获取队列统计
 * GET /voice/stats
 */
router.get('/stats', (req, res) => {
  const stats = voiceProcessorManager.getQueueStats()

  res.json({
    success: true,
    data: {
      stats
    }
  })
})

/**
 * 获取支持的STT提供商
 * GET /voice/stt/providers
 */
router.get('/stt/providers', (req, res) => {
  const providers = voiceProcessorManager.getProviders('stt')

  res.json({
    success: true,
    data: {
      providers
    }
  })
})

/**
 * 获取支持的TTS提供商
 * GET /voice/tts/providers
 */
router.get('/tts/providers', (req, res) => {
  const providers = voiceProcessorManager.getProviders('tts')

  res.json({
    success: true,
    data: {
      providers
    }
  })
})

/**
 * 获取所有支持的提供商
 * GET /voice/providers
 */
router.get('/providers', (req, res) => {
  const providers = voiceProcessorManager.getProviders()

  res.json({
    success: true,
    data: {
      providers
    }
  })
})

/**
 * 获取提供商详细信息
 * GET /voice/providers/:provider
 */
router.get('/providers/:provider', (req, res) => {
  const { provider } = req.params

  const providerConfig = VOICE_PROVIDERS[provider]
  if (!providerConfig) {
    return res.status(404).json({
      success: false,
      error: '提供商不存在'
    })
  }

  res.json({
    success: true,
    data: {
      provider: provider,
      name: providerConfig.name,
      type: providerConfig.type,
      models: providerConfig.models,
      voices: providerConfig.voices || [],
      supportedFormats: providerConfig.supportedFormats || [],
      maxDuration: providerConfig.maxDuration,
      maxTextLength: providerConfig.maxTextLength,
      pricing: providerConfig.pricing
    }
  })
})

/**
 * 获取支持的语音风格
 * GET /voice/styles
 */
router.get('/styles', (req, res) => {
  const styles = voiceProcessorManager.getVoiceStyles()

  res.json({
    success: true,
    data: {
      styles
    }
  })
})

/**
 * 获取支持的语言
 * GET /voice/languages
 */
router.get('/languages', (req, res) => {
  const languages = voiceProcessorManager.getSupportedLanguages()

  res.json({
    success: true,
    data: {
      languages
    }
  })
})

// ==================== 批量操作 ====================

/**
 * 批量语音转文字
 * POST /voice/stt/batch
 */
router.post('/stt/batch', upload.array('audio', 10), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      error: '没有上传音频文件'
    })
  }

  const {
    userId = 'anonymous',
    provider = 'openai_whisper',
    model = 'whisper-1',
    language = 'auto'
  } = req.body

  try {
    const jobIds = []

    for (const file of req.files) {
      const jobId = await voiceProcessorManager.speechToText({
        userId,
        provider,
        model,
        audioFile: file.path,
        language
      })
      jobIds.push(jobId)
    }

    res.json({
      success: true,
      data: {
        jobIds,
        message: `已创建 ${jobIds.length} 个语音转文字任务`
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 批量文字转语音
 * POST /voice/tts/batch
 */
router.post('/tts/batch', asyncHandler(async (req, res) => {
  const {
    userId = 'anonymous',
    texts = [],
    provider = 'openai_tts',
    voice = 'alloy'
  } = req.body

  if (!Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({
      success: false,
      error: '批量请求必须是非空数组'
    })
  }

  if (texts.length > 10) {
    return res.status(400).json({
      success: false,
      error: '批量请求数量不能超过10个'
    })
  }

  try {
    const jobIds = []

    for (const text of texts) {
      if (!text || text.trim().length === 0) continue

      const jobId = await voiceProcessorManager.textToSpeech({
        userId,
        provider,
        text: text.trim(),
        voice
      })
      jobIds.push(jobId)
    }

    res.json({
      success: true,
      data: {
        jobIds,
        message: `已创建 ${jobIds.length} 个文字转语音任务`
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

// ==================== 模板 ====================

/**
 * 获取TTS模板
 * GET /voice/tts/templates
 */
router.get('/tts/templates', (req, res) => {
  const templates = [
    {
      id: 'greeting',
      name: '问候语',
      description: '友好的问候和欢迎语',
      text: '您好！欢迎使用我们的语音服务。我是您的AI助手，很高兴为您服务。',
      category: '通用'
    },
    {
      id: 'announcement',
      name: '公告通知',
      description: '正式的公告或通知',
      text: '尊敬的用户，我们非常高兴地宣布，系统已成功升级到最新版本，带来更好的性能和用户体验。',
      category: '商务'
    },
    {
      id: 'story',
      name: '故事叙述',
      description: '适合讲故事的叙述风格',
      text: '从前，在一个遥远的村庄里，住着一只勇敢的小兔子。它总是充满好奇心，喜欢探索周围的世界。',
      category: '娱乐'
    },
    {
      id: 'tutorial',
      name: '教程指导',
      description: '清晰的教学和指导内容',
      text: '首先，请确保您已经安装了必要的软件。然后，按照以下步骤进行配置。',
      category: '教育'
    },
    {
      id: 'poetry',
      name: '诗歌朗诵',
      description: '富有韵律的诗歌朗诵',
      text: '床前明月光，疑是地上霜。举头望明月，低头思故乡。',
      category: '文艺'
    }
  ]

  res.json({
    success: true,
    data: {
      templates
    }
  })
})

/**
 * 使用模板生成语音
 * POST /voice/tts/from-template
 */
router.post('/tts/from-template', asyncHandler(async (req, res) => {
  const {
    templateId,
    userId = 'anonymous',
    customizations = {}
  } = req.body

  // 获取模板
  const templates = [
    { id: 'greeting', text: '您好！欢迎使用我们的语音服务。' },
    { id: 'announcement', text: '尊敬的用户，我们非常高兴地宣布...' },
    { id: 'story', text: '从前，在一个遥远的村庄里...' }
  ]

  const template = templates.find(t => t.id === templateId)
  if (!template) {
    return res.status(404).json({
      success: false,
      error: '模板不存在'
    })
  }

  // 应用自定义设置
  const generationOptions = {
    userId,
    text: customizations.text || template.text,
    provider: customizations.provider,
    voice: customizations.voice,
    style: customizations.style,
    outputFormat: customizations.outputFormat
  }

  try {
    const jobId = await voiceProcessorManager.textToSpeech(generationOptions)

    res.json({
      success: true,
      data: {
        jobId,
        template: templateId,
        message: '使用模板的文字转语音任务已创建'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

// ==================== 健康检查 ====================

/**
 * 健康检查
 * GET /voice/health
 */
router.get('/health', (req, res) => {
  const stats = voiceProcessorManager.getQueueStats()

  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      queueStats: stats,
      version: '1.0'
    }
  })
})

// 创建上传目录
const fs = require('fs')
const uploadDir = '/tmp/uploads'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

module.exports = router
