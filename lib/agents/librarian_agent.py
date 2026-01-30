"""
Librarian Agent - Documentation Specialist

Queries documentation and explains code.
"""
from __future__ import annotations

from typing import Optional, List, Dict, Any

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent_registry import AgentConfig, AgentCapability


class LibrarianAgent:
    """
    Documentation specialist agent.

    Capabilities:
    - Finding relevant documentation
    - Explaining code and concepts
    - Answering technical questions
    - Providing code examples
    """

    NAME = "librarian"
    DESCRIPTION = "Documentation and knowledge specialist. Queries docs and explains code."

    SYSTEM_PROMPT = """You are Librarian, a documentation specialist.

Your role is to find and explain documentation and code.

Guidelines:
1. Search for relevant documentation first
2. Explain concepts clearly and concisely
3. Provide practical code examples
4. Reference official documentation when possible
5. Clarify any ambiguities in the question
6. Suggest related topics that might be helpful

When explaining:
- Start with a brief overview
- Use simple language before technical terms
- Include working code examples
- Note any version-specific information

Output format:
- Brief answer to the question
- Detailed explanation
- Code examples (if applicable)
- References and further reading
"""

    CAPABILITIES = [
        AgentCapability.DOCUMENTATION,
        AgentCapability.ANALYSIS,
    ]

    PREFERRED_PROVIDERS = ["claude", "gemini"]
    FALLBACK_PROVIDERS = ["codex", "kimi"]

    TOOLS = [
        "read",
        "context7",
        "web_search",
        "grep",
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

        # Check for documentation keywords
        doc_keywords = [
            "document", "docs", "explain", "describe", "what is",
            "how to", "example", "tutorial", "guide", "reference",
            "文档", "说明", "解释", "什么是", "如何", "示例",
        ]
        for kw in doc_keywords:
            if kw in task_lower:
                score += 0.3

        # Check for question patterns
        question_patterns = [
            "what", "how", "why", "when", "where", "which",
            "can i", "should i", "is it possible",
        ]
        for pattern in question_patterns:
            if task_lower.startswith(pattern):
                score += 0.2

        return min(1.0, score)

    @classmethod
    def format_task(cls, task: str, context: Dict[str, Any]) -> str:
        """Format a task with context for execution."""
        parts = [cls.SYSTEM_PROMPT, "", "Question:", task]

        if context.get("library"):
            parts.extend(["", f"Library/Framework: {context['library']}"])

        if context.get("version"):
            parts.extend(["", f"Version: {context['version']}"])

        return "\n".join(parts)
