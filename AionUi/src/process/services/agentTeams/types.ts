/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type TeamStatus = 'active' | 'paused' | 'completed' | 'archived';
export type AllocationStrategy = 'round_robin' | 'load_balance' | 'skill_based';
export type TeammateStatus = 'idle' | 'busy' | 'offline' | 'error';
export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish';
export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export type MessageType = 'task_assigned' | 'task_started' | 'task_completed' | 'task_failed' | 'broadcast' | 'p2p' | 'status_update' | 'error' | 'system';

export interface IAgentTask {
  id: string;
  team_id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  priority: number;
  assigned_to: string | null;
  provider: string | null;
  model: string | null;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  blocks: string[];
  blocked_by: string[];
  result: string | null;
  error: string | null;
  metadata: string | null;
}

export interface IAgentTeam {
  id: string;
  name: string;
  description: string | null;
  status: TeamStatus;
  max_teammates: number;
  task_allocation_strategy: AllocationStrategy;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_cost_usd: number;
  metadata: string | null;
}

export interface ITeammate {
  id: string;
  team_id: string;
  name: string;
  role: string;
  provider: string;
  model: string;
  status: TeammateStatus;
  current_task_id: string | null;
  skills: string[];
  tasks_completed: number;
  tasks_failed: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_task_duration_ms: number;
  created_at: number;
  updated_at: number;
  last_active_at: number | null;
  metadata: string | null;
}

export interface ITeamMessage {
  id: string;
  team_id: string;
  type: MessageType;
  from_teammate_id: string | null;
  to_teammate_id: string | null;
  subject: string | null;
  content: string;
  task_id: string | null;
  created_at: number;
  metadata: string | null;
}

export interface ITaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: DependencyType;
  created_at: number;
}

export interface IAgentSession {
  id: string;
  teammate_id: string;
  task_id: string;
  status: SessionStatus;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
  result: string | null;
  error: string | null;
  metadata: string | null;
}

export interface ITokenUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface IProviderSelection {
  provider: string;
  model: string;
  cost: number;
}

export interface ITeamStats {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  in_progress_tasks: number;
  total_cost_usd: number;
  avg_task_duration_ms: number;
  teammate_stats: Array<{
    teammate_id: string;
    name: string;
    tasks_completed: number;
    tasks_failed: number;
    total_cost_usd: number;
    avg_task_duration_ms: number;
  }>;
}

export interface ICostAnalysis {
  total_cost_usd: number;
  by_provider: Record<string, { cost_usd: number; input_tokens: number; output_tokens: number; tasks_count: number }>;
  by_model: Record<string, { cost_usd: number; input_tokens: number; output_tokens: number; tasks_count: number }>;
}

export interface IAgentTeamsEventPayload<T> {
  team_id: string;
  data: T;
}
