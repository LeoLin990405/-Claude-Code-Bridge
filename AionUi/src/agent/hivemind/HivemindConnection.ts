/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AskRequest, AskResponse, HealthResponse, HivemindConfig, StreamChunk, StreamSummary } from './types';

function buildTimeoutAbort(timeoutMs: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timer),
  };
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }
  return fallback;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
}

function readStreamSummary(metadata: Record<string, unknown> | null): StreamSummary {
  if (!metadata) {
    return {};
  }

  const cached = toBoolean(metadata.cached);
  const latencyMs = toNumber(metadata.latency_ms) ?? toNumber(metadata.latencyMs);

  return {
    ...(cached === undefined ? {} : { cached }),
    ...(latencyMs === null ? {} : { latencyMs }),
  };
}

export class HivemindConnection {
  private config: HivemindConfig;
  private activeStreamAbort: AbortController | null = null;
  private lastRequestId: string | null = null;

  constructor(config: HivemindConfig) {
    this.config = config;
  }

  updateConfig(config: HivemindConfig): void {
    this.config = config;
  }

  async checkHealth(): Promise<boolean> {
    const timeout = buildTimeoutAbort(5000);
    try {
      const response = await fetch(`${this.config.gatewayUrl}/api/health`, {
        method: 'GET',
        signal: timeout.signal,
      });
      if (!response.ok) {
        return false;
      }
      const json = (await response.json()) as HealthResponse;
      return json.status === 'ok';
    } catch {
      return false;
    } finally {
      timeout.dispose();
    }
  }

  private isRetryableError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    if (err.name === 'AbortError') return false;

    const msg = err.message;

    if (msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || err.name === 'TypeError') {
      return true;
    }

    const httpMatch = msg.match(/(\d{3})/);
    if (httpMatch) {
      const code = Number.parseInt(httpMatch[1], 10);
      return code >= 500;
    }

    return false;
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (!this.isRetryableError(err) || attempt === maxRetries) {
          throw err;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw new Error('unreachable');
  }

  async ask(message: string, provider?: string | null, files?: string[]): Promise<AskResponse> {
    this.lastRequestId = null;
    const requestBody: AskRequest = {
      message,
      provider: provider ?? this.config.defaultProvider,
      timeout_s: this.config.timeoutS,
      cache_bypass: this.config.cacheBypass,
      agent: this.config.agent,
    };

    if (this.config.systemPrompt) {
      requestBody.system_prompt = this.config.systemPrompt;
    }

    if (files?.length) {
      requestBody.files = files;
    }

    const timeout = buildTimeoutAbort(Math.max(this.config.timeoutS, 1) * 1000 + 5000);
    try {
      const result = await this.withRetry(async () => {
        const response = await fetch(`${this.config.gatewayUrl}/api/ask?wait=true&timeout=${this.config.timeoutS}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: timeout.signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => response.statusText);
          const detail = extractErrorMessage(errorBody, response.statusText);
          throw new Error(`Hivemind ask failed: ${response.status} ${detail}`);
        }

        return (await response.json()) as AskResponse;
      });

      this.lastRequestId = result.request_id;
      return result;
    } finally {
      timeout.dispose();
    }
  }

  async askStream(
    message: string,
    callbacks: {
      onChunk: (chunk: StreamChunk) => void;
      onDone: (fullResponse: string, provider: string | null, summary: StreamSummary) => void;
      onError: (error: Error) => void;
    },
    provider?: string | null,
    files?: string[]
  ): Promise<void> {
    this.stop();
    this.lastRequestId = null;

    this.activeStreamAbort = new AbortController();
    const requestBody: AskRequest = {
      message,
      provider: provider ?? this.config.defaultProvider,
      timeout_s: this.config.timeoutS,
      cache_bypass: this.config.cacheBypass,
      agent: this.config.agent,
    };

    if (this.config.systemPrompt) {
      requestBody.system_prompt = this.config.systemPrompt;
    }

    if (files?.length) {
      requestBody.files = files;
    }

    try {
      const response = await fetch(`${this.config.gatewayUrl}/api/ask/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: this.activeStreamAbort.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => response.statusText);
        const detail = extractErrorMessage(errorBody, response.statusText);
        throw new Error(`Hivemind stream failed: ${response.status} ${detail}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Hivemind stream has no body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let finalProvider: string | null = null;
      let finalMetadata: Record<string, unknown> | null = null;

      while (true) {
        const result = await reader.read();
        if (result.done) {
          break;
        }

        buffer += decoder.decode(result.value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventBlock of events) {
          const dataLines = eventBlock
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());

          if (!dataLines.length) {
            continue;
          }

          const eventPayload = dataLines.join('\n');
          if (!eventPayload || eventPayload === '[DONE]') {
            continue;
          }

          let parsed: StreamChunk;
          try {
            parsed = JSON.parse(eventPayload) as StreamChunk;
          } catch {
            continue;
          }

          if (parsed.request_id && !this.lastRequestId) {
            this.lastRequestId = parsed.request_id;
          }

          callbacks.onChunk(parsed);

          if (parsed.content) {
            fullResponse += parsed.content;
          }
          if (parsed.provider) {
            finalProvider = parsed.provider;
          }
          if (parsed.metadata && typeof parsed.metadata === 'object') {
            finalMetadata = parsed.metadata;
          }
        }
      }

      callbacks.onDone(fullResponse, finalProvider, readStreamSummary(finalMetadata));
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (normalized.name === 'AbortError' || /aborted/i.test(normalized.message)) {
        return;
      }
      callbacks.onError(normalized);
    } finally {
      this.activeStreamAbort = null;
      // Do not clear lastRequestId here; stop() may still need it to cancel.
      // It will be cleared in stop() or reset at the start of the next ask/askStream call.
    }
  }

  stop(): void {
    if (this.activeStreamAbort) {
      this.activeStreamAbort.abort();
      this.activeStreamAbort = null;
    }

    if (this.lastRequestId) {
      const requestId = this.lastRequestId;
      this.lastRequestId = null;
      fetch(`${this.config.gatewayUrl}/api/cancel/${requestId}`, {
        method: 'POST',
      }).catch(() => {});
    }
  }
}
