/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { HivemindAgent } from '@/agent/hivemind';
import type { HivemindConfig } from '@/agent/hivemind/types';
import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chatLib';
import { transformMessage } from '@/common/chatLib';
import type { IResponseMessage } from '@/common/ipcBridge';
import { uuid } from '@/common/utils';
import { addMessage, addOrUpdateMessage } from '@process/message';
import { cronBusyGuard } from '@process/services/cron/CronBusyGuard';
import BaseAgentManager from '@process/task/BaseAgentManager';
import { ProcessConfig } from '../initStorage';

export interface HivemindAgentManagerData {
  conversation_id: string;
  workspace?: string;
  gatewayUrl?: string;
  defaultProvider?: string | null;
  timeoutS?: number;
  streaming?: boolean;
  agent?: string | null;
  cacheBypass?: boolean;
  systemPrompt?: string | null;
}

class HivemindAgentManager extends BaseAgentManager<HivemindAgentManagerData> {
  workspace?: string;
  agent!: HivemindAgent;
  private bootstrap?: Promise<HivemindAgent>;
  private options: HivemindAgentManagerData;

  constructor(data: HivemindAgentManagerData) {
    super('hivemind', data);
    this.conversation_id = data.conversation_id;
    this.workspace = data.workspace;
    this.options = data;
  }

  private initAgent(data: HivemindAgentManagerData = this.options): Promise<HivemindAgent> {
    if (this.bootstrap) {
      return this.bootstrap;
    }

    this.bootstrap = (async () => {
      const globalConfig = (await ProcessConfig.get('hivemind.config')) || {};
      const mergedConfig: Partial<HivemindConfig> = {
        gatewayUrl: data.gatewayUrl ?? globalConfig.gatewayUrl,
        defaultProvider: data.defaultProvider ?? globalConfig.defaultProvider,
        timeoutS: data.timeoutS ?? globalConfig.timeoutS,
        streaming: data.streaming ?? globalConfig.streaming,
        agent: data.agent ?? globalConfig.agent,
        cacheBypass: data.cacheBypass ?? globalConfig.cacheBypass,
        systemPrompt: data.systemPrompt ?? globalConfig.systemPrompt,
      };

      this.agent = new HivemindAgent({
        id: data.conversation_id,
        conversationId: data.conversation_id,
        config: mergedConfig,
        onStreamEvent: (message) => this.handleStreamEvent(message),
      });

      const healthy = await this.agent.start();
      if (!healthy) {
        const errorMessage: IResponseMessage = {
          type: 'error',
          conversation_id: this.conversation_id,
          msg_id: uuid(),
          data: 'Hivemind Gateway is not reachable. Please start it at http://localhost:8765',
        };
        this.handleStreamEvent(errorMessage);
      }

      return this.agent;
    })();

    return this.bootstrap;
  }

  private handleStreamEvent(message: IResponseMessage): void {
    const msg: IResponseMessage = {
      ...message,
      conversation_id: this.conversation_id,
    };

    if (msg.type === 'finish' || msg.type === 'error') {
      cronBusyGuard.setProcessing(this.conversation_id, false);
    }

    const tMessage = transformMessage(msg);
    if (tMessage) {
      if (msg.type === 'content' && msg.msg_id) {
        addOrUpdateMessage(this.conversation_id, tMessage);
      } else {
        addMessage(this.conversation_id, tMessage);
      }
    }

    ipcBridge.conversation.responseStream.emit(msg);
  }

  async sendMessage(data: { content: string; files?: string[]; msg_id?: string; provider?: string | null; model?: string | null }): Promise<void> {
    cronBusyGuard.setProcessing(this.conversation_id, true);

    try {
      await this.initAgent();

      if (data.msg_id && data.content) {
        const userMessage: TMessage = {
          id: data.msg_id,
          msg_id: data.msg_id,
          type: 'text',
          position: 'right',
          conversation_id: this.conversation_id,
          content: {
            content: data.content,
          },
          createdAt: Date.now(),
        };
        addMessage(this.conversation_id, userMessage);

        const userResponse: IResponseMessage = {
          type: 'user_content',
          conversation_id: this.conversation_id,
          msg_id: data.msg_id,
          data: data.content,
        };
        ipcBridge.conversation.responseStream.emit(userResponse);
      }

      await this.agent.send(data.content, data.provider, data.files, data.model ?? null);
    } catch (error) {
      cronBusyGuard.setProcessing(this.conversation_id, false);
      const normalized = error instanceof Error ? error.message : String(error);

      this.handleStreamEvent({
        type: 'error',
        conversation_id: this.conversation_id,
        msg_id: data.msg_id || uuid(),
        data: normalized,
      });

      throw error;
    }
  }

  stop(): Promise<void> {
    this.agent?.stop();
    cronBusyGuard.setProcessing(this.conversation_id, false);
    return Promise.resolve();
  }

  kill() {
    try {
      this.agent?.stop();
    } finally {
      super.kill();
    }
  }
}

export default HivemindAgentManager;
