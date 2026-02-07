<div align="center">

# 🤖 CCB Gateway

**Enterprise Multi-AI Orchestration Platform**

Transform Claude into an intelligent orchestrator managing 10 AI providers with LLM-powered memory, smart routing, and real-time monitoring.

[![Version](https://img.shields.io/badge/version-0.24.1-brightgreen)](https://github.com/LeoLin990405/ai-router-ccb/releases)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Stars](https://img.shields.io/github/stars/LeoLin990405/ai-router-ccb?style=social)](https://github.com/LeoLin990405/ai-router-ccb)

[Quick Start](#-quick-start) • [Documentation](#-documentation) • [Features](#-features) • [API Reference](#-api-reference)

**[🇺🇸 English](README.md) · [🇨🇳 简体中文](README.zh-CN.md)**

---

<img src="screenshots/webui-demo.gif" alt="CCB Gateway Demo" width="800">

</div>

---

## 🎯 What is CCB Gateway?

CCB Gateway is a **production-grade multi-AI orchestration platform** that unifies 10 AI providers (Kimi, Qwen, DeepSeek, Codex, Gemini, iFlow, Antigravity, OpenCode, Qoder, Claude) under a single Gateway API with:

- 🧠 **LLM-Powered Memory** - Semantic understanding via Ollama + qwen2.5:7b
- ⚡ **Intelligent Routing** - Speed-tiered fallback chains (3-90s response time)
- 🏠 **Local Proxy Support** - Antigravity Tools for unlimited Claude 4.5 access
- 📊 **Real-time Dashboard** - WebSocket-based monitoring at `http://localhost:8765/web`
- 🔄 **Multi-AI Discussion** - Collaborative problem-solving across providers
- 🎯 **Skills Discovery** - Auto-recommend relevant Claude Code skills

### Why CCB Gateway?

| Without CCB Gateway | With CCB Gateway |
|-------------------|-----------------|
| ❌ Multiple CLI interfaces to manage | ✅ One unified Gateway API |
| ❌ Manual provider selection | ✅ Auto-routing based on task type |
| ❌ No memory between sessions | ✅ Dual-system memory (fast + deep) |
| ❌ Context lost every time | ✅ 53 skills + 10 providers embedded |
| ❌ No visibility into operations | ✅ Real-time dashboard with WebSocket |
| ❌ Wasted time on failed requests | ✅ Automatic retry and fallback |

---

## ⚡ Quick Start

### Prerequisites

- Python 3.9+
- Node.js 16+ (for MCP servers)
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/LeoLin990405/ai-router-ccb.git
cd ai-router-ccb

# Install dependencies
pip install -r requirements.txt
npm install

# Configure providers (edit ~/.ccb_config/gateway.yaml or use env vars)
```

### Start Gateway

```bash
python3 -m lib.gateway.gateway_server --port 8765

# Output:
# [SystemContext] Loaded 53 skills, 10 providers, 4 MCP servers
# [MemoryMiddleware] Initialized (enabled=True)
# ✓ Server running at http://localhost:8765
```

### First Request

```bash
# Using ccb-cli (recommended)
ccb-cli kimi "Explain React hooks in 3 sentences"

# Using curl
curl -X POST http://localhost:8765/api/ask \
  -H "Content-Type: application/json" \
  -d '{"provider":"kimi","message":"Explain React hooks","wait":true}'
```

### Access Web UI

Open [http://localhost:8765/web](http://localhost:8765/web) to access the real-time monitoring dashboard.

---

## ✨ Features

### 🧠 Dual-System Memory

**Human-like memory architecture** combining fast automatic capture with deep overnight processing.

<details>
<summary><b>📊 Database-Based Storage (v0.22)</b></summary>

All memory data stored in SQLite (`~/.ccb/ccb_memory.db`) with FTS5 full-text search:

```
~/.ccb/ccb_memory.db
├── session_archives      # System 1: Session context
├── consolidated_memories # System 2: Daily summaries
├── memory_importance     # Heuristic scores
├── memory_access_log     # Access tracking
└── consolidation_log     # System 2 audit trail
```

**Benefits:** ⚡ Faster queries | 🔍 Full-text search | 🔄 Data integrity | 📊 Structured analytics

</details>

<details>
<summary><b>🎯 Heuristic Retrieval (v0.22)</b></summary>

**Stanford Generative Agents-inspired** multi-dimensional scoring:

```
final_score = 0.4 × Relevance + 0.3 × Importance + 0.3 × Recency
```

- **Relevance (40%)**: FTS5 BM25 keyword matching
- **Importance (30%)**: User/LLM-rated importance (0.0-1.0)
- **Recency (30%)**: Ebbinghaus forgetting curve: `exp(-0.1 × hours_since_access)`

**Example:**
```bash
ccb-mem search-scored "authentication" --limit 5
# ID: 123 | Score: 0.82 | R: 0.95 | I: 0.80 | T: 0.65
```

</details>

<details>
<summary><b>🔤 LLM Keyword Extraction (v0.23)</b></summary>

**Semantic understanding** via Ollama + qwen2.5:7b (1-2s local inference):

```python
# Before (Regex) ❌
Query: "购物车功能需要考虑哪些边界情况？"
Keywords: ["购物车功能需要考虑哪些边界情况？"]  # Entire sentence
Result: 0 memories found

# After (LLM) ✅
Query: "购物车功能需要考虑哪些边界情况？"
Keywords: ["购物车功能", "边界情况"]  # Semantic concepts
Result: 3 relevant memories found
```

**Installation:**
```bash
curl -fsSL https://ollama.com/install.sh | sh  # Install Ollama
ollama pull qwen2.5:7b                         # Download model (4.7GB)
```

</details>

**CLI Commands:**
```bash
ccb-mem save                    # Save current session
ccb-mem consolidate --hours 24  # Consolidate recent sessions
ccb-mem search "authentication" # Search memories
ccb-mem search-scored "auth"    # Search with heuristic scores
```

---

### ⚡ Intelligent Routing

**Speed-tiered provider chains** with automatic fallback:

```
🚀 Fast (3-15s):   Kimi → Qwen → DeepSeek
⚡ Medium (15-45s): iFlow → Qoder → OpenCode → Claude
🐢 Slow (45-90s):  Codex → Gemini
```

**Features:**
- 🎯 Smart recommendation based on task keywords
- 🔄 Automatic retry with exponential backoff
- 📉 Fallback chains for resilience
- ⚖️ Load balancing across providers

**Example:**
```bash
ccb-cli kimi "Quick question"           # Fast tier
ccb-cli codex o3 "Complex algorithm"    # Slow tier (deep reasoning)
ccb-cli gemini 3f "React component"     # Frontend task
```

---

### 🏠 Antigravity Tools Integration (v0.24.1)

**Local Claude 4.5 Sonnet proxy** for unlimited API access:

- 🚀 **Ultra-fast**: 3-8s response time (local proxy)
- 🔓 **Unlimited**: No rate limits or token quotas
- 🎯 **Latest model**: Claude 4.5 Sonnet with thinking
- 🔌 **Dual API**: Claude API + OpenAI API compatible
- 🛡️ **Offline capable**: Works without internet

**Quick Start:**
```bash
# Use through Gateway
ccb-cli antigravity "Your question"
ccb-cli antigravity -a sisyphus "Fix this bug"

# Test directly
curl -X POST http://127.0.0.1:8045/v1/messages \
  -H "x-api-key: YOUR_KEY" \
  -d '{"model":"claude-sonnet-4-5-20250929","messages":[...]}'
```

📖 **[Antigravity Tools Guide](docs/ANTIGRAVITY_TOOLS_GUIDE.md)**

---

### 🔀 CC Switch Integration

**Advanced provider management** with failover queue and parallel testing:

```bash
# Provider status
ccb-cc-switch status

# Parallel test all active providers
ccb-cc-switch test "用一句话解释递归"

# Test specific providers
ccb-cc-switch test "Explain recursion" -p "反重力" -p "AiGoCode"
```

**Benefits:**
- ⚡ Fast provider discovery
- 🔍 Quality comparison across providers
- 🛡️ Reliability testing
- 📊 Performance metrics (latency, tokens)

📖 **[CC Switch Integration Guide](docs/CC_SWITCH_INTEGRATION.md)**

---

### 🔍 Skills Discovery

**Auto-discover relevant Claude Code skills** integrated with [Vercel Skills](https://github.com/vercel-labs/skills):

```
User Request → Extract Keywords → Search Skills (Local + Remote)
                                         ↓
                         Inject Recommendations to Context
```

**Example:**
```bash
ccb-cli kimi "help me create a PDF"
# [MemoryMiddleware] 💡 Found 1 relevant Skill: /pdf

ccb-skills recommend "create spreadsheet"
ccb-skills stats
```

---

### 🤝 Multi-AI Discussion

**Collaborative problem-solving** across multiple AI providers:

```bash
ccb-submit discuss \
  --providers kimi,codex,gemini \
  --rounds 3 \
  --strategy "consensus" \
  "Design a scalable microservices architecture"
```

**Aggregation Strategies:**
- **consensus**: All AIs must agree
- **majority**: Most common answer wins
- **first_success**: First valid response
- **best_quality**: Highest scored response

---

### 📊 Real-time Monitoring

**WebSocket-based dashboard** at [http://localhost:8765/web](http://localhost:8765/web):

| Dashboard | Monitor | Memory |
|-----------|---------|--------|
| 📊 Live metrics | 🔴 Real-time logs | 🧠 Session history |
| 🤖 Provider status | ⏱️ Performance data | 🔍 Full-text search |
| 📈 Success rate | 🔔 WebSocket events | 💡 Skills recommendations |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  CCB Gateway (v0.24.1)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     LLM-Powered Memory System (v0.23)                │   │
│  │  • Ollama qwen2.5:7b keyword extraction              │   │
│  │  • Heuristic retrieval (αR + βI + γT)                │   │
│  │  • Dual-system (System 1 + System 2)                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │            Gateway Server Core                        │   │
│  │  • Request Queue (async) • Retry Executor            │   │
│  │  • Cache Manager         • Rate Limiter              │   │
│  │  • Metrics Collector     • Skills Discovery          │   │
│  └───────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌──────┬────────┬───────┼───────┬────────┬─────────────┐   │
│  ▼      ▼        ▼       ▼       ▼        ▼             ▼   │
│ Kimi  Qwen  DeepSeek  Codex  Gemini  Antigravity  ... (10) │
│ 🚀7s  🚀12s   ⚡16s    🐢48s   🐢71s     ⚡4s               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📖 Documentation

### 📘 Core Guides

- **[Antigravity Tools Guide](docs/ANTIGRAVITY_TOOLS_GUIDE.md)** - Local Claude 4.5 proxy setup (v0.24.1)
- **[CC Switch Integration](docs/CC_SWITCH_INTEGRATION.md)** - Provider management (v0.23.1)
- **[Gemini CLI Integration](docs/GEMINI_CLI_INTEGRATION_GUIDE.md)** - Dual-path setup (v0.23.1)
- **[Memory System Architecture](lib/memory/INTEGRATION_DESIGN.md)** - Full design
- **[Database Structure](lib/memory/DATABASE_STRUCTURE.md)** - Schema and queries

### 📊 Test Reports (2026-02-06)

- **[Final Test Report](docs/CCB_FINAL_TEST_REPORT_2026-02-06.md)** - Full integration test
- **[Issue Tracking](docs/CCB_TEST_ISSUES_2026-02-06.md)** - 6 issues fixed (100% rate)
- **[System Test Report](docs/CCB_SYSTEM_TEST_2026-02-07.md)** - Antigravity integration

**Test Summary:**
- ✅ 8/9 Providers passing (89%): Kimi, Qwen, DeepSeek, Gemini, iFlow, OpenCode, Qoder, Codex
- ✅ 6/6 local issues fixed (100% fix rate)
- ✅ 96% module test coverage
- ⏱️ Avg response time: 7-71s (tiered by provider)

---

## 📋 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/providers` | List all 10 providers |
| POST | `/api/ask` | Synchronous request |
| POST | `/api/submit` | Asynchronous request |
| GET | `/api/query/{id}` | Query request status |
| WS | `/ws` | WebSocket connection |

### Memory Endpoints (v0.21+)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/memory/sessions` | List memory sessions |
| GET | `/api/memory/search` | Full-text search |
| POST | `/api/memory/add` | Create observation |
| GET | `/api/memory/request/{id}` | View injection history |

### Skills Endpoints (v0.21+)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills/recommendations` | Get skill recommendations |
| POST | `/api/skills/{name}/feedback` | Submit skill feedback |

### CC Switch Endpoints (v0.23.1+)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cc-switch/status` | Provider status & failover queue |
| POST | `/api/cc-switch/parallel-test` | Run parallel provider test |
| POST | `/api/cc-switch/reload` | Reload providers from database |

**Example Request:**
```json
{
  "provider": "kimi",
  "message": "Your question",
  "model": "thinking",
  "wait": true,
  "timeout": 120
}
```

📖 **[Full API Documentation](docs/API.md)**

---

## 🗺️ Roadmap

### ✅ Recent Releases

**v0.24.1** (Latest) - Antigravity Integration Fixes
- Smart API key detection (env vars + direct keys)
- Production-ready Antigravity Tools support
- All tests passing (API, ccb-cli, CC Switch, Web UI)

**v0.24** - Antigravity Tools Integration
- Local Claude 4.5 Sonnet proxy (3-8s response)
- Unlimited API access, offline capable
- CC Switch failover queue integration

**v0.23.1** - CC Switch & Gemini CLI
- Provider management with failover queue
- Parallel testing across providers
- Gemini CLI dual-path integration (native + Gateway)

**v0.23** - LLM-Powered Memory
- Ollama + qwen2.5:7b keyword extraction
- 95%+ retrieval accuracy (Chinese + English)
- 1-2s local inference, robust fallback

**v0.22** - Heuristic Retrieval
- Stanford Generative Agents-inspired scoring
- Multi-dimensional memory ranking (R+I+T)
- Database migration (Markdown → SQLite)

### 🚀 Upcoming

**v0.25** (Q2 2026) - Semantic Enhancement
- [ ] Qdrant vector database integration
- [ ] Semantic similarity search
- [ ] Multi-language embeddings

**v0.26** (Q3 2026) - Agent Autonomy
- [ ] Agent memory function calls (Letta mode)
- [ ] Self-updating agents
- [ ] Memory version control

**v0.27** (Q4 2026) - Team Collaboration
- [ ] Multi-user memory isolation
- [ ] Shared memory pools
- [ ] Real-time collaboration

---

## 🤝 Contributing

We welcome contributions! See **[CONTRIBUTING.md](CONTRIBUTING.md)** for guidelines.

**Quick Start:**
```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/ai-router-ccb.git

# 2. Create feature branch
git checkout -b feature/your-feature

# 3. Make changes and test
python3 -m pytest tests/

# 4. Commit and push
git commit -m "feat: add your feature"
git push origin feature/your-feature

# 5. Create Pull Request
```

---

## 📜 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

**Inspired by:**
- [Stanford Generative Agents](https://arxiv.org/pdf/2304.03442) - Heuristic retrieval
- [Mem0](https://github.com/mem0ai/mem0) - Semantic memory architecture
- [Letta (MemGPT)](https://github.com/cpacker/MemGPT) - Structured memory blocks

**Built with:**
- [FastAPI](https://fastapi.tiangolo.com) - Modern web framework
- [SQLite](https://www.sqlite.org) - Reliable database
- [Claude Code](https://www.anthropic.com/claude) - AI orchestrator

---

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/LeoLin990405/ai-router-ccb/issues)
- 📖 **Documentation**: [docs/](docs/)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/LeoLin990405/ai-router-ccb/discussions)

---

<div align="center">

**Made with ❤️ by the CCB Team**

[⬆ Back to Top](#-ccb-gateway)

</div>
