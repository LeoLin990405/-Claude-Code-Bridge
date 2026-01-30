"""
Explorer Agent - Codebase Navigation Specialist

Finds files, functions, and patterns in codebases.
"""
from __future__ import annotations

from typing import Optional, List, Dict, Any

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_registry import AgentConfig, AgentCapability


class ExplorerAgent:
    """
    Codebase navigation specialist agent.

    Capabilities:
    - Finding files and functions
    - Understanding code structure
    - Tracing code flow
    - Identifying patterns
    """

    NAME = "explorer"
    DESCRIPTION = "Codebase navigation specialist. Finds files, functions, and patterns."

    SYSTEM_PROMPT = """You are Explorer, a codebase navigation specialist.

Your role is to help navigate and understand codebases.

Guidelines:
1. Use efficient search strategies
2. Understand project structure conventions
3. Trace code flow and dependencies
4. Identify patterns and relationships
5. Provide clear file paths and line numbers
6. Summarize findings concisely

When exploring:
- Start with high-level structure
- Use glob patterns for file discovery
- Use grep for content search
- Follow imports and references
- Note any unusual patterns

Output format:
- Summary of findings
- Relevant file paths with line numbers
- Code structure overview
- Suggestions for further exploration
"""

    CAPABILITIES = [
        AgentCapability.NAVIGATION,
        AgentCapability.ANALYSIS,
    ]

    PREFERRED_PROVIDERS = ["gemini", "claude"]
    FALLBACK_PROVIDERS = ["codex", "opencode"]

    TOOLS = [
        "glob",
        "grep",
        "read",
        "bash",
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

        # Check for navigation keywords
        nav_keywords = [
            "find", "search", "locate", "where", "navigate",
            "look for", "show me", "list", "discover",
            "查找", "搜索", "定位", "在哪", "显示",
        ]
        for kw in nav_keywords:
            if kw in task_lower:
                score += 0.3

        # Check for structure keywords
        structure_terms = [
            "structure", "architecture", "layout", "organization",
            "files", "folders", "directories", "modules",
            "结构", "架构", "布局", "文件", "目录",
        ]
        for term in structure_terms:
            if term in task_lower:
                score += 0.2

        return min(1.0, score)

    @classmethod
    def format_task(cls, task: str, context: Dict[str, Any]) -> str:
        """Format a task with context for execution."""
        parts = [cls.SYSTEM_PROMPT, "", "Search Task:", task]

        if context.get("working_dir"):
            parts.extend(["", f"Search in: {context['working_dir']}"])

        if context.get("file_patterns"):
            parts.extend(["", f"File patterns: {', '.join(context['file_patterns'])}"])

        return "\n".join(parts)
