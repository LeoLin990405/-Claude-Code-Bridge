"""
HTTP API Backend for CCB Gateway.

Supports OpenAI-compatible APIs (Anthropic, DeepSeek, OpenAI, etc.)
"""
from __future__ import annotations

import asyncio
import os
import time
from typing import Optional, Dict, Any

from .base_backend import BaseBackend, BackendResult
from ..models import GatewayRequest
from ..gateway_config import ProviderConfig


class HTTPBackend(BaseBackend):
    """
    HTTP API backend for providers with REST APIs.

    Supports:
    - Anthropic Claude API
    - DeepSeek API
    - OpenAI API
    - Any OpenAI-compatible API
    """

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self._session = None
        self._api_key: Optional[str] = None

    def _get_api_key(self) -> Optional[str]:
        """Get API key from environment."""
        if self._api_key:
            return self._api_key

        if self.config.api_key_env:
            self._api_key = os.environ.get(self.config.api_key_env)
        return self._api_key

    async def _get_session(self):
        """Get or create aiohttp session."""
        if self._session is None:
            try:
                import aiohttp
                timeout = aiohttp.ClientTimeout(total=self.config.timeout_s)
                self._session = aiohttp.ClientSession(timeout=timeout)
            except ImportError:
                raise ImportError("aiohttp is required for HTTP backend. Install with: pip install aiohttp")
        return self._session

    async def execute(self, request: GatewayRequest) -> BackendResult:
        """Execute request via HTTP API."""
        start_time = time.time()

        api_key = self._get_api_key()
        if not api_key:
            return BackendResult.fail(
                f"API key not found in environment variable: {self.config.api_key_env}",
                latency_ms=(time.time() - start_time) * 1000,
            )

        try:
            # Determine API type and format request
            if "anthropic" in (self.config.api_base_url or "").lower():
                result = await self._execute_anthropic(request, api_key)
            elif "deepseek" in (self.config.api_base_url or "").lower():
                result = await self._execute_openai_compatible(request, api_key)
            else:
                result = await self._execute_openai_compatible(request, api_key)

            result.latency_ms = (time.time() - start_time) * 1000
            return result

        except asyncio.TimeoutError:
            return BackendResult.fail(
                f"Request timed out after {self.config.timeout_s}s",
                latency_ms=(time.time() - start_time) * 1000,
            )
        except Exception as e:
            return BackendResult.fail(
                str(e),
                latency_ms=(time.time() - start_time) * 1000,
            )

    async def _execute_anthropic(
        self,
        request: GatewayRequest,
        api_key: str,
    ) -> BackendResult:
        """Execute request using Anthropic API format."""
        import aiohttp

        session = await self._get_session()
        url = f"{self.config.api_base_url}/messages"

        headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }

        payload = {
            "model": self.config.model or "claude-sonnet-4-20250514",
            "max_tokens": self.config.max_tokens,
            "messages": [
                {"role": "user", "content": request.message}
            ],
        }

        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                return BackendResult.fail(f"API error {resp.status}: {error_text}")

            data = await resp.json()

            # Extract response text
            content = data.get("content", [])
            if content and isinstance(content, list):
                text_parts = [
                    block.get("text", "")
                    for block in content
                    if block.get("type") == "text"
                ]
                response_text = "\n".join(text_parts)
            else:
                response_text = str(content)

            # Extract token usage
            usage = data.get("usage", {})
            tokens_used = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

            return BackendResult.ok(
                response=response_text,
                tokens_used=tokens_used,
                metadata={"model": data.get("model"), "stop_reason": data.get("stop_reason")},
            )

    async def _execute_openai_compatible(
        self,
        request: GatewayRequest,
        api_key: str,
    ) -> BackendResult:
        """Execute request using OpenAI-compatible API format."""
        import aiohttp

        session = await self._get_session()
        url = f"{self.config.api_base_url}/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        payload = {
            "model": self.config.model or "gpt-4",
            "max_tokens": self.config.max_tokens,
            "messages": [
                {"role": "user", "content": request.message}
            ],
        }

        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                return BackendResult.fail(f"API error {resp.status}: {error_text}")

            data = await resp.json()

            # Extract response text
            choices = data.get("choices", [])
            if choices:
                response_text = choices[0].get("message", {}).get("content", "")
            else:
                response_text = ""

            # Extract token usage
            usage = data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)

            return BackendResult.ok(
                response=response_text,
                tokens_used=tokens_used,
                metadata={
                    "model": data.get("model"),
                    "finish_reason": choices[0].get("finish_reason") if choices else None,
                },
            )

    async def health_check(self) -> bool:
        """Check if the API is accessible."""
        api_key = self._get_api_key()
        if not api_key:
            return False

        try:
            # For Anthropic, we can't easily do a health check without making a request
            # For OpenAI-compatible, we could try /models endpoint
            if "anthropic" in (self.config.api_base_url or "").lower():
                # Just check if we have the key configured
                return True

            import aiohttp
            session = await self._get_session()
            url = f"{self.config.api_base_url}/models"
            headers = {"Authorization": f"Bearer {api_key}"}

            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                return resp.status == 200

        except Exception:
            return False

    async def shutdown(self) -> None:
        """Close the HTTP session."""
        if self._session:
            await self._session.close()
            self._session = None
