-- 文件路径: packages/common-backend/src/prisma/migrations/20241201000001_add_memory_hierarchy/migration.sql
-- 职责: 为 Memory 模型添加记忆分级策略字段
--
-- 说明:
-- - importance: 重要性等级（core, important, general, temporary）
-- - archivedAt: 归档时间（低重要性记忆归档后标记）
-- - updatedAt: 更新时间字段
-- - 添加复合索引优化查询性能

-- 添加重要性字段（默认值：general）
ALTER TABLE "Memory" ADD COLUMN IF NOT EXISTS "importance" TEXT NOT NULL DEFAULT 'general';

-- 添加归档时间字段
ALTER TABLE "Memory" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- 添加更新时间字段
ALTER TABLE "Memory" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 创建复合索引（gameId + importance），优化按游戏和重要性查询
CREATE INDEX IF NOT EXISTS "Memory_gameId_importance_idx" ON "Memory" ("gameId", "importance");

-- 创建归档时间索引，优化归档查询
CREATE INDEX IF NOT EXISTS "Memory_archivedAt_idx" ON "Memory" ("archivedAt");

-- 添加注释说明字段用途
COMMENT ON COLUMN "Memory"."importance" IS '记忆重要性等级: core(核心), important(重要), general(一般), temporary(临时)';
COMMENT ON COLUMN "Memory"."archivedAt" IS '归档时间，低重要性记忆归档后标记此字段';
COMMENT ON INDEX "Memory_gameId_importance_idx" IS '复合索引，优化按游戏和重要性查询';
COMMENT ON INDEX "Memory_archivedAt_idx" IS '索引，优化归档查询性能';

