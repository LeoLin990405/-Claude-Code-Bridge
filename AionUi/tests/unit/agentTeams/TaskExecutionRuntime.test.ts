import { describe, expect, it, jest } from '@jest/globals';
import { TaskExecutionRuntime } from '@/process/services/agentTeams/TaskExecutionRuntime';
import type { IAgentTask } from '@/process/services/agentTeams/types';

const baseTask = (): IAgentTask => ({
  id: 'task_1',
  team_id: 'team_1',
  subject: 'Implement API handler',
  description: 'Build backend endpoint and validate payload',
  status: 'in_progress',
  priority: 8,
  assigned_to: 'mate_1',
  provider: null,
  model: null,
  created_at: Date.now(),
  updated_at: Date.now(),
  started_at: Date.now(),
  completed_at: null,
  input_tokens: 0,
  output_tokens: 0,
  cost_usd: 0,
  blocks: [],
  blocked_by: [],
  result: null,
  error: null,
  metadata: JSON.stringify({ max_retries: 2, retry_backoff_ms: 200 }),
});

describe('TaskExecutionRuntime', () => {
  it('retries with failover provider and completes task', async () => {
    const taskState: { task: IAgentTask } = { task: baseTask() };

    const db = {
      getTask: jest.fn((taskId: string) => (taskId === taskState.task.id ? { ...taskState.task } : null)),
      updateTask: jest.fn((taskId: string, updates: Partial<IAgentTask>) => {
        if (taskId !== taskState.task.id) {
          return null;
        }
        taskState.task = {
          ...taskState.task,
          ...updates,
          updated_at: Date.now(),
        };
        return { ...taskState.task };
      }),
      getTeam: jest.fn(() => ({ id: 'team_1', task_allocation_strategy: 'round_robin' })),
      listTasks: jest.fn(() => []),
    } as any;

    const taskManager = {
      startTask: jest.fn(),
      getNextTask: jest.fn(),
      assignTask: jest.fn(),
    } as any;

    const teamCoordinator = {
      scheduleAllReadyTasks: jest.fn(() => 0),
      handleTaskCompletion: jest.fn(() => ({ ...taskState.task, status: 'completed' })),
      handleTaskFailure: jest.fn(),
    } as any;

    let sessionCounter = 0;
    const sessionManager = {
      createSession: jest.fn(() => ({ id: `session_${sessionCounter += 1}` })),
      completeSession: jest.fn(),
      failSession: jest.fn(),
    } as any;

    const router = {
      selectProvider: jest.fn(() => ({ provider: 'claude', model: 'sonnet', cost: 0.09 })),
      failover: jest.fn(() => ({ provider: 'gemini', model: '3f' })),
    } as any;

    const broker = {
      sendMessage: jest.fn(),
    } as any;

    const factory = {
      create: jest.fn((provider: string) => {
        if (provider === 'claude') {
          return {
            healthCheck: jest.fn(async () => true),
            run: jest.fn(async () => ({
              success: false,
              provider: 'claude',
              model: 'sonnet',
              input_tokens: 0,
              output_tokens: 0,
              cost_usd: 0,
              error: 'claude temporary error',
            })),
          };
        }

        return {
          healthCheck: jest.fn(async () => true),
          run: jest.fn(async () => ({
            success: true,
            provider: 'gemini',
            model: '3f',
            output: 'done',
            input_tokens: 120,
            output_tokens: 60,
            cost_usd: 0.01,
          })),
        };
      }),
    } as any;

    const runtime = new TaskExecutionRuntime(db, taskManager, teamCoordinator, sessionManager, router, broker, factory);

    const result = await runtime.executeTask(taskState.task.id);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.provider).toBe('gemini');
    expect(router.failover).toHaveBeenCalledTimes(1);
    expect(sessionManager.failSession).toHaveBeenCalledTimes(1);
    expect(sessionManager.completeSession).toHaveBeenCalledTimes(1);
    expect(teamCoordinator.handleTaskCompletion).toHaveBeenCalledTimes(1);
  });

  it('captures provider runtime exception and marks task failed', async () => {
    const taskState: { task: IAgentTask } = {
      task: {
        ...baseTask(),
        metadata: JSON.stringify({ max_retries: 1, retry_backoff_ms: 200 }),
      },
    };

    const db = {
      getTask: jest.fn((taskId: string) => (taskId === taskState.task.id ? { ...taskState.task } : null)),
      updateTask: jest.fn((taskId: string, updates: Partial<IAgentTask>) => {
        if (taskId !== taskState.task.id) {
          return null;
        }
        taskState.task = {
          ...taskState.task,
          ...updates,
          updated_at: Date.now(),
        };
        return { ...taskState.task };
      }),
      getTeam: jest.fn(() => ({ id: 'team_1', task_allocation_strategy: 'round_robin' })),
      listTasks: jest.fn(() => []),
    } as any;

    const taskManager = {
      startTask: jest.fn(),
      getNextTask: jest.fn(),
      assignTask: jest.fn(),
    } as any;

    const teamCoordinator = {
      scheduleAllReadyTasks: jest.fn(() => 0),
      handleTaskCompletion: jest.fn(),
      handleTaskFailure: jest.fn(() => ({ ...taskState.task, status: 'failed' })),
    } as any;

    const sessionManager = {
      createSession: jest.fn(() => ({ id: 'session_throw_1' })),
      completeSession: jest.fn(),
      failSession: jest.fn(),
    } as any;

    const router = {
      selectProvider: jest.fn(() => ({ provider: 'qwen', model: 'coder', cost: 0.008 })),
      failover: jest.fn(() => ({ provider: 'claude', model: 'sonnet' })),
    } as any;

    const broker = {
      sendMessage: jest.fn(),
    } as any;

    const factory = {
      create: jest.fn(() => ({
        healthCheck: jest.fn(async () => true),
        run: jest.fn(async () => {
          throw new Error('provider runtime crash');
        }),
      })),
    } as any;

    const runtime = new TaskExecutionRuntime(db, taskManager, teamCoordinator, sessionManager, router, broker, factory);

    const result = await runtime.executeTask(taskState.task.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('provider runtime crash');
    expect(result.attempts).toBe(1);
    expect(sessionManager.failSession).toHaveBeenCalledTimes(1);
    expect(teamCoordinator.handleTaskFailure).toHaveBeenCalledTimes(1);
    expect(teamCoordinator.handleTaskCompletion).not.toHaveBeenCalled();
  });
});
