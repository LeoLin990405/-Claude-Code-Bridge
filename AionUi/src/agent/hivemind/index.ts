/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IResponseMessage } from '@/common/ipcBridge';
import { uuid } from '@/common/utils';
import { HivemindAdapter } from './HivemindAdapter';
import { HivemindConnection } from './HivemindConnection';
import { DEFAULT_HIVEMIND_CONFIG, type HivemindConfig, type StreamSummary } from './types';

export interface HivemindAgentConfig {
  id: string;
  conversationId: string;
  config?: Partial<HivemindConfig>;
  onStreamEvent: (message: IResponseMessage) => void;
}

export class HivemindAgent {
  private id: string;
  private conversationId: string;
  private config: HivemindConfig;
  private connection: HivemindConnection;
  private adapter: HivemindAdapter;
  private onStreamEvent: (message: IResponseMessage) => void;

  constructor(options: HivemindAgentConfig) {
    this.id = options.id;
    this.conversationId = options.conversationId;
    this.config = {
      ...DEFAULT_HIVEMIND_CONFIG,
      ...(options.config || {}),
    };
    this.connection = new HivemindConnection(this.config);
    this.adapter = new HivemindAdapter(this.conversationId);
    this.onStreamEvent = options.onStreamEvent;
  }

  async start(): Promise<boolean> {
    return this.connection.checkHealth();
  }

  private emitProviderStatus(msgId: string, provider: string | null, summary: StreamSummary = {}, requestedProvider?: string | null, totalTokens?: number): void {
    const backend = provider || requestedProvider || this.config.defaultProvider || 'hivemind';
    this.onStreamEvent({
      type: 'agent_status',
      conversation_id: this.conversationId,
      msg_id: msgId,
      data: {
        backend,
        status: 'session_active',
        requestedProvider: requestedProvider ?? null,
        cached: summary.cached,
        latencyMs: summary.latencyMs,
        totalTokens: totalTokens ?? null,
      },
    });
  }

  async send(message: string, provider?: string | null, files?: string[]): Promise<void> {
    const responseMsgId = `${this.id}:${uuid(8)}`;
    const requestedProvider = provider ?? this.config.defaultProvider ?? null;

    this.onStreamEvent(this.adapter.createStart(responseMsgId));

    if (this.config.streaming) {
      let streamError: Error | null = null;
      let discoveredProvider: string | null = null;
      let totalTokens = 0;

      await this.connection.askStream(
        message,
        {
          onChunk: (chunk) => {
            if (chunk.provider && chunk.provider !== discoveredProvider) {
              discoveredProvider = chunk.provider;
              this.emitProviderStatus(responseMsgId, chunk.provider, {}, requestedProvider);
            }

            if (typeof chunk.tokens_used === 'number' && chunk.tokens_used > 0) {
              totalTokens += chunk.tokens_used;
            }

            if (chunk.thinking) {
              this.onStreamEvent({
                type: 'thought',
                conversation_id: this.conversationId,
                msg_id: responseMsgId,
                data: { subject: 'Thinking', description: chunk.thinking },
              });
            }

            const streamMessage = this.adapter.fromStreamChunk(responseMsgId, chunk);
            if (streamMessage) {
              this.onStreamEvent(streamMessage);
            }
          },
          onDone: (_fullResponse, finalProvider, summary) => {
            this.emitProviderStatus(responseMsgId, finalProvider || discoveredProvider, summary, requestedProvider, totalTokens);
          },
          onError: (error) => {
            streamError = error;
          },
        },
        provider,
        files
      );

      if (streamError) {
        this.onStreamEvent(this.adapter.createContent(responseMsgId, `\n\n---\n⚠️ Stream interrupted: ${streamError.message}`));
      }
      this.onStreamEvent(this.adapter.createFinish(responseMsgId));
      return;
    }

    try {
      const askResponse = await this.connection.ask(message, provider, files);
      this.emitProviderStatus(
        responseMsgId,
        askResponse.provider || requestedProvider,
        {
          cached: askResponse.cached,
          latencyMs: askResponse.latency_ms ?? null,
        },
        requestedProvider
      );
      if (askResponse.thinking) {
        this.onStreamEvent({
          type: 'thought',
          conversation_id: this.conversationId,
          msg_id: responseMsgId,
          data: { subject: 'Thinking', description: askResponse.thinking },
        });
      }

      const messages = this.adapter.fromAskResponse(responseMsgId, askResponse);
      messages.forEach((msg) => this.onStreamEvent(msg));
    } catch (error) {
      const normalized = error instanceof Error ? error.message : String(error);
      this.onStreamEvent(this.adapter.createError(responseMsgId, normalized));
    } finally {
      this.onStreamEvent(this.adapter.createFinish(responseMsgId));
    }
  }

  stop(): void {
    this.connection.stop();
  }

  updateConfig(config: Partial<HivemindConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    this.connection.updateConfig(this.config);
  }
}
