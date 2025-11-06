-- 数据库回滚脚本: 001 - 初始表结构
-- 版本: v1.0.0
-- 描述: 删除初始表结构

BEGIN;

-- 删除表 (按依赖关系逆序删除)
DROP TABLE IF EXISTS ai_settings CASCADE;
DROP TABLE IF EXISTS memory CASCADE;
DROP TABLE IF EXISTS game_sessions CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除自定义函数
DROP FUNCTION IF EXISTS cosine_similarity(vector, vector);

-- 删除索引 (虽然CASCADE会自动删除，但明确删除以确保)
DROP INDEX IF EXISTS idx_games_creator_id;
DROP INDEX IF EXISTS idx_games_status;
DROP INDEX IF EXISTS idx_game_sessions_game_id;
DROP INDEX IF EXISTS idx_game_sessions_user_id;
DROP INDEX IF EXISTS idx_memory_game_id;
DROP INDEX IF EXISTS idx_ai_settings_user_id;

-- 删除迁移记录
DELETE FROM schema_migrations WHERE version = '001';

COMMIT;

-- 验证回滚
DO $$
BEGIN
    -- 检查表是否已被删除
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Rollback failed: users table still exists';
    END IF;

    RAISE NOTICE 'Rollback 001 completed successfully';
END $$;
