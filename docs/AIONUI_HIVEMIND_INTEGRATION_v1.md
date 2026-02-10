# AionUI × Hivemind Integration Guide — Plan A

**Version**: 1.0
**Date**: 2026-02-10
**Author**: Claude (Architect)
**Implementer**: Codex
**Scope**: Lightweight Integration — AionUI as Hivemind Client

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Phase 1: Project Setup](#4-phase-1-project-setup)
5. [Phase 2: Hivemind Agent Core](#5-phase-2-hivemind-agent-core)
6. [Phase 3: Agent Manager & Worker](#6-phase-3-agent-manager--worker)
7. [Phase 4: IPC Bridge Integration](#7-phase-4-ipc-bridge-integration)
8. [Phase 5: Renderer UI](#8-phase-5-renderer-ui)
9. [Phase 6: WebSocket Real-Time Events](#9-phase-6-websocket-real-time-events)
10. [Phase 7: Settings Page](#10-phase-7-settings-page)
11. [Phase 8: Testing & Verification](#11-phase-8-testing--verification)
12. [API Reference](#12-api-reference)
13. [File Manifest](#13-file-manifest)

---

## 1. Overview

### Goal

Add a `hivemind` agent type to AionUI that routes all AI requests through Hivemind Gateway (`http://localhost:8765`), instead of directly calling individual AI providers. This gives AionUI access to Hivemind's:

- **Smart routing** — auto-select best provider per task
- **10 AI providers** — Kimi, Qwen, DeepSeek, Codex, Gemini, iFlow, OpenCode, Qoder, Droid, Antigravity
- **Response caching** — 34%+ hit rate
- **Memory injection** — conversation context from Memory V2
- **Fallback chains** — automatic retry with provider degradation
- **Cost tracking** — per-provider token/cost analytics
- **Shared knowledge** — cross-agent knowledge pool

### What We're NOT Doing (Plan A scope)

- NOT modifying AionUI's existing agent types (gemini, acp, codex, openclaw)
- NOT adding Hivemind-specific dashboard pages (that's Plan B)
- NOT syncing AionUI's SQLite to Hivemind Memory (that's Plan B)
- NOT forking/customizing AionUI core (that's Plan C)

### Integration Pattern

Follow the same pattern as `codex` agent — **in-process** (not forked worker), HTTP-based communication via REST + SSE + WebSocket.

```
AionUI Renderer ─── IPC ───► HivemindAgentManager (Main Process)
                                    │
                                    ▼
                              HivemindAgent
                              ┌─────────────┐
                              │ POST /api/ask│──► Hivemind Gateway ──► Best Provider
                              │ SSE stream   │◄── (:8765)
                              │ WS /api/ws   │◄── Real-time events
                              └─────────────┘
```

---

## 2. Architecture

### AionUI's Agent Architecture (Current)

```
AgentType = 'gemini' | 'acp' | 'codex' | 'openclaw-gateway'

Renderer (React)
    │
    │ IPC: conversation.sendMessage
    ▼
Main Process
    │
    ├─► GeminiAgentManager ─── fork ──► GeminiAgent (worker process)
    ├─► AcpAgentManager ────── fork ──► AcpAgent (worker process)
    ├─► CodexAgentManager ──── in-process ──► CodexAgent (MCP/JSON-RPC)
    └─► OpenClawAgentManager ─ in-process ──► OpenClawGateway (WebSocket)
```

### After Integration

```
AgentType = 'gemini' | 'acp' | 'codex' | 'openclaw-gateway' | 'hivemind'

New addition:
    └─► HivemindAgentManager ─ in-process ──► HivemindAgent (HTTP/SSE/WS)
```

### Message Flow

```
1. User types message in AionUI chat
2. Renderer calls conversation.sendMessage({ conversation_id, content })
3. IPC → Main Process → WorkerManage → HivemindAgentManager.sendMessage()
4. HivemindAgentManager → HivemindAgent.send(message)
5. HivemindAgent sends POST /api/ask/stream to Gateway
6. Gateway routes to best provider (or user-specified provider)
7. SSE chunks arrive → HivemindAdapter converts to TMessage
8. HivemindAgentManager emits via IPC: conversation.responseStream
9. Renderer updates chat with streaming response
```

---

## 3. Prerequisites

### Hivemind Gateway

The Gateway must be running at `http://localhost:8765` (configurable).

```bash
cd ~/.local/share/codex-dual
python3 -m lib.gateway.gateway_server --port 8765
```

Verify: `curl http://localhost:8765/api/health` → `{"status":"ok"}`

### AionUI Dev Environment

```bash
git clone https://github.com/iOfficeAI/AionUi.git
cd AionUi
npm install  # or bun install
npm start    # Electron dev mode
```

### Key AionUI Dependencies (already installed)

- `node-fetch` or native `fetch` (Node 18+)
- `eventsource` (for SSE) — may need to add
- `ws` (already in deps for WebSocket)

---

## 4. Phase 1: Project Setup

### 4.1 Add SSE dependency (if needed)

```bash
npm install eventsource
npm install -D @types/eventsource
```

> **Note**: If AionUI uses Node 18+ with native `fetch`, we can use `fetch` with `ReadableStream` for SSE instead.

### 4.2 Register Hivemind Agent Type

**File: `src/types/acpTypes.ts`**

Add `'hivemind'` to the `AcpBackendAll` union type:

```typescript
export type AcpBackendAll =
  | 'claude' | 'gemini' | 'qwen' | 'iflow' | 'codex'
  | 'droid' | 'goose' | 'auggie' | 'kimi' | 'opencode'
  | 'copilot' | 'qoder' | 'openclaw-gateway' | 'custom'
  | 'hivemind';  // ← ADD THIS
```

**Do NOT add to `ACP_BACKENDS_ALL`** — Hivemind is not an ACP-protocol agent. It gets its own agent type.

### 4.3 Add Hivemind to Conversation Type Registry

**File: `src/process/database/schema.ts`**

Find the `type` column definition for `conversations` table. Ensure `'hivemind'` is an acceptable value. The column is likely `TEXT` so no schema change needed, but verify.

### 4.4 Directory Structure

Create these directories/files:

```
src/
├── agent/
│   └── hivemind/                    # NEW DIRECTORY
│       ├── index.ts                 # HivemindAgent class
│       ├── HivemindConnection.ts    # HTTP/SSE/WS client
│       ├── HivemindAdapter.ts       # Response → TMessage converter
│       └── types.ts                 # Hivemind-specific types
├── process/
│   └── task/
│       └── HivemindAgentManager.ts  # NEW FILE
├── worker/
│   └── hivemind.ts                  # NEW FILE (stub, runs in-process)
└── renderer/
    └── pages/
        ├── conversation/
        │   └── hivemind/            # NEW DIRECTORY
        │       ├── HivemindChat.tsx          # Chat view
        │       ├── HivemindProviderBadge.tsx  # Provider indicator
        │       └── HivemindRoutingInfo.tsx    # Routing decision display
        └── settings/
            └── HivemindSettings.tsx  # NEW FILE
```

---

## 5. Phase 2: Hivemind Agent Core

### 5.1 Types (`src/agent/hivemind/types.ts`)

```typescript
// ===== Hivemind Gateway Types =====

export interface HivemindConfig {
  /** Gateway base URL, default http://localhost:8765 */
  gatewayUrl: string;
  /** Default provider, null for auto-routing */
  defaultProvider: string | null;
  /** Request timeout in seconds */
  timeoutS: number;
  /** Whether to use streaming (SSE) */
  streaming: boolean;
  /** Agent role for memory injection */
  agent: string | null;
  /** Bypass cache */
  cacheBypass: boolean;
}

export const DEFAULT_HIVEMIND_CONFIG: HivemindConfig = {
  gatewayUrl: 'http://localhost:8765',
  defaultProvider: null,  // auto-route
  timeoutS: 300,
  streaming: true,
  agent: null,
  cacheBypass: false,
};

// --- Gateway API Types ---

export interface AskRequest {
  message: string;
  provider?: string | null;
  timeout_s?: number;
  priority?: number;
  cache_bypass?: boolean;
  aggregation_strategy?: string | null;
  agent?: string | null;
}

export interface AskResponse {
  request_id: string;
  provider: string;
  status: string;
  cached: boolean;
  parallel: boolean;
  agent: string | null;
  // Extra fields when wait=true
  response?: string | null;
  error?: string | null;
  latency_ms?: number | null;
  retry_info?: Record<string, unknown> | null;
  thinking?: string | null;
  raw_output?: string | null;
}

export interface StreamChunk {
  request_id: string;
  content: string;
  chunk_index: number;
  is_final: boolean;
  tokens_used: number | null;
  provider: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ReplyResponse {
  request_id: string;
  status: string;
  response: string | null;
  error: string | null;
  latency_ms: number | null;
  cached: boolean;
  retry_info: Record<string, unknown> | null;
  thinking: string | null;
  raw_output: string | null;
}

export interface ProviderInfo {
  name: string;
  backend_type: string;
  enabled: boolean;
  priority: number;
  timeout_s: number;
  supports_streaming: boolean;
}

export interface GatewayStatus {
  gateway: {
    uptime_s: number;
    total_requests: number;
    active_requests: number;
    queue_depth: number;
    processing_count: number;
    cache: {
      hits: number;
      misses: number;
      hit_rate: number;
      total_entries: number;
      expired_entries: number;
      total_tokens_saved: number;
    } | null;
    features: {
      retry_enabled: boolean;
      cache_enabled: boolean;
      streaming_enabled: boolean;
      parallel_enabled: boolean;
    };
  };
  providers: Array<{
    name: string;
    enabled: boolean;
    status: string;
    queue_depth: number;
    avg_latency_ms: number;
    success_rate: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost_usd: number;
    total_requests: number;
    last_check: number | null;
    last_error: string | null;
  }>;
}

export interface RouteRecommendation {
  provider: string;
  model: string | null;
  confidence: number;
  matched_keywords: string[];
  rule_description: string;
}

export interface WebSocketEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// Provider speed tiers for UI display
export const PROVIDER_TIERS: Record<string, { emoji: string; label: string; color: string }> = {
  kimi:     { emoji: '🚀', label: 'Fast',   color: '#52c41a' },
  qwen:     { emoji: '🚀', label: 'Fast',   color: '#52c41a' },
  deepseek: { emoji: '⚡', label: 'Medium', color: '#faad14' },
  iflow:    { emoji: '⚡', label: 'Medium', color: '#faad14' },
  opencode: { emoji: '⚡', label: 'Medium', color: '#faad14' },
  qoder:    { emoji: '⚡', label: 'Medium', color: '#faad14' },
  droid:    { emoji: '⚡', label: 'Medium', color: '#faad14' },
  codex:    { emoji: '🐢', label: 'Slow',   color: '#ff4d4f' },
  gemini:   { emoji: '🐢', label: 'Slow',   color: '#ff4d4f' },
  antigravity: { emoji: '📍', label: 'Local', color: '#1890ff' },
};
```

### 5.2 Connection (`src/agent/hivemind/HivemindConnection.ts`)

```typescript
import { EventEmitter } from 'events';
import type {
  HivemindConfig,
  AskRequest,
  AskResponse,
  StreamChunk,
  ReplyResponse,
  ProviderInfo,
  GatewayStatus,
  RouteRecommendation,
  WebSocketEvent,
} from './types';

/**
 * HTTP + SSE + WebSocket client for Hivemind Gateway.
 *
 * Lifecycle:
 *   const conn = new HivemindConnection(config);
 *   await conn.checkHealth();        // verify gateway is reachable
 *   conn.connectWebSocket();         // optional: real-time events
 *   const response = await conn.ask(message);  // sync request
 *   // or
 *   conn.askStream(message, onChunk, onDone, onError);  // streaming
 */
export class HivemindConnection extends EventEmitter {
  private config: HivemindConfig;
  private ws: WebSocket | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

  constructor(config: HivemindConfig) {
    super();
    this.config = config;
  }

  // ---------- Health ----------

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.gatewayUrl}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  // ---------- Providers ----------

  async getProviders(): Promise<ProviderInfo[]> {
    const res = await fetch(`${this.config.gatewayUrl}/api/providers`);
    if (!res.ok) throw new Error(`Failed to get providers: ${res.status}`);
    return res.json();
  }

  async getStatus(): Promise<GatewayStatus> {
    const res = await fetch(`${this.config.gatewayUrl}/api/status`);
    if (!res.ok) throw new Error(`Failed to get status: ${res.status}`);
    return res.json();
  }

  async getRouteRecommendation(message: string): Promise<RouteRecommendation> {
    const res = await fetch(
      `${this.config.gatewayUrl}/api/route?message=${encodeURIComponent(message)}`,
      { method: 'POST' }
    );
    if (!res.ok) throw new Error(`Routing failed: ${res.status}`);
    return res.json();
  }

  // ---------- Synchronous Ask ----------

  async ask(message: string, provider?: string | null): Promise<AskResponse> {
    const body: AskRequest = {
      message,
      provider: provider ?? this.config.defaultProvider,
      timeout_s: this.config.timeoutS,
      cache_bypass: this.config.cacheBypass,
      agent: this.config.agent,
    };

    const res = await fetch(
      `${this.config.gatewayUrl}/api/ask?wait=true&timeout=${this.config.timeoutS}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Ask failed: ${res.status}`);
    }

    return res.json();
  }

  // ---------- Streaming Ask (SSE) ----------

  /**
   * Send a message and stream the response via SSE.
   * Returns the full accumulated response text when done.
   */
  async askStream(
    message: string,
    onChunk: (chunk: StreamChunk) => void,
    onDone: (fullResponse: string, provider: string) => void,
    onError: (error: Error) => void,
    provider?: string | null,
  ): Promise<void> {
    // Abort any previous stream
    this.abortController?.abort();
    this.abortController = new AbortController();

    const body: AskRequest = {
      message,
      provider: provider ?? this.config.defaultProvider,
      timeout_s: this.config.timeoutS,
      cache_bypass: this.config.cacheBypass,
      agent: this.config.agent,
    };

    try {
      const res = await fetch(`${this.config.gatewayUrl}/api/ask/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Stream failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let lastProvider = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const chunk: StreamChunk = JSON.parse(jsonStr);
            fullResponse += chunk.content;
            if (chunk.provider) lastProvider = chunk.provider;
            onChunk(chunk);

            if (chunk.is_final) {
              onDone(fullResponse, lastProvider);
              return;
            }
          } catch (parseErr) {
            // Try parsing as error event
            try {
              const errData = JSON.parse(jsonStr);
              if (errData.type === 'error') {
                onError(new Error(errData.error));
                return;
              }
            } catch {
              // Ignore unparseable lines
            }
          }
        }
      }

      // If we get here without is_final, still call onDone
      if (fullResponse) {
        onDone(fullResponse, lastProvider);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ---------- Async Ask (non-blocking) ----------

  async askAsync(message: string, provider?: string | null): Promise<string> {
    const body: AskRequest = {
      message,
      provider: provider ?? this.config.defaultProvider,
      timeout_s: this.config.timeoutS,
      cache_bypass: this.config.cacheBypass,
      agent: this.config.agent,
    };

    const res = await fetch(`${this.config.gatewayUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Ask failed: ${res.status}`);
    const data: AskResponse = await res.json();
    return data.request_id;
  }

  async getReply(requestId: string, wait = false): Promise<ReplyResponse> {
    const url = `${this.config.gatewayUrl}/api/reply/${requestId}${wait ? '?wait=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Reply failed: ${res.status}`);
    return res.json();
  }

  // ---------- WebSocket ----------

  connectWebSocket(): void {
    if (this.ws) return;

    const wsUrl = this.config.gatewayUrl
      .replace('http://', 'ws://')
      .replace('https://', 'wss://');

    try {
      this.ws = new WebSocket(`${wsUrl}/api/ws`);

      this.ws.onopen = () => {
        // Subscribe to all channels
        this.ws?.send(JSON.stringify({
          type: 'subscribe',
          channels: ['requests', 'providers'],
        }));
        this.emit('ws:connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const wsEvent: WebSocketEvent = JSON.parse(event.data as string);
          this.emit('ws:event', wsEvent);
          this.emit(`ws:${wsEvent.type}`, wsEvent.data);
        } catch {
          // Ignore unparseable messages
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.emit('ws:disconnected');
        // Auto-reconnect after 5s
        this.wsReconnectTimer = setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      // WebSocket not available
    }
  }

  disconnectWebSocket(): void {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ---------- Stop / Cleanup ----------

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.disconnectWebSocket();
  }
}
```

### 5.3 Adapter (`src/agent/hivemind/HivemindAdapter.ts`)

```typescript
import { v4 as uuid } from 'uuid';
import type { StreamChunk } from './types';

/**
 * Converts Hivemind Gateway responses to AionUI's IResponseMessage format.
 *
 * AionUI expects messages with this interface:
 *   { type: string, data: unknown, msg_id: string, conversation_id: string }
 *
 * Streaming uses msg_id for chunk accumulation — same msg_id = same message.
 */

export interface IResponseMessage {
  type: string;
  data: unknown;
  msg_id: string;
  conversation_id: string;
}

export class HivemindAdapter {
  private conversationId: string;
  private currentMsgId: string;

  constructor(conversationId: string) {
    this.conversationId = conversationId;
    this.currentMsgId = uuid();
  }

  /** Reset msg_id for a new response turn */
  resetMessageId(): void {
    this.currentMsgId = uuid();
  }

  /** Convert a stream chunk to IResponseMessage */
  fromStreamChunk(chunk: StreamChunk): IResponseMessage {
    return {
      type: chunk.is_final ? 'content' : 'content',
      data: chunk.content,
      msg_id: this.currentMsgId,
      conversation_id: this.conversationId,
    };
  }

  /** Convert a complete sync response to IResponseMessage */
  fromSyncResponse(response: string): IResponseMessage {
    return {
      type: 'content',
      data: response,
      msg_id: this.currentMsgId,
      conversation_id: this.conversationId,
    };
  }

  /** Create a thinking/reasoning message (if provider returns thinking chain) */
  fromThinking(thinking: string): IResponseMessage {
    return {
      type: 'thought',
      data: thinking,
      msg_id: uuid(),  // Thinking gets its own msg_id
      conversation_id: this.conversationId,
    };
  }

  /** Create a finish signal */
  createFinish(): IResponseMessage {
    return {
      type: 'finish',
      data: null,
      msg_id: this.currentMsgId,
      conversation_id: this.conversationId,
    };
  }

  /** Create an error message */
  fromError(error: string): IResponseMessage {
    return {
      type: 'error',
      data: error,
      msg_id: this.currentMsgId,
      conversation_id: this.conversationId,
    };
  }

  /** Create a system/status message (e.g., routing info) */
  createSystemMessage(text: string): IResponseMessage {
    return {
      type: 'system',
      data: text,
      msg_id: uuid(),
      conversation_id: this.conversationId,
    };
  }

  /** Create provider badge info as a metadata message */
  createProviderInfo(provider: string, cached: boolean, latencyMs?: number): IResponseMessage {
    return {
      type: 'tips',
      data: this.formatProviderTip(provider, cached, latencyMs),
      msg_id: uuid(),
      conversation_id: this.conversationId,
    };
  }

  private formatProviderTip(provider: string, cached: boolean, latencyMs?: number): string {
    const parts = [`Provider: **${provider}**`];
    if (cached) parts.push('(cached)');
    if (latencyMs != null) parts.push(`${(latencyMs / 1000).toFixed(1)}s`);
    return parts.join(' ');
  }
}
```

### 5.4 Agent (`src/agent/hivemind/index.ts`)

```typescript
import { HivemindConnection } from './HivemindConnection';
import { HivemindAdapter, type IResponseMessage } from './HivemindAdapter';
import type { HivemindConfig } from './types';
import { DEFAULT_HIVEMIND_CONFIG } from './types';

export interface HivemindAgentConfig {
  id: string;
  conversationId: string;
  config: Partial<HivemindConfig>;
  /** Callback to emit response messages to the UI */
  onStreamEvent: (message: IResponseMessage) => void;
}

/**
 * HivemindAgent — sends user messages to Hivemind Gateway and
 * streams responses back via the onStreamEvent callback.
 *
 * Supports both streaming (SSE) and synchronous modes.
 */
export class HivemindAgent {
  private config: HivemindConfig;
  private connection: HivemindConnection;
  private adapter: HivemindAdapter;
  private onStreamEvent: (message: IResponseMessage) => void;
  private selectedProvider: string | null = null;

  constructor(agentConfig: HivemindAgentConfig) {
    this.config = { ...DEFAULT_HIVEMIND_CONFIG, ...agentConfig.config };
    this.connection = new HivemindConnection(this.config);
    this.adapter = new HivemindAdapter(agentConfig.conversationId);
    this.onStreamEvent = agentConfig.onStreamEvent;
  }

  /** Check if Gateway is reachable */
  async start(): Promise<boolean> {
    const healthy = await this.connection.checkHealth();
    if (!healthy) {
      this.onStreamEvent(this.adapter.fromError(
        'Hivemind Gateway is not running. Start it with:\n' +
        '```\ncd ~/.local/share/codex-dual\n' +
        'python3 -m lib.gateway.gateway_server --port 8765\n```'
      ));
      this.onStreamEvent(this.adapter.createFinish());
      return false;
    }

    // Connect WebSocket for real-time events
    this.connection.connectWebSocket();
    return true;
  }

  /** Set a specific provider for this conversation */
  setProvider(provider: string | null): void {
    this.selectedProvider = provider;
  }

  /** Send a message and stream the response */
  async send(message: string, msgId?: string): Promise<void> {
    this.adapter.resetMessageId();

    const provider = this.selectedProvider ?? this.config.defaultProvider;

    // If auto-routing, show routing recommendation first
    if (!provider) {
      try {
        const route = await this.connection.getRouteRecommendation(message);
        this.onStreamEvent(this.adapter.createProviderInfo(
          `${route.provider}${route.model ? ' ' + route.model : ''}`,
          false,
        ));
      } catch {
        // Routing info is optional, don't fail
      }
    }

    if (this.config.streaming) {
      await this.sendStreaming(message, provider);
    } else {
      await this.sendSync(message, provider);
    }
  }

  private async sendStreaming(message: string, provider: string | null): Promise<void> {
    await this.connection.askStream(
      message,
      // onChunk
      (chunk) => {
        this.onStreamEvent(this.adapter.fromStreamChunk(chunk));
      },
      // onDone
      (fullResponse, resolvedProvider) => {
        this.onStreamEvent(this.adapter.createFinish());
      },
      // onError
      (error) => {
        this.onStreamEvent(this.adapter.fromError(error.message));
        this.onStreamEvent(this.adapter.createFinish());
      },
      provider,
    );
  }

  private async sendSync(message: string, provider: string | null): Promise<void> {
    try {
      const response = await this.connection.ask(message, provider);

      // Emit thinking chain if available
      if (response.thinking) {
        this.onStreamEvent(this.adapter.fromThinking(response.thinking));
      }

      // Emit main response
      if (response.response) {
        this.onStreamEvent(this.adapter.fromSyncResponse(response.response));
      } else if (response.error) {
        this.onStreamEvent(this.adapter.fromError(response.error));
      }

      // Emit provider info
      this.onStreamEvent(this.adapter.createProviderInfo(
        response.provider,
        response.cached ?? false,
        response.latency_ms ?? undefined,
      ));

      this.onStreamEvent(this.adapter.createFinish());
    } catch (error: unknown) {
      this.onStreamEvent(this.adapter.fromError(
        error instanceof Error ? error.message : String(error),
      ));
      this.onStreamEvent(this.adapter.createFinish());
    }
  }

  /** Stop current streaming and cleanup */
  stop(): void {
    this.connection.stop();
  }

  /** Get gateway connection for status queries */
  getConnection(): HivemindConnection {
    return this.connection;
  }
}
```

---

## 6. Phase 3: Agent Manager & Worker

### 6.1 HivemindAgentManager (`src/process/task/HivemindAgentManager.ts`)

Follow the pattern of `CodexAgentManager`. The Hivemind agent runs in-process (not forked).

```typescript
import { BaseAgentManager } from './BaseAgentManager';
import { HivemindAgent } from '../../agent/hivemind';
import type { IResponseMessage } from '../../agent/hivemind/HivemindAdapter';
import type { HivemindConfig } from '../../agent/hivemind/types';
import { ipcBridge } from '../../common/ipcBridge';

// Adapt to whatever IPC and persistence mechanisms BaseAgentManager uses.
// See CodexAgentManager for the exact pattern.

interface HivemindConversationExtra {
  workspace?: string;
  customWorkspace?: string;
  gatewayUrl?: string;
  defaultProvider?: string | null;
  streaming?: boolean;
  agent?: string | null;
}

export class HivemindAgentManager extends BaseAgentManager<HivemindConversationExtra, never> {
  type = 'hivemind' as const;
  private agent: HivemindAgent | null = null;

  constructor(data: HivemindConversationExtra & { conversation_id: string }) {
    super({ type: 'hivemind', data });
    this.conversation_id = data.conversation_id;
  }

  async start(data?: HivemindConversationExtra): Promise<void> {
    const extra = data || {};
    const config: Partial<HivemindConfig> = {
      gatewayUrl: extra.gatewayUrl || 'http://localhost:8765',
      defaultProvider: extra.defaultProvider || null,
      streaming: extra.streaming !== false,  // default true
      agent: extra.agent || null,
    };

    this.agent = new HivemindAgent({
      id: this.conversation_id,
      conversationId: this.conversation_id,
      config,
      onStreamEvent: (message: IResponseMessage) => {
        this.handleStreamEvent(message);
      },
    });

    const started = await this.agent.start();
    if (started) {
      this.status = 'running';
    }
  }

  async sendMessage(data: { content: string; msg_id?: string }): Promise<void> {
    if (!this.agent) {
      await this.start();
    }
    await this.agent?.send(data.content, data.msg_id);
  }

  async stop(): Promise<void> {
    this.agent?.stop();
    this.agent = null;
    this.status = 'finished';
  }

  confirm(): void {
    // Hivemind doesn't use confirmation flow (no tool calls)
  }

  private handleStreamEvent(message: IResponseMessage): void {
    // 1. Persist message to SQLite
    // Follow the same pattern as CodexAgentManager:
    // this.addOrUpdateMessage(transformedMessage);

    // 2. Emit to renderer via IPC
    // ipcBridge.hivemind.responseStream.emit(message);
    // OR use the generic conversation.responseStream

    // The exact IPC method depends on AionUI's bridge setup.
    // See CodexAgentManager for reference.
    this.emitResponseStream(message);
  }

  private emitResponseStream(message: IResponseMessage): void {
    // Adapt this to AionUI's actual IPC emission pattern.
    // The key is: emit the message so the renderer's ConversationContext receives it.
    //
    // In CodexAgentManager, this is done via:
    //   this.bridgeAdapter.emitAndPersistMessage(message);
    //
    // Replicate that pattern here.
  }
}
```

**IMPORTANT IMPLEMENTATION NOTE FOR CODEX:**

Study `src/process/task/CodexAgentManager.ts` closely. It is the closest pattern to Hivemind since both run in-process. Key things to replicate:
1. How `emitAndPersistMessage()` works
2. How `transformMessage()` converts `IResponseMessage` → `TMessage`
3. How the first message triggers `start()` vs subsequent messages go to `sendMessage()`
4. How `stop()` is called when user aborts

### 6.2 Worker Stub (`src/worker/hivemind.ts`)

Since Hivemind runs in-process, the worker file is a stub (same pattern as `codex.ts`):

```typescript
// Hivemind agent runs in-process (HTTP/SSE client), no worker fork needed.
// This file exists for module resolution consistency.

export default () => {
  // No-op: HivemindAgentManager handles everything in the main process
};
```

### 6.3 Registration in WorkerManage

**File: `src/process/WorkerManage.ts`**

Find the `buildConversation()` method's switch statement and add:

```typescript
case 'hivemind': {
  const task = new HivemindAgentManager({
    ...conversation.extra,
    conversation_id: conversation.id,
  });
  taskList.push({ id: conversation.id, task });
  return task;
}
```

### 6.4 Conversation Factory in initAgent

**File: `src/process/initAgent.ts`**

Add a factory function:

```typescript
export const createHivemind = async (
  options: ICreateConversationParams,
): Promise<TChatConversation> => {
  const { extra } = options;
  const { workspace, customWorkspace } = await buildWorkspaceWidthFiles(
    extra?.workspace,
    extra?.customWorkspace,
  );

  return {
    type: 'hivemind',
    extra: {
      workspace,
      customWorkspace,
      gatewayUrl: extra?.gatewayUrl || 'http://localhost:8765',
      defaultProvider: extra?.defaultProvider || null,
      streaming: extra?.streaming !== false,
      agent: extra?.agent || null,
    },
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace || 'Hivemind',
    id: uuid(),
  };
};
```

Register this factory wherever AionUI's conversation creation dispatch lives (likely in a switch on agent type in `initAgent.ts` or a related file).

---

## 7. Phase 4: IPC Bridge Integration

**File: `src/common/ipcBridge.ts`**

Add Hivemind-specific IPC channels if needed, or reuse the generic `conversation` channels:

```typescript
// Option A: Reuse existing channels (simplest)
// No changes needed if HivemindAgentManager uses conversation.responseStream

// Option B: Add hivemind-specific channels (for extra features)
hivemind: {
  responseStream: buildEmitter<IResponseMessage>('hivemind:response-stream'),
  gatewayStatus: buildEmitter<GatewayStatus>('hivemind:gateway-status'),
  routingInfo: buildEmitter<RouteRecommendation>('hivemind:routing-info'),
}
```

**Recommendation**: Start with Option A (reuse `conversation.responseStream`). Only add Option B if you need to push gateway status updates to the renderer independently of chat messages.

---

## 8. Phase 5: Renderer UI

### 8.1 HivemindChat (`src/renderer/pages/conversation/hivemind/HivemindChat.tsx`)

This is the conversation view for Hivemind agent type. It should look similar to the ACP/Gemini chat but with:
- Provider badge showing which AI is responding
- Routing recommendation when auto-routing
- Cache hit indicator

```tsx
import React from 'react';
// Import the same base chat components used by other agent types
// Adapt from acp/ or gemini/ chat view

/**
 * HivemindChat — Chat conversation view for Hivemind agent.
 *
 * Key differences from other agent types:
 * 1. Messages may come from different providers (show provider badge)
 * 2. Auto-routing shows which provider was selected and why
 * 3. Cached responses are indicated
 *
 * IMPLEMENTATION GUIDE:
 * - Copy the structure of the closest existing chat view (likely ACP)
 * - Add HivemindProviderBadge to message bubbles
 * - The message rendering is handled by the shared Markdown component
 * - Provider info comes as 'tips' type messages from HivemindAdapter
 */

export const HivemindChat: React.FC = () => {
  // TODO: Implement following the pattern of existing chat views
  // Use the same ChatConversation component but with hivemind-specific decorations
  return null;
};
```

### 8.2 HivemindProviderBadge (`src/renderer/pages/conversation/hivemind/HivemindProviderBadge.tsx`)

```tsx
import React from 'react';
import { Tag } from '@arco-design/web-react';
import { PROVIDER_TIERS } from '../../../agent/hivemind/types';

interface Props {
  provider: string;
  cached?: boolean;
  latencyMs?: number;
}

/**
 * Small badge showing which provider handled the response.
 * Displayed above or beside the AI response bubble.
 */
export const HivemindProviderBadge: React.FC<Props> = ({
  provider,
  cached,
  latencyMs,
}) => {
  const tier = PROVIDER_TIERS[provider] || { emoji: '🤖', label: 'Unknown', color: '#666' };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
      <Tag color={tier.color} size="small">
        {tier.emoji} {provider}
      </Tag>
      {cached && (
        <Tag color="green" size="small">cached</Tag>
      )}
      {latencyMs != null && (
        <Tag size="small">{(latencyMs / 1000).toFixed(1)}s</Tag>
      )}
    </div>
  );
};
```

### 8.3 Add Hivemind to Conversation Creation UI

Find where AionUI lets users create a new conversation (likely in `sider.tsx` or `AgentSetupCard.tsx`). Add a "Hivemind" option:

```tsx
// In the agent type selector dropdown or card grid, add:
{
  type: 'hivemind',
  name: 'Hivemind',
  icon: '🐝',  // or use an icon from icon-park
  description: 'Multi-AI orchestration — auto-routes to 10 providers',
}
```

### 8.4 Provider Selection in Send Box

When the conversation type is `hivemind`, allow the user to optionally select a specific provider in the send box. If no provider is selected, auto-routing is used.

Add a provider selector dropdown to `sendbox.tsx` that appears when conversation type is `hivemind`:

```tsx
// In sendbox.tsx, add a provider selector when conversation.type === 'hivemind'
const HIVEMIND_PROVIDERS = [
  { value: '', label: '🧠 Auto (Smart Route)' },
  { value: 'kimi', label: '🚀 Kimi' },
  { value: 'qwen', label: '🚀 Qwen' },
  { value: 'deepseek', label: '⚡ DeepSeek' },
  { value: 'codex', label: '🐢 Codex' },
  { value: 'gemini', label: '🐢 Gemini' },
  { value: 'iflow', label: '⚡ iFlow' },
  { value: 'opencode', label: '⚡ OpenCode' },
  { value: '@fast', label: '⚡ @fast (Kimi+Qwen)' },
  { value: '@all', label: '🌐 @all (All Providers)' },
];
```

---

## 9. Phase 6: WebSocket Real-Time Events

### 9.1 Gateway Status Hook (`src/renderer/hooks/useHivemindStatus.ts`)

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { GatewayStatus, ProviderInfo } from '../../agent/hivemind/types';

/**
 * React hook that polls Hivemind Gateway status.
 * Can be used in a status bar or sidebar to show real-time provider health.
 */
export function useHivemindStatus(gatewayUrl = 'http://localhost:8765') {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${gatewayUrl}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setConnected(true);
        setError(null);
      } else {
        setConnected(false);
        setError(`HTTP ${res.status}`);
      }
    } catch (err) {
      setConnected(false);
      setError('Gateway unreachable');
    }
  }, [gatewayUrl]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);  // Poll every 10s
    return () => clearInterval(timer);
  }, [refresh]);

  return { status, connected, error, refresh };
}
```

### 9.2 WebSocket Events in Agent

The `HivemindConnection.connectWebSocket()` already handles WS events. In `HivemindAgentManager`, forward relevant events to the renderer:

```typescript
// In HivemindAgentManager, after creating the agent:
const conn = this.agent.getConnection();
conn.on('ws:request_completed', (data) => {
  // Forward to renderer if it's for this conversation
});
conn.on('ws:provider_status', (data) => {
  // Update provider health display
});
```

---

## 10. Phase 7: Settings Page

### 10.1 HivemindSettings (`src/renderer/pages/settings/HivemindSettings.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import {
  Form, Input, Switch, Select, Button, Message, Card, Tag, Space,
} from '@arco-design/web-react';
import { useHivemindStatus } from '../../hooks/useHivemindStatus';

/**
 * Settings page for Hivemind Gateway configuration.
 *
 * Allows configuring:
 * - Gateway URL
 * - Default provider (or auto-route)
 * - Streaming mode
 * - Agent role
 * - Cache bypass
 *
 * Also displays:
 * - Gateway connection status
 * - Available providers with health
 * - Gateway uptime and stats
 */
export const HivemindSettings: React.FC = () => {
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:8765');
  const { status, connected, error, refresh } = useHivemindStatus(gatewayUrl);

  // TODO: Load/save settings from AionUI's config storage
  // TODO: Display provider list with health indicators
  // TODO: Test connection button

  return (
    <div style={{ padding: 24 }}>
      <h2>Hivemind Gateway</h2>

      {/* Connection status */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Tag color={connected ? 'green' : 'red'}>
            {connected ? 'Connected' : 'Disconnected'}
          </Tag>
          {status && (
            <span>
              Uptime: {Math.floor(status.gateway.uptime_s / 60)}m |
              Requests: {status.gateway.total_requests} |
              Providers: {status.providers.filter(p => p.enabled).length}
            </span>
          )}
          <Button size="small" onClick={refresh}>Refresh</Button>
        </Space>
      </Card>

      <Form layout="vertical">
        <Form.Item label="Gateway URL">
          <Input
            value={gatewayUrl}
            onChange={setGatewayUrl}
            placeholder="http://localhost:8765"
          />
        </Form.Item>

        {/* More settings... */}
      </Form>

      {/* Provider list */}
      {status?.providers.map(p => (
        <Card key={p.name} size="small" style={{ marginBottom: 8 }}>
          <Space>
            <Tag color={p.status === 'healthy' ? 'green' : 'red'}>{p.name}</Tag>
            <span>Latency: {p.avg_latency_ms.toFixed(0)}ms</span>
            <span>Success: {(p.success_rate * 100).toFixed(0)}%</span>
            <span>Requests: {p.total_requests}</span>
          </Space>
        </Card>
      ))}
    </div>
  );
};
```

### 10.2 Register Settings Route

**File: `src/renderer/router.tsx`**

Add:

```tsx
{ path: '/settings/hivemind', element: <HivemindSettings /> }
```

And add a sidebar link in the settings navigation.

---

## 11. Phase 8: Testing & Verification

### 11.1 Manual Test Checklist

```
Pre-requisites:
  [ ] AionUI builds and runs (npm start)
  [ ] Hivemind Gateway running at :8765 (curl localhost:8765/api/health)

Core Flow:
  [ ] Can create a new Hivemind conversation
  [ ] Sending a message hits the Gateway (check gateway logs)
  [ ] Response streams back and displays in chat
  [ ] Provider badge shows which AI responded
  [ ] Auto-routing selects appropriate provider
  [ ] Specifying a provider (e.g. kimi) routes correctly
  [ ] Using @fast sends to fast provider group
  [ ] Cached response shows "cached" badge

Error Handling:
  [ ] Gateway not running → shows helpful error message
  [ ] Provider timeout → shows error, doesn't crash
  [ ] Network error → shows error, can retry

Settings:
  [ ] Settings page loads
  [ ] Shows gateway connection status
  [ ] Shows provider list with health
  [ ] Can change gateway URL
```

### 11.2 Key Gateway Endpoints to Test

```bash
# Verify Gateway is ready
curl http://localhost:8765/api/health

# List available providers
curl http://localhost:8765/api/providers

# Test auto-routing
curl -X POST "http://localhost:8765/api/route?message=write+a+React+component"

# Test sync ask
curl -X POST http://localhost:8765/api/ask?wait=true \
  -H "Content-Type: application/json" \
  -d '{"message":"ping","provider":"kimi"}'

# Test SSE streaming
curl -N -X POST http://localhost:8765/api/ask/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"count from 1 to 5","provider":"kimi"}'

# Test WebSocket
# (use wscat or similar)
wscat -c ws://localhost:8765/api/ws
> {"type":"subscribe","channels":["requests"]}
```

---

## 12. API Reference

### Core Endpoints Used by This Integration

| Method | Path | Purpose | Used In |
|--------|------|---------|---------|
| `GET` | `/api/health` | Verify gateway is running | `HivemindConnection.checkHealth()` |
| `POST` | `/api/ask?wait=true` | Synchronous AI request | `HivemindConnection.ask()` |
| `POST` | `/api/ask/stream` | SSE streaming AI request | `HivemindConnection.askStream()` |
| `POST` | `/api/ask` | Async submit (returns request_id) | `HivemindConnection.askAsync()` |
| `GET` | `/api/reply/{id}` | Fetch async result | `HivemindConnection.getReply()` |
| `POST` | `/api/route?message=` | Get routing recommendation | `HivemindConnection.getRouteRecommendation()` |
| `GET` | `/api/providers` | List available providers | `HivemindConnection.getProviders()` |
| `GET` | `/api/status` | Gateway + provider status | `HivemindConnection.getStatus()` |
| `WS` | `/api/ws` | Real-time events | `HivemindConnection.connectWebSocket()` |

### POST /api/ask — Request Body

```json
{
  "message": "string (required)",
  "provider": "string | null (null = auto-route)",
  "timeout_s": 300.0,
  "priority": 50,
  "cache_bypass": false,
  "agent": "string | null",
  "aggregation_strategy": "string | null"
}
```

### POST /api/ask?wait=true — Response

```json
{
  "request_id": "uuid",
  "provider": "kimi",
  "status": "completed",
  "cached": false,
  "parallel": false,
  "response": "AI response text...",
  "error": null,
  "latency_ms": 5123.4,
  "thinking": "reasoning chain (optional)...",
  "raw_output": "full CLI output (optional)..."
}
```

### POST /api/ask/stream — SSE Format

Each line: `data: <json>\n\n`

```json
{
  "request_id": "uuid",
  "content": "chunk text",
  "chunk_index": 0,
  "is_final": false,
  "tokens_used": null,
  "provider": "kimi",
  "metadata": null
}
```

### WS /api/ws — Event Format

```json
{
  "type": "request_completed",
  "data": { "request_id": "...", "provider": "...", ... },
  "timestamp": 1707500000.0
}
```

Event types: `request_submitted`, `request_queued`, `request_started`, `request_completed`, `request_failed`, `request_cancelled`, `request_retrying`, `request_fallback`, `provider_status`, `stream_chunk`.

---

## 13. File Manifest

### New Files to Create

| # | File | LOC (est.) | Description |
|---|------|-----------|-------------|
| 1 | `src/agent/hivemind/types.ts` | ~120 | TypeScript types for Gateway API |
| 2 | `src/agent/hivemind/HivemindConnection.ts` | ~250 | HTTP + SSE + WebSocket client |
| 3 | `src/agent/hivemind/HivemindAdapter.ts` | ~120 | Response → TMessage converter |
| 4 | `src/agent/hivemind/index.ts` | ~150 | HivemindAgent orchestration class |
| 5 | `src/process/task/HivemindAgentManager.ts` | ~120 | Agent lifecycle manager |
| 6 | `src/worker/hivemind.ts` | ~5 | Worker stub (in-process agent) |
| 7 | `src/renderer/pages/conversation/hivemind/HivemindChat.tsx` | ~80 | Chat view component |
| 8 | `src/renderer/pages/conversation/hivemind/HivemindProviderBadge.tsx` | ~40 | Provider indicator component |
| 9 | `src/renderer/pages/settings/HivemindSettings.tsx` | ~100 | Settings page |
| 10 | `src/renderer/hooks/useHivemindStatus.ts` | ~50 | Gateway status hook |
| **Total** | | **~1,035** | |

### Existing Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `src/types/acpTypes.ts` | Add `'hivemind'` to `AcpBackendAll` union |
| 2 | `src/process/WorkerManage.ts` | Add `case 'hivemind'` in `buildConversation()` |
| 3 | `src/process/initAgent.ts` | Add `createHivemind()` factory |
| 4 | `src/renderer/router.tsx` | Add `/settings/hivemind` route |
| 5 | `src/renderer/sider.tsx` or equivalent | Add Hivemind to agent selector |
| 6 | `src/renderer/pages/conversation/ChatLayout.tsx` | Add `case 'hivemind'` for chat view |
| 7 | `src/renderer/components/sendbox.tsx` | Add provider selector for hivemind type |

### Estimated Total Changes

- **~1,035 new lines** across 10 new files
- **~50 lines modified** across 7 existing files
- **1 new npm dependency**: `eventsource` (only if native fetch SSE is insufficient)

---

## Appendix A: Provider Groups

The Gateway supports provider groups for parallel/fan-out requests:

| Group | Providers |
|-------|-----------|
| `@all` | All enabled providers |
| `@fast` | kimi, qwen |
| `@coding` | codex, qwen, deepseek |

Use by setting `provider: "@fast"` in the ask request.

## Appendix B: Agent Roles

The Gateway supports agent roles for context-aware memory injection:

| Role | Purpose |
|------|---------|
| `sisyphus` | Bug fixing, iterative improvement |
| `oracle` | Analysis, prediction |
| `librarian` | Documentation, knowledge organization |
| `explorer` | Research, exploration |
| `frontend` | Frontend development |
| `reviewer` | Code review |

Use by setting `agent: "reviewer"` in the ask request.

## Appendix C: Model Shortcuts

When specifying a provider, you can append a model shortcut:

| Provider + Model | Example Provider Value |
|------------------|----------------------|
| Codex + o3 | `"codex"` + agent handles model selection |
| Gemini Flash | `"gemini"` |
| DeepSeek Reasoner | `"deepseek"` |

> **Note**: Model shortcuts are handled by the Gateway's backend executors, not in the API request. The `provider` field only specifies the provider name. Model selection happens at the Gateway level based on the message content and routing rules.

---

## Appendix D: Sequence Diagram

```
User              AionUI               HivemindAgent        Gateway          Provider
 │                  │                      │                   │                │
 │  Type message    │                      │                   │                │
 │─────────────────►│                      │                   │                │
 │                  │  sendMessage(msg)     │                   │                │
 │                  │─────────────────────►│                   │                │
 │                  │                      │  POST /api/route   │                │
 │                  │                      │──────────────────►│                │
 │                  │                      │  {provider: kimi}  │                │
 │                  │                      │◄──────────────────│                │
 │                  │  tips: "Provider:    │                   │                │
 │                  │    kimi"             │                   │                │
 │                  │◄─────────────────────│                   │                │
 │                  │                      │  POST /api/ask/    │                │
 │                  │                      │    stream          │                │
 │                  │                      │──────────────────►│  Forward to    │
 │                  │                      │                   │  best provider │
 │                  │                      │                   │───────────────►│
 │                  │                      │  SSE: chunk 0     │                │
 │                  │                      │◄──────────────────│                │
 │                  │  content: "chunk 0"  │                   │                │
 │                  │◄─────────────────────│                   │                │
 │  Display chunk   │                      │                   │                │
 │◄─────────────────│                      │                   │                │
 │                  │                      │  SSE: chunk 1     │                │
 │                  │                      │◄──────────────────│                │
 │                  │  content: "chunk 1"  │                   │                │
 │                  │◄─────────────────────│                   │                │
 │  Display chunk   │                      │                   │                │
 │◄─────────────────│                      │                   │                │
 │                  │                      │  SSE: final chunk  │                │
 │                  │                      │◄──────────────────│                │
 │                  │  content + finish    │                   │                │
 │                  │◄─────────────────────│                   │                │
 │  Display final   │                      │                   │                │
 │◄─────────────────│                      │                   │                │
```
