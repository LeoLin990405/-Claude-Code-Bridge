# CCB Gateway - Claude Code CLI Demo
Output assets/demo/ccb-demo.gif

Set Shell "zsh"
Set FontSize 13
Set Width 1200
Set Height 700
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 25ms

# Simulate Claude Code startup
Type "claude"
Enter
Sleep 2s

# Show Claude Code prompt
Type "# Welcome to Claude Code - Multi-AI Orchestration"
Enter
Sleep 1s

# User asks Claude to dispatch to Qwen
Type "> @qwen What is the capital of France?"
Enter
Sleep 1s
Type "Qwen processing (task: capital of France)..."
Enter
Sleep 2s
Type "✓ Qwen: The capital of France is Paris."
Enter
Sleep 1.5s

# User asks Claude to dispatch to Gemini
Type "> @gemini Explain Python in one sentence"
Enter
Sleep 1s
Type "Gemini processing (task: explain Python)..."
Enter
Sleep 2s
Type "✓ Gemini: Python is a high-level, interpreted programming language known for its readability and versatility."
Enter
Sleep 1.5s

# User asks Claude to dispatch to Kimi
Type "> @kimi 用中文介绍一下你自己"
Enter
Sleep 1s
Type "Kimi processing (task: self introduction)..."
Enter
Sleep 2s
Type "✓ Kimi: 我是Kimi，一个由月之暗面开发的AI助手，擅长中文对话和长文本处理。"
Enter
Sleep 1.5s

# Show parallel query
Type "> @all What is 2+2?"
Enter
Sleep 1s
Type "Querying all providers in parallel..."
Enter
Sleep 1s
Type "  ├─ Qwen: 4"
Enter
Sleep 300ms
Type "  ├─ Kimi: 4"
Enter
Sleep 300ms
Type "  ├─ Gemini: 4"
Enter
Sleep 300ms
Type "  └─ Codex: 4"
Enter
Sleep 1.5s

# Show Gateway status
Type "> Check Gateway status"
Enter
Sleep 500ms
Type "Gateway: http://localhost:8765"
Enter
Type "  Total Requests: 127"
Enter
Type "  Active Providers: 7 (Qwen, Kimi, Gemini, Codex, DeepSeek, OpenCode, iFlow)"
Enter
Type "  Avg Latency: 12.3s"
Enter
Sleep 2s

# Done
Type "> Web UI available at http://localhost:8765/"
Enter
Sleep 2s
