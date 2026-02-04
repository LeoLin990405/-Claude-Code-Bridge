# CCB Integrated Memory System Architecture

## Overview
Unified memory layer for CCB that enables all agents to:
1. Access available skills and MCP servers
2. Query conversation history across providers
3. Retrieve relevant context before executing tasks
4. Learn from past interactions

## Components

### 1. Registry System (`registry.py`)
**Purpose**: Maintain a real-time inventory of available capabilities

**Data Structure**:
```json
{
  "skills": [
    {
      "name": "ccb",
      "description": "CCB multi-AI collaboration",
      "triggers": ["ccb", "@provider"],
      "location": "~/.claude/skills/ccb"
    }
  ],
  "mcp_servers": [
    {
      "name": "chroma-mcp",
      "description": "Vector database operations",
      "status": "running",
      "pid": 12345
    }
  ],
  "providers": [
    {
      "name": "claude",
      "models": ["sonnet-4.5"],
      "strengths": ["code", "reasoning"]
    }
  ]
}
```

**API**:
- `GET /api/registry/skills` - List all skills
- `GET /api/registry/mcp` - List MCP servers
- `GET /api/registry/providers` - List providers
- `POST /api/registry/scan` - Trigger rescan

### 2. Memory Backend (`memory_backend.py`)
**Purpose**: Store and retrieve conversation history and context

**Technology**: Mem0 (universal memory layer)

**Storage**:
- User-level: Leo's preferences and patterns
- Session-level: Current task context
- Provider-level: Each AI's specialty knowledge

**Schema**:
```python
{
    "memory_id": "uuid",
    "user_id": "leo",
    "provider": "kimi",
    "content": "Kimi建议用thinking模式做详细推理",
    "metadata": {
        "task_type": "reasoning",
        "timestamp": "2026-02-04T11:00:00",
        "tokens": 150
    }
}
```

### 3. Context Injection (`context_injector.py`)
**Purpose**: Automatically enrich prompts with relevant memory

**Flow**:
```
User Query → Memory Search → Registry Lookup → Context Assembly → Enhanced Prompt
```

**Example**:
```
Original: "帮我做前端开发"

Enhanced:
系统能力:
- skills: frontend-design, canvas-design, web-artifacts-builder
- MCP: playwright (可测试UI)
- 擅长前端的 AI: Gemini (3f 模型)

相关记忆:
- 你上次用 Gemini 3f 做了 React 组件 (2026-02-03)
- 你偏好使用 Tailwind CSS

Query: "帮我做前端开发"
```

### 4. Memory API (`memory_api.py`)
**Purpose**: Unified interface for memory operations

**Endpoints**:
- `POST /api/memory/record` - Store interaction
- `GET /api/memory/search?q=query` - Search memories
- `GET /api/memory/context?task_type=frontend` - Get task-relevant context
- `POST /api/memory/forget` - Privacy control

### 5. CCB Gateway Integration (`gateway_memory.py`)
**Purpose**: Hook into existing Gateway to auto-record conversations

**Integration Points**:
1. **Before Request**: Inject context
2. **After Response**: Record to memory
3. **Error Handling**: Learn from failures

## Data Flow

### Recording Flow
```
ccb-cli kimi "问题"
  ↓
Gateway receives request
  ↓
Memory API: /api/memory/context (get relevant context)
  ↓
Enhanced prompt = context + original query
  ↓
Kimi processes request
  ↓
Response received
  ↓
Memory API: /api/memory/record (store Q&A)
```

### Query Flow
```
User: "哪个 AI 适合做算法题?"
  ↓
Memory Search: "algorithm math reasoning"
  ↓
Results:
  - Codex o3 擅长算法推理 (confidence: 0.95)
  - DeepSeek reasoner 适合数学 (confidence: 0.88)
  ↓
Registry: Check if codex is available
  ↓
Recommendation: "建议使用 ccb-cli codex o3"
```

## Implementation Phases

### Phase 1: Registry System (2 hours)
- [ ] Scan ~/.claude/skills
- [ ] Scan MCP processes
- [ ] Generate JSON registry
- [ ] Create REST API

### Phase 2: Mem0 Integration (3 hours)
- [ ] Install Mem0
- [ ] Create CCB memory service
- [ ] Test basic record/search

### Phase 3: Context Injection (2 hours)
- [ ] Create context builder
- [ ] Hook into Gateway
- [ ] Test with ccb-cli

### Phase 4: Auto-recording (1 hour)
- [ ] Hook Gateway responses
- [ ] Auto-extract key insights
- [ ] Store to Mem0

## Configuration

### `~/.ccb/memory_config.json`
```json
{
  "enabled": true,
  "backend": "mem0",
  "auto_record": true,
  "context_injection": true,
  "max_context_tokens": 2000,
  "registry_scan_interval": 300,
  "privacy": {
    "auto_tag_sensitive": true,
    "exclude_patterns": ["password", "api_key", "secret"]
  }
}
```

## Security & Privacy

1. **Local First**: All data stored locally by default
2. **Privacy Tags**: Support `<private>` tags
3. **Selective Recording**: Can disable per-provider
4. **Encryption**: Optional SQLite encryption

## Monitoring

### Dashboard (http://localhost:8765/memory)
- Total memories stored
- Registry status
- Recent queries
- Top skills used
- Provider performance

## Future Enhancements

1. **Cross-session Learning**: Identify patterns across sessions
2. **Skill Recommendations**: Auto-suggest relevant skills
3. **Provider Routing**: Auto-select best AI based on history
4. **Export**: Obsidian, Markdown, JSON exports
