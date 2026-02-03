"""
Smart Auto-Router for CCB Gateway.

Automatically selects the best provider based on task keywords and characteristics.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple


@dataclass
class RoutingRule:
    """A rule for routing requests to providers."""
    keywords: List[str]
    provider: str
    model: Optional[str] = None
    priority: int = 50  # Higher = more specific
    description: str = ""


@dataclass
class RoutingDecision:
    """Result of routing decision."""
    provider: str
    model: Optional[str] = None
    confidence: float = 1.0
    matched_keywords: List[str] = field(default_factory=list)
    rule_description: str = ""


# Default routing rules based on task types
DEFAULT_ROUTING_RULES: List[RoutingRule] = [
    # Frontend/UI tasks -> Gemini
    RoutingRule(
        keywords=["react", "vue", "css", "html", "frontend", "ui", "component", "tailwind", "sass", "less", "styled"],
        provider="gemini",
        model="3f",
        priority=80,
        description="Frontend development tasks",
    ),
    # Algorithm/Math tasks -> Codex o3 or DeepSeek
    RoutingRule(
        keywords=["algorithm", "proof", "math", "optimize", "complexity", "leetcode", "dynamic programming", "graph"],
        provider="codex",
        model="o3",
        priority=85,
        description="Algorithm and mathematical reasoning",
    ),
    # Code review -> Codex
    RoutingRule(
        keywords=["review", "审查", "检查", "analyze code", "code quality", "refactor"],
        provider="codex",
        model="o3",
        priority=75,
        description="Code review and analysis",
    ),
    # Image/Visual tasks -> GPT-4o
    RoutingRule(
        keywords=["image", "picture", "screenshot", "visual", "图片", "图像", "截图", "看图"],
        provider="codex",
        model="gpt-4o",
        priority=90,
        description="Image and visual analysis",
    ),
    # Long document/Analysis -> Kimi (128k context)
    RoutingRule(
        keywords=["document", "summary", "paper", "article", "论文", "文档", "总结", "分析长"],
        provider="kimi",
        priority=70,
        description="Long document analysis",
    ),
    # Chinese writing/Translation -> Kimi
    RoutingRule(
        keywords=["翻译", "中文", "写作", "文案", "translate", "chinese"],
        provider="kimi",
        priority=75,
        description="Chinese language tasks",
    ),
    # Python/General coding -> Qwen
    RoutingRule(
        keywords=["python", "script", "automation", "脚本"],
        provider="qwen",
        priority=60,
        description="Python and scripting",
    ),
    # SQL/Database -> Qwen
    RoutingRule(
        keywords=["sql", "database", "query", "数据库", "mysql", "postgres", "sqlite"],
        provider="qwen",
        priority=70,
        description="SQL and database tasks",
    ),
    # Shell/Bash -> Kimi
    RoutingRule(
        keywords=["bash", "shell", "terminal", "命令行", "linux", "unix"],
        provider="kimi",
        priority=60,
        description="Shell and terminal tasks",
    ),
    # Deep reasoning -> DeepSeek
    RoutingRule(
        keywords=["详细", "推理", "reasoning", "think through", "step by step", "深入"],
        provider="deepseek",
        model="reasoner",
        priority=65,
        description="Deep reasoning tasks",
    ),
    # Quick questions -> Kimi (fast)
    RoutingRule(
        keywords=["quick", "fast", "简单", "快速", "explain", "what is", "how to"],
        provider="kimi",
        priority=40,
        description="Quick questions and explanations",
    ),
    # Workflow/Automation -> iFlow
    RoutingRule(
        keywords=["workflow", "automation", "自动化", "流程", "pipeline"],
        provider="iflow",
        priority=70,
        description="Workflow automation",
    ),
]


class SmartRouter:
    """
    Smart router that selects providers based on task characteristics.

    Uses keyword matching and configurable rules to route requests
    to the most appropriate provider.
    """

    def __init__(
        self,
        rules: Optional[List[RoutingRule]] = None,
        default_provider: str = "kimi",
        available_providers: Optional[List[str]] = None,
    ):
        """
        Initialize the smart router.

        Args:
            rules: List of routing rules (uses defaults if None)
            default_provider: Fallback provider when no rules match
            available_providers: List of available provider names
        """
        self.rules = rules or DEFAULT_ROUTING_RULES.copy()
        self.default_provider = default_provider
        self.available_providers = available_providers or []

        # Sort rules by priority (highest first)
        self.rules.sort(key=lambda r: r.priority, reverse=True)

    def route(self, message: str) -> RoutingDecision:
        """
        Route a message to the best provider.

        Args:
            message: The message to route

        Returns:
            RoutingDecision with selected provider and metadata
        """
        message_lower = message.lower()

        # Find matching rules
        matches: List[Tuple[RoutingRule, List[str], float]] = []

        for rule in self.rules:
            # Skip if provider not available
            if self.available_providers and rule.provider not in self.available_providers:
                continue

            matched_keywords = []
            for keyword in rule.keywords:
                if keyword.lower() in message_lower:
                    matched_keywords.append(keyword)

            if matched_keywords:
                # Calculate confidence based on keyword matches
                confidence = len(matched_keywords) / len(rule.keywords)
                confidence = min(confidence * (rule.priority / 100), 1.0)
                matches.append((rule, matched_keywords, confidence))

        if not matches:
            # No matches, use default provider
            return RoutingDecision(
                provider=self.default_provider,
                confidence=0.5,
                rule_description="Default routing (no keyword matches)",
            )

        # Select best match (highest priority with most keyword matches)
        best_rule, best_keywords, best_confidence = max(
            matches,
            key=lambda x: (x[0].priority, len(x[1]), x[2]),
        )

        return RoutingDecision(
            provider=best_rule.provider,
            model=best_rule.model,
            confidence=best_confidence,
            matched_keywords=best_keywords,
            rule_description=best_rule.description,
        )

    def add_rule(self, rule: RoutingRule) -> None:
        """Add a new routing rule."""
        self.rules.append(rule)
        self.rules.sort(key=lambda r: r.priority, reverse=True)

    def remove_rule(self, keywords: List[str]) -> bool:
        """Remove a rule by its keywords."""
        for i, rule in enumerate(self.rules):
            if set(rule.keywords) == set(keywords):
                self.rules.pop(i)
                return True
        return False

    def get_rules(self) -> List[Dict[str, Any]]:
        """Get all routing rules as dictionaries."""
        return [
            {
                "keywords": rule.keywords,
                "provider": rule.provider,
                "model": rule.model,
                "priority": rule.priority,
                "description": rule.description,
            }
            for rule in self.rules
        ]

    def set_available_providers(self, providers: List[str]) -> None:
        """Update the list of available providers."""
        self.available_providers = providers


# Convenience function for direct routing
def auto_route(message: str, available_providers: Optional[List[str]] = None) -> RoutingDecision:
    """
    Route a message to the best provider.

    Args:
        message: The message to route
        available_providers: Optional list of available providers

    Returns:
        RoutingDecision with selected provider
    """
    router = SmartRouter(available_providers=available_providers)
    return router.route(message)
