#!/usr/bin/env python3
"""
Memory Consolidator - System 2: Nightly Memory Integration

Collects recent session archives and generates structured long-term memory.
This is the "slow, deep thinking" part of the dual-system memory architecture.
"""

import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


class SessionArchive:
    """Represents a parsed context archive (Markdown file)."""

    def __init__(self, path: Path):
        self.path = path
        self.session_id = ""
        self.project_path = ""
        self.timestamp = ""
        self.duration = ""
        self.model = ""
        self.task_summary = ""
        self.key_messages: List[Dict[str, str]] = []
        self.tool_calls: Dict[str, int] = {}
        self.file_changes: List[Dict[str, str]] = []
        self.learnings: List[str] = []

        self._parse()

    def _parse(self):
        """Parse the markdown archive file."""
        content = self.path.read_text(encoding='utf-8')
        lines = content.split('\n')

        current_section = None

        for i, line in enumerate(lines):
            line_stripped = line.strip()

            # Extract session ID from title
            if line_stripped.startswith('# Session:'):
                self.session_id = line_stripped.split(':')[-1].strip()
                continue

            # Detect sections
            if line_stripped.startswith('## '):
                current_section = line_stripped[3:].strip().lower()
                continue

            # Parse metadata
            if current_section == 'metadata':
                if '项目路径' in line:
                    match = re.search(r'`(.+?)`', line)
                    if match:
                        self.project_path = match.group(1)
                elif '时间' in line:
                    match = re.search(r'\*\*时间\*\*:\s*(.+)', line)
                    if match:
                        self.timestamp = match.group(1)
                elif '时长' in line:
                    match = re.search(r'\*\*时长\*\*:\s*(.+)', line)
                    if match:
                        self.duration = match.group(1)
                elif '模型' in line:
                    match = re.search(r'\*\*模型\*\*:\s*(.+)', line)
                    if match:
                        self.model = match.group(1)

            # Parse task summary
            elif current_section == '任务摘要':
                if line_stripped and not line_stripped.startswith('#'):
                    self.task_summary = line_stripped

            # Parse tool calls
            elif current_section == '工具调用':
                match = re.match(r'-\s+\*\*(.+?)\*\*:\s*(\d+)', line_stripped)
                if match:
                    self.tool_calls[match.group(1)] = int(match.group(2))

            # Parse file changes
            elif current_section == '文件变更':
                match = re.search(r'`(.+?)`\s*\((\w+)\)', line_stripped)
                if match:
                    self.file_changes.append({
                        'path': match.group(1),
                        'action': match.group(2)
                    })

            # Parse learnings
            elif current_section == '学到的知识':
                if line_stripped.startswith('- '):
                    self.learnings.append(line_stripped[2:])


class NightlyConsolidator:
    """System 2: Consolidates session archives into structured long-term memory."""

    def __init__(
        self,
        archive_dir: Optional[Path] = None,
        memory_dir: Optional[Path] = None
    ):
        self.archive_dir = archive_dir or Path.home() / ".ccb" / "context_archive"
        self.memory_dir = memory_dir or Path.home() / ".ccb" / "memories"
        self.memory_dir.mkdir(parents=True, exist_ok=True)

    def consolidate(self, hours: int = 24) -> Dict[str, Any]:
        """
        Consolidate recent session archives into structured memory.

        Args:
            hours: How many hours back to look for sessions

        Returns:
            Consolidated memory dictionary
        """
        # Collect recent archives
        cutoff = datetime.now() - timedelta(hours=hours)
        archives = self._collect_archives(cutoff)

        if not archives:
            return {"status": "no_sessions", "message": "No sessions found in the specified time range"}

        # Parse all archives
        sessions = [SessionArchive(path) for path in archives]

        # Build consolidated memory
        memory = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "generated_at": datetime.now().isoformat(),
            "time_range_hours": hours,
            "sessions_processed": len(sessions),
            "models_used": list(set(s.model for s in sessions if s.model)),
            "project_progress": self._summarize_projects(sessions),
            "tool_usage_total": self._aggregate_tool_usage(sessions),
            "files_touched": self._aggregate_file_changes(sessions),
            "all_learnings": self._collect_learnings(sessions),
            "causal_chains": self._find_causal_chains(sessions),
            "cross_session_insights": self._extract_insights(sessions),
        }

        # Save memory
        self._save_memory(memory)

        return memory

    def _collect_archives(self, cutoff: datetime) -> List[Path]:
        """Collect archive files modified after cutoff time."""
        if not self.archive_dir.exists():
            return []

        archives = []
        for path in self.archive_dir.glob("*.md"):
            if path.stat().st_mtime > cutoff.timestamp():
                archives.append(path)

        # Sort by modification time
        archives.sort(key=lambda p: p.stat().st_mtime)
        return archives

    def _summarize_projects(self, sessions: List[SessionArchive]) -> Dict[str, Any]:
        """Group and summarize sessions by project."""
        projects = defaultdict(lambda: {
            "sessions": [],
            "tasks": [],
            "files_modified": set(),
            "tools_used": defaultdict(int),
            "learnings": [],
            "total_duration": ""
        })

        for session in sessions:
            project_key = self._normalize_project_path(session.project_path)

            proj = projects[project_key]
            proj["sessions"].append(session.session_id)
            if session.task_summary:
                proj["tasks"].append(session.task_summary)

            for fc in session.file_changes:
                proj["files_modified"].add(fc["path"])

            for tool, count in session.tool_calls.items():
                proj["tools_used"][tool] += count

            proj["learnings"].extend(session.learnings)

        # Convert sets to lists for JSON serialization
        result = {}
        for proj_path, data in projects.items():
            result[proj_path] = {
                "sessions": data["sessions"],
                "tasks": data["tasks"],
                "files_modified": list(data["files_modified"]),
                "tools_used": dict(data["tools_used"]),
                "learnings": list(set(data["learnings"]))[:10],  # Dedupe and limit
            }

        return result

    def _aggregate_tool_usage(self, sessions: List[SessionArchive]) -> Dict[str, int]:
        """Aggregate tool usage across all sessions."""
        total = defaultdict(int)
        for session in sessions:
            for tool, count in session.tool_calls.items():
                total[tool] += count
        return dict(sorted(total.items(), key=lambda x: -x[1]))

    def _aggregate_file_changes(self, sessions: List[SessionArchive]) -> Dict[str, Dict]:
        """Aggregate file changes across sessions."""
        files = defaultdict(lambda: {"read": 0, "modified": 0, "sessions": set()})

        for session in sessions:
            for fc in session.file_changes:
                path = fc["path"]
                action = fc["action"]
                files[path]["sessions"].add(session.session_id)
                if action in ("modified", "write", "edit"):
                    files[path]["modified"] += 1
                else:
                    files[path]["read"] += 1

        # Convert to serializable format
        result = {}
        for path, data in files.items():
            result[path] = {
                "read_count": data["read"],
                "modify_count": data["modified"],
                "session_count": len(data["sessions"])
            }

        return result

    def _collect_learnings(self, sessions: List[SessionArchive]) -> List[str]:
        """Collect and deduplicate all learnings."""
        all_learnings = []
        seen = set()

        for session in sessions:
            for learning in session.learnings:
                normalized = learning.lower().strip()
                if normalized not in seen and len(learning) > 10:
                    seen.add(normalized)
                    all_learnings.append(learning)

        return all_learnings[:20]  # Limit to top 20

    def _find_causal_chains(self, sessions: List[SessionArchive]) -> List[Dict]:
        """
        Identify causal chains across sessions.

        A causal chain is a sequence of related tasks/decisions that
        span multiple sessions.
        """
        chains = []

        # Group sessions by project
        project_sessions = defaultdict(list)
        for session in sessions:
            project_key = self._normalize_project_path(session.project_path)
            project_sessions[project_key].append(session)

        # For each project, look for related task sequences
        for project, proj_sessions in project_sessions.items():
            if len(proj_sessions) < 2:
                continue

            # Simple heuristic: sessions working on related files form a chain
            file_overlap = self._find_file_overlap(proj_sessions)
            if file_overlap:
                chain = {
                    "chain_id": f"chain_{project.replace('/', '_')[:20]}",
                    "project": project,
                    "steps": [
                        {
                            "session": s.session_id,
                            "task": s.task_summary[:100] if s.task_summary else "unknown",
                            "timestamp": s.timestamp
                        }
                        for s in proj_sessions
                    ],
                    "shared_files": list(file_overlap)[:5]
                }
                chains.append(chain)

        return chains

    def _find_file_overlap(self, sessions: List[SessionArchive]) -> Set[str]:
        """Find files touched by multiple sessions."""
        file_sessions = defaultdict(set)

        for session in sessions:
            for fc in session.file_changes:
                file_sessions[fc["path"]].add(session.session_id)

        # Return files touched by more than one session
        return {f for f, s in file_sessions.items() if len(s) > 1}

    def _extract_insights(self, sessions: List[SessionArchive]) -> List[Dict]:
        """
        Extract cross-session insights and patterns.

        These are observations about user behavior, preferences,
        or recurring patterns.
        """
        insights = []

        # Analyze tool preferences
        tool_totals = self._aggregate_tool_usage(sessions)
        top_tools = list(tool_totals.keys())[:3]
        if top_tools:
            insights.append({
                "pattern": f"Most used tools: {', '.join(top_tools)}",
                "confidence": 0.9,
                "type": "tool_preference"
            })

        # Analyze project focus
        project_counts = defaultdict(int)
        for session in sessions:
            project_key = self._normalize_project_path(session.project_path)
            project_counts[project_key] += 1

        if project_counts:
            top_project = max(project_counts.items(), key=lambda x: x[1])
            insights.append({
                "pattern": f"Primary project: {top_project[0]} ({top_project[1]} sessions)",
                "confidence": 0.85,
                "type": "project_focus"
            })

        # Check for file modification patterns
        file_changes = self._aggregate_file_changes(sessions)
        hot_files = [f for f, d in file_changes.items() if d["modify_count"] > 2]
        if hot_files:
            insights.append({
                "pattern": f"Frequently modified files: {', '.join(hot_files[:3])}",
                "confidence": 0.8,
                "type": "file_hotspots"
            })

        return insights

    def _normalize_project_path(self, path: str) -> str:
        """Normalize project path for grouping."""
        if not path:
            return "unknown"

        # Expand ~ to home
        if path.startswith("~"):
            path = str(Path.home()) + path[1:]

        # Get the main project directory (2-3 levels from home)
        home = str(Path.home())
        if path.startswith(home):
            relative = path[len(home):].strip('/')
            if not relative:
                # User's home directory itself
                return "~"
            parts = relative.split('/')
            if len(parts) >= 2:
                return '~/' + '/'.join(parts[:2])
            elif parts:
                return '~/' + parts[0]

        return path

    def _save_memory(self, memory: Dict[str, Any]):
        """Save memory to JSON and optionally Markdown."""
        date_str = memory["date"]

        # Save JSON
        json_path = self.memory_dir / f"{date_str}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(memory, f, ensure_ascii=False, indent=2)

        # Save human-readable Markdown
        md_path = self.memory_dir / f"{date_str}.md"
        md_content = self._generate_markdown(memory)
        md_path.write_text(md_content, encoding='utf-8')

        print(f"✓ Saved memory: {json_path}")
        print(f"✓ Saved summary: {md_path}")

    def _generate_markdown(self, memory: Dict[str, Any]) -> str:
        """Generate human-readable Markdown from memory."""
        lines = []

        lines.append(f"# Daily Memory: {memory['date']}")
        lines.append("")

        # Overview
        lines.append("## 概览")
        lines.append(f"- **处理会话数**: {memory['sessions_processed']}")
        lines.append(f"- **时间范围**: 最近 {memory['time_range_hours']} 小时")
        lines.append(f"- **使用的模型**: {', '.join(memory['models_used'])}")
        lines.append("")

        # Project Progress
        if memory.get('project_progress'):
            lines.append("## 项目进展")
            for proj, data in memory['project_progress'].items():
                lines.append(f"\n### {proj}")
                if data.get('tasks'):
                    lines.append("**任务:**")
                    for task in data['tasks'][:5]:
                        lines.append(f"- {task}")
                if data.get('files_modified'):
                    lines.append(f"\n**修改的文件**: {len(data['files_modified'])} 个")
                if data.get('learnings'):
                    lines.append("**学到的知识:**")
                    for l in data['learnings'][:3]:
                        lines.append(f"- {l}")
            lines.append("")

        # Tool Usage
        if memory.get('tool_usage_total'):
            lines.append("## 工具使用统计")
            for tool, count in list(memory['tool_usage_total'].items())[:10]:
                lines.append(f"- **{tool}**: {count}次")
            lines.append("")

        # Insights
        if memory.get('cross_session_insights'):
            lines.append("## 跨会话洞察")
            for insight in memory['cross_session_insights']:
                confidence = int(insight['confidence'] * 100)
                lines.append(f"- {insight['pattern']} (置信度: {confidence}%)")
            lines.append("")

        # All Learnings
        if memory.get('all_learnings'):
            lines.append("## 所有学到的知识")
            for learning in memory['all_learnings']:
                lines.append(f"- {learning}")
            lines.append("")

        # Footer
        lines.append("---")
        lines.append(f"*Generated at {memory['generated_at']}*")

        return "\n".join(lines)


def main():
    """CLI entry point for consolidator."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Consolidate session archives into long-term memory"
    )
    parser.add_argument(
        "--hours",
        type=int,
        default=24,
        help="Hours to look back (default: 24)"
    )
    parser.add_argument(
        "--archive-dir",
        type=Path,
        help="Archive directory (default: ~/.ccb/context_archive)"
    )
    parser.add_argument(
        "--memory-dir",
        type=Path,
        help="Memory output directory (default: ~/.ccb/memories)"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON to stdout instead of saving"
    )

    args = parser.parse_args()

    consolidator = NightlyConsolidator(
        archive_dir=args.archive_dir,
        memory_dir=args.memory_dir
    )

    memory = consolidator.consolidate(hours=args.hours)

    if args.json:
        print(json.dumps(memory, ensure_ascii=False, indent=2))
    elif memory.get("status") == "no_sessions":
        print("No sessions found in the specified time range")
        sys.exit(0)


if __name__ == "__main__":
    main()
