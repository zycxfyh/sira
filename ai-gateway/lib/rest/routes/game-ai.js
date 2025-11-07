/**
 * Sira AI网关 - 游戏AI REST API路由
 * 提供完整的游戏AI功能接口
 */

const express = require('express');
const { gameAIManager } = require('../../game-ai-manager');

const router = express.Router();

// 中间件：错误处理
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 中间件：验证会话存在
const validateSession = (req, res, next) => {
  const { sessionId } = req.params || req.body;
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: '缺少会话ID'
    });
  }

  const session = gameAIManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: '会话不存在'
    });
  }

  req.session = session;
  next();
};

// 中间件：验证角色存在
const validateCharacter = (req, res, next) => {
  const { characterId } = req.params || req.body;
  if (!characterId) {
    return res.status(400).json({
      success: false,
      error: '缺少角色ID'
    });
  }

  const character = gameAIManager.getCharacter(characterId);
  if (!character) {
    return res.status(404).json({
      success: false,
      error: '角色不存在'
    });
  }

  req.character = character;
  next();
};

// ==================== 会话管理 ====================

/**
 * 创建游戏会话
 * POST /game/sessions
 */
router.post('/sessions', asyncHandler(async (req, res) => {
  const {
    gameType = 'adventure',
    playerName = '冒险者',
    playerClass = 'warrior',
    playerLevel = 1,
    currentScene = 'village'
  } = req.body;

  // 验证输入
  if (!GAME_TYPES[gameType]) {
    return res.status(400).json({
      success: false,
      error: '无效的游戏类型'
    });
  }

  try {
    const session = gameAIManager.createSession({
      gameType,
      playerName,
      playerClass,
      playerLevel,
      currentScene
    });

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          gameType: session.gameType,
          playerName: session.playerName,
          playerClass: session.playerClass,
          playerLevel: session.playerLevel,
          currentScene: session.currentScene,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * 获取会话详情
 * GET /game/sessions/:sessionId
 */
router.get('/sessions/:sessionId', validateSession, (req, res) => {
  const session = req.session;

  res.json({
    success: true,
    data: {
      session: {
        id: session.id,
        gameType: session.gameType,
        playerName: session.playerName,
        playerClass: session.playerClass,
        playerLevel: session.playerLevel,
        currentScene: session.currentScene,
        worldState: session.worldState,
        activeQuests: session.activeQuests,
        stats: session.stats,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      }
    }
  });
});

/**
 * 删除游戏会话
 * DELETE /game/sessions/:sessionId
 */
router.delete('/sessions/:sessionId', validateSession, (req, res) => {
  try {
    gameAIManager.deleteSession(req.params.sessionId);
    res.json({
      success: true,
      message: '会话已删除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 角色管理 ====================

/**
 * 创建NPC角色
 * POST /game/characters
 */
router.post('/characters', asyncHandler(async (req, res) => {
  const {
    name,
    personality,
    background = '',
    location = 'village',
    level = 1
  } = req.body;

  if (!name || !personality) {
    return res.status(400).json({
      success: false,
      error: '角色名称和性格特点都是必需的'
    });
  }

  try {
    const character = gameAIManager.createCharacter({
      name,
      personality,
      background,
      location,
      level
    });

    res.json({
      success: true,
      data: {
        character: {
          id: character.id,
          name: character.name,
          personality: character.personality,
          background: character.background,
          location: character.location,
          level: character.level,
          createdAt: character.createdAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * 获取角色详情
 * GET /game/characters/:characterId
 */
router.get('/characters/:characterId', validateCharacter, (req, res) => {
  const character = req.character;

  res.json({
    success: true,
    data: {
      character: {
        id: character.id,
        name: character.name,
        personality: character.personality,
        background: character.background,
        location: character.location,
        level: character.level,
        stats: character.stats,
        lastInteraction: character.lastInteraction,
        createdAt: character.createdAt,
        status: character.status
      }
    }
  });
});

/**
 * 获取角色记忆
 * GET /game/character/:characterId/memory?sessionId=xxx
 */
router.get('/character/:characterId/memory', validateCharacter, (req, res) => {
  const { sessionId } = req.query;
  const character = req.character;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: '缺少会话ID参数'
    });
  }

  const memories = character.getRelevantMemories(sessionId, '', 10);

  res.json({
    success: true,
    data: {
      memory: {
        characterId: character.id,
        characterName: character.name,
        sessionId,
        relationship: character.relationships.get(gameAIManager.getSession(sessionId)?.playerName) || 0,
        recentInteractions: memories.map(m => ({
          content: m.content,
          timestamp: m.timestamp,
          importance: m.importance
        }))
      }
    }
  });
});

/**
 * 更新角色
 * PUT /game/characters/:characterId
 */
router.put('/characters/:characterId', validateCharacter, asyncHandler(async (req, res) => {
  const updates = req.body;
  const character = req.character;

  try {
    const updatedCharacter = gameAIManager.updateCharacter(character.id, updates);
    res.json({
      success: true,
      data: {
        character: {
          id: updatedCharacter.id,
          name: updatedCharacter.name,
          personality: updatedCharacter.personality,
          background: updatedCharacter.background,
          location: updatedCharacter.location,
          level: updatedCharacter.level,
          lastInteraction: updatedCharacter.lastInteraction
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * 删除角色
 * DELETE /game/characters/:characterId
 */
router.delete('/characters/:characterId', validateCharacter, (req, res) => {
  try {
    gameAIManager.deleteCharacter(req.params.characterId);
    res.json({
      success: true,
      message: '角色已删除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== 对话功能 ====================

/**
 * NPC对话生成
 * POST /game/npc-chat
 */
router.post('/npc-chat', asyncHandler(async (req, res) => {
  const {
    sessionId,
    characterId,
    playerInput,
    sceneDescription = ''
  } = req.body;

  if (!sessionId || !characterId || !playerInput) {
    return res.status(400).json({
      success: false,
      error: '会话ID、角色ID和玩家输入都是必需的'
    });
  }

  try {
    const dialogue = await gameAIManager.generateNPCDialogue(
      sessionId,
      characterId,
      playerInput,
      sceneDescription
    );

    res.json({
      success: true,
      data: {
        dialogue
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ==================== 任务管理 ====================

/**
 * 生成游戏任务
 * POST /game/generate-quest
 */
router.post('/generate-quest', asyncHandler(async (req, res) => {
  const {
    sessionId,
    genre = 'adventure',
    difficulty = 'medium'
  } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: '缺少会话ID'
    });
  }

  try {
    const quest = await gameAIManager.generateQuest(sessionId, {
      genre,
      difficulty
    });

    res.json({
      success: true,
      data: {
        quest: {
          id: quest.id,
          title: quest.title,
          description: quest.description,
          objectives: quest.objectives,
          rewards: quest.rewards,
          difficulty: quest.difficulty,
          status: quest.status,
          progress: quest.progress,
          createdAt: quest.createdAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * 获取任务详情
 * GET /game/quests/:questId
 */
router.get('/quests/:questId', (req, res) => {
  const quest = gameAIManager.quests.get(req.params.questId);

  if (!quest) {
    return res.status(404).json({
      success: false,
      error: '任务不存在'
    });
  }

  res.json({
    success: true,
    data: {
      quest: {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        objectives: quest.objectives,
        rewards: quest.rewards,
        difficulty: quest.difficulty,
        status: quest.status,
        progress: quest.progress,
        assignedTo: quest.assignedTo,
        createdAt: quest.createdAt,
        deadline: quest.deadline,
        tags: quest.tags
      }
    }
  });
});

// ==================== 故事管理 ====================

/**
 * 推进游戏故事
 * POST /game/advance-story
 */
router.post('/advance-story', asyncHandler(async (req, res) => {
  const {
    sessionId,
    playerChoice,
    currentStory = '',
    background = ''
  } = req.body;

  if (!sessionId || !playerChoice) {
    return res.status(400).json({
      success: false,
      error: '会话ID和玩家选择都是必需的'
    });
  }

  try {
    const storyResult = await gameAIManager.advanceStory(
      sessionId,
      playerChoice,
      currentStory
    );

    res.json({
      success: true,
      data: {
        storyResult
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ==================== 世界状态 ====================

/**
 * 更新世界状态
 * POST /game/world-state
 */
router.post('/world-state', asyncHandler(async (req, res) => {
  const {
    sessionId,
    playerAction,
    currentState = '',
    impactScope = ''
  } = req.body;

  if (!sessionId || !playerAction) {
    return res.status(400).json({
      success: false,
      error: '会话ID和玩家行动都是必需的'
    });
  }

  try {
    const worldUpdate = await gameAIManager.updateWorldState(
      sessionId,
      playerAction,
      currentState,
      impactScope
    );

    res.json({
      success: true,
      data: {
        worldUpdate
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ==================== 快速开始 ====================

/**
 * 快速开始游戏
 * POST /game/quick-start
 */
router.post('/quick-start', asyncHandler(async (req, res) => {
  const {
    playerName = '冒险者',
    gameType = 'adventure',
    playerClass = 'warrior'
  } = req.body;

  try {
    const result = await gameAIManager.quickStartGame({
      playerName,
      gameType,
      playerClass
    });

    res.json({
      success: true,
      data: {
        session: {
          id: result.session.id,
          gameType: result.session.gameType,
          playerName: result.session.playerName,
          playerClass: result.session.playerClass,
          currentScene: result.session.currentScene
        },
        character: {
          id: result.character.id,
          name: result.character.name,
          personality: result.character.personality,
          location: result.character.location
        },
        initialDialogue: result.initialDialogue
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ==================== 统计信息 ====================

/**
 * 获取游戏AI统计
 * GET /game/stats
 */
router.get('/stats', (req, res) => {
  const stats = gameAIManager.getStats();

  res.json({
    success: true,
    data: {
      stats
    }
  });
});

// ==================== 数据导出 ====================

/**
 * 导出游戏数据
 * POST /game/export
 */
router.post('/export', asyncHandler(async (req, res) => {
  const { includeSessions = true, includeCharacters = true, includeQuests = true } = req.body;

  const exportData = {
    timestamp: new Date(),
    version: '1.0',
    data: {}
  };

  if (includeSessions) {
    exportData.data.sessions = Array.from(gameAIManager.sessions.values()).map(session => ({
      id: session.id,
      gameType: session.gameType,
      playerName: session.playerName,
      playerClass: session.playerClass,
      playerLevel: session.playerLevel,
      currentScene: session.currentScene,
      stats: session.stats,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    }));
  }

  if (includeCharacters) {
    exportData.data.characters = Array.from(gameAIManager.characters.values()).map(character => ({
      id: character.id,
      name: character.name,
      personality: character.personality,
      background: character.background,
      location: character.location,
      level: character.level,
      stats: character.stats,
      createdAt: character.createdAt,
      lastInteraction: character.lastInteraction
    }));
  }

  if (includeQuests) {
    exportData.data.quests = Array.from(gameAIManager.quests.values()).map(quest => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      difficulty: quest.difficulty,
      status: quest.status,
      progress: quest.progress,
      assignedTo: quest.assignedTo,
      createdAt: quest.createdAt
    }));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="game-ai-export-${Date.now()}.json"`);
  res.json(exportData);
}));

// ==================== 健康检查 ====================

/**
 * 健康检查
 * GET /game/health
 */
router.get('/health', (req, res) => {
  const stats = gameAIManager.getStats();

  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      stats: {
        sessions: stats.totalSessions,
        characters: stats.totalCharacters,
        quests: stats.totalQuests
      }
    }
  });
});

// 游戏类型常量 (供前端使用)
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

/**
 * 获取游戏类型配置
 * GET /game/types
 */
router.get('/types', (req, res) => {
  res.json({
    success: true,
    data: {
      gameTypes: GAME_TYPES
    }
  });
});

module.exports = router;