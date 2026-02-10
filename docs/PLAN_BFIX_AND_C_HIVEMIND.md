# Plan B-fix + Plan C: Hivemind 修复与迭代增强

**日期**: 2026-02-10
**执行者**: Codex
**项目根目录**: `/Users/leo/Desktop/AionUi`
**前置**: Plan B 全部 Phase 已落地但未提交，需先修复已知问题再推进 Plan C

---

## Part 1: Plan B 修复（Bug Fix）

通过代码审查发现以下问题，需在提交前修复。

---

### Fix 1: `lastRequestId` 在 `askStream` finally 中过早清除 — cancel 协议失效

**文件**: `src/agent/hivemind/HivemindConnection.ts`

**问题**: `stop()` 方法依赖 `this.lastRequestId` 发送 cancel 请求到 Gateway。但 `askStream()` 的 `finally` 块（line 290-293）在流正常结束时也会清除 `lastRequestId`。更关键的是，当用户点击 Stop 时，`stop()` 先执行 abort → abort 触发 `askStream` 的 catch → catch 中 `AbortError` 直接 return → 然后 finally 执行清除 `lastRequestId`。但实际上 `stop()` 是在 `askStream` 的 await 之外被调用的，时序上 `stop()` 先执行，此时 `lastRequestId` 还在，应该能工作。

然而更大的问题是：`stop()` 先 abort controller，**然后** 才读 `lastRequestId`。abort 会让 `askStream` 进入 catch → finally → 清除 `lastRequestId`。由于 JS 单线程，这段逻辑在当前 tick 内不会被执行（`askStream` 内的 `reader.read()` 是个 pending promise，abort 后会在微任务中 reject），所以 `stop()` 的 `lastRequestId` 读取应该在同一个同步 tick 内完成，不会有问题。

**但仍存在问题**：正常流结束后 `lastRequestId` 被清除，如果用户在流刚结束的瞬间（finish 事件到前端之前）点击 Stop，cancel 请求不会发出。这不算严重 bug，但最佳实践是：**only clear `lastRequestId` in `stop()` itself, not in `finally`**。

**修复** — `HivemindConnection.ts` line 290-293:
```typescript
// 当前:
    } finally {
      this.activeStreamAbort = null;
      this.lastRequestId = null;   // ← 删除此行
    }

// 改为:
    } finally {
      this.activeStreamAbort = null;
      // Don't clear lastRequestId here — stop() needs it for cancel.
      // It will be cleared in stop() or at the start of the next ask/askStream call.
    }
```

同样，`ask()` 方法 line 173 也有 `this.lastRequestId = null;` — 非 streaming 模式下 `ask()` 是同步等待返回，用户无法在此期间点击 Stop（UI 没有 stop 按钮给非 streaming），所以这个清除也可以保留或移除。为了一致性，也删除：

```typescript
// ask() line 171-174 当前:
      const result = (await response.json()) as AskResponse;
      this.lastRequestId = result.request_id;  // ← 这一行也有问题，应该在请求前设置
      this.lastRequestId = null;
      return result;

// 实际上 line 172-173 是先赋值再立即清空，相当于没赋值。这是 Codex 的笔误。
// 修复为：只在请求发出后捕获 request_id，不要清除（由下次 ask/askStream 初始化时清除）

// 改为:
      const result = (await response.json()) as AskResponse;
      this.lastRequestId = result.request_id;
      return result;
```

**总结修改**:
| 行 | 修改 |
|---|------|
| `ask()` line 173 | 删除 `this.lastRequestId = null;` |
| `askStream()` finally line 292 | 删除 `this.lastRequestId = null;` |

`lastRequestId` 的生命周期变为：由 `ask()`/`askStream()` 开头的 `this.lastRequestId = null` 重置，由实际请求中捕获赋值，由 `stop()` 消费并清除。

---

### Fix 2: Thinking 节流缺失 — 高频 thinking 更新导致渲染卡顿

**文件**: `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx`

**问题**: Gemini 和 Codex 的 SendBox 都实现了 50ms 的 `throttledSetThought` 来限制 thinking 消息的渲染频率。Hivemind 直接调用 `setThought(message.data as ThoughtData)`（line 151），高频 thinking 更新会导致 React 频繁重渲染。

**修复** — 在 `HivemindSendBox.tsx` 中添加节流逻辑：

在 imports 区域确保有 `useMemo, useRef`（已有 `useMemo`，需确认 `useRef`）:
```typescript
// line 28 当前:
import React, { useCallback, useEffect, useMemo, useState } from 'react';
// 改为:
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

在 `const [thought, setThought] = ...` (line 56) 之后添加节流逻辑：

```typescript
  // Throttle thought updates to reduce render frequency
  const thoughtThrottleRef = useRef<{
    lastUpdate: number;
    pending: ThoughtData | null;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ lastUpdate: 0, pending: null, timer: null });

  const throttledSetThought = useMemo(() => {
    const THROTTLE_MS = 50;
    return (data: ThoughtData) => {
      const now = Date.now();
      const ref = thoughtThrottleRef.current;
      if (now - ref.lastUpdate >= THROTTLE_MS) {
        ref.lastUpdate = now;
        ref.pending = null;
        if (ref.timer) {
          clearTimeout(ref.timer);
          ref.timer = null;
        }
        setThought(data);
      } else {
        ref.pending = data;
        if (!ref.timer) {
          ref.timer = setTimeout(() => {
            ref.lastUpdate = Date.now();
            ref.timer = null;
            if (ref.pending) {
              setThought(ref.pending);
              ref.pending = null;
            }
          }, THROTTLE_MS - (now - ref.lastUpdate));
        }
      }
    };
  }, []);

  // Cleanup throttle timer
  useEffect(() => {
    return () => {
      if (thoughtThrottleRef.current.timer) {
        clearTimeout(thoughtThrottleRef.current.timer);
      }
    };
  }, []);
```

然后把 `responseStream.on` 中的 `case 'thought':`（line 150-152）从：
```typescript
        case 'thought':
          setThought(message.data as ThoughtData);
          break;
```
改为：
```typescript
        case 'thought':
          throttledSetThought(message.data as ThoughtData);
          break;
```

---

### Fix 3: `useHivemindStatus` 重连逻辑 — `retryCountRef` 不响应 React 渲染

**文件**: `src/renderer/hooks/useHivemindStatus.ts`

**问题**: 重连 useEffect（line 53-69）依赖 `connected` state 变化来触发，但 `retryCountRef.current` 是 ref 不触发 re-render。当 `refresh()` 完成但仍然断连时，`retryCountRef` 递增了但 useEffect 不会重新执行（因为 `connected` 没变，仍为 false）。这导致只重试 1 次就停止。

**修复** — 用 state 替代 ref：

```typescript
// 当前 (line 18):
  const retryCountRef = useRef(0);

// 改为:
  const [retryCount, setRetryCount] = useState(0);
```

在 `refresh()` 成功时重置 (line 33):
```typescript
// 当前:
      retryCountRef.current = 0;
// 改为:
      setRetryCount(0);
```

重连 useEffect (line 53-69) 改为：
```typescript
  // Auto-reconnect with exponential backoff
  useEffect(() => {
    if (connected || retryCount >= MAX_RETRIES) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF_MS);
    const timer = setTimeout(() => {
      setReconnecting(true);
      void refresh().finally(() => {
        setRetryCount((prev) => prev + 1);
        setReconnecting(false);
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [connected, retryCount, refresh]);
```

**注意**: `retryCount` 变为 state 后，每次 `setRetryCount` 都会触发 re-render → 重新执行 useEffect → 如果仍断连且 `retryCount < MAX_RETRIES`，则启动下一轮重试。这是正确的行为。

---

### Fix 4: i18n 缺少其他语言的 hivemind 键

**文件**: `src/renderer/i18n/locales/ja-JP.json`, `ko-KR.json`, `zh-TW.json`, `tr-TR.json`

**问题**: 只在 `en-US.json` 和 `zh-CN.json` 中添加了 `hivemind` 命名空间，其他 4 个 locale 文件没有。i18next 有 fallback 机制（fallback 到 `en-US`），所以不会崩溃，但会导致混合语言显示。

**修复**: 在以下文件的 JSON 末尾（最后一个 `}` 之前）添加 `"hivemind"` key。内容直接复制 `en-US.json` 中的 hivemind 块（英文 fallback，后续可翻译）:

- `src/renderer/i18n/locales/ja-JP.json`
- `src/renderer/i18n/locales/ko-KR.json`
- `src/renderer/i18n/locales/zh-TW.json`
- `src/renderer/i18n/locales/tr-TR.json`

每个文件添加的内容完全相同（复制 en-US.json line 1280-1317 的 hivemind 块）。

**注意**: `zh-TW.json` 可以用繁体中文翻译（把 `zh-CN.json` 的简体翻译转成繁体），其他语言保持英文 fallback。

`zh-TW.json` 的翻译：
```json
  "hivemind": {
    "placeholder": "傳送訊息給 Hivemind...",
    "processing": "處理中...",
    "providerLabel": "Provider",
    "autoRoute": "自動（智慧路由）",
    "autoRouteDescription": "已啟用自動路由。Hivemind 將為每個請求選擇最佳 Provider。",
    "routeMismatch": "請求: {{requested}} · 路由到: {{actual}}",
    "routeConfirmed": "Provider: {{provider}}",
    "settings": {
      "title": "Hivemind 閘道",
      "gatewayUrl": "閘道位址",
      "defaultProvider": "預設 Provider",
      "timeout": "逾時（秒）",
      "streaming": "串流傳輸",
      "cacheBypass": "繞過快取",
      "agentRole": "Agent 角色",
      "agentRolePlaceholder": "例如 architect",
      "connected": "已連線",
      "disconnected": "未連線",
      "refresh": "重新整理",
      "save": "儲存",
      "saveSuccess": "Hivemind 設定已儲存",
      "saveFailed": "儲存 Hivemind 設定失敗",
      "loadFailed": "載入 Hivemind 組態失敗",
      "uptime": "執行時間",
      "requests": "請求數",
      "active": "活躍",
      "enabledProviders": "已啟用 Provider",
      "gatewayUnreachable": "Hivemind 閘道不可達，請在 http://localhost:8765 啟動"
    },
    "status": {
      "reconnecting": "正在重新連線閘道...",
      "reconnectFailed": "閘道已斷線，正在重試..."
    },
    "tokens": "{{count}} tokens",
    "cached": "已快取",
    "thinking": "思考中"
  }
```

---

### Fix 5: `HivemindProviderBadge` 中 `cached`/`tokens` 文本未 i18n

**文件**: `src/renderer/pages/conversation/hivemind/HivemindProviderBadge.tsx`

**问题**: `cached` (line 29) 和 `⚡ {totalTokens.toLocaleString()} tokens` (line 36) 是硬编码英文。

**修复**:
```typescript
// 添加导入:
import { useTranslation } from 'react-i18next';

// 在组件内添加:
  const { t } = useTranslation();

// line 29 改为:
          {t('hivemind.cached')}

// line 36 改为:
        <Tag size='small'>⚡ {t('hivemind.tokens', { count: totalTokens.toLocaleString() })}</Tag>
```

---

### Fix 6: `renderFormat` 类型安全问题

**文件**: `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` line 363-384

**问题**: `renderFormat` 回调参数类型使用 `(option as { value?: string })?.value`，Arco Design 的 `renderFormat` 参数类型是 `(option: OptionInfo | null, value: string | string[]) => ReactNode`。直接 `as` 断言不安全。

**修复**: 使用 `renderFormat` 的第二个参数 `value` 而非从 option 中提取：

```typescript
// 当前 (line 363-385):
        renderFormat={(option) => {
          const optionValue = (option as { value?: string })?.value ?? '';
          const selected = HIVEMIND_PROVIDER_OPTIONS.find((opt) => opt.value === optionValue);
          const label = selected?.label ?? optionValue;
          const healthColor = getProviderHealthColor(optionValue);
          ...

// 改为:
        renderFormat={(_option, value) => {
          const optionValue = typeof value === 'string' ? value : '';
          const selected = HIVEMIND_PROVIDER_OPTIONS.find((opt) => opt.value === optionValue);
          const label = selected?.label ?? optionValue;
          const healthColor = getProviderHealthColor(optionValue);
          ...
```

**注意**: 需确认 Arco Design Select 的 `renderFormat` 签名。如果签名是 `(option: OptionInfo | null, value: string) => ReactNode`，上述修复正确。如果签名不同，按实际签名调整。

---

### 修复汇总

| # | 文件 | 问题 | 严重度 |
|---|------|------|--------|
| 1 | `HivemindConnection.ts` | `lastRequestId` 过早清除，cancel 在流结束后失效 | 中 |
| 2 | `HivemindSendBox.tsx` | thinking 无节流，高频更新卡顿 | 中 |
| 3 | `useHivemindStatus.ts` | 重连只尝试 1 次就停止 | 高 |
| 4 | `ja-JP/ko-KR/zh-TW/tr-TR.json` | 缺少 hivemind i18n 键 | 低 |
| 5 | `HivemindProviderBadge.tsx` | cached/tokens 文本未 i18n | 低 |
| 6 | `HivemindSendBox.tsx` | renderFormat 类型断言不安全 | 低 |

---

## Part 2: Plan C — Hivemind 功能迭代

Plan B 完成了基础通讯层增强。Plan C 目标是让 Hivemind 达到与 Gemini/Codex 同等的**用户体验水平**。

通过对比 GeminiSendBox (819 行) 和 CodexSendBox (463 行) 与 HivemindSendBox (462 行) 的功能差异，识别出以下 7 个增强项。

---

### Phase 1: 上下文与持久化

#### C-1.1 Token 使用持久化 + 上下文指示器

**问题**: Gemini 通过 `ContextUsageIndicator` 组件在发送按钮旁显示上下文窗口用量环形图，且通过 `ipcBridge.conversation.update` 持久化 `lastTokenUsage` 到数据库。Hivemind 只在内存中跟踪 tokens，刷新/切换会话后丢失。

**参考文件**:
- `src/renderer/components/ContextUsageIndicator.tsx` — 已有通用组件
- `src/common/storage.ts:121` — `TokenUsageData` 类型已定义
- `src/common/storage.ts:210-227` — Hivemind 会话类型定义（无 `lastTokenUsage` 字段）

**修改文件**:
- `src/common/storage.ts` — Hivemind extra 添加 `lastTokenUsage?: TokenUsageData`
- `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` — 持久化 token 到数据库 + 加载已有 token + 显示 ContextUsageIndicator
- `src/agent/hivemind/index.ts` — 无需修改（已在 agent_status 中传递 totalTokens）

**实现步骤**:

**Step 1**: `src/common/storage.ts` — 在 Hivemind 会话类型 (line 210-227) 的 extra 中添加：
```typescript
          lastTokenUsage?: TokenUsageData;
```

**Step 2**: `HivemindSendBox.tsx` — 导入并使用 ContextUsageIndicator：

```typescript
// 添加 imports:
import type { TokenUsageData } from '@/common/storage';
import ContextUsageIndicator from '@/renderer/components/ContextUsageIndicator';

// 添加 state:
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData | null>(null);

// 在 conversation_id 变化时重置 (已有的 useEffect 中):
    setTokenUsage(null);

// 在 agent_status case 中 (line 153-172)，当收到 totalTokens 时持久化:
          if (typeof statusData.totalTokens === 'number' && statusData.totalTokens > 0) {
            setLastTokens(statusData.totalTokens);
            const newTokenUsage: TokenUsageData = { totalTokens: statusData.totalTokens };
            setTokenUsage(newTokenUsage);
            // Persist to database
            void ipcBridge.conversation.update.invoke({
              id: conversation_id,
              updates: {
                extra: { lastTokenUsage: newTokenUsage } as any,
              },
              mergeExtra: true,
            });
          }

// 在 conversation.get useEffect (line 185-201) 中加载已有 token:
      .then((conversation) => {
        // ... 已有逻辑 ...
        // 加载持久化的 token 使用统计
        if (conversation?.extra?.lastTokenUsage) {
          const { lastTokenUsage } = conversation.extra as { lastTokenUsage?: TokenUsageData };
          if (lastTokenUsage && lastTokenUsage.totalTokens > 0) {
            setTokenUsage(lastTokenUsage);
            setLastTokens(lastTokenUsage.totalTokens);
          }
        }
      })

// 在 SendBox 的 sendButtonPrefix 中，在 providerSelector 前添加指示器:
        sendButtonPrefix={
          <>
            <ContextUsageIndicator tokenUsage={tokenUsage} size={24} />
            {providerSelector}
          </>
        }
```

---

#### C-1.2 System Prompt / Preset Rules 支持

**问题**: Gemini 会话支持 `presetRules`（系统指令），用户可为不同会话设定不同的行为规则。Hivemind 没有此功能。

**参考**: `src/common/storage.ts:136` — Gemini extra 有 `presetRules?: string`

**修改文件**:
- `src/common/storage.ts` — Hivemind extra 添加 `systemPrompt?: string`
- `src/agent/hivemind/types.ts` — `AskRequest` 添加 `system_prompt?: string`
- `src/agent/hivemind/HivemindConnection.ts` — 传递 `system_prompt`
- `src/agent/hivemind/index.ts` — 从 config 读取 system_prompt
- `src/agent/hivemind/types.ts` — `HivemindConfig` 添加 `systemPrompt`
- `src/renderer/components/SettingsModal/contents/HivemindModalContent.tsx` — 添加 System Prompt 文本框
- `src/renderer/i18n/locales/en-US.json` + `zh-CN.json` — 添加翻译 key

**实现步骤**:

**Step 1**: `types.ts` 扩展:
```typescript
// HivemindConfig 添加:
  systemPrompt: string | null;

// DEFAULT_HIVEMIND_CONFIG 添加:
  systemPrompt: null,

// AskRequest 添加:
  system_prompt?: string | null;
```

**Step 2**: `HivemindConnection.ts` — 在 `ask()` 和 `askStream()` 的 requestBody 构造中：
```typescript
    if (this.config.systemPrompt) {
      requestBody.system_prompt = this.config.systemPrompt;
    }
```

**Step 3**: `HivemindAgentManager.ts` — 在 mergedConfig 中：
```typescript
        systemPrompt: data.systemPrompt ?? globalConfig.systemPrompt,
```

**Step 4**: `HivemindAgentManagerData` 接口添加:
```typescript
  systemPrompt?: string | null;
```

**Step 5**: `storage.ts` — Hivemind extra 添加:
```typescript
          systemPrompt?: string;
```

**Step 6**: `HivemindModalContent.tsx` — 在 Form 中添加 System Prompt textarea:
```tsx
          <Form.Item label={t('hivemind.settings.systemPrompt')}>
            <Input.TextArea
              value={config.systemPrompt || ''}
              placeholder={t('hivemind.settings.systemPromptPlaceholder')}
              autoSize={{ minRows: 2, maxRows: 6 }}
              onChange={(value) => {
                setConfig((prev) => ({
                  ...prev,
                  systemPrompt: value.trim() ? value.trim() : null,
                }));
              }}
            />
          </Form.Item>
```

**Step 7**: i18n 添加:
```json
// en-US.json hivemind.settings:
      "systemPrompt": "System Prompt",
      "systemPromptPlaceholder": "Optional system instructions for the AI...",

// zh-CN.json hivemind.settings:
      "systemPrompt": "系统提示词",
      "systemPromptPlaceholder": "可选的 AI 系统指令...",
```

---

### Phase 2: 交互增强

#### C-2.1 消息重新生成 (Regenerate)

**问题**: 用户收到不满意的回复时，无法一键重新生成。需要手动重新输入相同内容。

**修改文件**:
- `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` — 添加 regenerate 事件监听
- `src/process/task/HivemindAgentManager.ts` — 添加 regenerate 方法

**实现步骤**:

**Step 1**: 在 `HivemindAgentManager` 中添加 `regenerateLastMessage` 方法：

```typescript
  async regenerateLastMessage(): Promise<void> {
    if (!this.agent) return;

    // Get last user message from database
    const messages = await ipcBridge.database.getConversationMessages.invoke({
      conversation_id: this.conversation_id,
      page: 0,
      pageSize: 10,
    });

    // Find last user message (position: 'right')
    const lastUserMsg = [...(messages || [])].reverse().find(
      (msg) => msg.position === 'right' && msg.type === 'text'
    );

    if (!lastUserMsg?.content?.content) return;

    // Re-send the same message
    await this.sendMessage({
      content: lastUserMsg.content.content,
      msg_id: uuid(),
      provider: this.options.defaultProvider,
    });
  }
```

**Step 2**: 在 `HivemindSendBox.tsx` 中监听 regenerate 事件：

```typescript
  // 监听消息重新生成事件
  useAddEventListener(
    'hivemind.regenerate',
    () => {
      if (aiProcessing || running) return;
      void ipcBridge.conversation.regenerate?.invoke({ conversation_id }).catch(console.error);
    },
    [conversation_id, aiProcessing, running]
  );
```

**注意**: 需要确认 `ipcBridge.conversation` 是否有 `regenerate` 方法。如果没有，可以通过直接在 SendBox 中记录上一条消息内容的方式实现：

```typescript
  // 更简单的方案：记录上一条发送的消息
  const lastSentMessageRef = useRef<string>('');

  // 在 onSendHandler 中保存:
    lastSentMessageRef.current = message;

  // 在 JSX 中添加重新生成按钮（在消息底部或 SendBox 上方）:
  const handleRegenerate = useCallback(() => {
    if (!lastSentMessageRef.current || aiProcessing || running) return;
    void onSendHandler(lastSentMessageRef.current);
  }, [aiProcessing, running]);
```

---

#### C-2.2 工作空间文件选择 (@ Mention Files)

**问题**: Gemini 和 Codex 支持 `atPath` 功能 — 用户可以通过 @ 选择工作空间中的文件/文件夹，自动附加到消息中。Hivemind 只支持上传文件，不支持工作空间文件引用。

**参考**:
- Gemini: `useAddEventListener('gemini.selected.file', setAtPath)` — 工作空间面板选择文件后设置 atPath
- Codex: `useAddEventListener('codex.selected.file', ...)` — 同样

**修改文件**:
- `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` — 添加 atPath state + 事件监听 + UI 渲染
- `src/renderer/hooks/useSendBoxDraft.ts` — Hivemind draft 的 `atPath` 已存在（line 33-38 中 `atPath: []`）

**实现步骤**:

**Step 1**: 在 `HivemindSendBox.tsx` 中添加 atPath 状态管理：

```typescript
// 从 draft 中解构 atPath (当前 line 59-61):
  const content = data?.content ?? '';
  const uploadFile = data?.uploadFile ?? [];
  const selectedProvider = data?.selectedProvider ?? null;
  const atPath = data?.atPath ?? [];   // 添加

// 添加 setAtPath callback (类似 setContent 模式):
  const setAtPath = useCallback(
    (value: Array<string | FileOrFolderItem>) => {
      mutate((prev) => ({
        _type: 'hivemind',
        atPath: value,
        uploadFile: prev?.uploadFile ?? [],
        selectedProvider: prev?.selectedProvider ?? null,
        content: prev?.content ?? '',
      }));
    },
    [mutate]
  );
```

**Step 2**: 添加事件监听：
```typescript
  // 导入:
  import { mergeFileSelectionItems } from '@/renderer/utils/fileSelection';
  import type { FileOrFolderItem } from '@/renderer/hooks/useSendBoxDraft';

  const atPathRef = useLatestRef(atPath);

  useAddEventListener('hivemind.selected.file', setAtPath);
  useAddEventListener('hivemind.selected.file.append', (items: Array<string | FileOrFolderItem>) => {
    const merged = mergeFileSelectionItems(atPathRef.current, items);
    if (merged !== atPathRef.current) {
      setAtPath(merged as Array<string | FileOrFolderItem>);
    }
  });
```

**Step 3**: 在 `onSendHandler` 中收集文件：
```typescript
  // 导入:
  import { collectSelectedFiles } from '@/renderer/utils/messageFiles';

  // 在 onSendHandler 中:
    const filesToSend = collectSelectedFiles(uploadFile, atPath);
    const currentAtPath = [...atPath];
    setAtPath([]);

    // 使用 filesToSend 替代 currentUploadFiles 传给后端
    const displayMessage = buildDisplayMessage(message, filesToSend, workspacePath);
    // ... 把 files: filesToSend 传给 sendMessage
```

**Step 4**: 在 prefix 中渲染文件和文件夹标签（参照 Codex/Gemini 的模式）。

---

#### C-2.3 多行输入锁定

**问题**: Gemini SendBox 使用了 `defaultMultiLine={true}` 和 `lockMultiLine={true}`，让用户在编辑长 prompt 时始终有多行输入框。Hivemind 没有设置这些 prop。

**修改文件**: `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx`

**修复**: 在 `<SendBox>` 组件上添加：
```tsx
        defaultMultiLine={true}
        lockMultiLine={true}
```

这是一行代码的改动。

---

### Phase 3: 错误处理与韧性

#### C-3.1 配额/限流错误自动降级

**问题**: Gemini 实现了完整的配额错误检测 + 自动切换模型逻辑 (`isQuotaErrorMessage`, `resolveFallbackTarget`)。Hivemind 的多 Provider 架构天然适合此功能 — 当一个 Provider 报 429/quota 错误时，可自动切换到另一个 Provider。

**修改文件**:
- `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` — 检测错误类型 + 自动切换 Provider
- `src/agent/hivemind/index.ts` — 在错误消息中保留 HTTP 状态码信息

**实现步骤**:

**Step 1**: 在 `HivemindSendBox.tsx` 中添加错误检测：

```typescript
  const isQuotaError = useCallback((errorText: string): boolean => {
    const text = errorText.toLowerCase();
    return (
      text.includes('429') ||
      text.includes('quota') ||
      text.includes('rate_limit') ||
      text.includes('resource_exhausted') ||
      text.includes('too many requests')
    );
  }, []);

  const exhaustedProvidersRef = useRef(new Set<string>());
```

**Step 2**: 在 `responseStream.on` 的 `error` case 中添加自动降级：

```typescript
        case 'error': {
          setRunning(false);
          setAiProcessing(false);

          // Auto-fallback on quota errors
          const errorMsg = typeof message.data === 'string' ? message.data : '';
          if (isQuotaError(errorMsg) && lastProvider) {
            exhaustedProvidersRef.current.add(lastProvider);
            // Find next available provider
            const available = providers.filter(
              (p) => p.enabled !== false &&
                     p.status !== 'offline' &&
                     !exhaustedProvidersRef.current.has(p.name)
            );
            if (available.length > 0) {
              const fallback = available[0].name;
              setSelectedProvider(fallback);
              Message.warning(t('hivemind.quotaSwitched', { from: lastProvider, to: fallback }));
              break; // Don't render error, auto-retry with new provider
            }
          }
          break;
        }
```

**Step 3**: 添加 i18n keys:
```json
// en-US.json hivemind:
    "quotaSwitched": "{{from}} quota exceeded, switched to {{to}}",
    "quotaExhausted": "All providers quota exceeded. Please wait and try again.",

// zh-CN.json hivemind:
    "quotaSwitched": "{{from}} 配额已用尽，已切换到 {{to}}",
    "quotaExhausted": "所有 Provider 配额已用尽，请稍后重试。",
```

---

#### C-3.2 Streaming 错误恢复 — 部分响应保留

**问题**: 当 streaming 中途断开时（网络中断、Gateway 崩溃），已收到的部分内容会因为 `streamError` 被错误消息覆盖。用户丢失已生成的部分回答。

**修改文件**:
- `src/agent/hivemind/index.ts` — streaming 错误时保留已有内容，追加错误提示

**实现步骤**:

在 `send()` 的 streaming 模式中（line 110-113），修改错误处理：

```typescript
// 当前:
      if (streamError) {
        this.onStreamEvent(this.adapter.createError(responseMsgId, streamError.message));
      }

// 改为:
      if (streamError) {
        // Append error notice rather than replacing content
        // This preserves any partial response already streamed
        this.onStreamEvent(this.adapter.createContent(
          responseMsgId,
          `\n\n---\n⚠️ Stream interrupted: ${streamError.message}`
        ));
      }
```

---

### Phase 4: 设置面板增强

#### C-4.1 Provider 详细状态面板

**问题**: HivemindModalContent 只显示 "Enabled providers: N" 数字，不显示每个 Provider 的具体健康状态、延迟、成功率。

**修改文件**:
- `src/renderer/components/SettingsModal/contents/HivemindModalContent.tsx`

**实现步骤**:

在 `enabledProviders` 区域下方（line 84 后），添加 Provider 详细列表：

```tsx
      {enabledProviders.length > 0 && (
        <Card>
          <Typography.Title heading={6} style={{ margin: '0 0 12px 0' }}>
            {t('hivemind.settings.providerStatus')}
          </Typography.Title>
          <div className='flex flex-col gap-8px'>
            {enabledProviders.map((provider) => (
              <div key={provider.name} className='flex items-center justify-between text-13px'>
                <Space>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor:
                        provider.status === 'healthy' || provider.status === 'ok'
                          ? '#00b42a'
                          : provider.status === 'degraded'
                            ? '#ff7d00'
                            : '#f53f3f',
                      display: 'inline-block',
                    }}
                  />
                  <Typography.Text bold>{provider.name}</Typography.Text>
                  <Tag size='small' color={provider.status === 'healthy' || provider.status === 'ok' ? 'green' : 'orange'}>
                    {provider.status}
                  </Tag>
                </Space>
                <Space className='text-t-secondary'>
                  {typeof provider.avg_latency_ms === 'number' && (
                    <span>{(provider.avg_latency_ms / 1000).toFixed(1)}s avg</span>
                  )}
                  {typeof provider.success_rate === 'number' && (
                    <span>{(provider.success_rate * 100).toFixed(0)}%</span>
                  )}
                  {typeof provider.total_requests === 'number' && (
                    <span>{provider.total_requests} reqs</span>
                  )}
                </Space>
              </div>
            ))}
          </div>
        </Card>
      )}
```

**i18n**:
```json
// en-US.json hivemind.settings:
      "providerStatus": "Provider Status",

// zh-CN.json hivemind.settings:
      "providerStatus": "Provider 状态",
```

---

## 文件修改清单

### Part 1: Bug Fix

| # | 文件 | Fix # | 修改 |
|---|------|-------|------|
| 1 | `src/agent/hivemind/HivemindConnection.ts` | Fix 1 | 删除 2 行 lastRequestId 清除 |
| 2 | `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` | Fix 2, 6 | 添加 thought 节流 + renderFormat 类型修复 |
| 3 | `src/renderer/hooks/useHivemindStatus.ts` | Fix 3 | retryCountRef → retryCount state |
| 4 | `src/renderer/i18n/locales/ja-JP.json` | Fix 4 | 添加 hivemind 命名空间 |
| 5 | `src/renderer/i18n/locales/ko-KR.json` | Fix 4 | 添加 hivemind 命名空间 |
| 6 | `src/renderer/i18n/locales/zh-TW.json` | Fix 4 | 添加 hivemind 命名空间（繁体翻译） |
| 7 | `src/renderer/i18n/locales/tr-TR.json` | Fix 4 | 添加 hivemind 命名空间 |
| 8 | `src/renderer/pages/conversation/hivemind/HivemindProviderBadge.tsx` | Fix 5 | i18n cached/tokens |

### Part 2: Plan C

| # | 文件 | 增强项 | 修改 |
|---|------|--------|------|
| 1 | `src/common/storage.ts` | C-1.1, C-1.2 | Hivemind extra 添加 lastTokenUsage + systemPrompt |
| 2 | `src/agent/hivemind/types.ts` | C-1.2 | Config/AskRequest 添加 systemPrompt/system_prompt |
| 3 | `src/agent/hivemind/HivemindConnection.ts` | C-1.2 | 传递 system_prompt |
| 4 | `src/agent/hivemind/index.ts` | C-3.2 | streaming 错误保留部分响应 |
| 5 | `src/process/task/HivemindAgentManager.ts` | C-1.2 | mergedConfig 添加 systemPrompt |
| 6 | `src/renderer/pages/conversation/hivemind/HivemindSendBox.tsx` | C-1.1, C-2.1, C-2.2, C-2.3, C-3.1 | token 持久化、regenerate、atPath、multiLine、quota 降级 |
| 7 | `src/renderer/components/SettingsModal/contents/HivemindModalContent.tsx` | C-1.2, C-4.1 | system prompt 输入 + provider 详细面板 |
| 8 | `src/renderer/i18n/locales/en-US.json` | C-1.2, C-3.1, C-4.1 | 新增翻译 key |
| 9 | `src/renderer/i18n/locales/zh-CN.json` | C-1.2, C-3.1, C-4.1 | 新增翻译 key |

---

## 执行顺序

### 阶段一：先修 Bug（Part 1），再验证

```
1. Fix 1 — HivemindConnection.ts (lastRequestId)
2. Fix 2 — HivemindSendBox.tsx (thought throttle)
3. Fix 3 — useHivemindStatus.ts (reconnect state)
4. Fix 4 — 4 个 locale JSON 文件
5. Fix 5 — HivemindProviderBadge.tsx
6. Fix 6 — HivemindSendBox.tsx (renderFormat)
7. npm install && npm run lint (验证无类型/语法错误)
```

### 阶段二：Plan C 功能迭代

```
8.  C-1.2 — System Prompt (types → connection → manager → modal → i18n)
9.  C-1.1 — Token 持久化 + ContextUsageIndicator
10. C-2.3 — 多行输入锁定 (1 行改动)
11. C-2.2 — @ Mention 工作空间文件
12. C-2.1 — 消息重新生成
13. C-3.2 — Streaming 错误保留部分响应
14. C-3.1 — 配额自动降级
15. C-4.1 — Provider 详细状态面板
16. npm run lint (最终验证)
```

---

## Commit 建议

```
fix(hivemind): fix cancel protocol, thought throttling, and reconnect logic

- Remove premature lastRequestId clearing in askStream finally block
- Add 50ms thought display throttling to prevent render thrashing
- Use retryCount state instead of ref for proper reconnect retries
- Add hivemind i18n keys to ja-JP, ko-KR, zh-TW, tr-TR locales
- Fix renderFormat type safety in provider selector
```

```
feat(hivemind): add system prompt support and token persistence

- Add systemPrompt field to HivemindConfig and AskRequest
- Persist token usage to database via conversation.update
- Display ContextUsageIndicator next to provider selector
- Add system prompt textarea in Hivemind settings panel
```

```
feat(hivemind): add workspace file selection and multiline input

- Support @mention workspace files via atPath (matching Gemini/Codex)
- Listen for hivemind.selected.file events from workspace panel
- Enable multiline input mode by default
```

```
feat(hivemind): add quota auto-fallback and streaming error recovery

- Detect 429/quota errors and auto-switch to next available provider
- Preserve partial streaming response on connection errors
- Add provider detail panel in settings with health/latency/success metrics
```

---

## 注意事项

1. **不要添加 AI 署名**到 commits（项目 CLAUDE.md 强制）
2. **代码注释用英文**
3. **TypeScript strict mode** — 确保所有新代码类型安全
4. **先运行 `npm install`** — 当前无 node_modules
5. **i18n 插值语法** 用 `{{variable}}`
6. **路径别名**: `@/`, `@process/`, `@renderer/`, `@worker/`
7. **Arco Design 导入**: 从 `@arco-design/web-react` 导入，不要自造组件
8. **ESLint**: 执行 `npm run lint:fix`
