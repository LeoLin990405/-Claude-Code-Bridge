# CCB Memory System - Quick Start Guide

## 🎯 功能概述

CCB 记忆系统让所有 AI agents 能够：
1. **自动获取相关上下文** - 基于任务类型注入历史对话和推荐
2. **查询 skills 和 MCP** - 知道有哪些工具可用
3. **学习历史经验** - 记住哪个 AI 擅长什么任务
4. **智能推荐** - 根据任务自动推荐最合适的 provider

## 📦 核心组件

### 1. Registry System (注册表)
扫描并维护所有可用能力的清单

```bash
# 扫描 skills, MCP servers, providers
python3 ~/.local/share/codex-dual/lib/memory/registry.py scan

# 列出所有 skills
python3 ~/.local/share/codex-dual/lib/memory/registry.py list skills

# 列出所有 providers
python3 ~/.local/share/codex-dual/lib/memory/registry.py list providers

# 智能推荐
python3 ~/.local/share/codex-dual/lib/memory/registry.py find frontend ui
```

### 2. Memory Lite (轻量记忆库)
存储和检索对话历史

```bash
# 记录对话
python3 ~/.local/share/codex-dual/lib/memory/memory_lite.py record kimi "问题" "回答"

# 搜索历史
python3 ~/.local/share/codex-dual/lib/memory/memory_lite.py search frontend

# 查看最近对话
python3 ~/.local/share/codex-dual/lib/memory/memory_lite.py recent 10

# 获取任务上下文
python3 ~/.local/share/codex-dual/lib/memory/memory_lite.py context frontend react

# 查看统计
python3 ~/.local/share/codex-dual/lib/memory/memory_lite.py stats
```

### 3. CCB-MEM (增强版 ccb-cli)
自动注入记忆上下文的 ccb-cli

```bash
# 使用方式：和 ccb-cli 完全一样
ccb-mem kimi "如何做前端开发"
ccb-mem codex o3 "优化这个算法"
ccb-mem gemini 3f "创建一个 React 组件"

# 不需要上下文时
ccb-mem kimi --no-context "简单问题"
```

## 🚀 快速开始

### Step 1: 初始化注册表
```bash
cd ~/.local/share/codex-dual
python3 lib/memory/registry.py scan
```

输出示例：
```
Scanning capabilities...
✓ Found 53 skills
✓ Found 4 MCP servers
✓ Found 8 available providers
```

### Step 2: 记录一些对话
```bash
# 手动记录（测试用）
python3 lib/memory/memory_lite.py record kimi "如何做前端" "用 Gemini 3f"
python3 lib/memory/memory_lite.py record codex "算法优化" "用 O3 深度推理"
```

### Step 3: 测试上下文查询
```bash
python3 lib/memory/memory_lite.py context frontend ui
```

输出示例：
```
## 💭 相关记忆 (历史对话)

1. [kimi] 2026-02-04
   Q: 如何做前端
   A: 用 Gemini 3f

## 🤖 推荐使用的 AI
- gemini: ccb-cli gemini (匹配度: 2★)

## 🛠️ 可用的 Skills
- frontend-design: Create distinctive frontend interfaces
- canvas-design: Create beautiful visual art
- web-artifacts-builder: Suite of tools for web artifacts

## 🔌 运行中的 MCP Servers
- chroma-mcp (PID: 46608)
```

### Step 4: 使用增强版 ccb-cli
```bash
# 添加到 PATH (如果还没有)
export PATH="$HOME/.local/share/codex-dual/bin:$PATH"

# 使用 ccb-mem (会自动注入上下文)
ccb-mem kimi "帮我做一个前端组件"
```

## 📊 数据存储

### 位置
- **Registry Cache**: `~/.ccb/registry_cache.json`
- **Memory Database**: `~/.ccb/ccb_memory.db` (SQLite)
- **Memory Config**: `~/.ccb/memory_config.json`

### 数据库结构
```sql
conversations (id, timestamp, provider, question, answer, metadata, tokens)
learnings (id, timestamp, category, content, metadata)
conversations_fts (全文搜索索引)
```

## 🔧 高级配置

### Memory Config (`~/.ccb/memory_config.json`)
```json
{
  "enabled": true,
  "auto_record": true,
  "context_injection": true,
  "max_context_tokens": 2000,
  "privacy": {
    "exclude_patterns": ["password", "api_key", "secret", "token"]
  }
}
```

### 自定义 ccb-mem Alias
```bash
# 添加到 ~/.zshrc
alias ask-mem='ccb-mem kimi'
alias code-mem='ccb-mem codex o3'
alias ui-mem='ccb-mem gemini 3f'
```

## 🎨 使用场景

### 场景 1: 前端开发
```bash
# 第一次问
ccb-mem kimi "如何做前端开发"
# 系统记住：Gemini 3f 擅长前端

# 下次问类似问题
ccb-mem kimi "创建一个登录页面"
# 自动注入：推荐使用 Gemini 3f + 相关 skills (frontend-design 等)
```

### 场景 2: 算法优化
```bash
# 记录经验
ccb-mem codex o3 "优化排序算法"
# 系统记住：Codex O3 擅长算法

# 后续任务
ccb-mem kimi "如何优化这个算法"
# 自动推荐：建议使用 codex o3
```

### 场景 3: 查询能力
```bash
# 查询有哪些 PDF 相关的 skills
python3 lib/memory/registry.py list skills | grep pdf

# 查询哪个 AI 适合做数据分析
python3 lib/memory/registry.py find data analysis
# 输出: qwen: ccb-cli qwen (匹配度: 1★)
```

## 🔄 集成到 Claude Code

### 方法 1: 在 CLAUDE.md 中添加上下文
```markdown
## CCB Memory Integration

Before executing tasks, query relevant context:

\`\`\`bash
python3 ~/.local/share/codex-dual/lib/memory/memory_lite.py context <keywords>
\`\`\`

Available providers and their strengths:
- Gemini 3f: frontend, ui
- Codex O3: algorithm, reasoning
- Kimi: fast, chinese, long-context
```

### 方法 2: 使用 ccb-mem 代替 ccb-cli
```bash
# 在 CLAUDE.md 中替换示例
# 旧: ccb-cli kimi "question"
# 新: ccb-mem kimi "question"
```

## 📈 监控和维护

### 查看使用统计
```bash
python3 lib/memory/memory_lite.py stats
```

### 定期扫描注册表
```bash
# 添加到 crontab 每小时扫描一次
0 * * * * python3 ~/.local/share/codex-dual/lib/memory/registry.py scan
```

### 查看数据库
```bash
sqlite3 ~/.ccb/ccb_memory.db "SELECT * FROM conversations ORDER BY timestamp DESC LIMIT 10"
```

## 🚧 后续优化

### 计划中的功能
1. **自动记录** - Hook 到 Gateway API 自动记录所有对话
2. **向量搜索** - 集成 Chroma 做语义搜索
3. **Web UI** - 可视化记忆流和统计
4. **智能路由** - 基于历史自动选择最佳 provider
5. **跨会话学习** - 识别模式和最佳实践

### 贡献
欢迎提交 PR 改进记忆系统！

## 🐛 故障排除

### 问题: ccb-mem 找不到 registry
```bash
# 确保先扫描一次
python3 ~/.local/share/codex-dual/lib/memory/registry.py scan
```

### 问题: 数据库锁定
```bash
# 关闭所有访问数据库的进程
pkill -f memory_lite.py
```

### 问题: 搜索无结果
```bash
# FTS 需要匹配完整单词，使用 recent 代替
python3 lib/memory/memory_lite.py recent 20 | grep "关键词"
```

## 📚 更多资源

- [Architecture Doc](ARCHITECTURE.md)
- [Registry System](registry.py)
- [Memory Lite](memory_lite.py)
- [CCB-MEM](../bin/ccb-mem)
