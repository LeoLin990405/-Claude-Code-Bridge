/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Ollama 服务模块
 * 用于动态获取本地 Ollama 安装的模型列表
 */

import type { ModelConfig } from '@/types/acpTypes';

/**
 * Ollama API 响应类型
 */
interface OllamaApiResponse {
  models?: Array<{
    name?: string;
    model?: string;
    modified_at?: string;
    size?: number;
    digest?: string;
    details?: {
      format?: string;
      family?: string;
      families?: string[];
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

/**
 * Ollama 服务类
 * 用于与本地 Ollama API 交互
 */
export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * 获取 Ollama 已安装的模型列表
   */
  async listModels(): Promise<ModelConfig[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 秒超时
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaApiResponse;

      if (!data.models || !Array.isArray(data.models)) {
        return [];
      }

      return data.models
        .filter((m) => m.name)
        .map((m) => ({
          id: m.name!,
          displayName: this.formatModelName(m.name!),
          description: m.details?.parameter_size
            ? `${m.details.parameter_size} parameters`
            : undefined,
        }));
    } catch (err) {
      console.error('Failed to fetch Ollama models:', err);
      return [];
    }
  }

  /**
   * 格式化模型名称（美化显示）
   */
  private formatModelName(rawName: string): string {
    // llama3.1:latest -> Llama 3.1
    // codellama:13b -> Code Llama 13B
    const baseName = rawName.split(':')[0];
    const variant = rawName.split(':')[1];

    let formatted = baseName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    if (variant && variant !== 'latest') {
      formatted += ` ${variant.toUpperCase()}`;
    }

    return formatted;
  }

  /**
   * 检查 Ollama 服务是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// 导出单例
export const ollamaService = new OllamaService();
