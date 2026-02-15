/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentTeamsDatabase } from '@process/database/agentTeams';
import type { MessageType, ITeamMessage } from './types';

type TeamSubscriber = (message: ITeamMessage) => void;
type TeammateSubscriber = (message: ITeamMessage) => void;

export class MessageBroker {
  private readonly teamSubscribers = new Map<string, Set<TeamSubscriber>>();
  private readonly teammateSubscribers = new Map<string, Set<TeammateSubscriber>>();

  constructor(private readonly db: AgentTeamsDatabase) {}

  sendMessage(params: { team_id: string; type: MessageType; from_teammate_id?: string; to_teammate_id?: string; subject?: string; content: string; task_id?: string; metadata?: unknown }): ITeamMessage {
    const message = this.db.sendMessage(params);

    if (params.type === 'p2p' && message.to_teammate_id) {
      this.sendP2P(message.to_teammate_id, message);
    } else {
      this.broadcast(message.team_id, message);
    }

    return message;
  }

  broadcastMessage(teamId: string, content: string, metadata?: unknown): ITeamMessage {
    return this.sendMessage({
      team_id: teamId,
      type: 'broadcast',
      content,
      metadata,
    });
  }

  sendP2PMessage(teamId: string, fromId: string, toId: string, content: string, metadata?: unknown): ITeamMessage {
    return this.sendMessage({
      team_id: teamId,
      type: 'p2p',
      from_teammate_id: fromId,
      to_teammate_id: toId,
      content,
      metadata,
    });
  }

  getMessages(params: { team_id: string; type?: MessageType; task_id?: string; limit?: number; offset?: number }): ITeamMessage[] {
    return this.db.getMessages(params);
  }

  subscribeToMessages(teamId: string, callback: TeamSubscriber): () => void {
    if (!this.teamSubscribers.has(teamId)) {
      this.teamSubscribers.set(teamId, new Set());
    }

    this.teamSubscribers.get(teamId)?.add(callback);
    return () => {
      this.teamSubscribers.get(teamId)?.delete(callback);
    };
  }

  subscribeToTeammateMessages(teammateId: string, callback: TeammateSubscriber): () => void {
    if (!this.teammateSubscribers.has(teammateId)) {
      this.teammateSubscribers.set(teammateId, new Set());
    }

    this.teammateSubscribers.get(teammateId)?.add(callback);
    return () => {
      this.teammateSubscribers.get(teammateId)?.delete(callback);
    };
  }

  private broadcast(teamId: string, message: ITeamMessage): void {
    const subscribers = this.teamSubscribers.get(teamId);
    if (!subscribers) {
      return;
    }

    for (const callback of subscribers) {
      callback(message);
    }
  }

  private sendP2P(teammateId: string, message: ITeamMessage): void {
    const subscribers = this.teammateSubscribers.get(teammateId);
    if (!subscribers) {
      return;
    }

    for (const callback of subscribers) {
      callback(message);
    }

    // Also notify team-level subscribers for audit trail.
    this.broadcast(message.team_id, message);
  }
}
