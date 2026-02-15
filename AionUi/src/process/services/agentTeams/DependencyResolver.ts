/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentTeamsDatabase } from '@process/database/agentTeams';
import type { IAgentTask } from './types';

export class DependencyResolver {
  constructor(private readonly db: AgentTeamsDatabase) {}

  buildDAG(teamId: string): Map<string, string[]> {
    const tasks = this.db.listTasks({ team_id: teamId, limit: 10000, offset: 0 });
    const dag = new Map<string, string[]>();

    for (const task of tasks) {
      dag.set(task.id, [...task.blocked_by]);
    }

    return dag;
  }

  topologicalSort(dag: Map<string, string[]>): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of dag.keys()) {
      inDegree.set(node, 0);
      adjacency.set(node, []);
    }

    for (const [taskId, dependencies] of dag.entries()) {
      for (const dep of dependencies) {
        if (!inDegree.has(dep)) {
          inDegree.set(dep, 0);
          adjacency.set(dep, []);
        }
        inDegree.set(taskId, (inDegree.get(taskId) ?? 0) + 1);
        adjacency.get(dep)?.push(taskId);
      }
    }

    const queue: string[] = [];
    const result: string[] = [];

    for (const [node, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) {
        continue;
      }

      result.push(node);

      for (const next of adjacency.get(node) || []) {
        const degree = (inDegree.get(next) ?? 0) - 1;
        inDegree.set(next, degree);
        if (degree === 0) {
          queue.push(next);
        }
      }
    }

    if (result.length !== inDegree.size) {
      throw new Error('Circular dependency detected');
    }

    return result;
  }

  detectCycles(dag: Map<string, string[]>): string[][] | null {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const stack: string[] = [];
    const cycles: string[][] = [];

    const dfs = (node: string) => {
      if (visiting.has(node)) {
        const index = stack.indexOf(node);
        if (index >= 0) {
          cycles.push(stack.slice(index).concat(node));
        }
        return;
      }
      if (visited.has(node)) {
        return;
      }

      visiting.add(node);
      stack.push(node);

      for (const dependency of dag.get(node) || []) {
        dfs(dependency);
      }

      stack.pop();
      visiting.delete(node);
      visited.add(node);
    };

    for (const node of dag.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles.length > 0 ? cycles : null;
  }

  getReadyTasks(teamId: string): IAgentTask[] {
    return this.db.getReadyTasks(teamId);
  }

  isTaskReady(taskId: string): boolean {
    const task = this.db.getTask(taskId);
    if (!task) {
      return false;
    }

    const dependencies = this.db.getTaskDependencies(taskId);
    for (const dependsOn of dependencies.blocked_by) {
      const depTask = this.db.getTask(dependsOn);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  getCriticalPath(teamId: string): string[] {
    const dag = this.buildDAG(teamId);
    const order = this.topologicalSort(dag);
    const distance = new Map<string, number>();
    const previous = new Map<string, string | null>();

    for (const node of order) {
      distance.set(node, 0);
      previous.set(node, null);
    }

    for (const node of order) {
      const nodeDistance = distance.get(node) ?? 0;
      for (const dependent of this.getDependents(dag, node)) {
        const candidateDistance = nodeDistance + 1;
        if (candidateDistance > (distance.get(dependent) ?? 0)) {
          distance.set(dependent, candidateDistance);
          previous.set(dependent, node);
        }
      }
    }

    let endNode: string | null = null;
    let maxDistance = -1;
    for (const [node, value] of distance.entries()) {
      if (value > maxDistance) {
        maxDistance = value;
        endNode = node;
      }
    }

    if (!endNode) {
      return [];
    }

    const path: string[] = [];
    let cursor: string | null = endNode;
    while (cursor) {
      path.push(cursor);
      cursor = previous.get(cursor) ?? null;
    }

    return path.reverse();
  }

  private getDependents(dag: Map<string, string[]>, node: string): string[] {
    const result: string[] = [];
    for (const [taskId, dependencies] of dag.entries()) {
      if (dependencies.includes(node)) {
        result.push(taskId);
      }
    }
    return result;
  }
}
