// 文件路径: packages/common-backend/src/vector/qdrant.service.ts
// 职责: 封装Qdrant向量数据库操作，提供类型安全的记忆存储和检索功能

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

// Qdrant向量搜索结果接口
export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

// 记忆点接口
export interface MemoryPoint {
  id: string;
  vector: number[];
  payload: {
    gameId: string;
    content: string;
    importance: string;
    createdAt: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: any; // 使用any类型避免导入问题
  private readonly collectionName = 'game_memories';
  private readonly vectorSize = 1536;

  constructor() {
    // 延迟初始化，在onModuleInit中进行
  }

  async onModuleInit() {
    try {
      // 动态导入QdrantClient
      const { QdrantClient } = await import('@qdrant/js-client-rest');

      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      const qdrantApiKey = process.env.QDRANT_API_KEY;

      this.client = new QdrantClient({
        url: qdrantUrl,
        ...(qdrantApiKey && { apiKey: qdrantApiKey })
      });

      await this.ensureCollection();
      this.logger.log(`Qdrant service initialized. Collection: ${this.collectionName}`);
    } catch (error) {
      this.logger.error('Failed to initialize Qdrant service', error);
      throw error;
    }
  }

  private async ensureCollection(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c: any) => c.name === this.collectionName);

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: { size: this.vectorSize, distance: 'Cosine' },
        });
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: 'gameId',
          field_schema: 'keyword',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to ensure collection: ${errorMessage}`);
      throw error;
    }
  }

  async upsertMemory(memory: MemoryPoint): Promise<void> {
    await this.client.upsert(this.collectionName, {
      points: [{ id: memory.id, vector: memory.vector, payload: memory.payload }],
    });
  }

  async searchSimilarMemories(
    vector: number[],
    gameId: string,
    options: { limit?: number; scoreThreshold?: number } = {},
  ): Promise<QdrantSearchResult[]> {
    const { limit = 10, scoreThreshold = 0.7 } = options;
    const searchResult = await this.client.search(this.collectionName, {
      vector,
      filter: { must: [{ key: 'gameId', match: { value: gameId } }] },
      limit,
      score_threshold: scoreThreshold,
      with_payload: true,
    });
    return searchResult.map((r: any) => ({ id: r.id as string, score: r.score, payload: r.payload || {} }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch {
      return false;
    }
  }
}
