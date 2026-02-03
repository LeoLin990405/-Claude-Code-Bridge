"""
Discussion Executor for CCB Gateway.

Provides multi-round AI discussion orchestration across multiple providers.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
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

                await self._broadcast(WebSocketEvent(
                    type="discussion_message_completed",
                    data={
                        "session_id": session.id,
                        "message_id": message.id,
                        "provider": provider,
                        "round": message.round_number,
                        "latency_ms": latency_ms,
                    },
                ))
            else:
                self.store.update_discussion_message(
                    message.id,
                    status="failed",
                    latency_ms=latency_ms,
                    metadata={"error": result.error},
                )
                raise ValueError(f"Provider {provider} failed: {result.error}")

        except asyncio.TimeoutError:
            latency_ms = (time.time() - start_time) * 1000
            self.store.update_discussion_message(
                message.id,
                status="timeout",
                latency_ms=latency_ms,
            )
            raise ValueError(f"Provider {provider} timed out")

        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            self.store.update_discussion_message(
                message.id,
                status="failed",
                latency_ms=latency_ms,
                metadata={"error": str(e)},
            )
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
