"""
MCP Server Aggregation System for CCB

Aggregates multiple MCP servers into a unified interface with:
- Server registration and discovery
- Tool routing based on capabilities
- Health monitoring and failover
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import time
import threading
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, List, Any, Callable
import sqlite3


class MCPTransport(Enum):
    """MCP transport types."""
    STDIO = "stdio"
    SSE = "sse"
    HTTP = "http"


class ServerStatus(Enum):
    """MCP server health status."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"
    UNKNOWN = "unknown"


@dataclass
class MCPServerConfig:
    """Configuration for an MCP server."""
    name: str
    command: str
    transport: MCPTransport = MCPTransport.STDIO
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    enabled: bool = True
    timeout_s: float = 30.0


@dataclass
class ToolCapability:
    """A tool capability from an MCP server."""
    name: str
    server: str
    description: str = ""
    input_schema: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)


@dataclass
class ServerHealth:
    """Health status of an MCP server."""
    server: str
    status: ServerStatus
    latency_ms: float = 0.0
    last_check: float = 0.0
    error: Optional[str] = None
    tool_count: int = 0


@dataclass
class ToolCallResult:
    """Result of a tool call."""
    success: bool
    server: str
    tool: str
    result: Any = None
    error: Optional[str] = None
    latency_ms: float = 0.0


class MCPAggregator:
    """
    Aggregates multiple MCP servers into a unified interface.

    Features:
    - Register and manage multiple MCP servers
    - Discover tools across all servers
    - Route tool calls to appropriate servers
    - Monitor server health
    """

    # Default MCP servers
    DEFAULT_SERVERS: Dict[str, MCPServerConfig] = {
        "github": MCPServerConfig(
            name="github",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-github"],
            transport=MCPTransport.STDIO,
        ),
        "filesystem": MCPServerConfig(
            name="filesystem",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-filesystem", "."],
            transport=MCPTransport.STDIO,
        ),
        "memory": MCPServerConfig(
            name="memory",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-memory"],
            transport=MCPTransport.STDIO,
        ),
    }

    def __init__(
        self,
        db_path: Optional[str] = None,
        config: Optional[Dict[str, MCPServerConfig]] = None,
    ):
        """
        Initialize the MCP aggregator.

        Args:
            db_path: Path to SQLite database for persistent state
            config: Optional custom server configurations
        """
        if db_path is None:
            db_path = str(Path.home() / ".ccb_config" / "mcp_aggregator.db")

        self.db_path = db_path
        self.servers: Dict[str, MCPServerConfig] = {}
        self._tools: Dict[str, ToolCapability] = {}
        self._server_health: Dict[str, ServerHealth] = {}
        self._processes: Dict[str, subprocess.Popen] = {}
        self._lock = threading.Lock()

        # Initialize database
        self._init_db()

        # Load servers from config
        if config:
            for name, server_config in config.items():
                self.servers[name] = server_config
        else:
            self._load_servers_from_db()

    def _init_db(self) -> None:
        """Initialize the SQLite database."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS mcp_servers (
                    name TEXT PRIMARY KEY,
                    command TEXT NOT NULL,
                    transport TEXT NOT NULL,
                    args TEXT,
                    env TEXT,
                    enabled INTEGER DEFAULT 1,
                    timeout_s REAL DEFAULT 30.0
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS mcp_tools (
                    name TEXT PRIMARY KEY,
                    server TEXT NOT NULL,
                    description TEXT,
                    input_schema TEXT,
                    tags TEXT,
                    discovered_at REAL
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS mcp_health_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server TEXT NOT NULL,
                    status TEXT NOT NULL,
                    latency_ms REAL,
                    error TEXT,
                    timestamp REAL
                )
            """)

            conn.commit()

    def _load_servers_from_db(self) -> None:
        """Load server configurations from database."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT name, command, transport, args, env, enabled, timeout_s FROM mcp_servers"
            )
            for row in cursor:
                name, command, transport, args_json, env_json, enabled, timeout_s = row
                self.servers[name] = MCPServerConfig(
                    name=name,
                    command=command,
                    transport=MCPTransport(transport),
                    args=json.loads(args_json) if args_json else [],
                    env=json.loads(env_json) if env_json else {},
                    enabled=bool(enabled),
                    timeout_s=timeout_s,
                )

    def register_server(self, config: MCPServerConfig) -> None:
        """
        Register an MCP server.

        Args:
            config: Server configuration
        """
        with self._lock:
            self.servers[config.name] = config

            # Save to database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO mcp_servers
                    (name, command, transport, args, env, enabled, timeout_s)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    config.name,
                    config.command,
                    config.transport.value,
                    json.dumps(config.args),
                    json.dumps(config.env),
                    int(config.enabled),
                    config.timeout_s,
                ))
                conn.commit()

    def unregister_server(self, name: str) -> bool:
        """
        Unregister an MCP server.

        Args:
            name: Server name

        Returns:
            True if server was removed
        """
        with self._lock:
            if name not in self.servers:
                return False

            # Stop server if running
            self._stop_server(name)

            del self.servers[name]

            # Remove from database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("DELETE FROM mcp_servers WHERE name = ?", (name,))
                conn.execute("DELETE FROM mcp_tools WHERE server = ?", (name,))
                conn.commit()

            return True

    def _start_server(self, name: str) -> bool:
        """Start an MCP server process."""
        if name not in self.servers:
            return False

        config = self.servers[name]
        if not config.enabled:
            return False

        try:
            cmd = [config.command] + config.args
            env = {**dict(subprocess.os.environ), **config.env}

            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
            )

            self._processes[name] = process
            return True

        except Exception as e:
            self._server_health[name] = ServerHealth(
                server=name,
                status=ServerStatus.UNAVAILABLE,
                error=str(e),
                last_check=time.time(),
            )
            return False

    def _stop_server(self, name: str) -> None:
        """Stop an MCP server process."""
        if name in self._processes:
            try:
                self._processes[name].terminate()
                self._processes[name].wait(timeout=5)
            except Exception:
                self._processes[name].kill()
            finally:
                del self._processes[name]

    def discover_tools(self, server: Optional[str] = None) -> List[ToolCapability]:
        """
        Discover tools from MCP servers.

        Args:
            server: Optional specific server to query

        Returns:
            List of discovered tool capabilities
        """
        tools = []
        servers_to_query = [server] if server else list(self.servers.keys())

        for server_name in servers_to_query:
            if server_name not in self.servers:
                continue

            config = self.servers[server_name]
            if not config.enabled:
                continue

            try:
                # For stdio transport, we need to send a tools/list request
                server_tools = self._query_server_tools(server_name)
                tools.extend(server_tools)

                # Cache tools
                for tool in server_tools:
                    self._tools[tool.name] = tool

            except Exception as e:
                self._server_health[server_name] = ServerHealth(
                    server=server_name,
                    status=ServerStatus.UNAVAILABLE,
                    error=str(e),
                    last_check=time.time(),
                )

        return tools

    def _query_server_tools(self, server_name: str) -> List[ToolCapability]:
        """Query tools from a specific server."""
        config = self.servers[server_name]
        tools = []

        try:
            # Start server if not running
            if server_name not in self._processes:
                if not self._start_server(server_name):
                    return []

            process = self._processes.get(server_name)
            if not process:
                return []

            # Send tools/list request (JSON-RPC)
            request = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/list",
                "params": {},
            }

            process.stdin.write((json.dumps(request) + "\n").encode())
            process.stdin.flush()

            # Read response with timeout
            import select
            ready, _, _ = select.select([process.stdout], [], [], config.timeout_s)

            if ready:
                response_line = process.stdout.readline().decode()
                response = json.loads(response_line)

                if "result" in response and "tools" in response["result"]:
                    for tool_data in response["result"]["tools"]:
                        tool = ToolCapability(
                            name=tool_data.get("name", ""),
                            server=server_name,
                            description=tool_data.get("description", ""),
                            input_schema=tool_data.get("inputSchema", {}),
                        )
                        tools.append(tool)

                        # Save to database
                        self._save_tool(tool)

        except Exception as e:
            self._server_health[server_name] = ServerHealth(
                server=server_name,
                status=ServerStatus.DEGRADED,
                error=str(e),
                last_check=time.time(),
            )

        return tools

    def _save_tool(self, tool: ToolCapability) -> None:
        """Save a tool to the database."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO mcp_tools
                (name, server, description, input_schema, tags, discovered_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                tool.name,
                tool.server,
                tool.description,
                json.dumps(tool.input_schema),
                json.dumps(tool.tags),
                time.time(),
            ))
            conn.commit()

    def route_tool_call(
        self,
        tool_name: str,
        args: Dict[str, Any],
        timeout_s: Optional[float] = None,
    ) -> ToolCallResult:
        """
        Route a tool call to the appropriate server.

        Args:
            tool_name: Name of the tool to call
            args: Arguments for the tool
            timeout_s: Optional timeout override

        Returns:
            ToolCallResult with the response
        """
        start_time = time.time()

        # Find the server for this tool
        tool = self._tools.get(tool_name)
        if not tool:
            # Try to find in database
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT server FROM mcp_tools WHERE name = ?",
                    (tool_name,)
                )
                row = cursor.fetchone()
                if row:
                    tool = ToolCapability(name=tool_name, server=row[0])
                    self._tools[tool_name] = tool

        if not tool:
            return ToolCallResult(
                success=False,
                server="unknown",
                tool=tool_name,
                error=f"Tool '{tool_name}' not found",
                latency_ms=(time.time() - start_time) * 1000,
            )

        server_name = tool.server
        config = self.servers.get(server_name)

        if not config or not config.enabled:
            return ToolCallResult(
                success=False,
                server=server_name,
                tool=tool_name,
                error=f"Server '{server_name}' not available",
                latency_ms=(time.time() - start_time) * 1000,
            )

        try:
            # Ensure server is running
            if server_name not in self._processes:
                if not self._start_server(server_name):
                    return ToolCallResult(
                        success=False,
                        server=server_name,
                        tool=tool_name,
                        error="Failed to start server",
                        latency_ms=(time.time() - start_time) * 1000,
                    )

            process = self._processes[server_name]

            # Send tools/call request
            request = {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": args,
                },
            }

            process.stdin.write((json.dumps(request) + "\n").encode())
            process.stdin.flush()

            # Read response
            effective_timeout = timeout_s or config.timeout_s
            import select
            ready, _, _ = select.select([process.stdout], [], [], effective_timeout)

            if ready:
                response_line = process.stdout.readline().decode()
                response = json.loads(response_line)

                latency_ms = (time.time() - start_time) * 1000

                if "result" in response:
                    return ToolCallResult(
                        success=True,
                        server=server_name,
                        tool=tool_name,
                        result=response["result"],
                        latency_ms=latency_ms,
                    )
                elif "error" in response:
                    return ToolCallResult(
                        success=False,
                        server=server_name,
                        tool=tool_name,
                        error=response["error"].get("message", "Unknown error"),
                        latency_ms=latency_ms,
                    )

            return ToolCallResult(
                success=False,
                server=server_name,
                tool=tool_name,
                error="Timeout waiting for response",
                latency_ms=(time.time() - start_time) * 1000,
            )

        except Exception as e:
            return ToolCallResult(
                success=False,
                server=server_name,
                tool=tool_name,
                error=str(e),
                latency_ms=(time.time() - start_time) * 1000,
            )

    def get_server_health(self, server: Optional[str] = None) -> Dict[str, ServerHealth]:
        """
        Get health status of MCP servers.

        Args:
            server: Optional specific server to check

        Returns:
            Dict of server name to health status
        """
        servers_to_check = [server] if server else list(self.servers.keys())
        results = {}

        for server_name in servers_to_check:
            if server_name not in self.servers:
                continue

            config = self.servers[server_name]
            start_time = time.time()

            try:
                # Check if process is running
                if server_name in self._processes:
                    process = self._processes[server_name]
                    if process.poll() is None:
                        # Process is running, try a ping
                        latency_ms = (time.time() - start_time) * 1000
                        results[server_name] = ServerHealth(
                            server=server_name,
                            status=ServerStatus.HEALTHY,
                            latency_ms=latency_ms,
                            last_check=time.time(),
                            tool_count=len([t for t in self._tools.values() if t.server == server_name]),
                        )
                    else:
                        results[server_name] = ServerHealth(
                            server=server_name,
                            status=ServerStatus.UNAVAILABLE,
                            error="Process terminated",
                            last_check=time.time(),
                        )
                        del self._processes[server_name]
                else:
                    # Try to start server
                    if self._start_server(server_name):
                        latency_ms = (time.time() - start_time) * 1000
                        results[server_name] = ServerHealth(
                            server=server_name,
                            status=ServerStatus.HEALTHY,
                            latency_ms=latency_ms,
                            last_check=time.time(),
                        )
                    else:
                        results[server_name] = ServerHealth(
                            server=server_name,
                            status=ServerStatus.UNAVAILABLE,
                            error="Failed to start",
                            last_check=time.time(),
                        )

            except Exception as e:
                results[server_name] = ServerHealth(
                    server=server_name,
                    status=ServerStatus.UNAVAILABLE,
                    error=str(e),
                    last_check=time.time(),
                )

            # Log health check
            self._log_health(results[server_name])

        return results

    def _log_health(self, health: ServerHealth) -> None:
        """Log a health check result."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO mcp_health_log (server, status, latency_ms, error, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (
                health.server,
                health.status.value,
                health.latency_ms,
                health.error,
                health.last_check,
            ))
            conn.commit()

    def list_tools(self) -> List[ToolCapability]:
        """List all discovered tools."""
        # Load from database if cache is empty
        if not self._tools:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT name, server, description, input_schema, tags FROM mcp_tools"
                )
                for row in cursor:
                    name, server, description, input_schema_json, tags_json = row
                    self._tools[name] = ToolCapability(
                        name=name,
                        server=server,
                        description=description,
                        input_schema=json.loads(input_schema_json) if input_schema_json else {},
                        tags=json.loads(tags_json) if tags_json else [],
                    )

        return list(self._tools.values())

    def list_servers(self) -> List[MCPServerConfig]:
        """List all registered servers."""
        return list(self.servers.values())

    def shutdown(self) -> None:
        """Shutdown all MCP server processes."""
        for server_name in list(self._processes.keys()):
            self._stop_server(server_name)


# Singleton instance
_mcp_aggregator: Optional[MCPAggregator] = None


def get_mcp_aggregator() -> MCPAggregator:
    """Get the global MCP aggregator instance."""
    global _mcp_aggregator
    if _mcp_aggregator is None:
        _mcp_aggregator = MCPAggregator()
    return _mcp_aggregator
