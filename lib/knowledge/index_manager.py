"""知识库索引管理器。"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class IndexManager:
    """知识库索引与缓存管理。"""

    def __init__(self, db_path: str):
        self.db_path = Path(db_path).expanduser()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        schema_path = Path(__file__).parent / "schema.sql"
        with self._get_conn() as conn:
            if schema_path.exists():
                conn.executescript(schema_path.read_text(encoding="utf-8"))
            else:
                conn.executescript(
                    """
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
                        references_json TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        ttl INTEGER DEFAULT 86400
                    );
                    """
                )

    # === Notebooks ===

    def upsert_notebook(self, notebook: Dict[str, Any]) -> None:
        """插入或更新 notebook。"""
        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO notebooks
                (id, title, description, topics, source_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    description=excluded.description,
                    topics=excluded.topics,
                    source_count=excluded.source_count,
                    created_at=excluded.created_at
                """,
                (
                    notebook["id"],
                    notebook.get("title", ""),
                    notebook.get("description", ""),
                    json.dumps(notebook.get("topics", []), ensure_ascii=False),
                    notebook.get("source_count", 0),
                    notebook.get("created_at", datetime.now().isoformat()),
                ),
            )

    def get_notebook(self, notebook_id: str) -> Optional[Dict[str, Any]]:
        """获取 notebook。"""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM notebooks WHERE id = ?",
                (notebook_id,),
            ).fetchone()

        if not row:
            return None
        result = dict(row)
        result["topics"] = self._parse_json_list(result.get("topics"))
        return result

    def search_notebooks(self, topic: str) -> List[Dict[str, Any]]:
        """按主题搜索 notebooks。"""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM notebooks WHERE topics LIKE ? ORDER BY query_count DESC, created_at DESC",
                (f"%{topic}%",),
            ).fetchall()

        results: List[Dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["topics"] = self._parse_json_list(item.get("topics"))
            results.append(item)
        return results

    def list_notebooks(self, limit: int = 200) -> List[Dict[str, Any]]:
        """列出 notebooks。"""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM notebooks ORDER BY query_count DESC, created_at DESC LIMIT ?",
                (max(limit, 1),),
            ).fetchall()

        results: List[Dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["topics"] = self._parse_json_list(item.get("topics"))
            results.append(item)
        return results

    def record_query(self, notebook_id: str) -> None:
        """记录查询。"""
        with self._get_conn() as conn:
            conn.execute(
                """
                UPDATE notebooks
                SET last_queried = ?, query_count = query_count + 1
                WHERE id = ?
                """,
                (datetime.now().isoformat(), notebook_id),
            )

    def find_best_notebook(self, question: str) -> Optional[Dict[str, Any]]:
        """根据问题关键词在索引中找到最匹配的 notebook。"""
        results = self.find_notebooks_by_keyword(question, limit=1)
        return results[0] if results else None

    def find_notebooks_by_keyword(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """根据关键词搜索索引中的 notebooks（标题/描述/主题匹配）。"""
        query_lower = query.lower().strip()
        words = [w for w in query_lower.split() if len(w) >= 2]
        if not words:
            return []

        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM notebooks ORDER BY query_count DESC, created_at DESC"
            ).fetchall()

        scored: List[tuple] = []
        for row in rows:
            item = dict(row)
            title = (item.get("title") or "").lower()
            description = (item.get("description") or "").lower()
            topics_raw = item.get("topics") or ""
            topics_str = topics_raw.lower() if isinstance(topics_raw, str) else ""

            searchable = f"{title} {description} {topics_str}"
            score = 0
            for word in words:
                if word in searchable:
                    # title 匹配权重更高
                    if word in title:
                        score += 3
                    elif word in description:
                        score += 2
                    else:
                        score += 1

            if score > 0:
                item["topics"] = self._parse_json_list(item.get("topics"))
                item["_score"] = score
                scored.append((score, item))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:limit]]

    # === Cache ===

    def get_cached(self, query_hash: str) -> Optional[Dict[str, Any]]:
        """获取缓存。"""
        with self._get_conn() as conn:
            row = conn.execute(
                """
                SELECT * FROM query_cache
                WHERE query_hash = ?
                AND datetime(created_at, '+' || ttl || ' seconds') > datetime('now')
                """,
                (query_hash,),
            ).fetchone()

        if not row:
            return None

        result = dict(row)
        result["references"] = self._parse_json_list(result.get("references_json"))
        result.pop("references_json", None)
        return result

    def set_cached(
        self,
        query_hash: str,
        source: str,
        question: str,
        answer: str,
        references: List[Dict[str, Any]],
        ttl: int = 86400,
    ) -> None:
        """写入缓存。"""
        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO query_cache
                (query_hash, source, question, answer, references_json, ttl)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(query_hash) DO UPDATE SET
                    source=excluded.source,
                    question=excluded.question,
                    answer=excluded.answer,
                    references_json=excluded.references_json,
                    created_at=CURRENT_TIMESTAMP,
                    ttl=excluded.ttl
                """,
                (
                    query_hash,
                    source,
                    question,
                    answer,
                    json.dumps(references, ensure_ascii=False),
                    ttl,
                ),
            )

    def clear_expired_cache(self) -> int:
        """清理过期缓存。"""
        with self._get_conn() as conn:
            cursor = conn.execute(
                """
                DELETE FROM query_cache
                WHERE datetime(created_at, '+' || ttl || ' seconds') < datetime('now')
                """
            )
            return cursor.rowcount

    # === Stats ===

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息。"""
        with self._get_conn() as conn:
            notebook_count = conn.execute("SELECT COUNT(*) FROM notebooks").fetchone()[0]
            cache_count = conn.execute("SELECT COUNT(*) FROM query_cache").fetchone()[0]
            total_queries = conn.execute("SELECT SUM(query_count) FROM notebooks").fetchone()[0] or 0

        return {
            "notebook_count": notebook_count,
            "cache_count": cache_count,
            "total_queries": total_queries,
        }

    @staticmethod
    def _parse_json_list(raw_value: Any) -> List[Any]:
        if raw_value is None:
            return []
        if isinstance(raw_value, list):
            return raw_value
        if isinstance(raw_value, str):
            try:
                parsed = json.loads(raw_value)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                return []
        return []
