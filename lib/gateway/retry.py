"""
Retry and Fallback Logic for CCB Gateway.

Provides automatic retry with exponential backoff and provider fallback chains.
"""
from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, List, Callable, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .backends.base_backend import BackendResult
    from .models import GatewayRequest


class ErrorType(Enum):
    """Classification of errors for retry decisions."""
    RETRYABLE_TRANSIENT = "retryable_transient"  # Network errors, timeouts, 5xx
    RETRYABLE_RATE_LIMIT = "retryable_rate_limit"  # 429 rate limit
    NON_RETRYABLE_AUTH = "non_retryable_auth"  # 401, 403 auth errors
    NON_RETRYABLE_CLIENT = "non_retryable_client"  # Other 4xx client errors
    NON_RETRYABLE_PERMANENT = "non_retryable_permanent"  # Permanent failures


# Default fallback chains for providers
DEFAULT_FALLBACK_CHAINS: Dict[str, List[str]] = {
    "claude": ["deepseek", "gemini"],
    "gemini": ["claude", "deepseek"],
    "deepseek": ["claude", "qwen"],
    "codex": ["opencode", "claude"],
    "opencode": ["codex", "claude"],
    "kimi": ["qwen", "deepseek"],
    "qwen": ["kimi", "deepseek"],
    "iflow": ["claude", "deepseek"],
}

# Default provider groups for parallel queries
DEFAULT_PROVIDER_GROUPS: Dict[str, List[str]] = {
    "all": ["claude", "gemini", "deepseek", "codex"],
    "fast": ["claude", "deepseek"],
    "reasoning": ["deepseek", "claude"],
    "coding": ["codex", "claude", "opencode"],
    "chinese": ["deepseek", "kimi", "qwen"],
}


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    enabled: bool = True
    max_retries: int = 3
    base_delay_s: float = 1.0
    max_delay_s: float = 30.0
    exponential_base: float = 2.0
    jitter: bool = True
    # Fallback configuration
    fallback_enabled: bool = True
    fallback_chains: Dict[str, List[str]] = field(default_factory=lambda: DEFAULT_FALLBACK_CHAINS.copy())
    # Provider groups for parallel queries
    provider_groups: Dict[str, List[str]] = field(default_factory=lambda: DEFAULT_PROVIDER_GROUPS.copy())

    def get_delay(self, attempt: int) -> float:
        """Calculate delay for a given retry attempt."""
        delay = self.base_delay_s * (self.exponential_base ** attempt)
        delay = min(delay, self.max_delay_s)
        if self.jitter:
            delay = delay * (0.5 + random.random())
        return delay

    def get_fallbacks(self, provider: str) -> List[str]:
        """Get fallback providers for a given provider."""
        return self.fallback_chains.get(provider, [])

    def get_provider_group(self, group_name: str) -> List[str]:
        """Get providers in a named group."""
        # Remove @ prefix if present
        name = group_name.lstrip("@")
        return self.provider_groups.get(name, [])


def classify_error(error: str, status_code: Optional[int] = None) -> ErrorType:
    """
    Classify an error to determine retry behavior.

    Args:
        error: Error message string
        status_code: HTTP status code if available

    Returns:
        ErrorType classification
    """
    error_lower = error.lower()

    # Check status code first
    if status_code:
        if status_code == 429:
            return ErrorType.RETRYABLE_RATE_LIMIT
        if status_code in (401, 403):
            return ErrorType.NON_RETRYABLE_AUTH
        if 400 <= status_code < 500:
            return ErrorType.NON_RETRYABLE_CLIENT
        if status_code >= 500:
            return ErrorType.RETRYABLE_TRANSIENT

    # Check error message patterns
    # Rate limit patterns
    rate_limit_patterns = [
        "rate limit",
        "too many requests",
        "quota exceeded",
        "throttl",
    ]
    if any(p in error_lower for p in rate_limit_patterns):
        return ErrorType.RETRYABLE_RATE_LIMIT

    # Auth patterns
    auth_patterns = [
        "unauthorized",
        "authentication",
        "invalid api key",
        "api key not found",
        "forbidden",
        "access denied",
    ]
    if any(p in error_lower for p in auth_patterns):
        return ErrorType.NON_RETRYABLE_AUTH

    # Transient/retryable patterns
    transient_patterns = [
        "timeout",
        "timed out",
        "connection",
        "network",
        "temporary",
        "unavailable",
        "overloaded",
        "server error",
        "internal error",
        "bad gateway",
        "service unavailable",
    ]
    if any(p in error_lower for p in transient_patterns):
        return ErrorType.RETRYABLE_TRANSIENT

    # Client error patterns
    client_patterns = [
        "invalid",
        "malformed",
        "bad request",
        "not found",
        "unsupported",
    ]
    if any(p in error_lower for p in client_patterns):
        return ErrorType.NON_RETRYABLE_CLIENT

    # Default to transient (retryable) for unknown errors
    return ErrorType.RETRYABLE_TRANSIENT


def extract_status_code(error: str) -> Optional[int]:
    """Extract HTTP status code from error message."""
    import re
    # Match patterns like "API error 429:", "status 500", "HTTP 503"
    patterns = [
        r"error\s+(\d{3})",
        r"status\s+(\d{3})",
        r"http\s+(\d{3})",
        r"\b(\d{3})\b.*error",
    ]
    for pattern in patterns:
        match = re.search(pattern, error.lower())
        if match:
            code = int(match.group(1))
            if 100 <= code < 600:
                return code
    return None


@dataclass
class RetryState:
    """Tracks state during retry attempts."""
    original_provider: str
    current_provider: str
    attempt: int = 0
    total_attempts: int = 0
    fallback_index: int = -1
    errors: List[Dict[str, Any]] = field(default_factory=list)
    start_time: float = field(default_factory=time.time)

    def record_error(self, provider: str, error: str, error_type: ErrorType) -> None:
        """Record an error for tracking."""
        self.errors.append({
            "provider": provider,
            "error": error,
            "error_type": error_type.value,
            "attempt": self.attempt,
            "timestamp": time.time(),
        })

    def get_summary(self) -> Dict[str, Any]:
        """Get summary of retry attempts."""
        return {
            "original_provider": self.original_provider,
            "final_provider": self.current_provider,
            "total_attempts": self.total_attempts,
            "fallback_used": self.fallback_index >= 0,
            "errors": self.errors,
            "total_time_ms": (time.time() - self.start_time) * 1000,
        }


class RetryExecutor:
    """
    Executes requests with retry and fallback logic.

    Usage:
        executor = RetryExecutor(config, backends)
        result, state = await executor.execute_with_retry(request)
    """

    def __init__(
        self,
        config: RetryConfig,
        backends: Dict[str, Any],
        available_providers: Optional[List[str]] = None,
    ):
        """
        Initialize the retry executor.

        Args:
            config: Retry configuration
            backends: Dict of provider name -> backend instance
            available_providers: List of available provider names (defaults to backends keys)
        """
        self.config = config
        self.backends = backends
        self.available_providers = available_providers or list(backends.keys())

    async def execute_with_retry(
        self,
        request: "GatewayRequest",
        execute_func: Optional[Callable] = None,
    ) -> tuple["BackendResult", RetryState]:
        """
        Execute a request with retry and fallback logic.

        Args:
            request: The request to execute
            execute_func: Optional custom execution function

        Returns:
            Tuple of (result, retry_state)
        """
        from .backends.base_backend import BackendResult

        state = RetryState(
            original_provider=request.provider,
            current_provider=request.provider,
        )

        if not self.config.enabled:
            # Retry disabled, execute once
            result = await self._execute_once(request, execute_func)
            state.total_attempts = 1
            return result, state

        # Get fallback chain
        fallbacks = self.config.get_fallbacks(request.provider)
        fallbacks = [p for p in fallbacks if p in self.available_providers]

        while True:
            # Execute with current provider
            result = await self._execute_with_retries(request, state, execute_func)

            if result.success:
                return result, state

            # Check if we should try fallback
            if not self.config.fallback_enabled:
                return result, state

            # Try next fallback
            state.fallback_index += 1
            if state.fallback_index >= len(fallbacks):
                # No more fallbacks
                return result, state

            # Switch to fallback provider
            next_provider = fallbacks[state.fallback_index]
            state.current_provider = next_provider
            request.provider = next_provider
            state.attempt = 0  # Reset attempt counter for new provider

    async def _execute_with_retries(
        self,
        request: "GatewayRequest",
        state: RetryState,
        execute_func: Optional[Callable],
    ) -> "BackendResult":
        """Execute request with retries for current provider."""
        from .backends.base_backend import BackendResult

        last_result: Optional[BackendResult] = None

        while state.attempt <= self.config.max_retries:
            state.total_attempts += 1

            # Execute
            result = await self._execute_once(request, execute_func)

            if result.success:
                return result

            last_result = result

            # Classify error
            status_code = extract_status_code(result.error or "")
            error_type = classify_error(result.error or "", status_code)
            state.record_error(state.current_provider, result.error or "", error_type)

            # Check if retryable
            if error_type in (ErrorType.NON_RETRYABLE_AUTH, ErrorType.NON_RETRYABLE_CLIENT, ErrorType.NON_RETRYABLE_PERMANENT):
                # Don't retry non-retryable errors
                break

            state.attempt += 1

            if state.attempt > self.config.max_retries:
                break

            # Calculate delay
            delay = self.config.get_delay(state.attempt - 1)

            # For rate limits, use longer delay
            if error_type == ErrorType.RETRYABLE_RATE_LIMIT:
                delay = max(delay, 5.0)  # At least 5 seconds for rate limits

            await asyncio.sleep(delay)

        return last_result or BackendResult.fail("No result from execution")

    async def _execute_once(
        self,
        request: "GatewayRequest",
        execute_func: Optional[Callable],
    ) -> "BackendResult":
        """Execute request once."""
        from .backends.base_backend import BackendResult

        provider = request.provider
        backend = self.backends.get(provider)

        if not backend:
            return BackendResult.fail(f"No backend available for provider: {provider}")

        try:
            if execute_func:
                return await execute_func(request, backend)
            else:
                return await backend.execute(request)
        except Exception as e:
            return BackendResult.fail(str(e))


def should_retry(error_type: ErrorType) -> bool:
    """Check if an error type should be retried."""
    return error_type in (ErrorType.RETRYABLE_TRANSIENT, ErrorType.RETRYABLE_RATE_LIMIT)


def should_fallback(error_type: ErrorType) -> bool:
    """Check if an error type should trigger fallback."""
    # Fallback on any failure except auth errors (which would fail on fallback too)
    return error_type != ErrorType.NON_RETRYABLE_AUTH


def detect_auth_failure(error: str, status_code: Optional[int] = None) -> bool:
    """
    Detect if an error indicates an authentication failure.

    Args:
        error: Error message string
        status_code: HTTP status code if available

    Returns:
        True if the error indicates auth failure
    """
    error_type = classify_error(error, status_code)
    return error_type == ErrorType.NON_RETRYABLE_AUTH


@dataclass
class ProviderReliabilityScore:
    """
    Tracks reliability metrics for a provider.

    Used for intelligent fallback decisions based on historical performance.
    """
    provider: str
    success_count: int = 0
    failure_count: int = 0
    timeout_count: int = 0
    auth_failure_count: int = 0
    last_success: Optional[float] = None
    last_failure: Optional[float] = None
    last_auth_failure: Optional[float] = None

    @property
    def total_requests(self) -> int:
        """Total number of requests made to this provider."""
        return self.success_count + self.failure_count + self.timeout_count

    @property
    def reliability_score(self) -> float:
        """
        Calculate reliability score from 0.0 to 1.0.

        Considers:
        - Success rate (70% weight)
        - Auth failure penalty (30% weight)
        """
        if self.total_requests == 0:
            return 1.0  # Assume reliable if no data

        success_rate = self.success_count / self.total_requests

        # Penalize auth failures heavily
        auth_penalty = min(self.auth_failure_count * 0.1, 0.3)

        score = (success_rate * 0.7) + ((1.0 - auth_penalty) * 0.3)
        return max(0.0, min(1.0, score))

    @property
    def is_healthy(self) -> bool:
        """
        Check if provider is considered healthy.

        Unhealthy if:
        - Auth failures >= 3 (needs re-auth)
        - Reliability score < 0.3
        """
        if self.auth_failure_count >= 3:
            return False
        return self.reliability_score >= 0.3

    @property
    def needs_reauth(self) -> bool:
        """Check if provider needs re-authentication."""
        return self.auth_failure_count >= 3

    def record_success(self) -> None:
        """Record a successful request."""
        self.success_count += 1
        self.last_success = time.time()

    def record_failure(self, is_auth_failure: bool = False, is_timeout: bool = False) -> None:
        """Record a failed request."""
        if is_timeout:
            self.timeout_count += 1
        else:
            self.failure_count += 1

        if is_auth_failure:
            self.auth_failure_count += 1
            self.last_auth_failure = time.time()

        self.last_failure = time.time()

    def reset_auth_failures(self) -> None:
        """Reset auth failure count (after re-authentication)."""
        self.auth_failure_count = 0
        self.last_auth_failure = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "provider": self.provider,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "timeout_count": self.timeout_count,
            "auth_failure_count": self.auth_failure_count,
            "total_requests": self.total_requests,
            "reliability_score": self.reliability_score,
            "is_healthy": self.is_healthy,
            "needs_reauth": self.needs_reauth,
            "last_success": self.last_success,
            "last_failure": self.last_failure,
        }


class ReliabilityTracker:
    """
    Tracks reliability scores for all providers.

    Used for intelligent provider selection and fallback decisions.
    """

    def __init__(self):
        self._scores: Dict[str, ProviderReliabilityScore] = {}
        self._lock = asyncio.Lock()

    def get_score(self, provider: str) -> ProviderReliabilityScore:
        """Get reliability score for a provider."""
        if provider not in self._scores:
            self._scores[provider] = ProviderReliabilityScore(provider=provider)
        return self._scores[provider]

    async def record_success(self, provider: str) -> None:
        """Record a successful request."""
        async with self._lock:
            self.get_score(provider).record_success()

    async def record_failure(
        self,
        provider: str,
        error: str,
        is_timeout: bool = False,
    ) -> None:
        """Record a failed request."""
        async with self._lock:
            is_auth = detect_auth_failure(error)
            self.get_score(provider).record_failure(
                is_auth_failure=is_auth,
                is_timeout=is_timeout,
            )

    async def reset_auth(self, provider: str) -> None:
        """Reset auth failures for a provider after re-auth."""
        async with self._lock:
            self.get_score(provider).reset_auth_failures()

    def get_healthy_providers(self, providers: List[str]) -> List[str]:
        """Get list of healthy providers from the given list."""
        return [p for p in providers if self.get_score(p).is_healthy]

    def get_best_fallback(
        self,
        primary: str,
        fallback_chain: List[str],
    ) -> Optional[str]:
        """
        Get the best fallback provider based on reliability.

        Returns the fallback with highest reliability score that is healthy.
        """
        candidates = [
            (p, self.get_score(p))
            for p in fallback_chain
            if p != primary and self.get_score(p).is_healthy
        ]

        if not candidates:
            return None

        # Sort by reliability score descending
        candidates.sort(key=lambda x: x[1].reliability_score, reverse=True)
        return candidates[0][0]

    def get_all_scores(self) -> Dict[str, Dict[str, Any]]:
        """Get all reliability scores as dictionary."""
        return {p: s.to_dict() for p, s in self._scores.items()}
