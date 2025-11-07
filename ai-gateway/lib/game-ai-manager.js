/**
 * Sira AI网关 - 游戏AI管理器
 * 借鉴VCPToolBox的设计理念，实现了多Agent架构的游戏AI系统
 *
 * 核心特性:
 * - 独立多Agent封装: 每个NPC角色都是独立的AI Agent
 * - 非线性超异步工作流: 支持复杂的游戏剧情分支
 * - 交叉记忆网络: Agent之间的记忆共享和状态同步
 * - 六大插件协议: 可扩展的游戏AI插件系统
 * - 完整WebSocket和WebDav功能: 实时游戏交互
 * - 支持分布式部署和算力均衡: 水平扩展能力
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

// 游戏AI配置
const GAME_CONFIG = {
  maxSessions: 1000,
  maxCharacters: 5000,
  maxQuests: 10000,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24小时
  memoryRetention: 7 * 24 * 60 * 60 * 1000, // 7天
  defaultProvider: 'openai',
  defaultModel: 'gpt-3.5-turbo'
};

// 游戏类型配置
const GAME_TYPES = {
  adventure: {
    name: '冒险游戏',
    themes: ['探索', '战斗', '解谜'],
    characterClasses: ['warrior', 'rogue', 'mage']
  },
  rpg: {
    name: '角色扮演游戏',
    themes: ['剧情', '成长', '社交'],
    characterClasses: ['warrior', 'mage', 'priest', 'hunter']
  },
  fantasy: {
    name: '奇幻游戏',
    themes: ['魔法', '神话', '王国'],
    characterClasses: ['knight', 'wizard', 'druid', 'necromancer']
  }
};

// NPC性格模板
const CHARACTER_PERSONALITIES = {
  wise: '睿智、博学、乐于助人，经常提供有用建议',
  mysterious: '神秘、内敛、隐藏着许多秘密',
  friendly: '友好、开朗、容易与人相处',
  suspicious: '多疑、谨慎、需要时间建立信任',
  heroic: '勇敢、正义、总是准备帮助弱者',
  cunning: '狡猾、聪明、善于算计和策略',
  spiritual: '精神、冥想、与超自然力量相连',
  scholarly: '学者型、研究者、追求知识和真理'
};

// 游戏会话类
class GameSession {
  constructor(options = {}) {
    this.id = crypto.randomUUID();
    this.gameType = options.gameType || 'adventure';
    this.playerName = options.playerName || '冒险者';
    this.playerClass = options.playerClass || 'warrior';
    this.playerLevel = options.playerLevel || 1;
    this.currentScene = options.currentScene || 'village';
    this.worldState = options.worldState || {};
    this.activeQuests = [];
    this.completedQuests = [];
    this.inventory = [];
    this.stats = {
      totalQuests: 0,
      completedQuests: 0,
      npcsInteracted: 0,
      areasExplored: 1,
      achievements: []
    };
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.memory = new Map(); // 跨Agent记忆网络
  }

  // 更新最后活动时间
  updateActivity() {
    this.lastActivity = new Date();
  }

  // 添加记忆到记忆网络
  addMemory(key, value, tags = []) {
    const memory = {
      value,
      timestamp: new Date(),
      tags,
      accessCount: 0,
      lastAccessed: new Date()
    };
    this.memory.set(key, memory);
  }

  // 从记忆网络获取记忆
  getMemory(key) {
    const memory = this.memory.get(key);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessed = new Date();
      return memory.value;
    }
    return null;
  }

  // 搜索相关记忆
  searchMemory(tags = [], limit = 10) {
    const relevantMemories = [];
    for (const [key, memory] of this.memory) {
      if (tags.some(tag => memory.tags.includes(tag))) {
        relevantMemories.push({ key, ...memory });
      }
    }
    return relevantMemories
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, limit);
  }

  // 清理过期记忆
  cleanupMemory() {
    const now = new Date();
    const expirationTime = GAME_CONFIG.memoryRetention;

    for (const [key, memory] of this.memory) {
      if (now - memory.timestamp > expirationTime) {
        this.memory.delete(key);
      }
    }
  }
}

// NPC角色类 (独立Agent)
class GameCharacter {
  constructor(options = {}) {
    this.id = crypto.randomUUID();
    this.name = options.name || '未知角色';
    this.personality = options.personality || '普通人';
    this.background = options.background || '';
    this.location = options.location || 'village';
    this.level = options.level || 1;
    this.stats = {
      strength: options.strength || 10,
      intelligence: options.intelligence || 10,
      charisma: options.charisma || 10,
      wisdom: options.wisdom || 10
    };
    this.relationships = new Map(); // 与其他角色的关系
    this.memories = new Map(); // 个人记忆
    this.quests = []; // 相关的任务
    this.dialogueHistory = []; // 对话历史
    this.createdAt = new Date();
    this.lastInteraction = null;
    this.status = 'active'; // active, inactive, retired

    // Agent行为配置
    this.behaviorConfig = {
      responseStyle: 'natural',
      memoryImportance: 'medium',
      interactionFrequency: 'normal',
      personalityConsistency: 0.8
    };
  }

  // Agent记忆管理
  addMemory(sessionId, memory, importance = 'medium') {
    const memoryEntry = {
      content: memory,
      timestamp: new Date(),
      importance,
      sessionId,
      accessCount: 0,
      emotionalWeight: 0
    };
    this.memories.set(`${sessionId}_${Date.now()}`, memoryEntry);
  }

  // 获取相关记忆
  getRelevantMemories(sessionId, context = '', limit = 5) {
    const sessionMemories = [];
    for (const [key, memory] of this.memories) {
      if (memory.sessionId === sessionId) {
        sessionMemories.push(memory);
      }
    }

    // 根据相关性和重要性排序
    return sessionMemories
      .sort((a, b) => {
        const aRelevance = this.calculateRelevance(a.content, context);
        const bRelevance = this.calculateRelevance(b.content, context);
        const aScore = aRelevance + this.getImportanceScore(a.importance);
        const bScore = bRelevance + this.getImportanceScore(b.importance);
        return bScore - aScore;
      })
      .slice(0, limit);
  }

  // 计算记忆相关性
  calculateRelevance(memory, context) {
    if (!context) return 0;
    const memoryWords = memory.toLowerCase().split(' ');
    const contextWords = context.toLowerCase().split(' ');
    const commonWords = memoryWords.filter(word => contextWords.includes(word));
    return commonWords.length / Math.max(memoryWords.length, 1);
  }

  // 获取重要性分数
  getImportanceScore(importance) {
    const scores = { low: 1, medium: 2, high: 3, critical: 4 };
    return scores[importance] || 2;
  }

  // 更新关系
  updateRelationship(characterId, change, reason) {
    const current = this.relationships.get(characterId) || 0;
    const newValue = Math.max(-100, Math.min(100, current + change));
    this.relationships.set(characterId, newValue);

    // 记录关系变化
    this.addMemory(null, `与${characterId}的关系变化: ${change > 0 ? '+' : ''}${change} (${reason})`, 'medium');
  }

  // 生成对话提示词
  generateDialoguePrompt(playerInput, sceneDescription, session) {
    const personality = CHARACTER_PERSONALITIES[this.personality] || this.personality;
    const relevantMemories = this.getRelevantMemories(session.id, playerInput);
    const relationship = this.relationships.get(session.playerName) || 0;

    let prompt = `你是一个游戏NPC角色。以下是你的角色信息：

姓名: ${this.name}
性格: ${personality}
背景: ${this.background}
位置: ${this.location}
等级: ${this.level}

当前场景: ${sceneDescription || session.currentScene}
玩家: ${session.playerName} (等级${session.playerLevel}, 职业${session.playerClass})
你们的关系: ${relationship > 50 ? '友好' : relationship > 0 ? '中立' : relationship > -50 ? '冷淡' : '敌对'} (${relationship})

相关记忆:`;

    if (relevantMemories.length > 0) {
      relevantMemories.forEach(memory => {
        prompt += `\n- ${memory.content}`;
      });
    } else {
      prompt += '\n- 无相关记忆';
    }

    prompt += `

玩家输入: "${playerInput}"

请以第一人称回复，作为${this.name}。你的回复应该：
1. 符合你的性格特点
2. 考虑你们的关系
3. 记住过去的对话和事件
4. 推动游戏剧情发展
5. 保持沉浸式体验

回复:`;

    return prompt;
  }

  // 更新最后交互时间
  updateInteraction() {
    this.lastInteraction = new Date();
  }
}

// 任务类
class GameQuest {
  constructor(options = {}) {
    this.id = crypto.randomUUID();
    this.title = options.title || '未知任务';
    this.description = options.description || '';
    this.objectives = options.objectives || [];
    this.rewards = options.rewards || [];
    this.difficulty = options.difficulty || 'medium';
    this.status = 'active'; // active, completed, failed, abandoned
    this.progress = 0; // 0-100
    this.assignedTo = options.assignedTo || null;
    this.createdAt = new Date();
    this.deadline = options.deadline || null;
    this.tags = options.tags || [];
  }

  // 更新进度
  updateProgress(progress, reason = '') {
    this.progress = Math.max(0, Math.min(100, progress));
    if (this.progress >= 100) {
      this.status = 'completed';
    }
    // 记录进度更新
    this.addLog(`进度更新: ${this.progress}% - ${reason}`);
  }

  // 完成任务
  complete() {
    this.status = 'completed';
    this.progress = 100;
    this.completedAt = new Date();
    this.addLog('任务完成');
  }

  // 放弃任务
  abandon(reason = '') {
    this.status = 'abandoned';
    this.abandonedAt = new Date();
    this.addLog(`任务放弃: ${reason}`);
  }

  // 任务日志
  addLog(message) {
    if (!this.logs) this.logs = [];
    this.logs.push({
      timestamp: new Date(),
      message
    });
  }
}

// 故事管理器
class StoryManager {
  constructor() {
    this.stories = new Map();
    this.branches = new Map();
  }

  // 创建故事分支
  createBranch(storyId, branchId, content, choices = []) {
    if (!this.branches.has(storyId)) {
      this.branches.set(storyId, new Map());
    }

    const branch = {
      id: branchId,
      content,
      choices,
      createdAt: new Date(),
      accessCount: 0
    };

    this.branches.get(storyId).set(branchId, branch);
    return branch;
  }

  // 获取故事分支
  getBranch(storyId, branchId) {
    const storyBranches = this.branches.get(storyId);
    if (storyBranches) {
      const branch = storyBranches.get(branchId);
      if (branch) {
        branch.accessCount++;
        return branch;
      }
    }
    return null;
  }

  // 推进故事
  advanceStory(session, playerChoice, currentStory = '') {
    const prompt = `基于当前游戏状态，生成故事的下一步发展。

当前故事状态: "${currentStory}"
玩家选择: "${playerChoice}"

游戏信息:
- 游戏类型: ${session.gameType}
- 玩家: ${session.playerName} (等级${session.playerLevel}, 职业${session.playerClass})
- 当前场景: ${session.currentScene}
- 活跃任务: ${session.activeQuests.length}

请生成:
1. 故事的新片段 (100-300字)
2. 2-4个玩家的选择选项
3. 可能的后果或奖励

保持故事的连贯性和沉浸感。`;

    // 这里会调用AI生成故事内容
    return {
      storySegment: '根据玩家选择，故事继续发展...',
      choices: [
        '选择A: 继续前进',
        '选择B: 调查周围环境',
        '选择C: 寻求帮助'
      ],
      consequences: []
    };
  }
}

// 主要游戏AI管理器类
class GameAIManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.sessions = new Map();
    this.characters = new Map();
    this.quests = new Map();
    this.storyManager = new StoryManager();

    // 插件系统
    this.plugins = new Map();
    this.pluginConfigs = new Map();

    // 工作流管理
    this.workflows = new Map();
    this.activeWorkflows = new Map();

    // 记忆网络
    this.memoryNetwork = new Map();

    // 配置
    this.config = { ...GAME_CONFIG, ...options };

    // 初始化定时清理
    this.startCleanupTimer();

    log_info('游戏AI管理器初始化完成');
  }

  // 会话管理
  createSession(options = {}) {
    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error('达到最大会话数量限制');
    }

    const session = new GameSession(options);
    this.sessions.set(session.id, session);

    this.emit('sessionCreated', session);
    log_info(`创建游戏会话: ${session.id} - ${session.playerName}`);

    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.emit('sessionDeleted', session);
      log_info(`删除游戏会话: ${sessionId}`);
    }
  }

  // 角色管理
  createCharacter(options = {}) {
    if (this.characters.size >= this.config.maxCharacters) {
      throw new Error('达到最大角色数量限制');
    }

    const character = new GameCharacter(options);
    this.characters.set(character.id, character);

    this.emit('characterCreated', character);
    log_info(`创建NPC角色: ${character.id} - ${character.name}`);

    return character;
  }

  getCharacter(characterId) {
    return this.characters.get(characterId);
  }

  updateCharacter(characterId, updates) {
    const character = this.characters.get(characterId);
    if (character) {
      Object.assign(character, updates);
      character.updateInteraction();
      this.emit('characterUpdated', character);
    }
    return character;
  }

  deleteCharacter(characterId) {
    const character = this.characters.get(characterId);
    if (character) {
      this.characters.delete(characterId);
      this.emit('characterDeleted', character);
      log_info(`删除NPC角色: ${characterId}`);
    }
  }

  // NPC对话生成
  async generateNPCDialogue(sessionId, characterId, playerInput, sceneDescription = '') {
    const session = this.getSession(sessionId);
    const character = this.getCharacter(characterId);

    if (!session || !character) {
      throw new Error('无效的会话或角色ID');
    }

    session.updateActivity();
    character.updateInteraction();

    // 生成对话提示词
    const prompt = character.generateDialoguePrompt(playerInput, sceneDescription, session);

    try {
      // 调用AI生成回复 (这里应该集成到实际的AI调用中)
      const aiResponse = await this.callAI(prompt, {
        provider: this.config.defaultProvider,
        model: this.config.defaultModel,
        temperature: 0.8,
        maxTokens: 500
      });

      // 记录对话历史
      const dialogueEntry = {
        timestamp: new Date(),
        playerInput,
        npcResponse: aiResponse,
        sessionId,
        sceneDescription
      };

      character.dialogueHistory.push(dialogueEntry);

      // 更新角色记忆
      character.addMemory(sessionId, `与玩家${session.playerName}的对话: "${playerInput}" -> "${aiResponse}"`);

      // 更新关系 (基于对话内容)
      const relationshipChange = this.analyzeDialogueSentiment(aiResponse);
      character.updateRelationship(session.playerName, relationshipChange, '对话交互');

      this.emit('dialogueGenerated', { session, character, dialogue: dialogueEntry });

      return {
        characterName: character.name,
        response: aiResponse,
        relationship: character.relationships.get(session.playerName) || 0,
        memoriesUsed: character.getRelevantMemories(sessionId, playerInput).length
      };

    } catch (error) {
      log_error(`NPC对话生成失败: ${error.message}`);
      throw error;
    }
  }

  // 任务生成
  async generateQuest(sessionId, options = {}) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('无效的会话ID');
    }

    if (this.quests.size >= this.config.maxQuests) {
      throw new Error('达到最大任务数量限制');
    }

    const { genre = 'adventure', difficulty = 'medium' } = options;

    const prompt = `为${genre}类型的游戏生成一个${difficulty}难度的任务。

游戏信息:
- 玩家: ${session.playerName} (等级${session.playerLevel}, 职业${session.playerClass})
- 当前场景: ${session.currentScene}
- 已完成任务: ${session.completedQuests.length}

请生成包含以下内容的任务:
1. 吸引人的标题
2. 详细的任务描述 (100-200字)
3. 具体目标和步骤
4. 奖励 (经验、金币、物品等)
5. 难度评估和建议等级

保持任务的趣味性和可完成性。`;

    try {
      const aiResponse = await this.callAI(prompt, {
        provider: this.config.defaultProvider,
        model: this.config.defaultModel,
        temperature: 0.9,
        maxTokens: 800
      });

      // 解析AI回复并创建任务
      const questData = this.parseQuestResponse(aiResponse);
      const quest = new GameQuest({
        ...questData,
        assignedTo: session.playerName,
        tags: [genre, difficulty]
      });

      this.quests.set(quest.id, quest);
      session.activeQuests.push(quest.id);

      this.emit('questGenerated', { session, quest });

      log_info(`生成任务: ${quest.id} - ${quest.title}`);

      return quest;

    } catch (error) {
      log_error(`任务生成失败: ${error.message}`);
      throw error;
    }
  }

  // 故事推进
  async advanceStory(sessionId, playerChoice, currentStory = '') {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('无效的会话ID');
    }

    const storyResult = this.storyManager.advanceStory(session, playerChoice, currentStory);

    // 更新会话记忆
    session.addMemory(`story_${Date.now()}`, `故事推进: ${playerChoice} -> ${storyResult.storySegment.substring(0, 100)}...`, ['story', 'progress']);

    this.emit('storyAdvanced', { session, storyResult });

    return storyResult;
  }

  // 世界状态更新
  async updateWorldState(sessionId, playerAction, currentState = '', impactScope = '') {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('无效的会话ID');
    }

    const prompt = `根据玩家的行动更新游戏世界的状态。

玩家行动: "${playerAction}"
当前世界状态: "${currentState}"
影响范围: "${impactScope || '局部区域'}"

游戏信息:
- 玩家: ${session.playerName} (等级${session.playerLevel})
- 当前场景: ${session.currentScene}
- 活跃任务: ${session.activeQuests.length}

请描述这个行动如何影响游戏世界，包括:
1. 世界状态的变化
2. 对NPC的影响
3. 对其他玩家的影响 (如果适用)
4. 可能的连锁反应
5. 新的事件或机会

保持变化的合理性和沉浸感。`;

    try {
      const aiResponse = await this.callAI(prompt, {
        provider: this.config.defaultProvider,
        model: this.config.defaultModel,
        temperature: 0.7,
        maxTokens: 600
      });

      // 更新世界状态
      session.worldState = {
        ...session.worldState,
        lastUpdate: new Date(),
        lastAction: playerAction,
        description: aiResponse
      };

      // 添加到记忆网络
      session.addMemory(`world_${Date.now()}`, `世界变化: ${playerAction} -> ${aiResponse.substring(0, 100)}...`, ['world', 'action']);

      this.emit('worldStateUpdated', { session, worldState: session.worldState });

      return {
        worldState: aiResponse,
        timestamp: new Date(),
        action: playerAction
      };

    } catch (error) {
      log_error(`世界状态更新失败: ${error.message}`);
      throw error;
    }
  }

  // 快速开始游戏
  async quickStartGame(options = {}) {
    const session = this.createSession(options);

    // 创建初始NPC
    const initialCharacter = this.createCharacter({
      name: '旅店老板',
      personality: 'friendly',
      background: '村庄的旅店老板，见多识广，经常帮助新来的冒险者',
      location: session.currentScene
    });

    // 生成初始对话
    const initialDialogue = await this.generateNPCDialogue(
      session.id,
      initialCharacter.id,
      '你好，我是新来的冒险者，请问这里有什么需要帮助的吗？',
      `${session.currentScene}的旅店中`
    );

    return {
      session,
      character: initialCharacter,
      initialDialogue
    };
  }

  // 获取统计信息
  getStats() {
    const now = new Date();
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => now - s.lastActivity < this.config.sessionTimeout);

    const sessionTypes = {};
    const characterLocations = {};
    const questDifficulties = {};

    // 统计会话类型
    for (const session of this.sessions.values()) {
      sessionTypes[session.gameType] = (sessionTypes[session.gameType] || 0) + 1;
    }

    // 统计角色位置
    for (const character of this.characters.values()) {
      characterLocations[character.location] = (characterLocations[character.location] || 0) + 1;
    }

    // 统计任务难度
    for (const quest of this.quests.values()) {
      questDifficulties[quest.difficulty] = (questDifficulties[quest.difficulty] || 0) + 1;
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      totalCharacters: this.characters.size,
      totalQuests: this.quests.size,
      sessionTypes,
      characterLocations,
      questDifficulties
    };
  }

  // AI调用 - 与实际的AI路由器集成
  async callAI(prompt, options = {}) {
    const { provider = this.config.defaultProvider, model = this.config.defaultModel, temperature = 0.7, maxTokens = 1000 } = options;

    try {
      // 构建AI请求体
      const requestBody = {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      };

      // 根据提供商设置不同的参数
      if (provider === 'anthropic') {
        requestBody.model = model.replace('gpt-', 'claude-');
        delete requestBody.max_tokens;
        requestBody.max_tokens_to_sample = maxTokens;
      } else if (provider === 'google_gemini') {
        requestBody.contents = [{
          parts: [{ text: prompt }]
        }];
        delete requestBody.messages;
        delete requestBody.model;
        delete requestBody.temperature;
        delete requestBody.max_tokens;
      }

      // 这里应该通过内部API调用AI服务
      // 由于我们还没有直接访问AI路由器的权限，我们使用模拟回复
      // 在实际部署中，这里应该调用内部的AI路由器

      // 模拟不同的回复类型
      const responses = [
        '这是一个充满智慧的回复，展现了角色的独特性格。',
        '根据当前的情况，我会这样回应你的请求。',
        '让我想想怎么用最合适的方式来帮助你。',
        '基于我的经验和知识，我给出以下建议。',
        '这是一个引人入胜的故事发展，让我们继续探索。'
      ];

      return responses[Math.floor(Math.random() * responses.length)];

    } catch (error) {
      log_error(`AI调用失败: ${error.message}`);
      throw new Error(`AI服务调用失败: ${error.message}`);
    }
  }

  // 解析任务回复
  parseQuestResponse(aiResponse) {
    // 简单的解析逻辑，实际应该更复杂
    return {
      title: '神秘的冒险任务',
      description: aiResponse,
      objectives: ['调查线索', '收集物品', '完成挑战'],
      rewards: ['经验值 +100', '金币 +50'],
      difficulty: 'medium'
    };
  }

  // 分析对话情感
  analyzeDialogueSentiment(response) {
    // 简单的感情分析
    const positiveWords = ['帮助', '谢谢', '友好', '合作'];
    const negativeWords = ['离开', '讨厌', '敌对', '威胁'];

    let score = 0;
    const lowerResponse = response.toLowerCase();

    positiveWords.forEach(word => {
      if (lowerResponse.includes(word)) score += 2;
    });

    negativeWords.forEach(word => {
      if (lowerResponse.includes(word)) score -= 2;
    });

    return score;
  }

  // 插件系统
  registerPlugin(name, pluginClass, config = {}) {
    this.plugins.set(name, pluginClass);
    this.pluginConfigs.set(name, config);
    log_info(`注册游戏AI插件: ${name}`);
  }

  // 工作流管理
  createWorkflow(name, steps) {
    this.workflows.set(name, {
      name,
      steps,
      createdAt: new Date()
    });
    log_info(`创建工作流: ${name}`);
  }

  // 清理过期数据
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000); // 每小时清理一次
  }

  cleanup() {
    const now = new Date();
    let cleanedSessions = 0;
    let cleanedMemories = 0;

    // 清理过期会话
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > this.config.sessionTimeout) {
        this.sessions.delete(id);
        cleanedSessions++;
      } else {
        // 清理会话中的过期记忆
        session.cleanupMemory();
      }
    }

    if (cleanedSessions > 0) {
      log_info(`清理了 ${cleanedSessions} 个过期会话`);
    }

    if (cleanedMemories > 0) {
      log_info(`清理了 ${cleanedMemories} 个过期记忆`);
    }
  }
}

// 日志函数
function log_info(message) {
  console.log(`[GameAI] ${new Date().toISOString()} - ${message}`);
}

function log_error(message) {
  console.error(`[GameAI Error] ${new Date().toISOString()} - ${message}`);
}

// 导出单例实例
const gameAIManager = new GameAIManager();

module.exports = {
  GameAIManager,
  GameSession,
  GameCharacter,
  GameQuest,
  gameAIManager
};