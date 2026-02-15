/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentTeamsDatabase } from '@process/database/agentTeams';
import type { AllocationStrategy, IAgentTask, ITeammate, TaskStatus } from './types';
import type { ProviderRouter } from './ProviderRouter';
import type { DependencyResolver } from './DependencyResolver';

export class TaskManager {
  private readonly roundRobinState = new Map<string, number>();

  constructor(
    private readonly db: AgentTeamsDatabase,
    private readonly providerRouter: ProviderRouter,
    private readonly dependencyResolver: DependencyResolver
  ) {}

  createTask(params: { team_id: string; subject: string; description: string; priority?: number; blocks?: string[]; blocked_by?: string[]; metadata?: unknown }): IAgentTask {
    return this.db.createTask(params);
  }

  assignTask(taskId: string, teammateId: string): IAgentTask | null {
    const task = this.db.getTask(taskId);
    const teammate = this.db.getTeammate(teammateId);
    if (!task || !teammate) {
      return null;
    }

    const selected = this.providerRouter.selectProvider(task);

    this.db.updateTeammate(teammateId, {
      status: 'busy',
      current_task_id: taskId,
      last_active_at: Date.now(),
    });

    return this.db.updateTask(taskId, {
      assigned_to: teammateId,
      provider: selected.provider,
      model: selected.model,
      status: task.status === 'pending' ? 'in_progress' : task.status,
      started_at: task.started_at ?? Date.now(),
    });
  }

  startTask(taskId: string): IAgentTask | null {
    const task = this.db.getTask(taskId);
    if (!task) {
      return null;
    }

    if (!this.dependencyResolver.isTaskReady(taskId)) {
      throw new Error('Task dependencies are not satisfied');
    }

    return this.db.updateTask(taskId, {
      status: 'in_progress',
      started_at: task.started_at ?? Date.now(),
      error: null,
    });
  }

  completeTask(taskId: string, result: unknown): IAgentTask | null {
    const task = this.db.getTask(taskId);
    if (!task) {
      return null;
    }

    const updated = this.db.updateTask(taskId, {
      status: 'completed',
      completed_at: Date.now(),
      result: JSON.stringify(result),
      error: null,
    });

    if (task.assigned_to) {
      const teammate = this.db.getTeammate(task.assigned_to);
      if (teammate) {
        this.db.updateTeammate(teammate.id, {
          status: 'idle',
          current_task_id: null,
          tasks_completed: teammate.tasks_completed + 1,
          total_cost_usd: teammate.total_cost_usd + (updated?.cost_usd ?? 0),
          last_active_at: Date.now(),
        });
      }
    }

    return updated;
  }

  failTask(taskId: string, error: string): IAgentTask | null {
    const task = this.db.getTask(taskId);
    if (!task) {
      return null;
    }

    const updated = this.db.updateTask(taskId, {
      status: 'failed',
      completed_at: Date.now(),
      error,
    });

    if (task.assigned_to) {
      const teammate = this.db.getTeammate(task.assigned_to);
      if (teammate) {
        this.db.updateTeammate(teammate.id, {
          status: 'error',
          current_task_id: null,
          tasks_failed: teammate.tasks_failed + 1,
          last_active_at: Date.now(),
        });
      }
    }

    return updated;
  }

  cancelTask(taskId: string): IAgentTask | null {
    const task = this.db.getTask(taskId);
    if (!task) {
      return null;
    }

    if (task.assigned_to) {
      this.db.updateTeammate(task.assigned_to, {
        status: 'idle',
        current_task_id: null,
      });
    }

    return this.db.updateTask(taskId, {
      status: 'cancelled',
      completed_at: Date.now(),
    });
  }

  getNextTask(teamId: string, strategy: AllocationStrategy): { task: IAgentTask; teammate: ITeammate } | null {
    const readyTasks = this.dependencyResolver.getReadyTasks(teamId);
    if (readyTasks.length === 0) {
      return null;
    }

    let selectedTask: IAgentTask | null = null;
    let selectedTeammate: ITeammate | null = null;

    switch (strategy) {
      case 'round_robin':
        ({ task: selectedTask, teammate: selectedTeammate } = this.roundRobinAllocation(teamId, readyTasks));
        break;
      case 'load_balance':
        ({ task: selectedTask, teammate: selectedTeammate } = this.loadBalanceAllocation(teamId, readyTasks));
        break;
      case 'skill_based':
        ({ task: selectedTask, teammate: selectedTeammate } = this.skillBasedAllocation(teamId, readyTasks));
        break;
      default:
        ({ task: selectedTask, teammate: selectedTeammate } = this.roundRobinAllocation(teamId, readyTasks));
        break;
    }

    if (!selectedTask || !selectedTeammate) {
      return null;
    }

    return { task: selectedTask, teammate: selectedTeammate };
  }

  updateTaskStatus(taskId: string, status: TaskStatus): IAgentTask | null {
    const task = this.db.getTask(taskId);
    if (!task) {
      return null;
    }

    const now = Date.now();
    return this.db.updateTask(taskId, {
      status,
      started_at: status === 'in_progress' ? (task.started_at ?? now) : task.started_at,
      completed_at: status === 'completed' || status === 'failed' || status === 'cancelled' ? now : task.completed_at,
    });
  }

  private roundRobinAllocation(teamId: string, readyTasks: IAgentTask[]): { task: IAgentTask | null; teammate: ITeammate | null } {
    const idleTeammates = this.db.listTeammates(teamId, 'idle');
    if (idleTeammates.length === 0) {
      return { task: null, teammate: null };
    }

    const task = readyTasks[0];
    const lastIndex = this.roundRobinState.get(teamId) ?? -1;
    const nextIndex = (lastIndex + 1) % idleTeammates.length;
    this.roundRobinState.set(teamId, nextIndex);

    return {
      task,
      teammate: idleTeammates[nextIndex],
    };
  }

  private loadBalanceAllocation(teamId: string, readyTasks: IAgentTask[]): { task: IAgentTask | null; teammate: ITeammate | null } {
    const teammates = this.db.listTeammates(teamId).filter((tm) => tm.status === 'idle' || tm.status === 'busy');
    if (teammates.length === 0) {
      return { task: null, teammate: null };
    }

    const sorted = [...teammates].sort((a, b) => {
      const aLoad = a.tasks_completed + a.tasks_failed;
      const bLoad = b.tasks_completed + b.tasks_failed;
      return aLoad - bLoad;
    });

    const selectedTeammate = sorted.find((tm) => tm.status === 'idle') || null;
    return {
      task: selectedTeammate ? readyTasks[0] : null,
      teammate: selectedTeammate,
    };
  }

  private skillBasedAllocation(teamId: string, readyTasks: IAgentTask[]): { task: IAgentTask | null; teammate: ITeammate | null } {
    const idleTeammates = this.db.listTeammates(teamId, 'idle');
    if (idleTeammates.length === 0) {
      return { task: null, teammate: null };
    }

    const task = readyTasks[0];
    const requiredSkills = this.extractRequiredSkills(task);

    if (requiredSkills.length === 0) {
      return {
        task,
        teammate: idleTeammates[0],
      };
    }

    let bestTeammate: ITeammate | null = null;
    let bestScore = -1;

    for (const teammate of idleTeammates) {
      const score = this.calculateSkillMatch(teammate.skills, requiredSkills);
      if (score > bestScore) {
        bestScore = score;
        bestTeammate = teammate;
      }
    }

    return {
      task: bestTeammate ? task : null,
      teammate: bestTeammate,
    };
  }

  private extractRequiredSkills(task: IAgentTask): string[] {
    try {
      const metadata = JSON.parse(task.metadata || '{}') as { skills?: unknown };
      if (Array.isArray(metadata.skills)) {
        return metadata.skills.map((item) => String(item).toLowerCase());
      }
    } catch {
      // ignore
    }

    return [];
  }

  private calculateSkillMatch(teammateSkills: string[], requiredSkills: string[]): number {
    if (requiredSkills.length === 0) {
      return 0;
    }

    const normalized = new Set(teammateSkills.map((item) => item.toLowerCase()));
    const matches = requiredSkills.filter((skill) => normalized.has(skill));
    return matches.length / requiredSkills.length;
  }
}
