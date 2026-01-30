"""
Sisyphus Agent - Code Implementation Specialist

Writes, modifies, and refactors code with focus on quality and best practices.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, List, Dict, Any

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_registry import AgentConfig, AgentCapability


@dataclass
class CodeChange:
    """A code change to be made."""
    file_path: str
    change_type: str  # create, modify, delete
    description: str
    content: Optional[str] = None


class SisyphusAgent:
    """
    Code implementation specialist agent.

    Capabilities:
    - Writing new code
    - Modifying existing code
    - Refactoring for better structure
    - Following coding standards
    """

    NAME = "sisyphus"
    DESCRIPTION = "Code implementation specialist. Writes, modifies, and refactors code."

    SYSTEM_PROMPT = """You are Sisyphus, a code implementation specialist.

Your role is to write clean, efficient, and well-documented code.

Guidelines:
1. Write production-ready code that follows best practices
2. Use proper error handling and edge case management
3. Follow the existing code style in the project
4. Add meaningful comments only where logic is complex
5. Keep functions focused and single-purpose
6. Use descriptive variable and function names

When implementing:
- First understand the existing codebase structure
- Plan the changes before writing code
- Consider backward compatibility
- Write tests if the project has a test suite

Output format:
- Explain your approach briefly
- Show the code changes with file paths
- Note any dependencies or follow-up tasks
"""

    CAPABILITIES = [
        AgentCapability.CODE_WRITE,
        AgentCapability.CODE_REFACTOR,
        AgentCapability.BACKEND,
    ]

    PREFERRED_PROVIDERS = ["codex", "gemini"]
    FALLBACK_PROVIDERS = ["claude", "opencode"]

    TOOLS = [
        "file_write",
        "file_edit",
        "bash",
        "grep",
        "glob",
        "read",
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
        """
        Check if this agent can handle the task.

        Returns confidence score 0-1.
        """
        task_lower = task.lower()
        score = 0.0

        # Check for implementation keywords
        impl_keywords = [
            "implement", "write", "create", "add", "build", "develop",
            "fix", "update", "modify", "change", "refactor",
            "实现", "编写", "创建", "添加", "修改", "重构",
        ]
        for kw in impl_keywords:
            if kw in task_lower:
                score += 0.3

        # Check for code-related terms
        code_terms = [
            "function", "class", "method", "api", "endpoint",
            "module", "component", "service", "handler",
            "函数", "类", "方法", "接口", "模块",
        ]
        for term in code_terms:
            if term in task_lower:
                score += 0.2

        # Check file patterns
        if files:
            for f in files:
                if any(ext in f for ext in ['.py', '.js', '.ts', '.go', '.rs', '.java']):
                    score += 0.1

        return min(1.0, score)

    @classmethod
    def format_task(cls, task: str, context: Dict[str, Any]) -> str:
        """Format a task with context for execution."""
        parts = [cls.SYSTEM_PROMPT, "", "Task:", task]

        if context.get("files"):
            parts.extend(["", "Relevant files:", ", ".join(context["files"])])

        if context.get("working_dir"):
            parts.extend(["", f"Working directory: {context['working_dir']}"])

        return "\n".join(parts)
