# CCB Gateway Demo
Output docs/demo/gateway-demo.gif

Set Shell "zsh"
Set FontSize 14
Set Width 1000
Set Height 600
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

# Title
Type "# CCB Gateway - Multi-AI Orchestration Platform"
Enter
Sleep 1s

# Check gateway status
Type "curl -s http://localhost:8765/api/status | jq '.gateway'"
Enter
Sleep 3s

# Send a request
Type `curl -s -X POST http://localhost:8765/api/ask -H 'Content-Type: application/json' -d '{"provider":"qwen","message":"Hello"}' | jq`
Enter
Sleep 4s

# Show the response
Type "# Request submitted!"
Enter
Sleep 2s
