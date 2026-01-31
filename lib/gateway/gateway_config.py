"""
Gateway Configuration Management.

Handles loading and managing gateway configuration from YAML files
and environment variables.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any, List
import os
import yaml

from .models import BackendType


@dataclass
class ProviderConfig:
    """Configuration for a single provider."""
    name: str
    backend_type: BackendType
    enabled: bool = True
    priority: int = 50
    timeout_s: float = 300.0
    rate_limit_rpm: Optional[int] = None
    # Backend-specific config
    api_base_url: Optional[str] = None
    api_key_env: Optional[str] = None
    cli_command: Optional[str] = None
    cli_args: List[str] = field(default_factory=list)
    fifo_path: Optional[str] = None
    terminal_pane_id: Optional[str] = None
    # Model config
    model: Optional[str] = None
    max_tokens: int = 4096


@dataclass
class GatewayConfig:
    """Gateway configuration."""
    # Server settings
    host: str = "127.0.0.1"
    port: int = 8765
    # Database
    db_path: Optional[str] = None
    # Timeouts
    default_timeout_s: float = 300.0
    request_ttl_hours: int = 24
    # Queue settings
    max_queue_size: int = 1000
    max_concurrent_requests: int = 10
    # Provider configs
    providers: Dict[str, ProviderConfig] = field(default_factory=dict)
    # Default provider for auto-routing
    default_provider: str = "claude"
    # WebSocket settings
    ws_enabled: bool = True
    ws_heartbeat_s: float = 30.0
    # Logging
    log_level: str = "INFO"
    log_file: Optional[str] = None

    @classmethod
    def load(cls, config_path: Optional[str] = None) -> "GatewayConfig":
        """
        Load configuration from file and environment.

        Priority: Environment > Config file > Defaults
        """
        config = cls()

        # Try to load from file
        if config_path:
            config._load_from_file(config_path)
        else:
            # Try default locations
            default_paths = [
                Path.home() / ".ccb_config" / "gateway.yaml",
                Path.home() / ".config" / "ccb" / "gateway.yaml",
                Path("/etc/ccb/gateway.yaml"),
            ]
            for path in default_paths:
                if path.exists():
                    config._load_from_file(str(path))
                    break

        # Override with environment variables
        config._load_from_env()

        # Initialize default providers if none configured
        if not config.providers:
            config._init_default_providers()

        return config

    def _load_from_file(self, path: str) -> None:
        """Load configuration from YAML file."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}

            # Server settings
            server = data.get("server", {})
            self.host = server.get("host", self.host)
            self.port = server.get("port", self.port)

            # Database
            self.db_path = data.get("database", {}).get("path", self.db_path)

            # Timeouts
            timeouts = data.get("timeouts", {})
            self.default_timeout_s = timeouts.get("default_s", self.default_timeout_s)
            self.request_ttl_hours = timeouts.get("request_ttl_hours", self.request_ttl_hours)

            # Queue
            queue = data.get("queue", {})
            self.max_queue_size = queue.get("max_size", self.max_queue_size)
            self.max_concurrent_requests = queue.get("max_concurrent", self.max_concurrent_requests)

            # Default provider
            self.default_provider = data.get("default_provider", self.default_provider)

            # WebSocket
            ws = data.get("websocket", {})
            self.ws_enabled = ws.get("enabled", self.ws_enabled)
            self.ws_heartbeat_s = ws.get("heartbeat_s", self.ws_heartbeat_s)

            # Logging
            logging = data.get("logging", {})
            self.log_level = logging.get("level", self.log_level)
            self.log_file = logging.get("file", self.log_file)

            # Providers
            for name, pconfig in data.get("providers", {}).items():
                self.providers[name] = self._parse_provider_config(name, pconfig)

        except Exception as e:
            print(f"Warning: Failed to load config from {path}: {e}")

    def _parse_provider_config(self, name: str, data: Dict[str, Any]) -> ProviderConfig:
        """Parse a provider configuration."""
        backend_str = data.get("backend_type", "cli_exec")
        try:
            backend_type = BackendType(backend_str)
        except ValueError:
            backend_type = BackendType.CLI_EXEC

        return ProviderConfig(
            name=name,
            backend_type=backend_type,
            enabled=data.get("enabled", True),
            priority=data.get("priority", 50),
            timeout_s=data.get("timeout_s", self.default_timeout_s),
            rate_limit_rpm=data.get("rate_limit_rpm"),
            api_base_url=data.get("api_base_url"),
            api_key_env=data.get("api_key_env"),
            cli_command=data.get("cli_command"),
            cli_args=data.get("cli_args", []),
            fifo_path=data.get("fifo_path"),
            terminal_pane_id=data.get("terminal_pane_id"),
            model=data.get("model"),
            max_tokens=data.get("max_tokens", 4096),
        )

    def _load_from_env(self) -> None:
        """Load configuration from environment variables."""
        # Server
        if os.environ.get("CCB_GATEWAY_HOST"):
            self.host = os.environ["CCB_GATEWAY_HOST"]
        if os.environ.get("CCB_GATEWAY_PORT"):
            try:
                self.port = int(os.environ["CCB_GATEWAY_PORT"])
            except ValueError:
                pass

        # Database
        if os.environ.get("CCB_GATEWAY_DB"):
            self.db_path = os.environ["CCB_GATEWAY_DB"]

        # Default provider
        if os.environ.get("CCB_DEFAULT_PROVIDER"):
            self.default_provider = os.environ["CCB_DEFAULT_PROVIDER"]

        # Timeouts
        if os.environ.get("CCB_GATEWAY_TIMEOUT"):
            try:
                self.default_timeout_s = float(os.environ["CCB_GATEWAY_TIMEOUT"])
            except ValueError:
                pass

        # Log level
        if os.environ.get("CCB_GATEWAY_LOG_LEVEL"):
            self.log_level = os.environ["CCB_GATEWAY_LOG_LEVEL"]

    def _init_default_providers(self) -> None:
        """Initialize default provider configurations."""
        # Claude (Anthropic API)
        self.providers["claude"] = ProviderConfig(
            name="claude",
            backend_type=BackendType.HTTP_API,
            api_base_url="https://api.anthropic.com/v1",
            api_key_env="ANTHROPIC_API_KEY",
            model="claude-sonnet-4-20250514",
            timeout_s=300.0,
        )

        # DeepSeek (CLI) - use '-q' for quick/non-interactive mode
        self.providers["deepseek"] = ProviderConfig(
            name="deepseek",
            backend_type=BackendType.CLI_EXEC,
            cli_command="deepseek",
            cli_args=["-q"],
            timeout_s=120.0,  # Longer timeout for reasoning
        )

        # Codex (CLI) - use 'exec --json' for non-interactive mode with JSON output
        self.providers["codex"] = ProviderConfig(
            name="codex",
            backend_type=BackendType.CLI_EXEC,
            cli_command="codex",
            cli_args=["exec", "--json"],
            timeout_s=300.0,
        )

        # Gemini (CLI) - use -p for non-interactive prompt mode
        self.providers["gemini"] = ProviderConfig(
            name="gemini",
            backend_type=BackendType.CLI_EXEC,
            cli_command="gemini",
            cli_args=["-p"],
            timeout_s=300.0,
        )

        # OpenCode (CLI) - use 'run --format json' for non-interactive mode
        self.providers["opencode"] = ProviderConfig(
            name="opencode",
            backend_type=BackendType.CLI_EXEC,
            cli_command="opencode",
            cli_args=["run", "--format", "json", "-m", "opencode/minimax-m2.1-free"],
            timeout_s=120.0,
        )

        # iFlow (CLI) - use '-p' for non-interactive prompt mode
        self.providers["iflow"] = ProviderConfig(
            name="iflow",
            backend_type=BackendType.CLI_EXEC,
            cli_command="iflow",
            cli_args=["-p"],
            timeout_s=300.0,
        )

        # Kimi (CLI) - use '--quiet' for non-interactive mode
        self.providers["kimi"] = ProviderConfig(
            name="kimi",
            backend_type=BackendType.CLI_EXEC,
            cli_command="kimi",
            cli_args=["--quiet", "-p"],
            timeout_s=300.0,
        )

        # Qwen (CLI)
        self.providers["qwen"] = ProviderConfig(
            name="qwen",
            backend_type=BackendType.CLI_EXEC,
            cli_command="qwen",
            timeout_s=300.0,
        )

        # Droid (Terminal - legacy)
        self.providers["droid"] = ProviderConfig(
            name="droid",
            backend_type=BackendType.TERMINAL,
            timeout_s=300.0,
        )

    def get_provider(self, name: str) -> Optional[ProviderConfig]:
        """Get provider configuration by name."""
        return self.providers.get(name)

    def get_enabled_providers(self) -> List[ProviderConfig]:
        """Get list of enabled providers."""
        return [p for p in self.providers.values() if p.enabled]

    def get_db_path(self) -> Path:
        """Get the database path, creating directory if needed."""
        if self.db_path:
            path = Path(self.db_path)
        else:
            path = Path.home() / ".ccb_config" / "gateway.db"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "server": {
                "host": self.host,
                "port": self.port,
            },
            "database": {
                "path": str(self.get_db_path()),
            },
            "timeouts": {
                "default_s": self.default_timeout_s,
                "request_ttl_hours": self.request_ttl_hours,
            },
            "queue": {
                "max_size": self.max_queue_size,
                "max_concurrent": self.max_concurrent_requests,
            },
            "default_provider": self.default_provider,
            "websocket": {
                "enabled": self.ws_enabled,
                "heartbeat_s": self.ws_heartbeat_s,
            },
            "logging": {
                "level": self.log_level,
                "file": self.log_file,
            },
            "providers": {
                name: {
                    "backend_type": p.backend_type.value,
                    "enabled": p.enabled,
                    "priority": p.priority,
                    "timeout_s": p.timeout_s,
                }
                for name, p in self.providers.items()
            },
        }
