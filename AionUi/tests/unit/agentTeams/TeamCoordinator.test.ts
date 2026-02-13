import { describe, expect, it, jest } from '@jest/globals';
import { TeamCoordinator } from '@/process/services/agentTeams/TeamCoordinator';
import type { IAgentTask, IAgentTeam, ITeammate } from '@/process/services/agentTeams/types';

const buildTask = (overrides: Partial<IAgentTask> = {}): IAgentTask => ({
  id: 'task_1',
  team_id: 'team_1',
  subject: 'Task',
  description: 'Task description',
  status: 'in_progress',
  priority: 5,
  assigned_to: 'mate_1',
  provider: 'qwen',
  model: 'coder',
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
  metadata: null,
  ...overrides,
});

const buildTeam = (overrides: Partial<IAgentTeam> = {}): IAgentTeam => ({
  id: 'team_1',
  name: 'Core Team',
  description: null,
  status: 'active',
  max_teammates: 5,
  task_allocation_strategy: 'round_robin',
  created_at: Date.now(),
  updated_at: Date.now(),
  started_at: null,
  completed_at: null,
  total_tasks: 0,
  completed_tasks: 0,
  failed_tasks: 0,
  total_cost_usd: 0,
  metadata: null,
  ...overrides,
});

const buildTeammate = (overrides: Partial<ITeammate> = {}): ITeammate => ({
  id: 'mate_1',
  team_id: 'team_1',
  name: 'Alice',
  role: 'backend',
  provider: 'qwen',
  model: 'coder',
  status: 'idle',
  current_task_id: null,
  skills: ['backend'],
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

describe('TeamCoordinator', () => {
  it('scheduleAllReadyTasks assigns all available tasks', () => {
    const team = buildTeam({ status: 'active' });
    const task = buildTask();
    const teammate = buildTeammate();

    const db = {
      getTeam: jest.fn(() => team),
    } as any;

    let called = 0;
    const taskManager = {
      getNextTask: jest.fn(() => {
        if (called === 0) {
          called += 1;
          return { task, teammate };
        }
        return null;
      }),
      assignTask: jest.fn(() => task),
      completeTask: jest.fn(),
      failTask: jest.fn(),
    } as any;

    const messageBroker = {
      sendMessage: jest.fn(),
      broadcastMessage: jest.fn(),
    } as any;

    const coordinator = new TeamCoordinator(db, taskManager, messageBroker);
    const scheduled = coordinator.scheduleAllReadyTasks(team.id);

    expect(scheduled).toBe(1);
    expect(taskManager.assignTask).toHaveBeenCalledTimes(1);
    expect(messageBroker.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'task_assigned', task_id: task.id }));
  });

  it('startTeam updates team status and schedules tasks', () => {
    const team = buildTeam({ status: 'paused' });
    const updatedTeam = buildTeam({ status: 'active' });

    const db = {
      getTeam: jest.fn(() => team),
      updateTeam: jest.fn(() => updatedTeam),
    } as any;

    const taskManager = {
      getNextTask: jest.fn(() => null),
      assignTask: jest.fn(),
      completeTask: jest.fn(),
      failTask: jest.fn(),
    } as any;

    const messageBroker = {
      sendMessage: jest.fn(),
      broadcastMessage: jest.fn(),
    } as any;

    const coordinator = new TeamCoordinator(db, taskManager, messageBroker);
    const result = coordinator.startTeam(team.id);

    expect(result?.status).toBe('active');
    expect(db.updateTeam).toHaveBeenCalledWith(team.id, expect.objectContaining({ status: 'active' }));
    expect(messageBroker.broadcastMessage).toHaveBeenCalledWith(team.id, expect.stringContaining('Team started'), expect.any(Object));
  });

  it('handleTaskCompletion emits completion message', () => {
    const completedTask = buildTask({ status: 'completed', assigned_to: 'mate_1' });

    const db = {
      getTeam: jest.fn(() => buildTeam()),
    } as any;

    const taskManager = {
      getNextTask: jest.fn(() => null),
      assignTask: jest.fn(),
      completeTask: jest.fn(() => completedTask),
      failTask: jest.fn(),
    } as any;

    const messageBroker = {
      sendMessage: jest.fn(),
      broadcastMessage: jest.fn(),
    } as any;

    const coordinator = new TeamCoordinator(db, taskManager, messageBroker);
    const result = coordinator.handleTaskCompletion(completedTask.id, { ok: true });

    expect(result?.status).toBe('completed');
    expect(messageBroker.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'task_completed', task_id: completedTask.id }));
  });
});
