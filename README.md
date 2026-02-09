<div align="center">

# 🐝 Hivemind

**Multi-AI Orchestration Platform**

Transform Claude into an intelligent orchestrator managing 10 AI providers with LLM-powered memory, smart routing, and real-time monitoring.

[![Version](https://img.shields.io/badge/version-0.26.0-brightgreen)](https://github.com/LeoLin990405/ai-router-ccb/releases)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Stars](https://img.shields.io/github/stars/LeoLin990405/ai-router-ccb?style=social)](https://github.com/LeoLin990405/ai-router-ccb)

[Quick Start](#-quick-start) • [Features](#-features) • [Architecture](#-architecture) • [API Reference](#-api-reference)

**[🇺🇸 English](README.md) · [🇨🇳 简体中文](README.zh-CN.md)**

---

<img src="screenshots/webui-demo.gif" alt="Hivemind Demo" width="800">

</div>

---

## 🎯 What is Hivemind?

**Hivemind** is a production-grade multi-AI orchestration platform that unifies 10 AI providers under a single Gateway API. Like a hive mind, multiple AI "bees" work together - each with unique strengths - to solve complex problems collaboratively.

### Supported Providers (10)

| Provider | Speed | Specialty | Response Time |
|----------|:-----:|-----------|---------------|
| **Antigravity** | 🚀 | Local Claude 4.5 proxy, unlimited | 3-8s |
| **Kimi** | 🚀 | Chinese, long context (128k) | 7s |
| **Qwen** | 🚀 | Code generation, multilingual | 12s |
| **DeepSeek** | ⚡ | Deep reasoning, algorithms | 16s |
| **iFlow** | ⚡ | Workflow automation | 25s |
| **Codex** | 🐢 | Code review, complex refactoring | 48s |
| **Gemini** | 🐢 | Frontend, multimodal | 71s |
| **Claude** | ⚡ | General tasks | 30s |
| **Qoder** | ⚡ | Programming tasks | 30s |
| **OpenCode** | ⚡ | Multi-model switching | 42s |

### Key Features

- 🧠 **LLM-Powered Memory** - Ollama smart routing (local + cloud) for semantic keyword extraction
- ⚡ **Intelligent Routing** - Speed-tiered fallback chains with automatic retry
- 🏠 **Local Proxy Support** - Antigravity Tools for unlimited Claude 4.5 access
- 📚 **Knowledge Hub** - Unified knowledge base with NotebookLM (254+ notebooks) + Obsidian (local notes) + SQLite cache
- 📊 **Real-time Dashboard** - WebSocket-based monitoring at `http://localhost:8765/web`
- 🔄 **Multi-AI Discussion** - Collaborative problem-solving across providers
- 🎯 **Skills Discovery** - Auto-recommend relevant Claude Code skills

### Why Hivemind?

| Without Hivemind | With Hivemind |
|-----------------|---------------|
| ❌ Multiple CLI interfaces | ✅ One unified Gateway API |
| ❌ Manual provider selection | ✅ Auto-routing based on task type |
| ❌ No memory between sessions | ✅ Dual-system memory (fast + deep) |
| ❌ Context lost every time | ✅ 55 skills + 10 providers embedded |
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
# [SystemContext] Loaded 55 skills, 10 providers, 4 MCP servers
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

Open [http://localhost:8765/web](http://localhost:8765/web) for the real-time monitoring dashboard.

---

## ✨ Features

### 🧠 LLM-Powered Memory with Smart Routing

**Ollama smart routing** for keyword extraction with local/cloud dual-mode:

```
User Query → Local qwen2.5:7b (6s timeout)
                 ↓ success → return keywords
                 ↓ timeout/fail
             Cloud deepseek-v3.1:671b (10s timeout)
                 ↓ success → return keywords
                 ↓ fail
             Regex fallback (instant)
```

**Features:**
- 🏠 **Local-first**: qwen2.5:7b for fast inference (~0.5s hot, ~5s cold)
- ☁️ **Cloud backup**: deepseek-v3.1:671b-cloud (671B params) for complex queries
- 🔄 **Auto-fallback**: Regex extraction when Ollama unavailable
- 📊 **Heuristic retrieval**: Stanford Generative Agents-inspired scoring

### ⚡ Intelligent Routing

**Speed-tiered provider chains** with automatic fallback:

```
🚀 Fast (3-15s):   Kimi → Qwen → DeepSeek
⚡ Medium (15-45s): iFlow → Qoder → OpenCode → Claude
🐢 Slow (45-90s):  Codex → Gemini
```

### 🏠 Antigravity Tools Integration

**Local Claude 4.5 Sonnet proxy** for unlimited API access:

```bash
ccb-cli antigravity "Your question"
ccb-cli antigravity -a sisyphus "Fix this bug"
```

### 🤝 Multi-AI Discussion

**Collaborative problem-solving** across providers:

```bash
ccb-submit discuss \
  --providers kimi,codex,gemini \
  --rounds 3 \
  --strategy "consensus" \
  "Design a scalable microservices architecture"
```

### 📊 Real-time Monitoring

**WebSocket-based dashboard** at [http://localhost:8765/web](http://localhost:8765/web)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Hivemind (v0.25.0)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     LLM-Powered Memory + Ollama Smart Routing        │   │
│  │  • Local: qwen2.5:7b (6s) → Cloud: ds-v3.1 (10s)    │   │
│  │  • Heuristic retrieval (αR + βI + γT)                │   │
│  │  • Dual-system (System 1 + System 2)                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │            Gateway Server Core                        │   │
│  │  • Request Queue (async) • Retry Executor            │   │
│  │  • Cache Manager         • Rate Limiter              │   │
│  │  • Health Checker        • Skills Discovery          │   │
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

### Core Guides

- **[Antigravity Tools Guide](docs/ANTIGRAVITY_TOOLS_GUIDE.md)** - Local Claude 4.5 proxy
- **[Memory Architecture](lib/memory/ARCHITECTURE.md)** - Ollama smart routing design
- **[CC Switch Integration](docs/CC_SWITCH_INTEGRATION.md)** - Provider management
- **[Database Structure](lib/memory/DATABASE_STRUCTURE.md)** - Schema and queries

### Test Reports

- **[Integration Test Report](docs/CCB_TEST_REPORT_2026-02-07_Phase7-13.md)** - Full system test
- **[Issue Tracking](docs/CCB_TEST_ISSUES_2026-02-07.md)** - All issues fixed

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

### Memory Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/memory/sessions` | List memory sessions |
| GET | `/api/memory/search` | Full-text search |
| GET | `/api/memory/stats` | Memory statistics |

### Knowledge Hub Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/knowledge/query` | Query knowledge (auto-routes NotebookLM/Obsidian) |
| POST | `/knowledge/sync` | Sync NotebookLM notebooks to local index |
| GET | `/knowledge/stats` | Knowledge hub statistics |
| GET | `/knowledge/notebooks` | List indexed notebooks |
| GET | `/knowledge/search?q=` | Search notebooks by keyword |
| POST | `/knowledge/create` | Create new NotebookLM notebook |
| POST | `/knowledge/add-source` | Add source (file/URL) to notebook |
| GET | `/knowledge/auth` | Check NotebookLM auth status |

---

## 🗺️ Roadmap

### ✅ v0.25.0 (Current)

- Ollama smart routing (local + cloud dual-mode)
- Full integration testing (all 7 providers verified)
- iFlow CLI fix, Provider configuration improvements
- Architecture documentation update

### ✅ v0.26.0 (Current)

- Knowledge Hub: NotebookLM (254+ notebooks) + Obsidian unified knowledge base
- `ccb-knowledge` CLI with query/sync/search/create/add subcommands
- Gateway API endpoints at `/knowledge/*` (8 endpoints)
- Auto-routing queries to best matching notebook
- SQLite index + query cache for offline access

### 🚀 Upcoming

**v0.27** - Semantic Enhancement
- [ ] Qdrant vector database integration
- [ ] Semantic similarity search

**v0.28** - Agent Autonomy
- [ ] Agent memory function calls (Letta mode)
- [ ] Self-updating agents

---

## 👥 Contributors

<table>
<tr>
<td align="center">
<b>Leo Lin</b><br>
<sub>Project Lead & Developer</sub>
</td>
</tr>
</table>

### 🤖 AI Collaborators

This project was built collaboratively with AI assistants:

| AI | Role | Contributions |
|----|------|---------------|
| **Claude** (Anthropic) | Lead AI Architect | Core architecture, code review, documentation |
| **Kimi** (Moonshot) | Chinese Language Expert | Chinese docs, localization, fast prototyping |
| **DeepSeek** | Reasoning Specialist | Algorithm design, complex debugging |
| **Gemini** (Google) | Frontend Expert | Web UI, multimodal features |
| **Codex** (OpenAI) | Code Specialist | Deep code analysis, refactoring |
| **Qwen** (Alibaba) | Multilingual Coder | Code generation, SQL optimization |
| **iFlow** | Workflow Expert | Automation, integration testing |
| **OpenCode** | Multi-model Bridge | Cross-provider coordination |

> *"Like bees in a hive, each AI brings unique strengths to create something greater than the sum of its parts."*

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
- [Ollama](https://ollama.com) - Local LLM inference

---

<div align="center">

**🐝 Built by humans and AIs, working together as one Hivemind**

[⬆ Back to Top](#-hivemind)

</div>
