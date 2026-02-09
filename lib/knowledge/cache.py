"""Knowledge Hub 缓存辅助模块。"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .index_manager import IndexManager


class KnowledgeCache:
    """基于 IndexManager 的轻量缓存封装。"""

    def __init__(self, index: IndexManager, default_ttl: int = 86400):
        self.index = index
        self.default_ttl = default_ttl

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        return self.index.get_cached(key)

    def set(
        self,
        key: str,
        source: str,
        question: str,
        answer: str,
        references: Optional[List[Dict[str, Any]]] = None,
        ttl: Optional[int] = None,
    ) -> None:
        self.index.set_cached(
            query_hash=key,
            source=source,
            question=question,
            answer=answer,
            references=references or [],
            ttl=ttl if ttl is not None else self.default_ttl,
        )

    def cleanup(self) -> int:
        return self.index.clear_expired_cache()
