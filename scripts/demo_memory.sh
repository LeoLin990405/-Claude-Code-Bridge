#!/bin/bash
# CCB Memory System Demo

echo "=========================================="
echo "CCB Memory System - Interactive Demo"
echo "=========================================="
echo ""

CCB_DIR="$HOME/.local/share/codex-dual"
REGISTRY="$CCB_DIR/lib/memory/registry.py"
MEMORY="$CCB_DIR/lib/memory/memory_lite.py"

# Step 1: Scan capabilities
echo "📊 Step 1: Scanning system capabilities..."
python3 "$REGISTRY" scan
echo ""

# Step 2: Show available providers
echo "🤖 Step 2: Available AI Providers"
echo "-----------------------------------"
python3 "$REGISTRY" list providers
echo ""

# Step 3: Show some skills
echo "🛠️  Step 3: Sample Skills (first 10)"
echo "-----------------------------------"
python3 "$REGISTRY" list skills | head -10
echo ""

# Step 4: Record sample conversations
echo "💾 Step 4: Recording sample conversations..."
python3 "$MEMORY" record kimi "如何做前端开发" "建议使用 Gemini 3f 模型，它擅长 React 和 Tailwind CSS。你可以用 frontend-design skill。"
python3 "$MEMORY" record codex "优化算法" "使用 O3 模型做深度推理，分析时间和空间复杂度。Codex 擅长算法题。"
python3 "$MEMORY" record gemini "创建 UI" "用 Gemini 3f 快速生成 React 组件。配合 canvas-design 和 web-artifacts-builder skills。"
python3 "$MEMORY" record qwen "数据分析" "Qwen 的 coder 模型适合数据处理和可视化。可以用 xlsx 和 pdf skills。"
echo "✓ Recorded 4 sample conversations"
echo ""

# Step 5: Show memory stats
echo "📈 Step 5: Memory Statistics"
echo "-----------------------------------"
python3 "$MEMORY" stats
echo ""

# Step 6: Show recent conversations
echo "💭 Step 6: Recent Conversations"
echo "-----------------------------------"
python3 "$MEMORY" recent 5
echo ""

# Step 7: Test context generation
echo "🧠 Step 7: Context for 'frontend ui' task"
echo "-----------------------------------"
python3 "$MEMORY" context frontend ui
echo ""

# Step 8: Test provider recommendation
echo "🎯 Step 8: Provider Recommendations"
echo "-----------------------------------"
echo "Task: algorithm reasoning"
python3 "$REGISTRY" find algorithm reasoning
echo ""
echo "Task: frontend ui"
python3 "$REGISTRY" find frontend ui
echo ""

# Step 9: Show ccb-mem usage
echo "🚀 Step 9: Using ccb-mem (enhanced ccb-cli)"
echo "-----------------------------------"
echo "Command: ccb-mem kimi '帮我做前端'"
echo ""
echo "This will automatically inject context:"
python3 "$MEMORY" context frontend ui react
echo ""

# Summary
echo "=========================================="
echo "✅ Demo Complete!"
echo "=========================================="
echo ""
echo "Quick Commands:"
echo "  • Scan: python3 $REGISTRY scan"
echo "  • Stats: python3 $MEMORY stats"
echo "  • Recent: python3 $MEMORY recent 10"
echo "  • Context: python3 $MEMORY context <keywords>"
echo "  • Use: ccb-mem <provider> 'your question'"
echo ""
echo "Documentation: $CCB_DIR/lib/memory/QUICKSTART.md"
