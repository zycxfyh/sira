/**
 * Sira AI网关 - 提示词模板管理模块
 * 提供预设提示词模板，支持变量替换和智能提示
 */

const fs = require('fs').promises;
const path = require('path');

class PromptTemplateManager {
    constructor(options = {}) {
        this.options = {
            templatesDir: options.templatesDir || path.join(process.cwd(), 'templates', 'prompts'),
            enableCaching: options.enableCaching !== false,
            maxCacheSize: options.maxCacheSize || 100,
            ...options
        };

        // 模板缓存
        this.templateCache = new Map();
        this.cacheTimestamps = new Map();

        // 模板分类
        this.templates = {
            creative: {},      // 创意写作
            coding: {},        // 编程开发
            business: {},      // 商业应用
            education: {},     // 教育学习
            communication: {}, // 沟通交流
            analysis: {},      // 数据分析
            custom: {}         // 用户自定义
        };

        // 变量处理器
        this.variableProcessors = {
            date: () => new Date().toLocaleDateString('zh-CN'),
            time: () => new Date().toLocaleTimeString('zh-CN'),
            datetime: () => new Date().toLocaleString('zh-CN'),
            random: (min = 1, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
            uuid: () => require('crypto').randomUUID()
        };

        this.initializeTemplates();
    }

    /**
     * 初始化内置模板
     */
    async initializeTemplates() {
        // 创意写作模板
        this.templates.creative = {
            story_writer: {
                name: "故事作家",
                description: "专业的小说和故事写作助手",
                template: `你是一位专业的故事作家，请根据以下要求创作一个引人入胜的故事：

故事主题：{{theme}}
故事类型：{{genre}}
主要人物：{{characters}}
故事背景：{{setting}}
关键情节：{{plot_points}}

要求：
1. 故事结构完整，包括开头、发展、高潮、结局
2. 人物性格鲜明，心理描写生动
3. 情节跌宕起伏，引人入胜
4. 语言优美，富有感染力
5. 字数控制在{{word_count}}字左右

请开始创作：`,
                variables: ['theme', 'genre', 'characters', 'setting', 'plot_points', 'word_count'],
                defaultValues: {
                    theme: '友谊与背叛',
                    genre: '奇幻冒险',
                    characters: '年轻的魔法师、神秘的导师、邪恶的反派',
                    setting: '中世纪魔法王国',
                    plot_points: '发现隐藏的秘密、面临艰难选择、最终的救赎',
                    word_count: '2000'
                },
                tags: ['小说', '故事', '创意写作', '文学创作']
            },

            poem_writer: {
                name: "诗歌创作者",
                description: "专业的诗歌创作助手",
                template: `你是一位才华横溢的诗人，请根据以下要求创作一首优美的诗歌：

诗歌主题：{{theme}}
诗歌体裁：{{form}}（如：自由诗、十四行诗、现代诗等）
情感基调：{{tone}}
关键词：{{keywords}}
诗的长度：{{length}}行

创作要求：
1. 语言优美，富有韵律感
2. 意象鲜明，生动传神
3. 情感真挚，感染力强
4. 结构和谐，层次分明

请创作诗歌：`,
                variables: ['theme', 'form', 'tone', 'keywords', 'length'],
                defaultValues: {
                    theme: '秋天的思念',
                    form: '自由诗',
                    tone: ' melancholic',
                    keywords: '落叶、思念、时光、季节',
                    length: '20'
                },
                tags: ['诗歌', '文学', '创意写作', '艺术']
            },

            script_writer: {
                name: "剧本作家",
                description: "专业的剧本和对话创作助手",
                template: `你是一位经验丰富的剧本作家，请根据以下要求创作一段精彩的剧本片段：

剧本类型：{{genre}}
场景设定：{{setting}}
主要人物：{{characters}}
情节概要：{{plot}}
对话风格：{{dialogue_style}}

创作要求：
1. 场景描述生动具体
2. 人物对话自然流畅
3. 情节发展合理有序
4. 符合剧本格式规范
5. 长度控制在{{duration}}分钟的剧本量

请开始创作剧本：`,
                variables: ['genre', 'setting', 'characters', 'plot', 'dialogue_style', 'duration'],
                defaultValues: {
                    genre: '现代戏剧',
                    setting: '咖啡馆，夜晚',
                    characters: 'Alex（男，28岁，程序员），Sarah（女，26岁，设计师）',
                    plot: '两个陌生人在咖啡馆相遇，分享彼此的故事',
                    dialogue_style: '自然、现代、富有情感',
                    duration: '5'
                },
                tags: ['剧本', '对话', '影视', '表演']
            }
        };

        // 编程开发模板
        this.templates.coding = {
            code_explanation: {
                name: "代码解释助手",
                description: "详细解释代码功能和原理",
                template: `你是一位经验丰富的程序员，请详细解释以下代码的功能、原理和使用方法：

编程语言：{{language}}
代码功能：{{function}}
代码片段：
```
{{code}}
```

请从以下几个方面进行详细解释：

1. **功能概述**：这段代码实现了什么功能？
2. **代码结构**：主要组成部分和模块划分
3. **关键逻辑**：核心算法和业务逻辑
4. **技术要点**：使用的关键技术和设计模式
5. **使用方法**：如何使用这段代码
6. **潜在问题**：可能存在的问题和改进建议

请用清晰易懂的语言进行解释，适合{{audience}}水平的开发者理解。`,
                variables: ['language', 'function', 'code', 'audience'],
                defaultValues: {
                    language: 'JavaScript',
                    function: '用户数据验证',
                    code: 'function validateUser(user) { return user.name && user.email; }',
                    audience: '初级'
                },
                tags: ['代码解释', '编程', '技术文档', '学习']
            },

            bug_fixer: {
                name: "Bug修复助手",
                description: "分析和修复代码中的bug",
                template: `你是一位专业的代码调试专家，请帮我分析和修复以下代码中的问题：

编程语言：{{language}}
问题描述：{{problem}}
错误信息：{{error_message}}

有问题的代码：
```
{{code}}
```

请按以下步骤进行分析：

1. **问题诊断**：
   - 错误的具体原因
   - 影响范围和严重程度
   - 可能的触发条件

2. **修复方案**：
   - 具体的修复代码
   - 修复原理说明
   - 最佳实践建议

3. **预防措施**：
   - 如何避免类似问题
   - 代码质量改进建议
   - 测试建议

请提供完整的修复后的代码和详细的解释。`,
                variables: ['language', 'problem', 'error_message', 'code'],
                defaultValues: {
                    language: 'JavaScript',
                    problem: '函数返回undefined',
                    error_message: 'TypeError: Cannot read property of undefined',
                    code: 'function getUserName(user) { return user.name; }'
                },
                tags: ['Bug修复', '调试', '代码质量', '问题解决']
            },

            code_generator: {
                name: "代码生成器",
                description: "根据需求生成高质量代码",
                template: `你是一位资深的软件工程师，请根据以下需求生成高质量的代码：

项目类型：{{project_type}}
编程语言：{{language}}
功能需求：{{requirements}}
技术栈：{{tech_stack}}
代码质量要求：{{quality_requirements}}

具体要求：
1. **代码结构**：清晰的模块化设计
2. **注释文档**：详细的代码注释和文档
3. **错误处理**：完善的异常处理机制
4. **性能优化**：高效的算法和数据结构
5. **可维护性**：易于理解和维护的代码风格
6. **测试覆盖**：包含单元测试示例

请生成完整的、可直接运行的代码，并附上使用说明。`,
                variables: ['project_type', 'language', 'requirements', 'tech_stack', 'quality_requirements'],
                defaultValues: {
                    project_type: 'Web应用',
                    language: 'JavaScript',
                    requirements: '用户注册和登录功能',
                    tech_stack: 'Node.js, Express, MongoDB',
                    quality_requirements: '生产级别，可扩展，高性能'
                },
                tags: ['代码生成', '软件开发', '架构设计', '最佳实践']
            }
        };

        // 商业应用模板
        this.templates.business = {
            email_writer: {
                name: "商务邮件撰写",
                description: "专业的商务邮件撰写助手",
                template: `你是一位专业的商务沟通专家，请帮我撰写一封商务邮件：

邮件类型：{{email_type}}
收件人：{{recipient}}
发件人：{{sender}}
邮件主题：{{subject}}
邮件目的：{{purpose}}

关键信息：
{{key_points}}

语气要求：{{tone}}
语言风格：{{language_style}}
长度要求：{{length}}

请撰写完整的邮件内容，包括：
1. 合适的称呼
2. 清晰的引言
3. 详细的正文内容
4. 明确的行动呼吁
5. 专业的结束语`,
                variables: ['email_type', 'recipient', 'sender', 'subject', 'purpose', 'key_points', 'tone', 'language_style', 'length'],
                defaultValues: {
                    email_type: '商务合作',
                    recipient: '尊敬的客户',
                    sender: '您的合作伙伴',
                    subject: '关于合作事宜的讨论',
                    purpose: '探讨潜在的合作机会',
                    key_points: '项目介绍、合作优势、后续行动',
                    tone: '专业、友好、积极',
                    language_style: '正式、简洁、有说服力',
                    length: '适中（200-300字）'
                },
                tags: ['商务邮件', '沟通', '专业写作', '客户服务']
            },

            report_writer: {
                name: "报告撰写助手",
                description: "专业的商务报告撰写",
                template: `你是一位经验丰富的商业分析师，请根据以下要求撰写一份专业的商务报告：

报告类型：{{report_type}}
报告主题：{{subject}}
目标读者：{{audience}}
报告目的：{{purpose}}

数据和信息：
{{data_points}}

报告结构要求：
1. **执行摘要**：报告主要发现和建议
2. **背景介绍**：相关背景信息和上下文
3. **分析内容**：详细的数据分析和解读
4. **发现与洞察**：关键发现和商业洞察
5. **建议方案**：具体的行动建议
6. **结论总结**：报告总结和展望

写作要求：
- 逻辑清晰，结构分明
- 数据准确，分析客观
- 语言专业，表述精准
- 建议可操作，切实可行

请撰写完整的报告内容。`,
                variables: ['report_type', 'subject', 'audience', 'purpose', 'data_points'],
                defaultValues: {
                    report_type: '市场分析报告',
                    subject: '2024年AI市场发展趋势',
                    audience: '公司管理层',
                    purpose: '为公司战略决策提供参考',
                    data_points: '市场规模数据、增长趋势、技术发展、竞争格局、投资机会'
                },
                tags: ['商务报告', '市场分析', '战略规划', '数据分析']
            }
        };

        // 教育学习模板
        this.templates.education = {
            lesson_planner: {
                name: "课程设计助手",
                description: "专业的课程和教学计划设计",
                template: `你是一位资深的教学设计专家，请根据以下要求设计一堂完整的课程：

课程主题：{{subject}}
学生年级：{{grade_level}}
课程时长：{{duration}}
学习目标：{{learning_objectives}}

学生特点：
{{student_characteristics}}

教学资源：
{{available_resources}}

请设计完整的课程计划，包括：

1. **课程概述**：课程目标、重要性和适用性
2. **教学目标**：具体的、可衡量的学习目标
3. **教学内容**：详细的课程内容和知识点
4. **教学方法**：互动方式和教学策略
5. **教学活动**：具体的课堂活动和练习
6. **评估方式**：学习效果的评估方法
7. **教学资源**：所需的材料和资源
8. **时间安排**：详细的课程时间分配

请确保课程设计符合教育教学原则，适合目标学生群体。`,
                variables: ['subject', 'grade_level', 'duration', 'learning_objectives', 'student_characteristics', 'available_resources'],
                defaultValues: {
                    subject: '人工智能基础',
                    grade_level: '高中生',
                    duration: '45分钟',
                    learning_objectives: '理解AI基本概念，认识AI应用场景',
                    student_characteristics: '对技术感兴趣，基础数学知识良好',
                    available_resources: '电脑、多媒体设备、互联网接入'
                },
                tags: ['课程设计', '教学计划', '教育', '学习活动']
            },

            quiz_generator: {
                name: "测验题生成器",
                description: "自动生成高质量的测验题目",
                template: `你是一位专业的教育评估专家，请根据以下要求生成一套测验题目：

测验主题：{{subject}}
难度等级：{{difficulty}}
题目类型：{{question_types}}
题目数量：{{question_count}}
目标学生：{{target_students}}

知识点范围：
{{knowledge_points}}

测验要求：
1. **题目质量**：准确、清晰、无歧义
2. **难度适中**：符合目标难度等级
3. **知识覆盖**：全面覆盖指定知识点
4. **类型多样**：包含多种题型
5. **答案详尽**：提供详细的答案和解析

请生成完整的测验题，包括：
- 题目内容
- 选项（选择题）
- 标准答案
- 详细解析
- 分值建议

确保测验题具有良好的区分度和信度。`,
                variables: ['subject', 'difficulty', 'question_types', 'question_count', 'target_students', 'knowledge_points'],
                defaultValues: {
                    subject: '计算机网络基础',
                    difficulty: '中级',
                    question_types: '选择题、判断题、简答题',
                    question_count: '20',
                    target_students: '大学本科生',
                    knowledge_points: 'TCP/IP协议、HTTP/HTTPS、网络安全、路由算法'
                },
                tags: ['测验题', '教育评估', '学习测试', '教学辅助']
            }
        };

        // 沟通交流模板
        this.templates.communication = {
            meeting_summarizer: {
                name: "会议纪要生成",
                description: "自动生成会议纪要和行动项",
                template: `你是一位专业的行政助理，请根据会议记录生成详细的会议纪要：

会议主题：{{meeting_topic}}
会议时间：{{meeting_time}}
参会人员：{{attendees}}
会议主持：{{facilitator}}

会议记录：
{{meeting_notes}}

请生成完整的会议纪要，包括：

1. **会议基本信息**
   - 会议主题和目的
   - 时间、地点、参会人员
   - 会议主持人和记录员

2. **讨论要点**
   - 主要讨论议题
   - 关键决策和结论
   - 重要数据和信息

3. **行动项**
   - 具体任务和负责人
   - 完成时间和优先级
   - 后续跟进计划

4. **后续工作**
   - 需要进一步讨论的事项
   - 相关文件和资料
   - 下次会议安排

请确保纪要内容完整、准确、条理清晰。`,
                variables: ['meeting_topic', 'meeting_time', 'attendees', 'facilitator', 'meeting_notes'],
                defaultValues: {
                    meeting_topic: 'Q4项目进度评审',
                    meeting_time: '{{date}} 下午2:00-4:00',
                    attendees: '项目经理、开发团队、产品经理、测试团队',
                    facilitator: '项目经理',
                    meeting_notes: '项目进度85%，遇到技术难题，需要额外资源；客户需求变更，需要调整计划；建议增加自动化测试覆盖率'
                },
                tags: ['会议纪要', '行政管理', '项目管理', '沟通记录']
            },

            feedback_analyzer: {
                name: "反馈分析助手",
                description: "分析用户反馈并提供改进建议",
                template: `你是一位专业的用户体验分析师，请分析以下用户反馈并提供改进建议：

产品/服务名称：{{product_name}}
反馈来源：{{feedback_source}}
反馈内容：
{{feedback_content}}

分析要求：
1. **情感分析**：用户的情感倾向（正面/负面/中性）
2. **关键问题**：用户提到的主要问题和痛点
3. **积极反馈**：用户赞赏的方面
4. **改进建议**：具体的改进措施和优先级
5. **行动计划**：可执行的改进步骤

请提供：
- 详细的情感分析结果
- 问题的分类和优先级排序
- 数据驱动的改进建议
- 实施时间表和成功指标

确保分析客观、专业，具有可操作性。`,
                variables: ['product_name', 'feedback_source', 'feedback_content'],
                defaultValues: {
                    product_name: 'AI聊天助手',
                    feedback_source: '用户调查问卷',
                    feedback_content: '响应速度太慢，有时回答不准确，希望能支持更多语言，界面设计比较简陋'
                },
                tags: ['用户反馈', '体验分析', '改进建议', '用户研究']
            }
        };

        // 数据分析模板
        this.templates.analysis = {
            data_interpreter: {
                name: "数据解读助手",
                description: "专业的数据分析和解读",
                template: `你是一位资深的数据分析师，请对以下数据进行专业解读和分析：

数据来源：{{data_source}}
分析目标：{{analysis_goal}}
数据描述：
{{data_description}}

分析数据：
{{data_content}}

请从以下方面进行详细分析：

1. **数据概览**：基本统计信息和数据特征
2. **趋势分析**：时间序列变化和趋势预测
3. **模式识别**：数据中的规律和异常模式
4. **因果分析**：变量间的关系和影响因素
5. **洞察发现**：重要的商业或技术洞察
6. **建议方案**：基于分析结果的具体建议

分析要求：
- 使用专业的数据分析方法
- 提供数据可视化建议
- 确保结论有数据支撑
- 建议具体可行的行动方案

请用清晰的语言呈现分析结果，适合{{audience}}理解。`,
                variables: ['data_source', 'analysis_goal', 'data_description', 'data_content', 'audience'],
                defaultValues: {
                    data_source: '网站访问日志',
                    analysis_goal: '用户行为分析和转化率优化',
                    data_description: '过去30天的网站访问数据，包括PV、UV、停留时间、跳出率等',
                    data_content: 'PV: 15000, UV: 8000, 平均停留时间: 3.5分钟, 跳出率: 45%, 转化率: 2.8%',
                    audience: '产品经理和技术团队'
                },
                tags: ['数据分析', '商业智能', '趋势分析', '洞察发现']
            },

            research_summarizer: {
                name: "研究报告摘要",
                description: "生成研究报告的结构化摘要",
                template: `你是一位专业的科研工作者，请为以下研究内容生成结构化的摘要：

研究领域：{{research_field}}
论文标题：{{paper_title}}
研究机构：{{institution}}
发表时间：{{publication_date}}

论文摘要：
{{abstract}}

研究方法：
{{methodology}}

主要发现：
{{findings}}

请生成以下内容的结构化摘要：

1. **研究背景**：研究问题的提出和重要性
2. **研究方法**：采用的研究方法和技术
3. **核心发现**：主要的实验结果和发现
4. **理论贡献**：对理论发展的贡献
5. **实践意义**：实际应用价值和影响
6. **研究局限**：研究的局限性和未来方向
7. **关键词**：相关的关键词和主题

摘要要求：
- 客观准确，忠实于原文
- 逻辑清晰，层次分明
- 语言精炼，去除冗余
- 突出重点，抓住核心

请用学术性的语言撰写摘要。`,
                variables: ['research_field', 'paper_title', 'institution', 'publication_date', 'abstract', 'methodology', 'findings'],
                defaultValues: {
                    research_field: '人工智能',
                    paper_title: '基于深度学习的图像识别新方法',
                    institution: '清华大学计算机系',
                    publication_date: '2024年3月',
                    abstract: '提出了一种新的深度学习方法用于图像识别任务',
                    methodology: '使用CNN和Transformer的混合架构',
                    findings: '在标准数据集上取得了92.5%的准确率，超过了现有方法'
                },
                tags: ['研究摘要', '学术写作', '文献综述', '科研辅助']
            }
        };

        console.log('✅ 提示词模板库初始化完成，包含', Object.values(this.templates).reduce((sum, cat) => sum + Object.keys(cat).length, 0), '个模板');
    }

    /**
     * 获取模板
     */
    getTemplate(category, templateId) {
        if (!this.templates[category]) {
            throw new Error(`模板分类不存在: ${category}`);
        }

        const template = this.templates[category][templateId];
        if (!template) {
            throw new Error(`模板不存在: ${category}.${templateId}`);
        }

        return template;
    }

    /**
     * 获取所有模板
     */
    getAllTemplates() {
        const result = {};

        for (const [category, templates] of Object.entries(this.templates)) {
            result[category] = {};

            for (const [templateId, template] of Object.entries(templates)) {
                result[category][templateId] = {
                    id: templateId,
                    name: template.name,
                    description: template.description,
                    variables: template.variables,
                    tags: template.tags
                };
            }
        }

        return result;
    }

    /**
     * 获取模板分类
     */
    getCategories() {
        return Object.keys(this.templates);
    }

    /**
     * 获取分类下的模板
     */
    getTemplatesByCategory(category) {
        if (!this.templates[category]) {
            return {};
        }

        return Object.keys(this.templates[category]).map(templateId => ({
            id: templateId,
            name: this.templates[category][templateId].name,
            description: this.templates[category][templateId].description,
            tags: this.templates[category][templateId].tags
        }));
    }

    /**
     * 根据标签搜索模板
     */
    searchTemplatesByTag(tag) {
        const results = [];

        for (const [category, templates] of Object.entries(this.templates)) {
            for (const [templateId, template] of Object.entries(templates)) {
                if (template.tags && template.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))) {
                    results.push({
                        category,
                        id: templateId,
                        name: template.name,
                        description: template.description,
                        tags: template.tags
                    });
                }
            }
        }

        return results;
    }

    /**
     * 渲染模板
     */
    renderTemplate(category, templateId, variables = {}) {
        const template = this.getTemplate(category, templateId);

        // 合并默认值和用户提供的值
        const finalVariables = { ...template.defaultValues, ...variables };

        let rendered = template.template;

        // 替换变量
        for (const [key, value] of Object.entries(finalVariables)) {
            const placeholder = `{{${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
        }

        // 处理特殊变量
        rendered = this.processSpecialVariables(rendered);

        return {
            template: template,
            rendered: rendered,
            variables: finalVariables,
            category: category,
            templateId: templateId
        };
    }

    /**
     * 处理特殊变量
     */
    processSpecialVariables(text) {
        let processed = text;

        // 处理函数调用变量，如 {{date()}}, {{random(1,10)}}
        const functionRegex = /\{\{(\w+)\(([^}]*)\)\}\}/g;
        processed = processed.replace(functionRegex, (match, funcName, args) => {
            if (this.variableProcessors[funcName]) {
                try {
                    const argList = args ? args.split(',').map(arg => arg.trim()) : [];
                    return this.variableProcessors[funcName](...argList);
                } catch (error) {
                    console.warn(`变量函数处理失败: ${funcName}`, error);
                    return match;
                }
            }
            return match;
        });

        // 处理简单变量，如 {{date}}
        const simpleRegex = /\{\{(\w+)\}\}/g;
        processed = processed.replace(simpleRegex, (match, varName) => {
            if (this.variableProcessors[varName]) {
                try {
                    return this.variableProcessors[varName]();
                } catch (error) {
                    console.warn(`简单变量处理失败: ${varName}`, error);
                    return match;
                }
            }
            return match;
        });

        return processed;
    }

    /**
     * 验证模板变量
     */
    validateTemplateVariables(category, templateId, variables = {}) {
        const template = this.getTemplate(category, templateId);
        const missing = [];
        const invalid = [];

        // 检查必需变量
        for (const variable of template.variables) {
            if (!variables[variable] && !template.defaultValues[variable]) {
                missing.push(variable);
            }
        }

        // 检查变量值有效性
        for (const [key, value] of Object.entries(variables)) {
            if (typeof value !== 'string' && typeof value !== 'number') {
                invalid.push(`${key}: 必须是字符串或数字`);
            }
        }

        return {
            valid: missing.length === 0 && invalid.length === 0,
            missing,
            invalid,
            template: template
        };
    }

    /**
     * 添加自定义模板
     */
    addCustomTemplate(category, templateId, templateData) {
        if (!this.templates[category]) {
            this.templates[category] = {};
        }

        // 验证模板数据
        const requiredFields = ['name', 'description', 'template', 'variables'];
        for (const field of requiredFields) {
            if (!templateData[field]) {
                throw new Error(`模板缺少必需字段: ${field}`);
            }
        }

        this.templates[category][templateId] = {
            ...templateData,
            tags: templateData.tags || ['自定义'],
            defaultValues: templateData.defaultValues || {}
        };

        console.log(`✅ 已添加自定义模板: ${category}.${templateId}`);
        return true;
    }

    /**
     * 删除自定义模板
     */
    removeCustomTemplate(category, templateId) {
        if (!this.templates[category] || !this.templates[category][templateId]) {
            throw new Error(`模板不存在: ${category}.${templateId}`);
        }

        // 不允许删除内置模板
        const template = this.templates[category][templateId];
        if (!template.tags || !template.tags.includes('自定义')) {
            throw new Error('不能删除内置模板');
        }

        delete this.templates[category][templateId];
        console.log(`✅ 已删除自定义模板: ${category}.${templateId}`);
        return true;
    }

    /**
     * 获取模板使用统计
     */
    getUsageStats() {
        const stats = {
            totalCategories: Object.keys(this.templates).length,
            totalTemplates: 0,
            categoryStats: {},
            popularTags: new Map()
        };

        for (const [category, templates] of Object.entries(this.templates)) {
            stats.categoryStats[category] = {
                count: Object.keys(templates).length,
                templates: Object.keys(templates)
            };
            stats.totalTemplates += Object.keys(templates).length;

            // 统计标签
            for (const template of Object.values(templates)) {
                if (template.tags) {
                    template.tags.forEach(tag => {
                        stats.popularTags.set(tag, (stats.popularTags.get(tag) || 0) + 1);
                    });
                }
            }
        }

        stats.popularTags = Object.fromEntries(
            Array.from(stats.popularTags.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
        );

        return stats;
    }

    /**
     * 导出模板配置
     */
    exportTemplates() {
        return {
            templates: this.templates,
            metadata: {
                version: '1.0.0',
                exportTime: new Date().toISOString(),
                totalCategories: Object.keys(this.templates).length,
                totalTemplates: Object.values(this.templates).reduce((sum, cat) => sum + Object.keys(cat).length, 0)
            }
        };
    }

    /**
     * 导入模板配置
     */
    importTemplates(data) {
        if (data.templates) {
            // 只导入自定义模板，避免覆盖内置模板
            for (const [category, templates] of Object.entries(data.templates)) {
                if (!this.templates[category]) {
                    this.templates[category] = {};
                }

                for (const [templateId, template] of Object.entries(templates)) {
                    if (template.tags && template.tags.includes('自定义')) {
                        this.templates[category][templateId] = template;
                    }
                }
            }
        }

        console.log('✅ 模板配置导入完成');
    }

    /**
     * 获取推荐模板
     */
    getRecommendedTemplates(taskDescription, limit = 5) {
        const recommendations = [];
        const description = taskDescription.toLowerCase();

        for (const [category, templates] of Object.entries(this.templates)) {
            for (const [templateId, template] of Object.entries(templates)) {
                let score = 0;

                // 基于描述匹配度评分
                if (template.description.toLowerCase().includes(description)) score += 3;
                if (template.name.toLowerCase().includes(description)) score += 2;
                if (template.tags && template.tags.some(tag => description.includes(tag.toLowerCase()))) score += 2;

                // 基于标签相关性评分
                const relevantTags = {
                    '写': ['写作', '创作', '文学'],
                    '代码': ['编程', '代码', '开发'],
                    '邮件': ['邮件', '沟通', '商务'],
                    '报告': ['报告', '分析', '总结'],
                    '会议': ['会议', '纪要', '讨论'],
                    '教学': ['教学', '课程', '教育'],
                    '数据': ['数据', '分析', '统计']
                };

                for (const [keyword, tags] of Object.entries(relevantTags)) {
                    if (description.includes(keyword) && template.tags &&
                        template.tags.some(tag => tags.includes(tag))) {
                        score += 1;
                    }
                }

                if (score > 0) {
                    recommendations.push({
                        category,
                        templateId,
                        name: template.name,
                        description: template.description,
                        tags: template.tags,
                        score
                    });
                }
            }
        }

        // 按评分排序并限制数量
        return recommendations
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}

// 创建全局实例
const promptTemplateManager = new PromptTemplateManager();

// 导出类和实例
module.exports = {
    PromptTemplateManager,
    promptTemplateManager
};
