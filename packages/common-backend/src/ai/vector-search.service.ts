// 文件路径: packages/common-backend/src/ai/vector-search.service.ts
// 职责: 向量数据库检索服务，基于 pgvector 实现语义相似度搜索
//
// 核心功能:
// 1. 生成文本的 embedding 向量
// 2. 执行向量相似度搜索（使用 pgvector）
// 3. 根据相关性排序返回结果
// 4. 支持相似度阈值过滤
//
// 设计原则:
// - 使用 OpenAI Embeddings API 生成向量
// - 利用 pgvector 的 cosine 相似度搜索
// - 支持可配置的相似度阈值和返回数量
// - 提供性能监控和缓存机制

import { OpenAIEmbeddings } from "@langchain/openai";
import { Injectable, Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { User } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
// import type { DynamicAiSchedulerService } from "./dynamic-ai-scheduler.service"; // 暂时不需要

/**
 * 检索结果接口
 */
export interface VectorSearchResult {
  /** Memory 记录 ID */
  id: string;
  /** 记忆内容 */
  content: string;
  /** 相似度分数（0-1，越高越相似） */
  similarity: number;
  /** 创建时间 */
  createdAt: Date;
  /** 元数据（可选） */
  metadata?: Record<string, unknown>;
}

/**
 * 检索配置
 */
export interface VectorSearchConfig {
  /** 返回的最大结果数量（默认 5） */
  limit: number;
  /** 最小相似度阈值（默认 0.7） */
  minSimilarity: number;
  /** 是否启用缓存（默认 true） */
  enableCache: boolean;
}

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);
  private readonly embeddingsCache = new Map<string, number[]>();

  private readonly config: VectorSearchConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    // private readonly scheduler: DynamicAiSchedulerService, // 暂时不需要调度器
  ) {
    this.config = {
      limit: this.configService.get<number>("VECTOR_SEARCH_LIMIT") || 5,
      minSimilarity:
        this.configService.get<number>("VECTOR_SEARCH_MIN_SIMILARITY") || 0.7,
      enableCache:
        this.configService.get<boolean>("VECTOR_SEARCH_CACHE_ENABLED") ?? true,
    };

    this.logger.log(
      `VectorSearchService initialized with config: ${JSON.stringify(this.config)}`,
    );
  }

  /**
   * 生成文本的 embedding 向量
   *
   * @param text - 要转换为向量的文本
   * @param user - 用户信息（用于选择 AI Provider）
   * @returns embedding 向量（1536 维）
   */
  async generateEmbedding(text: string, user: User): Promise<number[]> {
    // 检查缓存
    if (this.config.enableCache) {
      const cached = this.embeddingsCache.get(text);
      if (cached) {
        this.logger.debug(
          `Using cached embedding for text: ${text.slice(0, 50)}...`,
        );
        return cached;
      }
    }

    try {
      // 获取用户的 AI 配置（优先使用 narrative_synthesis 角色的配置，因为它通常支持 embedding）
      let apiKey: string;
      let baseUrl: string | undefined;

      try {
        // 验证用户是否有有效的AI配置
        const userConfigs = await this.prisma.aiConfiguration.findMany({
          where: { ownerId: user.id },
        });
        if (userConfigs.length === 0) {
          throw new Error("用户没有配置AI提供商，无法进行向量搜索");
        }

        // 从环境变量获取 embedding API 配置
        // 注意：embedding 通常使用专门的 API key
        apiKey =
          this.configService.get<string>("OPENAI_API_KEY") ||
          this.configService.get<string>("EMBEDDING_API_KEY") ||
          "";
        baseUrl =
          this.configService.get<string>("OPENAI_BASE_URL") ||
          this.configService.get<string>("EMBEDDING_BASE_URL") ||
          "https://api.openai.com/v1";
      } catch (error) {
        // 如果无法获取用户配置，使用系统默认
        this.logger.warn(
          `Failed to get user AI config, using system defaults:`,
          error instanceof Error ? error.message : String(error),
        );
        apiKey =
          this.configService.get<string>("OPENAI_API_KEY") ||
          this.configService.get<string>("EMBEDDING_API_KEY") ||
          "";
        baseUrl =
          this.configService.get<string>("OPENAI_BASE_URL") ||
          "https://api.openai.com/v1";
      }

      if (!apiKey) {
        throw new Error(
          "OpenAI API key not found. Please set OPENAI_API_KEY or EMBEDDING_API_KEY environment variable.",
        );
      }

      // 创建 Embeddings 实例
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseUrl,
        },
        modelName: "text-embedding-ada-002", // 1536 维，与 pgvector 配置匹配
      });

      const embedding = await embeddings.embedQuery(text);

      // 验证向量维度（应该是 1536）
      if (embedding.length !== 1536) {
        throw new Error(
          `Unexpected embedding dimension: ${embedding.length}, expected 1536`,
        );
      }

      // 缓存结果
      if (this.config.enableCache) {
        this.embeddingsCache.set(text, embedding);
      }

      this.logger.debug(
        `Generated embedding for text: ${text.slice(0, 50)}... (dim: ${embedding.length})`,
      );
      return embedding;
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to generate embedding vector: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 执行向量相似度搜索
   *
   * @param queryText - 查询文本
   * @param gameId - 游戏 ID（限制搜索范围）
   * @param user - 用户信息
   * @param options - 可选的检索配置
   * @returns 按相似度排序的检索结果
   */
  async searchSimilarMemories(
    queryText: string,
    gameId: string,
    user: User,
    options?: Partial<VectorSearchConfig>,
  ): Promise<VectorSearchResult[]> {
    const startTime = Date.now();

    try {
      // 生成查询文本的 embedding
      const queryEmbedding = await this.generateEmbedding(queryText, user);

      // 执行向量相似度搜索
      // pgvector 使用 cosine 相似度，我们使用 `1 - cosine_distance` 作为相似度分数
      // 其中 <=> 是 cosine distance 运算符
      const minSimilarity = options?.minSimilarity ?? this.config.minSimilarity;
      const limit = options?.limit ?? this.config.limit;

      // 将 embedding 数组转换为 PostgreSQL vector 格式
      const embeddingStr = `[${queryEmbedding.join(",")}]`;

      // 使用 $queryRawUnsafe 执行原始 SQL（因为需要动态插入向量值）
      const results = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          content: string;
          createdAt: Date;
          similarity: number;
        }>
      >(
        `SELECT 
          id,
          content,
          "createdAt",
          1 - (embedding <=> $1::vector) AS similarity
        FROM "Memory"
        WHERE 
          "gameId" = $2
          AND embedding IS NOT NULL
          AND (1 - (embedding <=> $1::vector)) >= $3
        ORDER BY embedding <=> $1::vector
        LIMIT $4`,
        embeddingStr,
        gameId,
        minSimilarity,
        limit,
      );

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Vector search completed in ${duration}ms, found ${results.length} results`,
      );

      // 转换为返回格式
      return results.map((result) => ({
        id: result.id,
        content: result.content,
        similarity: Number(result.similarity),
        createdAt: result.createdAt,
      }));
    } catch (error) {
      this.logger.error(
        `Vector search failed:`,
        error instanceof Error ? error.message : String(error),
      );
      // 如果向量搜索失败，返回空数组（优雅降级）
      return [];
    }
  }

  /**
   * 为 Memory 记录生成并存储 embedding
   *
   * @param memoryId - Memory 记录 ID
   * @param content - 记忆内容
   * @param user - 用户信息
   */
  async generateAndStoreEmbedding(
    memoryId: string,
    content: string,
    user: User,
  ): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content, user);

      // 使用 Prisma 的原始查询更新 embedding
      // 注意：Prisma 不支持直接更新 vector 类型，需要使用原始 SQL
      await this.prisma.$executeRaw`
        UPDATE "Memory"
        SET embedding = ${JSON.stringify(embedding)}::vector
        WHERE id = ${memoryId}
      `;

      this.logger.debug(`Stored embedding for memory ${memoryId}`);
    } catch (error) {
      this.logger.error(
        `Failed to generate and store embedding for memory ${memoryId}:`,
        error instanceof Error ? error.message : String(error),
      );
      // 不抛出异常，允许记忆在没有 embedding 的情况下继续存在
    }
  }

  /**
   * 清理过期的缓存
   */
  clearCache(): void {
    this.embeddingsCache.clear();
    this.logger.debug("Embeddings cache cleared");
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number } {
    return {
      size: this.embeddingsCache.size,
    };
  }
}
