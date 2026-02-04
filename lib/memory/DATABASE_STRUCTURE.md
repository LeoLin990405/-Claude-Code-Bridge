# CCB Memory Database Structure

## 📊 数据库概览

**位置**: `~/.ccb/ccb_memory.db`
**类型**: SQLite 3
**编码**: UTF-8
**大小**: ~32 KB

---

## 📋 表结构

### 1. conversations (对话表)

**用途**: 存储所有 AI provider 的对话历史

**结构**:
```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- 自增 ID
    timestamp TEXT NOT NULL,                -- 时间戳 (ISO 8601)
    provider TEXT NOT NULL,                 -- Provider 名称 (kimi/codex/gemini 等)
    question TEXT NOT NULL,                 -- 用户问题
    answer TEXT NOT NULL,                   -- AI 回答
    metadata TEXT,                          -- JSON 格式的元数据
    tokens INTEGER DEFAULT 0                -- Token 使用量
);
```

**索引**:
- PRIMARY KEY on `id`
- FTS5 全文搜索索引 (见下方)

**示例数据**:
```
id: 6
timestamp: 2026-02-04T11:17:10.273796
provider: qwen
question: 数据分析
answer: Qwen 的 coder 模型适合数据处理和可视化。可以用 xlsx 和 pdf skills。
metadata: {}
tokens: 0
```

**当前数据量**: 6 条记录

**Provider 分布**:
```
codex:  2 条
gemini: 1 条
kimi:   2 条
qwen:   1 条
```

---

### 2. learnings (学习表)

**用途**: 存储用户的学习记录和洞察

**结构**:
```sql
CREATE TABLE learnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- 自增 ID
    timestamp TEXT NOT NULL,                -- 时间戳
    category TEXT NOT NULL,                 -- 分类 (general/coding/design 等)
    content TEXT NOT NULL,                  -- 学习内容
    metadata TEXT                           -- JSON 元数据
);
```

**示例数据**:
```
id: 1
timestamp: 2026-02-04T12:00:00
category: frontend
content: Gemini 3f 特别擅长 React 组件开发，响应速度快
metadata: {"source": "manual", "confidence": 0.9}
```

**当前数据量**: 0 条记录

---

### 3. conversations_fts (全文搜索索引)

**用途**: 提供高效的全文搜索功能

**结构**:
```sql
CREATE VIRTUAL TABLE conversations_fts USING fts5(
    question,    -- 索引问题内容
    answer,      -- 索引回答内容
    provider,    -- 索引 provider 名称
    content='conversations',      -- 关联到 conversations 表
    content_rowid='id'            -- 使用 id 作为行 ID
);
```

**功能**:
- 快速搜索对话内容
- 支持中文分词
- 自动维护索引

**使用示例**:
```sql
-- 搜索包含 "前端" 的对话
SELECT * FROM conversations
WHERE id IN (
    SELECT rowid FROM conversations_fts
    WHERE conversations_fts MATCH '前端'
);
```

**辅助表**:
- `conversations_fts_data` - FTS5 数据存储
- `conversations_fts_idx` - FTS5 索引
- `conversations_fts_docsize` - 文档大小统计
- `conversations_fts_config` - FTS5 配置

---

## 🔍 常用查询

### 查看所有对话
```sql
SELECT
    id,
    datetime(timestamp) as time,
    provider,
    question,
    substr(answer, 1, 100) as answer_preview
FROM conversations
ORDER BY timestamp DESC;
```

### 按 Provider 统计
```sql
SELECT
    provider,
    COUNT(*) as total,
    SUM(tokens) as total_tokens
FROM conversations
GROUP BY provider
ORDER BY total DESC;
```

### 搜索对话
```sql
SELECT
    c.provider,
    c.question,
    c.answer
FROM conversations c
JOIN conversations_fts fts ON c.id = fts.rowid
WHERE conversations_fts MATCH '前端 OR react'
ORDER BY c.timestamp DESC;
```

### 最近 N 天的对话
```sql
SELECT *
FROM conversations
WHERE datetime(timestamp) > datetime('now', '-7 days')
ORDER BY timestamp DESC;
```

### 查看特定 Provider 的对话
```sql
SELECT
    question,
    answer,
    timestamp
FROM conversations
WHERE provider = 'kimi'
ORDER BY timestamp DESC
LIMIT 10;
```

---

## 📈 数据统计

### 当前状态
```
总对话数: 6
总学习数: 0
数据库大小: ~32 KB
```

### Provider 使用分布
```
codex:  33.3% (2/6)
kimi:   33.3% (2/6)
gemini: 16.7% (1/6)
qwen:   16.7% (1/6)
```

### 最近对话
```
1. [qwen]  数据分析 (2026-02-04 11:17)
2. [gemini] 创建 UI (2026-02-04 11:17)
3. [codex] 优化算法 (2026-02-04 11:17)
4. [kimi]  如何做前端开发 (2026-02-04 11:17)
5. [codex] 算法优化 (2026-02-04 11:15)
```

---

## 🔧 维护操作

### 查看数据库大小
```bash
ls -lh ~/.ccb/ccb_memory.db
```

### 备份数据库
```bash
cp ~/.ccb/ccb_memory.db ~/.ccb/ccb_memory.db.backup
```

### 清理旧数据（保留最近 90 天）
```sql
DELETE FROM conversations
WHERE datetime(timestamp) < datetime('now', '-90 days');

-- 重建 FTS 索引
INSERT INTO conversations_fts(conversations_fts) VALUES('rebuild');
```

### 优化数据库
```bash
sqlite3 ~/.ccb/ccb_memory.db "VACUUM;"
```

### 导出数据
```bash
# 导出为 JSON
sqlite3 ~/.ccb/ccb_memory.db << 'EOF' > conversations.json
.mode json
SELECT * FROM conversations;
EOF

# 导出为 CSV
sqlite3 ~/.ccb/ccb_memory.db << 'EOF' > conversations.csv
.mode csv
.headers on
SELECT * FROM conversations;
EOF
```

---

## 🔐 数据隐私

### 敏感数据过滤

记忆系统自动过滤包含以下关键词的内容：
- `password`
- `api_key`
- `secret`
- `token`

### 手动标记隐私内容

使用 `<private>` 标签（未来功能）：
```
<private>
敏感信息在这里
</private>
```

---

## 📊 Schema 版本

**当前版本**: v1.0
**创建日期**: 2026-02-04
**最后修改**: 2026-02-04

### 迁移历史
```
v1.0 (2026-02-04)
  - 创建 conversations 表
  - 创建 learnings 表
  - 添加 FTS5 全文搜索
  - 初始化数据
```

---

## 🔗 相关文件

- **数据库**: `~/.ccb/ccb_memory.db`
- **配置**: `~/.ccb/memory_config.json`
- **注册表**: `~/.ccb/registry_cache.json`
- **同步配置**: `~/.ccb/sync_config.json`
- **同步日志**: `~/.ccb/sync_log.json`

---

## 📚 API 接口

### Python API

```python
from memory_lite import CCBLightMemory

# 初始化
memory = CCBLightMemory()

# 记录对话
memory.record_conversation(
    provider="kimi",
    question="如何优化算法",
    answer="使用 O3 模型进行深度推理",
    metadata={"task_type": "algorithm"}
)

# 搜索对话
results = memory.search_conversations("算法", limit=5)

# 获取最近对话
recent = memory.get_recent_conversations(limit=10)

# 查看统计
stats = memory.get_stats()
```

### CLI 接口

```bash
# 记录对话
python3 lib/memory/memory_lite.py record kimi "问题" "回答"

# 搜索对话
python3 lib/memory/memory_lite.py search "关键词"

# 最近对话
python3 lib/memory/memory_lite.py recent 10

# 统计信息
python3 lib/memory/memory_lite.py stats
```

---

## 🎯 未来扩展

### 计划功能

1. **版本控制**
   ```sql
   CREATE TABLE conversation_versions (
       id INTEGER PRIMARY KEY,
       conversation_id INTEGER,
       version INTEGER,
       content TEXT,
       timestamp TEXT
   );
   ```

2. **标签系统**
   ```sql
   CREATE TABLE tags (
       id INTEGER PRIMARY KEY,
       name TEXT UNIQUE
   );

   CREATE TABLE conversation_tags (
       conversation_id INTEGER,
       tag_id INTEGER,
       PRIMARY KEY (conversation_id, tag_id)
   );
   ```

3. **关联关系**
   ```sql
   CREATE TABLE conversation_relations (
       from_id INTEGER,
       to_id INTEGER,
       relation_type TEXT,  -- 'reference', 'follow-up', 'related'
       PRIMARY KEY (from_id, to_id)
   );
   ```

4. **性能指标**
   ```sql
   CREATE TABLE performance_metrics (
       id INTEGER PRIMARY KEY,
       conversation_id INTEGER,
       latency_ms INTEGER,
       tokens_used INTEGER,
       cost REAL,
       timestamp TEXT
   );
   ```

---

## 📖 总结

**CCB Memory 数据库**是一个轻量但功能完整的记忆系统：

- ✅ 简单清晰的表结构
- ✅ 高效的全文搜索
- ✅ 完整的元数据支持
- ✅ 跨平台兼容
- ✅ 易于备份和迁移
- ✅ 可扩展的架构

**数据安全**：
- 本地存储，完全私密
- 自动同步到 Google Drive
- 支持加密传输
- 定期自动备份
