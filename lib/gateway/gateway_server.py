"""
Gateway Server - Main Entry Point for CCB Gateway.

Orchestrates all gateway components and runs the server.
"""
from __future__ import annotations

import asyncio
import signal
import sys
import time
from pathlib import Path
from typing import Optional, Dict, Any

from .models import (
    RequestStatus,
    GatewayRequest,
    GatewayResponse,
    ProviderInfo,
    ProviderStatus,
    WebSocketEvent,
)
from .state_store import StateStore
from .request_queue import RequestQueue, AsyncRequestQueue
from .gateway_config import GatewayConfig
from .gateway_api import create_api
from .backends import BaseBackend, BackendResult, HTTPBackend, CLIBackend
from .backends.base_backend import BackendResult


class GatewayServer:
    """
    Main Gateway Server.

    Coordinates:
    - FastAPI application for REST/WebSocket
    - Request queue processing
    - Backend management
    - Health monitoring
    """

    def __init__(self, config: Optional[GatewayConfig] = None):
        """
        Initialize the gateway server.

        Args:
            config: Gateway configuration. Loads from default if not provided.
        """
        self.config = config or GatewayConfig.load()
        self.store = StateStore(str(self.config.get_db_path()))
        self.queue = RequestQueue(
            self.store,
            max_size=self.config.max_queue_size,
            max_concurrent=self.config.max_concurrent_requests,
        )
        self.async_queue: Optional[AsyncRequestQueue] = None

        # Backend instances
        self.backends: Dict[str, BaseBackend] = {}
        self._init_backends()

        # Router (lazy import to avoid circular deps)
        self._router = None

        # Server state
        self._running = False
        self._start_time: Optional[float] = None
        self._app = None

    def _init_backends(self) -> None:
        """Initialize backend instances for each provider."""
        from .models import BackendType

        for name, pconfig in self.config.providers.items():
            if not pconfig.enabled:
                continue

            try:
                if pconfig.backend_type == BackendType.HTTP_API:
                    self.backends[name] = HTTPBackend(pconfig)
                elif pconfig.backend_type == BackendType.CLI_EXEC:
                    self.backends[name] = CLIBackend(pconfig)
                # FIFO and Terminal backends can be added later
            except Exception as e:
                print(f"Warning: Failed to initialize backend for {name}: {e}")

    def _get_router(self):
        """Get or create the router instance."""
        if self._router is None:
            try:
                # Import from parent lib directory
                import sys
                lib_dir = Path(__file__).parent.parent
                if str(lib_dir) not in sys.path:
                    sys.path.insert(0, str(lib_dir))
                from unified_router import UnifiedRouter
                self._router = UnifiedRouter()
            except ImportError:
                self._router = None
        return self._router

    def route(self, message: str) -> Any:
        """Route a message to determine the best provider."""
        router = self._get_router()
        if router:
            return router.route(message)
        # Fallback: return a simple object with default provider
        class SimpleDecision:
            def __init__(self, provider):
                self.provider = provider
        return SimpleDecision(self.config.default_provider)

    async def process_request(self, request: GatewayRequest) -> None:
        """
        Process a single request.

        Called by the async queue processor.
        """
        provider = request.provider
        backend = self.backends.get(provider)

        if not backend:
            # No backend available, mark as failed
            self.store.update_request_status(request.id, RequestStatus.FAILED)
            self.store.save_response(GatewayResponse(
                request_id=request.id,
                status=RequestStatus.FAILED,
                error=f"No backend available for provider: {provider}",
            ))
            return

        # Broadcast processing started event
        if self._app and hasattr(self._app.state, 'ws_manager'):
            await self._app.state.ws_manager.broadcast(WebSocketEvent(
                type="request_processing",
                data={
                    "request_id": request.id,
                    "provider": provider,
                },
            ))

        # Execute request
        start_time = time.time()
        try:
            # For CLI backend, broadcast the command being executed
            if hasattr(backend, '_build_command') and hasattr(backend, 'config'):
                try:
                    cmd = backend._build_command(request.message)
                    cmd_str = " ".join(cmd[:3])  # Show first 3 parts of command
                    if len(cmd) > 3:
                        cmd_str += " ..."
                    if self._app and hasattr(self._app.state, 'ws_manager'):
                        await self._app.state.ws_manager.broadcast(WebSocketEvent(
                            type="cli_executing",
                            data={
                                "request_id": request.id,
                                "provider": provider,
                                "command": cmd_str,
                            },
                        ))
                except Exception:
                    pass  # Don't fail if we can't build command preview

            result = await backend.execute(request)
            latency_ms = (time.time() - start_time) * 1000

            if result.success:
                self.store.update_request_status(request.id, RequestStatus.COMPLETED)
                self.store.save_response(GatewayResponse(
                    request_id=request.id,
                    status=RequestStatus.COMPLETED,
                    response=result.response,
                    provider=provider,
                    latency_ms=latency_ms,
                    tokens_used=result.tokens_used,
                    metadata=result.metadata,
                ))
                self.queue.mark_completed(request.id, response=result.response)

                # Record success metric
                self.store.record_metric(
                    provider=provider,
                    event_type="request_completed",
                    request_id=request.id,
                    latency_ms=latency_ms,
                    success=True,
                )
            else:
                self.store.update_request_status(request.id, RequestStatus.FAILED)
                self.store.save_response(GatewayResponse(
                    request_id=request.id,
                    status=RequestStatus.FAILED,
                    error=result.error,
                    provider=provider,
                    latency_ms=latency_ms,
                ))
                self.queue.mark_completed(request.id, error=result.error)

                # Record failure metric
                self.store.record_metric(
                    provider=provider,
                    event_type="request_failed",
                    request_id=request.id,
                    latency_ms=latency_ms,
                    success=False,
                    error=result.error,
                )

            # Broadcast WebSocket event
            if self._app and hasattr(self._app.state, 'ws_manager'):
                event_type = "request_completed" if result.success else "request_failed"
                event_data = {
                    "request_id": request.id,
                    "provider": provider,
                    "success": result.success,
                    "latency_ms": latency_ms,
                }
                # Add response preview for completed requests
                if result.success and result.response:
                    resp_preview = result.response[:100] if len(result.response) > 100 else result.response
                    event_data["response"] = resp_preview
                # Add error for failed requests
                if not result.success and result.error:
                    event_data["error"] = result.error[:100] if len(result.error) > 100 else result.error

                await self._app.state.ws_manager.broadcast(WebSocketEvent(
                    type=event_type,
                    data=event_data,
                ))

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            self.store.update_request_status(request.id, RequestStatus.FAILED)
            self.store.save_response(GatewayResponse(
                request_id=request.id,
                status=RequestStatus.FAILED,
                error=str(e),
                provider=provider,
                latency_ms=latency_ms,
            ))
            self.queue.mark_completed(request.id, error=str(e))

            self.store.record_metric(
                provider=provider,
                event_type="request_error",
                request_id=request.id,
                latency_ms=latency_ms,
                success=False,
                error=str(e),
            )

    async def health_check_loop(self) -> None:
        """Periodically check provider health."""
        while self._running:
            for name, backend in self.backends.items():
                try:
                    status = await backend.check_health()
                    pconfig = self.config.providers.get(name)
                    if pconfig:
                        self.store.update_provider_status(ProviderInfo(
                            name=name,
                            backend_type=pconfig.backend_type,
                            status=status,
                            queue_depth=self.queue.get_queue_depth(name),
                            last_check=time.time(),
                            enabled=pconfig.enabled,
                        ))
                except Exception:
                    pass

            await asyncio.sleep(60)  # Check every minute

    async def cleanup_loop(self) -> None:
        """Periodically clean up old data."""
        while self._running:
            try:
                # Clean up old requests
                self.store.cleanup_old_requests(self.config.request_ttl_hours)
                # Clean up old metrics
                self.store.cleanup_old_metrics(168)  # 7 days
            except Exception:
                pass

            await asyncio.sleep(3600)  # Run every hour

    def create_app(self):
        """Create the FastAPI application."""
        self._app = create_api(
            config=self.config,
            store=self.store,
            queue=self.queue,
            router_func=self.route,
        )
        return self._app

    async def start(self) -> None:
        """Start the gateway server."""
        self._running = True
        self._start_time = time.time()

        # Start async queue processor
        self.async_queue = AsyncRequestQueue(self.queue)
        await self.async_queue.start(self.process_request)

        # Start background tasks
        asyncio.create_task(self.health_check_loop())
        asyncio.create_task(self.cleanup_loop())

        print(f"Gateway server started")

    async def stop(self) -> None:
        """Stop the gateway server."""
        self._running = False

        # Stop queue processor
        if self.async_queue:
            await self.async_queue.stop()

        # Shutdown backends
        for backend in self.backends.values():
            try:
                await backend.shutdown()
            except Exception:
                pass

        print("Gateway server stopped")

    def run(self, host: Optional[str] = None, port: Optional[int] = None) -> int:
        """
        Run the gateway server.

        Args:
            host: Override host from config
            port: Override port from config

        Returns:
            Exit code
        """
        try:
            import uvicorn
        except ImportError:
            print("Error: uvicorn is required. Install with: pip install uvicorn")
            return 1

        host = host or self.config.host
        port = port or self.config.port

        app = self.create_app()

        # Setup signal handlers
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def startup():
            await self.start()

        async def shutdown():
            await self.stop()

        @app.on_event("startup")
        async def on_startup():
            await startup()

        @app.on_event("shutdown")
        async def on_shutdown():
            await shutdown()

        print(f"Starting CCB Gateway at http://{host}:{port}")
        print(f"API docs available at http://{host}:{port}/docs")

        uvicorn.run(app, host=host, port=port, log_level=self.config.log_level.lower())
        return 0


def run_gateway(
    config_path: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
) -> int:
    """
    Run the gateway server.

    Args:
        config_path: Path to configuration file
        host: Override host
        port: Override port

    Returns:
        Exit code
    """
    config = GatewayConfig.load(config_path)
    server = GatewayServer(config)
    return server.run(host, port)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="CCB Gateway Server")
    parser.add_argument("--config", "-c", help="Path to configuration file")
    parser.add_argument("--host", "-H", help="Host to bind to")
    parser.add_argument("--port", "-p", type=int, help="Port to bind to")

    args = parser.parse_args()

    sys.exit(run_gateway(
        config_path=args.config,
        host=args.host,
        port=args.port,
    ))
