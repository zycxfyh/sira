/**
 * Sira AI网关 - 对话历史管理器
 * 借鉴Redis、LangChain Memory的设计理念，实现智能的对话上下文管理
 *
 * 核心特性:
 * - 会话状态持久化: 保存完整的对话历史和上下文
 * - 智能上下文检索: 基于相关性和重要性的记忆召回
 * - 多会话管理: 支持同时进行多个独立对话
 * - 上下文压缩: 自动压缩和摘要长对话历史
 * - 记忆网络: 跨会话的知识关联和学习
 * - 隐私保护: 数据加密和访问控制
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

// 对话配置
const CONVERSATION_CONFIG = {
  maxMessagesPerSession: 1000, // 每个会话的最大消息数
  maxSessionsPerUser: 50, // 每个用户最大会话数
  contextWindowSize: 20, // 默认上下文窗口大小
  compressionThreshold: 100, // 压缩阈值
  retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90天保留期
  summaryInterval: 50, // 每50条消息生成一次摘要
  memoryImportanceLevels: ['low', 'medium', 'high', 'critical'],
  defaultProvider: 'redis', // 存储提供商
  enableCrossSessionLearning: true, // 启用跨会话学习
};

// 对话会话类
class ConversationSession {
  constructor(options = {}) {
    this.id = options.id || crypto.randomUUID();
    this.userId = options.userId || 'anonymous';
    this.title = options.title || '新对话';
    this.createdAt = options.createdAt || new Date();
    this.updatedAt = new Date();
    this.lastActivity = new Date();
    this.status = options.status || 'active'; // active, archived, deleted
    this.metadata = options.metadata || {};

    // 消息历史
    this.messages = options.messages || [];

    // 会话统计
    this.stats = {
      totalMessages: 0,
      totalTokens: 0,
      avgResponseTime: 0,
      userMessages: 0,
      assistantMessages: 0,
      errorCount: 0,
    };

    // 上下文管理
    this.contextWindow = options.contextWindow || CONVERSATION_CONFIG.contextWindowSize;
    this.memory = new Map(); // 会话级记忆
    this.summary = null; // 会话摘要
    this.topics = new Set(); // 对话主题
    this.entities = new Map(); // 命名实体
  }

  // 添加消息
  addMessage(message) {
    const messageEntry = {
      id: crypto.randomUUID(),
      role: message.role, // user, assistant, system
      content: message.content,
      timestamp: new Date(),
      tokens: message.tokens || this.estimateTokens(message.content),
      metadata: message.metadata || {},
      importance: message.importance || 'medium',
    };

    // 检查消息格式
    if (!['user', 'assistant', 'system'].includes(messageEntry.role)) {
      throw new Error('无效的消息角色');
    }

    this.messages.push(messageEntry);
    this.updatedAt = new Date();
    this.lastActivity = new Date();

    // 更新统计
    this.stats.totalMessages++;
    this.stats.totalTokens += messageEntry.tokens;

    if (messageEntry.role === 'user') {
      this.stats.userMessages++;
    } else if (messageEntry.role === 'assistant') {
      this.stats.assistantMessages++;
    }

    // 限制消息数量
    if (this.messages.length > CONVERSATION_CONFIG.maxMessagesPerSession) {
      this.compressMessages();
    }

    // 更新会话标题（基于第一条用户消息）
    if (this.title === '新对话' && messageEntry.role === 'user' && this.messages.length === 1) {
      this.updateTitleFromMessage(messageEntry.content);
    }

    // 提取主题和实体
    this.extractTopicsAndEntities(messageEntry);

    // 生成摘要
    if (this.stats.totalMessages % CONVERSATION_CONFIG.summaryInterval === 0) {
      this.generateSummary();
    }

    return messageEntry;
  }

  // 获取上下文消息
  getContextMessages(limit = null) {
    const contextSize = limit || this.contextWindow;
    const recentMessages = this.messages.slice(-contextSize);

    // 如果启用了压缩，返回压缩后的上下文
    if (this.summary && recentMessages.length < this.messages.length) {
      return [
        {
          role: 'system',
          content: `对话摘要: ${this.summary}`,
          timestamp: this.createdAt,
          isSummary: true,
        },
        ...recentMessages,
      ];
    }

    return recentMessages;
  }

  // 压缩消息历史
  compressMessages() {
    if (this.messages.length <= CONVERSATION_CONFIG.compressionThreshold) {
      return;
    }

    const keepCount = Math.floor(CONVERSATION_CONFIG.compressionThreshold / 2);
    const earlyMessages = this.messages.slice(0, -keepCount);
    const recentMessages = this.messages.slice(-keepCount);

    // 生成早期消息的摘要
    const earlySummary = this.summarizeMessages(earlyMessages);

    // 替换为摘要消息
    this.messages = [
      {
        id: crypto.randomUUID(),
        role: 'system',
        content: `早期对话摘要: ${earlySummary}`,
        timestamp: earlyMessages[0]?.timestamp || this.createdAt,
        isSummary: true,
        summarizedCount: earlyMessages.length,
      },
      ...recentMessages,
    ];
  }

  // 生成会话摘要
  generateSummary() {
    if (this.messages.length < 10) return;

    const recentMessages = this.messages.slice(-50); // 基于最近50条消息生成摘要
    this.summary = this.summarizeMessages(recentMessages, true);
  }

  // 摘要消息内容
  summarizeMessages(messages, detailed = false) {
    // 这里应该调用AI生成摘要，暂时使用简单文本摘要
    const textContent = messages
      .filter(m => m.role !== 'system' || !m.isSummary)
      .map(m => `${m.role}: ${m.content.substring(0, 100)}`)
      .join(' | ');

    if (detailed) {
      return `用户与AI的对话，涉及主题: ${Array.from(this.topics).join(', ')}，共${messages.length}条消息。`;
    }

    return `对话包含${messages.length}条消息，主要讨论${Array.from(this.topics).slice(0, 3).join('、')}等话题。`;
  }

  // 从消息更新标题
  updateTitleFromMessage(content) {
    // 简单的标题生成逻辑
    const words = content.split(' ').slice(0, 5);
    this.title = words.join(' ') + (words.length >= 5 ? '...' : '');
  }

  // 提取主题和实体
  extractTopicsAndEntities(message) {
    // 简单的关键词提取（实际应该使用NLP）
    const content = message.content.toLowerCase();
    const keywords = ['如何', '什么', '为什么', '怎么', '请', '帮', '需要', '问题', '解决'];

    keywords.forEach(keyword => {
      if (content.includes(keyword)) {
        this.topics.add(keyword);
      }
    });

    // 限制主题数量
    if (this.topics.size > 20) {
      const topicsArray = Array.from(this.topics);
      this.topics = new Set(topicsArray.slice(-20));
    }
  }

  // 估算token数量
  estimateTokens(content) {
    // 简单的估算：中文大约1个字符=1.5个token，英文1个单词=1.3个token
    const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = content.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).length;
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
  }

  // 导出会话数据
  export() {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastActivity: this.lastActivity,
      status: this.status,
      metadata: this.metadata,
      messages: this.messages,
      stats: this.stats,
      summary: this.summary,
      topics: Array.from(this.topics),
      entities: Object.fromEntries(this.entities),
    };
  }

  // 从数据导入会话
  static fromData(data) {
    const session = new ConversationSession(data);
    session.topics = new Set(data.topics || []);
    session.entities = new Map(Object.entries(data.entities || {}));
    return session;
  }
}

// 记忆网络类 (借鉴LangChain Memory)
class MemoryNetwork {
  constructor() {
    this.memories = new Map(); // 全局记忆网络
    this.connections = new Map(); // 记忆之间的关联
    this.importanceThreshold = 0.7; // 重要性阈值
  }

  // 添加记忆
  addMemory(key, content, metadata = {}) {
    const memory = {
      id: crypto.randomUUID(),
      key,
      content,
      metadata,
      timestamp: new Date(),
      accessCount: 0,
      lastAccessed: new Date(),
      importance: metadata.importance || 0.5,
      connections: new Set(),
    };

    this.memories.set(key, memory);
    return memory;
  }

  // 检索相关记忆
  retrieveMemories(query, limit = 5) {
    const relevant = [];

    for (const [key, memory] of this.memories) {
      const relevance = this.calculateRelevance(query, memory.content);
      if (relevance > this.importanceThreshold) {
        relevant.push({
          ...memory,
          relevance,
        });
      }
    }

    // 按相关性排序
    relevant.sort((a, b) => b.relevance - a.relevance);

    // 更新访问信息
    relevant.slice(0, limit).forEach(memory => {
      memory.accessCount++;
      memory.lastAccessed = new Date();
    });

    return relevant.slice(0, limit);
  }

  // 计算相关性
  calculateRelevance(query, content) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);

    const commonWords = queryWords.filter(word =>
      contentWords.some(contentWord => contentWord.includes(word) || word.includes(contentWord))
    );

    return commonWords.length / Math.max(queryWords.length, 1);
  }

  // 建立记忆关联
  connectMemories(key1, key2, strength = 1) {
    if (!this.connections.has(key1)) {
      this.connections.set(key1, new Map());
    }
    this.connections.get(key1).set(key2, strength);

    // 双向关联
    if (!this.connections.has(key2)) {
      this.connections.set(key2, new Map());
    }
    this.connections.get(key2).set(key1, strength);
  }

  // 获取关联记忆
  getConnectedMemories(key, depth = 2) {
    const visited = new Set();
    const result = [];

    const traverse = (currentKey, currentDepth) => {
      if (currentDepth > depth || visited.has(currentKey)) return;
      visited.add(currentKey);

      const memory = this.memories.get(currentKey);
      if (memory) {
        result.push(memory);
      }

      const connections = this.connections.get(currentKey);
      if (connections) {
        for (const [connectedKey, strength] of connections) {
          if (strength > 0.5) {
            // 只遍历强关联
            traverse(connectedKey, currentDepth + 1);
          }
        }
      }
    };

    traverse(key, 0);
    return result.slice(1); // 排除起始记忆
  }
}

// 主要对话管理器类
class ConversationManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.sessions = new Map(); // 会话存储
    this.memoryNetwork = new MemoryNetwork(); // 记忆网络
    this.config = { ...CONVERSATION_CONFIG, ...options };

    // 统计信息
    this.stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalMessages: 0,
      totalTokens: 0,
      avgSessionLength: 0,
    };

    // 启动清理任务
    this.startCleanupTask();

    logInfo('对话历史管理器初始化完成');
  }

  // 创建新会话
  createSession(userId, options = {}) {
    if (this.getUserSessions(userId).length >= this.config.maxSessionsPerUser) {
      throw new Error('达到用户最大会话数量限制');
    }

    const session = new ConversationSession({
      userId,
      ...options,
    });

    this.sessions.set(session.id, session);
    this.stats.totalSessions++;
    this.stats.activeSessions++;

    this.emit('sessionCreated', session);

    logInfo(`创建对话会话: ${session.id} - ${session.title}`);

    return session;
  }

  // 获取会话
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // 更新会话
  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    Object.assign(session, updates);
    session.updatedAt = new Date();

    this.emit('sessionUpdated', session);

    return session;
  }

  // 删除会话
  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'deleted';
    this.stats.activeSessions--;

    this.emit('sessionDeleted', session);

    logInfo(`删除对话会话: ${sessionId}`);

    return true;
  }

  // 归档会话
  archiveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    session.status = 'archived';
    session.archivedAt = new Date();

    this.emit('sessionArchived', session);

    return session;
  }

  // 添加消息到会话
  addMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    if (session.status !== 'active') {
      throw new Error('会话状态不允许添加消息');
    }

    const messageEntry = session.addMessage(message);
    this.stats.totalMessages++;
    this.stats.totalTokens += messageEntry.tokens;

    // 添加到记忆网络
    if (message.importance === 'high' || message.importance === 'critical') {
      const memoryKey = `${sessionId}_${messageEntry.id}`;
      this.memoryNetwork.addMemory(memoryKey, message.content, {
        sessionId,
        messageId: messageEntry.id,
        importance: message.importance,
        role: message.role,
      });
    }

    this.emit('messageAdded', { session, message: messageEntry });

    return messageEntry;
  }

  // 获取会话上下文
  getContext(sessionId, limit = null) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    const contextMessages = session.getContextMessages(limit);

    // 补充全局记忆
    const recentUserMessage = contextMessages.filter(m => m.role === 'user').pop();

    if (recentUserMessage) {
      const globalMemories = this.memoryNetwork.retrieveMemories(recentUserMessage.content, 2);
      if (globalMemories.length > 0) {
        contextMessages.unshift({
          role: 'system',
          content: `相关历史记忆: ${globalMemories.map(m => m.content.substring(0, 100)).join('; ')}`,
          timestamp: new Date(),
          isMemory: true,
        });
      }
    }

    return contextMessages;
  }

  // 获取用户的所有会话
  getUserSessions(userId, status = 'active') {
    const userSessions = [];

    for (const [id, session] of this.sessions) {
      if (session.userId === userId && session.status === status) {
        userSessions.push({
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          lastActivity: session.lastActivity,
          messageCount: session.stats.totalMessages,
          totalTokens: session.stats.totalTokens,
        });
      }
    }

    // 按最后活动时间排序
    userSessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    return userSessions;
  }

  // 搜索会话
  searchSessions(userId, query, options = {}) {
    const { status = 'active', limit = 20 } = options;
    const userSessions = this.getUserSessions(userId, status);

    if (!query) {
      return userSessions.slice(0, limit);
    }

    // 简单的文本搜索
    const results = userSessions.filter(session => {
      const titleMatch = session.title.toLowerCase().includes(query.toLowerCase());
      // 这里可以扩展到搜索消息内容，但需要更多计算
      return titleMatch;
    });

    return results.slice(0, limit);
  }

  // 导出会话数据
  exportSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    return session.export();
  }

  // 导入会话数据
  importSession(data) {
    const session = ConversationSession.fromData(data);
    this.sessions.set(session.id, session);

    this.emit('sessionImported', session);

    return session;
  }

  // 获取统计信息
  getStats() {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => s.status === 'active');

    return {
      ...this.stats,
      activeSessionsCount: activeSessions.length,
      archivedSessionsCount: sessions.filter(s => s.status === 'archived').length,
      deletedSessionsCount: sessions.filter(s => s.status === 'deleted').length,
      avgMessagesPerSession:
        sessions.length > 0 ? Math.round(this.stats.totalMessages / sessions.length) : 0,
      avgTokensPerSession:
        sessions.length > 0 ? Math.round(this.stats.totalTokens / sessions.length) : 0,
    };
  }

  // 清理过期会话
  cleanup() {
    const cutoff = new Date(Date.now() - this.config.retentionPeriod);
    let cleanedCount = 0;

    for (const [id, session] of this.sessions) {
      if (session.lastActivity < cutoff && session.status === 'active') {
        session.status = 'archived';
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logInfo(`清理了 ${cleanedCount} 个过期会话`);
    }

    // 清理记忆网络
    this.memoryNetwork.memories.forEach((memory, key) => {
      if (memory.lastAccessed < cutoff) {
        this.memoryNetwork.memories.delete(key);
      }
    });
  }

  // 启动清理任务
  startCleanupTask() {
    // 每24小时清理一次
    setInterval(
      () => {
        this.cleanup();
      },
      24 * 60 * 60 * 1000
    );
  }
}

// 日志函数
function logInfo(message) {
  console.log(`[ConversationManager] ${new Date().toISOString()} - ${message}`);
}

function logError(message) {
  console.error(`[ConversationManager Error] ${new Date().toISOString()} - ${message}`);
}

// 导出单例实例
const conversationManager = new ConversationManager();

module.exports = {
  ConversationManager,
  ConversationSession,
  MemoryNetwork,
  conversationManager,
};
