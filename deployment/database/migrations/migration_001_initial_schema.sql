-- 数据库迁移脚本: 001 - 初始表结构
-- 版本: v1.0.0
-- 描述: 创建基础表结构

BEGIN;

-- 创建schema_migrations表用于跟踪迁移状态
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    description TEXT NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(255)
);

-- 创建users表 (Clerk用户数据同步)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建games表
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建game_sessions表
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_data JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER
);

-- 创建memory表 (向量存储基础表)
CREATE TABLE IF NOT EXISTS memory (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- pgvector扩展
    importance VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建ai_settings表
CREATE TABLE IF NOT EXISTS ai_settings (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    settings JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, model)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_games_creator_id ON games(creator_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_game_id ON memory(game_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON ai_settings(user_id);

-- 创建向量相似度搜索函数 (需要pgvector扩展)
CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector) RETURNS float
AS $$
    SELECT 1 - (a <=> b);
$$ LANGUAGE SQL IMMUTABLE;

-- 插入迁移记录
INSERT INTO schema_migrations (version, description, checksum)
VALUES ('001', 'Initial schema creation', 'abc123')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- 验证迁移
DO $$
BEGIN
    -- 检查表是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'Migration failed: users table not created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'games') THEN
        RAISE EXCEPTION 'Migration failed: games table not created';
    END IF;

    RAISE NOTICE 'Migration 001 completed successfully';
END $$;
