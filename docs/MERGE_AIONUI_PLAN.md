# Hivemind + AionUI 合并上传计划 — Codex 执行文档

**日期**: 2026-02-10
**执行者**: Codex
**目标**: 将 Desktop 版 AionUI（含 Hivemind 集成）合并进 Hivemind 仓库，推送到 GitHub

---

## 前置条件

| 项目 | 路径 | 状态 |
|------|------|------|
| Hivemind 后端 | `/Users/leo/.local/share/codex-dual` | main 分支，remote = `origin https://github.com/LeoLin990405/Hivemind.git` |
| AionUI (Codex 修改版) | `/Users/leo/Desktop/AionUi` | 含完整 Hivemind 集成（11 新文件 + 22 修改文件），有嵌套 `.git/`(355MB) |
| AionUI (原版，待替换) | `/Users/leo/.local/share/codex-dual/AionUi/` | 未跟踪，无 Hivemind 集成 |
| GitHub Remote | `LeoLin990405/Hivemind` | 最新 commit: `b212e2a` (Feb 9) |

**当前未提交变更**:
- 27 个已修改文件（`bin/*` CLI 工具 + `.ccb_config/*` session 文件）
- 6 个新增未跟踪文件（`.ccb_config/` session 文件）
- 1 个未跟踪目录: `AionUi/`
- 1 个未跟踪目录: `data/`
- 1 个未跟踪文件: `docs/AIONUI_HIVEMIND_INTEGRATION_v1.md`

---

## Step 1: 更新 .gitignore

**文件**: `/Users/leo/.local/share/codex-dual/.gitignore`

在现有内容末尾追加以下规则:

```gitignore

# === AionUI Electron App ===
AionUi/node_modules/
AionUi/out/
AionUi/dist/
AionUi/.vite/
AionUi/.webpack/
AionUi/coverage/
AionUi/.nyc_output/
AionUi/bun.lock
AionUi/package-lock.json

# AionUI 大型资源文件（GIF 演示 > 287MB 总计）
AionUi/resources/*.gif

# AionUI 大型资源文件（mp4 视频）
AionUi/resources/*.mp4

# === 运行时/会话文件 ===
.ccb_config/*-session
.ccb_config/*.log
data/

# === Node.js ===
node_modules/

# === Python 测试/缓存 ===
.coverage
.pytest_cache/
.ruff_cache/
.benchmarks/
```

**目的**:
- `AionUi/resources/*.gif` — 排除 10 个 GIF 文件（总计 287MB，最大 61MB），这些是 AionUI 原版 README 截图，不属于 Hivemind 核心
- `AionUi/resources/*.mp4` — 排除视频文件（2.9MB webui_compressed.mp4）
- `AionUi/node_modules/` — 排除 Node 依赖（Desktop 版无 node_modules 但未来 npm install 会产生）
- `.ccb_config/*-session` — 排除运行时 session 文件（`.claude-session`, `.codex-session` 等）
- `data/` — 排除运行时数据库文件

---

## Step 2: 替换 AionUI 目录

用 Desktop 修改版替换 codex-dual 中的原版 AionUI：

```bash
cd /Users/leo/.local/share/codex-dual

# 删除原版 AionUI
rm -rf AionUi

# 复制 Desktop 修改版（含 Hivemind 集成）
cp -R /Users/leo/Desktop/AionUi ./AionUi

# 关键：移除嵌套 .git 目录（355MB，避免 submodule 问题）
rm -rf AionUi/.git
```

**验证**:
- `ls AionUi/.git` → 应该不存在
- `ls AionUi/src/agent/hivemind/` → 应该有 4 个文件: `types.ts`, `HivemindConnection.ts`, `HivemindAdapter.ts`, `index.ts`

---

## Step 3: 更新 README.md (英文)

**文件**: `/Users/leo/.local/share/codex-dual/README.md`

### 3a. 版本徽章: 1.1.0 → 1.2.0

替换:
```
[![Version](https://img.shields.io/badge/version-1.1.0-blue?style=flat-square)](https://github.com/LeoLin990405/Hivemind/releases)
```
为:
```
[![Version](https://img.shields.io/badge/version-1.2.0-blue?style=flat-square)](https://github.com/LeoLin990405/Hivemind/releases)
```

### 3b. 导航栏添加 Desktop Client 链接

替换:
```
[Quick Start](#quick-start) &bull; [Architecture](#architecture) &bull; [API Reference](#api-reference) &bull; [CLI Tools](#cli-tools) &bull; [Roadmap](#roadmap)
```
为:
```
[Quick Start](#quick-start) &bull; [Architecture](#architecture) &bull; [Desktop Client](#desktop-client-aionui) &bull; [API Reference](#api-reference) &bull; [CLI Tools](#cli-tools) &bull; [Roadmap](#roadmap)
```

### 3c. 架构图: 在 Gateway 上方添加 AionUI 入口

替换现有架构图:
```
You ──▶ Claude Code ──▶ Hivemind Gateway ──┬──▶ Kimi      (Chinese, fast)
```
为:
```
You ──▶ Claude Code ──▶ Hivemind Gateway ──┬──▶ Kimi      (Chinese, fast)
You ──▶ AionUI (Desktop) ──────────────────┘
```

即，在现有架构图的第二行添加 AionUI 作为另一个入口。完整修改后:

```
You ──▶ Claude Code ──▶ Hivemind Gateway ──┬──▶ Kimi      (Chinese, fast)
You ──▶ AionUI (Desktop) ──────────────────┤
                                            ├──▶ Qwen      (code, fast)
                                            ├──▶ DeepSeek  (reasoning)
                                            ...（其余不变）
```

### 3d. 在 "## Quick Start" 之前插入新章节 "## Desktop Client (AionUI)"

```markdown
## Desktop Client (AionUI)

Hivemind includes [AionUI](https://github.com/Aion-Community/AionUI) as a desktop GUI — an Electron + React 19 app with native Hivemind integration.

### Highlights

- **Multi-provider chat** — Select any of 10 providers directly from the chat interface
- **Streaming responses** — Real-time SSE streaming from Hivemind Gateway
- **Provider badges** — Speed tier indicators (🚀 Fast / ⚡ Medium / 🐢 Slow) with live latency
- **Gateway settings** — Configure gateway URL, default provider, and streaming toggle
- **Full AionUI features** — Multi-agent conversations, image generation, file management, and more

### Quick Start

```bash
cd AionUi
npm install
npm start          # Development mode with hot reload
npm run build      # Production build
```

AionUI connects to the Hivemind Gateway at `http://localhost:8765` by default. Make sure the gateway is running first:

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
│  │  HivemindConnection           │  │
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
| Connection | `src/agent/hivemind/HivemindConnection.ts` | HTTP + SSE client for Gateway API |
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
```

### 3e. 项目结构: 添加 AionUi/ 目录

在 Project Structure 部分，在 `├── bin/` 之前插入 AionUi:

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
...（其余不变）
```

### 3f. 路线图: 更新 v1.1 和 v1.2

替换:
```
| **v1.1** | **✅ Current** | **Shared knowledge, tool router, unified query** |
| v1.2 | Planned | Vector semantic search, jieba segmentation, WebUI v2 |
```
为:
```
| v1.1 | ✅ Done | Shared knowledge, tool router, unified query |
| **v1.2** | **✅ Current** | **AionUI desktop client, Hivemind agent integration, DB schema v13** |
| v1.3 | Planned | Vector semantic search, jieba segmentation |
```

### 3g. AI 协作者: Codex 贡献更新

替换:
```
| **Codex** | Code Engineer | v1.0 refactoring, v1.1 implementation, module splitting |
```
为:
```
| **Codex** | Code Engineer | v1.0 refactoring, v1.1 implementation, v1.2 AionUI integration |
```

---

## Step 4: 更新 README.zh-CN.md (中文)

**文件**: `/Users/leo/.local/share/codex-dual/README.zh-CN.md`

与 Step 3 完全对应的中文版修改:

### 4a. 版本徽章: 1.1.0 → 1.2.0

替换:
```
[![Version](https://img.shields.io/badge/版本-1.1.0-blue?style=flat-square)](https://github.com/LeoLin990405/Hivemind/releases)
```
为:
```
[![Version](https://img.shields.io/badge/版本-1.2.0-blue?style=flat-square)](https://github.com/LeoLin990405/Hivemind/releases)
```

### 4b. 导航栏添加桌面客户端链接

替换:
```
[快速开始](#快速开始) &bull; [系统架构](#系统架构) &bull; [API 参考](#api-参考) &bull; [CLI 工具](#cli-工具) &bull; [开发路线](#开发路线)
```
为:
```
[快速开始](#快速开始) &bull; [系统架构](#系统架构) &bull; [桌面客户端](#桌面客户端-aionui) &bull; [API 参考](#api-参考) &bull; [CLI 工具](#cli-工具) &bull; [开发路线](#开发路线)
```

### 4c. 架构图: 添加 AionUI 入口

同英文版，在架构图中添加 `你 ──▶ AionUI (桌面端) ──────────────────┤` 作为第二行入口。

### 4d. 在 "## 快速开始" 之前插入新章节 "## 桌面客户端 (AionUI)"

```markdown
## 桌面客户端 (AionUI)

Hivemind 集成了 [AionUI](https://github.com/Aion-Community/AionUI) 作为桌面 GUI — 基于 Electron + React 19，原生支持 Hivemind 集成。

### 亮点

- **多 Provider 聊天** — 在聊天界面直接选择 10 个 Provider 中的任意一个
- **流式响应** — 通过 Hivemind Gateway 实时 SSE 流式输出
- **Provider 徽章** — 速度分级指示器（🚀 快速 / ⚡ 中速 / 🐢 慢速）+ 实时延迟显示
- **Gateway 设置** — 配置 Gateway URL、默认 Provider、流式开关
- **完整 AionUI 功能** — 多 Agent 对话、图片生成、文件管理等

### 快速启动

```bash
cd AionUi
npm install
npm start          # 开发模式（热重载）
npm run build      # 生产构建
```

AionUI 默认连接 Hivemind Gateway `http://localhost:8765`。请先确保 Gateway 已启动：

```bash
python3 -m lib.gateway.gateway_server --port 8765
```

### 架构

```
┌──────────────────────────────────────┐
│         AionUI (Electron)            │
│                                      │
│  ┌────────────┐  ┌───────────────┐   │
│  │ React UI   │  │ Hivemind      │   │
│  │ (渲染进程)  │──│ Agent 插件    │   │
│  └────────────┘  └───────┬───────┘   │
│                          │           │
│  ┌───────────────────────▼────────┐  │
│  │  HivemindConnection           │  │
│  │  HTTP + SSE 流式客户端         │  │
│  └───────────────────────┬────────┘  │
└──────────────────────────┼───────────┘
                           │ HTTP/SSE
                           ▼
              ┌─────────────────────┐
              │  Hivemind Gateway   │
              │  localhost:8765     │
              └─────────────────────┘
```

### Hivemind 集成文件

| 组件 | 文件 | 用途 |
|------|------|------|
| 类型定义 | `src/agent/hivemind/types.ts` | Provider 选项、速度分级、配置类型 |
| 连接层 | `src/agent/hivemind/HivemindConnection.ts` | Gateway HTTP + SSE 客户端 |
| 适配器 | `src/agent/hivemind/HivemindAdapter.ts` | Gateway 响应 → AionUI 消息格式转换 |
| Agent | `src/agent/hivemind/index.ts` | HivemindAgent 主类 |
| 管理器 | `src/process/task/HivemindAgentManager.ts` | 会话生命周期管理 |
| 聊天 UI | `src/renderer/.../HivemindChat.tsx` | 聊天容器组件 |
| 输入框 | `src/renderer/.../HivemindSendBox.tsx` | 输入框 + Provider 选择器 |
| 徽章 | `src/renderer/.../HivemindProviderBadge.tsx` | Provider 速度分级徽章 |
| 路由信息 | `src/renderer/.../HivemindRoutingInfo.tsx` | 路由状态指示器 |
| 设置面板 | `src/renderer/.../HivemindModalContent.tsx` | Gateway 配置面板 |
| Worker | `src/worker/hivemind.ts` | Worker 存根 |

> **许可证**: AionUI 采用 Apache-2.0 许可证。详见 `AionUi/LICENSE`。
```

### 4e. 项目结构: 添加 AionUi/

同英文版，在 `├── bin/` 之前插入:
```
├── AionUi/                    # 桌面客户端 (Electron + React 19)
│   ├── src/
│   │   ├── agent/hivemind/    # Hivemind Gateway 客户端
│   │   ├── renderer/          # React UI（含 Hivemind 组件）
│   │   └── process/           # 进程管理
│   ├── package.json
│   └── forge.config.ts
```

### 4f. 路线图: 更新 v1.1 和 v1.2

替换:
```
| **v1.1** | **✅ 当前** | **共享知识、工具路由器、统一查询** |
| v1.2 | 计划中 | 向量语义搜索、jieba 分词、WebUI v2 |
```
为:
```
| v1.1 | ✅ 完成 | 共享知识、工具路由器、统一查询 |
| **v1.2** | **✅ 当前** | **AionUI 桌面客户端、Hivemind Agent 集成、数据库 Schema v13** |
| v1.3 | 计划中 | 向量语义搜索、jieba 分词 |
```

### 4g. AI 协作者: Codex 贡献更新

替换:
```
| **Codex** | 代码工程师 | v1.0 重构、v1.1 实现、模块拆分 |
```
为:
```
| **Codex** | 代码工程师 | v1.0 重构、v1.1 实现、v1.2 AionUI 集成 |
```

---

## Step 5: Git 提交

```bash
cd /Users/leo/.local/share/codex-dual

# 1. Stage .gitignore（必须先 stage，这样后续 add 才会受新规则影响）
git add .gitignore

# 2. Stage AionUI 目录（.gitignore 会自动排除 GIF/mp4/node_modules 等）
git add AionUi/

# 3. Stage bin/ 修改（CLI 工具更新）
git add bin/

# 4. Stage 文档
git add docs/AIONUI_HIVEMIND_INTEGRATION_v1.md

# 5. Stage README 更新
git add README.md README.zh-CN.md

# 6. 验证：确保没有大文件被 staged
git diff --cached --stat | tail -5
# 检查 staged 文件列表中不应有 .gif 或 .mp4 文件

# 7. 检查 staged 文件大小（确保无 > 50MB 文件）
git diff --cached --name-only | head -50

# 8. 提交
git commit -m "feat(ui): integrate AionUI desktop client with Hivemind gateway

- Add AionUI Electron app as desktop GUI (React 19 + TypeScript)
- Implement hivemind agent type: 11 new files, 22 modified files
- HivemindConnection: HTTP + SSE streaming to gateway API
- HivemindAdapter: Gateway response → IResponseMessage conversion
- HivemindAgentManager: conversation lifecycle management
- HivemindSettings: gateway URL, provider selection, streaming toggle
- Provider badges with speed tiers and latency display
- Database schema v13 with hivemind conversation type
- Update 25 CLI tools (bin/*) with gateway improvements
- Add AionUI integration design doc
- Bump version to v1.2.0

Co-Authored-By: Codex <noreply@openai.com>"
```

**注意**: `.ccb_config/*-session` 和 `data/` 不应被 staged（已在 .gitignore 中排除）。

---

## Step 6: 推送前验证

```bash
# 1. 检查仓库对象大小
git count-objects -vH
# size-pack 应 < 500MB

# 2. 检查最大的 staged 文件
git diff --cached --stat | sort -t'|' -k2 -rn | head -10

# 3. 确认 GIF 未被跟踪
git ls-files AionUi/resources/*.gif
# 应该无输出

# 4. 确认 node_modules 未被跟踪
git ls-files AionUi/node_modules/
# 应该无输出

# 5. 确认 session 文件未被跟踪
git ls-files .ccb_config/*-session
# 应该无输出

# 6. 确认 AionUi/.git 不存在
ls -la AionUi/.git 2>/dev/null
# 应该报错 "No such file"
```

---

## Step 7: 推送到 GitHub

```bash
git push origin main
```

如果推送因大文件被拒绝:
1. 检查 `git ls-files -s | sort -k 3 -rn | head -10` 找出大文件
2. 将大文件加入 `.gitignore`
3. `git rm --cached <大文件路径>`
4. 重新提交并推送

---

## 推送后验证

1. 访问 `https://github.com/LeoLin990405/Hivemind` 确认:
   - `AionUi/` 目录存在
   - `AionUi/src/agent/hivemind/` 存在
   - `AionUi/resources/` 中没有 GIF 文件
   - README 显示 v1.2.0 徽章
   - Desktop Client 章节正确渲染

2. 本地验证:
   ```bash
   cd AionUi && npm install && npm start
   # 应该能启动 AionUI Electron 应用
   ```

---

## 关键约束

| 约束 | 说明 |
|------|------|
| **不要提交 GIF** | `AionUi/resources/*.gif` 总计 287MB，必须被 .gitignore 排除 |
| **不要提交 .git** | `AionUi/.git/` 是 355MB 嵌套 git，必须 `rm -rf` |
| **不要提交 session** | `.ccb_config/*-session` 是运行时文件 |
| **不要提交 data/** | `data/` 包含运行时数据库 |
| **保留 AionUI LICENSE** | AionUI = Apache-2.0，Hivemind = AGPL-3.0，两者兼容但需保留原许可证 |
| **保留 PNG/SVG** | `AionUi/resources/` 中的 PNG/SVG 文件（共 ~13MB）应保留，它们是 app 图标和 UI 资源 |

---

## 预期结果

合并后 GitHub 仓库结构:

```
Hivemind/
├── AionUi/                  # 桌面客户端 (Electron + React 19)  ← NEW
│   ├── src/
│   │   ├── agent/hivemind/  # Hivemind Gateway 客户端 (4 files)
│   │   ├── renderer/        # React UI（含 Hivemind 组件）
│   │   ├── process/         # 进程管理（含 HivemindAgentManager）
│   │   ├── worker/          # Worker（含 hivemind.ts）
│   │   └── ...
│   ├── resources/           # 仅 PNG/SVG/JPG（无 GIF/MP4）
│   ├── package.json
│   ├── forge.config.ts
│   └── LICENSE              # Apache-2.0
├── lib/                     # Python 后端
│   ├── gateway/             # FastAPI 网关 (138 端点)
│   ├── memory/              # 记忆系统
│   ├── providers/           # 10 个 Provider 适配器
│   └── ...
├── bin/                     # 65 个 CLI 工具 (已更新)
├── tests/                   # 195 个测试用例
├── docs/
│   ├── AIONUI_HIVEMIND_INTEGRATION_v1.md  ← NEW
│   └── ...
├── README.md                # v1.2.0 + Desktop Client 章节
├── README.zh-CN.md          # v1.2.0 + 桌面客户端章节
└── .gitignore               # 已更新，排除 GIF/session/data
```

版本: **v1.2.0** — Hivemind 多 AI 编排平台 + AionUI 桌面客户端
