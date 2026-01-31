"""
Smart Cache for CCB Gateway.

Provides intelligent caching of AI responses to reduce API calls.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List

from .state_store import StateStore


@dataclass
class CacheConfig:
    """Configuration for response caching."""
    enabled: bool = True
    default_ttl_s: float = 3600.0  # 1 hour default
    max_entries: int = 10000
    # TTL by provider (some responses may be more stable)
    provider_ttl_s: Dict[str, float] = field(default_factory=lambda: {
        "claude": 3600.0,
        "gemini": 3600.0,
        "deepseek": 1800.0,  # 30 min for reasoning models
        "codex": 1800.0,
        "opencode": 1800.0,
    })
    # Don't cache responses shorter than this
    min_response_length: int = 10
    # Don't cache if message contains these patterns (case-insensitive)
    no_cache_patterns: List[str] = field(default_factory=lambda: [
        "current time",
        "current date",
        "today",
        "now",
        "latest",
        "recent",
        "weather",
        "stock price",
        "random",
    ])

    def get_ttl(self, provider: str) -> float:
        """Get TTL for a provider."""
        return self.provider_ttl_s.get(provider, self.default_ttl_s)

    def should_cache_message(self, message: str) -> bool:
        """Check if a message should be cached based on patterns."""
        message_lower = message.lower()
        return not any(p in message_lower for p in self.no_cache_patterns)


@dataclass
class CacheEntry:
    """A cached response entry."""
    cache_key: str
    provider: str
    message_hash: str
    response: str
    tokens_used: Optional[int]
    created_at: float
    expires_at: float
    hit_count: int = 0
    last_hit_at: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

    def is_expired(self) -> bool:
        """Check if the entry has expired."""
        return time.time() > self.expires_at

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "cache_key": self.cache_key,
            "provider": self.provider,
            "message_hash": self.message_hash,
            "response": self.response,
            "tokens_used": self.tokens_used,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "hit_count": self.hit_count,
            "last_hit_at": self.last_hit_at,
            "metadata": self.metadata,
        }


@dataclass
class CacheStats:
    """Cache statistics."""
    hits: int = 0
    misses: int = 0
    total_entries: int = 0
    expired_entries: int = 0
    total_tokens_saved: int = 0

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": self.hit_rate,
            "total_entries": self.total_entries,
            "expired_entries": self.expired_entries,
            "total_tokens_saved": self.total_tokens_saved,
        }


def generate_cache_key(provider: str, message: str, model: Optional[str] = None) -> str:
    """
    Generate a cache key for a request.

    Args:
        provider: Provider name
        message: The message/prompt
        model: Optional model name

    Returns:
        Cache key string
    """
    # Normalize message (strip whitespace, lowercase for comparison)
    normalized = message.strip().lower()

    # Create hash of normalized message
    message_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]

    # Include provider and optional model in key
    if model:
        return f"{provider}:{model}:{message_hash}"
    return f"{provider}:{message_hash}"


def generate_message_hash(message: str) -> str:
    """Generate a hash of the message for storage."""
    return hashlib.sha256(message.strip().encode("utf-8")).hexdigest()


class CacheManager:
    """
    Manages response caching for the gateway.

    Uses SQLite for persistent storage via StateStore.
    """

    def __init__(self, store: StateStore, config: Optional[CacheConfig] = None):
        """
        Initialize the cache manager.

        Args:
            store: StateStore instance for persistence
            config: Cache configuration
        """
        self.store = store
        self.config = config or CacheConfig()
        self._stats = CacheStats()
        self._init_cache_table()

    def _init_cache_table(self) -> None:
        """Initialize the cache table in the database."""
        with self.store._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS response_cache (
                    cache_key TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    message_hash TEXT NOT NULL,
                    response TEXT NOT NULL,
                    tokens_used INTEGER,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL,
                    hit_count INTEGER DEFAULT 0,
                    last_hit_at REAL,
                    metadata TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_provider ON response_cache(provider)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_expires ON response_cache(expires_at)")

    def get(
        self,
        provider: str,
        message: str,
        model: Optional[str] = None,
    ) -> Optional[CacheEntry]:
        """
        Get a cached response.

        Args:
            provider: Provider name
            message: The message/prompt
            model: Optional model name

        Returns:
            CacheEntry if found and not expired, None otherwise
        """
        if not self.config.enabled:
            return None

        cache_key = generate_cache_key(provider, message, model)

        with self.store._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM response_cache WHERE cache_key = ?",
                (cache_key,)
            )
            row = cursor.fetchone()

            if not row:
                self._stats.misses += 1
                return None

            entry = self._row_to_entry(row)

            if entry.is_expired():
                # Delete expired entry
                conn.execute("DELETE FROM response_cache WHERE cache_key = ?", (cache_key,))
                self._stats.misses += 1
                return None

            # Update hit count
            now = time.time()
            conn.execute(
                "UPDATE response_cache SET hit_count = hit_count + 1, last_hit_at = ? WHERE cache_key = ?",
                (now, cache_key)
            )

            self._stats.hits += 1
            if entry.tokens_used:
                self._stats.total_tokens_saved += entry.tokens_used

            entry.hit_count += 1
            entry.last_hit_at = now
            return entry

    def put(
        self,
        provider: str,
        message: str,
        response: str,
        tokens_used: Optional[int] = None,
        model: Optional[str] = None,
        ttl_s: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[CacheEntry]:
        """
        Store a response in the cache.

        Args:
            provider: Provider name
            message: The message/prompt
            response: The response to cache
            tokens_used: Optional token count
            model: Optional model name
            ttl_s: Optional TTL override
            metadata: Optional metadata

        Returns:
            CacheEntry if stored, None if caching was skipped
        """
        if not self.config.enabled:
            return None

        # Check if message should be cached
        if not self.config.should_cache_message(message):
            return None

        # Check minimum response length
        if len(response) < self.config.min_response_length:
            return None

        cache_key = generate_cache_key(provider, message, model)
        message_hash = generate_message_hash(message)
        now = time.time()
        ttl = ttl_s or self.config.get_ttl(provider)
        expires_at = now + ttl

        entry = CacheEntry(
            cache_key=cache_key,
            provider=provider,
            message_hash=message_hash,
            response=response,
            tokens_used=tokens_used,
            created_at=now,
            expires_at=expires_at,
            metadata=metadata,
        )

        with self.store._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO response_cache (
                    cache_key, provider, message_hash, response, tokens_used,
                    created_at, expires_at, hit_count, last_hit_at, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                entry.cache_key,
                entry.provider,
                entry.message_hash,
                entry.response,
                entry.tokens_used,
                entry.created_at,
                entry.expires_at,
                entry.hit_count,
                entry.last_hit_at,
                json.dumps(entry.metadata) if entry.metadata else None,
            ))

        return entry

    def invalidate(self, cache_key: str) -> bool:
        """
        Invalidate a specific cache entry.

        Args:
            cache_key: The cache key to invalidate

        Returns:
            True if entry was deleted
        """
        with self.store._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM response_cache WHERE cache_key = ?",
                (cache_key,)
            )
            return cursor.rowcount > 0

    def clear(self, provider: Optional[str] = None) -> int:
        """
        Clear cache entries.

        Args:
            provider: Optional provider to clear (clears all if None)

        Returns:
            Number of entries cleared
        """
        with self.store._get_connection() as conn:
            if provider:
                cursor = conn.execute(
                    "DELETE FROM response_cache WHERE provider = ?",
                    (provider,)
                )
            else:
                cursor = conn.execute("DELETE FROM response_cache")
            return cursor.rowcount

    def cleanup_expired(self) -> int:
        """
        Remove expired cache entries.

        Returns:
            Number of entries removed
        """
        now = time.time()
        with self.store._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM response_cache WHERE expires_at < ?",
                (now,)
            )
            return cursor.rowcount

    def get_stats(self) -> CacheStats:
        """
        Get cache statistics.

        Returns:
            CacheStats object
        """
        now = time.time()
        with self.store._get_connection() as conn:
            # Total entries
            cursor = conn.execute("SELECT COUNT(*) FROM response_cache")
            self._stats.total_entries = cursor.fetchone()[0]

            # Expired entries
            cursor = conn.execute(
                "SELECT COUNT(*) FROM response_cache WHERE expires_at < ?",
                (now,)
            )
            self._stats.expired_entries = cursor.fetchone()[0]

        return self._stats

    def list_entries(
        self,
        provider: Optional[str] = None,
        limit: int = 100,
        include_expired: bool = False,
    ) -> List[CacheEntry]:
        """
        List cache entries.

        Args:
            provider: Optional provider filter
            limit: Maximum entries to return
            include_expired: Whether to include expired entries

        Returns:
            List of CacheEntry objects
        """
        query = "SELECT * FROM response_cache WHERE 1=1"
        params: List[Any] = []

        if provider:
            query += " AND provider = ?"
            params.append(provider)

        if not include_expired:
            query += " AND expires_at > ?"
            params.append(time.time())

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        with self.store._get_connection() as conn:
            cursor = conn.execute(query, params)
            return [self._row_to_entry(row) for row in cursor.fetchall()]

    def _row_to_entry(self, row) -> CacheEntry:
        """Convert database row to CacheEntry."""
        return CacheEntry(
            cache_key=row["cache_key"],
            provider=row["provider"],
            message_hash=row["message_hash"],
            response=row["response"],
            tokens_used=row["tokens_used"],
            created_at=row["created_at"],
            expires_at=row["expires_at"],
            hit_count=row["hit_count"],
            last_hit_at=row["last_hit_at"],
            metadata=json.loads(row["metadata"]) if row["metadata"] else None,
        )
