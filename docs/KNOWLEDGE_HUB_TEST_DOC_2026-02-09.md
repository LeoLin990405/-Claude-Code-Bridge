# Knowledge Hub 测试文档（给 Claude 执行）

生成日期：2026-02-09
适用项目：`~/.local/share/codex-dual`

---

## 1. 测试目标

验证 Knowledge Hub（NotebookLM + Obsidian + SQLite Cache）是否已正确接入 Gateway 与 CLI：

- Python 模块可导入
- `/knowledge/*` API 可访问
- `ccb-knowledge` CLI 可用
- 缓存与索引行为正常

---

## 2. 关键实现位置（供代码审查）

- `lib/knowledge/router.py`
- `lib/knowledge/index_manager.py`
- `lib/knowledge/notebooklm_client.py`
- `lib/knowledge/obsidian_search.py`
- `lib/knowledge/schema.sql`
- `lib/gateway/knowledge_api.py`
- `lib/gateway/gateway_api.py`
- `bin/ccb-knowledge`
- `config/knowledge.yaml`

---

## 3. 前置条件

在项目根目录执行：

```bash
cd ~/.local/share/codex-dual
```

确保：

1. Python 可用（`python3`）
2. Gateway 依赖已安装（FastAPI/uvicorn 等）
3. （可选）安装 NotebookLM CLI：`notebooklm --version`
4. （可选）Obsidian Vault 路径存在（默认 `~/Documents/Obsidian/Main`）

---

## 4. 测试步骤（按顺序）

### 4.1 结构与文件检查

```bash
ls -la lib/knowledge/
ls -la config/knowledge.yaml
ls -la bin/ccb-knowledge
```

**期望：**
- `lib/knowledge/` 下存在 `__init__.py/router.py/index_manager.py/notebooklm_client.py/obsidian_search.py/schema.sql/cache.py`
- `config/knowledge.yaml` 存在
- `bin/ccb-knowledge` 存在且可执行

---

### 4.2 Python 导入与语法检查

```bash
python3 -c "from lib.knowledge import KnowledgeRouter; print('OK')"
python3 -m py_compile lib/knowledge/*.py lib/gateway/knowledge_api.py bin/ccb-knowledge
```

**期望：**
- 输出 `OK`
- `py_compile` 无报错

---

### 4.3 启动 Gateway

```bash
bin/ccb-gateway start
```

如果需要后台运行，可用你现有方式启动；只要 `http://localhost:8765` 可访问即可。

---

### 4.4 API 冒烟测试

```bash
curl -s http://localhost:8765/knowledge/stats | jq .
curl -s http://localhost:8765/knowledge/notebooks | jq .
```

**期望：**
- 返回 JSON，不是 404
- `/knowledge/stats` 含字段：
  - `index`
  - `notebooklm_available`
  - `obsidian_available`

---

### 4.5 Query 接口测试（含缓存）

首次查询：

```bash
curl -s -X POST http://localhost:8765/knowledge/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"测试问题","source":"auto","use_cache":true}' | jq .
```

再次同样查询：

```bash
curl -s -X POST http://localhost:8765/knowledge/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"测试问题","source":"auto","use_cache":true}' | jq .
```

**期望：**
- 第一次 `cached` 通常为 `false`
- 第二次命中缓存时 `cached` 应为 `true`（若有可缓存 answer）

---

### 4.6 错误分支测试

```bash
curl -s -X POST http://localhost:8765/knowledge/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"hello","source":"bad_source"}' | jq .
```

**期望：**
- 返回 JSON，包含错误信息（unknown source）

---

### 4.7 Sync 接口测试

```bash
curl -s -X POST http://localhost:8765/knowledge/sync | jq .
```

**期望：**
- 返回 `success` 字段
- 若 NotebookLM CLI 已安装且可用，`notebooks_synced` 可能 > 0
- 若未安装，也应稳定返回（不应导致服务崩溃）

---

### 4.8 CLI 测试

```bash
bin/ccb-knowledge --help
bin/ccb-knowledge stats
bin/ccb-knowledge list
bin/ccb-knowledge query "测试问题"
bin/ccb-knowledge query "测试问题" --source obsidian
bin/ccb-knowledge sync
```

**期望：**
- 子命令可见：`query/sync/stats/list`
- 在 Gateway 正常运行时，CLI 可返回对应 JSON/文本

---

### 4.9 数据库检查

```bash
ls -la data/knowledge_index.db
sqlite3 data/knowledge_index.db '.tables'
sqlite3 data/knowledge_index.db 'select count(*) from query_cache;'
```

**期望：**
- 存在 `knowledge_index.db`
- 至少有表：`notebooks`, `sources`, `obsidian_notes`, `query_cache`

---

## 5. 已知现象（非阻塞）

1. 若 Obsidian Vault 路径不存在，`obsidian_available` 会是 `false`（预期行为）
2. 若 NotebookLM CLI 未安装或不可用，`notebooklm_available` 可能为 `false`（预期行为）
3. 在受限沙箱里，CLI 可能无法访问 `localhost:8765`（环境限制，不代表实现错误）

---

## 6. 通过标准（Acceptance）

满足以下全部条件即可判定通过：

1. Python 导入 + 语法检查通过
2. `/knowledge/stats`、`/knowledge/query`、`/knowledge/sync`、`/knowledge/notebooks` 均可访问
3. `bin/ccb-knowledge` 四个子命令可执行
4. `data/knowledge_index.db` 被创建且表结构完整
5. Query 至少一条路径（obsidian/notebooklm/auto）可返回稳定 JSON，不崩溃

---

## 7. 建议 Claude 输出格式

请 Claude 最终给出：

1. 每个测试步骤的命令与实际输出摘要
2. Pass/Fail 清单
3. 失败项的复现命令与原因定位
4. 是否达到第 6 节通过标准

