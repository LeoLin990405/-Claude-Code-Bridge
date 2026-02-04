# CCB Memory - Google Drive Sync Architecture

## 概述

将 CCB 记忆库同步到 Google Drive，实现：
- 📤 云端备份
- 🔄 跨设备同步
- 🤝 团队协作（可选）
- 🔒 加密存储（可选）

## 同步方案对比

### 方案 1: rclone (推荐)

**优点：**
- ✅ 简单易用，无需编程
- ✅ 支持多种云存储（Google Drive, Dropbox, OneDrive 等）
- ✅ 成熟稳定，广泛使用
- ✅ 支持加密、压缩、增量同步
- ✅ 命令行友好，易于自动化

**缺点：**
- ❌ 需要额外安装
- ❌ 不是实时同步（需要定时任务）

**适合场景：** 个人使用，定期备份

### 方案 2: Google Drive API

**优点：**
- ✅ 原生集成，无需外部工具
- ✅ 可实现实时同步
- ✅ 细粒度控制
- ✅ 支持文件监听（inotify/watchdog）

**缺点：**
- ❌ 实现复杂
- ❌ 需要 OAuth 认证
- ❌ 维护成本高

**适合场景：** 需要实时同步，团队协作

### 方案 3: 混合方案

**策略：**
- 日常使用 rclone 定期同步
- 关键操作后手动 push
- 新设备启动时 pull

## 推荐架构：rclone + 自动化脚本

```
~/.ccb/                          Google Drive
  ├── ccb_memory.db         <──> /CCB-Memory/ccb_memory.db
  ├── registry_cache.json   <──> /CCB-Memory/registry_cache.json
  └── memory_config.json    <──> /CCB-Memory/memory_config.json

同步策略：
1. 每次 ccb-mem 使用后，可选 auto-push
2. 每小时自动同步（cron/launchd）
3. 手动命令：ccb-sync push/pull
```

## 数据结构

### 需要同步的文件

**核心数据：**
- `~/.ccb/ccb_memory.db` - SQLite 数据库（对话历史）
- `~/.ccb/registry_cache.json` - 注册表缓存
- `~/.ccb/memory_config.json` - 配置文件

**可选同步：**
- `~/.ccb/sync_log.json` - 同步日志
- `~/.ccb/conflict_backups/` - 冲突备份

**不同步：**
- `~/.ccb/qdrant_data/` - 向量数据库（太大）
- `~/.ccb/mem0_history.db` - Mem0 历史（本地优化）

## 同步冲突处理

### 策略 1: Timestamp-based (简单)

```python
if remote_timestamp > local_timestamp:
    action = "pull"  # 远程更新
elif local_timestamp > remote_timestamp:
    action = "push"  # 本地更新
else:
    action = "skip"  # 一致
```

### 策略 2: 三向合并 (复杂)

```python
# 记录上次同步的状态
last_sync_hash = get_last_sync_hash()
local_hash = hash_file(local_db)
remote_hash = hash_file(remote_db)

if local_hash == remote_hash:
    # 一致
elif local_hash == last_sync_hash:
    # 本地未修改，拉取远程
    pull()
elif remote_hash == last_sync_hash:
    # 远程未修改，推送本地
    push()
else:
    # 双方都修改了，需要合并
    merge_databases()
```

### 策略 3: 让用户选择

```bash
⚠️  Conflict detected!
  Local:  2026-02-04 12:00:00 (25 conversations)
  Remote: 2026-02-04 11:30:00 (23 conversations)

Options:
  1. Keep local (push)
  2. Keep remote (pull)
  3. Merge both
  4. Manual resolution

Your choice [1]:
```

## 安全性

### 1. 加密存储

```bash
# rclone 内置加密
rclone config create ccb-crypt crypt \
  remote=gdrive:CCB-Memory \
  password=$(openssl rand -base64 32)
```

### 2. 敏感数据过滤

```python
# 同步前检查敏感信息
SENSITIVE_PATTERNS = [
    r"password",
    r"api_key",
    r"secret",
    r"token"
]

def should_sync(content):
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, content, re.IGNORECASE):
            return False
    return True
```

### 3. 访问控制

- 使用 OAuth2 限制访问权限
- 仅读写特定文件夹
- 不授予删除权限

## 实现细节

### 配置文件：~/.ccb/sync_config.json

```json
{
  "enabled": true,
  "provider": "rclone",
  "remote_name": "gdrive",
  "remote_path": "CCB-Memory",
  "auto_sync": true,
  "sync_interval": 3600,
  "conflict_resolution": "ask",
  "encryption": true,
  "files_to_sync": [
    "ccb_memory.db",
    "registry_cache.json",
    "memory_config.json"
  ],
  "last_sync": "2026-02-04T12:00:00Z"
}
```

### 同步日志：~/.ccb/sync_log.json

```json
{
  "syncs": [
    {
      "timestamp": "2026-02-04T12:00:00Z",
      "direction": "push",
      "files_synced": ["ccb_memory.db"],
      "status": "success",
      "bytes_transferred": 102400
    }
  ]
}
```

## 使用流程

### 1. 初始设置

```bash
# 安装 rclone
brew install rclone  # macOS
# apt install rclone  # Linux

# 配置 Google Drive
rclone config

# 初始化同步
ccb-sync init
```

### 2. 日常使用

```bash
# 手动推送到云端
ccb-sync push

# 从云端拉取
ccb-sync pull

# 查看同步状态
ccb-sync status

# 查看同步历史
ccb-sync log
```

### 3. 新设备设置

```bash
# 在新设备上
ccb-sync init --pull
# 从 Google Drive 拉取所有记忆
```

## 自动同步

### macOS (launchd)

```xml
<!-- ~/Library/LaunchAgents/com.ccb.sync.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ccb.sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/leo/.local/share/codex-dual/bin/ccb-sync</string>
        <string>auto</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

### Linux (cron)

```bash
# 每小时同步一次
0 * * * * ~/.local/share/codex-dual/bin/ccb-sync auto
```

## 团队协作支持（可选）

### 共享记忆库

```bash
# 创建团队记忆库
ccb-sync init --team --remote gdrive:CCB-Team

# 订阅团队更新
ccb-sync subscribe team

# 本地+团队双重记忆
# 优先使用本地，团队作为补充
```

### 权限管理

```json
{
  "team_mode": true,
  "read_only": false,
  "contributors": [
    "user1@example.com",
    "user2@example.com"
  ]
}
```

## 性能优化

### 1. 增量同步

```bash
# 只同步修改的文件
rclone sync --update --use-server-modtime
```

### 2. 压缩传输

```bash
# 压缩后上传
rclone sync --compress
```

### 3. 并行上传

```bash
# 多线程上传
rclone sync --transfers 4
```

## 监控和告警

### 同步状态 API

```python
GET /api/sync/status
{
  "last_sync": "2026-02-04T12:00:00Z",
  "next_sync": "2026-02-04T13:00:00Z",
  "status": "synced",
  "conflicts": 0,
  "bytes_in_cloud": 102400
}
```

### 失败告警

```bash
# 同步失败时发送通知
if ! ccb-sync push; then
    osascript -e 'display notification "CCB Sync Failed" with title "CCB"'
fi
```

## 迁移指南

### 从本地迁移到云端

```bash
# 1. 备份当前数据
cp -r ~/.ccb ~/.ccb.backup

# 2. 初始化同步
ccb-sync init

# 3. 首次推送
ccb-sync push --force

# 4. 验证
ccb-sync verify
```

### 从云端恢复

```bash
# 1. 初始化（拉取模式）
ccb-sync init --pull

# 2. 验证数据完整性
python3 lib/memory/memory_lite.py stats

# 3. 启用自动同步
ccb-sync enable-auto
```

## 故障排除

### 问题 1: 冲突频繁

**原因:** 多设备同时写入

**解决:**
```bash
# 设置主设备
ccb-sync set-primary

# 其他设备设为只读
ccb-sync set-readonly
```

### 问题 2: 同步慢

**原因:** 数据库太大

**解决:**
```bash
# 清理旧数据
python3 lib/memory/memory_lite.py cleanup --days 90

# 使用增量同步
ccb-sync config --incremental
```

### 问题 3: 网络中断

**原因:** 上传失败

**解决:**
```bash
# 自动重试
ccb-sync config --retry 3 --retry-delay 10
```

## 未来扩展

1. **实时同步** - 使用 watchdog 监听文件变化
2. **版本控制** - 保留历史版本，支持回滚
3. **选择性同步** - 只同步特定 provider 的对话
4. **多云支持** - 同时同步到 Google Drive + Dropbox
5. **Web 管理界面** - 在 Gateway Web UI 中管理同步

## 总结

**推荐配置：**
- 使用 rclone + 自动化脚本
- 每小时自动同步
- 冲突时询问用户
- 启用加密存储
- 保留 30 天同步日志
