"""
Frontend Agent - Frontend Development Specialist

Builds user interfaces with React, Vue, CSS, and modern frameworks.
"""
from __future__ import annotations

from typing import Optional, List, Dict, Any

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_registry import AgentConfig, AgentCapability


class FrontendAgent:
    """
    Frontend development specialist agent.

    Capabilities:
    - React, Vue, Angular development
    - CSS and styling
    - Component architecture
    - UI/UX best practices
    """

    NAME = "frontend"
    DESCRIPTION = "Frontend development specialist. React, Vue, CSS, and UI/UX."

    SYSTEM_PROMPT = """You are Frontend, a frontend development specialist.

Your role is to build beautiful and functional user interfaces.

Guidelines:
1. Follow modern frontend best practices
2. Write accessible and responsive code
3. Use semantic HTML
4. Optimize for performance
5. Follow component-based architecture
6. Consider mobile-first design

When developing:
- Use TypeScript for type safety
- Follow the project's existing patterns
- Keep components small and focused
- Use CSS modules or styled-components
- Consider accessibility (a11y)

Output format:
- Component structure overview
- Code with proper typing
- Styling approach
- Usage examples
"""

    CAPABILITIES = [
        AgentCapability.FRONTEND,
        AgentCapability.CODE_WRITE,
    ]

    PREFERRED_PROVIDERS = ["gemini", "claude"]
    FALLBACK_PROVIDERS = ["codex", "opencode"]

    TOOLS = [
        "file_write",
        "file_edit",
        "read",
        "glob",
    ]

    # File patterns this agent handles
    FILE_PATTERNS = [
        "*.tsx", "*.jsx", "*.vue", "*.svelte",
        "*.css", "*.scss", "*.sass", "*.less",
        "*.html", "*.htm",
    ]

    @classmethod
    def get_config(cls) -> AgentConfig:
        """Get the agent configuration."""
        return AgentConfig(
            name=cls.NAME,
            description=cls.DESCRIPTION,
            capabilities=cls.CAPABILITIES,
            preferred_providers=cls.PREFERRED_PROVIDERS,
            fallback_providers=cls.FALLBACK_PROVIDERS,
            tools=cls.TOOLS,
            system_prompt=cls.SYSTEM_PROMPT,
        )

    @classmethod
    def can_handle(cls, task: str, files: Optional[List[str]] = None) -> float:
        """Check if this agent can handle the task."""
        task_lower = task.lower()
        score = 0.0

        # Check for frontend keywords
        frontend_keywords = [
            "react", "vue", "angular", "svelte", "next", "nuxt",
            "component", "ui", "ux", "interface", "frontend",
            "css", "style", "layout", "responsive", "animation",
            "前端", "组件", "界面", "样式", "布局",
        ]
        for kw in frontend_keywords:
            if kw in task_lower:
                score += 0.3

        # Check file patterns
        if files:
            for f in files:
                f_lower = f.lower()
                if any(f_lower.endswith(ext.replace("*", "")) for ext in cls.FILE_PATTERNS):
                    score += 0.3
                if any(path in f_lower for path in ['components/', 'pages/', 'styles/', 'views/']):
                    score += 0.2

        return min(1.0, score)

    @classmethod
    def format_task(cls, task: str, context: Dict[str, Any]) -> str:
        """Format a task with context for execution."""
        parts = [cls.SYSTEM_PROMPT, "", "UI Task:", task]

        if context.get("framework"):
            parts.extend(["", f"Framework: {context['framework']}"])

        if context.get("design_system"):
            parts.extend(["", f"Design System: {context['design_system']}"])

        if context.get("files"):
            parts.extend(["", "Related files:", ", ".join(context["files"])])

        return "\n".join(parts)
