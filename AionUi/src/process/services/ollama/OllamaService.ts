import type { ModelConfig } from '@/types/acpTypes';

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

export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async listModels(): Promise<ModelConfig[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
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
          description: m.details?.parameter_size ? `${m.details.parameter_size} parameters` : undefined,
        }));
    } catch (err) {
      console.error('Failed to fetch Ollama models:', err);
      return [];
    }
  }

  private formatModelName(rawName: string): string {
    const baseName = rawName.split(':')[0];
    const variant = rawName.split(':')[1];

    let formatted = baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    if (variant && variant !== 'latest') {
      formatted += ` ${variant.toUpperCase()}`;
    }

    return formatted;
  }

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

export const ollamaService = new OllamaService();
