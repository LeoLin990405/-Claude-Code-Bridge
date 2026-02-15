/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentTeamsDatabase } from '@process/database/agentTeams';
import type { IAgentSession, ITokenUsage } from './types';

export class SessionManager {
  constructor(private readonly db: AgentTeamsDatabase) {}

  createSession(teammateId: string, taskId: string, provider: string, model: string, metadata?: unknown): IAgentSession {
    return this.db.createSession({
      teammate_id: teammateId,
      task_id: taskId,
      provider,
      model,
      metadata,
    });
  }

  updateSession(sessionId: string, updates: Partial<IAgentSession>): IAgentSession | null {
    return this.db.updateSession(sessionId, updates);
  }

  completeSession(sessionId: string, result: unknown, tokenUsage: ITokenUsage): IAgentSession | null {
    const existing = this.db.getSession(sessionId);
    if (!existing) {
      return null;
    }

    const completedAt = Date.now();
    return this.db.updateSession(sessionId, {
      status: 'completed',
      completed_at: completedAt,
      duration_ms: completedAt - existing.started_at,
      input_tokens: tokenUsage.input_tokens,
      output_tokens: tokenUsage.output_tokens,
      cost_usd: tokenUsage.cost_usd,
      result: JSON.stringify(result),
      error: null,
    });
  }

  failSession(sessionId: string, error: string): IAgentSession | null {
    const existing = this.db.getSession(sessionId);
    if (!existing) {
      return null;
    }

    const completedAt = Date.now();
    return this.db.updateSession(sessionId, {
      status: 'failed',
      completed_at: completedAt,
      duration_ms: completedAt - existing.started_at,
      error,
    });
  }

  getActiveSessions(teamId: string): IAgentSession[] {
    return this.db.getActiveSessions(teamId);
  }
}
