"""
Agents Package for CCB

Specialized agents for different task types.
"""
from __future__ import annotations

from .sisyphus_agent import SisyphusAgent
from .oracle_agent import OracleAgent
from .librarian_agent import LibrarianAgent
from .explorer_agent import ExplorerAgent
from .frontend_agent import FrontendAgent

__all__ = [
    "SisyphusAgent",
    "OracleAgent",
    "LibrarianAgent",
    "ExplorerAgent",
    "FrontendAgent",
]
