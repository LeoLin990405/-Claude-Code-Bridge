# CCB Gateway Web UI Demo
Output docs/demo/webui-demo.gif

Set Shell "zsh"
Set FontSize 14
Set Width 1000
Set Height 600
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

# Start gateway
Type "# Start CCB Gateway"
Enter
Sleep 1s

Type "python3 -m lib.gateway.gateway_server --port 8765 &"
Enter
Sleep 2s

Type "# Open Web UI"
Enter
Sleep 1s

Type "open http://localhost:8765/"
Enter
Sleep 3s

Type "# Gateway running at http://localhost:8765"
Enter
Sleep 2s
