# CCB Gateway Web UI Demo
Output screenshots/webui-demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 700
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

# Show Gateway status
Type "# CCB Gateway v0.15 - Web UI Demo"
Enter
Sleep 1s

Type "curl -s http://localhost:8765/api/status | jq '.gateway.version, .providers | length'"
Enter
Sleep 2s

Type ""
Enter

# Show ccb-cli usage
Type "# Test multiple providers"
Enter
Sleep 500ms

Type "ccb-cli kimi 'Hello! 你好！'"
Enter
Sleep 3s

Type "ccb-cli qwen 'What is 1+1?'"
Enter
Sleep 3s

Type "ccb-cli qoder 'Review: def add(a,b): return a+b'"
Enter
Sleep 3s

Type ""
Enter

# Show cost tracking
Type "# Check costs"
Enter
Sleep 500ms

Type "curl -s http://localhost:8765/api/costs/summary | jq '.today'"
Enter
Sleep 2s

Type ""
Enter

# Show discussion
Type "# Start multi-AI discussion"
Enter
Sleep 500ms

Type "ccb-discussion 'Best practices for API design'"
Enter
Sleep 4s

Type ""
Enter
Type "# Open Web UI: http://localhost:8765"
Enter
Sleep 2s
