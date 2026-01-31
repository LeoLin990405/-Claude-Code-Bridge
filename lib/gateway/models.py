"""
Data models for CCB Gateway.

Defines the core data structures used throughout the gateway system.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional, Dict, Any, List
import time
import uuid


class RequestStatus(Enum):
    """Request lifecycle states."""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class BackendType(Enum):
    """Types of provider backends."""
    HTTP_API = "http_api"      # Direct HTTP API (OpenAI, Anthropic, DeepSeek)
    CLI_EXEC = "cli_exec"      # CLI subprocess execution (Codex, Gemini CLI)
    FIFO_PIPE = "fifo_pipe"    # FIFO/named pipe (legacy)
    TERMINAL = "terminal"      # WezTerm terminal (legacy compatibility)


class ProviderStatus(Enum):
    """Provider health status."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"
    UNKNOWN = "unknown"


@dataclass
class GatewayRequest:
    """Represents a request to the gateway."""
    id: str
    provider: str
    message: str
    status: RequestStatus
    created_at: float
    updated_at: float
    priority: int = 50
    timeout_s: float = 300.0
    metadata: Optional[Dict[str, Any]] = None
    # Routing info
    backend_type: Optional[BackendType] = None
    routed_at: Optional[float] = None
    # Response tracking
    started_at: Optional[float] = None
    completed_at: Optional[float] = None

    @classmethod
    def create(
        cls,
        provider: str,
        message: str,
        priority: int = 50,
        timeout_s: float = 300.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "GatewayRequest":
        """Create a new request with generated ID."""
        now = time.time()
        return cls(
            id=str(uuid.uuid4())[:12],
            provider=provider,
            message=message,
            status=RequestStatus.QUEUED,
            created_at=now,
            updated_at=now,
            priority=priority,
            timeout_s=timeout_s,
            metadata=metadata,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        d = asdict(self)
        d["status"] = self.status.value
        if self.backend_type:
            d["backend_type"] = self.backend_type.value
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GatewayRequest":
        """Create from dictionary."""
        data = data.copy()
        data["status"] = RequestStatus(data["status"])
        if data.get("backend_type"):
            data["backend_type"] = BackendType(data["backend_type"])
        return cls(**data)


@dataclass
class GatewayResponse:
    """Represents a response from a provider."""
    request_id: str
    status: RequestStatus
    response: Optional[str] = None
    error: Optional[str] = None
    provider: Optional[str] = None
    latency_ms: Optional[float] = None
    tokens_used: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        d = asdict(self)
        d["status"] = self.status.value
        return d


@dataclass
class ProviderInfo:
    """Information about a provider."""
    name: str
    backend_type: BackendType
    status: ProviderStatus = ProviderStatus.UNKNOWN
    queue_depth: int = 0
    avg_latency_ms: float = 0.0
    success_rate: float = 1.0
    last_check: Optional[float] = None
    error: Optional[str] = None
    # Configuration
    enabled: bool = True
    priority: int = 50
    rate_limit_rpm: Optional[int] = None
    timeout_s: float = 300.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        d = asdict(self)
        d["backend_type"] = self.backend_type.value
        d["status"] = self.status.value
        return d


@dataclass
class GatewayStats:
    """Gateway statistics."""
    uptime_s: float
    total_requests: int
    active_requests: int
    completed_requests: int
    failed_requests: int
    avg_latency_ms: float
    providers: List[ProviderInfo] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        d = asdict(self)
        d["providers"] = [p.to_dict() for p in self.providers]
        return d


@dataclass
class WebSocketEvent:
    """Event for WebSocket broadcast."""
    type: str  # "request_update", "provider_status", "gateway_stats"
    data: Dict[str, Any]
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "type": self.type,
            "data": self.data,
            "timestamp": self.timestamp,
        }
