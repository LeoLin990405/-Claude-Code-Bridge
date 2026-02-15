/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { IAgentProvider, IProviderRunRequest, IProviderRunResult } from './types';

const execFileAsync = promisify(execFile);

const numberValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const getNested = (obj: Record<string, unknown>, path: string): unknown => {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
};

const pickNumber = (obj: Record<string, unknown>, paths: string[]): number => {
  for (const path of paths) {
    const value = getNested(obj, path);
    const asNumber = numberValue(value);
    if (asNumber > 0) {
      return asNumber;
    }
  }
  return 0;
};

export class CCBProvider implements IAgentProvider {
  readonly provider: string;
  readonly model: string;

  constructor(provider: string, model: string) {
    this.provider = provider;
    this.model = model;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await execFileAsync('ccb', ['status'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async run(request: IProviderRunRequest): Promise<IProviderRunResult> {
    try {
      const payload = JSON.stringify({
        provider: this.provider,
        model: this.model,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        metadata: request.metadata || {},
      });

      const { stdout } = await execFileAsync('ccb', ['opencode', payload], {
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024,
      });

      const parsed = this.parseOutput(stdout);
      return {
        provider: parsed.provider || this.provider,
        model: parsed.model || this.model,
        ...parsed,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        provider: this.provider,
        model: this.model,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        error: message,
      };
    }
  }

  private parseOutput(stdout: string): Omit<IProviderRunResult, 'provider' | 'model'> & { provider?: string; model?: string } {
    const text = stdout.trim();
    const parsedJson = this.tryParseJson(text);

    if (!parsedJson) {
      return {
        success: true,
        output: text,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
      };
    }

    const output = (typeof parsedJson.output === 'string' ? parsedJson.output : null) || (typeof parsedJson.content === 'string' ? parsedJson.content : null) || (typeof parsedJson.text === 'string' ? parsedJson.text : null) || '';

    const error = (typeof parsedJson.error === 'string' ? parsedJson.error : null) || (typeof parsedJson.message === 'string' && parsedJson.success === false ? parsedJson.message : null) || undefined;

    const success = parsedJson.success !== false && !error;

    return {
      success,
      output,
      input_tokens: pickNumber(parsedJson, ['input_tokens', 'inputTokens', 'prompt_tokens', 'promptTokens', 'usage.input_tokens', 'usage.prompt_tokens']),
      output_tokens: pickNumber(parsedJson, ['output_tokens', 'outputTokens', 'completion_tokens', 'completionTokens', 'usage.output_tokens', 'usage.completion_tokens']),
      cost_usd: pickNumber(parsedJson, ['cost_usd', 'costUSD', 'cost', 'usage.cost_usd', 'usage.cost']),
      error,
      raw: parsedJson,
      provider: typeof parsedJson.provider === 'string' ? parsedJson.provider : undefined,
      model: typeof parsedJson.model === 'string' ? parsedJson.model : undefined,
    };
  }

  private tryParseJson(text: string): Record<string, unknown> | null {
    const candidates = [
      text,
      ...text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .reverse(),
    ];

    for (const candidate of candidates) {
      if (!candidate.startsWith('{') || !candidate.endsWith('}')) {
        continue;
      }

      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // ignore invalid candidate
      }
    }

    return null;
  }
}
