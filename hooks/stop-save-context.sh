#!/bin/bash
# CCB Memory Stop Hook
# Saves session context when Claude Code session stops

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract session info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Find the session jsonl file
CLAUDE_PROJECTS_DIR="$HOME/.claude/projects"
SESSION_FILE=""

if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    # transcript_path might be the jsonl file itself
    SESSION_FILE="$TRANSCRIPT_PATH"
elif [ -n "$SESSION_ID" ]; then
    # Try to find by session ID
    SESSION_FILE=$(find "$CLAUDE_PROJECTS_DIR" -name "${SESSION_ID}*.jsonl" -type f 2>/dev/null | head -1)
fi

# If still not found, use most recent session
if [ -z "$SESSION_FILE" ] || [ ! -f "$SESSION_FILE" ]; then
    SESSION_FILE=$(ls -t "$CLAUDE_PROJECTS_DIR"/**/*.jsonl 2>/dev/null | head -1)
fi

if [ -z "$SESSION_FILE" ] || [ ! -f "$SESSION_FILE" ]; then
    # No session file found, exit silently
    echo '{"decision": "approve"}'
    exit 0
fi

# Run the context saver
CCB_MEM="$HOME/.local/share/codex-dual/scripts/ccb-mem"

if [ -x "$CCB_MEM" ]; then
    # Save context in background to not block session exit
    nohup python3 "$HOME/.local/share/codex-dual/lib/memory/context_saver.py" \
        --session "$SESSION_FILE" \
        --quiet \
        > /dev/null 2>&1 &
fi

# Always approve session stop
echo '{"decision": "approve"}'
exit 0
