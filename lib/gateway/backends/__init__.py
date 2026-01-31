"""
Backend implementations for CCB Gateway.

Provides different backend types for communicating with AI providers:
- HTTP API (OpenAI, Anthropic, DeepSeek)
- CLI Execution (Codex, Gemini CLI)
- FIFO/Pipe (legacy)
- Terminal (legacy WezTerm integration)
"""
from .base_backend import BaseBackend, BackendResult
from .http_backend import HTTPBackend
from .cli_backend import CLIBackend

__all__ = [
    "BaseBackend",
    "BackendResult",
    "HTTPBackend",
    "CLIBackend",
]
