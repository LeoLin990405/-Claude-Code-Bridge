# Hivemind v1.0 架构优化完整规格书

> **目标读者**: Codex AI Agent
> **生成日期**: 2026-02-09
> **当前版本**: v0.26.0 → **目标版本**: v1.0.0
> **代码库**: `~/.local/share/codex-dual/` (GitHub: LeoLin990405/Hivemind)

---

## 0. 执行摘要

### 当前状态

| 指标 | 数值 | 问题 |
|------|------|------|
| 总代码量 | 48,525 行 (lib/) | 大量重复代码 |
| 最大单文件 | 3,917 行 (gateway_api.py) | God Object 反模式 |
| Comm 模块重复 | 6,450 行 (8 个 *_comm.py) | 无公共基类 |
| `except Exception` | 500 处 | 吞掉错误 |
| `print()` 调用 | 685 处 | 无结构化日志 |
| 测试覆盖率 | 8:1 代码/测试比 | 极低 |
| SQLite 数据库 | 4 个独立数据库 | 无统一管理 |

### 目标状态

| 指标 | 目标 |
|------|------|
| 总代码量 | < 35,000 行 (减少 ~28%) |
| 最大单文件 | < 500 行 |
| Comm 模块 | 1 个基类 + 8 个 < 100 行适配器 |
| 异常处理 | 分级分类，全部记录日志 |
| 日志 | 统一 `logging` 模块 |
| 测试覆盖率 | 3:1 代码/测试比 |
| 数据库 | 1 个统一数据库 + migration |

---

## 1. 项目文件结构 (当前 vs 目标)

### 1.1 当前结构 (问题标注)

```
lib/
├── gateway/
│   ├── gateway_api.py          ← 🔴 3,917 行 God File
│   ├── gateway_server.py       ← 🟡 915 行, 11+ 实例属性
│   ├── gateway_config.py       ← 🟢 497 行, OK
│   ├── router.py               ← 🟢 477 行, OK
│   ├── retry.py                ← 🟡 580 行, 重复 fallback 配置
│   ├── health_checker.py       ← 🟢 313 行, OK
│   ├── streaming.py            ← 🟢 500 行, OK
│   ├── parallel.py             ← 🟢 511 行, OK
│   ├── state_store.py          ← 🟡 1,435 行, 过大
│   ├── discussion.py           ← 🟡 1,356 行, 过大
│   ├── models.py               ← 🟢 OK
│   ├── cache.py                ← 🟢 OK
│   ├── auth.py                 ← 🟢 OK
│   ├── rate_limiter.py         ← 🟢 OK
│   ├── metrics.py              ← 🟢 OK
│   ├── knowledge_api.py        ← 🟢 OK (刚重写)
│   ├── backends/
│   │   ├── base_backend.py     ← 🟢 164 行
│   │   ├── http_backend.py     ← 🟡 560 行, 3种API格式硬编码
│   │   └── cli_backend.py      ← 🟡 1,071 行, 过大
│   ├── middleware/
│   └── web/
├── memory/
│   ├── memory_v2.py            ← 🟡 1,820 行
│   └── ...
├── knowledge/                  ← 🟢 刚重写, OK
├── agents/                     ← 🟢 OK
├── skills/                     ← 🟢 OK
├── codex_comm.py               ← 🔴 1,208 行, 与其他 comm 高度重复
├── opencode_comm.py            ← 🔴 1,210 行, 重复
├── gemini_comm.py              ← 🔴 935 行, 重复
├── claude_comm.py              ← 🔴 780 行, 重复
├── iflow_comm.py               ← 🔴 629 行, 重复
├── droid_comm.py               ← 🔴 611 行, 重复
├── qwen_comm.py                ← 🔴 548 行, 重复
├── kimi_comm.py                ← 🔴 529 行, 重复
└── terminal.py                 ← 🟡 1,177 行
```

### 1.2 目标结构

```
lib/
├── gateway/
│   ├── server.py               ← 重命名, < 400 行
│   ├── config.py               ← 重命名, 保持
│   ├── app.py                  ← 新: FastAPI app factory (< 100 行)
│   ├── routes/                 ← 🆕 拆分 gateway_api.py
│   │   ├── __init__.py
│   │   ├── core.py             ← /api/ask, /api/submit, /api/query
│   │   ├── batch.py            ← /api/batch/*
│   │   ├── parallel.py         ← /api/parallel/*
│   │   ├── discussion.py       ← /api/discussion/*
│   │   ├── memory.py           ← /api/memory/*
│   │   ├── admin.py            ← /api/admin/*, /api/cache/*
│   │   ├── health.py           ← /api/health, /api/metrics
│   │   ├── knowledge.py        ← /knowledge/* (现有)
│   │   └── websocket.py        ← /ws
│   ├── models.py               ← 合并所有 Pydantic models
│   ├── router.py               ← 保持
│   ├── retry.py                ← 保持
│   ├── cache.py                ← 保持
│   ├── streaming.py            ← 保持
│   ├── parallel_executor.py    ← 重命名
│   ├── health_checker.py       ← 保持
│   ├── state_store.py          ← 拆分: store.py + migrations.py
│   ├── discussion.py           ← 拆分: discussion.py + export.py
│   ├── auth.py                 ← 保持
│   ├── rate_limiter.py         ← 保持
│   ├── metrics.py              ← 保持
│   ├── backends/
│   │   ├── base.py             ← 增强: 加入 ContentExtractor 接口
│   │   ├── http.py             ← 拆分 provider-specific 解析
│   │   ├── cli.py              ← 拆分 auth 处理
│   │   └── extractors/         ← 🆕 provider-specific 内容提取
│   │       ├── __init__.py
│   │       ├── anthropic.py
│   │       ├── openai.py
│   │       └── gemini.py
│   ├── middleware/              ← 保持
│   └── web/                    ← 保持
├── providers/                  ← 🆕 替代 *_comm.py
│   ├── __init__.py
│   ├── base.py                 ← BaseCommReader 基类 (~200 行)
│   ├── codex.py                ← < 100 行适配器
│   ├── gemini.py               ← < 100 行适配器
│   ├── kimi.py                 ← < 100 行适配器
│   ├── qwen.py                 ← < 100 行适配器
│   ├── opencode.py             ← < 100 行适配器
│   ├── iflow.py                ← < 100 行适配器
│   ├── droid.py                ← < 100 行适配器
│   └── claude.py               ← < 100 行适配器
├── common/                     ← 🆕 共享基础设施
│   ├── __init__.py
│   ├── logging.py              ← 统一日志配置
│   ├── errors.py               ← 分级异常类
│   ├── auth.py                 ← 统一认证管理
│   └── tokens.py               ← Token 估算策略
├── memory/                     ← 保持
├── knowledge/                  ← 保持
├── agents/                     ← 保持
└── skills/                     ← 保持
```

---

## 2. Phase 1: 基础设施层 (Day 1-2)

### 2.1 创建 `lib/common/logging.py` — 统一日志

**问题**: 685 个 `print()` 调用，无结构化日志

**实现**:

```python
"""统一日志配置。"""
import logging
import sys
from typing import Optional


def setup_logging(
    level: str = "INFO",
    log_file: Optional[str] = None,
    json_format: bool = False,
) -> logging.Logger:
    """配置全局日志。"""
    root = logging.getLogger("hivemind")
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    fmt = "[%(asctime)s] %(levelname)s [%(name)s] %(message)s"
    datefmt = "%H:%M:%S"

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter(fmt, datefmt=datefmt))
    root.addHandler(handler)

    if log_file:
        fh = logging.FileHandler(log_file)
        fh.setFormatter(logging.Formatter(fmt, datefmt=datefmt))
        root.addHandler(fh)

    return root


def get_logger(name: str) -> logging.Logger:
    """获取模块级 logger。"""
    return logging.getLogger(f"hivemind.{name}")
```

**替换规则**:
```python
# 之前
print(f"[KnowledgeRouter] Initialized: ...")

# 之后
from lib.common.logging import get_logger
logger = get_logger("knowledge.router")
logger.info("Initialized: NotebookLM=%s, Obsidian=%s", ...)
```

**执行**: 用 `sed` 或手动替换所有 `print(f"[` 为 `logger.info(`，确保每个模块顶部 `logger = get_logger("module_name")`。

---

### 2.2 创建 `lib/common/errors.py` — 分级异常

**问题**: 500 个 `except Exception` 吞掉错误

**实现**:

```python
"""Hivemind 异常层级。"""


class HivemindError(Exception):
    """所有 Hivemind 异常的基类。"""


class ProviderError(HivemindError):
    """Provider 相关错误。"""
    def __init__(self, provider: str, message: str, retryable: bool = False):
        self.provider = provider
        self.retryable = retryable
        super().__init__(f"[{provider}] {message}")


class AuthError(ProviderError):
    """认证失败 (不可重试)。"""
    def __init__(self, provider: str, message: str = "authentication failed"):
        super().__init__(provider, message, retryable=False)


class TimeoutError(ProviderError):
    """超时 (可重试)。"""
    def __init__(self, provider: str, timeout_s: float):
        super().__init__(provider, f"timeout after {timeout_s}s", retryable=True)


class RateLimitError(ProviderError):
    """限流 (可重试)。"""
    def __init__(self, provider: str, retry_after: float = 0):
        self.retry_after = retry_after
        super().__init__(provider, "rate limited", retryable=True)


class BackendError(HivemindError):
    """后端执行错误。"""


class ConfigError(HivemindError):
    """配置错误。"""


class KnowledgeError(HivemindError):
    """知识库错误。"""
```

**替换规则**:
```python
# 之前 (吞掉所有异常)
try:
    result = backend.execute(request)
except Exception as exc:
    return None

# 之后 (分级处理)
try:
    result = backend.execute(request)
except AuthError:
    logger.warning("Auth failed for %s, skipping retry", provider)
    raise
except ProviderError as exc:
    if exc.retryable:
        logger.info("Retryable error: %s", exc)
        # retry logic
    else:
        logger.error("Non-retryable: %s", exc)
        raise
except Exception:
    logger.exception("Unexpected error in %s", provider)
    raise BackendError(f"Unexpected error in {provider}")
```

---

### 2.3 创建 `lib/common/auth.py` — 统一认证管理

**问题**: 5 个文件中重复的 auth URL 提取和浏览器打开逻辑

**实现**:

```python
"""统一认证管理。"""
import re
import webbrowser
from typing import Optional

from .logging import get_logger

logger = get_logger("common.auth")

# 所有 Provider 的认证指示关键词
AUTH_INDICATORS = {
    "codex": ["sign in", "not authenticated", "authentication required"],
    "gemini": ["authenticate", "login required", "gcloud auth"],
    "kimi": ["login", "认证", "token expired"],
    "qwen": ["qwen-oauth", "login"],
    "iflow": ["not authenticated"],
    "opencode": ["authenticate"],
}

# URL 提取正则
AUTH_URL_PATTERN = re.compile(r"https?://[^\s\"'<>]+(?:auth|login|oauth|sign-in)[^\s\"'<>]*")


def extract_auth_url(output: str) -> Optional[str]:
    """从命令输出中提取认证 URL。"""
    match = AUTH_URL_PATTERN.search(output)
    return match.group(0) if match else None


def is_auth_required(output: str, provider: str) -> bool:
    """判断输出是否表示需要认证。"""
    output_lower = output.lower()
    indicators = AUTH_INDICATORS.get(provider, [])
    return any(kw in output_lower for kw in indicators)


def handle_auth(output: str, provider: str, auto_open: bool = True) -> Optional[str]:
    """处理认证需求，返回 auth URL（如果有）。"""
    if not is_auth_required(output, provider):
        return None

    url = extract_auth_url(output)
    if url and auto_open:
        logger.info("Opening auth URL for %s: %s", provider, url)
        webbrowser.open(url)
    elif url:
        logger.info("Auth required for %s: %s", provider, url)

    return url
```

---

### 2.4 创建 `lib/common/tokens.py` — Token 估算

**问题**: 重复的 token 估算逻辑，无策略模式

```python
"""Token 估算。"""
import re


def estimate_tokens(text: str) -> int:
    """估算文本的 token 数。CJK 字符按 1.5 字符/token，ASCII 按 4 字符/token。"""
    if not text:
        return 0
    cjk = len(re.findall(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', text))
    ascii_chars = len(text) - cjk
    return int(cjk / 1.5 + ascii_chars / 4)


def estimate_input_output_tokens(input_text: str, output_text: str) -> dict:
    """估算输入/输出 tokens。"""
    return {
        "input_tokens": estimate_tokens(input_text),
        "output_tokens": estimate_tokens(output_text),
        "total_tokens": estimate_tokens(input_text) + estimate_tokens(output_text),
    }
```

---

## 3. Phase 2: 拆分 gateway_api.py (Day 2-3)

### 3.1 问题分析

`gateway_api.py` 是 3,917 行的 God File，包含:
- 1 个 `WebSocketManager` 类
- 21 个 Pydantic model
- 125+ 个路由处理函数
- 全部在 `create_api()` 工厂函数内定义

### 3.2 拆分策略

**步骤 1**: 提取 Pydantic models 到 `lib/gateway/models.py`

将所有 `class *Request(BaseModel)` 和 `class *Response(BaseModel)` 移到已有的 `models.py` 文件中。

**步骤 2**: 提取 WebSocketManager 到 `lib/gateway/routes/websocket.py`

**步骤 3**: 按功能域拆分路由

| 路由文件 | 端点前缀 | 预估行数 | 来源 |
|----------|----------|----------|------|
| `routes/core.py` | `/api/ask`, `/api/submit`, `/api/query` | ~400 | 核心请求处理 |
| `routes/batch.py` | `/api/batch/*` | ~200 | 批量操作 |
| `routes/parallel.py` | `/api/parallel/*` | ~200 | 并行执行 |
| `routes/discussion.py` | `/api/discussion/*` | ~300 | 多 AI 讨论 |
| `routes/memory.py` | `/api/memory/*` | ~300 | 记忆系统 |
| `routes/admin.py` | `/api/admin/*`, `/api/cache/*` | ~300 | 管理端点 |
| `routes/health.py` | `/api/health`, `/metrics` | ~200 | 健康/监控 |
| `routes/knowledge.py` | `/knowledge/*` | 已有 | 知识库 |
| `routes/websocket.py` | `/ws` | ~200 | WebSocket |

**步骤 4**: 创建 `lib/gateway/app.py` — 轻量 App 工厂

```python
"""FastAPI App 工厂。"""
from fastapi import FastAPI
from .routes import core, batch, parallel, discussion, memory, admin, health, websocket


def create_app(config, **kwargs) -> FastAPI:
    """创建 FastAPI 应用并注册所有路由。"""
    app = FastAPI(
        title="Hivemind Gateway",
        version="1.0.0",
    )

    # 注入共享依赖
    app.state.config = config
    app.state.store = kwargs.get("store")
    app.state.cache = kwargs.get("cache_manager")
    # ...

    # 注册路由
    app.include_router(core.router, prefix="/api", tags=["core"])
    app.include_router(batch.router, prefix="/api/batch", tags=["batch"])
    app.include_router(parallel.router, prefix="/api/parallel", tags=["parallel"])
    app.include_router(discussion.router, prefix="/api/discussion", tags=["discussion"])
    app.include_router(memory.router, prefix="/api/memory", tags=["memory"])
    app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
    app.include_router(health.router, tags=["health"])
    app.include_router(websocket.router, tags=["websocket"])

    return app
```

### 3.3 路由文件模板

每个路由文件的结构:

```python
"""Core API routes."""
from fastapi import APIRouter, Depends, Request

router = APIRouter()


def get_store(request: Request):
    return request.app.state.store


@router.post("/ask")
async def ask(payload: AskRequest, store=Depends(get_store)):
    """同步请求。"""
    ...


@router.post("/submit")
async def submit(payload: SubmitRequest, store=Depends(get_store)):
    """异步提交。"""
    ...
```

### 3.4 依赖注入

替换当前的参数传递为 FastAPI 的 Depends 机制:

```python
# 之前 (gateway_api.py 中的闭包方式)
def create_api(config, store, cache_manager, ...):
    @app.post("/api/ask")
    async def ask(request: AskRequest):
        result = cache_manager.get(...)  # 直接访问闭包变量

# 之后 (依赖注入)
@router.post("/ask")
async def ask(request: AskRequest, cache=Depends(get_cache)):
    result = cache.get(...)
```

---

## 4. Phase 3: 统一 Provider 通信层 (Day 3-4)

### 4.1 问题分析

8 个 `*_comm.py` 文件 (6,450 行) 共享以下重复方法:
- `capture_state()` — 8/8 文件
- `wait_for_message(state, timeout)` — 8/8
- `try_get_message(state)` — 8/8
- `_scan_latest_session()` — 7/8
- `set_preferred_session()` — 6/8
- `latest_message()` — 6/8
- `latest_conversations(n)` — 5/8
- `_extract_content_text()` — 6/8

### 4.2 设计: BaseCommReader

```python
"""Provider 通信基类。"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import hashlib
import json
import time

from lib.common.logging import get_logger


@dataclass
class CommState:
    """通信状态快照。"""
    session_id: Optional[str] = None
    last_mtime: float = 0.0
    last_size: int = 0
    message_count: int = 0


@dataclass
class CommMessage:
    """统一消息格式。"""
    role: str          # "assistant" | "user"
    content: str
    timestamp: float
    metadata: Dict[str, Any] = None


class BaseCommReader(ABC):
    """Provider 通信读取器基类。"""

    def __init__(self, provider_name: str, home_dir: Optional[str] = None):
        self.provider = provider_name
        self.home_dir = Path(home_dir or self._default_home()).expanduser()
        self.logger = get_logger(f"providers.{provider_name}")
        self._preferred_session: Optional[str] = None

    @abstractmethod
    def _default_home(self) -> str:
        """返回默认 home 目录路径。"""
        ...

    @abstractmethod
    def _find_session_file(self) -> Optional[Path]:
        """找到最新的 session 文件。"""
        ...

    @abstractmethod
    def _parse_messages(self, content: str) -> List[CommMessage]:
        """解析 session 文件内容为消息列表。"""
        ...

    def project_hash(self, path: str) -> str:
        """统一的项目哈希算法 (SHA256)。"""
        return hashlib.sha256(path.encode()).hexdigest()[:16]

    def capture_state(self) -> CommState:
        """捕获当前通信状态。"""
        session_file = self._find_session_file()
        if not session_file or not session_file.exists():
            return CommState()

        stat = session_file.stat()
        messages = self._parse_messages(session_file.read_text(encoding="utf-8"))
        return CommState(
            session_id=session_file.stem,
            last_mtime=stat.st_mtime,
            last_size=stat.st_size,
            message_count=len(messages),
        )

    def wait_for_message(self, state: CommState, timeout: float = 300) -> Optional[str]:
        """等待新消息。"""
        deadline = time.time() + timeout
        while time.time() < deadline:
            new_state = self.capture_state()
            if new_state.message_count > state.message_count:
                return self.latest_message()
            time.sleep(2)
        return None

    def try_get_message(self, state: CommState) -> Optional[str]:
        """非阻塞检查新消息。"""
        new_state = self.capture_state()
        if new_state.message_count > state.message_count:
            return self.latest_message()
        return None

    def latest_message(self) -> Optional[str]:
        """获取最新消息。"""
        session_file = self._find_session_file()
        if not session_file:
            return None
        messages = self._parse_messages(session_file.read_text(encoding="utf-8"))
        assistant_msgs = [m for m in messages if m.role == "assistant"]
        return assistant_msgs[-1].content if assistant_msgs else None

    def latest_conversations(self, n: int = 5) -> List[CommMessage]:
        """获取最近 n 条对话。"""
        session_file = self._find_session_file()
        if not session_file:
            return []
        messages = self._parse_messages(session_file.read_text(encoding="utf-8"))
        return messages[-n:]

    def set_preferred_session(self, session_id: str) -> None:
        self._preferred_session = session_id
```

### 4.3 Provider 适配器示例 (Kimi)

```python
"""Kimi Provider 适配器。"""
from pathlib import Path
from typing import List, Optional
import json

from .base import BaseCommReader, CommMessage


class KimiCommReader(BaseCommReader):
    """Kimi CLI session 读取器。"""

    def __init__(self):
        super().__init__("kimi")

    def _default_home(self) -> str:
        return "~/.kimi"

    def _find_session_file(self) -> Optional[Path]:
        sessions_dir = self.home_dir / "sessions"
        if not sessions_dir.exists():
            return None

        # 如果有首选 session
        if self._preferred_session:
            target = sessions_dir / self._preferred_session / "context.jsonl"
            if target.exists():
                return target

        # 找最新的 session 目录
        session_dirs = sorted(
            sessions_dir.iterdir(),
            key=lambda d: d.stat().st_mtime if d.is_dir() else 0,
            reverse=True,
        )
        for d in session_dirs:
            ctx = d / "context.jsonl"
            if ctx.exists():
                return ctx
        return None

    def _parse_messages(self, content: str) -> List[CommMessage]:
        messages = []
        for line in content.strip().split("\n"):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                messages.append(CommMessage(
                    role=entry.get("role", "unknown"),
                    content=entry.get("content", ""),
                    timestamp=entry.get("timestamp", 0),
                ))
            except json.JSONDecodeError:
                continue
        return messages
```

### 4.4 其他 Provider 适配器

| Provider | Home Dir | Session 文件格式 | 差异点 |
|----------|----------|-----------------|--------|
| **Codex** | `~/.codex-cli` | FIFO + `.codex-session` JSON | 需要 FIFO 写入 |
| **Gemini** | `~/.gemini` | `tmp/<hash>/chats/session-*.json` | SHA256 hash |
| **Kimi** | `~/.kimi` | `sessions/<hash>/context.jsonl` | JSONL |
| **Qwen** | `~/.qwen` | `projects/<hash>/chats/<id>.jsonl` | JSONL |
| **OpenCode** | `~/.opencode` | `sessions/*.json` | JSON |
| **iFlow** | `~/.iflow` | `sessions/*.jsonl` | JSONL |
| **Droid** | `~/.droid` | `logs/*.jsonl` | JSONL |
| **Claude** | `~/.claude` | `projects/*/sessions/*.jsonl` | JSONL |

每个适配器只需实现 3 个抽象方法 (`_default_home`, `_find_session_file`, `_parse_messages`)，约 40-80 行。

### 4.5 迁移策略

```python
# 保留旧文件作为兼容层
# lib/kimi_comm.py
from lib.providers.kimi import KimiCommReader as KimiComm  # 兼容导入

# 新代码使用
from lib.providers.kimi import KimiCommReader
```

---

## 5. Phase 4: Backend 层重构 (Day 4-5)

### 5.1 拆分 `cli_backend.py` (1,071 行)

提取出:

| 新文件 | 行数 | 内容 |
|--------|------|------|
| `backends/cli.py` | ~400 | 核心 CLIBackend 执行逻辑 |
| `backends/extractors/cli_output.py` | ~200 | `_clean_output()`, `_process_output()` |
| `common/auth.py` | ~100 | `_extract_auth_url()`, auth indicators (已在 Phase 1 创建) |
| `common/tokens.py` | ~50 | `estimate_tokens()` (已在 Phase 1 创建) |

### 5.2 拆分 `http_backend.py` (560 行)

当前 3 种 API 格式硬编码在一个文件中:

```python
# 当前
if self.config.name == "anthropic" or ...:
    return await self._execute_anthropic(request)
elif "gemini" in self.config.api_base_url:
    return await self._execute_gemini(request)
else:
    return await self._execute_openai_compatible(request)
```

**重构为 ContentExtractor 策略模式**:

```python
# lib/gateway/backends/extractors/__init__.py
class ContentExtractor(ABC):
    @abstractmethod
    def extract_response(self, data: dict) -> str: ...

    @abstractmethod
    def extract_tokens(self, data: dict) -> dict: ...


# lib/gateway/backends/extractors/anthropic.py
class AnthropicExtractor(ContentExtractor):
    def extract_response(self, data):
        return data["content"][0]["text"]

    def extract_tokens(self, data):
        usage = data.get("usage", {})
        return {"input": usage.get("input_tokens", 0), "output": usage.get("output_tokens", 0)}


# lib/gateway/backends/extractors/openai.py
class OpenAIExtractor(ContentExtractor):
    def extract_response(self, data):
        return data["choices"][0]["message"]["content"]


# lib/gateway/backends/extractors/gemini.py
class GeminiExtractor(ContentExtractor):
    def extract_response(self, data):
        return data["candidates"][0]["content"]["parts"][0]["text"]
```

```python
# lib/gateway/backends/http.py (重构后)
class HTTPBackend(BaseBackend):
    EXTRACTORS = {
        "anthropic": AnthropicExtractor(),
        "openai": OpenAIExtractor(),
        "gemini": GeminiExtractor(),
    }

    def _get_extractor(self) -> ContentExtractor:
        for key, ext in self.EXTRACTORS.items():
            if key in (self.config.name or "") or key in (self.config.api_base_url or ""):
                return ext
        return OpenAIExtractor()  # 默认

    async def execute(self, request):
        data = await self._call_api(request)
        extractor = self._get_extractor()
        return BackendResult(
            success=True,
            response=extractor.extract_response(data),
            tokens_used=extractor.extract_tokens(data),
        )
```

---

## 6. Phase 5: 数据库统一 (Day 5)

### 6.1 问题

当前 4 个独立 SQLite 数据库:

| 数据库 | 路径 | 用途 |
|--------|------|------|
| `gateway_state.db` | 根目录 | 请求状态、结果 |
| `gateway.db` | `.ccb_config/` | 重复？ |
| `knowledge_index.db` | `data/` | 知识库索引 |
| `memory.db` | (memory_v2) | 记忆系统 |

### 6.2 统一方案

合并为 1 个数据库 `data/hivemind.db`，通过 schema 前缀区分:

```sql
-- gateway_* tables
CREATE TABLE IF NOT EXISTS gateway_requests (...);
CREATE TABLE IF NOT EXISTS gateway_responses (...);

-- knowledge_* tables
CREATE TABLE IF NOT EXISTS knowledge_notebooks (...);
CREATE TABLE IF NOT EXISTS knowledge_cache (...);

-- memory_* tables
CREATE TABLE IF NOT EXISTS memory_sessions (...);
CREATE TABLE IF NOT EXISTS memory_entries (...);
```

**注意**: 此 Phase 可选，影响面大。如果风险过高，可保留独立数据库但统一路径到 `data/` 目录下。

---

## 7. Phase 6: 测试补充 (Day 5-6)

### 7.1 当前覆盖率

- 3,890 行测试 / 48,525 行代码 = **8%**
- `gateway_api.py` (3,917 行) 几乎无测试

### 7.2 需要新增的测试

| 测试文件 | 覆盖模块 | 优先级 |
|----------|----------|--------|
| `tests/test_knowledge_router.py` | Knowledge Hub 全流程 | 🔴 |
| `tests/test_routes_core.py` | 核心路由 (ask, submit, query) | 🔴 |
| `tests/test_base_comm.py` | BaseCommReader 基类 | 🔴 |
| `tests/test_content_extractors.py` | Anthropic/OpenAI/Gemini 提取器 | 🟡 |
| `tests/test_error_handling.py` | 分级异常处理 | 🟡 |
| `tests/test_auth_manager.py` | 统一认证 | 🟡 |
| `tests/test_token_estimation.py` | Token 估算 | 🟢 |

---

## 8. Phase 7: 清理与文档 (Day 6)

### 8.1 删除冗余代码

重构完成后，以下文件可删除:

```
# 替换为 lib/providers/*.py
lib/codex_comm.py        → lib/providers/codex.py
lib/opencode_comm.py     → lib/providers/opencode.py
lib/gemini_comm.py       → lib/providers/gemini.py
lib/claude_comm.py       → lib/providers/claude.py
lib/iflow_comm.py        → lib/providers/iflow.py
lib/droid_comm.py        → lib/providers/droid.py
lib/qwen_comm.py         → lib/providers/qwen.py
lib/kimi_comm.py         → lib/providers/kimi.py

# 替换为 lib/gateway/routes/*.py
lib/gateway/gateway_api.py → lib/gateway/app.py + routes/
```

### 8.2 print → logging 替换清单

**批量替换脚本**:

```bash
# 1. 找到所有带 [Module] 前缀的 print
grep -rn 'print(f"\[' lib/ | wc -l

# 2. 对每个模块执行替换
# gateway_server.py: print(f"[GatewayServer]") → logger.info()
# router.py: print(f"[KnowledgeRouter]") → logger.info()
# 等等
```

### 8.3 `except Exception` 清理优先级

| 优先级 | 模块 | 数量 | 行动 |
|--------|------|------|------|
| 🔴 P0 | gateway_server.py | ~30 | 替换为分级异常 |
| 🔴 P0 | backends/*.py | ~20 | 替换为 ProviderError |
| 🟡 P1 | memory/*.py | ~50 | 替换为 HivemindError |
| 🟡 P1 | knowledge/*.py | ~15 | 替换为 KnowledgeError |
| 🟢 P2 | *_comm.py | ~100 | 随 Phase 3 重构消除 |
| 🟢 P2 | agents/*.py | ~30 | 替换为 HivemindError |

---

## 9. 执行顺序与依赖

```
Phase 1: 基础设施 (common/)
  ├── logging.py      ← 无依赖
  ├── errors.py       ← 无依赖
  ├── auth.py         ← 依赖 logging
  └── tokens.py       ← 无依赖

Phase 2: 拆分 gateway_api.py
  ├── 提取 models     ← 依赖 Phase 1
  ├── 创建 routes/*   ← 依赖 models
  └── 创建 app.py     ← 依赖 routes

Phase 3: 统一 Providers
  ├── BaseCommReader  ← 依赖 Phase 1
  └── 8 个适配器      ← 依赖 BaseCommReader

Phase 4: Backend 重构
  ├── ContentExtractor ← 依赖 Phase 1
  ├── 拆分 cli.py      ← 依赖 common/auth
  └── 拆分 http.py     ← 依赖 extractors

Phase 5: 数据库统一 (可选)
  └── 合并 SQLite      ← 独立

Phase 6: 测试补充
  └── 新测试           ← 依赖所有 Phase

Phase 7: 清理
  ├── 删除旧文件       ← 依赖 Phase 3
  ├── print → logging  ← 依赖 Phase 1
  └── except 清理      ← 依赖 Phase 1
```

---

## 10. 验收标准

### 10.1 代码量

- [ ] 总代码量 < 35,000 行
- [ ] 最大单文件 < 500 行
- [ ] 无 `*_comm.py` 文件（全部迁移到 `lib/providers/`）
- [ ] `gateway_api.py` 被拆分为 `routes/` 目录

### 10.2 代码质量

- [ ] `except Exception` < 50 处（从 500 处降低 90%）
- [ ] `print()` 调用 < 20 处（从 685 处降低 97%）
- [ ] 所有模块使用 `logging` 模块
- [ ] 所有 Provider 使用 BaseCommReader 基类
- [ ] Content Extraction 使用策略模式

### 10.3 功能完整性

- [ ] Gateway 启动正常，所有端点可用
- [ ] 10 个 Provider 全部可用
- [ ] Knowledge Hub 正常工作
- [ ] Memory 系统正常工作
- [ ] WebSocket 流式响应正常
- [ ] Web UI 正常显示

### 10.4 测试

- [ ] 新增 7+ 测试文件
- [ ] 代码/测试比 < 5:1
- [ ] 所有测试通过

---

## 11. 关键约束

1. **不修改 `lib/knowledge/`** — 刚重写完成，已验证通过
2. **不修改 `config/`** — 配置文件保持稳定
3. **不修改 `lib/gateway/web/`** — Web UI 保持不变
4. **保持向后兼容** — 旧的 `*_comm.py` 导入路径通过 re-export 保持
5. **每个 Phase 单独提交** — 方便 review 和回滚
6. **先重构，后删除** — 确认新代码工作后再删除旧代码
7. **数据库统一是可选的** — 如果风险过高可跳过

---

## 12. 环境信息

| 项目 | 值 |
|------|------|
| 操作系统 | macOS (Darwin 23.2.0) |
| Python | 3.9+ |
| 项目根目录 | `~/.local/share/codex-dual/` |
| GitHub | `LeoLin990405/Hivemind` |
| Gateway 端口 | 8765 |
| 当前版本 | v0.26.0 |
| 目标版本 | v1.0.0 |
| 框架 | FastAPI + SQLite + asyncio |
