# Hivemind ↔ AionUi 项目合并计划

**日期**: 2026-02-10
**执行者**: Codex
**目标**: 将 Desktop AionUi (含 Hivemind 集成) 完整合并到 Hivemind 仓库

---

## 一、当前状态

### Desktop AionUi (`/Users/leo/Desktop/AionUi`)

| 分类 | 状态 | 说明 |
|------|------|------|
| **Plan A** | ✅ 完成 | 基础 Hivemind 集成（11 文件，~1,400 行） |
| **Plan B** | ✅ 完成 | 8 项功能增强（3 个 Phase） |
| **Plan B-fix** | ✅ 完成 | 6 个 Bug 修复 |
| **Plan C** | 🟡 部分完成 | 7 项功能中完成 4 项 |
| **Git 状态** | ⚠️ 未提交 | 34 个修改文件 + 8 个新增文件 |
| **Remote** | `iOfficeAI/AionUi.git` | 原始上游仓库（不推送 Hivemind 改动） |

### Hivemind Repo (`~/.local/share/codex-dual/`)

| 分类 | 状态 | 说明 |
|------|------|------|
| **AionUi 子目录** | 🟡 Plan A only | 有 Plan A 的旧版本 |
| **Git 状态** | 干净 | `AionUi/` 显示为 untracked |
| **Remote** | `LeoLin990405/Hivemind.git` | 目标推送仓库 |

### 差异文件清单

Desktop 比 codex-dual/AionUi/ 多出的改动（Plan B + B-fix + Plan C 部分）:

```
20 个 Hivemind 核心文件有差异:
- src/agent/hivemind/*.ts (4 files)
- src/renderer/pages/conversation/hivemind/*.tsx (4 files)
- src/renderer/hooks/useHivemindStatus.ts
- src/renderer/components/SettingsModal/contents/HivemindModalContent.tsx
- src/common/storage.ts
- src/common/ipcBridge.ts
- src/process/initAgent.ts
- src/process/task/HivemindAgentManager.ts
- src/renderer/i18n/locales/*.json (6 files)
```

---

## 二、Plan C 完成度分析

### ✅ 已完成（4/7）

| # | 功能 | 验证点 |
|---|------|--------|
| **C-1.1** | Token 使用持久化 + ContextUsageIndicator | `tokenUsage` state, `lastTokenUsage` in storage, ContextUsageIndicator 渲染 |
| **C-1.2** | System Prompt 支持 | `systemPrompt` in types/config/storage, UI textarea 在 HivemindModalContent |
| **C-2.2** | 工作空间文件选择 (@mention) | `atPath` state, `hivemind.selected.file` 事件监听, collectSelectedFiles |
| **C-2.3** | 多行输入锁定 | `defaultMultiLine={true}` + `lockMultiLine={true}` |

### ❌ 未实现（3/7）

| # | 功能 | 原因/说明 |
|---|------|-----------|
| **C-2.1** | 消息重新生成 (Regenerate) | 未找到 `regenerate` 事件监听或 `lastSentMessageRef` |
| **C-3.1** | 配额/限流错误自动降级 | 未找到 `isQuotaError`, `exhaustedProvidersRef` 逻辑 |
| **C-3.2** | Streaming 错误保留部分响应 | `index.ts` line 111 仍使用 `createError`，未追加错误而是覆盖 |
| **C-4.1** | Provider 详细状态面板 | HivemindModalContent 无 provider 列表卡片（文件仅 177 行） |

---

## 三、合并执行步骤

### Phase 1: 同步代码

```bash
# 1. Rsync Desktop → codex-dual/AionUi/ (排除 .git, node_modules, PLAN 文档)
rsync -av \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='PLAN_*.md' \
  --delete \
  /Users/leo/Desktop/AionUi/ \
  /Users/leo/.local/share/codex-dual/AionUi/

# 2. 验证同步结果
cd /Users/leo/.local/share/codex-dual/AionUi
ls -la src/agent/hivemind/
ls -la src/renderer/pages/conversation/hivemind/
```

**预期**: Desktop 的所有改动（Plan A + B + B-fix + Plan C 部分）全部同步到 codex-dual/AionUi/

### Phase 2: 安装依赖 + Lint

```bash
cd /Users/leo/.local/share/codex-dual/AionUi

# 1. 安装依赖
npm install

# 2. 运行 lint 检查
npm run lint

# 3. 如有问题自动修复
npm run lint:fix
```

**预期**: 无 TypeScript 错误，无 ESLint 错误

### Phase 3: 移动 PLAN 文档

```bash
# 将 PLAN 文档移到 Hivemind 仓库的 docs/ 目录（不放在 AionUi/ 子目录）
mv /Users/leo/Desktop/AionUi/PLAN_B_HIVEMIND_ENHANCEMENT.md \
   /Users/leo/.local/share/codex-dual/docs/

mv /Users/leo/Desktop/AionUi/PLAN_BFIX_AND_C_HIVEMIND.md \
   /Users/leo/.local/share/codex-dual/docs/

mv /Users/leo/Desktop/AionUi/HIVEMIND_MERGE_PLAN.md \
   /Users/leo/.local/share/codex-dual/docs/
```

### Phase 4: Git Commit 到 Hivemind 仓库

```bash
cd /Users/leo/.local/share/codex-dual

# 1. 查看状态
git status

# 2. Add AionUi 目录（首次添加）
git add AionUi/

# 3. Add PLAN 文档
git add docs/PLAN_*.md docs/HIVEMIND_MERGE_PLAN.md

# 4. 提交
git commit -m "$(cat <<'EOF'
feat(aionui): integrate AionUi v1.8.5 with Hivemind Gateway

- Add complete AionUi desktop app as subdirectory
- Implement Hivemind agent integration (Plan A+B+B-fix+C partial)
- Support 9 AI providers via Gateway API (Kimi/Qwen/DeepSeek/etc.)
- Add token persistence, system prompt, workspace file selection
- Support SSE streaming with thought display and context indicators
- Add i18n for hivemind namespace (6 locales)

Plan completion:
- Plan A: ✅ Basic integration (11 files, ~1,400 lines)
- Plan B: ✅ 8 enhancements (connection status, retry, i18n, thought display)
- Plan B-fix: ✅ 6 bug fixes (cancel protocol, throttling, reconnect)
- Plan C: 🟡 4/7 features (token persistence, system prompt, atPath, multiLine)

Remaining Plan C features (C-2.1, C-3.1, C-3.2, C-4.1) tracked in docs/PLAN_BFIX_AND_C_HIVEMIND.md
EOF
)"

# 5. 验证 commit
git log -1 --stat
```

### Phase 5: 推送到 Hivemind Remote

```bash
# 1. 检查 remote
git remote -v
# 应显示: origin  https://github.com/LeoLin990405/Hivemind.git

# 2. Push
git push origin main

# 3. 验证远程仓库
# 访问 https://github.com/LeoLin990405/Hivemind 确认 AionUi/ 目录已存在
```

### Phase 6: 清理 Desktop AionUi

```bash
cd /Users/leo/Desktop/AionUi

# 选项 A: 还原所有 Hivemind 改动（因为已合并到 Hivemind 仓库）
git checkout .
git clean -fd  # 删除 untracked 文件（hivemind 目录、PLAN 文档等）

# 选项 B: 保留当前状态（作为独立的集成版本）
# 什么都不做，或者切换到新分支
git checkout -b hivemind-integration
```

**推荐选项 A**: 因为 Desktop AionUi 的 remote 是 `iOfficeAI/AionUi.git`，我们不打算向原仓库推送 Hivemind 改动。Hivemind 改动已经完整归入 Hivemind 仓库。

---

## 四、验证清单

合并完成后，验证以下项目：

### 代码层面

- [ ] `codex-dual/AionUi/src/agent/hivemind/` 目录存在且包含 4 个文件
- [ ] `codex-dual/AionUi/src/renderer/pages/conversation/hivemind/` 目录存在且包含 4 个文件
- [ ] `npm run lint` 无错误
- [ ] `git log` 显示最新 commit 包含 AionUi 集成
- [ ] `git remote -v` 确认 remote 是 Hivemind 仓库

### GitHub 远程仓库

- [ ] 访问 `https://github.com/LeoLin990405/Hivemind`
- [ ] 确认 `AionUi/` 目录可见
- [ ] 确认 `docs/PLAN_*.md` 文件存在
- [ ] 最新 commit 显示 "feat(aionui): integrate AionUi..."

### 功能验证（可选 - 需要运行 AionUi）

```bash
cd /Users/leo/.local/share/codex-dual/AionUi
npm start
```

- [ ] 启动后能看到 Hivemind 会话选项
- [ ] Settings 中有 Hivemind Gateway 配置面板
- [ ] 能连接到 `http://localhost:8765` (需要先启动 Gateway)
- [ ] Token 使用量显示在发送按钮旁（ContextUsageIndicator）
- [ ] System Prompt 文本框可用
- [ ] 工作空间文件可以 @mention

---

## 五、后续工作（Plan C 未完成功能）

以下 3 个 Plan C 功能未在此次合并中实现，可作为后续迭代：

### C-2.1 消息重新生成

**文件**: `HivemindSendBox.tsx`

**修改**:
```typescript
// 添加 ref 记录最后发送的消息
const lastSentMessageRef = useRef<string>('');

// 在 onSendHandler 中保存
lastSentMessageRef.current = message;

// 监听 regenerate 事件
useAddEventListener(
  'hivemind.regenerate',
  () => {
    if (!lastSentMessageRef.current || aiProcessing || running) return;
    void onSendHandler(lastSentMessageRef.current);
  },
  [aiProcessing, running]
);
```

### C-3.1 配额/限流错误自动降级

**文件**: `HivemindSendBox.tsx`

**修改**:
```typescript
// 添加 quota 检测函数
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

// 添加已耗尽 provider 追踪
const exhaustedProvidersRef = useRef(new Set<string>());

// 在 error case 中添加自动降级逻辑
case 'error': {
  const errorMsg = typeof message.data === 'string' ? message.data : '';
  if (isQuotaError(errorMsg) && lastProvider) {
    exhaustedProvidersRef.current.add(lastProvider);
    // 查找下一个可用 provider
    const available = providers.filter(
      (p) => p.enabled !== false &&
             p.status !== 'offline' &&
             !exhaustedProvidersRef.current.has(p.name)
    );
    if (available.length > 0) {
      const fallback = available[0].name;
      setSelectedProvider(fallback);
      Message.warning(t('hivemind.quotaSwitched', { from: lastProvider, to: fallback }));
      break; // 不渲染错误，自动重试
    }
  }
  // ... 原有错误处理
}
```

**i18n**:
```json
// en-US.json
"quotaSwitched": "{{from}} quota exceeded, switched to {{to}}",

// zh-CN.json
"quotaSwitched": "{{from}} 配额已用尽，已切换到 {{to}}",
```

### C-3.2 Streaming 错误保留部分响应

**文件**: `src/agent/hivemind/index.ts` line 110-112

**修改**:
```typescript
// 当前:
if (streamError) {
  this.onStreamEvent(this.adapter.createError(responseMsgId, streamError.message));
}

// 改为:
if (streamError) {
  // Append error notice rather than replacing content
  this.onStreamEvent(this.adapter.createContent(
    responseMsgId,
    `\n\n---\n⚠️ Stream interrupted: ${streamError.message}`
  ));
}
```

### C-4.1 Provider 详细状态面板

**文件**: `HivemindModalContent.tsx` (在 line 172 `</Card>` 后添加)

**修改**:
```tsx
      {enabledProviders.length > 0 && (
        <Card style={{ marginTop: 16 }}>
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
// en-US.json hivemind.settings
"providerStatus": "Provider Status",

// zh-CN.json hivemind.settings
"providerStatus": "Provider 状态",
```

---

## 六、注意事项

### Git 规范（CRITICAL）

⚠️ **绝对禁止** 在 commit 中添加任何 AI 署名:
- ❌ `Co-Authored-By: Claude`
- ❌ `Co-Authored-By: Codex`
- ❌ `🤖 Generated with ...`

✅ **正确**: 仅使用项目规范的 commit message 格式

### 代码规范

- 注释用英文
- TypeScript strict mode
- `type` over `interface` (per ESLint)
- Path aliases: `@/`, `@process/`, `@renderer/`
- UnoCSS atomic classes for styling
- Arco Design components (no custom reimplementation)

### i18n 规范

- 插值语法: `{{variable}}`
- 6 个 locale 文件必须同步更新
- 键命名: `namespace.category.key` (e.g., `hivemind.settings.systemPrompt`)

---

## 七、执行确认

执行完成后，回复以下信息：

```
✅ Phase 1: 代码同步完成 (rsync 输出)
✅ Phase 2: npm install + lint 通过
✅ Phase 3: PLAN 文档已移动
✅ Phase 4: Git commit 完成 (commit SHA)
✅ Phase 5: Push 到 Hivemind 完成 (GitHub link)
✅ Phase 6: Desktop AionUi 清理完成

验证:
- codex-dual/AionUi 文件数: [数量]
- 最新 commit SHA: [hash]
- GitHub 可见: [链接]
```

---

## 八、时间线

- **Plan A**: 2026-02-09 完成
- **Plan B**: 2026-02-10 上午完成
- **Plan B-fix**: 2026-02-10 中午完成
- **Plan C 部分**: 2026-02-10 下午完成
- **合并执行**: 2026-02-10 (待执行)

---

**文档版本**: v1.0
**作者**: Claude Sonnet 4.5
**执行者**: Codex
