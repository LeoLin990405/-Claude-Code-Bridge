# Antigravity Tools 完整指南

**版本**: 4.1.7
**Bundle ID**: com.lbjlaq.antigravity-tools
**开发者**: lbjlaq

---

## 📋 概述

**Antigravity Tools** 是一个独立的 macOS GUI 应用程序，提供本地 AI API 代理和管理服务。它运行一个本地 HTTP 服务器，实现了 Claude API 和 OpenAI API 兼容的接口。

### 核心特性

1. **本地 API 服务器**: 监听 `http://127.0.0.1:8045`
2. **多 API 格式支持**:
   - Claude API (`/v1/messages`)
   - OpenAI API (`/v1/chat/completions`)
   - Google Gemini API 兼容
3. **代理池管理**: 支持多账户代理池、故障转移、负载均衡
4. **OAuth 集成**: 自动管理 Google OAuth 认证
5. **监控和日志**: 完整的请求日志、Token 统计、IP 黑白名单

---

## 🚀 安装位置

```
/Applications/Antigravity Tools.app/
~/Library/Application Support/Antigravity/
~/Library/Application Support/com.lbjlaq.antigravity-tools/
```

---

## 🔑 API 认证

### API Key
从 CC Switch 数据库获取的 API Key:
```
sk-89f5748589e74b55926fb869d53e01e6
```

### 环境变量配置
```bash
# Antigravity API
export ANTIGRAVITY_API_KEY="sk-89f5748589e74b55926fb869d53e01e6"
export ANTIGRAVITY_BASE_URL="http://127.0.0.1:8045"
```

---

## 📡 API 端点

### 1. Claude API 格式 (推荐)

```bash
curl -X POST http://127.0.0.1:8045/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-89f5748589e74b55926fb869d53e01e6" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 1024
  }'
```

**响应格式**:
```json
{
  "id": "req_vrtx_...",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-5-thinking",
  "content": [
    {"type": "thinking", "thinking": "..."},
    {"type": "text", "text": "..."}
  ],
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 142,
    "output_tokens": 319,
    "cache_read_input_tokens": 0,
    "cache_creation_input_tokens": 0
  }
}
```

### 2. OpenAI API 格式

```bash
curl -X POST http://127.0.0.1:8045/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-89f5748589e74b55926fb869d53e01e6" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

**响应格式**:
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1770431408,
  "model": "gpt-4",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "...",
      "reasoning_content": "..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 78,
    "completion_tokens": 44,
    "total_tokens": 412
  }
}
```

### 3. 其他端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/v1/models` | GET | 可用模型列表 |
| `/v1/messages/count_tokens` | POST | Token 计数 |
| `/stats/summary` | GET | 统计摘要 |
| `/stats/hourly` | GET | 小时统计 |
| `/accounts/current` | GET | 当前账户 |
| `/proxy/status` | GET | 代理状态 |
| `/proxy/pool/config` | GET | 代理池配置 |

---

## 🎯 CCB Gateway 集成

### 当前状态

✅ **Antigravity 服务运行中** (PID: 88224)
✅ **监听端口**: 127.0.0.1:8045
✅ **API 测试成功**: Claude 和 OpenAI 格式均可用

### Gateway 配置

在 `~/.ccb_config/gateway.yaml` 中配置 Antigravity:

```yaml
# Antigravity (本地 API 代理)
antigravity:
  backend_type: "http_api"
  enabled: true
  priority: 60
  timeout_s: 300.0
  api_base_url: "http://127.0.0.1:8045"
  api_key_env: "ANTIGRAVITY_API_KEY"
  model: "claude-sonnet-4-5-20250929"
  max_tokens: 4096
  # 使用 Claude API 格式
  headers:
    anthropic-version: "2023-06-01"
```

### 环境变量设置

添加到 `~/.zshrc`:

```bash
# Antigravity Tools
export ANTIGRAVITY_API_KEY="sk-89f5748589e74b55926fb869d53e01e6"
export ANTIGRAVITY_BASE_URL="http://127.0.0.1:8045"
```

---

## 🔧 高级特性

### 1. 代理池管理

Antigravity 支持多账户代理池，可以：
- 自动在多个账户间负载均衡
- 账户失效时自动切换
- 配置优先级和权重
- 实时健康检查

### 2. OAuth 集成

自动管理 Google OAuth 认证：
```
Client ID: 1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com
OAuth endpoint: https://oauth2.googleapis.com/token
```

### 3. 安全特性

- IP 黑白名单
- Token 速率限制
- 请求日志记录
- API Key 验证

### 4. 监控和统计

- 按小时/天/周统计
- 按账户统计
- 按模型统计
- Token 使用趋势

---

## 🐛 调试和日志

### 进程信息
```bash
# 查看进程
ps aux | grep antigravi

# 查看网络连接
lsof -i :8045
netstat -an | grep 8045
```

### 配置文件
```bash
# 用户配置
~/Library/Application Support/Antigravity/User/settings.json

# 全局存储
~/Library/Application Support/Antigravity/User/globalStorage/storage.json

# 窗口状态
~/Library/Application Support/com.lbjlaq.antigravity-tools/.window-state.json
```

### API 测试
```bash
# 测试连接
curl -s http://127.0.0.1:8045/health

# 测试 Claude API
curl -s -X POST http://127.0.0.1:8045/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-89f5748589e74b55926fb869d53e01e6" \
  -d '{"model":"claude-sonnet-4-5-20250929","messages":[{"role":"user","content":"test"}],"max_tokens":50}'

# 测试 OpenAI API
curl -s -X POST http://127.0.0.1:8045/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-89f5748589e74b55926fb869d53e01e6" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}],"max_tokens":50}'
```

---

## 🔄 与 CC Switch 的关系

### 集成架构

```
CC Switch (数据库)
  └─ 存储 Provider 配置
       ├─ Claude Official (官方 API)
       ├─ AiGoCode (第三方代理)
       └─ 反重力 (Antigravity Tools)
            └─ http://127.0.0.1:8045 ← 本地服务

CCB Gateway
  └─ 读取 CC Switch 配置
       └─ 调用各个 Provider
            └─ Antigravity 作为备用 Provider
```

### Failover 队列

当前优先级（从 CC Switch 数据库）:
1. **Claude Official** (sort_index=1) - 官方 API
2. **AiGoCode-优质逆向** (sort_index=2) - 第三方代理
3. **反重力 (Antigravity)** (sort_index=3) - 本地服务

---

## 📊 使用统计

### Token 统计端点
```bash
# 总结
curl http://127.0.0.1:8045/stats/token/summary

# 按账户
curl http://127.0.0.1:8045/stats/token/by-account

# 按模型
curl http://127.0.0.1:8045/stats/token/by-model

# 小时趋势
curl http://127.0.0.1:8045/stats/token/hourly

# 日趋势
curl http://127.0.0.1:8045/stats/token/daily
```

---

## 💡 最佳实践

### 1. 作为故障转移后备

将 Antigravity 配置为最低优先级 Provider，在主要 API 失败时自动切换。

### 2. 本地开发测试

使用 Antigravity 进行本地开发和测试，避免消耗生产 API 配额。

### 3. 多账户负载均衡

配置多个账户到代理池，实现自动负载均衡和故障转移。

### 4. 监控和优化

定期检查统计数据，优化 Token 使用和账户配置。

---

## 🚨 常见问题

### Q1: Antigravity 未启动？
```bash
# 启动应用
open -a "Antigravity Tools"

# 检查进程
ps aux | grep antigravi
```

### Q2: 端口被占用？
```bash
# 查看占用进程
lsof -i :8045

# 杀死进程（谨慎操作）
kill -9 <PID>
```

### Q3: API 返回 401/403 错误？
- 检查 API Key 是否正确
- 确认请求头格式（Claude 用 `x-api-key`，OpenAI 用 `Authorization: Bearer`）
- 检查账户是否有效

### Q4: 响应速度慢？
- 检查代理池状态: `/proxy/status`
- 查看日志: `/logs`
- 优化账户配置

---

## 🔗 相关文档

- [CCB Gateway 配置](./gateway.yaml)
- [CC Switch 集成](./CC_SWITCH_INTEGRATION.md)
- [Claude 双渠道配置](./CLAUDE_DUAL_CHANNEL.md)

---

**最后更新**: 2026-02-07
**状态**: ✅ 测试通过，功能正常
