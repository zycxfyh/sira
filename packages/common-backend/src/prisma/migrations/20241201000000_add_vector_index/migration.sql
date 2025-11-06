-- 文件路径: packages/common-backend/src/prisma/migrations/20241201000000_add_vector_index/migration.sql
-- 职责: 为 Memory.embedding 字段创建向量索引，提高相似度搜索性能
--
-- 说明:
-- - 使用 pgvector 的 HNSW (Hierarchical Navigable Small World) 索引
-- - HNSW 索引适合高维向量相似度搜索，查询速度快
-- - 索引类型: ivfflat (Inverted File with Flat compression) 也可用，但 HNSW 性能更好
-- - 索引参数:
--   - m: 每个节点的最大连接数（默认 16）
--   - ef_construction: 构建时的搜索范围（默认 64）

-- 创建向量索引（使用 HNSW 算法）
-- 注意：需要先确保 pgvector 扩展已启用（通常在 docker-compose.yml 中的 postgres 镜像已包含）
CREATE INDEX IF NOT EXISTS "Memory_embedding_idx" ON "Memory" 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 创建 gameId + embedding 的复合索引（优化按游戏检索的性能）
CREATE INDEX IF NOT EXISTS "Memory_gameId_embedding_idx" ON "Memory" ("gameId")
WHERE embedding IS NOT NULL;

-- 添加注释说明索引用途
COMMENT ON INDEX "Memory_embedding_idx" IS 'HNSW index for vector similarity search on Memory embeddings';
COMMENT ON INDEX "Memory_gameId_embedding_idx" IS 'Composite index for filtering by gameId before vector search';

