# AI Router CCB - 智能多 AI 协作平台

> **基于 [bfly123/claude_code_bridge](https://github.com/bfly123/claude_code_bridge) 的优化分支，新增智能任务路由功能**
>
> 特别感谢原作者 **bfly123** 和社区创建了这个出色的多 AI 协作框架。

[English](README.md) | **中文说明**

---

## 关于本项目

**AI Router CCB** 是一个统一的 AI 协作平台，能够根据任务类型、关键词和文件模式智能地将任务路由到最佳 AI provider。

### 核心特性
- **智能路由**：自动为每个任务选择最佳 AI provider
- **9 个 AI Provider**：Claude、Codex、Gemini、OpenCode、DeepSeek、Droid、iFlow、Kimi、Qwen
- **统一接口**：所有 provider 使用一致的命令模式
- **健康监控**：实时 provider 状态检查
- **可配置规则**：基于 YAML 的路由配置

### 贡献者
- **Leo** ([@LeoLin990405](https://github.com/LeoLin990405)) - 项目负责人 & 集成
- **Claude** (Anthropic Claude Opus 4.5) - 架构设计 & 代码优化
- **Codex** (OpenAI GPT-5.2 Codex) - 脚本开发 & 调试

---

## 智能任务路由

AI Router CCB 的核心创新是其智能路由引擎，灵感来自 [Nexus Router](https://github.com/grafbase/nexus)。

### 快速开始
```bash
# 智能路由 - 自动选择最佳 provider
ccb ask "添加 React 组件"        # → gemini (前端)
ccb ask "设计 API 接口"          # → codex (后端)
ccb ask "分析这个算法的复杂度"    # → deepseek (推理)

# 仅显示路由决策（不执行）
ccb route "帮我审查这段代码"

# 检查所有 provider 健康状态
ccb health

# 强制指定 provider
ccb ask -p claude "任何问题"

# 基于文件上下文路由
ccb route -f src/components/Button.tsx "修改这个文件"
```

### 路由规则

| 任务类型 | 关键词 | 文件模式 | Provider |
|----------|--------|----------|----------|
| 前端开发 | react, vue, component, 前端, 组件 | `*.tsx`, `*.vue`, `components/**` | gemini |
| 后端开发 | api, endpoint, 后端, 接口 | `api/**`, `routes/**`, `services/**` | codex |
| 架构设计 | design, architect, 设计, 架构 | - | claude |
| 深度推理 | analyze, reason, 分析, 推理, 算法 | - | deepseek |
| 代码审查 | review, check, 审查, 检查 | - | gemini |
| 快速问答 | what, how, why, 什么, 怎么 | - | claude |

### 配置
编辑 `~/.ccb_config/unified-router.yaml` 自定义路由规则：
```yaml
routing_rules:
  - name: frontend
    priority: 10
    patterns:
      - "**/components/**"
      - "**/*.tsx"
    keywords:
      - react
      - vue
      - 前端
    provider: gemini
```

---

## 支持的 Provider

| Provider | 命令 | Ping | 描述 |
|----------|------|------|------|
| Claude | `lask` | `lping` | 通用、架构、快速问答 |
| Codex | `cask` | `cping` | 后端、API、系统编程 |
| Gemini | `gask` | `gping` | 前端、代码审查、多模态 |
| OpenCode | `oask` | `oping` | 通用编码辅助 |
| DeepSeek | `dskask` | `dskping` | 深度推理、算法、优化 |
| Droid | `dask` | `dping` | 自动化任务执行 |
| iFlow | `iask` | `iping` | 工作流自动化 |
| Kimi | `kask` | `kping` | 中文、长上下文 |
| Qwen | `qask` | `qping` | 多语言、通用 |

---

## 安装

### 前置条件
- [WezTerm](https://wezfurlong.org/wezterm/)（推荐）或 tmux
- 已安装的 Provider CLI：
  - `claude` (Anthropic)
  - `codex` (OpenAI)
  - `gemini` (Google)
  - 其他按需安装

### 安装步骤
```bash
# 克隆此仓库
git clone https://github.com/LeoLin990405/ai-router-ccb.git ~/.local/share/codex-dual

# 运行安装脚本
cd ~/.local/share/codex-dual
./install.sh
```

### 环境变量
添加到 `~/.zshrc` 或 `~/.bashrc`：
```bash
# CCB 核心
export CCB_SIDECAR_AUTOSTART=1
export CCB_SIDECAR_DIRECTION=right
export CCB_CLI_READY_WAIT_S=20

# DeepSeek
export CCB_DSKASKD_QUICK_MODE=1
export CCB_DSKASKD_ALLOW_NO_SESSION=1

# Kimi - CLI 启动较慢
export CCB_KASKD_STARTUP_WAIT_S=25

# iFlow (GLM) - 模型响应较慢
export CCB_IASKD_STARTUP_WAIT_S=30
```

---

## 使用方法

### 在 Claude Code 中使用
```bash
# 使用前缀
@codex 审查这段代码
@gemini 搜索最新的 React 文档
@deepseek 分析这个算法

# 使用 ask 命令
ask codex "解释这个函数"
ask gemini "今天天气怎么样"
```

### 直接命令
```bash
# 提问
cask "审查这段代码"
gask "搜索文档"
dskask "分析代码"

# 检查连接
cping
gping
dskping

# 获取待处理回复
cpend
gpend
dskpend
```

### CCB 命令
```bash
# 启动 provider
ccb codex gemini opencode

# 智能路由
ccb ask "你的问题"
ccb route "仅显示路由"
ccb health

# 管理
ccb kill
ccb version
ccb update
```

---

## 文件结构
```
~/.local/share/codex-dual/
├── bin/                    # 命令脚本 (ask/ping/pend)
│   ├── ccb-ask            # 智能路由 CLI
│   ├── cask, gask, ...    # Provider ask 命令
│   └── cping, gping, ...  # Provider ping 命令
├── lib/                    # 库模块
│   ├── unified_router.py  # 路由引擎
│   └── *_daemon.py        # Provider 守护进程
├── config/                 # 配置模板
├── ccb                     # CCB 主程序
└── install.sh              # 安装脚本

~/.ccb_config/
├── unified-router.yaml    # 路由配置
└── .*-session             # Provider 会话文件
```

---

## 故障排除

### Provider 无响应
1. 检查连接：`<provider>ping`
2. 验证 CLI 已安装并认证
3. 检查环境变量

### 路由不符合预期
1. 检查路由决策：`ccb route "你的消息"`
2. 查看 `~/.ccb_config/unified-router.yaml`
3. 使用 `-v` 标志查看详细输出：`ccb ask -v "消息"`

### Sidecar 未打开
1. 确保 WezTerm 正在运行
2. 检查 `CCB_SIDECAR_AUTOSTART=1`
3. 验证 `CCB_SIDECAR_DIRECTION` 已设置

---

## 致谢

本项目的实现离不开：

- **[bfly123](https://github.com/bfly123)** - claude_code_bridge 原作者。感谢您创建了这个创新的多 AI 协作框架！
- **[Grafbase / Nexus Router](https://github.com/grafbase/nexus)** - 统一路由引擎的灵感来源。他们在 AI 网关和 provider 路由方面的工作影响了我们的实现。
- **claude_code_bridge 社区** - 提供反馈和贡献
- **Anthropic** - Claude 和 Claude Code
- **OpenAI** - Codex
- **Google** - Gemini
- **DeepSeek、Kimi、Qwen、iFlow 团队** - 优秀的 AI 助手

---

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE)

---

## 贡献

欢迎提交 Issue 和 PR！您可以：
- 报告 Bug
- 建议新功能
- 添加更多 provider 支持
- 改进文档

---

*由 Leo、Claude 和 Codex 共同构建 ❤️*
