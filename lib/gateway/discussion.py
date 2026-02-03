"""
Discussion Executor for CCB Gateway.

Provides multi-round AI discussion orchestration across multiple providers.
"""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any, List, TYPE_CHECKING, Callable

from .models import (
    DiscussionStatus,
    DiscussionSession,
    DiscussionMessage,
    DiscussionConfig,
    MessageType,
    GatewayRequest,
    RequestStatus,
    WebSocketEvent,
)
from .state_store import StateStore

if TYPE_CHECKING:
    from .backends.base_backend import BaseBackend


class DiscussionExporter:
    """Exports discussions to various formats (Markdown, JSON, HTML)."""

    def __init__(self, store: StateStore):
        self.store = store

    def export(
        self,
        session_id: str,
        format: str = "md",
        include_metadata: bool = True,
    ) -> str:
        """
        Export a discussion to the specified format.

        Args:
            session_id: The discussion session ID
            format: Export format - 'md', 'json', or 'html'
            include_metadata: Whether to include metadata in export

        Returns:
            Exported content as string
        """
        session = self.store.get_discussion_session(session_id)
        if not session:
            raise ValueError(f"Discussion not found: {session_id}")

        messages = self.store.get_discussion_messages(session_id)

        if format == "json":
            return self._export_json(session, messages, include_metadata)
        elif format == "html":
            return self._export_html(session, messages, include_metadata)
        else:  # Default to markdown
            return self._export_markdown(session, messages, include_metadata)

    def _export_markdown(
        self,
        session: DiscussionSession,
        messages: List[DiscussionMessage],
        include_metadata: bool,
    ) -> str:
        """Export discussion to Markdown format."""
        lines = []

        # Header with metadata
        if include_metadata:
            lines.append("---")
            lines.append(f"title: \"{session.topic}\"")
            lines.append(f"session_id: {session.id}")
            lines.append(f"status: {session.status.value}")
            lines.append(f"providers: [{', '.join(session.providers)}]")
            lines.append(f"created_at: {datetime.fromtimestamp(session.created_at).isoformat()}")
            if session.updated_at:
                lines.append(f"updated_at: {datetime.fromtimestamp(session.updated_at).isoformat()}")
            lines.append("---")
            lines.append("")

        # Title
        lines.append(f"# {session.topic}")
        lines.append("")
        lines.append(f"**Participants:** {', '.join(session.providers)}")
        lines.append(f"**Status:** {session.status.value}")
        lines.append("")

        # Group messages by round
        round_1 = [m for m in messages if m.round_number == 1]
        round_2 = [m for m in messages if m.round_number == 2]
        round_3 = [m for m in messages if m.round_number == 3]
        summary_msgs = [m for m in messages if m.message_type == MessageType.SUMMARY]

        # Round 1: Proposals
        if round_1:
            lines.append("## Round 1: Initial Proposals")
            lines.append("")
            for msg in round_1:
                lines.append(f"### {msg.provider}")
                if msg.latency_ms:
                    lines.append(f"*Response time: {msg.latency_ms:.0f}ms*")
                lines.append("")
                lines.append(msg.content or "*No content*")
                lines.append("")

        # Round 2: Reviews
        if round_2:
            lines.append("## Round 2: Reviews and Feedback")
            lines.append("")
            for msg in round_2:
                lines.append(f"### {msg.provider}")
                if msg.latency_ms:
                    lines.append(f"*Response time: {msg.latency_ms:.0f}ms*")
                lines.append("")
                lines.append(msg.content or "*No content*")
                lines.append("")

        # Round 3: Revisions
        if round_3:
            lines.append("## Round 3: Revised Proposals")
            lines.append("")
            for msg in round_3:
                lines.append(f"### {msg.provider}")
                if msg.latency_ms:
                    lines.append(f"*Response time: {msg.latency_ms:.0f}ms*")
                lines.append("")
                lines.append(msg.content or "*No content*")
                lines.append("")

        # Summary
        if session.summary or summary_msgs:
            lines.append("## Summary")
            lines.append("")
            if summary_msgs:
                for msg in summary_msgs:
                    lines.append(f"*Synthesized by {msg.provider}*")
                    lines.append("")
                    lines.append(msg.content or session.summary or "*No summary*")
            else:
                lines.append(session.summary or "*No summary available*")
            lines.append("")

        return "\n".join(lines)

    def _export_json(
        self,
        session: DiscussionSession,
        messages: List[DiscussionMessage],
        include_metadata: bool,
    ) -> str:
        """Export discussion to JSON format."""
        data = {
            "session": {
                "id": session.id,
                "topic": session.topic,
                "status": session.status.value,
                "providers": session.providers,
                "current_round": session.current_round,
                "summary": session.summary,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
            },
            "messages": [
                {
                    "id": m.id,
                    "round_number": m.round_number,
                    "provider": m.provider,
                    "message_type": m.message_type.value,
                    "content": m.content,
                    "status": m.status,
                    "latency_ms": m.latency_ms,
                    "created_at": m.created_at,
                }
                for m in messages
            ],
        }

        if include_metadata:
            data["session"]["config"] = session.config.to_dict()
            data["session"]["metadata"] = session.metadata
            for i, m in enumerate(messages):
                data["messages"][i]["metadata"] = m.metadata

        return json.dumps(data, indent=2, ensure_ascii=False)

    def _export_html(
        self,
        session: DiscussionSession,
        messages: List[DiscussionMessage],
        include_metadata: bool,
    ) -> str:
        """Export discussion to HTML format."""
        # Group messages by round
        round_1 = [m for m in messages if m.round_number == 1]
        round_2 = [m for m in messages if m.round_number == 2]
        round_3 = [m for m in messages if m.round_number == 3]
        summary_msgs = [m for m in messages if m.message_type == MessageType.SUMMARY]

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{session.topic} - CCB Discussion</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            margin: 0 0 10px 0;
        }}
        .meta {{
            opacity: 0.9;
            font-size: 14px;
        }}
        .round {{
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .round h2 {{
            color: #667eea;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }}
        .message {{
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 15px 0;
            background: #f9f9f9;
            border-radius: 0 8px 8px 0;
        }}
        .message h3 {{
            margin: 0 0 10px 0;
            color: #333;
        }}
        .message .latency {{
            font-size: 12px;
            color: #888;
            margin-bottom: 10px;
        }}
        .message .content {{
            white-space: pre-wrap;
            line-height: 1.6;
        }}
        .summary {{
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }}
        .summary h2 {{
            color: #2d3748;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{session.topic}</h1>
        <div class="meta">
            <strong>Participants:</strong> {', '.join(session.providers)}<br>
            <strong>Status:</strong> {session.status.value}<br>
            <strong>Session ID:</strong> {session.id}
        </div>
    </div>
"""

        def render_messages(msgs: List[DiscussionMessage], title: str) -> str:
            if not msgs:
                return ""
            html_part = f'<div class="round"><h2>{title}</h2>'
            for msg in msgs:
                latency = f'<div class="latency">Response time: {msg.latency_ms:.0f}ms</div>' if msg.latency_ms else ''
                content = (msg.content or '*No content*').replace('<', '&lt;').replace('>', '&gt;')
                html_part += f'''
                <div class="message">
                    <h3>{msg.provider}</h3>
                    {latency}
                    <div class="content">{content}</div>
                </div>
'''
            html_part += '</div>'
            return html_part

        html += render_messages(round_1, "Round 1: Initial Proposals")
        html += render_messages(round_2, "Round 2: Reviews and Feedback")
        html += render_messages(round_3, "Round 3: Revised Proposals")

        # Summary
        if session.summary or summary_msgs:
            summary_content = ""
            if summary_msgs:
                for msg in summary_msgs:
                    summary_content = (msg.content or session.summary or "*No summary*").replace('<', '&lt;').replace('>', '&gt;')
            else:
                summary_content = (session.summary or "*No summary available*").replace('<', '&lt;').replace('>', '&gt;')

            html += f'''
    <div class="round summary">
        <h2>Summary</h2>
        <div class="content" style="white-space: pre-wrap; line-height: 1.6;">{summary_content}</div>
    </div>
'''

        html += """
</body>
</html>
"""
        return html


class ObsidianExporter:
    """Exports discussions to Obsidian vault format."""

    def __init__(self, store: StateStore):
        self.store = store

    def export_to_vault(
        self,
        session_id: str,
        vault_path: str,
        folder: str = "CCB Discussions",
    ) -> str:
        """
        Export a discussion to an Obsidian vault.

        Args:
            session_id: The discussion session ID
            vault_path: Path to the Obsidian vault
            folder: Subfolder within the vault

        Returns:
            Path to the created file
        """
        from pathlib import Path

        session = self.store.get_discussion_session(session_id)
        if not session:
            raise ValueError(f"Discussion not found: {session_id}")

        messages = self.store.get_discussion_messages(session_id)

        # Generate content
        content = self._generate_obsidian_content(session, messages)

        # Create filename
        date_str = datetime.fromtimestamp(session.created_at).strftime("%Y-%m-%d")
        topic_slug = self._slugify(session.topic[:50])
        filename = f"{date_str} - {topic_slug}.md"

        # Create folder if needed
        vault = Path(vault_path).expanduser()
        target_dir = vault / folder
        target_dir.mkdir(parents=True, exist_ok=True)

        # Write file
        target_path = target_dir / filename
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(content)

        return str(target_path)

    def _slugify(self, text: str) -> str:
        """Convert text to a safe filename slug."""
        import re
        # Replace spaces and special chars
        slug = re.sub(r'[^\w\s-]', '', text)
        slug = re.sub(r'[\s_]+', '-', slug)
        return slug.strip('-').lower()

    def _generate_obsidian_content(
        self,
        session: DiscussionSession,
        messages: List[DiscussionMessage],
    ) -> str:
        """Generate Obsidian-compatible markdown content."""
        lines = []

        # YAML frontmatter
        lines.append("---")
        lines.append(f"title: \"{session.topic}\"")
        lines.append(f"session_id: {session.id}")
        lines.append(f"status: {session.status.value}")
        lines.append(f"providers:")
        for p in session.providers:
            lines.append(f"  - {p}")
        lines.append(f"created: {datetime.fromtimestamp(session.created_at).strftime('%Y-%m-%dT%H:%M:%S')}")
        lines.append("tags:")
        lines.append("  - ccb-discussion")
        lines.append("  - ai-collaboration")
        for p in session.providers:
            lines.append(f"  - provider/{p}")
        lines.append("---")
        lines.append("")

        # Title and metadata
        lines.append(f"# {session.topic}")
        lines.append("")
        lines.append("> [!info] Discussion Metadata")
        lines.append(f"> **Participants:** {', '.join(session.providers)}")
        lines.append(f"> **Status:** {session.status.value}")
        lines.append(f"> **Session ID:** `{session.id}`")
        lines.append("")

        # Group messages by round
        round_1 = [m for m in messages if m.round_number == 1]
        round_2 = [m for m in messages if m.round_number == 2]
        round_3 = [m for m in messages if m.round_number == 3]
        summary_msgs = [m for m in messages if m.message_type == MessageType.SUMMARY]

        # Round 1
        if round_1:
            lines.append("## 📝 Round 1: Initial Proposals")
            lines.append("")
            for msg in round_1:
                lines.append(f"### {msg.provider}")
                if msg.latency_ms:
                    lines.append(f"*⏱️ {msg.latency_ms:.0f}ms*")
                lines.append("")
                lines.append(msg.content or "*No content*")
                lines.append("")

        # Round 2
        if round_2:
            lines.append("## 🔍 Round 2: Reviews")
            lines.append("")
            for msg in round_2:
                lines.append(f"### {msg.provider}")
                if msg.latency_ms:
                    lines.append(f"*⏱️ {msg.latency_ms:.0f}ms*")
                lines.append("")
                lines.append(msg.content or "*No content*")
                lines.append("")

        # Round 3
        if round_3:
            lines.append("## ✏️ Round 3: Revisions")
            lines.append("")
            for msg in round_3:
                lines.append(f"### {msg.provider}")
                if msg.latency_ms:
                    lines.append(f"*⏱️ {msg.latency_ms:.0f}ms*")
                lines.append("")
                lines.append(msg.content or "*No content*")
                lines.append("")

        # Summary
        if session.summary or summary_msgs:
            lines.append("## 📋 Summary")
            lines.append("")
            lines.append("> [!summary]")
            summary_content = ""
            if summary_msgs:
                summary_content = summary_msgs[0].content or session.summary or "*No summary*"
            else:
                summary_content = session.summary or "*No summary available*"

            # Indent for callout
            for line in summary_content.split("\n"):
                lines.append(f"> {line}")
            lines.append("")

        # Footer
        lines.append("---")
        lines.append("*Generated by CCB Gateway*")

        return "\n".join(lines)


class DiscussionPromptBuilder:
    """Builds prompts for each round of discussion."""

    @staticmethod
    def build_proposal_prompt(topic: str, provider: str) -> str:
        """Build prompt for round 1 (proposal)."""
        return f"""You are participating in a multi-AI collaborative discussion.

**Topic**: {topic}

**Your Role**: Provide your initial proposal or analysis on this topic.

**Instructions**:
1. Analyze the topic thoroughly
2. Present your perspective, approach, or solution
3. Be specific and actionable
4. Consider potential challenges and trade-offs
5. Keep your response focused and well-structured

Please provide your proposal:"""

    @staticmethod
    def build_review_prompt(
        topic: str,
        provider: str,
        proposals: List[DiscussionMessage],
    ) -> str:
        """Build prompt for round 2 (review)."""
        proposals_text = ""
        for i, msg in enumerate(proposals, 1):
            proposals_text += f"\n### Proposal from {msg.provider}:\n{msg.content}\n"

        return f"""You are participating in a multi-AI collaborative discussion.

**Topic**: {topic}

**Your Role**: Review and provide feedback on the proposals from other AI participants.

**Other Proposals**:
{proposals_text}

**Instructions**:
1. Analyze each proposal's strengths and weaknesses
2. Identify areas of agreement and disagreement
3. Suggest improvements or alternatives
4. Point out any missing considerations
5. Be constructive and specific in your feedback

Please provide your review:"""

    @staticmethod
    def build_revision_prompt(
        topic: str,
        provider: str,
        original_proposal: DiscussionMessage,
        feedback: List[DiscussionMessage],
    ) -> str:
        """Build prompt for round 3 (revision)."""
        feedback_text = ""
        for msg in feedback:
            feedback_text += f"\n### Feedback from {msg.provider}:\n{msg.content}\n"

        return f"""You are participating in a multi-AI collaborative discussion.

**Topic**: {topic}

**Your Role**: Revise your original proposal based on the feedback received.

**Your Original Proposal**:
{original_proposal.content}

**Feedback Received**:
{feedback_text}

**Instructions**:
1. Consider all feedback carefully
2. Incorporate valid suggestions
3. Address concerns raised by others
4. Explain any changes you made
5. Present your revised proposal clearly

Please provide your revised proposal:"""

    @staticmethod
    def build_summary_prompt(
        session: DiscussionSession,
        all_messages: List[DiscussionMessage],
    ) -> str:
        """Build prompt for final summary."""
        # Group messages by round
        round_1 = [m for m in all_messages if m.round_number == 1]
        round_2 = [m for m in all_messages if m.round_number == 2]
        round_3 = [m for m in all_messages if m.round_number == 3]

        discussion_text = "## Round 1: Initial Proposals\n"
        for msg in round_1:
            discussion_text += f"\n### {msg.provider}:\n{msg.content}\n"

        if round_2:
            discussion_text += "\n## Round 2: Reviews and Feedback\n"
            for msg in round_2:
                discussion_text += f"\n### {msg.provider}:\n{msg.content}\n"

        if round_3:
            discussion_text += "\n## Round 3: Revised Proposals\n"
            for msg in round_3:
                discussion_text += f"\n### {msg.provider}:\n{msg.content}\n"

        return f"""You are the orchestrator of a multi-AI collaborative discussion.

**Topic**: {session.topic}

**Participants**: {', '.join(session.providers)}

**Full Discussion**:
{discussion_text}

**Your Task**: Synthesize the discussion and provide a comprehensive summary.

**Instructions**:
1. Identify key points of consensus among participants
2. Highlight areas of disagreement and different perspectives
3. Extract the most valuable insights and recommendations
4. Provide a clear, actionable conclusion
5. Note any unresolved questions or areas needing further exploration

Please provide your summary:"""


class DiscussionExecutor:
    """
    Orchestrates multi-round AI discussions.

    Usage:
        executor = DiscussionExecutor(store, backends, config)
        session = await executor.start_discussion(topic, providers)
        await executor.run_full_discussion(session.id)
    """

    def __init__(
        self,
        store: StateStore,
        backends: Dict[str, "BaseBackend"],
        gateway_config: Any = None,
        ws_broadcast: Optional[Callable] = None,
    ):
        """
        Initialize the discussion executor.

        Args:
            store: State store for persistence
            backends: Dict of provider name -> backend instance
            gateway_config: Gateway configuration
            ws_broadcast: Optional WebSocket broadcast function
        """
        self.store = store
        self.backends = backends
        self.gateway_config = gateway_config
        self.ws_broadcast = ws_broadcast
        self.prompt_builder = DiscussionPromptBuilder()

    async def start_discussion(
        self,
        topic: str,
        providers: List[str],
        config: Optional[DiscussionConfig] = None,
    ) -> DiscussionSession:
        """
        Start a new discussion session.

        Args:
            topic: The discussion topic
            providers: List of provider names to participate
            config: Optional discussion configuration

        Returns:
            Created DiscussionSession
        """
        # Filter to available providers
        available_providers = [p for p in providers if p in self.backends]

        if len(available_providers) < (config or DiscussionConfig()).min_providers:
            raise ValueError(
                f"Not enough available providers. Need at least "
                f"{(config or DiscussionConfig()).min_providers}, "
                f"got {len(available_providers)}"
            )

        # Create session
        session = DiscussionSession.create(
            topic=topic,
            providers=available_providers,
            config=config,
        )

        # Persist
        self.store.create_discussion_session(session)

        # Broadcast event
        await self._broadcast(WebSocketEvent(
            type="discussion_started",
            data={
                "session_id": session.id,
                "topic": topic,
                "providers": available_providers,
            },
        ))

        return session

    async def run_full_discussion(self, session_id: str) -> DiscussionSession:
        """
        Run a complete discussion through all rounds.

        Args:
            session_id: The session ID to run

        Returns:
            Updated DiscussionSession with summary
        """
        session = self.store.get_discussion_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        try:
            # Round 1: Proposals
            await self._execute_round(session, 1, MessageType.PROPOSAL)

            # Round 2: Reviews
            await self._execute_round(session, 2, MessageType.REVIEW)

            # Round 3: Revisions
            await self._execute_round(session, 3, MessageType.REVISION)

            # Generate summary
            await self._generate_summary(session)

            # Mark completed
            self.store.update_discussion_session(
                session_id,
                status=DiscussionStatus.COMPLETED,
            )

            await self._broadcast(WebSocketEvent(
                type="discussion_completed",
                data={
                    "session_id": session_id,
                    "status": "completed",
                },
            ))

        except Exception as e:
            self.store.update_discussion_session(
                session_id,
                status=DiscussionStatus.FAILED,
                metadata={"error": str(e)},
            )

            await self._broadcast(WebSocketEvent(
                type="discussion_failed",
                data={
                    "session_id": session_id,
                    "error": str(e),
                },
            ))

            raise

        return self.store.get_discussion_session(session_id)

    async def _execute_round(
        self,
        session: DiscussionSession,
        round_number: int,
        message_type: MessageType,
    ) -> List[DiscussionMessage]:
        """Execute a single round of discussion."""
        # Update session status
        status_map = {
            1: DiscussionStatus.ROUND_1,
            2: DiscussionStatus.ROUND_2,
            3: DiscussionStatus.ROUND_3,
        }
        self.store.update_discussion_session(
            session.id,
            status=status_map.get(round_number, DiscussionStatus.ROUND_1),
            current_round=round_number,
        )

        await self._broadcast(WebSocketEvent(
            type="discussion_round_started",
            data={
                "session_id": session.id,
                "round": round_number,
                "message_type": message_type.value,
            },
        ))

        # Get previous messages for context
        all_messages = self.store.get_discussion_messages(session.id)
        round_1_messages = [m for m in all_messages if m.round_number == 1]
        round_2_messages = [m for m in all_messages if m.round_number == 2]

        # Create tasks for all providers
        tasks = []
        for provider in session.providers:
            # Build prompt based on round
            if round_number == 1:
                prompt = self.prompt_builder.build_proposal_prompt(
                    session.topic, provider
                )
            elif round_number == 2:
                # Get proposals from other providers
                other_proposals = [m for m in round_1_messages if m.provider != provider]
                prompt = self.prompt_builder.build_review_prompt(
                    session.topic, provider, other_proposals
                )
            else:  # round 3
                # Get original proposal and feedback
                original = next(
                    (m for m in round_1_messages if m.provider == provider),
                    None
                )
                if not original:
                    continue
                feedback = [m for m in round_2_messages if m.provider != provider]
                prompt = self.prompt_builder.build_revision_prompt(
                    session.topic, provider, original, feedback
                )

            # Create message placeholder
            message = DiscussionMessage.create(
                session_id=session.id,
                round_number=round_number,
                provider=provider,
                message_type=message_type,
            )
            self.store.create_discussion_message(message)

            # Create execution task
            tasks.append(self._execute_provider(
                session, message, prompt, provider
            ))

        # Execute all providers in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect successful messages
        messages = []
        for result in results:
            if isinstance(result, DiscussionMessage):
                messages.append(result)

        await self._broadcast(WebSocketEvent(
            type="discussion_round_completed",
            data={
                "session_id": session.id,
                "round": round_number,
                "successful_providers": [m.provider for m in messages],
            },
        ))

        return messages

    async def _execute_provider(
        self,
        session: DiscussionSession,
        message: DiscussionMessage,
        prompt: str,
        provider: str,
    ) -> DiscussionMessage:
        """Execute a single provider request."""
        backend = self.backends.get(provider)
        if not backend:
            self.store.update_discussion_message(
                message.id,
                status="failed",
                metadata={"error": f"Backend not found: {provider}"},
            )
            raise ValueError(f"Backend not found: {provider}")

        start_time = time.time()

        # Broadcast provider started event
        await self._broadcast(WebSocketEvent(
            type="discussion_provider_started",
            data={
                "session_id": session.id,
                "message_id": message.id,
                "provider": provider,
                "round": message.round_number,
                "message_type": message.message_type.value,
            },
        ))

        try:
            # Create gateway request
            request = GatewayRequest.create(
                provider=provider,
                message=prompt,
                timeout_s=session.config.provider_timeout_s,
            )

            # Execute with timeout
            result = await asyncio.wait_for(
                backend.execute(request),
                timeout=session.config.provider_timeout_s,
            )

            latency_ms = (time.time() - start_time) * 1000

            if result.success:
                self.store.update_discussion_message(
                    message.id,
                    content=result.response,
                    status="completed",
                    latency_ms=latency_ms,
                )
                message.content = result.response
                message.status = "completed"
                message.latency_ms = latency_ms

                # Broadcast provider completed event with content preview
                content_preview = (result.response or "")[:200]
                if len(result.response or "") > 200:
                    content_preview += "..."

                await self._broadcast(WebSocketEvent(
                    type="discussion_provider_completed",
                    data={
                        "session_id": session.id,
                        "message_id": message.id,
                        "provider": provider,
                        "round": message.round_number,
                        "message_type": message.message_type.value,
                        "latency_ms": latency_ms,
                        "content_preview": content_preview,
                        "content_length": len(result.response or ""),
                        "success": True,
                    },
                ))
            else:
                self.store.update_discussion_message(
                    message.id,
                    status="failed",
                    latency_ms=latency_ms,
                    metadata={"error": result.error},
                )

                # Broadcast provider failed event
                await self._broadcast(WebSocketEvent(
                    type="discussion_provider_completed",
                    data={
                        "session_id": session.id,
                        "message_id": message.id,
                        "provider": provider,
                        "round": message.round_number,
                        "latency_ms": latency_ms,
                        "success": False,
                        "error": result.error,
                    },
                ))

                raise ValueError(f"Provider {provider} failed: {result.error}")

        except asyncio.TimeoutError:
            latency_ms = (time.time() - start_time) * 1000
            self.store.update_discussion_message(
                message.id,
                status="timeout",
                latency_ms=latency_ms,
            )

            # Broadcast timeout event
            await self._broadcast(WebSocketEvent(
                type="discussion_provider_completed",
                data={
                    "session_id": session.id,
                    "message_id": message.id,
                    "provider": provider,
                    "round": message.round_number,
                    "latency_ms": latency_ms,
                    "success": False,
                    "error": "timeout",
                },
            ))

            raise ValueError(f"Provider {provider} timed out")

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            self.store.update_discussion_message(
                message.id,
                status="failed",
                latency_ms=latency_ms,
                metadata={"error": str(e)},
            )

            # Broadcast error event
            await self._broadcast(WebSocketEvent(
                type="discussion_provider_completed",
                data={
                    "session_id": session.id,
                    "message_id": message.id,
                    "provider": provider,
                    "round": message.round_number,
                    "latency_ms": latency_ms,
                    "success": False,
                    "error": str(e),
                },
            ))

            raise

        return message

    async def _generate_summary(self, session: DiscussionSession) -> str:
        """Generate final summary of the discussion."""
        self.store.update_discussion_session(
            session.id,
            status=DiscussionStatus.SUMMARIZING,
        )

        await self._broadcast(WebSocketEvent(
            type="discussion_summarizing",
            data={"session_id": session.id},
        ))

        # Get all messages
        all_messages = self.store.get_discussion_messages(session.id)

        # Build summary prompt
        prompt = self.prompt_builder.build_summary_prompt(session, all_messages)

        # Use first available provider or configured summary provider
        summary_provider = session.config.summary_provider
        if not summary_provider or summary_provider not in self.backends:
            summary_provider = session.providers[0]

        backend = self.backends.get(summary_provider)
        if not backend:
            raise ValueError(f"No backend available for summary")

        # Execute summary request
        request = GatewayRequest.create(
            provider=summary_provider,
            message=prompt,
            timeout_s=session.config.provider_timeout_s * 2,  # Extra time for summary
        )

        result = await asyncio.wait_for(
            backend.execute(request),
            timeout=session.config.provider_timeout_s * 2,
        )

        if not result.success:
            raise ValueError(f"Summary generation failed: {result.error}")

        # Save summary
        self.store.update_discussion_session(
            session.id,
            summary=result.response,
        )

        # Create summary message
        summary_message = DiscussionMessage.create(
            session_id=session.id,
            round_number=0,  # Special round for summary
            provider=summary_provider,
            message_type=MessageType.SUMMARY,
        )
        summary_message.content = result.response
        summary_message.status = "completed"
        self.store.create_discussion_message(summary_message)

        await self._broadcast(WebSocketEvent(
            type="discussion_summary_completed",
            data={
                "session_id": session.id,
                "summary_provider": summary_provider,
            },
        ))

        return result.response

    async def cancel_discussion(self, session_id: str) -> bool:
        """Cancel an ongoing discussion."""
        session = self.store.get_discussion_session(session_id)
        if not session:
            return False

        if session.status in (DiscussionStatus.COMPLETED, DiscussionStatus.CANCELLED):
            return False

        self.store.update_discussion_session(
            session_id,
            status=DiscussionStatus.CANCELLED,
        )

        await self._broadcast(WebSocketEvent(
            type="discussion_cancelled",
            data={"session_id": session_id},
        ))

        return True

    async def continue_discussion(
        self,
        session_id: str,
        follow_up_topic: str,
        additional_context: Optional[str] = None,
        max_rounds: int = 2,
    ) -> DiscussionSession:
        """
        Continue a completed discussion with a follow-up topic.

        Args:
            session_id: The parent session ID to continue from
            follow_up_topic: The new topic for the continuation
            additional_context: Additional context to include
            max_rounds: Number of rounds for the continuation

        Returns:
            New DiscussionSession linked to the parent
        """
        # Get parent session
        parent_session = self.store.get_discussion_session(session_id)
        if not parent_session:
            raise ValueError(f"Parent session not found: {session_id}")

        if parent_session.status != DiscussionStatus.COMPLETED:
            raise ValueError(f"Can only continue completed discussions, current status: {parent_session.status.value}")

        # Get parent messages for context
        parent_messages = self.store.get_discussion_messages(session_id)

        # Build context from parent discussion
        parent_summary = parent_session.summary or ""
        parent_topic = parent_session.topic

        # Create continuation topic with context
        full_topic = f"""Continue discussion from previous session.

**Previous Topic:** {parent_topic}

**Previous Summary:**
{parent_summary}

**Follow-up Discussion:** {follow_up_topic}
"""
        if additional_context:
            full_topic += f"\n**Additional Context:**\n{additional_context}"

        # Create new session with same providers
        config = DiscussionConfig(
            max_rounds=min(max_rounds, 3),
            round_timeout_s=parent_session.config.round_timeout_s,
            provider_timeout_s=parent_session.config.provider_timeout_s,
        )

        new_session = DiscussionSession.create(
            topic=full_topic,
            providers=parent_session.providers,
            config=config,
        )

        # Store with parent reference
        self.store.create_discussion_session(new_session)

        # Update with parent_session_id (need to add this to state_store)
        self.store.update_discussion_session(
            new_session.id,
            metadata={
                "parent_session_id": session_id,
                "follow_up_topic": follow_up_topic,
                "is_continuation": True,
            },
        )

        # Broadcast event
        await self._broadcast(WebSocketEvent(
            type="discussion_continued",
            data={
                "session_id": new_session.id,
                "parent_session_id": session_id,
                "topic": follow_up_topic,
                "providers": new_session.providers,
            },
        ))

        return new_session

    async def continue_discussion(
        self,
        parent_session_id: str,
        follow_up_topic: str,
        additional_context: Optional[str] = None,
        max_rounds: int = 2,
        providers: Optional[List[str]] = None,
    ) -> DiscussionSession:
        """
        Continue from a completed discussion with a follow-up topic.

        Args:
            parent_session_id: The completed discussion to continue from
            follow_up_topic: The new topic/question to explore
            additional_context: Optional additional context
            max_rounds: Number of rounds for the continuation (default 2)
            providers: Optional list of providers (defaults to parent's providers)

        Returns:
            New DiscussionSession linked to the parent
        """
        # Get parent session
        parent = self.store.get_discussion_session(parent_session_id)
        if not parent:
            raise ValueError(f"Parent discussion not found: {parent_session_id}")

        if parent.status != DiscussionStatus.COMPLETED:
            raise ValueError(f"Can only continue from completed discussions. Current status: {parent.status.value}")

        # Get parent messages for context
        parent_messages = self.store.get_discussion_messages(parent_session_id)

        # Build context from parent discussion
        context_parts = [
            f"This is a continuation of a previous discussion.",
            f"\n## Previous Discussion Topic\n{parent.topic}",
        ]

        if parent.summary:
            context_parts.append(f"\n## Previous Discussion Summary\n{parent.summary}")

        # Include key messages from parent
        round_3_messages = [m for m in parent_messages if m.round_number == 3 and m.content]
        if round_3_messages:
            context_parts.append("\n## Final Proposals from Previous Discussion")
            for msg in round_3_messages[:3]:  # Limit to avoid too much context
                context_parts.append(f"\n### {msg.provider}:\n{msg.content[:500]}...")

        if additional_context:
            context_parts.append(f"\n## Additional Context\n{additional_context}")

        # Build new topic with context
        full_topic = f"""## Follow-up Discussion

**New Topic**: {follow_up_topic}

{''.join(context_parts)}

---

Please provide your analysis and recommendations for this follow-up topic, building upon the previous discussion."""

        # Use parent's providers if not specified
        use_providers = providers or parent.providers

        # Create config for continuation (shorter by default)
        config = DiscussionConfig(
            max_rounds=min(max_rounds, 3),
            round_timeout_s=parent.config.round_timeout_s,
            provider_timeout_s=parent.config.provider_timeout_s,
        )

        # Create new session
        session = DiscussionSession.create(
            topic=follow_up_topic,  # Store the short topic
            providers=use_providers,
            config=config,
        )

        # Store with parent reference in metadata
        session.metadata = {
            "parent_session_id": parent_session_id,
            "parent_topic": parent.topic,
            "full_context_topic": full_topic,
        }

        # Persist
        self.store.create_discussion_session(session)

        # Update session to include parent reference
        with self.store._get_connection() as conn:
            conn.execute(
                "UPDATE discussion_sessions SET parent_session_id = ? WHERE id = ?",
                (parent_session_id, session.id)
            )

        # Broadcast event
        await self._broadcast(WebSocketEvent(
            type="discussion_continued",
            data={
                "session_id": session.id,
                "parent_session_id": parent_session_id,
                "topic": follow_up_topic,
                "providers": use_providers,
            },
        ))

        return session

    async def run_continued_discussion(self, session_id: str) -> DiscussionSession:
        """
        Run a continued discussion using the full context topic.

        Similar to run_full_discussion but uses the full_context_topic from metadata.
        """
        session = self.store.get_discussion_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        # Get the full context topic if available
        if session.metadata and "full_context_topic" in session.metadata:
            # Temporarily update the topic for prompts
            original_topic = session.topic
            session.topic = session.metadata["full_context_topic"]

        try:
            # Run the discussion with context
            result = await self.run_full_discussion(session_id)

            # Restore original topic for display
            if session.metadata and "full_context_topic" in session.metadata:
                self.store.update_discussion_session(
                    session_id,
                    metadata={**session.metadata, "display_topic": original_topic},
                )

            return result
        except Exception:
            raise

    async def _broadcast(self, event: WebSocketEvent) -> None:
        """Broadcast WebSocket event if handler is available."""
        if self.ws_broadcast:
            try:
                await self.ws_broadcast(event)
            except Exception:
                pass  # Don't let broadcast errors affect discussion

    def get_provider_groups(self) -> Dict[str, List[str]]:
        """Get available provider groups for discussions."""
        # Default groups
        groups = {
            "all": list(self.backends.keys()),
            "fast": [],
            "coding": [],
        }

        # Categorize providers
        fast_providers = {"kimi", "qwen", "deepseek"}
        coding_providers = {"codex", "gemini", "qwen", "deepseek", "kimi"}

        for provider in self.backends.keys():
            if provider.lower() in fast_providers:
                groups["fast"].append(provider)
            if provider.lower() in coding_providers:
                groups["coding"].append(provider)

        return groups

    def resolve_provider_group(self, spec: str) -> List[str]:
        """Resolve a provider specification to a list of providers."""
        if spec.startswith("@"):
            group_name = spec[1:]
            groups = self.get_provider_groups()
            return groups.get(group_name, [])
        return [spec] if spec in self.backends else []
