#!/bin/bash
# CCB Demo Script - Execute real CCB commands

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     CCB Gateway - Claude Code Multi-AI Collaboration         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
sleep 1

echo "▶ Step 1: Check Gateway Status"
echo "$ curl -s http://localhost:8765/api/status | jq '.gateway'"
curl -s http://localhost:8765/api/status | jq '.gateway'
echo ""
sleep 2

echo "▶ Step 2: Ask Qwen via Gateway"
echo "$ qask <<'EOF'"
echo "What is 2+2? Reply in one word."
echo "EOF"
echo ""
echo "Sending to Qwen..."
# Actually send request
REQ_ID=$(curl -s -X POST http://localhost:8765/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"provider":"qwen","message":"What is 2+2? Reply in one word."}' | jq -r '.request_id')
echo "Request ID: ${REQ_ID:0:8}..."
sleep 2

echo ""
echo "▶ Step 3: Ask Kimi via Gateway (Chinese)"
echo "$ kask <<'EOF'"
echo "用一个词回答：1+1等于几？"
echo "EOF"
echo ""
echo "Sending to Kimi..."
curl -s -X POST http://localhost:8765/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"provider":"kimi","message":"用一个词回答：1+1等于几？"}' | jq '{request_id: .request_id[0:8], provider}'
sleep 2

echo ""
echo "▶ Step 4: View Recent Requests"
echo "$ curl -s http://localhost:8765/api/requests | jq '.[0:3]'"
curl -s http://localhost:8765/api/requests | jq '.[0:3] | .[] | {id: .request_id[0:8], provider, status, message: .message[0:30]}'
sleep 2

echo ""
echo "▶ Step 5: Gateway Providers"
curl -s http://localhost:8765/api/status | jq '.providers | .[] | {name, status, avg_latency_ms}'
sleep 1

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Web UI: http://localhost:8765/"
echo "  Providers: Qwen, Kimi, Gemini, Codex, DeepSeek, OpenCode, iFlow"
echo "════════════════════════════════════════════════════════════════"
