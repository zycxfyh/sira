/**
 * Sira AI网关 - 语音处理管理器
 * 统一管理语音转文字(STT)和文字转语音(TTS)功能
 *
 * 支持的模型和服务:
 * - OpenAI Whisper (语音转文字)
 * - OpenAI TTS (文字转语音)
 * - Azure Speech Services
 * - Google Speech-to-Text / Text-to-Speech
 * - AWS Transcribe / Polly
 * - 百度语音
 * - 腾讯云语音
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// 语音处理配置
const VOICE_CONFIG = {
  maxConcurrentJobs: 5,
  maxQueueSize: 50,
  defaultSTTProvider: 'openai_whisper',
  defaultTTSProvider: 'openai_tts',
  defaultSTTModel: 'whisper-1',
  defaultTTSModel: 'tts-1',
  maxAudioDuration: 300, // 5分钟
  maxTextLength: 4096, // TTS最大文本长度
  supportedAudioFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'flac'],
  supportedVoiceFormats: ['mp3', 'opus', 'aac', 'flac']
};

// 支持的语音处理提供商配置
const VOICE_PROVIDERS = {
  openai_whisper: {
    name: 'OpenAI Whisper',
    type: 'stt',
    baseUrl: 'https://api.openai.com/v1/audio/transcriptions',
    models: ['whisper-1'],
    maxDuration: 300,
    supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'flac'],
    pricing: { perMinute: 0.006 }
  },
  openai_tts: {
    name: 'OpenAI TTS',
    type: 'tts',
    baseUrl: 'https://api.openai.com/v1/audio/speech',
    models: ['tts-1', 'tts-1-hd'],
    maxTextLength: 4096,
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
    pricing: { perCharacter: 0.000015 }
  },
  azure_speech: {
    name: 'Azure Speech Services',
    type: 'both',
    baseUrl: 'https://api.cognitive.microsoft.com/sts/v1.0',
    models: ['latest'],
    voices: ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunjianNeural', 'zh-CN-XiaoyiNeural',
             'en-US-ZiraRUS', 'en-US-AriaRUS', 'en-US-ZiraNeural'],
    maxDuration: 300,
    maxTextLength: 10000,
    pricing: { perHour: 1.0, perMillionChars: 15.0 }
  },
  google_speech: {
    name: 'Google Speech-to-Text',
    type: 'stt',
    baseUrl: 'https://speech.googleapis.com/v1/speech:recognize',
    models: ['latest_long', 'latest_short', 'command_and_search', 'phone_call'],
    maxDuration: 480,
    supportedFormats: ['flac', 'wav', 'ogg', 'mp3'],
    pricing: { perHour: 0.024 }
  },
  google_tts: {
    name: 'Google Text-to-Speech',
    type: 'tts',
    baseUrl: 'https://texttospeech.googleapis.com/v1/text:synthesize',
    voices: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR'],
    maxTextLength: 5000,
    supportedFormats: ['mp3', 'wav', 'ogg'],
    pricing: { perMillionChars: 16.0 }
  },
  aws_transcribe: {
    name: 'AWS Transcribe',
    type: 'stt',
    baseUrl: 'https://transcribe.{region}.amazonaws.com',
    models: ['standard', 'enhanced'],
    maxDuration: 14400, // 4小时
    supportedFormats: ['flac', 'm4a', 'mp3', 'mp4', 'ogg', 'webm', 'wav'],
    pricing: { perHour: 0.024 }
  },
  aws_polly: {
    name: 'AWS Polly',
    type: 'tts',
    baseUrl: 'https://polly.{region}.amazonaws.com',
    voices: ['Zhiyu', 'Zhiyu', 'Salli', 'Matthew', 'Joanna', 'Luigi'],
    maxTextLength: 6000,
    supportedFormats: ['mp3', 'ogg', 'pcm'],
    pricing: { perMillionChars: 18.0 }
  }
};

// 语音任务类
class VoiceProcessingJob {
  constructor(options = {}) {
    this.id = crypto.randomUUID();
    this.userId = options.userId || 'anonymous';
    this.type = options.type; // 'stt' 或 'tts'
    this.provider = options.provider;
    this.model = options.model;
    this.input = options.input; // 文件路径或文本
    this.outputFormat = options.outputFormat || 'json';
    this.language = options.language || 'auto';
    this.voice = options.voice; // TTS语音

    // 任务状态
    this.status = 'queued'; // queued, processing, completed, failed
    this.progress = 0;
    this.createdAt = new Date();
    this.startedAt = null;
    this.completedAt = null;
    this.result = null;
    this.error = null;

    // 元数据
    this.metadata = {
      fileSize: 0,
      duration: 0,
      estimatedCost: 0,
      actualCost: 0,
      processingTime: 0,
      retryCount: 0
    };
  }

  // 更新进度
  updateProgress(progress, status = null) {
    this.progress = Math.max(0, Math.min(100, progress));
    if (status) {
      this.status = status;
    }

    if (status === 'processing' && !this.startedAt) {
      this.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      this.completedAt = new Date();
      if (this.startedAt) {
        this.metadata.processingTime = this.completedAt - this.startedAt;
      }
    }
  }

  // 设置结果
  setResult(result, cost = 0) {
    this.result = result;
    this.metadata.actualCost = cost;
    this.updateProgress(100, 'completed');
  }

  // 设置错误
  setError(error) {
    this.error = {
      message: error.message || 'Unknown error',
      code: error.code || 'PROCESSING_FAILED',
      timestamp: new Date()
    };
    this.updateProgress(0, 'failed');
  }

  // 重试
  retry() {
    this.metadata.retryCount++;
    this.status = 'queued';
    this.progress = 0;
    this.error = null;
    this.result = null;
    this.startedAt = null;
    this.completedAt = null;
  }
}

// 语音队列类
class VoiceProcessingQueue {
  constructor(maxConcurrent = VOICE_CONFIG.maxConcurrentJobs) {
    this.queue = [];
    this.processing = new Set();
    this.maxConcurrent = maxConcurrent;
    this.completed = new Map();
  }

  // 添加任务到队列
  enqueue(job) {
    if (this.queue.length >= VOICE_CONFIG.maxQueueSize) {
      throw new Error('Queue is full');
    }
    this.queue.push(job);
    return job.id;
  }

  // 获取下一个待处理任务
  dequeue() {
    if (this.processing.size >= this.maxConcurrent) {
      return null;
    }

    const job = this.queue.find(job => job.status === 'queued');
    if (job) {
      job.updateProgress(0, 'processing');
      this.processing.add(job.id);
    }
    return job;
  }

  // 完成任务
  complete(jobId, result = null, cost = 0) {
    const job = this.getJob(jobId);
    if (job) {
      if (result) {
        job.setResult(result, cost);
      }
      this.processing.delete(jobId);
      this.completed.set(jobId, job);
    }
  }

  // 任务失败
  fail(jobId, error) {
    const job = this.getJob(jobId);
    if (job) {
      job.setError(error);
      this.processing.delete(jobId);
      // 如果重试次数未达到上限，可以重新入队
      if (job.metadata.retryCount < 3) {
        job.retry();
        setTimeout(() => {
          this.queue.unshift(job);
        }, 1000 * (job.metadata.retryCount + 1));
      } else {
        this.completed.set(jobId, job);
      }
    }
  }

  // 获取任务
  getJob(jobId) {
    return this.queue.find(job => job.id === jobId) ||
           Array.from(this.processing).find(job => job.id === jobId) ||
           this.completed.get(jobId);
  }

  // 获取队列状态
  getStats() {
    return {
      queued: this.queue.filter(job => job.status === 'queued').length,
      processing: this.processing.size,
      completed: this.completed.size,
      total: this.queue.length + this.processing.size + this.completed.size
    };
  }
}

// 语音风格预设
const VOICE_STYLES = {
  natural: {
    name: '自然语音',
    description: '自然的、日常对话风格',
    speed: 1.0,
    pitch: 0.0,
    stability: 0.5
  },
  professional: {
    name: '专业播音',
    description: '清晰、专业的主持人风格',
    speed: 0.9,
    pitch: 0.1,
    stability: 0.8
  },
  cheerful: {
    name: '活泼开朗',
    description: '充满活力、积极向上的语气',
    speed: 1.1,
    pitch: 0.2,
    stability: 0.3
  },
  calm: {
    name: '平静舒缓',
    description: '温和、放松的叙述风格',
    speed: 0.8,
    pitch: -0.1,
    stability: 0.9
  },
  dramatic: {
    name: '戏剧化',
    description: '富有表现力、戏剧化的朗读',
    speed: 1.0,
    pitch: 0.3,
    stability: 0.2
  }
};

// 语言映射
const LANGUAGE_MAPPING = {
  'zh': '中文',
  'zh-CN': '中文(普通话)',
  'zh-TW': '中文(台湾)',
  'en': '英语',
  'en-US': '英语(美国)',
  'en-GB': '英语(英国)',
  'ja': '日语',
  'ko': '韩语',
  'fr': '法语',
  'de': '德语',
  'es': '西班牙语',
  'it': '意大利语',
  'pt': '葡萄牙语',
  'ru': '俄语',
  'ar': '阿拉伯语'
};

// 主要语音处理管理器类
class VoiceProcessorManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.queue = new VoiceProcessingQueue();
    this.jobs = new Map();
    this.providers = new Map(Object.entries(VOICE_PROVIDERS));
    this.config = { ...VOICE_CONFIG, ...options };

    // 启动队列处理器
    this.startQueueProcessor();

    log_info('语音处理管理器初始化完成');
  }

  // 语音转文字 (STT)
  async speechToText(options = {}) {
    const {
      userId,
      provider = this.config.defaultSTTProvider,
      model = this.config.defaultSTTModel,
      audioFile,
      language = 'auto',
      outputFormat = 'json'
    } = options;

    // 验证输入
    if (!audioFile) {
      throw new Error('音频文件路径是必需的');
    }

    // 检查文件是否存在
    try {
      const stats = await fs.stat(audioFile);
      if (stats.size === 0) {
        throw new Error('音频文件为空');
      }
    } catch (error) {
      throw new Error(`音频文件不存在或无法访问: ${audioFile}`);
    }

    if (!this.providers.has(provider)) {
      throw new Error(`不支持的提供商: ${provider}`);
    }

    const providerConfig = this.providers.get(provider);
    if (providerConfig.type !== 'stt' && providerConfig.type !== 'both') {
      throw new Error(`提供商 ${provider} 不支持语音转文字`);
    }

    // 创建任务
    const job = new VoiceProcessingJob({
      userId,
      type: 'stt',
      provider,
      model,
      input: audioFile,
      outputFormat,
      language
    });

    // 估算成本
    job.metadata.estimatedCost = this.estimateSTTCost(provider, audioFile);

    // 添加到队列
    this.queue.enqueue(job);
    this.jobs.set(job.id, job);

    this.emit('jobCreated', job);

    log_info(`创建语音转文字任务: ${job.id} - ${provider}/${model}`);

    return job.id;
  }

  // 文字转语音 (TTS)
  async textToSpeech(options = {}) {
    const {
      userId,
      provider = this.config.defaultTTSProvider,
      model = this.config.defaultTTSModel,
      text,
      voice = 'alloy',
      style = 'natural',
      outputFormat = 'mp3',
      speed = 1.0
    } = options;

    // 验证输入
    if (!text || text.trim().length === 0) {
      throw new Error('文本内容是必需的');
    }

    if (text.length > this.config.maxTextLength) {
      throw new Error(`文本长度不能超过 ${this.config.maxTextLength} 字符`);
    }

    if (!this.providers.has(provider)) {
      throw new Error(`不支持的提供商: ${provider}`);
    }

    const providerConfig = this.providers.get(provider);
    if (providerConfig.type !== 'tts' && providerConfig.type !== 'both') {
      throw new Error(`提供商 ${provider} 不支持文字转语音`);
    }

    // 创建任务
    const job = new VoiceProcessingJob({
      userId,
      type: 'tts',
      provider,
      model,
      input: text,
      outputFormat,
      voice,
      style
    });

    // 估算成本
    job.metadata.estimatedCost = this.estimateTTSCost(provider, text.length);

    // 添加到队列
    this.queue.enqueue(job);
    this.jobs.set(job.id, job);

    this.emit('jobCreated', job);

    log_info(`创建文字转语音任务: ${job.id} - ${provider}/${model}`);

    return job.id;
  }

  // 获取任务状态
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      provider: job.provider,
      model: job.model,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      result: job.result,
      error: job.error,
      metadata: job.metadata
    };
  }

  // 获取用户任务历史
  getUserJobs(userId, limit = 20) {
    const userJobs = Array.from(this.jobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => b.createdAt - a.lastActivity)
      .slice(0, limit);

    return userJobs.map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      provider: job.provider,
      model: job.model,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    }));
  }

  // 获取队列统计
  getQueueStats() {
    return {
      ...this.queue.getStats(),
      activeJobs: Array.from(this.jobs.values()).filter(job =>
        ['queued', 'processing'].includes(job.status)
      ).length
    };
  }

  // 获取支持的提供商
  getProviders(type = null) {
    const providers = Array.from(this.providers.entries())
      .filter(([key, config]) => !type || config.type === type || config.type === 'both')
      .map(([key, config]) => ({
        id: key,
        name: config.name,
        type: config.type,
        models: config.models,
        voices: config.voices || [],
        supportedFormats: config.supportedFormats || [],
        maxDuration: config.maxDuration,
        maxTextLength: config.maxTextLength,
        pricing: config.pricing
      }));

    return providers;
  }

  // 获取支持的语音风格
  getVoiceStyles() {
    return Object.entries(VOICE_STYLES).map(([key, config]) => ({
      id: key,
      name: config.name,
      description: config.description,
      speed: config.speed,
      pitch: config.pitch,
      stability: config.stability
    }));
  }

  // 获取支持的语言
  getSupportedLanguages() {
    return Object.entries(LANGUAGE_MAPPING).map(([code, name]) => ({
      code,
      name
    }));
  }

  // 估算STT成本
  estimateSTTCost(provider, audioFile) {
    // 简化的成本估算，实际应该基于音频时长
    const costMap = {
      openai_whisper: 0.006, // 每分钟
      azure_speech: 1.0, // 每小时
      google_speech: 0.024, // 每小时
      aws_transcribe: 0.024 // 每小时
    };

    const costPerMinute = costMap[provider] || 0.01;
    return costPerMinute * 5; // 假设5分钟音频
  }

  // 估算TTS成本
  estimateTTSCost(provider, textLength) {
    const costMap = {
      openai_tts: 0.000015, // 每字符
      azure_speech: 15.0, // 每百万字符
      google_tts: 16.0, // 每百万字符
      aws_polly: 18.0 // 每百万字符
    };

    const costPerChar = costMap[provider] || 0.00002;
    return costPerChar * textLength;
  }

  // 启动队列处理器
  startQueueProcessor() {
    setInterval(() => {
      const job = this.queue.dequeue();
      if (job) {
        this.processJob(job);
      }
    }, 1000);
  }

  // 处理任务 (这里应该调用实际的语音处理API)
  async processJob(job) {
    try {
      log_info(`开始处理语音任务: ${job.id} (${job.type})`);

      // 这里应该调用实际的语音处理API
      // 暂时模拟处理过程
      await this.simulateVoiceProcessing(job);

      // 完成任务
      const mockResult = job.type === 'stt'
        ? { text: '这是模拟的语音转文字结果', confidence: 0.95, language: 'zh-CN' }
        : { audioUrl: `https://example.com/generated/${job.id}/audio.${job.outputFormat}`, duration: 10.5 };

      this.queue.complete(job.id, mockResult, job.metadata.estimatedCost);

      this.emit('jobCompleted', job);

      log_info(`语音任务完成: ${job.id}`);

    } catch (error) {
      log_error(`语音任务失败: ${job.id} - ${error.message}`);
      this.queue.fail(job.id, error);
      this.emit('jobFailed', job);
    }
  }

  // 模拟语音处理 (用于测试)
  async simulateVoiceProcessing(job) {
    const processingTime = job.type === 'stt' ? 3000 + Math.random() * 7000 : 2000 + Math.random() * 3000;

    job.updateProgress(25);
    await new Promise(resolve => setTimeout(resolve, processingTime * 0.3));

    job.updateProgress(50);
    await new Promise(resolve => setTimeout(resolve, processingTime * 0.3));

    job.updateProgress(75);
    await new Promise(resolve => setTimeout(resolve, processingTime * 0.3));

    job.updateProgress(90);
    await new Promise(resolve => setTimeout(resolve, processingTime * 0.1));
  }
}

// 日志函数
function log_info(message) {
  console.log(`[VoiceProcessor] ${new Date().toISOString()} - ${message}`);
}

function log_error(message) {
  console.error(`[VoiceProcessor Error] ${new Date().toISOString()} - ${message}`);
}

// 导出单例实例
const voiceProcessorManager = new VoiceProcessorManager();

module.exports = {
  VoiceProcessorManager,
  VoiceProcessingJob,
  VoiceProcessingQueue,
  voiceProcessorManager,
  VOICE_STYLES,
  LANGUAGE_MAPPING,
  VOICE_PROVIDERS
};
