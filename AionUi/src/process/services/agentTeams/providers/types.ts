/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IProviderRunRequest {
  prompt: string;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
}

export interface IProviderRunResult {
  success: boolean;
  provider: string;
  model: string;
  output?: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  error?: string;
  raw?: unknown;
}

export interface IAgentProvider {
  readonly provider: string;
  readonly model: string;
  healthCheck(): Promise<boolean>;
  run(request: IProviderRunRequest): Promise<IProviderRunResult>;
}
