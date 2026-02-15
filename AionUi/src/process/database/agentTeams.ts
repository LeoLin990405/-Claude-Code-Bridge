/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type Database from 'better-sqlite3';
import type { ICostAnalysis, IAgentSession, IAgentTask, IAgentTeam, ITaskDependency, ITeamMessage, ITeamStats, ITeammate, AllocationStrategy, DependencyType, MessageType, SessionStatus, TaskStatus, TeamStatus, TeammateStatus } from '@/process/services/agentTeams/types';
import { getDatabase } from './index';

const createId = (prefix: string): string => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const nowMs = (): number => Date.now();

const parseArray = (value: string | null | undefined): string[] => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
};

const parseJsonString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
};

type TeamRow = Omit<IAgentTeam, never>;
type TeammateRow = Omit<ITeammate, 'skills'> & { skills: string };
type TaskRow = Omit<IAgentTask, 'blocks' | 'blocked_by'> & { blocks: string; blocked_by: string };
type MessageRow = Omit<ITeamMessage, never>;
type DependencyRow = Omit<ITaskDependency, never>;
type SessionRow = Omit<IAgentSession, never>;

const toTeam = (row: TeamRow): IAgentTeam => ({ ...row });

const toTeammate = (row: TeammateRow): ITeammate => ({
  ...row,
  skills: parseArray(row.skills),
});

const toTask = (row: TaskRow): IAgentTask => ({
  ...row,
  blocks: parseArray(row.blocks),
  blocked_by: parseArray(row.blocked_by),
});

const toMessage = (row: MessageRow): ITeamMessage => ({ ...row });

const toDependency = (row: DependencyRow): ITaskDependency => ({ ...row });

const toSession = (row: SessionRow): IAgentSession => ({ ...row });

export class AgentTeamsDatabase {
  constructor(private readonly db: Database.Database) {}

  // =====================
  // Team
  // =====================
  createTeam(params: { name: string; description?: string; max_teammates?: number; task_allocation_strategy?: AllocationStrategy; metadata?: unknown }): IAgentTeam {
    const id = createId('team');
    const timestamp = nowMs();
    const description = params.description ?? null;
    const maxTeammates = Math.max(1, params.max_teammates ?? 5);
    const strategy: AllocationStrategy = params.task_allocation_strategy ?? 'round_robin';
    const metadata = parseJsonString(params.metadata);

    this.db
      .prepare(
        `
        INSERT INTO agent_teams (
          id, name, description, status, max_teammates, task_allocation_strategy,
          created_at, updated_at, started_at, completed_at,
          total_tasks, completed_tasks, failed_tasks, total_cost_usd, metadata
        ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NULL, NULL, 0, 0, 0, 0.0, ?)
      `
      )
      .run(id, params.name, description, maxTeammates, strategy, timestamp, timestamp, metadata);

    const team = this.getTeam(id);
    if (!team) {
      throw new Error('Failed to create team');
    }
    return team;
  }

  getTeam(teamId: string): IAgentTeam | null {
    const row = this.db.prepare('SELECT * FROM agent_teams WHERE id = ?').get(teamId) as TeamRow | undefined;
    return row ? toTeam(row) : null;
  }

  listTeams(filters?: { status?: TeamStatus; limit?: number; offset?: number }): IAgentTeam[] {
    const status = filters?.status;
    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;

    const sql = status ? 'SELECT * FROM agent_teams WHERE status = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?' : 'SELECT * FROM agent_teams ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    const rows = status ? (this.db.prepare(sql).all(status, limit, offset) as TeamRow[]) : (this.db.prepare(sql).all(limit, offset) as TeamRow[]);

    return rows.map(toTeam);
  }

  updateTeam(teamId: string, updates: Partial<IAgentTeam>): IAgentTeam | null {
    const existing = this.getTeam(teamId);
    if (!existing) {
      return null;
    }

    const next = {
      ...existing,
      ...updates,
      id: existing.id,
      updated_at: nowMs(),
      metadata: updates.metadata !== undefined ? parseJsonString(updates.metadata) : existing.metadata,
    };

    this.db
      .prepare(
        `
        UPDATE agent_teams
        SET name = ?, description = ?, status = ?, max_teammates = ?, task_allocation_strategy = ?,
            updated_at = ?, started_at = ?, completed_at = ?,
            total_tasks = ?, completed_tasks = ?, failed_tasks = ?, total_cost_usd = ?, metadata = ?
        WHERE id = ?
      `
      )
      .run(next.name, next.description, next.status, next.max_teammates, next.task_allocation_strategy, next.updated_at, next.started_at, next.completed_at, next.total_tasks, next.completed_tasks, next.failed_tasks, next.total_cost_usd, next.metadata, teamId);

    return this.getTeam(teamId);
  }

  deleteTeam(teamId: string): boolean {
    const result = this.db.prepare('DELETE FROM agent_teams WHERE id = ?').run(teamId);
    return result.changes > 0;
  }

  // =====================
  // Teammate
  // =====================
  addTeammate(params: { team_id: string; name: string; role: string; provider: string; model: string; skills?: string[]; metadata?: unknown }): ITeammate {
    const id = createId('teammate');
    const timestamp = nowMs();

    this.db
      .prepare(
        `
        INSERT INTO agent_teammates (
          id, team_id, name, role, provider, model, status, current_task_id,
          skills, tasks_completed, tasks_failed, total_tokens, total_cost_usd, avg_task_duration_ms,
          created_at, updated_at, last_active_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, 'idle', NULL, ?, 0, 0, 0, 0.0, 0, ?, ?, NULL, ?)
      `
      )
      .run(id, params.team_id, params.name, params.role, params.provider, params.model, JSON.stringify(params.skills ?? []), timestamp, timestamp, parseJsonString(params.metadata));

    const teammate = this.getTeammate(id);
    if (!teammate) {
      throw new Error('Failed to add teammate');
    }

    return teammate;
  }

  getTeammate(teammateId: string): ITeammate | null {
    const row = this.db.prepare('SELECT * FROM agent_teammates WHERE id = ?').get(teammateId) as TeammateRow | undefined;
    return row ? toTeammate(row) : null;
  }

  listTeammates(teamId: string, status?: TeammateStatus): ITeammate[] {
    const rows = status ? (this.db.prepare('SELECT * FROM agent_teammates WHERE team_id = ? AND status = ? ORDER BY updated_at DESC').all(teamId, status) as TeammateRow[]) : (this.db.prepare('SELECT * FROM agent_teammates WHERE team_id = ? ORDER BY updated_at DESC').all(teamId) as TeammateRow[]);

    return rows.map(toTeammate);
  }

  updateTeammate(teammateId: string, updates: Partial<ITeammate>): ITeammate | null {
    const existing = this.getTeammate(teammateId);
    if (!existing) {
      return null;
    }

    const next: ITeammate = {
      ...existing,
      ...updates,
      id: existing.id,
      team_id: existing.team_id,
      updated_at: nowMs(),
      skills: updates.skills ?? existing.skills,
      metadata: updates.metadata !== undefined ? parseJsonString(updates.metadata) : existing.metadata,
    };

    this.db
      .prepare(
        `
        UPDATE agent_teammates
        SET name = ?, role = ?, provider = ?, model = ?, status = ?, current_task_id = ?,
            skills = ?, tasks_completed = ?, tasks_failed = ?, total_tokens = ?, total_cost_usd = ?, avg_task_duration_ms = ?,
            updated_at = ?, last_active_at = ?, metadata = ?
        WHERE id = ?
      `
      )
      .run(next.name, next.role, next.provider, next.model, next.status, next.current_task_id, JSON.stringify(next.skills), next.tasks_completed, next.tasks_failed, next.total_tokens, next.total_cost_usd, next.avg_task_duration_ms, next.updated_at, next.last_active_at, next.metadata, teammateId);

    return this.getTeammate(teammateId);
  }

  removeTeammate(teammateId: string): boolean {
    const result = this.db.prepare('DELETE FROM agent_teammates WHERE id = ?').run(teammateId);
    return result.changes > 0;
  }

  // =====================
  // Task
  // =====================
  createTask(params: { team_id: string; subject: string; description: string; priority?: number; blocks?: string[]; blocked_by?: string[]; metadata?: unknown }): IAgentTask {
    const id = createId('task');
    const timestamp = nowMs();
    const blocks = params.blocks ?? [];
    const blockedBy = params.blocked_by ?? [];

    this.db
      .prepare(
        `
        INSERT INTO agent_tasks (
          id, team_id, subject, description, status, priority,
          assigned_to, provider, model,
          created_at, updated_at, started_at, completed_at,
          input_tokens, output_tokens, cost_usd,
          blocks, blocked_by, result, error, metadata
        ) VALUES (?, ?, ?, ?, 'pending', ?, NULL, NULL, NULL, ?, ?, NULL, NULL, 0, 0, 0.0, ?, ?, NULL, NULL, ?)
      `
      )
      .run(id, params.team_id, params.subject, params.description, Math.max(1, Math.min(10, params.priority ?? 5)), timestamp, timestamp, JSON.stringify(blocks), JSON.stringify(blockedBy), parseJsonString(params.metadata));

    for (const dependsOnTaskId of blockedBy) {
      this.addDependency({
        task_id: id,
        depends_on_task_id: dependsOnTaskId,
        dependency_type: 'finish_to_start',
      });
    }

    const task = this.getTask(id);
    if (!task) {
      throw new Error('Failed to create task');
    }

    this.recalculateTeamCounters(params.team_id);
    return task;
  }

  getTask(taskId: string): IAgentTask | null {
    const row = this.db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    return row ? toTask(row) : null;
  }

  listTasks(filters: { team_id: string; status?: TaskStatus; assigned_to?: string; limit?: number; offset?: number }): IAgentTask[] {
    const conditions: string[] = ['team_id = ?'];
    const values: Array<string | number> = [filters.team_id];

    if (filters.status) {
      conditions.push('status = ?');
      values.push(filters.status);
    }

    if (filters.assigned_to) {
      conditions.push('assigned_to = ?');
      values.push(filters.assigned_to);
    }

    values.push(filters.limit ?? 200, filters.offset ?? 0);

    const sql = `SELECT * FROM agent_tasks WHERE ${conditions.join(' AND ')} ORDER BY priority DESC, created_at ASC LIMIT ? OFFSET ?`;
    const rows = this.db.prepare(sql).all(...values) as TaskRow[];
    return rows.map(toTask);
  }

  updateTask(taskId: string, updates: Partial<IAgentTask>): IAgentTask | null {
    const existing = this.getTask(taskId);
    if (!existing) {
      return null;
    }

    const next: IAgentTask = {
      ...existing,
      ...updates,
      id: existing.id,
      team_id: existing.team_id,
      updated_at: nowMs(),
      blocks: updates.blocks ?? existing.blocks,
      blocked_by: updates.blocked_by ?? existing.blocked_by,
      result: updates.result !== undefined ? parseJsonString(updates.result) : existing.result,
      metadata: updates.metadata !== undefined ? parseJsonString(updates.metadata) : existing.metadata,
    };

    this.db
      .prepare(
        `
        UPDATE agent_tasks
        SET subject = ?, description = ?, status = ?, priority = ?,
            assigned_to = ?, provider = ?, model = ?,
            updated_at = ?, started_at = ?, completed_at = ?,
            input_tokens = ?, output_tokens = ?, cost_usd = ?,
            blocks = ?, blocked_by = ?, result = ?, error = ?, metadata = ?
        WHERE id = ?
      `
      )
      .run(next.subject, next.description, next.status, next.priority, next.assigned_to, next.provider, next.model, next.updated_at, next.started_at, next.completed_at, next.input_tokens, next.output_tokens, next.cost_usd, JSON.stringify(next.blocks), JSON.stringify(next.blocked_by), next.result, next.error, next.metadata, taskId);

    this.recalculateTeamCounters(existing.team_id);
    return this.getTask(taskId);
  }

  deleteTask(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (!task) {
      return false;
    }
    const result = this.db.prepare('DELETE FROM agent_tasks WHERE id = ?').run(taskId);
    this.recalculateTeamCounters(task.team_id);
    return result.changes > 0;
  }

  getReadyTasks(teamId: string): IAgentTask[] {
    const rows = this.db
      .prepare(
        `
        SELECT t.*
        FROM agent_tasks t
        WHERE t.team_id = ?
          AND t.status = 'pending'
          AND NOT EXISTS (
            SELECT 1
            FROM agent_task_dependencies d
            JOIN agent_tasks dep ON dep.id = d.depends_on_task_id
            WHERE d.task_id = t.id
              AND dep.status != 'completed'
          )
        ORDER BY t.priority DESC, t.created_at ASC
      `
      )
      .all(teamId) as TaskRow[];

    return rows.map(toTask);
  }

  // =====================
  // Dependency
  // =====================
  addDependency(params: { task_id: string; depends_on_task_id: string; dependency_type?: DependencyType }): ITaskDependency {
    const id = createId('dep');
    const timestamp = nowMs();
    const dependencyType = params.dependency_type ?? 'finish_to_start';

    this.db
      .prepare(
        `
        INSERT OR IGNORE INTO agent_task_dependencies (
          id, task_id, depends_on_task_id, dependency_type, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `
      )
      .run(id, params.task_id, params.depends_on_task_id, dependencyType, timestamp);

    this.syncTaskDependencyArrays(params.task_id);

    const dep = this.getDependency(params.task_id, params.depends_on_task_id);
    if (!dep) {
      throw new Error('Failed to add dependency');
    }
    return dep;
  }

  removeDependency(taskId: string, dependsOnTaskId: string): boolean {
    const result = this.db.prepare('DELETE FROM agent_task_dependencies WHERE task_id = ? AND depends_on_task_id = ?').run(taskId, dependsOnTaskId);

    this.syncTaskDependencyArrays(taskId);
    return result.changes > 0;
  }

  getDependency(taskId: string, dependsOnTaskId: string): ITaskDependency | null {
    const row = this.db.prepare('SELECT * FROM agent_task_dependencies WHERE task_id = ? AND depends_on_task_id = ?').get(taskId, dependsOnTaskId) as DependencyRow | undefined;

    return row ? toDependency(row) : null;
  }

  getTaskDependencies(taskId: string): { blocks: string[]; blocked_by: string[] } {
    const blockedByRows = this.db.prepare('SELECT depends_on_task_id FROM agent_task_dependencies WHERE task_id = ?').all(taskId) as Array<{ depends_on_task_id: string }>;

    const blocksRows = this.db.prepare('SELECT task_id FROM agent_task_dependencies WHERE depends_on_task_id = ?').all(taskId) as Array<{ task_id: string }>;

    return {
      blocks: blocksRows.map((row) => row.task_id),
      blocked_by: blockedByRows.map((row) => row.depends_on_task_id),
    };
  }

  // =====================
  // Message
  // =====================
  sendMessage(params: { team_id: string; type: MessageType; from_teammate_id?: string; to_teammate_id?: string; subject?: string; content: string; task_id?: string; metadata?: unknown }): ITeamMessage {
    const id = createId('msg');
    const timestamp = nowMs();

    this.db
      .prepare(
        `
        INSERT INTO agent_team_messages (
          id, team_id, type, from_teammate_id, to_teammate_id,
          subject, content, task_id, created_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(id, params.team_id, params.type, params.from_teammate_id ?? null, params.to_teammate_id ?? null, params.subject ?? null, params.content, params.task_id ?? null, timestamp, parseJsonString(params.metadata));

    const message = this.getMessage(id);
    if (!message) {
      throw new Error('Failed to create message');
    }
    return message;
  }

  getMessage(messageId: string): ITeamMessage | null {
    const row = this.db.prepare('SELECT * FROM agent_team_messages WHERE id = ?').get(messageId) as MessageRow | undefined;
    return row ? toMessage(row) : null;
  }

  getMessages(filters: { team_id: string; type?: MessageType; task_id?: string; limit?: number; offset?: number }): ITeamMessage[] {
    const conditions: string[] = ['team_id = ?'];
    const values: Array<string | number> = [filters.team_id];

    if (filters.type) {
      conditions.push('type = ?');
      values.push(filters.type);
    }
    if (filters.task_id) {
      conditions.push('task_id = ?');
      values.push(filters.task_id);
    }

    values.push(filters.limit ?? 200, filters.offset ?? 0);

    const sql = `
      SELECT *
      FROM agent_team_messages
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(sql).all(...values) as MessageRow[];
    return rows.map(toMessage);
  }

  // =====================
  // Session
  // =====================
  createSession(params: { teammate_id: string; task_id: string; provider: string; model: string; metadata?: unknown }): IAgentSession {
    const id = createId('session');
    const timestamp = nowMs();

    this.db
      .prepare(
        `
        INSERT INTO agent_sessions (
          id, teammate_id, task_id, status, provider, model,
          input_tokens, output_tokens, cost_usd,
          started_at, completed_at, duration_ms, result, error, metadata
        ) VALUES (?, ?, ?, 'running', ?, ?, 0, 0, 0.0, ?, NULL, NULL, NULL, NULL, ?)
      `
      )
      .run(id, params.teammate_id, params.task_id, params.provider, params.model, timestamp, parseJsonString(params.metadata));

    const session = this.getSession(id);
    if (!session) {
      throw new Error('Failed to create session');
    }
    return session;
  }

  getSession(sessionId: string): IAgentSession | null {
    const row = this.db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(sessionId) as SessionRow | undefined;
    return row ? toSession(row) : null;
  }

  updateSession(sessionId: string, updates: Partial<IAgentSession>): IAgentSession | null {
    const existing = this.getSession(sessionId);
    if (!existing) {
      return null;
    }

    const next: IAgentSession = {
      ...existing,
      ...updates,
      id: existing.id,
      teammate_id: existing.teammate_id,
      task_id: existing.task_id,
      result: updates.result !== undefined ? parseJsonString(updates.result) : existing.result,
      metadata: updates.metadata !== undefined ? parseJsonString(updates.metadata) : existing.metadata,
    };

    this.db
      .prepare(
        `
        UPDATE agent_sessions
        SET status = ?, provider = ?, model = ?, input_tokens = ?, output_tokens = ?,
            cost_usd = ?, started_at = ?, completed_at = ?, duration_ms = ?,
            result = ?, error = ?, metadata = ?
        WHERE id = ?
      `
      )
      .run(next.status, next.provider, next.model, next.input_tokens, next.output_tokens, next.cost_usd, next.started_at, next.completed_at, next.duration_ms, next.result, next.error, next.metadata, sessionId);

    return this.getSession(sessionId);
  }

  getActiveSessions(teamId: string): IAgentSession[] {
    const rows = this.db
      .prepare(
        `
        SELECT s.*
        FROM agent_sessions s
        JOIN agent_tasks t ON t.id = s.task_id
        WHERE t.team_id = ? AND s.status = 'running'
        ORDER BY s.started_at DESC
      `
      )
      .all(teamId) as SessionRow[];

    return rows.map(toSession);
  }

  // =====================
  // Analytics
  // =====================
  getTeamStats(teamId: string): ITeamStats {
    const counts = this.db
      .prepare(
        `
        SELECT
          COUNT(*) AS total_tasks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_tasks,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
          COALESCE(SUM(cost_usd), 0.0) AS total_cost_usd
        FROM agent_tasks
        WHERE team_id = ?
      `
      )
      .get(teamId) as {
      total_tasks: number;
      completed_tasks: number;
      failed_tasks: number;
      in_progress_tasks: number;
      total_cost_usd: number;
    };

    const avgDuration = this.db
      .prepare(
        `
        SELECT COALESCE(AVG(duration_ms), 0) AS avg_duration
        FROM agent_sessions s
        JOIN agent_tasks t ON t.id = s.task_id
        WHERE t.team_id = ? AND s.duration_ms IS NOT NULL
      `
      )
      .get(teamId) as { avg_duration: number };

    const teammateStats = this.db
      .prepare(
        `
        SELECT
          tm.id AS teammate_id,
          tm.name,
          tm.tasks_completed,
          tm.tasks_failed,
          tm.total_cost_usd,
          tm.avg_task_duration_ms
        FROM agent_teammates tm
        WHERE tm.team_id = ?
        ORDER BY tm.tasks_completed DESC, tm.updated_at DESC
      `
      )
      .all(teamId) as Array<{
      teammate_id: string;
      name: string;
      tasks_completed: number;
      tasks_failed: number;
      total_cost_usd: number;
      avg_task_duration_ms: number;
    }>;

    return {
      total_tasks: counts.total_tasks ?? 0,
      completed_tasks: counts.completed_tasks ?? 0,
      failed_tasks: counts.failed_tasks ?? 0,
      in_progress_tasks: counts.in_progress_tasks ?? 0,
      total_cost_usd: Number(counts.total_cost_usd ?? 0),
      avg_task_duration_ms: Math.round(Number(avgDuration.avg_duration ?? 0)),
      teammate_stats: teammateStats,
    };
  }

  getCostAnalysis(teamId: string): ICostAnalysis {
    const total = this.db.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS total_cost_usd FROM agent_tasks WHERE team_id = ?').get(teamId) as { total_cost_usd: number };

    const providerRows = this.db
      .prepare(
        `
        SELECT provider, SUM(cost_usd) AS cost_usd,
               SUM(input_tokens) AS input_tokens,
               SUM(output_tokens) AS output_tokens,
               COUNT(*) AS tasks_count
        FROM agent_tasks
        WHERE team_id = ? AND provider IS NOT NULL
        GROUP BY provider
      `
      )
      .all(teamId) as Array<{ provider: string; cost_usd: number; input_tokens: number; output_tokens: number; tasks_count: number }>;

    const modelRows = this.db
      .prepare(
        `
        SELECT model, SUM(cost_usd) AS cost_usd,
               SUM(input_tokens) AS input_tokens,
               SUM(output_tokens) AS output_tokens,
               COUNT(*) AS tasks_count
        FROM agent_tasks
        WHERE team_id = ? AND model IS NOT NULL
        GROUP BY model
      `
      )
      .all(teamId) as Array<{ model: string; cost_usd: number; input_tokens: number; output_tokens: number; tasks_count: number }>;

    const byProvider: ICostAnalysis['by_provider'] = {};
    for (const row of providerRows) {
      byProvider[row.provider] = {
        cost_usd: Number(row.cost_usd ?? 0),
        input_tokens: Number(row.input_tokens ?? 0),
        output_tokens: Number(row.output_tokens ?? 0),
        tasks_count: Number(row.tasks_count ?? 0),
      };
    }

    const byModel: ICostAnalysis['by_model'] = {};
    for (const row of modelRows) {
      byModel[row.model] = {
        cost_usd: Number(row.cost_usd ?? 0),
        input_tokens: Number(row.input_tokens ?? 0),
        output_tokens: Number(row.output_tokens ?? 0),
        tasks_count: Number(row.tasks_count ?? 0),
      };
    }

    return {
      total_cost_usd: Number(total.total_cost_usd ?? 0),
      by_provider: byProvider,
      by_model: byModel,
    };
  }

  // =====================
  // helpers
  // =====================
  private syncTaskDependencyArrays(taskId: string): void {
    const dependencies = this.getTaskDependencies(taskId);
    this.db.prepare('UPDATE agent_tasks SET blocks = ?, blocked_by = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(dependencies.blocks), JSON.stringify(dependencies.blocked_by), nowMs(), taskId);
  }

  private recalculateTeamCounters(teamId: string): void {
    const result = this.getTeamStats(teamId);
    this.db
      .prepare(
        `
        UPDATE agent_teams
        SET total_tasks = ?, completed_tasks = ?, failed_tasks = ?, total_cost_usd = ?, updated_at = ?
        WHERE id = ?
      `
      )
      .run(result.total_tasks, result.completed_tasks, result.failed_tasks, result.total_cost_usd, nowMs(), teamId);
  }
}

let agentTeamsDbInstance: AgentTeamsDatabase | null = null;

export const getAgentTeamsDatabase = (): AgentTeamsDatabase => {
  if (!agentTeamsDbInstance) {
    const rawDb = getDatabase().getNativeDatabase();
    agentTeamsDbInstance = new AgentTeamsDatabase(rawDb);
  }
  return agentTeamsDbInstance;
};

export const resetAgentTeamsDatabaseForTests = (): void => {
  agentTeamsDbInstance = null;
};
