# CCB Memory - Google Drive Sync 快速开始

## 🎯 功能

- ☁️ 自动备份记忆库到 Google Drive
- 🔄 跨设备同步对话历史
- 📱 手机/平板访问云端记忆
- 👥 团队协作（可选）

## 📦 安装步骤

### 1. 安装 rclone

**macOS:**
```bash
brew install rclone
```

**Linux:**
```bash
sudo apt install rclone
# 或
curl https://rclone.org/install.sh | sudo bash
```

**Windows:**
```powershell
choco install rclone
```

### 2. 配置 Google Drive

```bash
# 启动配置向导
rclone config

# 按照提示操作：
# 1. 选择 n (New remote)
# 2. 输入名称: gdrive
# 3. 选择 drive (Google Drive)
# 4. Client ID 和 Secret 可留空
# 5. Scope: 选择 1 (Full access)
# 6. 按 y 开始 OAuth 认证
# 7. 在浏览器中授权
# 8. 完成！
```

**验证配置:**
```bash
rclone listremotes
# 应该看到: gdrive:
```

### 3. 初始化 CCB Sync

```bash
# 确保 ccb-sync 在 PATH 中
export PATH="$HOME/.local/share/codex-dual/bin:$PATH"

# 初始化（首次推送）
ccb-sync init

# 或者从云端拉取（如果其他设备已有数据）
ccb-sync init --pull
```

## 🚀 使用方法

### 日常命令

```bash
# 推送到云端（备份）
ccb-sync push

# 从云端拉取（同步）
ccb-sync pull

# 查看同步状态
ccb-sync status

# 查看同步历史
ccb-sync log
```

### 完整工作流

**场景 1: 在主设备上工作**
```bash
# 使用 ccb-mem 进行对话
ccb-mem kimi "你的问题"

# 工作结束后推送到云端
ccb-sync push
```

**场景 2: 在新设备上恢复**
```bash
# 安装 rclone 和配置 Google Drive
rclone config

# 拉取记忆库
ccb-sync init --pull

# 验证数据
python3 ~/.local/share/codex-dual/lib/memory/memory_lite.py stats

# 现在可以使用了
ccb-mem kimi "继续之前的对话"
```

**场景 3: 多设备协作**
```bash
# 设备 A: 推送
ccb-sync push

# 设备 B: 拉取
ccb-sync pull

# 设备 B: 工作并推送
ccb-mem kimi "新问题"
ccb-sync push

# 设备 A: 拉取更新
ccb-sync pull
```

## ⚙️ 自动同步

### macOS (推荐)

**创建 launchd 服务：**
```bash
cat > ~/Library/LaunchAgents/com.ccb.sync.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ccb.sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/YOUR_USERNAME/.local/share/codex-dual/bin/ccb-sync</string>
        <string>auto</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/.ccb/sync_auto.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/.ccb/sync_error.log</string>
</dict>
</plist>
EOF

# 替换 YOUR_USERNAME
sed -i '' "s/YOUR_USERNAME/$USER/g" ~/Library/LaunchAgents/com.ccb.sync.plist

# 加载服务
launchctl load ~/Library/LaunchAgents/com.ccb.sync.plist

# 立即运行一次测试
launchctl start com.ccb.sync
```

**卸载自动同步：**
```bash
launchctl unload ~/Library/LaunchAgents/com.ccb.sync.plist
rm ~/Library/LaunchAgents/com.ccb.sync.plist
```

### Linux

**使用 crontab：**
```bash
# 编辑 crontab
crontab -e

# 添加每小时同步
0 * * * * ~/.local/share/codex-dual/bin/ccb-sync auto >> ~/.ccb/sync_cron.log 2>&1

# 或者每 30 分钟
*/30 * * * * ~/.local/share/codex-dual/bin/ccb-sync auto >> ~/.ccb/sync_cron.log 2>&1
```

### 手动配置

**编辑配置文件** `~/.ccb/sync_config.json`:
```json
{
  "enabled": true,
  "auto_sync": true,
  "sync_interval": 3600,
  "files_to_sync": [
    "ccb_memory.db",
    "registry_cache.json",
    "memory_config.json"
  ]
}
```

## 📊 同步状态

### 查看详细状态
```bash
ccb-sync status
```

输出示例：
```
📊 CCB Sync Status
==================================================

Provider: rclone
Remote:   gdrive:CCB-Memory
Enabled:  True
Auto:     True
Last sync: 2026-02-04T12:00:00

Files to sync (3):
  ✓ ccb_memory.db (0.10 MB)
  ✓ registry_cache.json (0.05 MB)
  ✓ memory_config.json (0.00 MB)

Recent syncs (5):
  ✓ 📤 2026-02-04 12:00:00 - 3 files
  ✓ 📥 2026-02-04 11:00:00 - 3 files
  ✓ 📤 2026-02-04 10:00:00 - 3 files
```

### 查看同步历史
```bash
# 最近 20 条记录
ccb-sync log

# 指定数量
ccb-sync log 50
```

## 🔧 高级配置

### 加密同步（推荐）

```bash
# 配置加密 remote
rclone config create ccb-crypt crypt \
  remote=gdrive:CCB-Memory \
  filename_encryption=standard \
  directory_name_encryption=true

# 设置密码
rclone config password ccb-crypt password mySecretPassword

# 修改配置使用加密 remote
# 编辑 ~/.ccb/sync_config.json
{
  "remote_name": "ccb-crypt",
  "encryption": true
}
```

### 选择性同步

**只同步特定文件：**
```json
{
  "files_to_sync": [
    "ccb_memory.db"
  ]
}
```

**排除敏感数据：**
```bash
# 同步前过滤
grep -v "password\|api_key" ~/.ccb/ccb_memory.db > /tmp/safe_db
ccb-sync push
```

### 增加同步频率

**每 15 分钟同步：**
```xml
<!-- ~/Library/LaunchAgents/com.ccb.sync.plist -->
<key>StartInterval</key>
<integer>900</integer>  <!-- 15 * 60 = 900 seconds -->
```

## 🐛 故障排除

### 问题 1: "rclone not found"

**解决:**
```bash
# 安装 rclone
brew install rclone  # macOS
sudo apt install rclone  # Linux

# 验证
which rclone
rclone version
```

### 问题 2: "Remote not configured"

**解决:**
```bash
# 检查远程配置
rclone listremotes

# 如果没有 gdrive:，重新配置
rclone config

# 测试连接
rclone ls gdrive:
```

### 问题 3: 同步失败

**检查日志:**
```bash
# 查看错误
ccb-sync log

# 手动测试
rclone ls gdrive:CCB-Memory

# 详细模式
rclone copy ~/.ccb/ccb_memory.db gdrive:CCB-Memory -v
```

### 问题 4: 文件冲突

**解决策略:**

1. **保留本地版本:**
```bash
ccb-sync push --force
```

2. **保留云端版本:**
```bash
# 备份本地
cp ~/.ccb/ccb_memory.db ~/.ccb/ccb_memory.db.backup

# 拉取云端
ccb-sync pull --force
```

3. **手动合并:**
```bash
# 下载云端版本
rclone copy gdrive:CCB-Memory/ccb_memory.db ~/.ccb/ccb_memory.db.remote

# 使用 SQLite 合并
sqlite3 ~/.ccb/ccb_memory.db << 'EOF'
ATTACH DATABASE '~/.ccb/ccb_memory.db.remote' AS remote;
INSERT OR IGNORE INTO conversations SELECT * FROM remote.conversations;
DETACH DATABASE remote;
EOF
```

### 问题 5: 网络慢

**优化:**
```bash
# 使用压缩
rclone copy --compress

# 限速（如果网络受限）
rclone copy --bwlimit 1M

# 多线程
rclone copy --transfers 4
```

## 📱 移动端访问

### 通过 Google Drive App

1. 在手机上安装 Google Drive app
2. 打开 `CCB-Memory/ccb_memory.db`
3. 使用 SQLite 查看器（如 SQLite Viewer）查看对话历史

### 通过 Web 接口（计划中）

```bash
# 启动 Web 服务器（未来功能）
ccb-sync serve --port 8080

# 在浏览器访问
# http://localhost:8080/memory
```

## 🤝 团队协作

### 共享记忆库

**设置共享文件夹：**
```bash
# 创建团队文件夹
rclone mkdir gdrive:CCB-Team

# 在 Google Drive 网页端分享给团队成员

# 配置同步到团队文件夹
# 编辑 ~/.ccb/sync_config.json
{
  "remote_path": "CCB-Team",
  "team_mode": true
}
```

**注意事项：**
- 避免同时编辑（使用锁机制）
- 定期推送和拉取
- 使用冲突解决策略

## 📚 相关文档

- [Sync Architecture](SYNC_ARCHITECTURE.md) - 详细架构设计
- [rclone 官方文档](https://rclone.org/docs/)
- [Google Drive rclone 配置](https://rclone.org/drive/)

## 💡 最佳实践

1. **定期备份** - 每天至少 push 一次
2. **拉取再推送** - 推送前先 pull 避免冲突
3. **加密敏感数据** - 使用 rclone crypt
4. **监控同步状态** - 定期检查 `ccb-sync status`
5. **保留本地备份** - 云端同步不是唯一备份

## 🎉 下一步

```bash
# 1. 安装并配置
brew install rclone
rclone config
ccb-sync init

# 2. 使用记忆系统
ccb-mem kimi "你的问题"

# 3. 同步到云端
ccb-sync push

# 4. 启用自动同步
# 按照上面的 launchd 或 crontab 配置

# 5. 享受跨设备的智能记忆！
```

**需要帮助？** 查看 [故障排除](#故障排除) 或提交 Issue。
