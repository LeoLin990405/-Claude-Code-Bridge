<p align="center">
  <img src="https://img.shields.io/github/stars/LeoLin990405/ai-router-ccb?style=social" alt="Stars">
  <img src="https://img.shields.io/github/license/LeoLin990405/ai-router-ccb?color=blue" alt="License">
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
</p>

<h1 align="center">
  <br>
  🤖
  <br>
  CCB Gateway
  <br>
</h1>

<h4 align="center">Enterprise-Grade Multi-AI Orchestration Platform</h4>

<p align="center">
  <em>Claude as orchestrator, unified Gateway API managing 7 AI providers with real-time monitoring</em>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-web-ui">Web UI</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-installation">Installation</a>
</p>

<p align="center">
  <strong>English</strong> | <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img src="screenshots/dashboard.png" alt="CCB Gateway Dashboard" width="800">
</p>

---

## Overview

**CCB Gateway** is a production-ready multi-AI orchestration platform where **Claude serves as the orchestrator**, intelligently dispatching tasks to 7 AI providers through a unified Gateway API.

```
                    ┌─────────────────────────────┐
                    │   Claude (Orchestrator)     │
                    │      Claude Code CLI        │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │      CCB Gateway API        │
                    │    http://localhost:8765    │
                    └─────────────┬───────────────┘
                                  │
          ┌───────────┬───────────┼───────────┬───────────┐
          ▼           ▼           ▼           ▼           ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
     │  Kimi   │ │  Qwen   │ │DeepSeek │ │  Codex  │ │ Gemini  │
     │  🚀 7s  │ │  🚀 12s │ │  ⚡ 16s │ │ 🐢 48s  │ │ 🐢 71s  │
     └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
                      ┌─────────┐ ┌─────────┐
                      │  iFlow  │ │OpenCode │
                      │  ⚡ 25s │ │  ⚡ 42s │
                      └─────────┘ └─────────┘
```

### Why CCB Gateway?

| Challenge | Solution |
|-----------|----------|
| Multiple AI CLIs with different interfaces | **Unified Gateway API** for all providers |
| Manual provider selection | **Intelligent routing** with speed-tiered fallback |
| No visibility into AI operations | **Real-time monitoring** with WebSocket + Web UI |
| No caching or retry logic | **Built-in caching, retry, and fallback chains** |
| Can't see AI thinking process | **Thinking chain & raw output capture** |
| Gemini OAuth token expires | **Auto token refresh** - no manual re-auth needed |

---

## ✨ Features

### Core Gateway

- **REST API** - `POST /api/ask`, `GET /api/reply/{id}`, `GET /api/status`
- **WebSocket** - Real-time events at `/api/ws`
- **Priority Queue** - SQLite-backed request prioritization
- **Multi-Backend** - HTTP API, CLI Exec, WezTerm integration
- **Health Monitoring** - Automatic provider health checks

### Production Features

- **API Authentication** - API key-based auth with SHA-256 hashing
- **Rate Limiting** - Token bucket algorithm, per-key limits
- **Response Caching** - SQLite cache with TTL and pattern exclusion
- **Retry & Fallback** - Exponential backoff, automatic provider fallback
- **Parallel Queries** - Query multiple providers simultaneously
- **Prometheus Metrics** - `/metrics` endpoint for monitoring
- **Streaming** - Server-Sent Events for real-time responses

### CLI Monitoring

- **Thinking Chain Capture** - Extract reasoning from `<thinking>` tags, `[Thinking]` blocks
- **Raw Output Storage** - Full CLI output preserved for debugging
- **JSONL Parsing** - Codex/OpenCode structured output extraction
- **Web UI Display** - Collapsible thinking chain and raw output in request details

### Provider Speed Tiers (New)

| Tier | Providers | Response Time | Best For |
|------|-----------|---------------|----------|
| 🚀 **Fast** | Kimi, Qwen | 5-15s | Quick tasks, simple questions |
| ⚡ **Medium** | DeepSeek, iFlow, OpenCode | 15-60s | Complex reasoning, coding |
| 🐢 **Slow** | Codex, Gemini | 60-120s | Deep analysis, reviews |

### Gemini OAuth Auto-Refresh (New)

- **Automatic Token Refresh** - No manual re-authentication needed
- **Seamless Integration** - Token refreshed before each request if expired
- **Gemini Advanced Support** - Free usage for Google One AI Premium members

---

## 🚀 Quick Start

### Start Gateway

```bash
# Start the gateway server
cd ~/.local/share/codex-dual
python3 -m lib.gateway.gateway_server --port 8765

# Or with config file
python3 -m lib.gateway.gateway_server --config ~/.ccb_config/gateway.yaml
```

### Send Requests

```bash
# Submit request to fast provider
curl -X POST http://localhost:8765/api/ask \
  -H "Content-Type: application/json" \
  -d '{"provider": "kimi", "message": "Hello"}'

# Get response
curl "http://localhost:8765/api/reply/{request_id}"

# Parallel query to all providers
curl -X POST http://localhost:8765/api/ask \
  -H "Content-Type: application/json" \
  -d '{"provider": "@all", "message": "What is 2+2?", "aggregation_strategy": "first_success"}'

# Query fast providers only
curl -X POST http://localhost:8765/api/ask \
  -H "Content-Type: application/json" \
  -d '{"provider": "@fast", "message": "Quick question"}'
```

### Check Status

```bash
# Gateway status with provider latencies
curl http://localhost:8765/api/status

# Prometheus metrics
curl http://localhost:8765/metrics
```

---

## 🖥️ Web UI

Access the Web UI at `http://localhost:8765/` after starting the gateway.

<p align="center">
  <img src="screenshots/dashboard.png" alt="Dashboard" width="800">
  <br>
  <em>Dashboard - Real-time gateway stats and provider status</em>
</p>

### Dashboard
- Real-time gateway stats and provider status
- Request timeline visualization
- Activity logs with WebSocket updates
- **Provider speed indicators** (🚀/⚡/🐢)

### Request Management
- Pagination with configurable page size
- Search and filter by provider, status, content
- Retry failed requests with one click
- **View thinking chain and raw output** for each request

### Test Console
- Interactive API testing
- Provider selection with auto-routing option
- Streaming support toggle

### Compare Mode
- Side-by-side provider comparison
- Query multiple providers simultaneously

### Features
- **Dark/Light Theme** - Toggle with localStorage persistence
- **i18n Support** - English and Chinese localization
- **Keyboard Shortcuts** - `1-6` tabs, `R` refresh, `T` test, `?` help
- **Confirmation Dialogs** - Prevent accidental deletions
- **Copy to Clipboard** - One-click copy for API keys

---

## 📡 API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ask` | Submit a request to a provider |
| `GET` | `/api/reply/{id}` | Get response |
| `GET` | `/api/status` | Gateway and provider status |
| `GET` | `/api/requests` | List recent requests with pagination |
| `DELETE` | `/api/request/{id}` | Cancel a pending request |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/cache/stats` | Cache statistics |
| `DELETE` | `/api/cache` | Clear cache |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/docs` | Interactive API documentation |

### Request Body

```json
{
  "provider": "kimi",
  "message": "Your question here",
  "timeout_s": 120,
  "priority": 50,
  "cache_bypass": false,
  "aggregation_strategy": null
}
```

### Provider Groups

| Group | Providers | Use Case |
|-------|-----------|----------|
| `@all` | All 7 providers | Comprehensive comparison |
| `@fast` | Kimi, Qwen | Quick responses |
| `@chinese` | Kimi, Qwen, DeepSeek | Chinese language tasks |
| `@coding` | Codex, OpenCode, Kimi | Code generation |

### Response (with thinking/raw_output)

```json
{
  "request_id": "abc123-def",
  "status": "completed",
  "response": "The answer is...",
  "thinking": "<extracted thinking chain if available>",
  "raw_output": "<full CLI output for debugging>",
  "latency_ms": 1234.56,
  "cached": false
}
```

### API Authentication

```bash
# Create API key
curl -X POST http://localhost:8765/api/admin/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "rate_limit_rpm": 100}'

# Use API key
curl -X POST http://localhost:8765/api/ask \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"provider": "kimi", "message": "Hello"}'
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CCB Gateway Architecture                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                 Claude (Orchestrator / 主脑)                   │ │
│  │            Intelligent task dispatch and coordination          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      Gateway API Layer                         │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │ │
│  │  │REST API │ │WebSocket│ │  Auth   │ │  Rate   │ │ Metrics │  │ │
│  │  │(FastAPI)│ │(Events) │ │(API Key)│ │ Limit   │ │(Prometh)│  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Processing Layer                           │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │ │
│  │  │  Cache  │ │  Retry  │ │Parallel │ │Streaming│ │Thinking │  │ │
│  │  │(SQLite) │ │(Fallback│ │(Multi-AI│ │  (SSE)  │ │ Extract │  │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              Provider Layer (7 Providers, 3 Tiers)             │ │
│  │                                                                 │ │
│  │  🚀 Fast (5-15s)    ⚡ Medium (15-60s)    🐢 Slow (60-120s)    │ │
│  │  ┌──────┐ ┌──────┐  ┌────────┐ ┌───────┐  ┌───────┐ ┌───────┐ │ │
│  │  │ Kimi │ │ Qwen │  │DeepSeek│ │ iFlow │  │ Codex │ │Gemini │ │ │
│  │  └──────┘ └──────┘  └────────┘ └───────┘  └───────┘ └───────┘ │ │
│  │                     ┌────────┐                                 │ │
│  │                     │OpenCode│                                 │ │
│  │                     └────────┘                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Provider Matrix

| Provider | Tier | Avg Latency | Best For |
|----------|------|-------------|----------|
| **Kimi** | 🚀 Fast | ~7s | Chinese, long context |
| **Qwen** | 🚀 Fast | ~12s | Multilingual, general |
| **DeepSeek** | ⚡ Medium | ~16s | Deep reasoning |
| **iFlow** | ⚡ Medium | ~25s | Workflow automation |
| **OpenCode** | ⚡ Medium | ~42s | General coding |
| **Codex** | 🐢 Slow | ~48s | Code generation |
| **Gemini** | 🐢 Slow | ~71s | Frontend, review |

### Fallback Chains

```yaml
fallback_chains:
  kimi: ["qwen", "deepseek"]
  qwen: ["kimi", "deepseek"]
  deepseek: ["kimi", "qwen"]
  gemini: ["kimi", "qwen"]
  codex: ["kimi", "qwen"]
```

> **Note**: Claude is the orchestrator and does not participate in task dispatch.

---

## 📦 Installation

### Prerequisites

- **Python 3.9+**
- **WezTerm** (recommended) or tmux
- Provider CLIs installed: `codex`, `gemini`, `opencode`, `deepseek`, `kimi`, `qwen`, `iflow`

### Install

```bash
# Clone repository
git clone https://github.com/LeoLin990405/ai-router-ccb.git ~/.local/share/codex-dual

# Install dependencies
pip install fastapi uvicorn pyyaml aiohttp prometheus-client

# Start gateway
cd ~/.local/share/codex-dual
python3 -m lib.gateway.gateway_server --port 8765

# Open Web UI
open http://localhost:8765/
```

### Configuration

```yaml
# ~/.ccb_config/gateway.yaml
server:
  host: "127.0.0.1"
  port: 8765

default_provider: "kimi"  # Fast provider as default

providers:
  kimi:
    enabled: true
    backend_type: "cli_exec"
    cli_command: "kimi"
    cli_args: ["--quiet", "-p"]
    timeout_s: 120
    priority: 90  # High priority for fast provider

  gemini:
    enabled: true
    backend_type: "cli_exec"
    cli_command: "gemini"
    cli_args: ["-p"]  # Non-interactive prompt mode
    timeout_s: 120

retry:
  enabled: true
  max_retries: 2
  fallback_enabled: true
  fallback_chains:
    gemini: ["kimi", "qwen"]
```

### Gemini Setup (OAuth)

For Google One AI Premium / Gemini Advanced members:

```bash
# First-time auth (one-time only)
gemini

# Token auto-refresh is built-in - no manual re-auth needed!
```

---

## 🔄 Recent Updates

### v0.9.x - Provider Optimization (Latest)
- **Provider Speed Tiers** - Fast/Medium/Slow classification
- **Gemini OAuth Auto-Refresh** - Seamless token management
- **Improved Fallback Chains** - Speed-aware fallback
- **Provider Groups** - `@fast`, `@chinese`, `@coding`
- **Reduced Timeouts** - Optimized for faster responses

### v0.8.x - CLI Monitoring
- **Thinking Chain Capture** - Extract and display AI reasoning process
- **Raw Output Storage** - Full CLI output preserved in database
- **Improved Output Cleaning** - Better JSON extraction for Gemini format
- **Web UI Enhancements** - Collapsible thinking/raw output display

### v0.7.x - Production Features
- API Authentication with rate limiting
- Response caching with TTL
- Retry and fallback mechanisms
- Prometheus metrics integration

---

## 🙏 Acknowledgements

- **[bfly123/claude_code_bridge](https://github.com/bfly123/claude_code_bridge)** - Original multi-AI collaboration framework
- **[Grafbase/Nexus](https://github.com/grafbase/nexus)** - AI gateway architecture inspiration

---

## 👥 Contributors

- **Leo** ([@LeoLin990405](https://github.com/LeoLin990405)) - Project Lead
- **Claude** (Anthropic Claude Opus 4.5) - Architecture & Implementation

---

## 📄 License

MIT License - See [LICENSE](LICENSE)

---

<p align="center">
  <sub>Built with collaboration between human and AI</sub>
  <br>
  <sub>⭐ Star this repo if you find it useful!</sub>
</p>
