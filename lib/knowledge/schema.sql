-- notebooks 表 (NotebookLM notebooks)
CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    topics TEXT,
    source_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_queried TIMESTAMP,
    query_count INTEGER DEFAULT 0
);

-- sources 表 (notebook 内的文档来源)
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    notebook_id TEXT,
    title TEXT,
    type TEXT,
    page_count INTEGER,
    FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
);

-- obsidian_notes 表 (本地 Obsidian 笔记索引)
CREATE TABLE IF NOT EXISTS obsidian_notes (
    path TEXT PRIMARY KEY,
    title TEXT,
    tags TEXT,
    links TEXT,
    word_count INTEGER,
    modified_at TIMESTAMP,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- query_cache 表
CREATE TABLE IF NOT EXISTS query_cache (
    query_hash TEXT PRIMARY KEY,
    source TEXT,
    question TEXT,
    answer TEXT,
    references_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ttl INTEGER DEFAULT 86400
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_notebooks_topics ON notebooks(topics);
CREATE INDEX IF NOT EXISTS idx_obsidian_tags ON obsidian_notes(tags);
CREATE INDEX IF NOT EXISTS idx_cache_created ON query_cache(created_at);
