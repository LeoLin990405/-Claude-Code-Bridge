<div align="center">

# 🤖 CCB Gateway

**企业级多 AI 编排平台**

让 Claude 成为智能编排者，统一管理 10 个 AI Provider，配备 LLM 驱动的记忆系统、智能路由和实时监控。

[![Version](https://img.shields.io/badge/version-0.24.1-brightgreen)](https://github.com/LeoLin990405/ai-router-ccb/releases)
[![License](https://img.shields.io/github/license/LeoLin990405/ai-router-ccb?color=blue)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![Stars](https://img.shields.io/github/stars/LeoLin990405/ai-router-ccb?style=social)](https://github.com/LeoLin990405/ai-router-ccb)

[快速开始](#-快速开始) • [功能特性](#-功能特性) • [使用文档](#-使用文档)

[🇺🇸 English](README.md) | **🇨🇳 简体中文**

<img src="screenshots/webui-demo.gif" alt="CCB Gateway 演示" width="800">

</div>

---

## 📖 目录

- [什么是 CCB Gateway？](#-什么是-ccb-gateway)
- [快速开始](#-快速开始)
- [核心功能](#-核心功能)
- [系统架构](#-系统架构)
- [使用文档](#-使用文档)
- [API 参考](#-api-参考)
- [开发路线](#-开发路线)
- [贡献指南](#-贡献指南)
- [开源许可](#-开源许可)

---

## 🌟 什么是 CCB Gateway？

**CCB Gateway** 是生产级的多 AI 编排平台，**Claude 作为智能编排者**，通过统一的 Gateway API 将任务路由到 10 个专业 AI Provider（包括 Antigravity 本地代理），提供 LLM 驱动的记忆系统、智能路由和实时监控。

### 为什么选择 CCB Gateway？

<table>
<tr>
<td width="50%">

**❌ 没有 CCB Gateway**

- 多个 CLI 接口，管理复杂
- 手动选择 Provider，效率低下
- 会话之间无记忆
- 上下文丢失，AI 不知道可用工具
- 无法观察操作过程
- AI 之间无法协作
- 失败请求浪费时间

</td>
<td width="50%">

**✅ 使用 CCB Gateway**

- **统一 Gateway API** - 一个接口调用全部
- **智能路由** - 自动选择最佳 AI
- **双系统记忆** - 快速 + 深度处理
- **预加载上下文** - 55 个 Skills 自动嵌入
- **实时仪表盘** - 完全可观测
- **多 AI 讨论** - 协作式问题解决
- **重试与降级** - 内置弹性机制

</td>
</tr>
</table>

### 支持的 AI Provider（10 个）

| Provider | 速度 | 特长 | 响应时间 |
|----------|:----:|------|----------|
| **Antigravity** | 🚀 | 本地 Claude 4.5 代理，无限访问 | 3-8秒 |
| **Kimi** | 🚀 | 中文对话，长文本 (128k) | 7秒 |
| **Qwen** | 🚀 | 代码生成，多语言 | 12秒 |
| **DeepSeek** | ⚡ | 深度推理，算法分析 | 16秒 |
| **iFlow** | ⚡ | 工作流自动化 | 25秒 |
| **Codex** | 🐢 | 代码审查，复杂重构 | 48秒 |
| **Gemini** | 🐢 | 前端开发，多模态 | 71秒 |
| **Claude** | ⚡ | 通用任务 | 30秒 |
| **Qoder** | ⚡ | 编程任务 | 30秒 |
| **OpenCode** | ⚡ | 多模型切换 | 42秒 |

---

## 🚀 快速开始

### 前置条件

- **Python 3.9+**
- **Node.js 16+**（用于 MCP servers）
- **Git**

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/LeoLin990405/ai-router-ccb.git
cd ai-router-ccb

# 2. 安装依赖
pip install -r requirements.txt
npm install

# 3. 配置 AI Provider
# 编辑 ~/.claude/ 中的配置文件或设置环境变量
```

### 启动 Gateway

```bash
# 启动 Gateway Server
python3 -m lib.gateway.gateway_server --port 8765

# 输出示例：
# [SystemContext] Preloading system information...
# [SystemContext] Loaded 55 skills
# [SystemContext] Loaded 10 providers
# [MemoryMiddleware] Initialized (enabled=True)
# ✓ Server running at http://localhost:8765
```

### 第一个请求

```bash
# 使用 ccb-cli（推荐）
ccb-cli kimi "解释 React Hooks"

# 或使用 curl
curl -X POST http://localhost:8765/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "kimi",
    "message": "解释 React Hooks",
    "wait": true,
    "timeout": 60
  }'
```

### 访问 Web UI

打开浏览器访问：**http://localhost:8765/web**

---

## ✨ 核心功能

### 🧠 双系统记忆（v0.20-v0.23）

<details>
<summary><b>灵感来自人类认知的记忆架构</b></summary>

**System 1（快速）** - 自动归档会话上下文
- 在 `/clear` 或 `/compact` 时自动触发
- 解析 session.jsonl，提取关键消息
- 保存为 Markdown 归档

**System 2（深度）** - 夜间整合处理
- 凌晨 3 点自动运行或手动触发
- 按项目/主题聚类记忆
- 提取模式和学习要点
- 生成结构化长期记忆

**启发式检索（v0.22）**
```
最终分数 = α × 相关性 + β × 重要性 + γ × 时效性
默认权重：α=0.4, β=0.3, γ=0.3
```

**LLM 驱动的关键词提取（v0.23）**
- 使用 Ollama + qwen2.5:7b 实现语义理解
- 优秀的中文 + 英文关键词提取
- 1-2 秒本地推理，95%+ 准确率

**命令示例：**
```bash
ccb-mem save                      # 保存当前会话
ccb-mem consolidate --hours 24    # 整合最近 24 小时
ccb-mem search "认证"              # 搜索记忆
ccb-mem search-scored "认证" --limit 5  # 启发式评分搜索
```

</details>

### 🏠 Antigravity Tools 集成（v0.24+）

<details>
<summary><b>本地 Claude 4.5 Sonnet 代理</b></summary>

**核心优势：**
- 🚀 **超快速度** - 3-8 秒响应时间（本地代理）
- 🔓 **无限访问** - 无速率限制或 token 配额
- 🎯 **最新模型** - Claude 4.5 Sonnet，带思考能力
- 🔌 **双 API 支持** - Claude API + OpenAI API 兼容

**快速使用：**
```bash
# 通过 Gateway 调用
ccb-cli antigravity "你的问题"
ccb-cli antigravity -a sisyphus "修复这个 bug"

# 直接测试
curl -X POST http://127.0.0.1:8045/v1/messages \
  -H "x-api-key: YOUR_KEY" \
  -d '{"model":"claude-sonnet-4-5-20250929","messages":[...]}'
```

**v0.24.1 修复：**
- ✅ 智能 API Key 检测（环境变量 + 直接配置）
- ✅ HTTP Backend 增强
- ✅ Gateway 启动包装器
- ✅ 向后兼容

📖 **详细文档：** [Antigravity Tools 指南](docs/ANTIGRAVITY_TOOLS_GUIDE.md)

</details>

### 🔀 CC Switch 集成（v0.23.1）

<details>
<summary><b>高级 Provider 管理和并行测试</b></summary>

**核心功能：**
- 🔀 **故障转移队列** - 基于优先级的自动 Provider 切换
- ⚡ **并行测试** - 同时测试多个 Provider
- 📊 **Provider 监控** - 实时健康状态和指标
- 🎯 **性能对比** - 比较延迟和响应质量

**CLI 命令：**
```bash
ccb-cc-switch status              # Provider 状态
ccb-cc-switch reload              # 重新加载配置
ccb-cc-switch test "解释递归"     # 并行测试所有
ccb-cc-switch test "问题" -p "反重力" -p "Kimi" -t 60
```

**API 端点：**
```
GET  /api/cc-switch/status
POST /api/cc-switch/reload
POST /api/cc-switch/parallel-test
GET  /api/cc-switch/failover-queue
```

</details>

### 🔍 技能发现

<details>
<summary><b>自动发现和推荐相关 Claude Code Skills</b></summary>

集成 [Vercel Skills](https://github.com/vercel-labs/skills)，自动发现本地和远程技能。

**工作流程：**
```
用户请求 → 提取关键词 → 搜索技能（本地 + 远程）
                           ↓
            注入推荐到上下文
```

**使用示例：**
```bash
# Gateway 自动发现
ccb-cli kimi "帮我创建 PDF"
# [MemoryMiddleware] 💡 发现 1 个相关 Skill: /pdf

# 手动搜索
ccb-skills recommend "创建电子表格"
ccb-skills stats
```

</details>

### 🤝 多 AI 讨论

<details>
<summary><b>协作式问题解决</b></summary>

多个 AI 讨论并达成共识：

```bash
ccb-submit discuss \
  --providers kimi,codex,gemini \
  --rounds 3 \
  --strategy "consensus" \
  "设计可扩展的微服务架构"
```

**聚合策略：**
- **consensus** - 所有 AI 必须同意
- **majority** - 多数答案获胜
- **first_success** - 第一个有效响应
- **best_quality** - 最高质量（评分）

</details>

### 📊 实时监控

<details>
<summary><b>基于 WebSocket 的仪表盘</b></summary>

访问：**http://localhost:8765/web**

**功能标签：**
1. **Dashboard** - 概览和指标
2. **Monitor** - 实时请求监控
3. **Memory** - 6 个子标签（Sessions、Observations、Injections 等）
4. **Skills** - Skills 发现和反馈
5. **Discussions** - 多 AI 协作
6. **Requests** - 请求历史和跟踪
7. **Settings** - 系统配置 + API 密钥

**实时数据：**
- 请求数量、成功率、平均延迟
- Provider 状态和健康检查
- 待处理/处理中/已完成队列
- WebSocket 推送的实时日志

</details>

### ⚡ 智能路由与降级

<details>
<summary><b>基于速度分级的自动降级</b></summary>

```yaml
快速层（3-15秒）：   Kimi → Qwen → DeepSeek
中速层（15-45秒）：  iFlow → Qoder → OpenCode → Claude
慢速层（45-90秒）：  Codex → Gemini
```

**功能特性：**
- 🎯 基于任务关键词的智能 Provider 推荐
- 🔄 指数退避的自动重试
- 📉 弹性降级链
- ⚖️ 跨 Provider 负载均衡

</details>

---

## 🏗️ 系统架构

### 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                   CCB Gateway (v0.24.1)                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────┐      │
│  │         双系统记忆 + LLM 关键词提取          │      │
│  ├──────────────────────────────────────────────┤      │
│  │  System 1: ContextSaver (快速自动归档)       │      │
│  │  System 2: MemoryConsolidator (夜间整合)     │      │
│  │  Heuristic Retrieval (αR + βI + γT)          │      │
│  │  LLM Keyword Extraction (Ollama + qwen2.5)   │      │
│  └──────────────────────────────────────────────┘      │
│                          │                               │
│  ┌───────────────────────▼──────────────────────┐      │
│  │          Gateway Server 核心                  │      │
│  ├───────────────────────────────────────────────┤      │
│  │  • 请求队列（异步）                           │      │
│  │  • 重试执行器                                 │      │
│  │  • 缓存管理器 (Redis-like TTL)                │      │
│  │  • 速率限制器                                 │      │
│  │  • 指标收集器 (Prometheus)                    │      │
│  │  • CC Switch 集成                             │      │
│  └───────────────────────────────────────────────┘      │
│                          │                               │
│  ┌─────┬─────┬──────┬────┼────┬───────┬───────┬─────┐ │
│  ▼     ▼     ▼      ▼    ▼    ▼       ▼       ▼     ▼ │
│ Anti  Kimi Qwen Deep Codex Gemini iFlow Claude Others  │
│ grav.                 Seek                              │
└─────────────────────────────────────────────────────────┘
```

### 记忆系统流程

```
会话活动
    │
    ├─→ [System 1: Context Saver]
    │   ├─→ 由 /clear 或 /compact 触发
    │   ├─→ 解析 session.jsonl
    │   ├─→ 提取关键消息和工具调用
    │   └─→ 保存到 ~/.ccb/ccb_memory.db
    │
    └─→ [System 2: Memory Consolidator]
        ├─→ 夜间（凌晨 3 点）或手动运行
        ├─→ 收集最近的归档
        ├─→ 按项目/主题聚类
        ├─→ 提取模式和学习
        └─→ 保存到数据库（consolidated_memories）
```

---

## 📚 使用文档

### ccb-cli - 统一命令行工具

**最快的 AI 调用方式：**

```bash
# 基本用法
ccb-cli <provider> [model] "<message>"

# 示例
ccb-cli kimi "如何优化 SQL 查询？"
ccb-cli codex o3 "证明停机问题不可判定"
ccb-cli gemini 3f "设计响应式导航栏"
ccb-cli antigravity "分析这段代码"

# 使用 Agent 角色
ccb-cli codex o3 -a reviewer "审查这个 PR"
ccb-cli kimi -a sisyphus "修复这个 bug: ..."
```

**模型快捷方式：**

| Provider | 快捷方式 | 说明 |
|----------|----------|------|
| `codex` | `o3`, `o4-mini`, `gpt-4o`, `o1-pro` | o3=深度推理, o4-mini=快速 |
| `gemini` | `3f`, `3p`, `2.5f`, `2.5p` | 3f=Gemini3快速, 3p=Gemini3专业 |
| `kimi` | `thinking`, `normal` | thinking=思考链 |
| `deepseek` | `reasoner`, `chat` | reasoner=推理, chat=快速 |
| `antigravity` | - | 本地 Claude 4.5 代理 |

### ccb-mem - 记忆管理

```bash
# 保存当前会话
ccb-mem save

# 整合最近的会话
ccb-mem consolidate --hours 24

# 启发式评分搜索
ccb-mem search-scored "认证" --limit 5

# 列出最近归档
ccb-mem list

# 设置记忆重要性
ccb-mem importance <id> 0.8

# 查看统计
ccb-mem stats-v2
```

### ccb-consolidate - System 2 管理

```bash
ccb-consolidate nightly    # 完整合并流程
ccb-consolidate decay      # 应用时间衰减
ccb-consolidate merge      # 合并相似记忆
ccb-consolidate abstract   # 生成抽象摘要
ccb-consolidate forget     # 清理过期记忆
ccb-consolidate stats      # 查看合并统计
```

---

## 📖 API 参考

### 核心端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/providers` | 列出所有 10 个 Provider |
| POST | `/api/ask` | 同步请求（等待响应） |
| POST | `/api/submit` | 异步请求（立即返回 ID） |
| GET | `/api/query/{id}` | 查询请求状态 |
| GET | `/api/pending` | 列出待处理请求 |
| POST | `/api/cancel/{id}` | 取消请求 |

### 记忆系统 API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/memory/sessions` | 列出记忆会话 |
| GET | `/api/memory/search` | 全文搜索 |
| GET | `/api/memory/stats` | 记忆统计 |
| POST | `/api/memory/observations` | 创建手动记忆 |
| GET | `/api/memory/injections` | 获取注入记忆 |

### CC Switch API

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/cc-switch/status` | Provider 状态 |
| POST | `/api/cc-switch/reload` | 重新加载配置 |
| POST | `/api/cc-switch/parallel-test` | 并行测试 |
| GET | `/api/cc-switch/failover-queue` | 故障转移队列 |

### WebSocket

```
WS /ws  # 实时事件流
```

### 请求示例

**同步请求：**
```bash
curl -X POST http://localhost:8765/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "kimi",
    "message": "解释 React Hooks",
    "wait": true,
    "timeout": 60
  }'
```

**异步请求：**
```bash
# 提交
curl -X POST http://localhost:8765/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deepseek",
    "message": "分析递归斐波那契的时间复杂度"
  }'
# 返回：{"request_id": "abc123", "status": "pending"}

# 查询
curl http://localhost:8765/api/query/abc123
```

---

## 🗺️ 开发路线

### 最近发布

<details>
<summary><b>v0.24.1 (2026-02-07) - Antigravity 集成修复</b></summary>

- ✅ 智能 API Key 检测（环境变量 + 直接配置）
- ✅ HTTP Backend 增强
- ✅ Gateway 启动包装器
- ✅ 向后兼容性保持
- ✅ 完整测试验证

📖 [系统测试报告](docs/CCB_SYSTEM_TEST_2026-02-07.md)

</details>

<details>
<summary><b>v0.24 (2026-02-06) - Antigravity Tools 集成</b></summary>

- ✅ 本地 Claude 4.5 Sonnet 代理
- ✅ 3-8 秒超快速度
- ✅ 无限 API 访问
- ✅ Provider 管理改进
- ✅ CC Switch 数据库适配器修复

📖 [Antigravity Tools 指南](docs/ANTIGRAVITY_TOOLS_GUIDE.md)

</details>

<details>
<summary><b>v0.23.1 (2026-02-05) - CC Switch 集成</b></summary>

- ✅ 故障转移队列
- ✅ 并行测试
- ✅ Provider 监控
- ✅ Web UI 优化（11 → 7 标签页）
- ✅ Gemini CLI 双路径集成

📖 [CC Switch 集成指南](docs/CC_SWITCH_INTEGRATION.md)

</details>

<details>
<summary><b>v0.23 (2026-01) - LLM 驱动的记忆</b></summary>

- ✅ Ollama + qwen2.5:7b 关键词提取
- ✅ 语义理解（中英文）
- ✅ 1-2 秒本地推理
- ✅ 健壮降级机制
- ✅ 95%+ 准确率

</details>

<details>
<summary><b>v0.22 (2025-12) - 启发式检索</b></summary>

- ✅ Stanford Generative Agents 评分算法
- ✅ αR + βI + γT 多维检索
- ✅ 艾宾浩斯遗忘曲线
- ✅ SQLite 数据库存储
- ✅ System 2 增强操作

</details>

### 未来计划

**v0.25 (2026 Q2) - 语义增强**
- [ ] Qdrant 向量数据库集成
- [ ] 语义相似度搜索
- [ ] 多语言嵌入
- [ ] 记忆聚类

**v0.26 (2026 Q3) - Agent 自主性**
- [ ] Agent 记忆函数调用（Letta 模式）
- [ ] 结构化记忆块（core_memory）
- [ ] 自我更新 Agents
- [ ] 记忆版本控制

**v0.27 (2026 Q4) - 团队协作**
- [ ] 多用户记忆隔离
- [ ] 共享记忆池
- [ ] 权限系统
- [ ] 实时协作

---

## 📚 文档资源

### 核心指南

- **[Antigravity Tools 指南](docs/ANTIGRAVITY_TOOLS_GUIDE.md)** - v0.24 本地代理设置
- **[CC Switch 集成](docs/CC_SWITCH_INTEGRATION.md)** - v0.23.1 Provider 管理
- **[Gemini CLI 集成](docs/GEMINI_CLI_INTEGRATION_GUIDE.md)** - v0.23.1 双路径配置
- **[Gemini 认证配置](docs/GEMINI_AUTH_SETUP.md)** - OAuth 和 API Key
- **[记忆系统架构](lib/memory/INTEGRATION_DESIGN.md)** - 完整设计文档
- **[数据库结构](lib/memory/DATABASE_STRUCTURE.md)** - Schema 和查询

### 测试报告（2026-02-07）

- **[系统测试报告](docs/CCB_SYSTEM_TEST_2026-02-07.md)** - Antigravity 集成验证
- **[最终测试报告](docs/CCB_FINAL_TEST_REPORT_2026-02-06.md)** - 全模块集成测试
- **[问题追踪](docs/CCB_TEST_ISSUES_2026-02-06.md)** - 6 个问题修复详情
- **[重测验证](docs/CCB_RETEST_REPORT_2026-02-06.md)** - 修复验证结果

**测试结果摘要：**
- ✅ 8/9 Providers 通过（89% 成功率）
- ✅ 6/6 本地问题修复（100% 修复率）
- ✅ 96% 模块测试覆盖
- ⏱️ 平均响应时间：3-71 秒（按 Provider 分级）

---

## 🤝 贡献指南

我们欢迎各种形式的贡献！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 快速开始

```bash
# 1. Fork 并克隆
git clone https://github.com/YOUR_USERNAME/ai-router-ccb.git
cd ai-router-ccb

# 2. 创建分支
git checkout -b feature/your-feature

# 3. 修改并测试
python3 -m pytest tests/

# 4. 提交并推送
git commit -m "feat: add your feature"
git push origin feature/your-feature

# 5. 创建 Pull Request
```

### 开发规范

- **代码风格：** 遵循 PEP 8
- **测试覆盖：** 新功能需要单元测试
- **文档更新：** 更新相关 README 和文档
- **Commit 规范：** 使用 [Conventional Commits](https://www.conventionalcommits.org/)

---

## 📜 开源许可

本项目采用 **MIT 许可证** - 详情请查看 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

### 灵感来源

- [Stanford Generative Agents](https://arxiv.org/pdf/2304.03442) - 启发式检索公式
- [Awesome-AI-Memory](https://github.com/IAAR-Shanghai/Awesome-AI-Memory) - 记忆系统综述
- [Mem0](https://github.com/mem0ai/mem0) - 语义记忆架构
- [Letta (MemGPT)](https://github.com/cpacker/MemGPT) - 结构化记忆块
- [LangChain](https://github.com/langchain-ai/langchain) - 记忆模式
- [claude-mem](https://github.com/thedotmack/claude-mem) - 生命周期钩子

### 构建技术

- [FastAPI](https://fastapi.tiangolo.com) - 现代 Web 框架
- [SQLite](https://www.sqlite.org) - 可靠数据库
- [Ollama](https://ollama.com) - 本地 LLM 推理
- [Claude Code](https://www.anthropic.com/claude) - AI 编排者

---

## 📞 技术支持

- 🐛 **问题反馈：** [GitHub Issues](https://github.com/LeoLin990405/ai-router-ccb/issues)
- 📖 **文档中心：** [Documentation](docs/)
- 💬 **讨论区：** [GitHub Discussions](https://github.com/LeoLin990405/ai-router-ccb/discussions)

---

<div align="center">

**由 CCB 团队用 ❤️ 构建**

[⬆ 回到顶部](#-ccb-gateway)

</div>
