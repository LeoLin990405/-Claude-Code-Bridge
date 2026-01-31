"""
CCB Gateway - Unified API Layer for Multi-Provider AI Communication

This module provides a unified gateway that decouples message passing from
terminal/pane management. The gateway handles:

- Request routing to appropriate backends
- Request queuing with priority support
- State persistence via SQLite
- WebSocket notifications for real-time updates
- Backend abstraction (HTTP API, CLI, FIFO, Terminal)

Architecture:
    Client -> Gateway API -> Router -> Backend -> Provider
                  |
                  v
            State Store (SQLite)
                  |
                  v
            Monitor Service (WebSocket)

Usage:
    # Start the gateway server
    from gateway import GatewayServer, GatewayConfig

    config = GatewayConfig.load()
    server = GatewayServer(config)
    server.run()

    # Or use the CLI
    $ ccb-gateway start
    $ ccb-gateway status
    $ ccb-gateway ask "Hello, world!" --provider claude --wait
"""
from __future__ import annotations

from .models import (
    RequestStatus,
    BackendType,
    ProviderStatus,
    GatewayRequest,
    GatewayResponse,
    ProviderInfo,
    GatewayStats,
    WebSocketEvent,
)
from .state_store import StateStore
from .request_queue import RequestQueue, AsyncRequestQueue
from .gateway_config import GatewayConfig, ProviderConfig
from .gateway_server import GatewayServer, run_gateway

__all__ = [
    # Models
    "RequestStatus",
    "BackendType",
    "ProviderStatus",
    "GatewayRequest",
    "GatewayResponse",
    "ProviderInfo",
    "GatewayStats",
    "WebSocketEvent",
    # Storage
    "StateStore",
    # Queue
    "RequestQueue",
    "AsyncRequestQueue",
    # Config
    "GatewayConfig",
    "ProviderConfig",
    # Server
    "GatewayServer",
    "run_gateway",
]
