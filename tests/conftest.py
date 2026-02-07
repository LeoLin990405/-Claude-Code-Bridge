"""
Pytest fixtures for CCB Gateway tests.
"""
import asyncio
import os
import sys
import tempfile
from pathlib import Path

import pytest

# Add lib directory to path
lib_path = Path(__file__).parent.parent / "lib"
sys.path.insert(0, str(lib_path))


@pytest.fixture
def temp_db(tmp_path):
    """Create a temporary database path."""
    return str(tmp_path / "test_gateway.db")


@pytest.fixture
def store(temp_db):
    """Create a StateStore instance with temporary database."""
    from gateway.state_store import StateStore
    return StateStore(temp_db)


@pytest.fixture
def config():
    """Create a test GatewayConfig."""
    from gateway.gateway_config import GatewayConfig
    return GatewayConfig()


@pytest.fixture
def cache_config():
    """Create a test CacheConfig."""
    from gateway.cache import CacheConfig
    return CacheConfig(
        enabled=True,
        default_ttl_s=60.0,  # Short TTL for testing
        max_entries=100,
    )


@pytest.fixture
def cache_manager(store, cache_config):
    """Create a CacheManager instance."""
    from gateway.cache import CacheManager
    return CacheManager(store, cache_config)


@pytest.fixture
def rate_limit_config():
    """Create a test RateLimitConfig."""
    from gateway.rate_limiter import RateLimitConfig
    return RateLimitConfig(
        enabled=True,
        requests_per_minute=60,
        burst_size=10,
    )


@pytest.fixture
def rate_limiter(rate_limit_config):
    """Create a RateLimiter instance."""
    from gateway.rate_limiter import RateLimiter
    return RateLimiter(rate_limit_config)


@pytest.fixture
def auth_config():
    """Create a test AuthConfig."""
    from gateway.auth import AuthConfig
    return AuthConfig(
        enabled=True,
        allow_localhost=True,
    )


@pytest.fixture
def api_key_store(store):
    """Create an APIKeyStore instance."""
    from gateway.auth import APIKeyStore
    return APIKeyStore(store)


@pytest.fixture
def metrics():
    """Create a GatewayMetrics instance."""
    from gateway.metrics import GatewayMetrics
    return GatewayMetrics(use_prometheus_client=False)  # Use fallback for testing


@pytest.fixture
def sample_request():
    """Create a sample GatewayRequest."""
    from gateway.models import GatewayRequest
    return GatewayRequest.create(
        provider="claude",
        message="Hello, world!",
        priority=50,
        timeout_s=30.0,
    )


@pytest.fixture
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# Async test support
@pytest.fixture
def anyio_backend():
    return "asyncio"
