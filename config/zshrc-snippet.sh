# CCB (Claude Code Bridge) ZSH Configuration Snippet
# Add this to your ~/.zshrc

# ========== CCB PATH ==========
export PATH="$HOME/.local/share/codex-dual:$HOME/.local/share/codex-dual/bin:$PATH"
export PATH="$HOME/.npm-global/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# ========== CCB Claude wrapper ==========
claude() {
  export CCB_SIDECAR_AUTOSTART=1
  export CCB_SIDECAR_DIRECTION=right
  export CCB_CLI_READY_WAIT_S=20
  command claude "$@"
}

# ========== OpenClaw Completion (if installed) ==========
# Redirect stderr to avoid ANSI color codes being parsed as glob patterns
# This fixes: /dev/fd/12:1: bad pattern: ^[[33m[agents/auth-profiles]^[[39m
if command -v openclaw &>/dev/null; then
  source <(openclaw completion --shell zsh 2>/dev/null)
fi
