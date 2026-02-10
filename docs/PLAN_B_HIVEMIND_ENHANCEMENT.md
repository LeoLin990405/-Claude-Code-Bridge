# Plan B: AionUI Hivemind 功能增强 — Codex 执行文档

**日期**: 2026-02-10
**项目根目录**: `/Users/leo/Desktop/AionUi`
**所有路径均相对于项目根目录**

---

## 前置准备

确认你已在 `/Users/leo/Desktop/AionUi` 目录下工作。项目用 TypeScript + React + Electron。

**项目约定**（见 `CLAUDE.md`）：
- 代码注释用英文
- 不添加 AI 署名到 commits
- 使用 path aliases: `@/*`, `@process/*`, `@renderer/*`, `@worker/*`
- Commit 格式: `<type>(<scope>): <subject>`
- i18n 文件: `en-US.json`（非 `en.json`）, `zh-CN.json`
- TypeScript strict mode, 偏好 `type` over `interface`（按 ESLint 配置）

---

## Phase 1: 关键修复

### 1.1 文件上传修复

**问题**: `HivemindAgentManager.sendMessage()` 接受 `files` 参数但从未传递给 `agent.send()`，文件被丢弃。

#### Step 1: `src/agent/hivemind/types.ts` — 给 AskRequest 添加 files 字段

在 `AskRequest` 接口中添加 `files` 字段：

```typescript
// 当前代码 (line 25-31):
export interface AskRequest {
  message: string;
  provider?: string | null;
  timeout_s?: number;
  cache_bypass?: boolean;
  agent?: string | null;
}

// 改为:
export interface AskRequest {
  message: string;
  provider?: string | null;
  timeout_s?: number;
  cache_bypass?: boolean;
  agent?: string | null;
  files?: string[];  // Base64 encoded file contents or file paths
}
```

#### Step 2: `src/agent/hivemind/HivemindConnection.ts` — ask() 和 askStream() 支持 files

**ask() 方法** (line 102-131)：给 requestBody 添加 files 传递：

```typescript
// 当前签名 (line 102):
async ask(message: string, provider?: string | null): Promise<AskResponse> {

// 改为:
async ask(message: string, provider?: string | null, files?: string[]): Promise<AskResponse> {
```

在 requestBody 构造后（line 109 后）添加：
```typescript
    if (files?.length) {
      requestBody.files = files;
    }
```

**askStream() 方法** (line 133-235)：添加 files 参数：

```typescript
// 当前签名 (line 133-141):
  async askStream(
    message: string,
    callbacks: {
      onChunk: (chunk: StreamChunk) => void;
      onDone: (fullResponse: string, provider: string | null, summary: StreamSummary) => void;
      onError: (error: Error) => void;
    },
    provider?: string | null
  ): Promise<void> {

// 改为 (添加 files 参数):
  async askStream(
    message: string,
    callbacks: {
      onChunk: (chunk: StreamChunk) => void;
      onDone: (fullResponse: string, provider: string | null, summary: StreamSummary) => void;
      onError: (error: Error) => void;
    },
    provider?: string | null,
    files?: string[]
  ): Promise<void> {
```

在 requestBody 构造后（line 151 后）添加：
```typescript
    if (files?.length) {
      requestBody.files = files;
    }
```

#### Step 3: `src/agent/hivemind/index.ts` — send() 接受并传递 files

```typescript
// 当前签名 (line 60):
  async send(message: string, provider?: string | null): Promise<void> {

// 改为:
  async send(message: string, provider?: string | null, files?: string[]): Promise<void> {
```

**streaming 模式** (line 70-92)：把 files 传给 askStream：
```typescript
// 当前 (line 70):
      await this.connection.askStream(
        message,
        {
          // ... callbacks
        },
        provider
      );

// 改为 (添加 files 参数):
      await this.connection.askStream(
        message,
        {
          // ... callbacks (不变)
        },
        provider,
        files
      );
```

**非 streaming 模式** (line 102):
```typescript
// 当前 (line 102):
      const askResponse = await this.connection.ask(message, provider);

// 改为:
      const askResponse = await this.connection.ask(message, provider, files);
```

#### Step 4: `src/process/task/HivemindAgentManager.ts` — 传递 files

```typescript
// 当前 (line 134):
      await this.agent.send(data.content, data.provider);

// 改为:
      await this.agent.send(data.content, data.provider, data.files);
```

---

### 1.2 错误重试与降级

**问题**: 请求失败时无重试机制。

#### Step 1: `src/agent/hivemind/HivemindConnection.ts` — 添加 withRetry 方法

在 `HivemindConnection` class 内部（`stop()` 方法之前，约 line 237），添加 private 方法：

```typescript
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const isRetryable =
          err instanceof Error &&
          !err.message.includes('4') && // Skip 4xx errors
          (err.message.includes('fetch') ||
            err.message.includes('network') ||
            err.message.includes('ECONNREFUSED') ||
            err.message.includes('5') || // 5xx errors
            err.name === 'TypeError'); // fetch failures
        if (!isRetryable || attempt === maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw new Error('unreachable');
  }
```

**更精确的 4xx/5xx 判断**：修改上面的 `isRetryable` 判断，使用更精确的逻辑：

```typescript
  private isRetryableError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message;
    // Retry on network errors
    if (msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || err.name === 'TypeError') {
      return true;
    }
    // Retry on 5xx, not on 4xx
    const httpMatch = msg.match(/(\d{3})/);
    if (httpMatch) {
      const code = parseInt(httpMatch[1], 10);
      return code >= 500;
    }
    return false;
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (!this.isRetryableError(err) || attempt === maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw new Error('unreachable');
  }
```

#### Step 2: 在 `ask()` 方法中使用 withRetry

```typescript
// 改 ask() 的 fetch 调用:
// 当前 (line 111-130) - 整个 try 块:
    const timeout = buildTimeoutAbort(Math.max(this.config.timeoutS, 1) * 1000 + 5000);
    try {
      const response = await fetch(...);
      // ...
    } finally {
      timeout.dispose();
    }

// 改为:
    const timeout = buildTimeoutAbort(Math.max(this.config.timeoutS, 1) * 1000 + 5000);
    try {
      return await this.withRetry(async () => {
        const response = await fetch(`${this.config.gatewayUrl}/api/ask?wait=true&timeout=${this.config.timeoutS}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: timeout.signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => response.statusText);
          throw new Error(extractErrorMessage(errorBody, `Hivemind ask failed: ${response.status}`));
        }

        return (await response.json()) as AskResponse;
      });
    } finally {
      timeout.dispose();
    }
```

**注意**: streaming 模式 (`askStream`) 不使用 withRetry（已发送的 chunk 无法回滚）。

---

### 1.3 i18n 国际化

**问题**: UI 文本硬编码英文。

#### Step 1: `src/renderer/i18n/locales/en-US.json` — 添加 hivemind 命名空间

在 JSON 的顶层添加 `"hivemind"` key（在现有的 `"agent"` key 之后或 JSON 末尾 `}` 之前）：

```json
  "hivemind": {
    "placeholder": "Send a message to Hivemind...",
    "processing": "Processing...",
    "providerLabel": "Provider",
    "autoRoute": "Auto (smart routing)",
    "autoRouteDescription": "Auto routing enabled. Hivemind will select the best provider for each request.",
    "routeMismatch": "Requested: {{requested}} · Routed to: {{actual}}",
    "routeConfirmed": "Provider: {{provider}}",
    "settings": {
      "title": "Hivemind Gateway",
      "gatewayUrl": "Gateway URL",
      "defaultProvider": "Default Provider",
      "timeout": "Timeout (seconds)",
      "streaming": "Streaming",
      "cacheBypass": "Cache Bypass",
      "agentRole": "Agent Role",
      "agentRolePlaceholder": "e.g. architect",
      "connected": "Connected",
      "disconnected": "Disconnected",
      "refresh": "Refresh",
      "save": "Save",
      "saveSuccess": "Hivemind settings saved",
      "saveFailed": "Failed to save Hivemind settings",
      "loadFailed": "Failed to load hivemind config",
      "uptime": "Uptime",
      "requests": "Requests",
      "active": "Active",
      "enabledProviders": "Enabled providers",
      "gatewayUnreachable": "Hivemind Gateway is not reachable. Please start it at http://localhost:8765"
    },
    "status": {
      "reconnecting": "Reconnecting to Gateway...",
      "reconnectFailed": "Gateway disconnected. Retrying..."
    },
    "tokens": "{{count}} tokens",
    "cached": "cached",
    "thinking": "Thinking"
  }
```

#### Step 2: `src/renderer/i18n/locales/zh-CN.json` — 中文翻译

在 JSON 末尾添加同结构的中文翻译：

```json
  "hivemind": {
    "placeholder": "向 Hivemind 发送消息...",
    "processing": "处理中...",
    "providerLabel": "Provider",
    "autoRoute": "自动（智能路由）",
    "autoRouteDescription": "已启用自动路由。Hivemind 将为每个请求选择最佳 Provider。",
    "routeMismatch": "请求: {{requested}} · 路由到: {{actual}}",
    "routeConfirmed": "Provider: {{provider}}",
    "settings": {
      "title": "Hivemind 网关",
      "gatewayUrl": "网关地址",
      "defaultProvider": "默认 Provider",
      "timeout": "超时（秒）",
      "streaming": "流式传输",
      "cacheBypass": "绕过缓存",
      "agentRole": "Agent 角色",
      "agentRolePlaceholder": "例如 architect",
      "connected": "已连接",
      "disconnected": "未连接",
      "refresh": "刷新",
      "save": "保存",
      "saveSuccess": "Hivemind 设置已保存",
      "saveFailed": "保存 Hivemind 设置失败",
      "loadFailed": "加载 Hivemind 配置失败",
      "uptime": "运行时间",
      "requests": "请求数",
      "active": "活跃",
      "enabledProviders": "已启用 Provider",
      "gatewayUnreachable": "Hivemind 网关不可达，请在 http://localhost:8765 启动"
    },
    "status": {
      "reconnecting": "正在重新连接网关...",
      "reconnectFailed": "网关已断开，正在重试..."
    },
    "tokens": "{{count}} tokens",
    "cached": "已缓存",
    "thinking": "思考中"
  }
```

#### Step 3: `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` — 替换硬编码文本

**placeholder** (line 344-350):
```typescript
// 当前:
        placeholder={
          aiProcessing
            ? t('conversation.chat.processing')
            : t('acp.sendbox.placeholder', {
                backend: 'Hivemind',
                defaultValue: 'Send message to Hivemind...',
              })
        }

// 改为:
        placeholder={
          aiProcessing
            ? t('hivemind.processing')
            : t('hivemind.placeholder')
        }
```

#### Step 4: `src/renderer/pages/conversation/hivemind/HivemindRoutingInfo.tsx` — 替换硬编码文本

整个组件添加 `useTranslation` 并替换硬编码字符串：

```typescript
// 当前完整文件替换为:
import React from 'react';
import { Alert } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';

interface HivemindRoutingInfoProps {
  requestedProvider: string | null;
  actualProvider: string | null;
}

const HivemindRoutingInfo: React.FC<HivemindRoutingInfoProps> = ({ requestedProvider, actualProvider }) => {
  const { t } = useTranslation();

  if (!actualProvider && !requestedProvider) {
    return (
      <Alert
        className='mb-8px'
        type='info'
        content={t('hivemind.autoRouteDescription')}
        showIcon
      />
    );
  }

  if (requestedProvider && actualProvider && requestedProvider !== actualProvider) {
    return (
      <Alert
        className='mb-8px'
        type='warning'
        content={t('hivemind.routeMismatch', { requested: requestedProvider, actual: actualProvider })}
        showIcon
      />
    );
  }

  const effective = actualProvider || requestedProvider;
  if (!effective) {
    return null;
  }

  return <Alert className='mb-8px' type='success' content={t('hivemind.routeConfirmed', { provider: effective })} showIcon />;
};

export default HivemindRoutingInfo;
```

#### Step 5: `src/renderer/components/SettingsModal/contents/HivemindModalContent.tsx` — 替换硬编码文本

添加 `useTranslation` 导入和使用：

```typescript
// 已有导入 (无需添加新的): 文件已没有 useTranslation
// 在 import 区域添加:
import { useTranslation } from 'react-i18next';

// 在组件开头 (line 14 后) 添加:
  const { t } = useTranslation();
```

替换所有硬编码文本：

| 行号 | 当前 | 替换为 |
|------|------|--------|
| 49 | `Message.success('Hivemind settings saved')` | `Message.success(t('hivemind.settings.saveSuccess'))` |
| 52 | `Message.error(err instanceof Error ? err.message : 'Failed to save Hivemind settings')` | `Message.error(err instanceof Error ? err.message : t('hivemind.settings.saveFailed'))` |
| 59 | `Hivemind Gateway` | `{t('hivemind.settings.title')}` |
| 65 | `{connected ? 'Connected' : 'Disconnected'}` | `{connected ? t('hivemind.settings.connected') : t('hivemind.settings.disconnected')}` |
| 70 | `Refresh` | `{t('hivemind.settings.refresh')}` |
| 73 | `Save` | `{t('hivemind.settings.save')}` |
| 79 | `Uptime:` / `Requests:` / `Active:` | 使用 `t('hivemind.settings.uptime')` 等 |
| 82 | `Enabled providers:` | `{t('hivemind.settings.enabledProviders')}:` |
| 87 | `'Gateway URL'` | `{t('hivemind.settings.gatewayUrl')}` |
| 97 | `'Default Provider'` | `{t('hivemind.settings.defaultProvider')}` |
| 112 | `'Timeout (seconds)'` | `{t('hivemind.settings.timeout')}` |
| 124 | `'Agent Role'` | `{t('hivemind.settings.agentRole')}` |
| 127 | `placeholder='e.g. architect'` | `placeholder={t('hivemind.settings.agentRolePlaceholder')}` |
| 137 | `'Streaming'` | `{t('hivemind.settings.streaming')}` |
| 146 | `'Cache Bypass'` | `{t('hivemind.settings.cacheBypass')}` |

#### Step 6: `src/process/task/HivemindAgentManager.ts` — Gateway 不可达消息

```typescript
// 当前 (line 72):
          data: 'Hivemind Gateway is not reachable. Please start it at http://localhost:8765',

// 改为:
          data: 'Hivemind Gateway is not reachable. Please start it at http://localhost:8765',
// 注意: 这是后端代码，无法使用 i18n t()。保持英文不变。前端会通过 transformMessage 显示为 tips 类型消息。
```

---

## Phase 2: 核心功能增强

### 2.1 思考链 (Chain-of-Thought) 显示

**问题**: `types.ts` 定义了 `thinking` 字段但从未提取。

**核心发现**: 项目已有 `ThoughtDisplay` 组件 (`src/renderer/components/ThoughtDisplay.tsx`)，其他 agent (Gemini, Codex, OpenClaw) 都用 `type: 'thought'` 消息类型 + `ThoughtData { subject, description }` 格式。`chatLib.ts` 的 `transformMessage` 已在 line 398 处理 `case 'thought': break;`（忽略，不渲染为消息）。因此 thinking 应在 SendBox 组件中通过 `ThoughtDisplay` 组件展示，与其他 Agent 一致。

#### Step 1: `src/agent/hivemind/HivemindConnection.ts` — 提取 thinking

**非 streaming 模式**：thinking 来自 `AskResponse.thinking` 字段。

**streaming 模式**：Gateway 的 stream response 可能通过 `StreamChunk.metadata` 传递 thinking，或者通过独立的 chunk。需要在 `StreamChunk` 类型中确认。

在 `types.ts` 中给 `StreamChunk` 添加 thinking 字段：

```typescript
// 当前 StreamChunk (line 47-55):
export interface StreamChunk {
  request_id: string;
  content: string;
  chunk_index: number;
  is_final: boolean;
  tokens_used: number | null;
  provider: string | null;
  metadata: Record<string, unknown> | null;
}

// 改为:
export interface StreamChunk {
  request_id: string;
  content: string;
  chunk_index: number;
  is_final: boolean;
  tokens_used: number | null;
  provider: string | null;
  metadata: Record<string, unknown> | null;
  thinking?: string | null;
}
```

#### Step 2: `src/agent/hivemind/index.ts` — 发射 thought 事件

**在 streaming 模式中** (send 方法, line 66-98)，在 `onChunk` 回调中检查 thinking：

```typescript
// 在 onChunk 回调内，在 "const streamMessage = ..." 之前添加:

            // Emit thinking/thought event for UI display
            if (chunk.thinking) {
              this.onStreamEvent({
                type: 'thought',
                conversation_id: this.conversationId,
                msg_id: responseMsgId,
                data: { subject: 'Thinking', description: chunk.thinking },
              });
            }
```

**在非 streaming 模式中** (line 101-119)，在 askResponse 处理后、messages.forEach 之前：

```typescript
      // Emit thinking if available
      if (askResponse.thinking) {
        this.onStreamEvent({
          type: 'thought',
          conversation_id: this.conversationId,
          msg_id: responseMsgId,
          data: { subject: 'Thinking', description: askResponse.thinking },
        });
      }
```

#### Step 3: `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` — 处理 thought 事件并显示

添加导入：
```typescript
import ThoughtDisplay, { type ThoughtData } from '@/renderer/components/ThoughtDisplay';
```

添加状态：
```typescript
  // 在其他 useState 声明附近 (line 50 后) 添加:
  const [thought, setThought] = useState<ThoughtData>({ subject: '', description: '' });
```

在 `responseStream.on` 的 switch 中添加 thought case (line 128-160 区域)：
```typescript
        case 'thought':
          setThought(message.data as ThoughtData);
          break;
```

在 `case 'finish'` 中清除 thought：
```typescript
        case 'finish':
          setRunning(false);
          setAiProcessing(false);
          setThought({ subject: '', description: '' });  // 添加这行
          return;
```

在 `onSendHandler` 的开头（line 221 后）清除 thought：
```typescript
    setThought({ subject: '', description: '' });
```

在 JSX 的 `<SendBox>` 组件之前，添加 ThoughtDisplay（在 `HivemindProviderBadge` 之后）：
```tsx
      {/* 在 line 337 HivemindProviderBadge 之后，SendBox 之前 */}
      <ThoughtDisplay thought={thought} running={aiProcessing} style='compact' onStop={handleStop} />
```

---

### 2.2 Token 计数与用量统计

**问题**: `StreamChunk.tokens_used` 有数据但从未追踪。

#### Step 1: `src/agent/hivemind/index.ts` — 累加 tokens

在 `send()` 方法的 streaming 模式中 (line 66-98)：

```typescript
// 在 streaming 模式块开头 (line 67 后) 添加:
      let totalTokens = 0;

// 在 onChunk 回调中 (在已有的 chunk.provider 检查后) 添加:
            if (chunk.tokens_used) {
              totalTokens += chunk.tokens_used;
            }
```

#### Step 2: `src/agent/hivemind/index.ts` — 在 finish 时传递 token 数据

修改 `emitProviderStatus` 方法签名，添加 totalTokens：

```typescript
// 当前 (line 44):
  private emitProviderStatus(msgId: string, provider: string | null, summary: StreamSummary = {}, requestedProvider?: string | null): void {

// 改为:
  private emitProviderStatus(msgId: string, provider: string | null, summary: StreamSummary = {}, requestedProvider?: string | null, totalTokens?: number): void {
```

在 data 对象中添加 totalTokens：
```typescript
      data: {
        backend,
        status: 'session_active',
        requestedProvider: requestedProvider ?? null,
        cached: summary.cached,
        latencyMs: summary.latencyMs,
        totalTokens: totalTokens ?? null,  // 添加
      },
```

在 streaming 的 `onDone` 回调中传递 totalTokens：
```typescript
// 当前 (line 84-86):
          onDone: (_fullResponse, finalProvider, summary) => {
            this.emitProviderStatus(responseMsgId, finalProvider || discoveredProvider, summary, requestedProvider);
          },

// 改为:
          onDone: (_fullResponse, finalProvider, summary) => {
            this.emitProviderStatus(responseMsgId, finalProvider || discoveredProvider, summary, requestedProvider, totalTokens);
          },
```

#### Step 3: `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` — 显示 token 计数

添加状态：
```typescript
  const [lastTokens, setLastTokens] = useState<number | null>(null);
```

在 `conversation_id` 变化时重置 (line 114-120)：
```typescript
  // 在已有的 useEffect 中添加:
    setLastTokens(null);
```

在 `onSendHandler` 中重置：
```typescript
    setLastTokens(null);
```

在 `responseStream.on` 的 `agent_status` case 中提取 tokens (line 141-157)：
```typescript
        case 'agent_status': {
          const statusData = message.data as {
            backend?: string;
            cached?: boolean;
            latencyMs?: number | null;
            totalTokens?: number | null;  // 添加
          };
          // ... 已有的 backend/cached/latencyMs 处理 ...
          if (typeof statusData.totalTokens === 'number' && statusData.totalTokens > 0) {
            setLastTokens(statusData.totalTokens);
          }
          break;
        }
```

#### Step 4: `src/renderer/pages/conversation/hivemind/HivemindProviderBadge.tsx` — 显示 tokens

修改 props：
```typescript
interface HivemindProviderBadgeProps {
  provider: string;
  cached?: boolean;
  latencyMs?: number | null;
  totalTokens?: number | null;  // 添加
}
```

修改组件：
```typescript
const HivemindProviderBadge: React.FC<HivemindProviderBadgeProps> = ({ provider, cached = false, latencyMs, totalTokens }) => {
```

在 JSX 中添加 token 显示（在 latencyMs 的 Tag 之后）：
```tsx
      {typeof totalTokens === 'number' && totalTokens > 0 && (
        <Tag size='small'>⚡ {totalTokens.toLocaleString()} tokens</Tag>
      )}
```

在 `HivemindSendBox.tsx` 中传递 totalTokens：
```tsx
// 当前 (line 336):
      {lastProvider && <HivemindProviderBadge provider={lastProvider} cached={lastCached} latencyMs={lastLatencyMs} />}

// 改为:
      {lastProvider && <HivemindProviderBadge provider={lastProvider} cached={lastCached} latencyMs={lastLatencyMs} totalTokens={lastTokens} />}
```

---

### 2.3 Gateway 断连恢复

**问题**: Gateway 不可用时仅显示错误，无重连机制。

#### Step 1: `src/renderer/hooks/useHivemindStatus.ts` — 添加重连逻辑

完整替换文件：

```typescript
/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GatewayStatus, HivemindProviderStatus } from '@/agent/hivemind/types';

const MAX_RETRIES = 5;
const MAX_BACKOFF_MS = 30000;

export function useHivemindStatus(gatewayUrl = 'http://localhost:8765') {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const retryCountRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${gatewayUrl}/api/status`);
      if (!res.ok) {
        setConnected(false);
        setError(`HTTP ${res.status}`);
        return;
      }

      const data = (await res.json()) as GatewayStatus;
      setStatus(data);
      setConnected(true);
      setError(null);
      retryCountRef.current = 0; // Reset retry count on success
      setReconnecting(false);
    } catch (err) {
      setConnected(false);
      setError(err instanceof Error ? err.message : 'Gateway unreachable');
    }
  }, [gatewayUrl]);

  // Normal polling when connected
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 10000);

    return () => {
      clearInterval(timer);
    };
  }, [refresh]);

  // Auto-reconnect with exponential backoff when disconnected
  useEffect(() => {
    if (connected || retryCountRef.current >= MAX_RETRIES) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), MAX_BACKOFF_MS);
    const timer = setTimeout(() => {
      setReconnecting(true);
      void refresh().finally(() => {
        retryCountRef.current += 1;
        setReconnecting(false);
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [connected, refresh]);

  // Per-provider status helper
  const getProviderStatus = useCallback(
    (providerName: string): HivemindProviderStatus | undefined => {
      return status?.providers?.find((p) => p.name === providerName);
    },
    [status]
  );

  return {
    status,
    connected,
    error,
    reconnecting,
    refresh,
    getProviderStatus,
    providers: status?.providers ?? [],
  };
}
```

#### Step 2: `src/renderer/pages/conversation/hivemind/HivemindChat.tsx` — 添加连接状态横幅

```typescript
// 当前完整文件替换为:
/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConversationProvider } from '@/renderer/context/ConversationContext';
import { useHivemindStatus } from '@/renderer/hooks/useHivemindStatus';
import FlexFullContainer from '@renderer/components/FlexFullContainer';
import MessageList from '@renderer/messages/MessageList';
import { MessageListProvider, useMessageLstCache } from '@renderer/messages/hooks';
import HOC from '@renderer/utils/HOC';
import { Alert } from '@arco-design/web-react';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LocalImageView from '../../../components/LocalImageView';
import ConversationChatConfirm from '../components/ConversationChatConfirm';
import HivemindSendBox from './HivemindSendBox';

const HivemindChat: React.FC<{
  conversation_id: string;
  workspace?: string;
}> = ({ conversation_id, workspace }) => {
  useMessageLstCache(conversation_id);
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  const { t } = useTranslation();
  const { connected, reconnecting } = useHivemindStatus();

  useEffect(() => {
    if (!workspace) {
      return;
    }
    updateLocalImage({ root: workspace });
  }, [workspace, updateLocalImage]);

  return (
    <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'hivemind' }}>
      <div className='flex-1 flex flex-col px-20px'>
        {!connected && (
          <Alert
            className='mx-auto max-w-800px w-full mt-8px'
            type='warning'
            content={reconnecting ? t('hivemind.status.reconnecting') : t('hivemind.status.reconnectFailed')}
            showIcon
            closable
          />
        )}
        <FlexFullContainer>
          <MessageList className='flex-1'></MessageList>
        </FlexFullContainer>
        <ConversationChatConfirm conversation_id={conversation_id}>
          <HivemindSendBox conversation_id={conversation_id} />
        </ConversationChatConfirm>
      </div>
    </ConversationProvider>
  );
};

export default HOC(MessageListProvider)(HivemindChat);
```

#### Step 3: `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` — 断开时禁用发送

如果想要在 Gateway 断开时禁用发送按钮，在 HivemindSendBox 组件中：

```typescript
// 添加导入:
import { useHivemindStatus } from '@/renderer/hooks/useHivemindStatus';

// 在组件内添加:
  const { connected: gatewayConnected } = useHivemindStatus();

// 修改 SendBox 的 disabled prop:
// 当前 (line 342):
        disabled={aiProcessing}
// 改为:
        disabled={aiProcessing || !gatewayConnected}
```

---

## Phase 3: 体验优化

### 3.1 请求取消协议

**问题**: `stop()` 仅中断本地 stream，Gateway 端继续处理。

#### Step 1: `src/agent/hivemind/types.ts` — 添加 CancelRequest 类型

在文件末尾 `PROVIDER_TIERS` 之前添加：

```typescript
export type CancelRequest = {
  request_id: string;
};
```

#### Step 2: `src/agent/hivemind/HivemindConnection.ts` — 追踪 requestId 并发送 cancel

添加 private 属性：
```typescript
// 在 class HivemindConnection 开头 (line 72-73 区域):
  private lastRequestId: string | null = null;
```

在 `askStream` 的 SSE 解析中捕获 request_id：
```typescript
// 在 parsed = JSON.parse(eventPayload) 之后，callbacks.onChunk(parsed) 之前 (约 line 209):
          if (parsed.request_id && !this.lastRequestId) {
            this.lastRequestId = parsed.request_id;
          }
```

在 `ask` 方法中同样捕获：
```typescript
// 在 return (await response.json()) as AskResponse 之前:
      const result = (await response.json()) as AskResponse;
      this.lastRequestId = result.request_id;
      return result;
```

修改 `stop()` 方法 (line 237-243):
```typescript
  stop(): void {
    if (this.activeStreamAbort) {
      this.activeStreamAbort.abort();
      this.activeStreamAbort = null;
    }
    // Notify Gateway to cancel processing
    if (this.lastRequestId) {
      const requestId = this.lastRequestId;
      this.lastRequestId = null;
      fetch(`${this.config.gatewayUrl}/api/cancel/${requestId}`, {
        method: 'POST',
      }).catch(() => {}); // Fire and forget
    }
  }
```

在 `askStream` 的 `finally` 块中清理 (line 233):
```typescript
    } finally {
      this.activeStreamAbort = null;
      // Don't clear lastRequestId here - it's needed for stop()
    }
```

---

### 3.2 Provider 实时状态指示

**问题**: 聊天界面中看不到各 Provider 的实时健康状态。

#### Step 1: `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` — Provider 下拉带状态圆点

先导入 `useHivemindStatus`（如果在 2.3 中还没添加的话）：

```typescript
import { useHivemindStatus } from '@/renderer/hooks/useHivemindStatus';
```

在组件中获取 provider 状态（如果 2.3 中已添加 `gatewayConnected`，扩展解构）：
```typescript
  const { connected: gatewayConnected, providers } = useHivemindStatus();
```

修改 `providerSelector` (line 316-331)，替换为带状态圆点的版本：

```tsx
  // Helper to get provider health color
  const getProviderHealthColor = useCallback(
    (providerValue: string): string | null => {
      if (!providerValue || providerValue.startsWith('@')) return null;
      const providerStatus = providers.find((p) => p.name === providerValue);
      if (!providerStatus) return null;
      if (providerStatus.status === 'healthy' || providerStatus.status === 'ok') return '#00b42a';
      if (providerStatus.status === 'degraded') return '#ff7d00';
      return '#f53f3f'; // offline/error
    },
    [providers]
  );

  const providerSelector = useMemo(
    () => (
      <Select
        size='mini'
        value={selectedProvider ?? ''}
        style={{ width: 168 }}
        disabled={running || aiProcessing}
        onChange={(value) => {
          const normalized = typeof value === 'string' ? value : '';
          setSelectedProvider(normalized || null);
        }}
        renderFormat={(option) => {
          if (!option) return '';
          const label = option.children as string;
          const healthColor = getProviderHealthColor(option.value as string);
          return (
            <span className='flex items-center gap-4px'>
              {healthColor && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: healthColor,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
              )}
              {label}
            </span>
          );
        }}
      >
        {HIVEMIND_PROVIDER_OPTIONS.map((opt) => {
          const healthColor = getProviderHealthColor(opt.value);
          return (
            <Select.Option key={opt.value} value={opt.value}>
              <span className='flex items-center gap-4px'>
                {healthColor && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: healthColor,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                )}
                {opt.label}
              </span>
            </Select.Option>
          );
        })}
      </Select>
    ),
    [selectedProvider, running, aiProcessing, setSelectedProvider, getProviderHealthColor]
  );
```

注意：这里改成了 `<Select>` 使用 children 模式而非 `options` prop，因为需要自定义渲染每个选项。

---

## 完整文件修改清单

| # | 文件 | 增强项 | 修改类型 |
|---|------|--------|----------|
| 1 | `src/agent/hivemind/types.ts` | 1.1, 2.1, 3.1 | 添加 files/thinking/cancel 字段 |
| 2 | `src/agent/hivemind/HivemindConnection.ts` | 1.1, 1.2, 3.1 | 文件上传、重试、cancel |
| 3 | `src/agent/hivemind/HivemindAdapter.ts` | — | 无需修改 |
| 4 | `src/agent/hivemind/index.ts` | 1.1, 2.1, 2.2 | files 传递、thinking 发射、token 累加 |
| 5 | `src/process/task/HivemindAgentManager.ts` | 1.1 | files 传递 |
| 6 | `src/renderer/i18n/locales/en-US.json` | 1.3 | 添加 hivemind 命名空间 |
| 7 | `src/renderer/i18n/locales/zh-CN.json` | 1.3 | 中文翻译 |
| 8 | `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` | 1.3, 2.1, 2.2, 2.3, 3.2 | i18n、thought、token、断连、provider 状态 |
| 9 | `src/renderer/pages/conversation/hivemind/HivemindChat.tsx` | 2.3 | 连接状态横幅 |
| 10 | `src/renderer/pages/conversation/hivemind/HivemindRoutingInfo.tsx` | 1.3 | i18n |
| 11 | `src/renderer/pages/conversation/hivemind/HivemindProviderBadge.tsx` | 2.2 | 添加 tokens 显示 |
| 12 | `src/renderer/components/SettingsModal/contents/HivemindModalContent.tsx` | 1.3 | i18n |
| 13 | `src/renderer/hooks/useHivemindStatus.ts` | 2.3, 3.2 | 重连、provider 状态 |

**估计新增/修改**: ~500-600 行代码

---

## 执行顺序建议

按以下顺序执行，每完成一个步骤可以独立验证：

1. **types.ts** — 先改类型定义（所有其他文件依赖它）
2. **HivemindConnection.ts** — 文件上传 + 重试 + cancel（核心通讯层）
3. **index.ts (HivemindAgent)** — files 传递 + thinking + tokens
4. **HivemindAgentManager.ts** — files 传递
5. **i18n locales** — en-US.json + zh-CN.json
6. **useHivemindStatus.ts** — 重连 + provider 状态
7. **HivemindRoutingInfo.tsx** — i18n
8. **HivemindProviderBadge.tsx** — tokens 显示
9. **HivemindModalContent.tsx** — i18n
10. **HivemindChat.tsx** — 连接状态横幅
11. **HivemindSendBox.tsx** — 所有功能整合（最后改，依赖最多）

---

## Commit 建议

分 3 个 commit（每个 Phase 一个）：

```
feat(hivemind): add file upload, retry logic, and i18n support

- Pass files parameter through agent chain to Gateway
- Add exponential backoff retry for non-streaming requests
- Add hivemind i18n namespace with en-US and zh-CN translations
- Replace all hardcoded UI text with translation keys
```

```
feat(hivemind): add thinking display, token tracking, and reconnection

- Extract and display thinking/CoT from DeepSeek/Kimi responses
- Track and display token usage per request
- Add automatic Gateway reconnection with exponential backoff
- Show connection status banner when Gateway is disconnected
```

```
feat(hivemind): add request cancellation and provider health indicators

- Send cancel request to Gateway when user stops a stream
- Show per-provider health status dots in provider selector dropdown
```

---

## 注意事项

1. **不要添加 AI 署名**到任何 commit（项目 CLAUDE.md 强制要求）
2. **代码注释用英文**
3. **TypeScript strict mode** — 确保所有新代码类型安全
4. **i18n 插值语法**用 `{{variable}}`（react-i18next 默认格式）
5. **ESLint**: 运行 `npm run lint:fix` 确保代码风格一致
6. **路径别名**: 使用 `@/` 而非相对路径（如 `@/agent/hivemind/types`）
