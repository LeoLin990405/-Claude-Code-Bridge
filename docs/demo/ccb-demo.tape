# CCB Gateway - Claude Code Integration Demo
Output assets/demo/gateway-demo.gif

Set Shell "zsh"
Set FontSize 13
Set Width 1100
Set Height 700
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 30ms

# Title
Type "# CCB Gateway - Claude Code Multi-AI Collaboration"
Enter
Sleep 1s

# Step 1: Show Claude Code starting
Type "# Claude Code as Orchestrator - dispatching to 7 AI providers"
Enter
Sleep 1.5s

# Step 2: Show asking Qwen
Type "# Ask Qwen via Gateway:"
Enter
Sleep 500ms
Type `qask <<'EOF'`
Enter
Type "What is 2+2? Reply in one word."
Enter
Type "EOF"
Enter
Sleep 2s

# Step 3: Show asking Gemini
Type "# Ask Gemini via Gateway:"
Enter
Sleep 500ms
Type `gask <<'EOF'`
Enter
Type "Explain Python in 10 words."
Enter
Type "EOF"
Enter
Sleep 2s

# Step 4: Show asking Kimi
Type "# Ask Kimi via Gateway:"
Enter
Sleep 500ms
Type `kask <<'EOF'`
Enter
Type "用一句话介绍自己"
Enter
Type "EOF"
Enter
Sleep 2s

# Step 5: Check Gateway status
Type "# Check Gateway Status:"
Enter
Sleep 500ms
Type `curl -s http://localhost:8765/api/status | jq '{total_requests: .gateway.total_requests, providers: [.providers[].name]}'`
Enter
Sleep 3s

# Step 6: View requests
Type "# Recent Requests in Gateway:"
Enter
Sleep 500ms
Type `curl -s http://localhost:8765/api/requests | jq '.[0:3] | .[] | {provider, status, message: .message[0:30]}'`
Enter
Sleep 3s

# Done
Type "# Web UI: http://localhost:8765/"
Enter
Sleep 2s
