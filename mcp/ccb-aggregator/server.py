#!/usr/bin/env python3
"""
CCB MCP Aggregator Server

An MCP server that aggregates multiple MCP servers into a unified interface.
Provides tool discovery, routing, and health monitoring.
"""
from __future__ import annotations

import sys
import json
import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add lib to path
script_dir = Path(__file__).resolve().parent
lib_dir = script_dir.parent.parent / "lib"
sys.path.insert(0, str(lib_dir))

from mcp_aggregator import MCPAggregator, MCPServerConfig, MCPTransport, get_mcp_aggregator


class MCPAggregatorServer:
    """
    MCP Server that aggregates multiple MCP servers.

    Implements the MCP protocol over stdio.
    """

    def __init__(self):
        self.aggregator = get_mcp_aggregator()
        self._request_id = 0

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle an incoming MCP request."""
        method = request.get("method", "")
        params = request.get("params", {})
        request_id = request.get("id")

        try:
            if method == "initialize":
                return self._handle_initialize(request_id, params)
            elif method == "tools/list":
                return self._handle_tools_list(request_id, params)
            elif method == "tools/call":
                return self._handle_tools_call(request_id, params)
            elif method == "resources/list":
                return self._handle_resources_list(request_id, params)
            elif method == "ccb/servers/list":
                return self._handle_servers_list(request_id, params)
            elif method == "ccb/servers/register":
                return self._handle_servers_register(request_id, params)
            elif method == "ccb/servers/health":
                return self._handle_servers_health(request_id, params)
            else:
                return self._error_response(request_id, -32601, f"Method not found: {method}")

        except Exception as e:
            return self._error_response(request_id, -32603, str(e))

    def _handle_initialize(self, request_id: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle initialize request."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {},
                    "resources": {},
                },
                "serverInfo": {
                    "name": "ccb-aggregator",
                    "version": "1.0.0",
                },
            },
        }

    def _handle_tools_list(self, request_id: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tools/list request."""
        # Get tools from all aggregated servers
        tools = self.aggregator.list_tools()

        # Add aggregator's own tools
        aggregator_tools = [
            {
                "name": "ccb_list_servers",
                "description": "List all registered MCP servers",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "ccb_server_health",
                "description": "Check health of MCP servers",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "server": {
                            "type": "string",
                            "description": "Optional server name to check",
                        },
                    },
                },
            },
            {
                "name": "ccb_discover_tools",
                "description": "Discover tools from MCP servers",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "server": {
                            "type": "string",
                            "description": "Optional server name to query",
                        },
                    },
                },
            },
            {
                "name": "ccb_register_server",
                "description": "Register a new MCP server",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Server name"},
                        "command": {"type": "string", "description": "Command to run"},
                        "args": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Command arguments",
                        },
                    },
                    "required": ["name", "command"],
                },
            },
        ]

        # Convert aggregated tools to MCP format
        tool_list = aggregator_tools + [
            {
                "name": tool.name,
                "description": f"[{tool.server}] {tool.description}",
                "inputSchema": tool.input_schema,
            }
            for tool in tools
        ]

        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "tools": tool_list,
            },
        }

    def _handle_tools_call(self, request_id: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tools/call request."""
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        # Handle aggregator's own tools
        if tool_name == "ccb_list_servers":
            servers = self.aggregator.list_servers()
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps([
                                {
                                    "name": s.name,
                                    "command": s.command,
                                    "enabled": s.enabled,
                                }
                                for s in servers
                            ], indent=2),
                        }
                    ],
                },
            }

        elif tool_name == "ccb_server_health":
            server = arguments.get("server")
            health = self.aggregator.get_server_health(server)
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps({
                                name: {
                                    "status": h.status.value,
                                    "latency_ms": h.latency_ms,
                                    "error": h.error,
                                }
                                for name, h in health.items()
                            }, indent=2),
                        }
                    ],
                },
            }

        elif tool_name == "ccb_discover_tools":
            server = arguments.get("server")
            tools = self.aggregator.discover_tools(server)
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps([
                                {
                                    "name": t.name,
                                    "server": t.server,
                                    "description": t.description,
                                }
                                for t in tools
                            ], indent=2),
                        }
                    ],
                },
            }

        elif tool_name == "ccb_register_server":
            config = MCPServerConfig(
                name=arguments.get("name", ""),
                command=arguments.get("command", ""),
                args=arguments.get("args", []),
                transport=MCPTransport.STDIO,
            )
            self.aggregator.register_server(config)
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Registered server: {config.name}",
                        }
                    ],
                },
            }

        # Route to aggregated server
        result = self.aggregator.route_tool_call(tool_name, arguments)

        if result.success:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": result.result,
            }
        else:
            return self._error_response(request_id, -32000, result.error or "Tool call failed")

    def _handle_resources_list(self, request_id: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle resources/list request."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "resources": [],
            },
        }

    def _handle_servers_list(self, request_id: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle ccb/servers/list request."""
        servers = self.aggregator.list_servers()
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "servers": [
                    {
                        "name": s.name,
                        "command": s.command,
                        "transport": s.transport.value,
                        "enabled": s.enabled,
                    }
                    for s in servers
                ],
            },
        }

    def _handle_servers_register(self, request_id: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle ccb/servers/register request."""
        config = MCPServerConfig(
            name=params.get("name", ""),
            command=params.get("command", ""),
            args=params.get("args", []),
            transport=MCPTransport(params.get("transport", "stdio")),
            enabled=params.get("enabled", True),
        )
        self.aggregator.register_server(config)
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "success": True,
                "server": config.name,
            },
        }

    def _handle_servers_health(self, request_id: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle ccb/servers/health request."""
        server = params.get("server")
        health = self.aggregator.get_server_health(server)
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "health": {
                    name: {
                        "status": h.status.value,
                        "latency_ms": h.latency_ms,
                        "error": h.error,
                        "tool_count": h.tool_count,
                    }
                    for name, h in health.items()
                },
            },
        }

    def _error_response(self, request_id: Any, code: int, message: str) -> Dict[str, Any]:
        """Create an error response."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": code,
                "message": message,
            },
        }

    async def run(self):
        """Run the MCP server."""
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)

        writer_transport, writer_protocol = await asyncio.get_event_loop().connect_write_pipe(
            asyncio.streams.FlowControlMixin, sys.stdout
        )
        writer = asyncio.StreamWriter(writer_transport, writer_protocol, None, asyncio.get_event_loop())

        while True:
            try:
                line = await reader.readline()
                if not line:
                    break

                request = json.loads(line.decode())
                response = await self.handle_request(request)

                writer.write((json.dumps(response) + "\n").encode())
                await writer.drain()

            except json.JSONDecodeError:
                continue
            except Exception as e:
                error_response = self._error_response(None, -32700, str(e))
                writer.write((json.dumps(error_response) + "\n").encode())
                await writer.drain()


async def main():
    """Main entry point."""
    server = MCPAggregatorServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())
