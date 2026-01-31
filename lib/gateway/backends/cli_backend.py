"""
CLI Execution Backend for CCB Gateway.

Executes AI CLI tools as subprocesses (Codex, Gemini CLI, etc.)
"""
from __future__ import annotations

import asyncio
import os
import shutil
import time
from typing import Optional, List

from .base_backend import BaseBackend, BackendResult
from ..models import GatewayRequest
from ..gateway_config import ProviderConfig


class CLIBackend(BaseBackend):
    """
    CLI execution backend for command-line AI tools.

    Supports:
    - Codex CLI
    - Gemini CLI
    - OpenCode
    - iFlow
    - Kimi
    - Qwen
    - Any CLI tool that accepts input via stdin or arguments
    """

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self._cli_path: Optional[str] = None

    def _find_cli(self) -> Optional[str]:
        """Find the CLI executable."""
        if self._cli_path:
            return self._cli_path

        cmd = self.config.cli_command
        if not cmd:
            return None

        # Check if it's an absolute path
        if os.path.isabs(cmd) and os.path.isfile(cmd):
            self._cli_path = cmd
            return self._cli_path

        # Search in PATH
        self._cli_path = shutil.which(cmd)
        return self._cli_path

    def _build_command(self, message: str) -> List[str]:
        """Build the command line arguments."""
        cli = self._find_cli()
        if not cli:
            raise ValueError(f"CLI command not found: {self.config.cli_command}")

        cmd = [cli]

        # Add configured arguments
        if self.config.cli_args:
            cmd.extend(self.config.cli_args)

        # Add the message as the final argument
        # Most CLI tools accept the prompt as the last argument
        cmd.append(message)

        return cmd

    async def execute(self, request: GatewayRequest) -> BackendResult:
        """Execute request via CLI subprocess."""
        start_time = time.time()

        cli = self._find_cli()
        if not cli:
            return BackendResult.fail(
                f"CLI command not found: {self.config.cli_command}",
                latency_ms=(time.time() - start_time) * 1000,
            )

        try:
            cmd = self._build_command(request.message)

            # Create subprocess
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.PIPE,
            )

            # Wait for completion with timeout
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=request.timeout_s or self.config.timeout_s,
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return BackendResult.fail(
                    f"CLI command timed out after {request.timeout_s}s",
                    latency_ms=(time.time() - start_time) * 1000,
                )

            latency_ms = (time.time() - start_time) * 1000

            # Check return code
            if process.returncode != 0:
                error_msg = stderr.decode("utf-8", errors="replace").strip()
                if not error_msg:
                    error_msg = f"CLI exited with code {process.returncode}"
                return BackendResult.fail(error_msg, latency_ms=latency_ms)

            # Parse output
            response_text = stdout.decode("utf-8", errors="replace").strip()

            # Try to extract just the response if there's metadata
            response_text = self._clean_output(response_text)

            return BackendResult.ok(
                response=response_text,
                latency_ms=latency_ms,
                metadata={"exit_code": process.returncode},
            )

        except Exception as e:
            return BackendResult.fail(
                str(e),
                latency_ms=(time.time() - start_time) * 1000,
            )

    def _clean_output(self, output: str) -> str:
        """Clean CLI output to extract just the response."""
        # Remove common CLI prefixes/suffixes
        lines = output.split("\n")
        cleaned_lines = []

        for line in lines:
            # Skip common status lines
            if any(skip in line.lower() for skip in [
                "loading",
                "initializing",
                "connecting",
                "thinking...",
                "processing...",
            ]):
                continue
            cleaned_lines.append(line)

        return "\n".join(cleaned_lines).strip()

    async def health_check(self) -> bool:
        """Check if the CLI is available."""
        cli = self._find_cli()
        if not cli:
            return False

        try:
            # Try to run with --version or --help to check if it works
            process = await asyncio.create_subprocess_exec(
                cli, "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                await asyncio.wait_for(process.communicate(), timeout=5.0)
            except asyncio.TimeoutError:
                process.kill()
                return False

            # Some CLIs don't support --version, so we accept any exit code
            # as long as the process ran
            return True

        except Exception:
            return False

    async def shutdown(self) -> None:
        """No cleanup needed for CLI backend."""
        pass


class InteractiveCLIBackend(CLIBackend):
    """
    Backend for interactive CLI tools that maintain a session.

    This is useful for tools like Codex that can maintain context
    across multiple requests.
    """

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self._process: Optional[asyncio.subprocess.Process] = None
        self._lock = asyncio.Lock()

    async def _ensure_process(self) -> asyncio.subprocess.Process:
        """Ensure the interactive process is running."""
        if self._process is None or self._process.returncode is not None:
            cli = self._find_cli()
            if not cli:
                raise ValueError(f"CLI command not found: {self.config.cli_command}")

            cmd = [cli]
            if self.config.cli_args:
                cmd.extend(self.config.cli_args)

            self._process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.PIPE,
            )

        return self._process

    async def execute(self, request: GatewayRequest) -> BackendResult:
        """Execute request via interactive CLI session."""
        start_time = time.time()

        async with self._lock:
            try:
                process = await self._ensure_process()

                # Send message to stdin
                message = request.message + "\n"
                process.stdin.write(message.encode("utf-8"))
                await process.stdin.drain()

                # Read response (this is tricky for interactive CLIs)
                # We need to detect when the response is complete
                response_lines = []
                timeout = request.timeout_s or self.config.timeout_s

                try:
                    while True:
                        line = await asyncio.wait_for(
                            process.stdout.readline(),
                            timeout=timeout,
                        )
                        if not line:
                            break

                        decoded = line.decode("utf-8", errors="replace").rstrip()
                        response_lines.append(decoded)

                        # Check for end-of-response markers
                        if self._is_response_complete(decoded):
                            break

                except asyncio.TimeoutError:
                    pass

                latency_ms = (time.time() - start_time) * 1000
                response_text = "\n".join(response_lines)

                return BackendResult.ok(
                    response=self._clean_output(response_text),
                    latency_ms=latency_ms,
                )

            except Exception as e:
                return BackendResult.fail(
                    str(e),
                    latency_ms=(time.time() - start_time) * 1000,
                )

    def _is_response_complete(self, line: str) -> bool:
        """Check if the response is complete based on the line content."""
        # Override in subclasses for specific CLI tools
        # Common patterns: prompt characters, empty lines after content
        return line.endswith("> ") or line.endswith(">>> ")

    async def shutdown(self) -> None:
        """Terminate the interactive process."""
        if self._process and self._process.returncode is None:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self._process.kill()
            self._process = None
