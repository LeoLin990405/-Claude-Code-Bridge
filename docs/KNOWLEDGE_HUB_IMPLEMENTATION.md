# Knowledge Hub 实现计划

**目标**: 将 NotebookLM + Obsidian + MinerU 集成为 Hivemind 的统一知识库层

**执行者**: Codex
**预计时间**: 4-6 小时

---

## 📊 系统架构

```
┌───────────────────────────────────────────────────────────────┐
│                    Knowledge Hub (统一知识库)                   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│   │ NotebookLM  │   │  Obsidian   │   │   MinerU    │        │
│   │ (云端研究)   │   │ (本地笔记)   │   │ (PDF转换)   │        │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘        │
│          │                 │                 │                │
│          └─────────────────┼─────────────────┘                │
│                            ▼                                  │
│                  ┌─────────────────┐                          │
│                  │ Knowledge Router │                         │
│                  └────────┬────────┘                          │
│                           │                                   │
│          ┌────────────────┼────────────────┐                  │
│          ▼                ▼                ▼                  │
│   ┌────────────┐  ┌────────────┐  ┌────────────────┐         │
│   │ 本地索引DB │  │ 查询缓存   │  │ Gateway API    │         │
│   │ (SQLite)   │  │ (TTL 24h)  │  │ (/knowledge/*) │         │
│   └────────────┘  └────────────┘  └────────────────┘         │
└───────────────────────────────────────────────────────────────┘
```

---

## 📁 文件结构

```
~/.local/share/codex-dual/
├── lib/
│   └── knowledge/                    # 🆕 新建目录
│       ├── __init__.py
│       ├── router.py                 # 知识路由器（核心）
│       ├── notebooklm_client.py      # NotebookLM CLI 封装
│       ├── obsidian_search.py        # Obsidian 本地搜索
│       ├── index_manager.py          # SQLite 索引管理
│       └── cache.py                  # 查询缓存
├── data/
│   └── knowledge_index.db            # 🆕 SQLite 索引数据库
└── config/
    └── knowledge.yaml                # 🆕 配置文件
```

---

## 🔧 Phase 1: 基础设施 (1.5h)

### Task 1.1: 创建目录结构

```bash
mkdir -p ~/.local/share/codex-dual/lib/knowledge
mkdir -p ~/.local/share/codex-dual/data
mkdir -p ~/.local/share/codex-dual/config
```

### Task 1.2: 创建 SQLite Schema

**文件**: `~/.local/share/codex-dual/lib/knowledge/schema.sql`

```sql
-- notebooks 表 (NotebookLM notebooks)
CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    topics TEXT,                   -- JSON array: ["历史", "罗马"]
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
    type TEXT,                     -- pdf, url, markdown
    page_count INTEGER,
    FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
);

-- obsidian_notes 表 (本地 Obsidian 笔记索引)
CREATE TABLE IF NOT EXISTS obsidian_notes (
    path TEXT PRIMARY KEY,
    title TEXT,
    tags TEXT,                     -- JSON array
    links TEXT,                    -- JSON array (wikilinks)
    word_count INTEGER,
    modified_at TIMESTAMP,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- query_cache 表
CREATE TABLE IF NOT EXISTS query_cache (
    query_hash TEXT PRIMARY KEY,
    source TEXT,                   -- "notebooklm" | "obsidian"
    question TEXT,
    answer TEXT,
    references TEXT,               -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ttl INTEGER DEFAULT 86400
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_notebooks_topics ON notebooks(topics);
CREATE INDEX IF NOT EXISTS idx_obsidian_tags ON obsidian_notes(tags);
CREATE INDEX IF NOT EXISTS idx_cache_created ON query_cache(created_at);
```

### Task 1.3: 创建配置文件

**文件**: `~/.local/share/codex-dual/config/knowledge.yaml`

```yaml
knowledge:
  # 数据库
  db_path: ~/.local/share/codex-dual/data/knowledge_index.db

  # Obsidian 配置
  obsidian:
    vault_path: ~/Documents/Obsidian/Main
    excluded_folders:
      - .obsidian
      - .trash
      - templates

  # NotebookLM 配置
  notebooklm:
    timeout: 30
    max_retries: 2

  # 缓存配置
  cache:
    enabled: true
    ttl: 86400              # 24小时
    max_entries: 1000

  # 路由配置
  routing:
    default_source: auto    # auto | notebooklm | obsidian
    local_first: true       # 优先查本地
    confidence_threshold: 0.7
```

---

## 🔧 Phase 2: 核心模块 (2h)

### Task 2.1: NotebookLM Client

**文件**: `~/.local/share/codex-dual/lib/knowledge/notebooklm_client.py`

```python
"""
NotebookLM CLI 封装

依赖: notebooklm CLI (npm i -g notebooklm)
"""

import subprocess
import json
from typing import Optional, List, Dict, Any
from pathlib import Path


class NotebookLMClient:
    """NotebookLM CLI 客户端"""

    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self._check_cli()

    def _check_cli(self):
        """检查 notebooklm CLI 是否可用"""
        try:
            result = subprocess.run(
                ['notebooklm', '--version'],
                capture_output=True,
                timeout=5
            )
            if result.returncode != 0:
                raise RuntimeError("notebooklm CLI not found")
        except FileNotFoundError:
            raise RuntimeError("notebooklm CLI not installed. Run: npm i -g notebooklm")

    def list_notebooks(self) -> List[Dict[str, Any]]:
        """列出所有 notebooks"""
        result = subprocess.run(
            ['notebooklm', 'list', '--json'],
            capture_output=True,
            text=True,
            timeout=self.timeout
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return []

    def query(self, notebook_id: str, question: str) -> Dict[str, Any]:
        """查询指定 notebook"""
        result = subprocess.run(
            ['notebooklm', 'ask', notebook_id, question, '--json'],
            capture_output=True,
            text=True,
            timeout=self.timeout
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return {
            'answer': None,
            'error': result.stderr,
            'references': []
        }

    def search_notebooks(self, query: str) -> List[Dict[str, Any]]:
        """搜索相关 notebooks"""
        result = subprocess.run(
            ['notebooklm', 'search', query, '--json'],
            capture_output=True,
            text=True,
            timeout=self.timeout
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return []

    def get_notebook_info(self, notebook_id: str) -> Optional[Dict[str, Any]]:
        """获取 notebook 详情"""
        result = subprocess.run(
            ['notebooklm', 'info', notebook_id, '--json'],
            capture_output=True,
            text=True,
            timeout=self.timeout
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        return None
```

### Task 2.2: Obsidian Search

**文件**: `~/.local/share/codex-dual/lib/knowledge/obsidian_search.py`

```python
"""
Obsidian 本地笔记搜索

支持:
- 全文搜索
- 标签搜索
- Wikilink 搜索
"""

import os
import re
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime


class ObsidianSearch:
    """Obsidian Vault 搜索器"""

    def __init__(self, vault_path: str, excluded_folders: List[str] = None):
        self.vault_path = Path(vault_path).expanduser()
        self.excluded_folders = excluded_folders or ['.obsidian', '.trash']

        if not self.vault_path.exists():
            raise ValueError(f"Vault not found: {self.vault_path}")

    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """全文搜索"""
        results = []
        query_lower = query.lower()
        query_words = query_lower.split()

        for md_file in self._iter_markdown_files():
            try:
                content = md_file.read_text(encoding='utf-8')
                content_lower = content.lower()

                # 计算相关性分数
                score = self._calculate_relevance(content_lower, query_words)

                if score > 0:
                    # 提取元数据
                    metadata = self._extract_metadata(content)

                    results.append({
                        'path': str(md_file.relative_to(self.vault_path)),
                        'title': metadata.get('title', md_file.stem),
                        'tags': metadata.get('tags', []),
                        'score': score,
                        'snippet': self._extract_snippet(content, query_words),
                        'modified_at': datetime.fromtimestamp(md_file.stat().st_mtime).isoformat()
                    })
            except Exception as e:
                continue

        # 按分数排序
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:limit]

    def search_by_tag(self, tag: str, limit: int = 20) -> List[Dict[str, Any]]:
        """按标签搜索"""
        results = []
        tag_pattern = f"#{tag}"

        for md_file in self._iter_markdown_files():
            try:
                content = md_file.read_text(encoding='utf-8')
                if tag_pattern in content:
                    metadata = self._extract_metadata(content)
                    results.append({
                        'path': str(md_file.relative_to(self.vault_path)),
                        'title': metadata.get('title', md_file.stem),
                        'tags': metadata.get('tags', [])
                    })
            except:
                continue

        return results[:limit]

    def get_note(self, path: str) -> Optional[Dict[str, Any]]:
        """获取笔记内容"""
        full_path = self.vault_path / path
        if not full_path.exists():
            return None

        content = full_path.read_text(encoding='utf-8')
        metadata = self._extract_metadata(content)

        return {
            'path': path,
            'title': metadata.get('title', full_path.stem),
            'tags': metadata.get('tags', []),
            'content': content,
            'word_count': len(content.split())
        }

    def _iter_markdown_files(self):
        """遍历所有 Markdown 文件"""
        for root, dirs, files in os.walk(self.vault_path):
            # 排除指定文件夹
            dirs[:] = [d for d in dirs if d not in self.excluded_folders]

            for file in files:
                if file.endswith('.md'):
                    yield Path(root) / file

    def _extract_metadata(self, content: str) -> Dict[str, Any]:
        """提取 YAML frontmatter"""
        if content.startswith('---'):
            try:
                end = content.index('---', 3)
                frontmatter = content[3:end]
                return yaml.safe_load(frontmatter) or {}
            except:
                pass
        return {}

    def _calculate_relevance(self, content: str, query_words: List[str]) -> float:
        """计算相关性分数"""
        score = 0
        for word in query_words:
            count = content.count(word)
            if count > 0:
                score += min(count, 10)  # 每个词最多贡献 10 分
        return score

    def _extract_snippet(self, content: str, query_words: List[str], context: int = 100) -> str:
        """提取包含查询词的片段"""
        content_lower = content.lower()
        for word in query_words:
            idx = content_lower.find(word)
            if idx >= 0:
                start = max(0, idx - context)
                end = min(len(content), idx + len(word) + context)
                snippet = content[start:end]
                if start > 0:
                    snippet = '...' + snippet
                if end < len(content):
                    snippet = snippet + '...'
                return snippet
        return content[:200] + '...'
```

### Task 2.3: Index Manager

**文件**: `~/.local/share/codex-dual/lib/knowledge/index_manager.py`

```python
"""
知识库索引管理器

管理 SQLite 索引数据库
"""

import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime


class IndexManager:
    """知识库索引管理器"""

    def __init__(self, db_path: str):
        self.db_path = Path(db_path).expanduser()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        """初始化数据库"""
        schema_path = Path(__file__).parent / 'schema.sql'

        with sqlite3.connect(self.db_path) as conn:
            if schema_path.exists():
                conn.executescript(schema_path.read_text())
            else:
                # 内联 schema
                conn.executescript('''
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

                    CREATE TABLE IF NOT EXISTS query_cache (
                        query_hash TEXT PRIMARY KEY,
                        source TEXT,
                        question TEXT,
                        answer TEXT,
                        references TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        ttl INTEGER DEFAULT 86400
                    );
                ''')

    # === Notebooks ===

    def upsert_notebook(self, notebook: Dict[str, Any]):
        """插入或更新 notebook"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO notebooks
                (id, title, description, topics, source_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                notebook['id'],
                notebook.get('title', ''),
                notebook.get('description', ''),
                json.dumps(notebook.get('topics', [])),
                notebook.get('source_count', 0),
                notebook.get('created_at', datetime.now().isoformat())
            ))

    def get_notebook(self, notebook_id: str) -> Optional[Dict[str, Any]]:
        """获取 notebook"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                'SELECT * FROM notebooks WHERE id = ?',
                (notebook_id,)
            ).fetchone()

            if row:
                return dict(row)
        return None

    def search_notebooks(self, topic: str) -> List[Dict[str, Any]]:
        """按主题搜索 notebooks"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                'SELECT * FROM notebooks WHERE topics LIKE ?',
                (f'%{topic}%',)
            ).fetchall()
            return [dict(row) for row in rows]

    def record_query(self, notebook_id: str):
        """记录查询"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                UPDATE notebooks
                SET last_queried = ?, query_count = query_count + 1
                WHERE id = ?
            ''', (datetime.now().isoformat(), notebook_id))

    # === Cache ===

    def get_cached(self, query_hash: str) -> Optional[Dict[str, Any]]:
        """获取缓存"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute('''
                SELECT * FROM query_cache
                WHERE query_hash = ?
                AND datetime(created_at, '+' || ttl || ' seconds') > datetime('now')
            ''', (query_hash,)).fetchone()

            if row:
                result = dict(row)
                result['references'] = json.loads(result.get('references', '[]'))
                return result
        return None

    def set_cached(self, query_hash: str, source: str, question: str,
                   answer: str, references: List[Dict], ttl: int = 86400):
        """设置缓存"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO query_cache
                (query_hash, source, question, answer, references, ttl)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                query_hash, source, question, answer,
                json.dumps(references), ttl
            ))

    def clear_expired_cache(self):
        """清理过期缓存"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                DELETE FROM query_cache
                WHERE datetime(created_at, '+' || ttl || ' seconds') < datetime('now')
            ''')

    # === Stats ===

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        with sqlite3.connect(self.db_path) as conn:
            notebook_count = conn.execute(
                'SELECT COUNT(*) FROM notebooks'
            ).fetchone()[0]

            cache_count = conn.execute(
                'SELECT COUNT(*) FROM query_cache'
            ).fetchone()[0]

            total_queries = conn.execute(
                'SELECT SUM(query_count) FROM notebooks'
            ).fetchone()[0] or 0

            return {
                'notebook_count': notebook_count,
                'cache_count': cache_count,
                'total_queries': total_queries
            }
```

### Task 2.4: Knowledge Router (核心)

**文件**: `~/.local/share/codex-dual/lib/knowledge/router.py`

```python
"""
Knowledge Router - 统一知识路由器

核心组件，负责：
1. 智能路由查询到正确的知识源
2. 缓存管理
3. 结果合并
"""

import hashlib
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List

from .notebooklm_client import NotebookLMClient
from .obsidian_search import ObsidianSearch
from .index_manager import IndexManager


class KnowledgeRouter:
    """统一知识路由器"""

    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)

        # 初始化组件
        self.index = IndexManager(self.config['knowledge']['db_path'])

        # NotebookLM (可选)
        self.notebooklm = None
        try:
            self.notebooklm = NotebookLMClient(
                timeout=self.config['knowledge']['notebooklm']['timeout']
            )
        except Exception as e:
            print(f"[KnowledgeRouter] NotebookLM not available: {e}")

        # Obsidian (可选)
        self.obsidian = None
        obsidian_config = self.config['knowledge'].get('obsidian', {})
        vault_path = obsidian_config.get('vault_path')
        if vault_path and Path(vault_path).expanduser().exists():
            self.obsidian = ObsidianSearch(
                vault_path,
                obsidian_config.get('excluded_folders', [])
            )

        print(f"[KnowledgeRouter] Initialized: "
              f"NotebookLM={'✓' if self.notebooklm else '✗'}, "
              f"Obsidian={'✓' if self.obsidian else '✗'}")

    def _load_config(self, config_path: str = None) -> Dict[str, Any]:
        """加载配置"""
        if config_path is None:
            config_path = Path.home() / '.local/share/codex-dual/config/knowledge.yaml'

        config_path = Path(config_path).expanduser()

        if config_path.exists():
            with open(config_path) as f:
                return yaml.safe_load(f)

        # 默认配置
        return {
            'knowledge': {
                'db_path': '~/.local/share/codex-dual/data/knowledge_index.db',
                'obsidian': {
                    'vault_path': '~/Documents/Obsidian/Main',
                    'excluded_folders': ['.obsidian', '.trash']
                },
                'notebooklm': {
                    'timeout': 30,
                    'max_retries': 2
                },
                'cache': {
                    'enabled': True,
                    'ttl': 86400
                },
                'routing': {
                    'default_source': 'auto',
                    'local_first': True,
                    'confidence_threshold': 0.7
                }
            }
        }

    def query(
        self,
        question: str,
        source: str = 'auto',
        notebook_id: str = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """
        统一查询接口

        Args:
            question: 问题
            source: 知识源 ("auto" | "notebooklm" | "obsidian")
            notebook_id: 指定 NotebookLM notebook ID
            use_cache: 是否使用缓存

        Returns:
            {
                'answer': str,
                'source': str,
                'references': List[Dict],
                'cached': bool,
                'confidence': float
            }
        """
        # 1. 检查缓存
        if use_cache and self.config['knowledge']['cache']['enabled']:
            query_hash = self._hash_query(question, source, notebook_id)
            cached = self.index.get_cached(query_hash)
            if cached:
                return {
                    'answer': cached['answer'],
                    'source': cached['source'],
                    'references': cached['references'],
                    'cached': True,
                    'confidence': 1.0
                }

        # 2. 路由查询
        if source == 'auto':
            result = self._auto_route(question, notebook_id)
        elif source == 'notebooklm':
            result = self._query_notebooklm(question, notebook_id)
        elif source == 'obsidian':
            result = self._query_obsidian(question)
        else:
            raise ValueError(f"Unknown source: {source}")

        # 3. 缓存结果
        if use_cache and result.get('answer'):
            query_hash = self._hash_query(question, source, notebook_id)
            self.index.set_cached(
                query_hash=query_hash,
                source=result['source'],
                question=question,
                answer=result['answer'],
                references=result.get('references', []),
                ttl=self.config['knowledge']['cache']['ttl']
            )

        result['cached'] = False
        return result

    def _auto_route(self, question: str, notebook_id: str = None) -> Dict[str, Any]:
        """智能路由"""
        routing_config = self.config['knowledge']['routing']

        # 如果指定了 notebook_id，直接查 NotebookLM
        if notebook_id and self.notebooklm:
            return self._query_notebooklm(question, notebook_id)

        # 本地优先策略
        if routing_config.get('local_first', True) and self.obsidian:
            local_result = self._query_obsidian(question)
            if local_result.get('confidence', 0) >= routing_config.get('confidence_threshold', 0.7):
                return local_result

        # 查询 NotebookLM
        if self.notebooklm:
            return self._query_notebooklm(question, notebook_id)

        # 回退到本地
        if self.obsidian:
            return self._query_obsidian(question)

        return {
            'answer': None,
            'source': 'none',
            'references': [],
            'confidence': 0,
            'error': 'No knowledge source available'
        }

    def _query_notebooklm(self, question: str, notebook_id: str = None) -> Dict[str, Any]:
        """查询 NotebookLM"""
        if not self.notebooklm:
            return {'answer': None, 'source': 'notebooklm', 'error': 'NotebookLM not available'}

        try:
            # 如果没有指定 notebook，搜索相关的
            if not notebook_id:
                notebooks = self.notebooklm.search_notebooks(question)
                if notebooks:
                    notebook_id = notebooks[0]['id']
                else:
                    return {'answer': None, 'source': 'notebooklm', 'error': 'No relevant notebook found'}

            # 查询
            result = self.notebooklm.query(notebook_id, question)

            # 记录查询
            self.index.record_query(notebook_id)

            return {
                'answer': result.get('answer'),
                'source': 'notebooklm',
                'notebook_id': notebook_id,
                'references': result.get('references', []),
                'confidence': 0.9 if result.get('answer') else 0
            }
        except Exception as e:
            return {'answer': None, 'source': 'notebooklm', 'error': str(e)}

    def _query_obsidian(self, question: str) -> Dict[str, Any]:
        """查询 Obsidian"""
        if not self.obsidian:
            return {'answer': None, 'source': 'obsidian', 'error': 'Obsidian not available'}

        try:
            results = self.obsidian.search(question, limit=5)

            if not results:
                return {
                    'answer': None,
                    'source': 'obsidian',
                    'references': [],
                    'confidence': 0
                }

            # 组合答案
            top_result = results[0]
            note = self.obsidian.get_note(top_result['path'])

            # 计算置信度
            confidence = min(top_result['score'] / 50, 1.0)

            return {
                'answer': note['content'][:2000] if note else top_result['snippet'],
                'source': 'obsidian',
                'references': [
                    {
                        'title': r['title'],
                        'path': r['path'],
                        'score': r['score']
                    }
                    for r in results
                ],
                'confidence': confidence
            }
        except Exception as e:
            return {'answer': None, 'source': 'obsidian', 'error': str(e)}

    def _hash_query(self, question: str, source: str, notebook_id: str = None) -> str:
        """生成查询哈希"""
        key = f"{question}:{source}:{notebook_id or ''}"
        return hashlib.md5(key.encode()).hexdigest()

    # === 同步方法 ===

    def sync_notebooklm(self) -> int:
        """同步 NotebookLM notebooks 到本地索引"""
        if not self.notebooklm:
            return 0

        notebooks = self.notebooklm.list_notebooks()
        for nb in notebooks:
            self.index.upsert_notebook(nb)

        return len(notebooks)

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            'index': self.index.get_stats(),
            'notebooklm_available': self.notebooklm is not None,
            'obsidian_available': self.obsidian is not None
        }
```

### Task 2.5: 模块初始化

**文件**: `~/.local/share/codex-dual/lib/knowledge/__init__.py`

```python
"""
Knowledge Hub - 统一知识库模块

提供对 NotebookLM + Obsidian 的统一访问接口
"""

from .router import KnowledgeRouter
from .notebooklm_client import NotebookLMClient
from .obsidian_search import ObsidianSearch
from .index_manager import IndexManager

__all__ = [
    'KnowledgeRouter',
    'NotebookLMClient',
    'ObsidianSearch',
    'IndexManager'
]

__version__ = '0.1.0'
```

---

## 🔧 Phase 3: Gateway API 集成 (1.5h)

### Task 3.1: Knowledge API 端点

**文件**: `~/.local/share/codex-dual/lib/gateway/knowledge_api.py`

```python
"""
Knowledge Hub Gateway API

端点:
- POST /knowledge/query    查询知识库
- POST /knowledge/sync     同步索引
- GET  /knowledge/stats    统计信息
- GET  /knowledge/notebooks 列出 notebooks
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# 导入知识模块
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from knowledge import KnowledgeRouter


router = APIRouter(prefix='/knowledge', tags=['knowledge'])

# 全局 router 实例
_knowledge_router: Optional[KnowledgeRouter] = None


def get_knowledge_router() -> KnowledgeRouter:
    """获取 KnowledgeRouter 单例"""
    global _knowledge_router
    if _knowledge_router is None:
        _knowledge_router = KnowledgeRouter()
    return _knowledge_router


# === Request/Response Models ===

class QueryRequest(BaseModel):
    question: str
    source: str = 'auto'  # auto | notebooklm | obsidian
    notebook_id: Optional[str] = None
    use_cache: bool = True


class QueryResponse(BaseModel):
    answer: Optional[str]
    source: str
    references: List[Dict[str, Any]] = []
    cached: bool = False
    confidence: float = 0
    error: Optional[str] = None


class SyncResponse(BaseModel):
    notebooks_synced: int
    success: bool
    message: str


class StatsResponse(BaseModel):
    index: Dict[str, Any]
    notebooklm_available: bool
    obsidian_available: bool


# === Endpoints ===

@router.post('/query', response_model=QueryResponse)
async def query_knowledge(request: QueryRequest):
    """
    查询知识库

    - **question**: 问题
    - **source**: 知识源 (auto/notebooklm/obsidian)
    - **notebook_id**: 指定 NotebookLM notebook
    - **use_cache**: 是否使用缓存
    """
    try:
        kr = get_knowledge_router()
        result = kr.query(
            question=request.question,
            source=request.source,
            notebook_id=request.notebook_id,
            use_cache=request.use_cache
        )
        return QueryResponse(**result)
    except Exception as e:
        return QueryResponse(
            answer=None,
            source=request.source,
            error=str(e)
        )


@router.post('/sync', response_model=SyncResponse)
async def sync_knowledge():
    """同步 NotebookLM notebooks 到本地索引"""
    try:
        kr = get_knowledge_router()
        count = kr.sync_notebooklm()
        return SyncResponse(
            notebooks_synced=count,
            success=True,
            message=f'Synced {count} notebooks'
        )
    except Exception as e:
        return SyncResponse(
            notebooks_synced=0,
            success=False,
            message=str(e)
        )


@router.get('/stats', response_model=StatsResponse)
async def get_stats():
    """获取知识库统计信息"""
    kr = get_knowledge_router()
    return StatsResponse(**kr.get_stats())


@router.get('/notebooks')
async def list_notebooks(topic: Optional[str] = None):
    """列出所有已索引的 notebooks"""
    kr = get_knowledge_router()
    if topic:
        return kr.index.search_notebooks(topic)

    # 返回所有
    with kr.index.db_path.open() as f:
        # 简单实现
        pass
    return []
```

### Task 3.2: 集成到 Gateway Server

**修改文件**: `~/.local/share/codex-dual/lib/gateway/gateway_server.py`

在 `create_app()` 函数中添加:

```python
# 在其他 router 导入后添加
from .knowledge_api import router as knowledge_router

# 在 app 创建后添加
app.include_router(knowledge_router)
```

---

## 🔧 Phase 4: CLI 集成 (1h)

### Task 4.1: ccb-knowledge 命令

**文件**: `~/.local/share/codex-dual/bin/ccb-knowledge`

```bash
#!/bin/bash
# ccb-knowledge - 知识库 CLI
# 用法: ccb-knowledge <command> [options]

set -e

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8765}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

show_help() {
    cat << 'EOF'
ccb-knowledge - 知识库 CLI

用法:
  ccb-knowledge query "问题"              查询知识库
  ccb-knowledge query "问题" --source X   指定知识源 (notebooklm/obsidian)
  ccb-knowledge sync                      同步 NotebookLM 索引
  ccb-knowledge stats                     查看统计信息
  ccb-knowledge list                      列出所有 notebooks

示例:
  ccb-knowledge query "罗马帝国衰落的原因"
  ccb-knowledge query "递归" --source obsidian
  ccb-knowledge sync
EOF
}

query() {
    local question="$1"
    local source="${2:-auto}"

    curl -s -X POST "$GATEWAY_URL/knowledge/query" \
        -H "Content-Type: application/json" \
        -d "{\"question\": \"$question\", \"source\": \"$source\"}" \
        | jq -r '.answer // .error // "No answer found"'
}

sync_index() {
    curl -s -X POST "$GATEWAY_URL/knowledge/sync" \
        | jq .
}

get_stats() {
    curl -s "$GATEWAY_URL/knowledge/stats" \
        | jq .
}

list_notebooks() {
    curl -s "$GATEWAY_URL/knowledge/notebooks" \
        | jq .
}

# 解析命令
case "${1:-help}" in
    query)
        shift
        question=""
        source="auto"

        while [[ $# -gt 0 ]]; do
            case "$1" in
                --source|-s)
                    source="$2"
                    shift 2
                    ;;
                *)
                    question="$1"
                    shift
                    ;;
            esac
        done

        if [[ -z "$question" ]]; then
            echo "Error: Question required"
            exit 1
        fi

        query "$question" "$source"
        ;;
    sync)
        sync_index
        ;;
    stats)
        get_stats
        ;;
    list)
        list_notebooks
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
```

### Task 4.2: 设置可执行权限

```bash
chmod +x ~/.local/share/codex-dual/bin/ccb-knowledge
```

---

## ✅ 验收标准

完成后执行以下测试:

```bash
# 1. 基础设施
ls -la ~/.local/share/codex-dual/lib/knowledge/
ls -la ~/.local/share/codex-dual/data/knowledge_index.db
cat ~/.local/share/codex-dual/config/knowledge.yaml

# 2. Python 模块
python3 -c "from lib.knowledge import KnowledgeRouter; print('OK')"

# 3. Gateway API
curl -s http://localhost:8765/knowledge/stats | jq .

# 4. CLI
ccb-knowledge stats
ccb-knowledge query "测试问题"

# 5. 同步测试 (如果有 NotebookLM)
ccb-knowledge sync
```

---

## 📊 预期结果

| 组件 | 状态 | 说明 |
|------|------|------|
| `lib/knowledge/` 模块 | ✅ | 5 个 Python 文件 |
| `knowledge_index.db` | ✅ | SQLite 数据库已创建 |
| `knowledge.yaml` | ✅ | 配置文件 |
| `/knowledge/*` API | ✅ | 4 个端点 |
| `ccb-knowledge` CLI | ✅ | 可执行 |
| Obsidian 搜索 | ✅ | 如果 vault 存在 |
| NotebookLM 查询 | ⚠️ | 取决于 CLI 安装 |

---

## 🔗 相关文件

- 原始计划: `~/.claude/skills/knowledge-hub/CCB_INTEGRATION_PLAN.md`
- Skill 定义: `~/.claude/skills/knowledge-hub/SKILL.md`
- Gateway 代码: `~/.local/share/codex-dual/lib/gateway/`
- Memory 系统: `~/.local/share/codex-dual/lib/memory/`
