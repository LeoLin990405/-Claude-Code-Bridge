"""Knowledge Hub - 统一知识库模块。"""

from .index_manager import IndexManager
from .notebooklm_client import NotebookLMClient
from .obsidian_search import ObsidianSearch
from .router import KnowledgeRouter

__all__ = [
    "KnowledgeRouter",
    "NotebookLMClient",
    "ObsidianSearch",
    "IndexManager",
]

__version__ = "0.1.0"
