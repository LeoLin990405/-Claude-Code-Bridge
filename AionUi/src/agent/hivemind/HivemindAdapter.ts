/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IResponseMessage } from '@/common/ipcBridge';
import type { AskResponse, StreamChunk } from './types';

export class HivemindAdapter {
  private conversationId: string;

  constructor(conversationId: string) {
    this.conversationId = conversationId;
  }

  createStart(msgId: string): IResponseMessage {
    return {
      type: 'start',
      conversation_id: this.conversationId,
      msg_id: msgId,
      data: null,
    };
  }

  createFinish(msgId: string): IResponseMessage {
    return {
      type: 'finish',
      conversation_id: this.conversationId,
      msg_id: msgId,
      data: null,
    };
  }

  createContent(msgId: string, content: string): IResponseMessage {
    return {
      type: 'content',
      conversation_id: this.conversationId,
      msg_id: msgId,
      data: content,
    };
  }

  createError(msgId: string, errorMessage: string): IResponseMessage {
    return {
      type: 'error',
      conversation_id: this.conversationId,
      msg_id: msgId,
      data: errorMessage,
    };
  }

  fromAskResponse(msgId: string, response: AskResponse): IResponseMessage[] {
    const messages: IResponseMessage[] = [];

    if (response.error) {
      messages.push(this.createError(msgId, response.error));
    }

    if (response.response) {
      messages.push(this.createContent(msgId, response.response));
    }

    return messages;
  }

  fromStreamChunk(msgId: string, chunk: StreamChunk): IResponseMessage | null {
    if (!chunk.content) {
      return null;
    }

    return this.createContent(msgId, chunk.content);
  }
}

