"""
Gateway API - FastAPI Routes for CCB Gateway.

Provides REST and WebSocket endpoints for the gateway.
"""
from __future__ import annotations

import asyncio
import time
from typing import Optional, List, Dict, Any, Set

try:
    from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel, Field
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

from .models import (
    RequestStatus,
    GatewayRequest,
    GatewayResponse,
    GatewayStats,
    WebSocketEvent,
)
from .state_store import StateStore
from .request_queue import RequestQueue
from .gateway_config import GatewayConfig


# Pydantic models for API
if HAS_FASTAPI:
    class AskRequest(BaseModel):
        """Request body for /api/ask endpoint."""
        message: str = Field(..., description="The message to send to the provider")
        provider: Optional[str] = Field(None, description="Provider name (auto-routed if not specified)")
        timeout_s: float = Field(300.0, description="Request timeout in seconds")
        priority: int = Field(50, description="Request priority (higher = more urgent)")

    class AskResponse(BaseModel):
        """Response body for /api/ask endpoint."""
        request_id: str
        provider: str
        status: str

    class ReplyResponse(BaseModel):
        """Response body for /api/reply endpoint."""
        request_id: str
        status: str
        response: Optional[str] = None
        error: Optional[str] = None
        latency_ms: Optional[float] = None

    class StatusResponse(BaseModel):
        """Response body for /api/status endpoint."""
        gateway: Dict[str, Any]
        providers: List[Dict[str, Any]]


class WebSocketManager:
    """Manages WebSocket connections for real-time updates."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        async with self._lock:
            self.active_connections.discard(websocket)

    async def broadcast(self, event: WebSocketEvent) -> None:
        """Broadcast an event to all connected clients."""
        if not self.active_connections:
            return

        message = event.to_dict()
        async with self._lock:
            dead_connections = set()
            for connection in self.active_connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.add(connection)

            # Clean up dead connections
            self.active_connections -= dead_connections

    async def send_to(self, websocket: WebSocket, event: WebSocketEvent) -> None:
        """Send an event to a specific client."""
        try:
            await websocket.send_json(event.to_dict())
        except Exception:
            await self.disconnect(websocket)


def create_api(
    config: GatewayConfig,
    store: StateStore,
    queue: RequestQueue,
    router_func=None,
) -> "FastAPI":
    """
    Create the FastAPI application with all routes.

    Args:
        config: Gateway configuration
        store: State store instance
        queue: Request queue instance
        router_func: Optional routing function for auto-routing

    Returns:
        Configured FastAPI application
    """
    if not HAS_FASTAPI:
        raise ImportError("FastAPI is required. Install with: pip install fastapi uvicorn")

    app = FastAPI(
        title="CCB Gateway",
        description="Unified API Gateway for Multi-Provider AI Communication",
        version="1.0.0",
    )

    ws_manager = WebSocketManager()
    start_time = time.time()

    # ==================== REST Endpoints ====================

    @app.post("/api/ask", response_model=AskResponse)
    async def ask(request: AskRequest) -> AskResponse:
        """
        Submit a request to an AI provider.

        The request is queued and processed asynchronously.
        Use /api/reply/{request_id} to get the response.
        """
        # Determine provider
        provider = request.provider
        if not provider:
            if router_func:
                decision = router_func(request.message)
                provider = decision.provider
            else:
                provider = config.default_provider

        # Validate provider
        if provider not in config.providers:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown provider: {provider}. Available: {list(config.providers.keys())}",
            )

        # Create request
        gw_request = GatewayRequest.create(
            provider=provider,
            message=request.message,
            priority=request.priority,
            timeout_s=request.timeout_s,
        )

        # Enqueue
        if not queue.enqueue(gw_request):
            raise HTTPException(
                status_code=503,
                detail="Request queue is full. Try again later.",
            )

        # Broadcast event with message preview for monitor
        msg_preview = request.message[:100] if len(request.message) > 100 else request.message
        await ws_manager.broadcast(WebSocketEvent(
            type="request_submitted",
            data={
                "request_id": gw_request.id,
                "provider": provider,
                "message": msg_preview,
            },
        ))

        return AskResponse(
            request_id=gw_request.id,
            provider=provider,
            status=gw_request.status.value,
        )

    @app.get("/api/reply/{request_id}", response_model=ReplyResponse)
    async def get_reply(
        request_id: str,
        wait: bool = Query(False, description="Wait for completion"),
        timeout: float = Query(30.0, description="Wait timeout in seconds"),
    ) -> ReplyResponse:
        """
        Get the response for a request.

        If wait=true, blocks until the request completes or times out.
        """
        # Get request
        request = store.get_request(request_id)
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

        # If waiting and not complete, poll
        if wait and request.status in (RequestStatus.QUEUED, RequestStatus.PROCESSING):
            deadline = time.time() + timeout
            while time.time() < deadline:
                await asyncio.sleep(0.5)
                request = store.get_request(request_id)
                if not request or request.status not in (RequestStatus.QUEUED, RequestStatus.PROCESSING):
                    break

        # Get response if available
        response = store.get_response(request_id)

        return ReplyResponse(
            request_id=request_id,
            status=request.status.value if request else "unknown",
            response=response.response if response else None,
            error=response.error if response else None,
            latency_ms=response.latency_ms if response else None,
        )

    @app.get("/api/status", response_model=StatusResponse)
    async def get_status() -> StatusResponse:
        """Get gateway and provider status."""
        uptime = time.time() - start_time
        stats = store.get_stats()
        queue_stats = queue.stats()

        providers = []
        for name, pconfig in config.providers.items():
            pstatus = store.get_provider_status(name)
            metrics = store.get_provider_metrics(name, hours=24)

            providers.append({
                "name": name,
                "enabled": pconfig.enabled,
                "status": pstatus.status.value if pstatus else "unknown",
                "queue_depth": queue_stats["by_provider"].get(name, 0),
                "avg_latency_ms": metrics.get("avg_latency_ms", 0),
                "success_rate": metrics.get("success_rate", 1.0),
            })

        return StatusResponse(
            gateway={
                "uptime_s": uptime,
                "total_requests": stats["total_requests"],
                "active_requests": stats["active_requests"],
                "queue_depth": queue_stats["queue_depth"],
                "processing_count": queue_stats["processing_count"],
            },
            providers=providers,
        )

    @app.delete("/api/request/{request_id}")
    async def cancel_request(request_id: str) -> Dict[str, Any]:
        """Cancel a pending or processing request."""
        success = queue.cancel(request_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail="Request not found or already completed",
            )

        await ws_manager.broadcast(WebSocketEvent(
            type="request_cancelled",
            data={"request_id": request_id},
        ))

        return {"success": True, "request_id": request_id}

    @app.get("/api/requests")
    async def list_requests(
        status: Optional[str] = None,
        provider: Optional[str] = None,
        limit: int = Query(50, le=100),
        offset: int = Query(0, ge=0),
    ) -> List[Dict[str, Any]]:
        """List requests with optional filtering."""
        status_enum = RequestStatus(status) if status else None
        requests = store.list_requests(
            status=status_enum,
            provider=provider,
            limit=limit,
            offset=offset,
        )
        return [r.to_dict() for r in requests]

    @app.get("/api/queue")
    async def get_queue_status() -> Dict[str, Any]:
        """Get detailed queue status."""
        return queue.stats()

    @app.get("/api/providers")
    async def list_providers() -> List[Dict[str, Any]]:
        """List all configured providers."""
        providers = []
        for name, pconfig in config.providers.items():
            providers.append({
                "name": name,
                "backend_type": pconfig.backend_type.value,
                "enabled": pconfig.enabled,
                "priority": pconfig.priority,
                "timeout_s": pconfig.timeout_s,
            })
        return providers

    @app.get("/api/health")
    async def health_check() -> Dict[str, str]:
        """Simple health check endpoint."""
        return {"status": "ok"}

    # ==================== WebSocket Endpoint ====================

    @app.websocket("/api/ws")
    async def websocket_endpoint(websocket: WebSocket):
        """
        WebSocket endpoint for real-time updates.

        Events:
        - request_queued: New request added to queue
        - request_started: Request processing started
        - request_completed: Request completed successfully
        - request_failed: Request failed
        - request_cancelled: Request was cancelled
        - provider_status: Provider status changed
        """
        await ws_manager.connect(websocket)
        try:
            while True:
                # Wait for messages from client
                data = await websocket.receive_json()

                # Handle subscription messages
                if data.get("type") == "subscribe":
                    channels = data.get("channels", [])
                    await ws_manager.send_to(websocket, WebSocketEvent(
                        type="subscribed",
                        data={"channels": channels},
                    ))

                elif data.get("type") == "ping":
                    await ws_manager.send_to(websocket, WebSocketEvent(
                        type="pong",
                        data={},
                    ))

        except WebSocketDisconnect:
            await ws_manager.disconnect(websocket)
        except Exception:
            await ws_manager.disconnect(websocket)

    # Store ws_manager on app for external access
    app.state.ws_manager = ws_manager

    return app
