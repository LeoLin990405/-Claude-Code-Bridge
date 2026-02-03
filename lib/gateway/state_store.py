"""
State Store for CCB Gateway.

SQLite-backed persistent storage for requests, responses, and provider status.
"""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Optional, List, Dict, Any, Iterator

from .models import (
    RequestStatus,
    GatewayRequest,
    GatewayResponse,
    ProviderInfo,
    ProviderStatus,
    BackendType,
    DiscussionStatus,
    DiscussionSession,
    DiscussionMessage,
    DiscussionConfig,
    MessageType,
)


class StateStore:
    """
    SQLite-backed state store for the gateway.

    Stores:
    - Requests and their status
    - Responses from providers
    - Provider health/status information
    - Request metrics for analytics
    """

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the state store.

        Args:
            db_path: Path to SQLite database. Defaults to ~/.ccb_config/gateway.db
        """
        if db_path:
            self.db_path = Path(db_path)
        else:
            self.db_path = Path.home() / ".ccb_config" / "gateway.db"

        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _get_connection(self) -> Iterator[sqlite3.Connection]:
        """Get a database connection with row factory."""
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Initialize the database schema."""
        with self._get_connection() as conn:
            # Requests table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS requests (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    message TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'queued',
                    priority INTEGER NOT NULL DEFAULT 50,
                    timeout_s REAL NOT NULL DEFAULT 300.0,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    backend_type TEXT,
                    routed_at REAL,
                    started_at REAL,
                    completed_at REAL,
                    metadata TEXT
                )
            """)

            # Responses table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS responses (
                    request_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    response TEXT,
                    error TEXT,
                    provider TEXT,
                    latency_ms REAL,
                    tokens_used INTEGER,
                    created_at REAL NOT NULL,
                    metadata TEXT,
                    thinking TEXT,
                    raw_output TEXT,
                    FOREIGN KEY (request_id) REFERENCES requests(id)
                )
            """)

            # Add thinking and raw_output columns if they don't exist (migration)
            try:
                conn.execute("ALTER TABLE responses ADD COLUMN thinking TEXT")
            except sqlite3.OperationalError:
                pass  # Column already exists
            try:
                conn.execute("ALTER TABLE responses ADD COLUMN raw_output TEXT")
            except sqlite3.OperationalError:
                pass  # Column already exists

            # Provider status table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS provider_status (
                    name TEXT PRIMARY KEY,
                    backend_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'unknown',
                    queue_depth INTEGER DEFAULT 0,
                    avg_latency_ms REAL DEFAULT 0.0,
                    success_rate REAL DEFAULT 1.0,
                    last_check REAL,
                    error TEXT,
                    enabled INTEGER DEFAULT 1,
                    priority INTEGER DEFAULT 50,
                    rate_limit_rpm INTEGER,
                    timeout_s REAL DEFAULT 300.0,
                    updated_at REAL NOT NULL
                )
            """)

            # Metrics table for analytics
            conn.execute("""
                CREATE TABLE IF NOT EXISTS metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider TEXT NOT NULL,
                    request_id TEXT,
                    event_type TEXT NOT NULL,
                    latency_ms REAL,
                    success INTEGER,
                    error TEXT,
                    timestamp REAL NOT NULL
                )
            """)

            # Create indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_requests_provider ON requests(provider)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_requests_priority ON requests(priority DESC, created_at ASC)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_responses_request ON responses(request_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_provider ON metrics(provider)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)")

            # Initialize discussion tables
            self._init_discussion_tables(conn)

            # Initialize cost tracking table
            self._init_cost_tracking_table(conn)

    def _init_cost_tracking_table(self, conn: sqlite3.Connection) -> None:
        """Initialize token cost tracking table."""
        conn.execute("""
            CREATE TABLE IF NOT EXISTS token_costs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                request_id TEXT,
                input_tokens INTEGER,
                output_tokens INTEGER,
                cost_usd REAL,
                model TEXT,
                timestamp REAL NOT NULL
            )
        """)

        # Create indexes
        conn.execute("CREATE INDEX IF NOT EXISTS idx_token_costs_provider ON token_costs(provider)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_token_costs_timestamp ON token_costs(timestamp)")

    def _init_discussion_tables(self, conn: sqlite3.Connection) -> None:
        """Initialize discussion-related tables."""
        # Discussion sessions table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS discussion_sessions (
                id TEXT PRIMARY KEY,
                topic TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                current_round INTEGER DEFAULT 0,
                providers TEXT NOT NULL,
                config TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                summary TEXT,
                metadata TEXT,
                parent_session_id TEXT
            )
        """)

        # Add parent_session_id column if it doesn't exist (migration)
        try:
            conn.execute("ALTER TABLE discussion_sessions ADD COLUMN parent_session_id TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Discussion messages table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS discussion_messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                round_number INTEGER NOT NULL,
                provider TEXT NOT NULL,
                message_type TEXT NOT NULL,
                content TEXT,
                references_messages TEXT,
                latency_ms REAL,
                status TEXT DEFAULT 'pending',
                created_at REAL NOT NULL,
                metadata TEXT,
                FOREIGN KEY (session_id) REFERENCES discussion_sessions(id)
            )
        """)

        # Discussion templates table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS discussion_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                topic_template TEXT NOT NULL,
                default_providers TEXT,
                default_config TEXT,
                category TEXT,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                usage_count INTEGER DEFAULT 0,
                is_builtin INTEGER DEFAULT 0
            )
        """)

        # Create indexes for discussion tables
        conn.execute("CREATE INDEX IF NOT EXISTS idx_discussion_sessions_status ON discussion_sessions(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_discussion_sessions_created ON discussion_sessions(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_discussion_messages_session ON discussion_messages(session_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_discussion_messages_round ON discussion_messages(session_id, round_number)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_discussion_templates_category ON discussion_templates(category)")

        # Initialize built-in templates
        self._init_builtin_templates(conn)

    def _init_builtin_templates(self, conn: sqlite3.Connection) -> None:
        """Initialize built-in discussion templates."""
        builtin_templates = [
            {
                "id": "arch-review",
                "name": "Architecture Review",
                "description": "Review and discuss system architecture decisions",
                "topic_template": "Review the architecture for: {subject}\n\nContext:\n{context}\n\nFocus areas:\n- Scalability\n- Maintainability\n- Security\n- Performance",
                "default_providers": '["kimi", "qwen", "deepseek"]',
                "default_config": '{"max_rounds": 3, "provider_timeout_s": 120}',
                "category": "engineering",
            },
            {
                "id": "code-review",
                "name": "Code Review",
                "description": "Collaborative code review with multiple AI perspectives",
                "topic_template": "Review the following code:\n\n```{language}\n{code}\n```\n\nFocus on:\n- Code quality and best practices\n- Potential bugs or issues\n- Performance considerations\n- Security vulnerabilities",
                "default_providers": '["kimi", "qwen", "deepseek"]',
                "default_config": '{"max_rounds": 2, "provider_timeout_s": 90}',
                "category": "engineering",
            },
            {
                "id": "api-design",
                "name": "API Design",
                "description": "Design and review API endpoints and contracts",
                "topic_template": "Design an API for: {subject}\n\nRequirements:\n{requirements}\n\nConsider:\n- RESTful principles\n- Error handling\n- Versioning strategy\n- Authentication/Authorization",
                "default_providers": '["kimi", "qwen", "deepseek"]',
                "default_config": '{"max_rounds": 3, "provider_timeout_s": 120}',
                "category": "engineering",
            },
            {
                "id": "bug-analysis",
                "name": "Bug Analysis",
                "description": "Analyze and diagnose bugs collaboratively",
                "topic_template": "Analyze this bug:\n\nSymptoms:\n{symptoms}\n\nReproduction steps:\n{steps}\n\nRelevant code:\n```\n{code}\n```\n\nIdentify:\n- Root cause\n- Impact assessment\n- Recommended fix\n- Prevention strategies",
                "default_providers": '["kimi", "qwen", "deepseek"]',
                "default_config": '{"max_rounds": 2, "provider_timeout_s": 90}',
                "category": "debugging",
            },
            {
                "id": "perf-optimization",
                "name": "Performance Optimization",
                "description": "Discuss and plan performance improvements",
                "topic_template": "Optimize performance for: {subject}\n\nCurrent metrics:\n{metrics}\n\nBottlenecks identified:\n{bottlenecks}\n\nPropose:\n- Quick wins\n- Long-term improvements\n- Trade-offs to consider",
                "default_providers": '["kimi", "qwen", "deepseek"]',
                "default_config": '{"max_rounds": 3, "provider_timeout_s": 120}',
                "category": "engineering",
            },
        ]

        now = time.time()
        for template in builtin_templates:
            try:
                conn.execute("""
                    INSERT OR IGNORE INTO discussion_templates (
                        id, name, description, topic_template, default_providers,
                        default_config, category, created_at, updated_at, is_builtin
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                """, (
                    template["id"],
                    template["name"],
                    template["description"],
                    template["topic_template"],
                    template["default_providers"],
                    template["default_config"],
                    template["category"],
                    now,
                    now,
                ))
            except sqlite3.IntegrityError:
                pass  # Template already exists

    # ==================== Request Operations ====================

    def create_request(self, request: GatewayRequest) -> GatewayRequest:
        """Create a new request in the store."""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO requests (
                    id, provider, message, status, priority, timeout_s,
                    created_at, updated_at, backend_type, routed_at,
                    started_at, completed_at, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                request.id,
                request.provider,
                request.message,
                request.status.value,
                request.priority,
                request.timeout_s,
                request.created_at,
                request.updated_at,
                request.backend_type.value if request.backend_type else None,
                request.routed_at,
                request.started_at,
                request.completed_at,
                json.dumps(request.metadata) if request.metadata else None,
            ))
        return request

    def get_request(self, request_id: str) -> Optional[GatewayRequest]:
        """Get a request by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM requests WHERE id = ?",
                (request_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_request(row)
        return None

    def update_request_status(
        self,
        request_id: str,
        status: RequestStatus,
        backend_type: Optional[BackendType] = None,
    ) -> bool:
        """Update request status."""
        now = time.time()
        with self._get_connection() as conn:
            updates = ["status = ?", "updated_at = ?"]
            params: List[Any] = [status.value, now]

            if backend_type:
                updates.append("backend_type = ?")
                params.append(backend_type.value)

            if status == RequestStatus.PROCESSING:
                updates.append("started_at = ?")
                params.append(now)
                updates.append("routed_at = ?")
                params.append(now)
            elif status in (RequestStatus.COMPLETED, RequestStatus.FAILED, RequestStatus.TIMEOUT):
                updates.append("completed_at = ?")
                params.append(now)

            params.append(request_id)
            cursor = conn.execute(
                f"UPDATE requests SET {', '.join(updates)} WHERE id = ?",
                params
            )
            return cursor.rowcount > 0

    def list_requests(
        self,
        status: Optional[RequestStatus] = None,
        provider: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        order_by: str = "created_at",
        order_desc: bool = True,
    ) -> List[GatewayRequest]:
        """List requests with optional filtering.

        Args:
            status: Filter by request status
            provider: Filter by provider name
            limit: Maximum number of results
            offset: Number of results to skip
            order_by: Field to order by (created_at, updated_at, priority)
            order_desc: If True, order descending; if False, ascending
        """
        query = "SELECT * FROM requests WHERE 1=1"
        params: List[Any] = []

        if status:
            query += " AND status = ?"
            params.append(status.value)

        if provider:
            query += " AND provider = ?"
            params.append(provider)

        # Validate order_by to prevent SQL injection
        valid_order_fields = {"created_at", "updated_at", "priority"}
        if order_by not in valid_order_fields:
            order_by = "created_at"

        order_dir = "DESC" if order_desc else "ASC"
        query += f" ORDER BY {order_by} {order_dir} LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            return [self._row_to_request(row) for row in cursor.fetchall()]

    def get_pending_requests(self, limit: int = 10) -> List[GatewayRequest]:
        """Get pending requests ordered by priority."""
        return self.list_requests(status=RequestStatus.QUEUED, limit=limit)

    def cancel_request(self, request_id: str) -> bool:
        """Cancel a pending or processing request."""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                UPDATE requests
                SET status = ?, updated_at = ?
                WHERE id = ? AND status IN (?, ?)
            """, (
                RequestStatus.CANCELLED.value,
                time.time(),
                request_id,
                RequestStatus.QUEUED.value,
                RequestStatus.PROCESSING.value,
            ))
            return cursor.rowcount > 0

    def cleanup_old_requests(self, max_age_hours: int = 24) -> int:
        """Remove requests older than specified age."""
        cutoff = time.time() - (max_age_hours * 3600)
        with self._get_connection() as conn:
            # Delete responses first (foreign key)
            conn.execute("""
                DELETE FROM responses
                WHERE request_id IN (
                    SELECT id FROM requests WHERE created_at < ?
                )
            """, (cutoff,))
            cursor = conn.execute(
                "DELETE FROM requests WHERE created_at < ?",
                (cutoff,)
            )
            return cursor.rowcount

    def _row_to_request(self, row: sqlite3.Row) -> GatewayRequest:
        """Convert database row to GatewayRequest."""
        return GatewayRequest(
            id=row["id"],
            provider=row["provider"],
            message=row["message"],
            status=RequestStatus(row["status"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            priority=row["priority"],
            timeout_s=row["timeout_s"],
            backend_type=BackendType(row["backend_type"]) if row["backend_type"] else None,
            routed_at=row["routed_at"],
            started_at=row["started_at"],
            completed_at=row["completed_at"],
            metadata=json.loads(row["metadata"]) if row["metadata"] else None,
        )

    # ==================== Response Operations ====================

    def save_response(self, response: GatewayResponse) -> None:
        """Save a response."""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO responses (
                    request_id, status, response, error, provider,
                    latency_ms, tokens_used, created_at, metadata,
                    thinking, raw_output
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                response.request_id,
                response.status.value,
                response.response,
                response.error,
                response.provider,
                response.latency_ms,
                response.tokens_used,
                time.time(),
                json.dumps(response.metadata) if response.metadata else None,
                response.thinking,
                response.raw_output,
            ))

    def get_response(self, request_id: str) -> Optional[GatewayResponse]:
        """Get response for a request."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM responses WHERE request_id = ?",
                (request_id,)
            )
            row = cursor.fetchone()
            if row:
                return GatewayResponse(
                    request_id=row["request_id"],
                    status=RequestStatus(row["status"]),
                    response=row["response"],
                    error=row["error"],
                    provider=row["provider"],
                    latency_ms=row["latency_ms"],
                    tokens_used=row["tokens_used"],
                    metadata=json.loads(row["metadata"]) if row["metadata"] else None,
                    thinking=row["thinking"] if "thinking" in row.keys() else None,
                    raw_output=row["raw_output"] if "raw_output" in row.keys() else None,
                )
        return None

    # ==================== Provider Status Operations ====================

    def update_provider_status(self, info: ProviderInfo) -> None:
        """Update provider status."""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO provider_status (
                    name, backend_type, status, queue_depth, avg_latency_ms,
                    success_rate, last_check, error, enabled, priority,
                    rate_limit_rpm, timeout_s, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                info.name,
                info.backend_type.value,
                info.status.value,
                info.queue_depth,
                info.avg_latency_ms,
                info.success_rate,
                info.last_check,
                info.error,
                1 if info.enabled else 0,
                info.priority,
                info.rate_limit_rpm,
                info.timeout_s,
                time.time(),
            ))

    def get_provider_status(self, name: str) -> Optional[ProviderInfo]:
        """Get provider status."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM provider_status WHERE name = ?",
                (name,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_provider_info(row)
        return None

    def list_provider_status(self) -> List[ProviderInfo]:
        """List all provider statuses."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM provider_status ORDER BY priority DESC, name"
            )
            return [self._row_to_provider_info(row) for row in cursor.fetchall()]

    def _row_to_provider_info(self, row: sqlite3.Row) -> ProviderInfo:
        """Convert database row to ProviderInfo."""
        return ProviderInfo(
            name=row["name"],
            backend_type=BackendType(row["backend_type"]),
            status=ProviderStatus(row["status"]),
            queue_depth=row["queue_depth"],
            avg_latency_ms=row["avg_latency_ms"],
            success_rate=row["success_rate"],
            last_check=row["last_check"],
            error=row["error"],
            enabled=bool(row["enabled"]),
            priority=row["priority"],
            rate_limit_rpm=row["rate_limit_rpm"],
            timeout_s=row["timeout_s"],
        )

    # ==================== Metrics Operations ====================

    def record_metric(
        self,
        provider: str,
        event_type: str,
        request_id: Optional[str] = None,
        latency_ms: Optional[float] = None,
        success: bool = True,
        error: Optional[str] = None,
    ) -> None:
        """Record a metric event."""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO metrics (
                    provider, request_id, event_type, latency_ms,
                    success, error, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                provider,
                request_id,
                event_type,
                latency_ms,
                1 if success else 0,
                error,
                time.time(),
            ))

    def get_provider_metrics(
        self,
        provider: str,
        hours: int = 24,
    ) -> Dict[str, Any]:
        """Get aggregated metrics for a provider."""
        cutoff = time.time() - (hours * 3600)
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    COUNT(*) as total,
                    SUM(success) as successes,
                    AVG(latency_ms) as avg_latency,
                    MAX(latency_ms) as max_latency,
                    MIN(latency_ms) as min_latency
                FROM metrics
                WHERE provider = ? AND timestamp > ?
            """, (provider, cutoff))
            row = cursor.fetchone()
            if row:
                total = row["total"] or 0
                successes = row["successes"] or 0
                return {
                    "provider": provider,
                    "total_requests": total,
                    "successful_requests": successes,
                    "success_rate": successes / total if total > 0 else 1.0,
                    "avg_latency_ms": row["avg_latency"] or 0.0,
                    "max_latency_ms": row["max_latency"] or 0.0,
                    "min_latency_ms": row["min_latency"] or 0.0,
                }
        return {
            "provider": provider,
            "total_requests": 0,
            "successful_requests": 0,
            "success_rate": 1.0,
            "avg_latency_ms": 0.0,
            "max_latency_ms": 0.0,
            "min_latency_ms": 0.0,
        }

    def cleanup_old_metrics(self, max_age_hours: int = 168) -> int:
        """Remove metrics older than specified age (default 7 days)."""
        cutoff = time.time() - (max_age_hours * 3600)
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM metrics WHERE timestamp < ?",
                (cutoff,)
            )
            return cursor.rowcount

    # ==================== Statistics ====================

    def get_stats(self) -> Dict[str, Any]:
        """Get overall gateway statistics."""
        with self._get_connection() as conn:
            # Request counts by status
            cursor = conn.execute("""
                SELECT status, COUNT(*) as count
                FROM requests
                GROUP BY status
            """)
            status_counts = {row["status"]: row["count"] for row in cursor.fetchall()}

            # Active requests
            cursor = conn.execute("""
                SELECT COUNT(*) as count
                FROM requests
                WHERE status IN ('queued', 'processing')
            """)
            active = cursor.fetchone()["count"]

            # Provider queue depths
            cursor = conn.execute("""
                SELECT provider, COUNT(*) as count
                FROM requests
                WHERE status = 'queued'
                GROUP BY provider
            """)
            queue_depths = {row["provider"]: row["count"] for row in cursor.fetchall()}

            return {
                "total_requests": sum(status_counts.values()),
                "active_requests": active,
                "status_counts": status_counts,
                "queue_depths": queue_depths,
            }

    # ==================== Discussion Operations ====================

    def create_discussion_session(self, session: DiscussionSession) -> DiscussionSession:
        """Create a new discussion session."""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO discussion_sessions (
                    id, topic, status, current_round, providers,
                    config, created_at, updated_at, summary, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session.id,
                session.topic,
                session.status.value,
                session.current_round,
                json.dumps(session.providers),
                json.dumps(session.config.to_dict()),
                session.created_at,
                session.updated_at,
                session.summary,
                json.dumps(session.metadata) if session.metadata else None,
            ))
        return session

    def get_discussion_session(self, session_id: str) -> Optional[DiscussionSession]:
        """Get a discussion session by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM discussion_sessions WHERE id = ?",
                (session_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_discussion_session(row)
        return None

    def update_discussion_session(
        self,
        session_id: str,
        status: Optional[DiscussionStatus] = None,
        current_round: Optional[int] = None,
        summary: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update a discussion session."""
        now = time.time()
        updates = ["updated_at = ?"]
        params: List[Any] = [now]

        if status is not None:
            updates.append("status = ?")
            params.append(status.value)

        if current_round is not None:
            updates.append("current_round = ?")
            params.append(current_round)

        if summary is not None:
            updates.append("summary = ?")
            params.append(summary)

        if metadata is not None:
            updates.append("metadata = ?")
            params.append(json.dumps(metadata))

        params.append(session_id)

        with self._get_connection() as conn:
            cursor = conn.execute(
                f"UPDATE discussion_sessions SET {', '.join(updates)} WHERE id = ?",
                params
            )
            return cursor.rowcount > 0

    def list_discussion_sessions(
        self,
        status: Optional[DiscussionStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[DiscussionSession]:
        """List discussion sessions with optional filtering."""
        query = "SELECT * FROM discussion_sessions WHERE 1=1"
        params: List[Any] = []

        if status:
            query += " AND status = ?"
            params.append(status.value)

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            return [self._row_to_discussion_session(row) for row in cursor.fetchall()]

    def delete_discussion_session(self, session_id: str) -> bool:
        """Delete a discussion session and its messages."""
        with self._get_connection() as conn:
            # Delete messages first
            conn.execute(
                "DELETE FROM discussion_messages WHERE session_id = ?",
                (session_id,)
            )
            # Delete session
            cursor = conn.execute(
                "DELETE FROM discussion_sessions WHERE id = ?",
                (session_id,)
            )
            return cursor.rowcount > 0

    def _row_to_discussion_session(self, row: sqlite3.Row) -> DiscussionSession:
        """Convert database row to DiscussionSession."""
        return DiscussionSession(
            id=row["id"],
            topic=row["topic"],
            status=DiscussionStatus(row["status"]),
            current_round=row["current_round"],
            providers=json.loads(row["providers"]),
            config=DiscussionConfig.from_dict(json.loads(row["config"])) if row["config"] else DiscussionConfig(),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            summary=row["summary"],
            metadata=json.loads(row["metadata"]) if row["metadata"] else None,
        )

    # ==================== Discussion Message Operations ====================

    def create_discussion_message(self, message: DiscussionMessage) -> DiscussionMessage:
        """Create a new discussion message."""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO discussion_messages (
                    id, session_id, round_number, provider, message_type,
                    content, references_messages, latency_ms, status,
                    created_at, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                message.id,
                message.session_id,
                message.round_number,
                message.provider,
                message.message_type.value,
                message.content,
                json.dumps(message.references_messages) if message.references_messages else None,
                message.latency_ms,
                message.status,
                message.created_at,
                json.dumps(message.metadata) if message.metadata else None,
            ))
        return message

    def update_discussion_message(
        self,
        message_id: str,
        content: Optional[str] = None,
        status: Optional[str] = None,
        latency_ms: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update a discussion message."""
        updates = []
        params: List[Any] = []

        if content is not None:
            updates.append("content = ?")
            params.append(content)

        if status is not None:
            updates.append("status = ?")
            params.append(status)

        if latency_ms is not None:
            updates.append("latency_ms = ?")
            params.append(latency_ms)

        if metadata is not None:
            updates.append("metadata = ?")
            params.append(json.dumps(metadata))

        if not updates:
            return False

        params.append(message_id)

        with self._get_connection() as conn:
            cursor = conn.execute(
                f"UPDATE discussion_messages SET {', '.join(updates)} WHERE id = ?",
                params
            )
            return cursor.rowcount > 0

    def get_discussion_messages(
        self,
        session_id: str,
        round_number: Optional[int] = None,
        provider: Optional[str] = None,
        message_type: Optional[MessageType] = None,
    ) -> List[DiscussionMessage]:
        """Get discussion messages with optional filtering."""
        query = "SELECT * FROM discussion_messages WHERE session_id = ?"
        params: List[Any] = [session_id]

        if round_number is not None:
            query += " AND round_number = ?"
            params.append(round_number)

        if provider is not None:
            query += " AND provider = ?"
            params.append(provider)

        if message_type is not None:
            query += " AND message_type = ?"
            params.append(message_type.value)

        query += " ORDER BY round_number ASC, created_at ASC"

        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            return [self._row_to_discussion_message(row) for row in cursor.fetchall()]

    def _row_to_discussion_message(self, row: sqlite3.Row) -> DiscussionMessage:
        """Convert database row to DiscussionMessage."""
        return DiscussionMessage(
            id=row["id"],
            session_id=row["session_id"],
            round_number=row["round_number"],
            provider=row["provider"],
            message_type=MessageType(row["message_type"]),
            content=row["content"],
            references_messages=json.loads(row["references_messages"]) if row["references_messages"] else None,
            latency_ms=row["latency_ms"],
            status=row["status"],
            created_at=row["created_at"],
            metadata=json.loads(row["metadata"]) if row["metadata"] else None,
        )

    def cleanup_old_discussions(self, max_age_hours: int = 168) -> int:
        """Remove discussions older than specified age (default 7 days)."""
        cutoff = time.time() - (max_age_hours * 3600)
        with self._get_connection() as conn:
            # Delete messages first
            conn.execute("""
                DELETE FROM discussion_messages
                WHERE session_id IN (
                    SELECT id FROM discussion_sessions WHERE created_at < ?
                )
            """, (cutoff,))
            # Delete sessions
            cursor = conn.execute(
                "DELETE FROM discussion_sessions WHERE created_at < ?",
                (cutoff,)
            )
            return cursor.rowcount

    # ==================== Discussion Template Operations ====================

    def create_discussion_template(
        self,
        name: str,
        topic_template: str,
        description: Optional[str] = None,
        default_providers: Optional[List[str]] = None,
        default_config: Optional[Dict[str, Any]] = None,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new discussion template."""
        import uuid
        template_id = str(uuid.uuid4())[:12]
        now = time.time()

        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO discussion_templates (
                    id, name, description, topic_template, default_providers,
                    default_config, category, created_at, updated_at, is_builtin
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """, (
                template_id,
                name,
                description,
                topic_template,
                json.dumps(default_providers) if default_providers else None,
                json.dumps(default_config) if default_config else None,
                category,
                now,
                now,
            ))

        return self.get_discussion_template(template_id)

    def get_discussion_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get a discussion template by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM discussion_templates WHERE id = ?",
                (template_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_template(row)
        return None

    def get_discussion_template_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get a discussion template by name."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM discussion_templates WHERE name = ?",
                (name,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_template(row)
        return None

    def list_discussion_templates(
        self,
        category: Optional[str] = None,
        include_builtin: bool = True,
    ) -> List[Dict[str, Any]]:
        """List discussion templates with optional filtering."""
        query = "SELECT * FROM discussion_templates WHERE 1=1"
        params: List[Any] = []

        if category:
            query += " AND category = ?"
            params.append(category)

        if not include_builtin:
            query += " AND is_builtin = 0"

        query += " ORDER BY usage_count DESC, name ASC"

        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            return [self._row_to_template(row) for row in cursor.fetchall()]

    def update_discussion_template(
        self,
        template_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        topic_template: Optional[str] = None,
        default_providers: Optional[List[str]] = None,
        default_config: Optional[Dict[str, Any]] = None,
        category: Optional[str] = None,
    ) -> bool:
        """Update a discussion template."""
        updates = ["updated_at = ?"]
        params: List[Any] = [time.time()]

        if name is not None:
            updates.append("name = ?")
            params.append(name)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if topic_template is not None:
            updates.append("topic_template = ?")
            params.append(topic_template)
        if default_providers is not None:
            updates.append("default_providers = ?")
            params.append(json.dumps(default_providers))
        if default_config is not None:
            updates.append("default_config = ?")
            params.append(json.dumps(default_config))
        if category is not None:
            updates.append("category = ?")
            params.append(category)

        params.append(template_id)

        with self._get_connection() as conn:
            # Don't allow updating builtin templates
            cursor = conn.execute(
                f"UPDATE discussion_templates SET {', '.join(updates)} WHERE id = ? AND is_builtin = 0",
                params
            )
            return cursor.rowcount > 0

    def delete_discussion_template(self, template_id: str) -> bool:
        """Delete a discussion template (only non-builtin)."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM discussion_templates WHERE id = ? AND is_builtin = 0",
                (template_id,)
            )
            return cursor.rowcount > 0

    def increment_template_usage(self, template_id: str) -> None:
        """Increment the usage count for a template."""
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE discussion_templates SET usage_count = usage_count + 1 WHERE id = ?",
                (template_id,)
            )

    def _row_to_template(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert database row to template dictionary."""
        return {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "topic_template": row["topic_template"],
            "default_providers": json.loads(row["default_providers"]) if row["default_providers"] else None,
            "default_config": json.loads(row["default_config"]) if row["default_config"] else None,
            "category": row["category"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "usage_count": row["usage_count"],
            "is_builtin": bool(row["is_builtin"]),
        }

    # ==================== Token Cost Tracking Operations ====================

    # Pricing per million tokens (USD)
    PROVIDER_PRICING = {
        "deepseek": {"input": 0.14, "output": 0.28},
        "codex": {"input": 2.50, "output": 10.00},  # o3 pricing
        "gemini": {"input": 0.075, "output": 0.30},
        "claude": {"input": 3.00, "output": 15.00},
        "kimi": {"input": 0.0, "output": 0.0},  # Free tier
        "qwen": {"input": 0.0, "output": 0.0},  # Free tier
        "iflow": {"input": 0.0, "output": 0.0},
        "opencode": {"input": 0.0, "output": 0.0},
    }

    def record_token_cost(
        self,
        provider: str,
        input_tokens: int,
        output_tokens: int,
        request_id: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        """Record token usage and calculate cost."""
        # Calculate cost
        pricing = self.PROVIDER_PRICING.get(provider.lower(), {"input": 0, "output": 0})
        cost_usd = (
            (input_tokens * pricing["input"] / 1_000_000) +
            (output_tokens * pricing["output"] / 1_000_000)
        )

        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO token_costs (
                    provider, request_id, input_tokens, output_tokens,
                    cost_usd, model, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                provider,
                request_id,
                input_tokens,
                output_tokens,
                cost_usd,
                model,
                time.time(),
            ))

    def get_cost_summary(self, days: int = 30) -> Dict[str, Any]:
        """Get cost summary for the specified period."""
        cutoff = time.time() - (days * 86400)

        with self._get_connection() as conn:
            # Total costs
            cursor = conn.execute("""
                SELECT
                    SUM(input_tokens) as total_input,
                    SUM(output_tokens) as total_output,
                    SUM(cost_usd) as total_cost,
                    COUNT(*) as total_requests
                FROM token_costs
                WHERE timestamp > ?
            """, (cutoff,))
            row = cursor.fetchone()

            # Today's costs
            today_start = time.time() - (time.time() % 86400)
            cursor = conn.execute("""
                SELECT SUM(cost_usd) as today_cost
                FROM token_costs
                WHERE timestamp > ?
            """, (today_start,))
            today_row = cursor.fetchone()

            # This week's costs
            week_start = time.time() - (7 * 86400)
            cursor = conn.execute("""
                SELECT SUM(cost_usd) as week_cost
                FROM token_costs
                WHERE timestamp > ?
            """, (week_start,))
            week_row = cursor.fetchone()

            return {
                "period_days": days,
                "total_input_tokens": row["total_input"] or 0,
                "total_output_tokens": row["total_output"] or 0,
                "total_cost_usd": row["total_cost"] or 0.0,
                "total_requests": row["total_requests"] or 0,
                "today_cost_usd": today_row["today_cost"] or 0.0,
                "week_cost_usd": week_row["week_cost"] or 0.0,
            }

    def get_cost_by_provider(self, days: int = 30) -> List[Dict[str, Any]]:
        """Get cost breakdown by provider."""
        cutoff = time.time() - (days * 86400)

        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    provider,
                    SUM(input_tokens) as total_input,
                    SUM(output_tokens) as total_output,
                    SUM(cost_usd) as total_cost,
                    COUNT(*) as request_count
                FROM token_costs
                WHERE timestamp > ?
                GROUP BY provider
                ORDER BY total_cost DESC
            """, (cutoff,))

            return [
                {
                    "provider": row["provider"],
                    "total_input_tokens": row["total_input"] or 0,
                    "total_output_tokens": row["total_output"] or 0,
                    "total_cost_usd": row["total_cost"] or 0.0,
                    "request_count": row["request_count"] or 0,
                }
                for row in cursor.fetchall()
            ]

    def get_cost_by_day(self, days: int = 7) -> List[Dict[str, Any]]:
        """Get daily cost breakdown."""
        cutoff = time.time() - (days * 86400)

        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    DATE(timestamp, 'unixepoch', 'localtime') as date,
                    SUM(input_tokens) as total_input,
                    SUM(output_tokens) as total_output,
                    SUM(cost_usd) as total_cost,
                    COUNT(*) as request_count
                FROM token_costs
                WHERE timestamp > ?
                GROUP BY DATE(timestamp, 'unixepoch', 'localtime')
                ORDER BY date DESC
            """, (cutoff,))

            return [
                {
                    "date": row["date"],
                    "total_input_tokens": row["total_input"] or 0,
                    "total_output_tokens": row["total_output"] or 0,
                    "total_cost_usd": row["total_cost"] or 0.0,
                    "request_count": row["request_count"] or 0,
                }
                for row in cursor.fetchall()
            ]

    def cleanup_old_costs(self, max_age_days: int = 90) -> int:
        """Remove cost records older than specified age."""
        cutoff = time.time() - (max_age_days * 86400)
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM token_costs WHERE timestamp < ?",
                (cutoff,)
            )
            return cursor.rowcount

    # ==================== Unified Results Query ====================

    def get_latest_results(
        self,
        provider: Optional[str] = None,
        limit: int = 10,
        include_discussions: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Get latest results from all sources (requests + discussions) for Claude to read.

        Returns unified format:
        {
            "id": str,
            "type": "request" | "discussion",
            "provider": str,
            "query": str,  # original message/topic
            "response": str,
            "status": str,
            "created_at": float,
            "latency_ms": float,
            "metadata": dict
        }
        """
        results = []

        with self._get_connection() as conn:
            # Get recent request responses
            query = """
                SELECT r.id, r.provider, r.message, r.status, r.created_at,
                       resp.response, resp.latency_ms, resp.metadata, resp.thinking
                FROM requests r
                LEFT JOIN responses resp ON r.id = resp.request_id
                WHERE r.status IN ('completed', 'failed')
            """
            params: List[Any] = []

            if provider:
                query += " AND r.provider = ?"
                params.append(provider)

            query += " ORDER BY r.created_at DESC LIMIT ?"
            params.append(limit)

            cursor = conn.execute(query, params)
            for row in cursor.fetchall():
                results.append({
                    "id": row["id"],
                    "type": "request",
                    "provider": row["provider"],
                    "query": row["message"][:200] + "..." if len(row["message"] or "") > 200 else row["message"],
                    "response": row["response"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "latency_ms": row["latency_ms"],
                    "thinking": row["thinking"] if "thinking" in row.keys() else None,
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else None,
                })

            # Get recent discussion summaries
            if include_discussions:
                disc_query = """
                    SELECT id, topic, status, providers, summary, created_at, updated_at
                    FROM discussion_sessions
                    WHERE status IN ('completed', 'failed')
                    ORDER BY created_at DESC
                    LIMIT ?
                """
                cursor = conn.execute(disc_query, (limit,))
                for row in cursor.fetchall():
                    results.append({
                        "id": row["id"],
                        "type": "discussion",
                        "provider": json.loads(row["providers"]) if row["providers"] else [],
                        "query": row["topic"],
                        "response": row["summary"],
                        "status": row["status"],
                        "created_at": row["created_at"],
                        "latency_ms": (row["updated_at"] - row["created_at"]) * 1000 if row["updated_at"] else None,
                        "metadata": {"providers": json.loads(row["providers"]) if row["providers"] else []},
                    })

        # Sort by created_at descending
        results.sort(key=lambda x: x["created_at"], reverse=True)
        return results[:limit]

    def get_result_by_id(self, result_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific result by ID (request or discussion)."""
        # Try request first
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT r.id, r.provider, r.message, r.status, r.created_at,
                       resp.response, resp.error, resp.latency_ms, resp.metadata,
                       resp.thinking, resp.raw_output
                FROM requests r
                LEFT JOIN responses resp ON r.id = resp.request_id
                WHERE r.id = ?
            """, (result_id,))
            row = cursor.fetchone()
            if row:
                return {
                    "id": row["id"],
                    "type": "request",
                    "provider": row["provider"],
                    "query": row["message"],
                    "response": row["response"],
                    "error": row["error"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "latency_ms": row["latency_ms"],
                    "thinking": row["thinking"] if "thinking" in row.keys() else None,
                    "raw_output": row["raw_output"] if "raw_output" in row.keys() else None,
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else None,
                }

            # Try discussion
            cursor = conn.execute("""
                SELECT id, topic, status, providers, summary, created_at, updated_at, metadata
                FROM discussion_sessions
                WHERE id = ?
            """, (result_id,))
            row = cursor.fetchone()
            if row:
                # Also get all messages
                messages = self.get_discussion_messages(result_id)
                return {
                    "id": row["id"],
                    "type": "discussion",
                    "provider": json.loads(row["providers"]) if row["providers"] else [],
                    "query": row["topic"],
                    "response": row["summary"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "latency_ms": (row["updated_at"] - row["created_at"]) * 1000 if row["updated_at"] else None,
                    "messages": [m.to_dict() for m in messages],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else None,
                }

        return None
