# CCB Gateway Complete Demo
Output assets/demo/gateway-demo.gif

Set Shell "zsh"
Set FontSize 13
Set Width 1100
Set Height 650
Set Padding 20
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms

# Title
Type "# CCB Gateway - Multi-AI Orchestration Demo"
Enter
Sleep 1.5s

# Step 1: Check gateway health
Type "# Step 1: Check Gateway Health"
Enter
Sleep 500ms
Type `curl -s http://localhost:8765/api/health | jq`
Enter
Sleep 2s

# Step 2: Check gateway status
Type "# Step 2: View Gateway Status"
Enter
Sleep 500ms
Type `curl -s http://localhost:8765/api/status | jq '.gateway'`
Enter
Sleep 3s

# Step 3: Send a request
Type "# Step 3: Send Request to AI Provider"
Enter
Sleep 500ms
Type `curl -s -X POST http://localhost:8765/api/ask -H 'Content-Type: application/json' -d '{"provider":"qwen","message":"What is 2+2?"}' | jq`
Enter
Sleep 3s

# Step 4: Get response
Type "# Step 4: Get Response (with request_id from above)"
Enter
Sleep 500ms
Type `curl -s "http://localhost:8765/api/reply/$(curl -s http://localhost:8765/api/requests | jq -r '.[0].request_id')?wait=true&timeout=30" | jq '.response'`
Enter
Sleep 4s

# Step 5: View recent requests
Type "# Step 5: View Recent Requests"
Enter
Sleep 500ms
Type `curl -s http://localhost:8765/api/requests | jq '.[0:3] | .[] | {id: .request_id[0:8], provider, status}'`
Enter
Sleep 3s

# Done
Type "# Done! Web UI at http://localhost:8765/"
Enter
Sleep 2s
