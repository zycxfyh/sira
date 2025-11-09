/**
 * Sira AI网关 - 性能基准测试用例库
 * 提供各种测试场景的标准化测试用例
 */

const testCases = {
  // 简单问答测试
  simple_qa: {
    name: "简单问答",
    description: "测试模型对简单问题的理解和回答能力",
    category: "基础能力",
    difficulty: "简单",
    input: "什么是人工智能？请用一句话解释。",
    expected_output:
      "人工智能是计算机科学的一个分支，旨在创造能够模拟人类智能的机器。",
    metrics: ["response_time", "accuracy", "relevance"],
    tags: ["基础", "问答", "概念解释"],
  },

  // 创意写作测试
  creative_writing: {
    name: "创意写作",
    description: "测试模型的创造力和写作能力",
    category: "创意任务",
    difficulty: "中等",
    input: "写一个关于未来城市的短故事开头，字数在200字以内。",
    expected_output: "故事应该包含未来元素、城市场景和引人入胜的开头。",
    metrics: ["creativity", "coherence", "engagement"],
    tags: ["创意", "写作", "故事"],
  },

  // 代码生成测试
  code_generation: {
    name: "代码生成",
    description: "测试模型的编程能力和代码生成质量",
    category: "编程任务",
    difficulty: "中等",
    input: "用Python写一个函数，计算斐波那契数列的第n项。",
    expected_output: "应该包含正确的斐波那契数列实现，包含递归或迭代两种方式。",
    metrics: ["correctness", "efficiency", "readability"],
    tags: ["编程", "算法", "代码生成"],
  },

  // 数学推理测试
  math_reasoning: {
    name: "数学推理",
    description: "测试模型的数学计算和逻辑推理能力",
    category: "逻辑推理",
    difficulty: "中等",
    input: "如果2x + 3 = 7，那么x等于多少？请给出详细的解题步骤。",
    expected_output: "x = 2，包含逐步解题过程。",
    metrics: ["accuracy", "step_by_step", "explanation"],
    tags: ["数学", "推理", "逻辑"],
  },

  // 文本摘要测试
  text_summarization: {
    name: "文本摘要",
    description: "测试模型的文本理解和摘要生成能力",
    category: "文本处理",
    difficulty: "中等",
    input:
      "请为以下文章生成一个50字以内的摘要：人工智能的发展经历了从专家系统到机器学习的转变。近年来，深度学习技术取得了突破性进展，使得AI在图像识别、自然语言处理等领域取得了显著进步。然而，AI的发展也面临着数据隐私、算法偏见等挑战。未来，AI将更加注重可解释性和安全性。",
    expected_output: "摘要应该涵盖AI发展历程、主要成就和未来挑战。",
    metrics: ["conciseness", "comprehensiveness", "accuracy"],
    tags: ["摘要", "理解", "文本处理"],
  },

  // 情感分析测试
  sentiment_analysis: {
    name: "情感分析",
    description: "测试模型对文本情感的识别和分析能力",
    category: "自然语言处理",
    difficulty: "简单",
    input: "分析以下句子的情感倾向：'今天天气真好，心情也特别愉快！'",
    expected_output: "积极/正面情感，包含具体的分析理由。",
    metrics: ["accuracy", "explanation", "nuance"],
    tags: ["情感", "分析", "NLP"],
  },

  // 多语言翻译测试
  translation: {
    name: "多语言翻译",
    description: "测试模型的翻译质量和语言理解能力",
    category: "多语言任务",
    difficulty: "中等",
    input:
      "请将以下英文句子翻译成中文：'The rapid advancement of artificial intelligence is transforming industries across the globe.'",
    expected_output: "准确、自然的中文翻译，保持原文含义。",
    metrics: ["accuracy", "fluency", "cultural_adaptation"],
    tags: ["翻译", "多语言", "跨文化"],
  },

  // 逻辑推理测试
  logical_reasoning: {
    name: "逻辑推理",
    description: "测试模型的逻辑思维和推理能力",
    category: "推理任务",
    difficulty: "困难",
    input:
      "所有玫瑰都是花。有些花会凋谢。因此，玫瑰会凋谢。这个推理正确吗？为什么？",
    expected_output: "不正确，包含逻辑谬误的解释（肯定后件）。",
    metrics: ["logical_accuracy", "explanation", "counterexample"],
    tags: ["逻辑", "推理", "批判性思维"],
  },

  // 创意头脑风暴测试
  brainstorming: {
    name: "创意头脑风暴",
    description: "测试模型的创造力和发散性思维",
    category: "创意任务",
    difficulty: "中等",
    input: "为一个环保主题的手机应用想出5个创新功能想法。",
    expected_output: "5个独特、可行的功能想法，每个都有简要说明。",
    metrics: ["creativity", "feasibility", "relevance"],
    tags: ["创意", "头脑风暴", "创新"],
  },

  // 专业知识测试
  expert_knowledge: {
    name: "专业知识问答",
    description: "测试模型在特定领域的专业知识深度",
    category: "专业知识",
    difficulty: "困难",
    input: "解释什么是区块链技术，以及它如何确保交易的安全性和不可篡改性。",
    expected_output: "准确的技术解释，包含关键概念和机制。",
    metrics: ["technical_accuracy", "depth", "clarity"],
    tags: ["专业知识", "技术解释", "深度理解"],
  },

  // 上下文理解测试
  context_understanding: {
    name: "上下文理解",
    description: "测试模型对复杂上下文的理解和响应能力",
    category: "理解任务",
    difficulty: "中等",
    input:
      "在软件开发项目中，'敏捷开发'和'瀑布模型'有什么区别？请从项目管理、风险控制和交付方式等方面进行比较。",
    expected_output: "全面的比较分析，涵盖多个维度。",
    metrics: ["comprehensiveness", "accuracy", "structure"],
    tags: ["上下文", "比较", "理解"],
  },

  // 伦理决策测试
  ethical_reasoning: {
    name: "伦理推理",
    description: "测试模型在伦理问题上的推理和判断能力",
    category: "伦理任务",
    difficulty: "困难",
    input:
      "如果一个AI系统可以预测犯罪，但预测准确率只有70%，政府是否应该使用它来预防犯罪？请从隐私权、公平性和潜在滥用等方面分析。",
    expected_output: "平衡的伦理分析，考虑多方利益。",
    metrics: ["ethical_awareness", "balance", "depth"],
    tags: ["伦理", "决策", "社会影响"],
  },

  // 实时对话测试
  conversational: {
    name: "对话能力",
    description: "测试模型在连续对话中的表现",
    category: "对话任务",
    difficulty: "中等",
    input:
      "你好！我是小明，很高兴认识你。你可以自我介绍一下，然后问我一个问题吗？",
    expected_output: "自然的自我介绍和恰当的问题。",
    metrics: ["naturalness", "engagement", "context_awareness"],
    tags: ["对话", "互动", "社交"],
  },

  // 复杂问题解决测试
  complex_problem_solving: {
    name: "复杂问题解决",
    description: "测试模型解决复杂、多步骤问题的能力",
    category: "问题解决",
    difficulty: "困难",
    input:
      "一家小型电商公司的月销售额下降了20%。请分析可能的原因，并提出具体的改进建议。分析应该包括数据收集、根本原因分析和行动计划。",
    expected_output: "系统性的问题分析和解决方案。",
    metrics: ["systematic_approach", "practicality", "comprehensiveness"],
    tags: ["问题解决", "商业分析", "策略制定"],
  },

  // 知识整合测试
  knowledge_integration: {
    name: "知识整合",
    description: "测试模型整合不同领域知识的能力",
    category: "知识任务",
    difficulty: "困难",
    input:
      "将机器学习、物联网和可持续发展三个概念结合起来，设计一个智能城市项目。描述项目目标、技术架构和预期影响。",
    expected_output: "创新的项目设计，合理整合三种技术。",
    metrics: ["integration", "innovation", "feasibility"],
    tags: ["知识整合", "跨领域", "创新设计"],
  },

  // 实时响应测试
  real_time_response: {
    name: "实时响应",
    description: "测试模型对时事和最新信息的响应能力",
    category: "时事任务",
    difficulty: "中等",
    input: "最近AI领域有哪些重要的发展？请列出3-5个当前热点话题。",
    expected_output: "相关的当前AI发展趋势和热点。",
    metrics: ["currentness", "relevance", "insight"],
    tags: ["时事", "趋势", "更新"],
  },

  // 个性化建议测试
  personalized_recommendation: {
    name: "个性化建议",
    description: "测试模型提供个性化建议的能力",
    category: "推荐任务",
    difficulty: "中等",
    input:
      "我是一个大学生，对编程和人工智能感兴趣，但数学基础比较弱。请推荐适合我的学习路径和资源。",
    expected_output: "个性化的学习建议，考虑用户背景。",
    metrics: ["personalization", "suitability", "practicality"],
    tags: ["个性化", "推荐", "教育规划"],
  },

  // 创造性解决方案测试
  creative_solution: {
    name: "创造性解决方案",
    description: "测试模型提供创新解决方案的能力",
    category: "创新任务",
    difficulty: "困难",
    input:
      "设计一个系统，帮助人们减少食物浪费。从技术实现、用户激励和社会影响等方面进行完整设计。",
    expected_output: "创新的系统设计方案，考虑多方面因素。",
    metrics: ["creativity", "completeness", "impact"],
    tags: ["创新", "解决方案", "系统设计"],
  },
};

// 动态生成输入的测试用例
const dynamicTestCases = {
  // 数学计算测试（动态生成）
  math_calculation: {
    name: "数学计算",
    description: "测试模型的数学计算能力",
    category: "数学任务",
    difficulty: "简单",
    generateInput: () => {
      const operations = ["+", "-", "*", "/"];
      const op = operations[Math.floor(Math.random() * operations.length)];
      const a = Math.floor(Math.random() * 100) + 1;
      const b = Math.floor(Math.random() * 100) + 1;

      return `计算：${a} ${op} ${b} = ? 请给出详细的计算步骤。`;
    },
    expected_output: "正确的计算结果和步骤。",
    metrics: ["accuracy", "step_by_step"],
    tags: ["数学", "计算", "算术"],
  },

  // 词汇测试（动态生成）
  vocabulary_test: {
    name: "词汇理解",
    description: "测试模型的词汇理解和使用能力",
    category: "语言任务",
    difficulty: "中等",
    generateInput: () => {
      const words = [
        "serendipity",
        "ephemeral",
        "ubiquitous",
        "pragmatic",
        "eloquent",
        "resilient",
        "meticulous",
        "paradigm",
      ];
      const word = words[Math.floor(Math.random() * words.length)];

      return `请解释单词"${word}"的意思，并造一个句子使用这个单词。`;
    },
    expected_output: "准确的单词解释和合适的例句。",
    metrics: ["accuracy", "usage"],
    tags: ["词汇", "语言", "解释"],
  },

  // 随机故事生成测试
  random_story: {
    name: "随机故事生成",
    description: "测试模型的随机故事生成能力",
    category: "创意任务",
    difficulty: "中等",
    generateInput: () => {
      const themes = [
        "太空探索",
        "时间旅行",
        "魔法世界",
        "未来科技",
        "海洋冒险",
      ];
      const characters = [
        "年轻科学家",
        "勇敢探险家",
        "神秘魔法师",
        "聪明机器人",
        "普通上班族",
      ];
      const settings = [
        "古老城堡",
        "未来城市",
        "深海潜艇",
        "太空飞船",
        "魔法森林",
      ];

      const theme = themes[Math.floor(Math.random() * themes.length)];
      const character =
        characters[Math.floor(Math.random() * characters.length)];
      const setting = settings[Math.floor(Math.random() * settings.length)];

      return `写一个关于${character}在${setting}经历${theme}冒险的短故事开头（100字以内）。`;
    },
    expected_output: "引人入胜的故事开头，包含指定元素。",
    metrics: ["creativity", "coherence"],
    tags: ["故事", "随机", "创意"],
  },
};

// 合并所有测试用例
Object.assign(testCases, dynamicTestCases);

// 测试用例分类
const testCategories = {
  basic: ["simple_qa", "sentiment_analysis", "math_calculation"],
  creative: ["creative_writing", "brainstorming", "random_story"],
  technical: ["code_generation", "expert_knowledge", "math_reasoning"],
  analytical: [
    "text_summarization",
    "logical_reasoning",
    "context_understanding",
  ],
  advanced: [
    "ethical_reasoning",
    "complex_problem_solving",
    "knowledge_integration",
  ],
  conversational: ["conversational", "personalized_recommendation"],
  multilingual: ["translation"],
  real_time: ["real_time_response"],
};

// 难度等级
const difficultyLevels = {
  simple: [
    "simple_qa",
    "sentiment_analysis",
    "math_calculation",
    "vocabulary_test",
  ],
  medium: [
    "creative_writing",
    "code_generation",
    "text_summarization",
    "translation",
    "context_understanding",
    "conversational",
    "real_time_response",
    "personalized_recommendation",
    "random_story",
  ],
  hard: [
    "logical_reasoning",
    "expert_knowledge",
    "ethical_reasoning",
    "complex_problem_solving",
    "knowledge_integration",
    "creative_solution",
  ],
};

// 预定义测试套件
const testSuites = {
  quick_test: {
    name: "快速测试",
    description: "5分钟快速评估模型基本能力",
    tasks: ["simple_qa", "math_calculation", "sentiment_analysis"],
    iterations: 3,
    concurrency: 2,
  },

  comprehensive_test: {
    name: "综合测试",
    description: "全面评估模型各项能力",
    tasks: [
      "simple_qa",
      "creative_writing",
      "code_generation",
      "text_summarization",
      "logical_reasoning",
    ],
    iterations: 5,
    concurrency: 3,
  },

  performance_test: {
    name: "性能测试",
    description: "重点评估响应速度和稳定性",
    tasks: ["simple_qa", "sentiment_analysis", "math_calculation"],
    iterations: 10,
    concurrency: 5,
  },

  quality_test: {
    name: "质量测试",
    description: "重点评估输出质量和准确性",
    tasks: ["expert_knowledge", "ethical_reasoning", "complex_problem_solving"],
    iterations: 3,
    concurrency: 1,
  },

  creative_test: {
    name: "创意测试",
    description: "评估创造力和发散性思维",
    tasks: ["creative_writing", "brainstorming", "creative_solution"],
    iterations: 5,
    concurrency: 2,
  },

  coding_test: {
    name: "编程测试",
    description: "评估编程和代码生成能力",
    tasks: ["code_generation", "expert_knowledge", "logical_reasoning"],
    iterations: 5,
    concurrency: 2,
  },
};

// 导出测试用例和相关函数
module.exports = {
  testCases,
  testCategories,
  difficultyLevels,
  testSuites,

  // 获取测试用例
  getTestCase: (taskId) => testCases[taskId],

  // 获取分类测试用例
  getTestsByCategory: (category) => {
    const taskIds = testCategories[category] || [];
    return taskIds.map((id) => ({ id, ...testCases[id] })).filter(Boolean);
  },

  // 获取难度等级测试用例
  getTestsByDifficulty: (difficulty) => {
    const taskIds = difficultyLevels[difficulty] || [];
    return taskIds.map((id) => ({ id, ...testCases[id] })).filter(Boolean);
  },

  // 获取测试套件
  getTestSuite: (suiteId) => testSuites[suiteId],

  // 获取所有测试套件
  getAllTestSuites: () => testSuites,

  // 搜索测试用例
  searchTestCases: (query) => {
    const results = [];
    const searchTerm = query.toLowerCase();

    for (const [taskId, testCase] of Object.entries(testCases)) {
      if (
        testCase.name.toLowerCase().includes(searchTerm) ||
        testCase.description.toLowerCase().includes(searchTerm) ||
        testCase.category.toLowerCase().includes(searchTerm) ||
        testCase.tags?.some((tag) => tag.toLowerCase().includes(searchTerm))
      ) {
        results.push({ id: taskId, ...testCase });
      }
    }

    return results;
  },

  // 获取随机测试用例
  getRandomTestCases: (count = 5) => {
    const allTasks = Object.keys(testCases);
    const selected = [];

    for (let i = 0; i < Math.min(count, allTasks.length); i++) {
      const randomIndex = Math.floor(Math.random() * allTasks.length);
      const taskId = allTasks.splice(randomIndex, 1)[0];
      selected.push({ id: taskId, ...testCases[taskId] });
    }

    return selected;
  },

  // 验证测试用例
  validateTestCase: (taskId) => {
    const testCase = testCases[taskId];
    if (!testCase) {
      return { valid: false, error: "测试用例不存在" };
    }

    const requiredFields = ["name", "description", "category", "difficulty"];
    for (const field of requiredFields) {
      if (!testCase[field]) {
        return { valid: false, error: `缺少必需字段: ${field}` };
      }
    }

    return { valid: true };
  },
};
