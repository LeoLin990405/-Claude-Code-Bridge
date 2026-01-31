"""
Gateway API - FastAPI Routes for CCB Gateway.

Provides REST and WebSocket endpoints for the gateway.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Optional, List, Dict, Any, Set

try:
    from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
    from fastapi.responses import JSONResponse, StreamingResponse
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
        provider: Optional[str] = Field(None, description="Provider name, @group, or auto-routed if not specified")
        timeout_s: float = Field(300.0, description="Request timeout in seconds")
        priority: int = Field(50, description="Request priority (higher = more urgent)")
        cache_bypass: bool = Field(False, description="Bypass cache for this request")
        aggregation_strategy: Optional[str] = Field(None, description="Strategy for parallel queries: first_success, fastest, all, consensus")

    class AskResponse(BaseModel):
        """Response body for /api/ask endpoint."""
        request_id: str
        provider: str
        status: str
        cached: bool = False
        parallel: bool = False

    class ReplyResponse(BaseModel):
        """Response body for /api/reply endpoint."""
        request_id: str
        status: str
        response: Optional[str] = None
        error: Optional[str] = None
        latency_ms: Optional[float] = None
        cached: bool = False
        retry_info: Optional[Dict[str, Any]] = None

    class StatusResponse(BaseModel):
        """Response body for /api/status endpoint."""
        gateway: Dict[str, Any]
        providers: List[Dict[str, Any]]

    class CacheStatsResponse(BaseModel):
        """Response body for /api/cache/stats endpoint."""
        hits: int
        misses: int
        hit_rate: float
        total_entries: int
        expired_entries: int
        total_tokens_saved: int

    class ParallelResponse(BaseModel):
        """Response body for parallel query results."""
        request_id: str
        strategy: str
        selected_provider: Optional[str] = None
        selected_response: Optional[str] = None
        all_responses: Dict[str, Any] = {}
        latency_ms: float = 0.0
        success: bool = False
        error: Optional[str] = None


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
    cache_manager=None,
    stream_manager=None,
    parallel_executor=None,
    retry_executor=None,
) -> "FastAPI":
    """
    Create the FastAPI application with all routes.

    Args:
        config: Gateway configuration
        store: State store instance
        queue: Request queue instance
        router_func: Optional routing function for auto-routing
        cache_manager: Optional cache manager instance
        stream_manager: Optional stream manager instance
        parallel_executor: Optional parallel executor instance
        retry_executor: Optional retry executor instance

    Returns:
        Configured FastAPI application
    """
    if not HAS_FASTAPI:
        raise ImportError("FastAPI is required. Install with: pip install fastapi uvicorn")

    app = FastAPI(
        title="CCB Gateway",
        description="Unified API Gateway for Multi-Provider AI Communication",
        version="2.0.0",
    )

    ws_manager = WebSocketManager()
    start_time = time.time()

    # ==================== Helper Functions ====================

    def parse_provider_spec(spec: str) -> tuple[List[str], bool]:
        """Parse provider specification (single, @group, or @all)."""
        if spec.startswith("@"):
            providers = config.parallel.get_provider_group(spec)
            return providers, len(providers) > 1
        return [spec], False

    # ==================== REST Endpoints ====================

    @app.post("/api/ask", response_model=AskResponse)
    async def ask(request: AskRequest) -> AskResponse:
        """
        Submit a request to an AI provider.

        Supports:
        - Single provider: provider="claude"
        - Provider groups: provider="@all", "@fast", "@coding"
        - Auto-routing: provider=None (uses router or default)
        - Cache bypass: cache_bypass=True
        """
        # Determine provider(s)
        provider_spec = request.provider
        if not provider_spec:
            if router_func:
                decision = router_func(request.message)
                provider_spec = decision.provider
            else:
                provider_spec = config.default_provider

        # Parse provider specification
        providers, is_parallel = parse_provider_spec(provider_spec)

        if not providers:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown provider or group: {provider_spec}",
            )

        # Check cache first (only for single provider, non-parallel)
        if not is_parallel and cache_manager and config.cache.enabled and not request.cache_bypass:
            cached = cache_manager.get(providers[0], request.message)
            if cached:
                # Return cached response immediately
                gw_request = GatewayRequest.create(
                    provider=providers[0],
                    message=request.message,
                    priority=request.priority,
                    timeout_s=request.timeout_s,
                    metadata={"cached": True, "cache_key": cached.cache_key},
                )
                # Save to store for consistency
                store.create_request(gw_request)
                store.update_request_status(gw_request.id, RequestStatus.COMPLETED)
                store.save_response(GatewayResponse(
                    request_id=gw_request.id,
                    status=RequestStatus.COMPLETED,
                    response=cached.response,
                    provider=providers[0],
                    latency_ms=0.0,
                    tokens_used=cached.tokens_used,
                    metadata={"cached": True},
                ))

                return AskResponse(
                    request_id=gw_request.id,
                    provider=providers[0],
                    status="completed",
                    cached=True,
                    parallel=False,
                )

        # Validate providers
        for p in providers:
            if p not in config.providers:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown provider: {p}. Available: {list(config.providers.keys())}",
                )

        # Create request
        gw_request = GatewayRequest.create(
            provider=providers[0] if not is_parallel else provider_spec,
            message=request.message,
            priority=request.priority,
            timeout_s=request.timeout_s,
            metadata={
                "parallel": is_parallel,
                "providers": providers if is_parallel else None,
                "aggregation_strategy": request.aggregation_strategy,
            },
        )

        # Enqueue
        if not queue.enqueue(gw_request):
            raise HTTPException(
                status_code=503,
                detail="Request queue is full. Try again later.",
            )

        # Broadcast event
        msg_preview = request.message[:100] if len(request.message) > 100 else request.message
        await ws_manager.broadcast(WebSocketEvent(
            type="request_submitted",
            data={
                "request_id": gw_request.id,
                "provider": provider_spec,
                "message": msg_preview,
                "parallel": is_parallel,
            },
        ))

        return AskResponse(
            request_id=gw_request.id,
            provider=provider_spec,
            status=gw_request.status.value,
            cached=False,
            parallel=is_parallel,
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
        if wait and request.status in (RequestStatus.QUEUED, RequestStatus.PROCESSING, RequestStatus.RETRYING):
            deadline = time.time() + timeout
            while time.time() < deadline:
                await asyncio.sleep(0.5)
                request = store.get_request(request_id)
                if not request or request.status not in (RequestStatus.QUEUED, RequestStatus.PROCESSING, RequestStatus.RETRYING):
                    break

        # Get response if available
        response = store.get_response(request_id)

        return ReplyResponse(
            request_id=request_id,
            status=request.status.value if request else "unknown",
            response=response.response if response else None,
            error=response.error if response else None,
            latency_ms=response.latency_ms if response else None,
            cached=response.metadata.get("cached", False) if response and response.metadata else False,
            retry_info=response.metadata.get("retry_info") if response and response.metadata else None,
        )

    @app.post("/api/ask/stream")
    async def ask_stream(request: AskRequest):
        """
        Submit a request and stream the response via SSE.

        Returns Server-Sent Events with chunks of the response.
        """
        if not config.streaming.enabled:
            raise HTTPException(status_code=400, detail="Streaming is disabled")

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
                detail=f"Unknown provider: {provider}",
            )

        # Create request
        gw_request = GatewayRequest.create(
            provider=provider,
            message=request.message,
            priority=request.priority,
            timeout_s=request.timeout_s,
        )

        async def generate_stream():
            """Generate SSE stream."""
            if stream_manager:
                backend = app.state.backends.get(provider) if hasattr(app.state, 'backends') else None
                if backend:
                    async for chunk in stream_manager.stream_response(
                        gw_request.id, provider, backend, gw_request
                    ):
                        yield chunk
                else:
                    yield f"data: {json.dumps({'type': 'error', 'error': 'Backend not available'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'error': 'Streaming not configured'})}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @app.get("/api/status", response_model=StatusResponse)
    async def get_status() -> StatusResponse:
        """Get gateway and provider status."""
        uptime = time.time() - start_time
        stats = store.get_stats()
        queue_stats = queue.stats()

        # Get cache stats if available
        cache_stats = None
        if cache_manager:
            cache_stats = cache_manager.get_stats().to_dict()

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
                "cache": cache_stats,
                "features": {
                    "retry_enabled": config.retry.enabled,
                    "cache_enabled": config.cache.enabled,
                    "streaming_enabled": config.streaming.enabled,
                    "parallel_enabled": config.parallel.enabled,
                },
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
                "supports_streaming": pconfig.supports_streaming,
            })
        return providers

    @app.get("/api/provider-groups")
    async def list_provider_groups() -> Dict[str, List[str]]:
        """List all configured provider groups for parallel queries."""
        return config.parallel.provider_groups

    @app.get("/api/health")
    async def health_check() -> Dict[str, str]:
        """Simple health check endpoint."""
        return {"status": "ok"}

    # ==================== Cache Endpoints ====================

    @app.get("/api/cache/stats", response_model=CacheStatsResponse)
    async def get_cache_stats() -> CacheStatsResponse:
        """Get cache statistics."""
        if not cache_manager:
            raise HTTPException(status_code=400, detail="Cache not enabled")

        stats = cache_manager.get_stats()
        return CacheStatsResponse(
            hits=stats.hits,
            misses=stats.misses,
            hit_rate=stats.hit_rate,
            total_entries=stats.total_entries,
            expired_entries=stats.expired_entries,
            total_tokens_saved=stats.total_tokens_saved,
        )

    @app.delete("/api/cache")
    async def clear_cache(
        provider: Optional[str] = Query(None, description="Clear cache for specific provider"),
    ) -> Dict[str, Any]:
        """Clear cache entries."""
        if not cache_manager:
            raise HTTPException(status_code=400, detail="Cache not enabled")

        cleared = cache_manager.clear(provider)
        return {"cleared": cleared, "provider": provider}

    @app.post("/api/cache/cleanup")
    async def cleanup_cache() -> Dict[str, Any]:
        """Remove expired cache entries."""
        if not cache_manager:
            raise HTTPException(status_code=400, detail="Cache not enabled")

        removed = cache_manager.cleanup_expired()
        return {"removed": removed}

    # ==================== Retry/Fallback Endpoints ====================

    @app.get("/api/retry/config")
    async def get_retry_config() -> Dict[str, Any]:
        """Get retry and fallback configuration."""
        return {
            "enabled": config.retry.enabled,
            "max_retries": config.retry.max_retries,
            "base_delay_s": config.retry.base_delay_s,
            "max_delay_s": config.retry.max_delay_s,
            "fallback_enabled": config.retry.fallback_enabled,
            "fallback_chains": config.retry.fallback_chains,
        }

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
        - request_retrying: Request is being retried
        - request_fallback: Request switched to fallback provider
        - provider_status: Provider status changed
        - stream_chunk: Streaming response chunk
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
