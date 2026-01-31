<p align="center">
  <img src="https://img.shields.io/badge/AI%20Orchestrator-Multi--AI%20Platform-blue?style=for-the-badge" alt="AI Orchestrator">
  <img src="https://img.shields.io/badge/Providers-9-green?style=for-the-badge" alt="Providers">
  <img src="https://img.shields.io/badge/Gateway-REST%20%2B%20WebSocket-orange?style=for-the-badge" alt="Gateway">
</p>

<h1 align="center">AI Orchestrator</h1>

<p align="center">
  <strong>Enterprise-Grade Multi-AI Orchestration Platform</strong>
  <br>
  <em>Unified Gateway API, intelligent routing, and real-time monitoring for 9 AI providers</em>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-gateway-api">Gateway API</a> •
  <a href="#-monitor">Monitor</a> •
  <a href="#-installation">Installation</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite">
  <img src="https://img.shields.io/badge/WebSocket-010101?logo=socket.io&logoColor=white" alt="WebSocket">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

**English** | [中文](README_zh.md)

---

## 🎯 Overview

**AI Orchestrator** is a production-ready multi-AI orchestration platform that unifies 9 AI providers under a single, intelligent Gateway API. It features automatic task routing, real-time activity monitoring, and a modern REST/WebSocket interface.

### Why AI Orchestrator?

| Challenge | Solution |
|-----------|----------|
| Multiple AI CLIs with different interfaces | **Unified Gateway API** for all providers |
| Manual provider selection | **Intelligent routing** based on task analysis |
| No visibility into AI operations | **Real-time Monitor** with WebSocket events |
| Terminal-dependent communication | **REST API + WebSocket** for decoupled architecture |
| Complex daemon management | **Stateless Gateway** - no daemons required |

---

## ✨ Features

### Gateway API (Core)

| Feature | Description |
|---------|-------------|
| **REST API** | `POST /api/ask`, `GET /api/reply/{id}`, `GET /api/status` |
| **WebSocket** | Real-time events at `/api/ws` |
| **Priority Queue** | Request prioritization with SQLite persistence |
| **Multi-Backend** | HTTP API, CLI Exec, WezTerm integration |
| **Health Monitoring** | Automatic provider health checks and metrics |

### Real-time Monitor

| Feature | Description |
|---------|-------------|
| **Activity Log** | See all requests, CLI commands, and responses |
| **Provider Status** | Live health, latency, and success rates |
| **WebSocket Events** | `request_submitted`, `cli_executing`, `request_completed` |
| **WezTerm Integration** | Launch monitor in a dedicated pane |

### Intelligent Routing

| Feature | Description |
|---------|-------------|
| **9 AI Providers** | Claude, Codex, Gemini, OpenCode, DeepSeek, iFlow, Kimi, Qwen, Droid |
| **Task Analysis** | Keyword and file pattern matching |
| **Magic Keywords** | `@deep`, `@review`, `@all`, `@docs`, `@search` |
| **Unified CLI** | Consistent `*ask` / `*ping` commands |

---

## 🚀 Quick Start

### Start Gateway

```bash
# Start the gateway server
ccb-gateway start

# Check status
ccb-gateway status

# Launch real-time monitor in WezTerm pane
ccb-gateway monitor --pane
```

### Send Requests

```bash
# Via REST API
curl -X POST http://localhost:8765/api/ask \
  -H "Content-Type: application/json" \
  -d '{"provider": "gemini", "message": "Hello"}'

# Get response
curl http://localhost:8765/api/reply/{request_id}?wait=true

# Via CLI commands
cask "your question"   # Codex
gask "your question"   # Gemini
dskask "your question" # DeepSeek
kask "your question"   # Kimi
qask "your question"   # Qwen
```

### Monitor Activity

```bash
# Run monitor in current terminal
ccb-monitor

# Or launch in WezTerm pane
ccb-gateway monitor --pane
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI Orchestrator Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Gateway API Layer                              │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │ │
│  │  │  REST API   │ │  WebSocket  │ │Request Queue│ │ State Store │     │ │
│  │  │ (FastAPI)   │ │  (Events)   │ │ (Priority)  │ │  (SQLite)   │     │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Monitor Service                                │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                     │ │
│  │  │Activity Log │ │Provider Stat│ │ CLI Events  │                     │ │
│  │  │ (Real-time) │ │  (Health)   │ │ (Commands)  │                     │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         Unified Router Engine                          │ │
│  │         Task Analysis → Provider Selection → Fallback Chain            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           Backend Layer                                │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                              │ │
│  │  │ HTTP API │ │ CLI Exec │ │ WezTerm  │                              │ │
│  │  │(Anthropic│ │ (Codex,  │ │ (Gemini) │                              │ │
│  │  │ DeepSeek)│ │ OpenCode)│ │          │                              │ │
│  │  └──────────┘ └──────────┘ └──────────┘                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Provider Layer (9 Providers)                      │ │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌────────┐ ┌────────┐                 │ │
│  │  │Claude │ │ Codex │ │Gemini │ │OpenCode│ │DeepSeek│                 │ │
│  │  └───────┘ └───────┘ └───────┘ └────────┘ └────────┘                 │ │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌────────┐                            │ │
│  │  │ Droid │ │ iFlow │ │ Kimi  │ │  Qwen  │                            │ │
│  │  └───────┘ └───────┘ └───────┘ └────────┘                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌐 Gateway API

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ask` | Submit a request to a provider |
| `GET` | `/api/reply/{request_id}` | Get response (supports `?wait=true`) |
| `GET` | `/api/status` | Get gateway and provider status |
| `DELETE` | `/api/request/{request_id}` | Cancel a pending request |
| `GET` | `/api/health` | Health check |
| `GET` | `/docs` | Interactive API documentation |

### Request Example

```bash
# Submit request
curl -X POST http://localhost:8765/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "message": "Explain async/await in Python",
    "timeout_s": 60,
    "priority": 50
  }'

# Response
{
  "request_id": "abc123-def",
  "provider": "gemini",
  "status": "queued"
}

# Get response (blocking)
curl "http://localhost:8765/api/reply/abc123-def?wait=true&timeout=60"
```

### WebSocket Events

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8765/api/ws');

// Subscribe to events
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['requests', 'providers', 'cli']
}));

// Event types
// - request_submitted: New request with message preview
// - request_processing: Request started processing
// - cli_executing: CLI command being executed
// - request_completed: Success with response preview
// - request_failed: Failure with error message
```

---

## 📊 Monitor

The real-time monitor displays Gateway activity in a terminal UI.

### Features

- **Provider Status**: Health, queue depth, latency, success rate
- **Activity Log**: All requests, CLI commands, and responses
- **WebSocket Events**: Real-time updates via Gateway WebSocket
- **WezTerm Integration**: Launch in a dedicated pane

### Usage

```bash
# Run in current terminal
ccb-monitor

# Launch in WezTerm pane
ccb-gateway monitor --pane

# Custom Gateway URL
ccb-monitor --url http://localhost:8765
```

### Display

```
══════════════════════════════════════════════════════════════════════
  AI Orchestrator Monitor                              Uptime: 5m 23s
══════════════════════════════════════════════════════════════════════

  PROVIDERS
  ──────────────────────────────────────────────────────────────────
  ● gemini       Q: 0  Lat:  2500ms  OK: 95.0%
  ● codex        Q: 0  Lat:  5800ms  OK: 90.0%
  ● deepseek     Q: 1  Lat: 48000ms  OK: 85.0%
  ● kimi         Q: 0  Lat:  5000ms  OK: 92.0%

  STATISTICS
  ──────────────────────────────────────────────────────────────────
  Total:     45  Active:    1  Queue:    1  Processing:   1

  ACTIVITY LOG
  ──────────────────────────────────────────────────────────────────
  [14:23:15] → gemini: Explain async/await in Python...
  [14:23:15] ⚙ gemini processing [abc123-d]
  [14:23:16] $ gemini: gemini -p "Explain async/await..."
  [14:23:18] ✓ gemini (2534ms): Async/await is a pattern...
```

---

## 📦 Providers

### Provider Matrix

| Provider | Command | Backend | Best For | Status |
|----------|---------|---------|----------|--------|
| **Claude** | `lask` | HTTP API | Architecture, general | ✅ |
| **Codex** | `cask` | CLI Exec | Backend, API | ✅ |
| **Gemini** | `gask` | WezTerm¹ | Frontend, review | ✅ |
| **OpenCode** | `oask` | CLI Exec | General coding | ✅ |
| **DeepSeek** | `dskask` | CLI Exec | Deep reasoning | ✅ |
| **iFlow** | `iask` | CLI Exec | Workflow | ✅ |
| **Kimi** | `kask` | CLI Exec | Chinese, long context | ✅ |
| **Qwen** | `qask` | CLI Exec | Multilingual | ✅ |
| **Droid** | `dask` | Terminal | Autonomous | ⚠️ |

¹ Gemini CLI requires TTY; Gateway uses WezTerm pane execution.

### Magic Keywords

| Keyword | Action | Description |
|---------|--------|-------------|
| `@deep` | Deep reasoning | Force DeepSeek provider |
| `@review` | Code review | Force Gemini review mode |
| `@docs` | Documentation | Query Context7 |
| `@search` | Web search | Trigger web search |
| `@all` | Multi-provider | Query multiple providers |

---

## 📁 Project Structure

```
~/.local/share/codex-dual/
├── bin/                        # CLI commands
│   ├── ccb-gateway             # Gateway management
│   ├── ccb-monitor             # Real-time activity monitor
│   ├── ccb-ask                 # Smart routing command
│   ├── ccb-agent               # Agent execution
│   └── cask, gask, dskask...   # Provider-specific commands
│
├── lib/                        # Core modules
│   ├── unified_router.py       # Intelligent routing engine
│   ├── gateway_client.py       # Gateway API client
│   │
│   └── gateway/                # Gateway API module
│       ├── gateway_server.py   # FastAPI server
│       ├── gateway_api.py      # REST endpoints
│       ├── gateway_config.py   # Configuration
│       ├── state_store.py      # SQLite persistence
│       ├── request_queue.py    # Priority queue
│       ├── models.py           # Data models
│       └── backends/           # Backend implementations
│           ├── http_backend.py
│           └── cli_backend.py
│
├── config/                     # Configuration
│   └── gateway.yaml            # Gateway configuration
│
└── install.sh                  # Installation script

~/.ccb_config/                  # User configuration
├── unified-router.yaml         # Routing rules
└── gateway.db                  # Gateway state database
```

---

## 🔧 Installation

### Prerequisites

- **Python 3.9+**
- **WezTerm** (recommended) or tmux
- Provider CLIs: `claude`, `codex`, `gemini`, `opencode`, `deepseek`, `kimi`, `qwen`

### Install

```bash
# Clone repository
git clone https://github.com/LeoLin990405/ai-router-ccb.git ~/.local/share/codex-dual

# Run installation
cd ~/.local/share/codex-dual && ./install.sh

# Add to PATH
export PATH="$HOME/.local/share/codex-dual/bin:$PATH"
```

### Environment Variables

```bash
export CCB_USE_GATEWAY=1            # Enable Gateway mode (default)
export CCB_GATEWAY_PORT=8765        # Gateway port
export CCB_AUTO_OPEN_AUTH=1         # Auto-open auth terminal
export CCB_DEBUG=1                  # Enable debug logging
```

### Verify Installation

```bash
# Start gateway
ccb-gateway start

# Check status
ccb-gateway status

# Launch monitor
ccb-gateway monitor --pane

# Test request
curl -X POST http://localhost:8765/api/ask \
  -H "Content-Type: application/json" \
  -d '{"provider": "codex", "message": "Hello"}'
```

---

## 📊 Performance

### Provider Latency (Typical)

| Provider | Avg Latency | Use Case |
|----------|-------------|----------|
| Gemini | ~2.5s | Fast responses |
| Codex | ~5.8s | Code generation |
| Kimi | ~5.0s | Chinese content |
| Qwen | ~11s | Multilingual |
| OpenCode | ~23s | General coding |
| iFlow | ~40s | Workflow automation |
| DeepSeek | ~48s | Deep reasoning |

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
