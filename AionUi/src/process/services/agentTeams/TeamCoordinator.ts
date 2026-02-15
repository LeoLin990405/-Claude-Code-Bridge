/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentTeamsDatabase } from '@process/database/agentTeams';
import type { IAgentTask, IAgentTeam, ITeammate, AllocationStrategy } from './types';
import type { TaskManager } from './TaskManager';
import type { MessageBroker } from './MessageBroker';

export class TeamCoordinator {
  constructor(
    private readonly db: AgentTeamsDatabase,
    private readonly taskManager: TaskManager,
    private readonly messageBroker: MessageBroker
  ) {}

  createTeam(params: { name: string; description?: string; max_teammates?: number; task_allocation_strategy?: AllocationStrategy; metadata?: unknown }): IAgentTeam {
    return this.db.createTeam(params);
  }

  addTeammate(params: { team_id: string; name: string; role: string; provider: string; model: string; skills?: string[]; metadata?: unknown }): ITeammate {
    const teammate = this.db.addTeammate(params);
    this.messageBroker.broadcastMessage(params.team_id, `Teammate joined: ${teammate.name}`, {
      type: 'teammate_joined',
      teammate_id: teammate.id,
    });
    return teammate;
  }

  startTeam(teamId: string): IAgentTeam | null {
    const team = this.db.getTeam(teamId);
    if (!team) {
      return null;
    }

    const updated = this.db.updateTeam(teamId, {
      status: 'active',
      started_at: team.started_at ?? Date.now(),
    });

    this.messageBroker.broadcastMessage(teamId, `Team started: ${team.name}`, { type: 'team_started' });
    this.scheduleAllReadyTasks(teamId);
    return updated;
  }

  pauseTeam(teamId: string): IAgentTeam | null {
    const team = this.db.getTeam(teamId);
    if (!team) {
      return null;
    }

    const updated = this.db.updateTeam(teamId, {
      status: 'paused',
    });

    this.messageBroker.broadcastMessage(teamId, `Team paused: ${team.name}`, { type: 'team_paused' });
    return updated;
  }

  completeTeam(teamId: string): IAgentTeam | null {
    const team = this.db.getTeam(teamId);
    if (!team) {
      return null;
    }

    const updated = this.db.updateTeam(teamId, {
      status: 'completed',
      completed_at: Date.now(),
    });

    this.messageBroker.broadcastMessage(teamId, `Team completed: ${team.name}`, { type: 'team_completed' });
    return updated;
  }

  scheduleNextTask(teamId: string): { task: IAgentTask; teammate: ITeammate } | null {
    const team = this.db.getTeam(teamId);
    if (!team || team.status !== 'active') {
      return null;
    }

    const next = this.taskManager.getNextTask(teamId, team.task_allocation_strategy);
    if (!next) {
      return null;
    }

    const assigned = this.taskManager.assignTask(next.task.id, next.teammate.id);
    if (!assigned) {
      return null;
    }

    this.messageBroker.sendMessage({
      team_id: teamId,
      type: 'task_assigned',
      from_teammate_id: null,
      to_teammate_id: next.teammate.id,
      subject: assigned.subject,
      content: `Task assigned to ${next.teammate.name}`,
      task_id: assigned.id,
      metadata: {
        task_id: assigned.id,
        teammate_id: next.teammate.id,
      },
    });

    return {
      task: assigned,
      teammate: next.teammate,
    };
  }

  scheduleAllReadyTasks(teamId: string): number {
    let assignedCount = 0;
    while (true) {
      const assigned = this.scheduleNextTask(teamId);
      if (!assigned) {
        break;
      }
      assignedCount += 1;
    }

    return assignedCount;
  }

  handleTaskCompletion(taskId: string, result?: unknown): IAgentTask | null {
    const task = this.taskManager.completeTask(taskId, result ?? {});
    if (!task) {
      return null;
    }

    this.messageBroker.sendMessage({
      team_id: task.team_id,
      type: 'task_completed',
      from_teammate_id: task.assigned_to ?? undefined,
      content: `Task completed: ${task.subject}`,
      task_id: task.id,
      metadata: {
        task_id: task.id,
      },
    });

    this.scheduleAllReadyTasks(task.team_id);
    return task;
  }

  handleTaskFailure(taskId: string, error: string): IAgentTask | null {
    const task = this.taskManager.failTask(taskId, error);
    if (!task) {
      return null;
    }

    this.messageBroker.sendMessage({
      team_id: task.team_id,
      type: 'task_failed',
      from_teammate_id: task.assigned_to ?? undefined,
      content: `Task failed: ${task.subject}`,
      task_id: task.id,
      metadata: {
        task_id: task.id,
        error,
      },
    });

    this.scheduleAllReadyTasks(task.team_id);
    return task;
  }
}
