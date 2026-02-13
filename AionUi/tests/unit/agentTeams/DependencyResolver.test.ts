import { describe, expect, it } from '@jest/globals';
import { DependencyResolver } from '@/process/services/agentTeams/DependencyResolver';

describe('DependencyResolver', () => {
  const createResolver = () => {
    const fakeDb = {
      listTasks: (): unknown[] => [],
      getReadyTasks: (): unknown[] => [],
      getTask: (): null => null,
      getTaskDependencies: (): { blocks: string[]; blocked_by: string[] } => ({ blocks: [], blocked_by: [] }),
    } as any;

    return new DependencyResolver(fakeDb);
  };

  it('topologicalSort returns stable order for acyclic dag', () => {
    const resolver = createResolver();
    const dag = new Map<string, string[]>();
    dag.set('task_a', []);
    dag.set('task_b', ['task_a']);
    dag.set('task_c', ['task_b']);

    const order = resolver.topologicalSort(dag);
    expect(order.indexOf('task_a')).toBeLessThan(order.indexOf('task_b'));
    expect(order.indexOf('task_b')).toBeLessThan(order.indexOf('task_c'));
  });

  it('topologicalSort throws when cycle exists', () => {
    const resolver = createResolver();
    const dag = new Map<string, string[]>();
    dag.set('task_a', ['task_b']);
    dag.set('task_b', ['task_a']);

    expect(() => resolver.topologicalSort(dag)).toThrow('Circular dependency detected');
  });

  it('detectCycles finds cycle path', () => {
    const resolver = createResolver();
    const dag = new Map<string, string[]>();
    dag.set('task_a', ['task_b']);
    dag.set('task_b', ['task_c']);
    dag.set('task_c', ['task_a']);

    const cycles = resolver.detectCycles(dag);
    expect(cycles).not.toBeNull();
    expect((cycles || [])[0].length).toBeGreaterThan(2);
  });
});
