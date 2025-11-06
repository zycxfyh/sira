// 文件路径: packages/common-backend/src/ai/context-summarizer.service.ts
// 职责: 智能上下文摘要服务，解决长对话的上下文窗口限制问题
//
// 核心功能:
// 1. 实现摘要算法：保留最近 N 条完整对话 + 之前 M 条摘要
// 2. 使用 AI 生成对话摘要，保留关键信息
// 3. 摘要缓存机制，避免重复计算
// 4. 可配置的压缩比例和保留策略
//
// 设计原则:
// - 保留最近对话的完整性（保持连贯性）
// - 压缩历史对话为摘要（节省 token）
// - 智能摘要保留关键信息（角色、事件、决策）
// - 缓存摘要结果（避免重复 AI 调用）

import { PromptTemplate } from '@langchain/core/prompts';
import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
// [注意] MemoryHierarchyService 由调用方（如 NarrativeService）使用，不在这里导入
import type { User } from '@prisma/client';
import { z } from 'zod';
import { callAiWithGuard } from './ai-guard';
import type { DynamicAiSchedulerService } from './dynamic-ai-scheduler.service';
import type { VectorSearchService } from './vector-search.service';

/**
 * 对话条目接口
 */
export interface ConversationEntry {
  /** 角色（如 'player', 'narrator', 'npc'） */
  role: string;
  /** 内容 */
  content: string;
  /** 时间戳 */
  timestamp?: Date;
  /** 元数据（可选） */
  metadata?: Record<string, unknown>;
}

/**
 * 摘要结果接口
 */
export interface SummaryResult {
  /** 摘要文本 */
  summary: string;
  /** 摘要的对话条目数量 */
  entryCount: number;
  /** 摘要生成时间 */
  timestamp: Date;
  /** 关键信息提取 */
  keyPoints?: string[];
}

/**
 * 上下文压缩结果
 */
export interface CompressedContext {
  /** 完整的最近对话条目 */
  recentEntries: ConversationEntry[];
  /** 历史摘要 */
  summaries: SummaryResult[];
  /** 总 token 估算 */
  estimatedTokens?: number;
}

/**
 * 摘要配置
 */
export interface SummarizationConfig {
  /** 保留最近完整对话的条数（默认 10） */
  recentEntriesCount: number;
  /** 保留摘要的数量（默认 3） */
  summaryCount: number;
  /** 每个摘要包含的对话条数（默认 20） */
  entriesPerSummary: number;
  /** 是否启用摘要缓存（默认 true） */
  enableCache: boolean;
  /** 摘要缓存过期时间（毫秒，默认 1小时） */
  cacheExpiryMs: number;
}

// 摘要 Schema
const summarySchema = z.object({
  summary: z.string().describe('对话的简洁摘要，保留关键信息和事件'),
  keyPoints: z.array(z.string()).optional().describe('关键信息点列表（如角色、事件、决策等）'),
});

@Injectable()
export class ContextSummarizerService {
  private readonly logger = new Logger(ContextSummarizerService.name);

  // 摘要缓存：key = 对话条目的哈希，value = 摘要结果和过期时间
  private readonly summaryCache = new Map<string, { result: SummaryResult; expiry: number }>();

  private readonly config: SummarizationConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly scheduler: DynamicAiSchedulerService,
    private readonly vectorSearch: VectorSearchService, // [新增] 向量检索服务
    // [注意] memoryHierarchy 目前由调用方（如 NarrativeService）使用来获取活跃记忆
    // 这里暂时不直接使用，但保留注入以便未来扩展（如根据重要性调整压缩策略）
    // private readonly memoryHierarchy: MemoryHierarchyService,
  ) {
    // 从环境变量读取配置，提供默认值
    this.config = {
      recentEntriesCount: this.configService.get<number>('CONTEXT_RECENT_ENTRIES_COUNT') || 10,
      summaryCount: this.configService.get<number>('CONTEXT_SUMMARY_COUNT') || 3,
      entriesPerSummary: this.configService.get<number>('CONTEXT_ENTRIES_PER_SUMMARY') || 20,
      enableCache: this.configService.get<boolean>('CONTEXT_SUMMARY_CACHE_ENABLED') ?? true,
      cacheExpiryMs: this.configService.get<number>('CONTEXT_SUMMARY_CACHE_EXPIRY_MS') || 3600000, // 1小时
    };

    this.logger.log(
      `ContextSummarizerService initialized with config: ${JSON.stringify(this.config)}`,
    );
  }

  /**
   * 压缩对话上下文（增强版，支持向量检索）
   *
   * @param entries - 完整的对话条目列表（按时间顺序）
   * @param user - 用户信息（用于 AI 调用）
   * @param gameId - [新增] 游戏 ID，用于向量检索相关记忆
   * @param currentContext - [新增] 当前上下文文本，用于语义检索
   * @returns 压缩后的上下文（最近条目 + 摘要 + 检索到的相关记忆）
   */
  async compressContext(
    entries: ConversationEntry[],
    user: User,
    gameId?: string,
    currentContext?: string,
  ): Promise<CompressedContext> {
    // [新增] 如果提供了 gameId 和当前上下文，尝试使用向量检索找到相关记忆
    let retrievedMemories: string[] = [];
    if (
      gameId &&
      currentContext &&
      this.configService.get<boolean>('VECTOR_SEARCH_ENABLED', true)
    ) {
      try {
        const searchResults = await this.vectorSearch.searchSimilarMemories(
          currentContext,
          gameId,
          user,
          {
            limit: 3, // 检索最相关的 3 条记忆
            minSimilarity: 0.7,
          },
        );
        retrievedMemories = searchResults.map((result) => result.content);
        this.logger.debug(
          `Retrieved ${retrievedMemories.length} relevant memories via vector search`,
        );
      } catch (error) {
        this.logger.warn(
          `Vector search failed, falling back to time-based retrieval:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (entries.length <= this.config.recentEntriesCount) {
      // 如果条目数不超过保留数，直接返回全部
      this.logger.debug(`Context is short (${entries.length} entries), no compression needed`);
      // [注意] formatCompressedContext 需要 CompressedContext，但这里需要返回字符串
      // 为了兼容性，我们保持返回类型不变，但实际使用时需要通过 formatCompressedContext 格式化
      return {
        recentEntries: entries,
        summaries: [],
      };
    }

    // 分离最近条目和历史条目
    const recentEntries = entries.slice(-this.config.recentEntriesCount);
    const historicalEntries = entries.slice(0, entries.length - this.config.recentEntriesCount);

    this.logger.debug(
      `Compressing context: ${entries.length} total entries, ` +
        `${recentEntries.length} recent, ${historicalEntries.length} historical`,
    );

    // 对历史条目进行分块并生成摘要
    const summaries: SummaryResult[] = [];
    const chunks = this.chunkEntries(historicalEntries, this.config.entriesPerSummary);

    // 并行生成摘要（但限制并发数以避免过载）
    const summaryPromises = chunks.map((chunk) => this.generateSummary(chunk, user));
    const chunkSummaries = await Promise.all(summaryPromises);

    // 只保留最近的 N 个摘要
    summaries.push(...chunkSummaries.slice(-this.config.summaryCount));

    this.logger.log(
      `Context compressed: ${recentEntries.length} recent entries + ${summaries.length} summaries` +
        (retrievedMemories.length > 0 ? ` + ${retrievedMemories.length} retrieved memories` : ''),
    );

    return {
      recentEntries,
      summaries,
    };
  }

  /**
   * 将条目分块
   */
  private chunkEntries(entries: ConversationEntry[], chunkSize: number): ConversationEntry[][] {
    const chunks: ConversationEntry[][] = [];
    for (let i = 0; i < entries.length; i += chunkSize) {
      chunks.push(entries.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 生成对话摘要
   *
   * @param entries - 要摘要的对话条目
   * @param user - 用户信息
   * @returns 摘要结果
   */
  async generateSummary(entries: ConversationEntry[], user: User): Promise<SummaryResult> {
    // 检查缓存
    if (this.config.enableCache) {
      const cacheKey = this.generateCacheKey(entries);
      const cached = this.summaryCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        this.logger.debug(`Using cached summary for ${entries.length} entries`);
        return cached.result;
      }
    }

    // 生成摘要
    this.logger.debug(`Generating summary for ${entries.length} entries`);

    const conversationText = entries.map((entry) => `[${entry.role}]: ${entry.content}`).join('\n');

    const provider = await this.scheduler.getProviderForRole(
      user,
      'narrative_synthesis', // 使用叙事 AI 生成摘要，保持风格一致
    );

    const prompt = new PromptTemplate({
      template: `你是一个专业的对话摘要助手。请将以下对话历史压缩为简洁的摘要，保留关键信息和事件。

对话历史:
{conversation}

要求:
- 摘要应该保留关键角色、重要事件、主要决策
- 摘要应该简洁但信息完整
- 使用第三人称叙述
- 摘要长度应该约为原对话的 10-20%

请生成摘要和关键信息点。`,
      inputVariables: ['conversation'],
    });

    const chain = prompt.pipe(provider.model);

    const result = await callAiWithGuard(chain, { conversation: conversationText }, summarySchema);

    const summaryResult: SummaryResult = {
      summary: result.summary,
      entryCount: entries.length,
      timestamp: new Date(),
      keyPoints: result.keyPoints,
    };

    // 缓存结果
    if (this.config.enableCache) {
      const cacheKey = this.generateCacheKey(entries);
      this.summaryCache.set(cacheKey, {
        result: summaryResult,
        expiry: Date.now() + this.config.cacheExpiryMs,
      });
      this.logger.debug(`Cached summary for ${entries.length} entries`);
    }

    return summaryResult;
  }

  /**
   * 生成缓存键（基于条目内容的简单哈希）
   */
  private generateCacheKey(entries: ConversationEntry[]): string {
    const content = entries.map((e) => `${e.role}:${e.content}`).join('|');
    // 简单的哈希（生产环境可使用更强大的哈希算法）
    return Buffer.from(content).toString('base64').slice(0, 64);
  }

  /**
   * 将压缩后的上下文格式化为字符串（用于注入到 Prompt）
   *
   * @param compressed - 压缩后的上下文
   * @param retrievedMemories - [新增] 通过向量检索到的相关记忆
   * @returns 格式化的上下文字符串
   */
  formatCompressedContext(compressed: CompressedContext, retrievedMemories?: string[]): string {
    const parts: string[] = [];

    // [新增] 添加通过向量检索到的相关记忆
    if (retrievedMemories && retrievedMemories.length > 0) {
      parts.push('## 相关历史记忆（语义检索）');
      retrievedMemories.forEach((memory, index) => {
        parts.push(`${index + 1}. ${memory}`);
      });
      parts.push('\n---\n');
    }

    // 添加历史摘要
    if (compressed.summaries.length > 0) {
      parts.push('## 历史对话摘要');
      compressed.summaries.forEach((summary, index) => {
        parts.push(`\n### 摘要 ${index + 1} (${summary.entryCount} 条对话)`);
        parts.push(summary.summary);
        if (summary.keyPoints && summary.keyPoints.length > 0) {
          parts.push('\n关键信息:');
          for (const point of summary.keyPoints) {
            parts.push(`- ${point}`);
          }
        }
      });
      parts.push('\n---\n');
    }

    // 添加最近完整对话
    if (compressed.recentEntries.length > 0) {
      parts.push('## 最近完整对话');
      compressed.recentEntries.forEach((entry) => {
        parts.push(`[${entry.role}]: ${entry.content}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * [新增] 压缩上下文并格式化（便捷方法）
   * 这个方法结合了 compressContext 和 formatCompressedContext，并处理向量检索
   */
  async compressAndFormatContext(
    entries: ConversationEntry[],
    user: User,
    gameId?: string,
    currentContext?: string,
  ): Promise<string> {
    const compressed = await this.compressContext(entries, user, gameId, currentContext);

    // 重新获取检索到的记忆（从 compressContext 的内部逻辑中提取）
    // 注意：由于 compressContext 返回的是 CompressedContext，我们需要重新检索
    let retrievedMemories: string[] = [];
    if (
      gameId &&
      currentContext &&
      this.configService.get<boolean>('VECTOR_SEARCH_ENABLED', true)
    ) {
      try {
        const searchResults = await this.vectorSearch.searchSimilarMemories(
          currentContext,
          gameId,
          user,
          {
            limit: 3,
            minSimilarity: 0.7,
          },
        );
        retrievedMemories = searchResults.map((result) => result.content);
      } catch {
        // 忽略错误，继续格式化
      }
    }

    return this.formatCompressedContext(compressed, retrievedMemories);
  }

  /**
   * 清理过期的缓存条目
   */
  clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;
    for (const [key, value] of this.summaryCache.entries()) {
      if (value.expiry <= now) {
        this.summaryCache.delete(key);
        cleared++;
      }
    }
    if (cleared > 0) {
      this.logger.debug(`Cleared ${cleared} expired cache entries`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.summaryCache.size,
      entries: Array.from(this.summaryCache.values()).reduce(
        (sum, v) => sum + v.result.entryCount,
        0,
      ),
    };
  }
}
