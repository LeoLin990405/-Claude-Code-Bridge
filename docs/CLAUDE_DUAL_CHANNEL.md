# Claude 双渠道配置文档

## 🎯 概述

CCB Gateway 支持 Claude **双渠道架构**，实现主脑与执行的分离：

| 渠道 | 用途 | 环境变量 | 使用场景 |
|------|------|----------|----------|
| **主脑渠道** | Claude Code 推理、规划 | `ANTHROPIC_API_KEY` | 当前对话、代码生成、任务规划 |
| **执行渠道** | Gateway 任务执行 | `ANTHROPIC_API_KEY_EXECUTOR` | ccb-cli 调用、并行任务、自动化 |

## 📋 配置方法

### 步骤 1: 设置环境变量

#### 方案 A: 使用相同 API Key（简单）

适合个人开发、测试环境：

```bash
# ~/.zshrc 或 ~/.bashrc
export ANTHROPIC_API_KEY="sk-ant-xxx"
export ANTHROPIC_API_KEY_EXECUTOR="$ANTHROPIC_API_KEY"
```

#### 方案 B: 使用独立 API Key（推荐）

适合生产环境、团队协作：

```bash
# ~/.zshrc 或 ~/.bashrc
export ANTHROPIC_API_KEY="sk-ant-主脑key"          # Claude Code 主脑
export ANTHROPIC_API_KEY_EXECUTOR="sk-ant-执行key"  # Gateway 执行渠道
```

**优势：**
- ✅ **成本分离** - 独立追踪主脑和执行的 API 消费
- ✅ **限流隔离** - 主脑和执行互不影响
- ✅ **配额管理** - 可为执行渠道设置更高配额
- ✅ **安全隔离** - 不同权限级别的 API key

### 步骤 2: 应用配置

```bash
# 重新加载 shell 配置
source ~/.zshrc  # 或 source ~/.bashrc

# 重启 Gateway
pgrep -f gateway_server | xargs kill
cd ~/.local/share/codex-dual
python3 -m lib.gateway.gateway_server --port 8765 &
```

### 步骤 3: 验证配置

```bash
# 检查环境变量
echo "主脑渠道: ${ANTHROPIC_API_KEY:0:20}..."
echo "执行渠道: ${ANTHROPIC_API_KEY_EXECUTOR:0:20}..."

# 测试执行渠道
ccb-cli claude "Hello from executor channel"

# 检查 Gateway 状态
curl -s http://localhost:8765/api/status | jq '.providers[] | select(.name == "claude")'
```

## 🔧 Gateway 配置

配置文件: `~/.ccb_config/gateway.yaml`

```yaml
providers:
  claude:
    backend_type: "http_api"
    enabled: true
    api_base_url: "https://api.anthropic.com/v1"
    api_key_env: "ANTHROPIC_API_KEY_EXECUTOR"  # 执行渠道
    model: "claude-sonnet-4-20250514"
```

## 📊 使用场景

### 主脑渠道（Claude Code）

```bash
# 当前对话 - 自动使用主脑渠道
# 用户: "帮我分析这段代码"
# Claude: [使用 ANTHROPIC_API_KEY 响应]
```

### 执行渠道（Gateway）

```bash
# 方式 1: 直接调用
ccb-cli claude "分析这个函数的复杂度"

# 方式 2: 异步调用
ccb-submit claude "生成测试用例"

# 方式 3: 并行任务
ccb-cli claude -a reviewer "审查这段代码"
```

## 🔍 故障排查

### 问题 1: Claude 显示 "Unknown" 状态

**原因:** `ANTHROPIC_API_KEY_EXECUTOR` 未设置

**解决:**
```bash
export ANTHROPIC_API_KEY_EXECUTOR="$ANTHROPIC_API_KEY"
# 重启 Gateway
```

### 问题 2: API 认证失败

**检查:**
```bash
# 验证 key 有效性
curl https://api.anthropic.com/v1/messages \
  -H "anthropic-version: 2023-06-01" \
  -H "x-api-key: $ANTHROPIC_API_KEY_EXECUTOR" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### 问题 3: 限流冲突

**症状:** 主脑和执行同时调用时触发限流

**解决:** 使用独立 API Key（方案 B）

## 📈 成本追踪

### 查看主脑消费

通过 Claude Code 的使用记录查看

### 查看执行消费

```bash
# Gateway 统计
ccb-stats --provider claude

# API 仪表盘
# https://console.anthropic.com
```

## 🎛️ 高级配置

### 使用不同模型

```yaml
# 主脑: Sonnet 4（当前 Claude Code session）
# 执行: Haiku（更快更便宜）

claude:
  model: "claude-haiku-4-20250514"
```

### 自定义 API 基础 URL

```yaml
# 使用代理或自定义端点
claude:
  api_base_url: "https://your-proxy.com/v1"
```

## 🔐 安全建议

1. **不要** 在代码中硬编码 API key
2. **使用** 环境变量管理敏感信息
3. **定期轮换** API key
4. **设置** API key 的权限和配额限制
5. **监控** 异常的 API 使用模式

## 📚 相关文档

- [CCB Gateway API](./GATEWAY_API.md)
- [CC Switch Integration](./CC_SWITCH_INTEGRATION.md)
- [Provider Configuration](../README.md#providers)

## 🆘 获取帮助

- GitHub Issues: https://github.com/your-repo/issues
- 文档: `ccb-docs`
- 状态检查: `ccb-gateway status`

---

**最后更新:** 2026-02-07
**版本:** v0.23.1
