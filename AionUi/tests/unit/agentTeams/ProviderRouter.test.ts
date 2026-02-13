import { describe, expect, it } from '@jest/globals';
import { ProviderRouter } from '@/process/services/agentTeams/ProviderRouter';
import type { IAgentTask } from '@/process/services/agentTeams/types';

const buildTask = (overrides: Partial<IAgentTask> = {}): IAgentTask => ({
  id: 'task_1',
  team_id: 'team_1',
  subject: 'Default task',
  description: 'General work',
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

describe('ProviderRouter', () => {
  const router = new ProviderRouter();

  it('routes chinese translation tasks to kimi', () => {
    const task = buildTask({ subject: 'Chinese translation', description: 'Translate to 中文' });
    const selected = router.selectProvider(task);
    expect(selected.provider).toBe('kimi');
  });

  it('routes backend tasks to qwen', () => {
    const task = buildTask({ description: 'Build backend API and database logic' });
    const selected = router.selectProvider(task);
    expect(selected.provider).toBe('qwen');
  });

  it('returns failover provider when failed provider has mapping', () => {
    const task = buildTask({ description: 'General task' });
    const fallback = router.failover(task, 'claude');
    expect(fallback.provider).not.toBe('claude');
  });
});
