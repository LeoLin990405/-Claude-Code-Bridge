/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentTeamsDatabase } from '@process/database/agentTeams';
import type { ProviderRouter } from './ProviderRouter';
import type { ProviderFactory } from './providers';
import { providerFactory } from './providers';
import type { SessionManager } from './SessionManager';
import type { TaskManager } from './TaskManager';
import type { TeamCoordinator } from './TeamCoordinator';
import type { MessageBroker } from './MessageBroker';
import type { IAgentTask } from './types';

export interface ITaskExecutionResult {
  success: boolean;
  task_id: string;
  provider?: string;
  model?: string;
  attempts: number;
  error?: string;
}

export interface ITeamExecutionResult {
  team_id: string;
  scheduled: number;
  started: number;
  completed: number;
  failed: number;
}

export class TaskExecutionRuntime {
  private readonly runningTaskIds = new Set<string>();

  constructor(
    private readonly db: AgentTeamsDatabase,
    private readonly taskManager: TaskManager,
    private readonly teamCoordinator: TeamCoordinator,
    private readonly sessionManager: SessionManager,
    private readonly router: ProviderRouter,
    private readonly broker: MessageBroker,
    private readonly factory: ProviderFactory = providerFactory
  ) {}

  async executeTeam(teamId: string): Promise<ITeamExecutionResult> {
    const team = this.db.getTeam(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    const scheduled = this.teamCoordinator.scheduleAllReadyTasks(teamId);
    const tasks = this.db.listTasks({ team_id: teamId, status: 'in_progress', limit: 1000, offset: 0 });
    const executable = tasks.filter((task) => !this.runningTaskIds.has(task.id));

    const results = await Promise.all(executable.map((task) => this.executeTask(task.id)));

    return {
      team_id: teamId,
      scheduled,
      started: executable.length,
      completed: results.filter((item) => item.success).length,
      failed: results.filter((item) => !item.success).length,
    };
  }

  async executeTask(taskId: string): Promise<ITaskExecutionResult> {
    if (this.runningTaskIds.has(taskId)) {
      return {
        success: false,
        task_id: taskId,
        attempts: 0,
        error: 'Task is already executing',
      };
    }

    const task = this.db.getTask(taskId);
    if (!task) {
      return {
        success: false,
        task_id: taskId,
        attempts: 0,
        error: 'Task not found',
      };
    }

    this.runningTaskIds.add(taskId);

    try {
      if (task.status === 'pending') {
        this.taskManager.startTask(task.id);
      }

      const assignedTask = this.db.getTask(task.id);
      if (!assignedTask) {
        return {
          success: false,
          task_id: task.id,
          attempts: 0,
          error: 'Task disappeared during execution',
        };
      }

      if (!assignedTask.assigned_to) {
        const team = this.db.getTeam(assignedTask.team_id);
        if (!team) {
          return {
            success: false,
            task_id: assignedTask.id,
            attempts: 0,
            error: 'Team not found',
          };
        }

        const scheduled = this.taskManager.getNextTask(assignedTask.team_id, team.task_allocation_strategy);
        if (!scheduled || scheduled.task.id !== assignedTask.id) {
          return {
            success: false,
            task_id: assignedTask.id,
            attempts: 0,
            error: 'Task is not assigned to any teammate',
          };
        }

        this.taskManager.assignTask(assignedTask.id, scheduled.teammate.id);
      }

      return await this.runWithRetry(task.id);
    } finally {
      this.runningTaskIds.delete(taskId);
    }
  }

  private async runWithRetry(taskId: string): Promise<ITaskExecutionResult> {
    const task = this.db.getTask(taskId);
    if (!task) {
      return {
        success: false,
        task_id: taskId,
        attempts: 0,
        error: 'Task not found',
      };
    }

    const retryConfig = this.getRetryConfig(task);
    const selectedProvider = this.router.selectProvider(task);
    let currentProvider = task.provider || selectedProvider.provider;
    let currentModel = task.model || selectedProvider.model;
    let lastError = 'Unknown execution error';

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt += 1) {
      const snapshot = this.db.getTask(taskId);
      if (!snapshot || !snapshot.assigned_to) {
        return {
          success: false,
          task_id: taskId,
          attempts: attempt,
          error: 'Task is not assigned',
        };
      }

      if (snapshot.status === 'cancelled') {
        return {
          success: false,
          task_id: taskId,
          attempts: attempt,
          provider: currentProvider,
          model: currentModel,
          error: 'Task was cancelled before execution',
        };
      }

      const session = this.sessionManager.createSession(snapshot.assigned_to, taskId, currentProvider, currentModel, {
        attempt,
      });

      try {
        const provider = this.factory.create(currentProvider, currentModel);
        const healthy = await provider.healthCheck();

        if (!healthy) {
          lastError = `Provider health check failed: ${currentProvider}`;
          this.sessionManager.failSession(session.id, lastError);
          this.broker.sendMessage({
            team_id: snapshot.team_id,
            type: 'status_update',
            task_id: snapshot.id,
            content: lastError,
            metadata: {
              task_id: snapshot.id,
              provider: currentProvider,
              model: currentModel,
              attempt,
            },
          });
        } else {
          const result = await provider.run({
            prompt: this.buildPrompt(snapshot),
            metadata: {
              task_id: snapshot.id,
              team_id: snapshot.team_id,
              attempt,
            },
          });

          if (result.success) {
            this.sessionManager.completeSession(
              session.id,
              {
                output: result.output,
                raw: result.raw,
              },
              {
                input_tokens: result.input_tokens,
                output_tokens: result.output_tokens,
                cost_usd: result.cost_usd,
              }
            );

            const latest = this.db.getTask(taskId);
            this.db.updateTask(taskId, {
              provider: currentProvider,
              model: currentModel,
              input_tokens: (latest?.input_tokens || 0) + result.input_tokens,
              output_tokens: (latest?.output_tokens || 0) + result.output_tokens,
              cost_usd: (latest?.cost_usd || 0) + result.cost_usd,
              result: JSON.stringify({
                output: result.output,
                raw: result.raw,
                attempt,
                provider: currentProvider,
                model: currentModel,
              }),
              error: null,
            });

            this.teamCoordinator.handleTaskCompletion(taskId, {
              output: result.output,
              provider: currentProvider,
              model: currentModel,
            });

            return {
              success: true,
              task_id: taskId,
              provider: currentProvider,
              model: currentModel,
              attempts: attempt,
            };
          }

          lastError = result.error || 'Provider execution failed';
          this.sessionManager.failSession(session.id, lastError);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.sessionManager.failSession(session.id, lastError);
        this.broker.sendMessage({
          team_id: snapshot.team_id,
          type: 'error',
          task_id: snapshot.id,
          content: `Task execution runtime error: ${lastError}`,
          metadata: {
            task_id: snapshot.id,
            provider: currentProvider,
            model: currentModel,
            attempt,
          },
        });
      }

      if (attempt < retryConfig.maxRetries) {
        const snapshotForFailover = this.db.getTask(taskId);
        if (snapshotForFailover) {
          const failover = this.router.failover(snapshotForFailover, currentProvider);
          const previousProvider = currentProvider;
          currentProvider = failover.provider;
          currentModel = failover.model;

          this.db.updateTask(taskId, {
            provider: currentProvider,
            model: currentModel,
            error: `${lastError} (attempt ${attempt})`,
          });

          this.broker.sendMessage({
            team_id: snapshotForFailover.team_id,
            type: 'status_update',
            task_id: snapshotForFailover.id,
            content: `Retrying task with failover provider: ${previousProvider} -> ${currentProvider}`,
            metadata: {
              task_id: snapshotForFailover.id,
              attempt,
              error: lastError,
              previous_provider: previousProvider,
              next_provider: currentProvider,
            },
          });
        }

        await this.sleep(retryConfig.backoffMs * Math.pow(2, attempt - 1));
      }
    }

    this.teamCoordinator.handleTaskFailure(taskId, lastError);
    return {
      success: false,
      task_id: taskId,
      attempts: retryConfig.maxRetries,
      provider: currentProvider,
      model: currentModel,
      error: lastError,
    };
  }

  private buildPrompt(task: IAgentTask): string {
    return [`Task Subject: ${task.subject}`, '', 'Task Description:', task.description, '', 'Execution Rules:', '- Return a concise actionable result.', '- Include key decisions and assumptions.', '- Provide any follow-up recommendations.'].join('\n');
  }

  private getRetryConfig(task: IAgentTask): { maxRetries: number; backoffMs: number } {
    try {
      const parsed = JSON.parse(task.metadata || '{}') as {
        max_retries?: number;
        retry_backoff_ms?: number;
      };

      return {
        maxRetries: Math.max(1, Math.min(5, parsed.max_retries ?? 3)),
        backoffMs: Math.max(200, Math.min(5000, parsed.retry_backoff_ms ?? 600)),
      };
    } catch {
      return {
        maxRetries: 3,
        backoffMs: 600,
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
