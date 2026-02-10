<div align="center">

# 🐝 Hivemind

### Multi-AI Orchestration Platform

Unify 10 AI providers behind a single gateway with intelligent routing, shared memory, cross-agent knowledge, and 138 API endpoints.

[![Version](https://img.shields.io/badge/version-1.2.0-blue?style=flat-square)](https://github.com/LeoLin990405/Hivemind/releases)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-2.1-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Tests](https://img.shields.io/badge/tests-195_passed-4cc61e?style=flat-square)]()
[![Endpoints](https://img.shields.io/badge/API-138_endpoints-orange?style=flat-square)]()
[![License](https://img.shields.io/badge/License-AGPL--3.0-purple?style=flat-square)](LICENSE)

**[English](README.md) | [简体中文](README.zh-CN.md)**

[Quick Start](#quick-start) &bull; [Architecture](#architecture) &bull; [Desktop Client](#desktop-client-aionui) &bull; [API Reference](#api-reference) &bull; [CLI Tools](#cli-tools) &bull; [Roadmap](#roadmap)

</div>

---

## What is Hivemind?

Hivemind turns Claude Code into a **multi-AI orchestration hub**. Instead of talking to one AI at a time, you dispatch tasks to whichever provider is best suited — Kimi for Chinese, Codex for code review, Gemini for frontend, DeepSeek for reasoning — all through one unified API with automatic fallback, caching, and memory injection.

```
You ──▶ Claude Code ────────────────────────┐
                                             ├──▶ Hivemind Gateway ──┬──▶ Kimi      (Chinese, fast)
You ──▶ AionUI (Desktop Client) ────────────┘                        ├──▶ Qwen      (code, fast)
                                                                      ├──▶ DeepSeek  (reasoning)
                                                                      ├──▶ Codex     (code review)
                                                                      ├──▶ Gemini    (frontend, multimodal)
                                                                      ├──▶ iFlow     (workflow)
                                                                      ├──▶ OpenCode  (multi-model)
                                                                      ├──▶ Qoder     (coding)
                                                                      ├──▶ Droid     (Android)
                                                                      └──▶ Antigravity (local proxy)
```

### Key Numbers

| Metric | Value |
|--------|-------|
| AI Providers | **10** (9 remote + 1 local) |
| API Endpoints | **138** |
| CLI Tools | **65** |
| Skills Integrations | **68** |
| Test Cases | **195** passing |
| Lines of Code | **52,000+** |

---

## Features

### Intelligent Routing

The smart router automatically picks the best provider for each task based on keyword rules, performance scores, and health status.

```bash
# The router decides: React → Gemini, Algorithm → Codex, Chinese → Kimi
ccb-submit auto "Create a React login form"      # → gemini 3f
ccb-submit auto "Analyze quicksort complexity"    # → codex o3
ccb-submit auto "用中文解释闭包"                    # → kimi
```

12 built-in routing rules with configurable weights. Supports custom rules via API.

### Cross-Agent Shared Knowledge

Agents publish findings to a shared knowledge pool. Any agent can query across **Memory V2 + NotebookLM + Obsidian + Shared Pool** in one call.

```bash
# Publish knowledge
curl -X POST localhost:8765/api/shared-knowledge/publish \
  -d '{"agent_id":"claude","category":"code_pattern","title":"FastAPI middleware","content":"..."}'

# Unified cross-source query
curl "localhost:8765/api/shared-knowledge/query?q=React+hooks&sources=memory,shared,notebooklm"
```

Confidence scoring with vote/citation/time-decay factors. FTS5 trigram search for Chinese text.

### Unified Tool Discovery

A single index covering local skills, MCP tools, MCP servers, and remote skills — with bilingual Chinese-English keyword matching.

```bash
curl "localhost:8765/api/tools/search?q=pdf"       # → pdf skill (score 4.5)
curl "localhost:8765/api/tools/search?q=表格"       # → xlsx skill (score 2.5)
curl "localhost:8765/api/tools/search?q=github+pr"  # → MCP create_pull_request
```

### Memory System

Dual-architecture memory inspired by cognitive science:

- **System 1** — Fast heuristic retrieval with `αR + βI + γT` scoring (relevance, importance, recency)
- **System 2** — Nightly consolidation with LLM-powered summarization
- **Optional vector search** — sentence-transformers embeddings with Qdrant/ChromaDB backends
- **Ebbinghaus decay** — `T = exp(-0.1 × hours)` for natural forgetting

### More

| Feature | Description |
|---------|-------------|
| **Async Pipeline** | Submit → poll → fetch. Non-blocking, parallel multi-AI dispatch |
| **Fallback Chains** | `kimi → qwen → deepseek`. Auto-retry with exponential backoff |
| **Response Cache** | 34%+ hit rate. Per-provider TTL. Save tokens and time |
| **Health Monitoring** | Real-time provider status. Auto-disable unhealthy providers |
| **Multi-AI Discussion** | Structured debates between providers with round-based turns |
| **Cost Tracking** | Per-provider token/cost analytics via Prometheus metrics |
| **Real-time Dashboard** | Web UI at `localhost:8765/web` with live stats |
| **CC Switch** | Hot-swap Claude API endpoints without restart |
| **Knowledge Hub** | 254+ NotebookLM notebooks + Obsidian vault integration |
| **Backpressure** | Load-level monitoring. Reject requests when overloaded |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Hivemind Gateway                           │
│                                                                     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│  │  Smart    │ │  Response │ │  Rate     │ │  Health   │          │
│  │  Router   │ │  Cache    │ │  Limiter  │ │  Checker  │          │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘          │
│        └──────────────┼─────────────┼─────────────┘                │
│                 ┌─────▼─────────────▼─────┐                        │
│                 │     Request Queue        │                        │
│                 └───────────┬──────────────┘                        │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────┐           │
│  │              Backend Executors                       │           │
│  │   CLI Backend  │  HTTP Backend  │  Pipe Backend     │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                     │
│  ┌───────────────────┐  ┌────────────────────┐                     │
│  │  Memory V2        │  │  Shared Knowledge  │                     │
│  │  (System 1 + 2)   │  │  (Cross-Agent)     │                     │
│  │  67 sessions      │  │  FTS5 + Votes      │                     │
│  │  2,582 messages   │  │  + Unified Query    │                     │
│  └───────────────────┘  └────────────────────┘                     │
│                                                                     │
│  ┌───────────────────┐  ┌────────────────────┐                     │
│  │  Knowledge Hub    │  │  Tool Router       │                     │
│  │  254 Notebooks    │  │  68 Skills Indexed │                     │
│  │  Obsidian Vault   │  │  Bilingual Search  │                     │
│  └───────────────────┘  └────────────────────┘                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
        ┌──────────┬───────────┼───────────┬──────────┐
        ▼          ▼           ▼           ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │ Kimi 🚀│ │Qwen  🚀│ │Deep  ⚡│ │Codex 🐢│ │Gemini🐢│
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │iFlow ⚡│ │OCode ⚡│ │Qoder ⚡│ │Droid ⚡│ │Grav  ⚡│
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

### Provider Speed Tiers

| Tier | Providers | Response Time | Best For |
|------|-----------|---------------|----------|
| 🚀 Fast | Kimi, Qwen | 3–15s | Chinese, code generation, quick answers |
| ⚡ Medium | DeepSeek, iFlow, OpenCode, Qoder, Droid | 15–60s | Reasoning, workflows, multi-model |
| 🐢 Slow | Codex, Gemini | 60–180s | Code review, frontend, multimodal |
| 📍 Local | Antigravity | Varies | Local proxy, custom endpoints |

### Database Layout

| Database | Tables | Purpose |
|----------|--------|---------|
| `ccb_memory.db` | 13 + 2 FTS5 | Sessions, messages, observations, skills tracking |
| `gateway.db` | 12 + 1 FTS5 | Requests, responses, discussions, costs, shared knowledge |
| `knowledge_index.db` | 2 | NotebookLM index, query cache |

---

## Desktop Client (AionUI)

Hivemind integrates [AionUI](https://github.com/Aion-Community/AionUI) as a desktop GUI — built with Electron + React 19, with native Hivemind integration.

### Highlights

- **Multi-provider chat** — Choose any of 10 providers directly in chat
- **Streaming responses** — Real-time SSE output through the Hivemind Gateway
- **Provider badges** — Speed tiers (🚀 Fast / ⚡ Medium / 🐢 Slow) with live latency
- **Gateway settings** — Configure Gateway URL, default provider, and streaming toggle
- **Full AionUI capabilities** — Multi-agent conversations, image generation, file management

### Quick Start

```bash
cd AionUi
npm install
npm start          # Dev mode with hot reload
npm run build      # Production build
```

AionUI defaults to `http://localhost:8765`. Ensure Gateway is running first:

```bash
python3 -m lib.gateway.gateway_server --port 8765
```

### Architecture

```
┌──────────────────────────────────────┐
│         AionUI (Electron)            │
│                                      │
│  ┌────────────┐  ┌───────────────┐   │
│  │ React UI   │  │ Hivemind      │   │
│  │ (Renderer) │──│ Agent Plugin  │   │
│  └────────────┘  └───────┬───────┘   │
│                          │           │
│  ┌───────────────────────▼────────┐  │
│  │  HivemindConnection            │  │
│  │  HTTP + SSE Streaming Client   │  │
│  └───────────────────────┬────────┘  │
└──────────────────────────┼───────────┘
                           │ HTTP/SSE
                           ▼
              ┌─────────────────────┐
              │  Hivemind Gateway   │
              │  localhost:8765     │
              └─────────────────────┘
```

### Hivemind Integration Files

| Component | File | Purpose |
|-----------|------|---------|
| Types | `src/agent/hivemind/types.ts` | Provider options, speed tiers, config types |
| Connection | `src/agent/hivemind/HivemindConnection.ts` | Gateway HTTP + SSE client |
| Adapter | `src/agent/hivemind/HivemindAdapter.ts` | Gateway response → AionUI message format |
| Agent | `src/agent/hivemind/index.ts` | HivemindAgent main class |
| Manager | `src/process/task/HivemindAgentManager.ts` | Conversation lifecycle management |
| Chat UI | `src/renderer/.../HivemindChat.tsx` | Chat container component |
| Send Box | `src/renderer/.../HivemindSendBox.tsx` | Input + provider selector |
| Badge | `src/renderer/.../HivemindProviderBadge.tsx` | Provider speed tier badge |
| Routing | `src/renderer/.../HivemindRoutingInfo.tsx` | Routing status indicator |
| Settings | `src/renderer/.../HivemindModalContent.tsx` | Gateway configuration panel |
| Worker | `src/worker/hivemind.ts` | Worker stub |

> **License**: AionUI is licensed under Apache-2.0. See `AionUi/LICENSE` for details.


## Quick Start

### Prerequisites

- Python 3.9+
- At least one AI provider configured (Kimi or Qwen recommended for fastest setup)

### Install

```bash
git clone https://github.com/LeoLin990405/Hivemind.git
cd Hivemind
pip install fastapi uvicorn aiohttp
```

### Start the Gateway

```bash
python3 -m lib.gateway.gateway_server --port 8765
```

### Verify

```bash
# Health check
curl localhost:8765/api/health
# → {"status":"ok"}

# List providers
curl localhost:8765/api/providers
# → 10 providers with priorities

# Smart route a task
curl -X POST "localhost:8765/api/route?message=write+a+Python+script"
# → {"provider":"qwen","confidence":0.45,"rule_description":"Python and scripting"}
```

### Send your first request

```bash
# Async (recommended)
ccb-submit kimi "What is a closure in JavaScript?"
# → Returns request_id instantly

# Check result
ccb-query get <request_id>

# Sync (fast providers only)
ccb-cli kimi "1+1=?"
```

---

## API Reference

**Base URL:** `http://localhost:8765`

### Core

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ask` | Send request to a provider |
| POST | `/api/ask/stream` | SSE streaming response |
| POST | `/api/route` | Get routing recommendation |
| GET | `/api/route/rules` | List routing rules |
| GET | `/api/router/config` | Router configuration |
| GET | `/api/router/scores` | Provider performance scores |
| GET | `/api/providers` | List all providers |
| GET | `/api/status` | Gateway status |
| GET | `/api/health` | Health check |

### Shared Knowledge (v1.1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shared-knowledge/publish` | Publish knowledge entry |
| GET | `/api/shared-knowledge/query?q=` | Unified cross-source query |
| POST | `/api/shared-knowledge/vote` | Vote on entry (agree/disagree/cite) |
| GET | `/api/shared-knowledge/feed` | Browse entries |
| GET | `/api/shared-knowledge/stats` | Knowledge statistics |
| DELETE | `/api/shared-knowledge/{id}` | Delete entry |

### Tool Router (v1.1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tools/search?q=` | Search tools (bilingual) |
| GET | `/api/tools/index` | Index statistics |
| POST | `/api/tools/rebuild` | Rebuild index |
| GET | `/api/tools` | List all tools |

### Memory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/memory/search?query=` | Search conversations |
| GET | `/api/memory/sessions` | List sessions |
| GET | `/api/memory/stats` | Memory statistics |
| POST | `/api/memory/add` | Add observation |
| GET | `/api/memory/observations` | List observations |

### More Endpoints

| Category | Count | Prefix |
|----------|-------|--------|
| Batch Operations | 5 | `/api/batch/*` |
| Discussions | 12 | `/api/discussion/*` |
| Admin | 9 | `/api/admin/*` |
| Cache | 4 | `/api/cache/*` |
| Costs | 5 | `/api/costs/*` |
| Health Checker | 5 | `/api/health-checker/*` |
| Export | 3 | `/api/export/*` |
| Knowledge Hub | 8 | `/knowledge/*` |
| Streaming | 5 | `/api/stream/*` |
| CC Switch | 4 | `/api/cc-switch/*` |
| Runtime | 8 | Various |
| Metrics | 1 | `/metrics` (Prometheus) |
| Web UI | 2 | `/web` |

**Full OpenAPI docs:** `http://localhost:8765/docs`

---

## CLI Tools

### Primary Commands

```bash
ccb-submit <provider> "message"    # Async submit (recommended)
ccb-query get <id>                 # Fetch completed result
ccb-query status <id>              # Check request status
ccb-cli <provider> "message"       # Sync call (fast providers)
ccb-poll <id1> <id2> ...           # Poll multiple requests
```

### Provider Shortcuts

Each provider has `ask` / `pend` / `ping` shortcuts:

| Provider | Ask | Pend | Ping |
|----------|-----|------|------|
| Kimi | `kask` | `kpend` | `kping` |
| Qwen | `qask` | `qpend` | `qping` |
| DeepSeek | `dask` | `dpend` | `dping` |
| Gemini | `gask` | `gpend` | `gping` |
| Codex | `cask` | `cpend` | `cping` |
| OpenCode | `oask` | `opend` | `oping` |
| iFlow | `iask` | `ipend` | `iping` |

### Management

```bash
ccb-gateway                    # Start/manage gateway
ccb-monitor                    # Real-time monitoring
ccb-stats                      # Usage statistics
ccb-cache                      # Cache management
ccb-cc-switch                  # Switch Claude endpoints
ccb-mem                        # Memory operations
ccb-knowledge                  # Knowledge hub CLI
```

### Model Shortcuts

```bash
ccb-cli codex o3 "..."         # Codex with o3 (deep reasoning)
ccb-cli codex o4-mini "..."    # Codex with o4-mini (fast)
ccb-cli codex gpt-4o "..."     # Codex with GPT-4o (multimodal)
ccb-cli gemini 3f "..."        # Gemini 3 Flash
ccb-cli gemini 3p "..."        # Gemini 3 Pro
ccb-cli deepseek reasoner "."  # DeepSeek R1
ccb-cli kimi thinking "..."    # Kimi with chain-of-thought
```

---

## Project Structure

```
Hivemind/
├── AionUi/                    # Desktop client (Electron + React 19)
│   ├── src/
│   │   ├── agent/hivemind/    # Hivemind Gateway client
│   │   ├── renderer/          # React UI with Hivemind components
│   │   └── process/           # Process management
│   ├── package.json
│   └── forge.config.ts
├── bin/                        # 65 CLI tools
├── lib/
│   ├── common/                 # Shared utilities (logging, errors, auth)
│   ├── gateway/
│   │   ├── app.py              # FastAPI app factory
│   │   ├── router.py           # Smart routing engine
│   │   ├── routes/             # 19 route modules (138 endpoints)
│   │   ├── middleware/         # Memory injection middleware
│   │   ├── backends/           # CLI, HTTP, pipe executors
│   │   └── ...
│   ├── memory/                 # Memory V2 (System 1 + 2)
│   ├── knowledge/              # NotebookLM + Obsidian + Shared Knowledge
│   ├── providers/              # 10 provider adapters + BaseCommReader
│   └── skills/                 # Skills discovery + Tool index
├── tests/                      # 195 test cases
├── docs/                       # Architecture & roadmap docs
├── mcp/                        # MCP server integrations
└── screenshots/                # Demo assets
```

---

## Roadmap

| Version | Status | Highlights |
|---------|--------|------------|
| v0.26 | ✅ Done | Knowledge Hub, 10 providers, Web UI |
| v1.0 | ✅ Done | Modular refactoring, 19 route modules, BaseCommReader |
| v1.1 | ✅ Done | Shared knowledge, tool router, unified query |
| **v1.2** | **✅ Current** | **AionUI desktop client, Hivemind agent integration, DB schema v13** |
| v1.3 | Planned | Vector semantic search, jieba segmentation |

---

## Contributing

Hivemind is built collaboratively by humans and AI. Contributions are welcome.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Run tests (`python3 -m pytest tests/ -x -q`)
4. Commit and push
5. Open a Pull Request

---

## AI Collaborators

This project was built with contributions from multiple AI systems:

| AI | Role | Contributions |
|----|------|---------------|
| **Claude** | Architect & Orchestrator | Core design, memory system, testing, documentation |
| **Codex** | Code Engineer | v1.0 refactoring, v1.1 implementation, v1.2 AionUI integration |
| **Kimi** | Chinese Specialist | Chinese NLP, Ollama integration, i18n |
| **DeepSeek** | Reasoning Engine | Algorithm design, scoring formulas |
| **Gemini** | Frontend & Analysis | Web UI, multimodal analysis |
| **Qwen** | Code Generator | Provider adapters, CLI tools |

---

## License

[AGPL-3.0](LICENSE) — Free to use, modify, and distribute. Network use requires source disclosure.

---

<div align="center">

**[Documentation](docs/)** &bull; **[API Docs](http://localhost:8765/docs)** &bull; **[Web Dashboard](http://localhost:8765/web)** &bull; **[Issues](https://github.com/LeoLin990405/Hivemind/issues)**

Built with multiple AI minds working as one.

</div>
