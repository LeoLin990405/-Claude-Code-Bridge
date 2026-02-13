import { describe, expect, it, jest } from '@jest/globals';
import { TaskManager } from '@/process/services/agentTeams/TaskManager';
import type { IAgentTask, ITeammate } from '@/process/services/agentTeams/types';

const buildTask = (overrides: Partial<IAgentTask> = {}): IAgentTask => ({
  id: 'task_1',
  team_id: 'team_1',
  subject: 'Task',
  description: 'Task description',
  status: 'pending',
  priority: 5,
  assigned_to: null,
  provider: null,
  model: null,
  created_at: Date.now(),
  updated_at: Date.now(),
  started_at: null,
  completed_at: null,
  input_tokens: 0,
  output_tokens: 0,
  cost_usd: 0,
  blocks: [],
  blocked_by: [],
  result: null,
  error: null,
  metadata: null,
  ...overrides,
});

const buildTeammate = (overrides: Partial<ITeammate> = {}): ITeammate => ({
  id: 'mate_1',
  team_id: 'team_1',
  name: 'Teammate',
  role: 'backend',
  provider: 'claude',
  model: 'sonnet',
  status: 'idle',
  current_task_id: null,
  skills: [],
  tasks_completed: 0,
  tasks_failed: 0,
  total_tokens: 0,
  total_cost_usd: 0,
  avg_task_duration_ms: 0,
  created_at: Date.now(),
  updated_at: Date.now(),
  last_active_at: null,
  metadata: null,
  ...overrides,
});

describe('TaskManager', () => {
  it('assignTask sets provider/model and teammate busy state', () => {
    const task = buildTask();
    const teammate = buildTeammate({ id: 'mate_x' });

    const db = {
      getTask: jest.fn(() => task),
      getTeammate: jest.fn(() => teammate),
      updateTeammate: jest.fn(() => teammate),
      updateTask: jest.fn((_id: string, updates: Partial<IAgentTask>) => ({ ...task, ...updates })),
    } as any;

    const providerRouter = {
      selectProvider: jest.fn(() => ({ provider: 'qwen', model: 'coder', cost: 0.008 })),
    } as any;

    const dependencyResolver = {
      isTaskReady: jest.fn(() => true),
      getReadyTasks: jest.fn(() => []),
    } as any;

    const manager = new TaskManager(db, providerRouter, dependencyResolver);
    const assigned = manager.assignTask(task.id, teammate.id);

    expect(assigned?.assigned_to).toBe(teammate.id);
    expect(assigned?.provider).toBe('qwen');
    expect(assigned?.model).toBe('coder');
    expect(assigned?.status).toBe('in_progress');
    expect(db.updateTeammate).toHaveBeenCalledWith(teammate.id, expect.objectContaining({ status: 'busy', current_task_id: task.id }));
  });

  it('round_robin allocation rotates teammate selection', () => {
    const readyTask = buildTask();
    const teammateA = buildTeammate({ id: 'mate_a', name: 'A' });
    const teammateB = buildTeammate({ id: 'mate_b', name: 'B' });

    const db = {
      listTeammates: jest.fn(() => [teammateA, teammateB]),
      getTask: jest.fn(),
      updateTask: jest.fn(),
    } as any;

    const providerRouter = {
      selectProvider: jest.fn(),
    } as any;

    const dependencyResolver = {
      getReadyTasks: jest.fn(() => [readyTask]),
      isTaskReady: jest.fn(() => true),
    } as any;

    const manager = new TaskManager(db, providerRouter, dependencyResolver);
    const first = manager.getNextTask('team_1', 'round_robin');
    const second = manager.getNextTask('team_1', 'round_robin');

    expect(first?.teammate.id).toBe('mate_a');
    expect(second?.teammate.id).toBe('mate_b');
  });

  it('startTask throws when dependencies are not ready', () => {
    const task = buildTask();

    const db = {
      getTask: jest.fn(() => task),
      updateTask: jest.fn(),
    } as any;

    const providerRouter = {
      selectProvider: jest.fn(),
    } as any;

    const dependencyResolver = {
      isTaskReady: jest.fn(() => false),
      getReadyTasks: jest.fn(() => []),
    } as any;

    const manager = new TaskManager(db, providerRouter, dependencyResolver);

    expect(() => manager.startTask(task.id)).toThrow('Task dependencies are not satisfied');
  });
});
