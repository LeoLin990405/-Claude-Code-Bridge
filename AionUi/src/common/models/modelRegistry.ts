/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * HiveMind 模型注册表
 * Model Registry for HiveMind system
 *
 * 集中管理所有 Provider 的可用模型配置
 * Centrally manages all available models for each provider
 */

import type { ProviderModels, ModelConfig } from '@/types/acpTypes';

/**
 * Codex (OpenAI) 模型配置
 */
const codexModels: ModelConfig[] = [
  {
    id: 'o3',
    displayName: 'o3 - 深度推理',
    description: '最强推理能力，适合复杂算法和数学证明',
    isDefault: true,
    capabilities: ['reasoning', 'code', 'math'],
    estimatedResponseTime: 120,
    isPaid: true,
    speedTier: 'slow',
  },
  {
    id: 'o4-mini',
    displayName: 'o4-mini - 快速推理',
    description: '快速推理模型，适合代码生成',
    capabilities: ['reasoning', 'code'],
    estimatedResponseTime: 30,
    isPaid: true,
    speedTier: 'medium',
  },
  {
    id: 'o3-mini',
    displayName: 'o3-mini - 轻量推理',
    description: '轻量级推理模型',
    capabilities: ['reasoning', 'code'],
    estimatedResponseTime: 45,
    isPaid: true,
    speedTier: 'medium',
  },
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o - 多模态',
    description: '支持图像分析的多模态模型',
    capabilities: ['code', 'image', 'multimodal'],
    estimatedResponseTime: 60,
    isPaid: true,
    speedTier: 'medium',
  },
  {
    id: 'o1-pro',
    displayName: 'o1-pro - 专业版',
    description: '专业级推理模型',
    capabilities: ['reasoning', 'code'],
    estimatedResponseTime: 90,
    isPaid: true,
    speedTier: 'slow',
  },
];

/**
 * Gemini 模型配置
 */
const geminiModels: ModelConfig[] = [
  {
    id: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash - 快速',
    description: '最新 Gemini 3 快速版，前端开发首选',
    isDefault: true,
    capabilities: ['code', 'frontend', 'reasoning'],
    estimatedResponseTime: 90,
    isPaid: false,
    speedTier: 'slow',
  },
  {
    id: 'gemini-3-pro-preview',
    displayName: 'Gemini 3 Pro - 专业',
    description: '最新 Gemini 3 专业版，深度分析',
    capabilities: ['code', 'reasoning', 'analysis'],
    estimatedResponseTime: 150,
    isPaid: false,
    speedTier: 'slow',
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    description: 'Gemini 2.5 快速版',
    capabilities: ['code', 'reasoning'],
    estimatedResponseTime: 60,
    isPaid: false,
    speedTier: 'medium',
  },
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    description: 'Gemini 2.5 专业版',
    capabilities: ['code', 'reasoning'],
    estimatedResponseTime: 120,
    isPaid: false,
    speedTier: 'slow',
  },
];

/**
 * Kimi 模型配置
 */
const kimiModels: ModelConfig[] = [
  {
    id: 'kimi-normal',
    displayName: 'Kimi - 标准模式',
    description: '标准对话模式，快速响应',
    isDefault: true,
    capabilities: ['chinese', 'code', 'long-context'],
    estimatedResponseTime: 10,
    isPaid: false,
    speedTier: 'fast',
  },
  {
    id: 'kimi-thinking',
    displayName: 'Kimi - 思考模式',
    description: '启用思考链，提供详细推理过程',
    capabilities: ['chinese', 'reasoning', 'long-context'],
    estimatedResponseTime: 25,
    isPaid: false,
    speedTier: 'medium',
  },
];

/**
 * Qwen 模型配置
 */
const qwenModels: ModelConfig[] = [
  {
    id: 'qwen-coder',
    displayName: 'Qwen Coder',
    description: '代码专用模型，Python/SQL 能力强',
    isDefault: true,
    capabilities: ['code', 'chinese', 'data'],
    estimatedResponseTime: 12,
    isPaid: false,
    speedTier: 'fast',
  },
];

/**
 * DeepSeek 模型配置
 */
const deepseekModels: ModelConfig[] = [
  {
    id: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner - 推理',
    description: '深度推理模型，适合算法和逻辑分析',
    isDefault: true,
    capabilities: ['reasoning', 'code', 'math'],
    estimatedResponseTime: 45,
    isPaid: true,
    speedTier: 'medium',
  },
  {
    id: 'deepseek-chat',
    displayName: 'DeepSeek Chat - 对话',
    description: '快速对话模型',
    capabilities: ['code', 'chinese'],
    estimatedResponseTime: 20,
    isPaid: true,
    speedTier: 'medium',
  },
];

/**
 * iFlow 模型配置
 */
const iflowModels: ModelConfig[] = [
  {
    id: 'iflow-normal',
    displayName: 'iFlow - 标准模式',
    description: '工作流自动化标准模式',
    isDefault: true,
    capabilities: ['workflow', 'chinese'],
    estimatedResponseTime: 30,
    isPaid: false,
    speedTier: 'medium',
  },
  {
    id: 'iflow-thinking',
    displayName: 'iFlow - 思考模式',
    description: '启用思考链的工作流模式',
    capabilities: ['workflow', 'reasoning', 'chinese'],
    estimatedResponseTime: 60,
    isPaid: false,
    speedTier: 'medium',
  },
];

/**
 * OpenCode 模型配置
 */
const opencodeModels: ModelConfig[] = [
  {
    id: 'minimax-cn-coding-plan/MiniMax-M2.5',
    displayName: 'MiniMax M2.5 - 付费',
    description: 'MiniMax 付费模型，能力更强',
    isDefault: true,
    capabilities: ['code', 'chinese'],
    estimatedResponseTime: 30,
    isPaid: true,
    speedTier: 'medium',
  },
  {
    id: 'opencode/minimax-m2.5-free',
    displayName: 'MiniMax M2.5 - 免费',
    description: 'MiniMax 免费模型',
    capabilities: ['code', 'chinese'],
    estimatedResponseTime: 45,
    isPaid: false,
    speedTier: 'medium',
  },
  {
    id: 'opencode/kimi-k2.5-free',
    displayName: 'Kimi K2.5 - 免费',
    description: 'Kimi 免费模型',
    capabilities: ['code', 'chinese'],
    estimatedResponseTime: 50,
    isPaid: false,
    speedTier: 'medium',
  },
  {
    id: 'deepseek/deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    description: 'DeepSeek 推理模型 (via OpenCode)',
    capabilities: ['reasoning', 'code'],
    estimatedResponseTime: 60,
    isPaid: false,
    speedTier: 'medium',
  },
];

/**
 * Qoder 模型配置
 */
const qoderModels: ModelConfig[] = [
  {
    id: 'qoder-default',
    displayName: 'Qoder - 默认',
    description: 'Qoder 代码助手默认模型',
    isDefault: true,
    capabilities: ['code'],
    estimatedResponseTime: 40,
    isPaid: false,
    speedTier: 'medium',
  },
];

/**
 * Claude 模型配置
 */
const claudeModels: ModelConfig[] = [
  {
    id: 'claude-default',
    displayName: 'Claude - 默认',
    description: '另一个 Claude 实例',
    isDefault: true,
    capabilities: ['code', 'reasoning'],
    estimatedResponseTime: 120,
    isPaid: false,
    speedTier: 'slow',
  },
];

/**
 * Droid 模型配置
 */
const droidModels: ModelConfig[] = [
  {
    id: 'droid-default',
    displayName: 'Droid - 终端',
    description: '终端模式 AI 助手',
    isDefault: true,
    capabilities: ['terminal', 'automation'],
    estimatedResponseTime: 60,
    isPaid: false,
    speedTier: 'medium',
  },
];

/**
 * 完整的模型注册表
 * Complete model registry mapping each provider to its models
 */
export const MODEL_REGISTRY: ProviderModels[] = [
  {
    provider: 'codex',
    models: codexModels,
    defaultModelId: 'o3',
  },
  {
    provider: 'gemini',
    models: geminiModels,
    defaultModelId: 'gemini-3-flash-preview',
  },
  {
    provider: 'kimi',
    models: kimiModels,
    defaultModelId: 'kimi-normal',
  },
  {
    provider: 'qwen',
    models: qwenModels,
    defaultModelId: 'qwen-coder',
  },
  {
    provider: 'deepseek',
    models: deepseekModels,
    defaultModelId: 'deepseek-reasoner',
  },
  {
    provider: 'iflow',
    models: iflowModels,
    defaultModelId: 'iflow-normal',
  },
  {
    provider: 'opencode',
    models: opencodeModels,
    defaultModelId: 'minimax-cn-coding-plan/MiniMax-M2.5',
  },
  {
    provider: 'qoder',
    models: qoderModels,
    defaultModelId: 'qoder-default',
  },
  {
    provider: 'claude',
    models: claudeModels,
    defaultModelId: 'claude-default',
  },
  {
    provider: 'droid',
    models: droidModels,
    defaultModelId: 'droid-default',
  },
];

/**
 * 根据 Provider 名称获取模型列表
 * Get models by provider name
 */
export function getModelsByProvider(provider: string): ModelConfig[] {
  const providerModels = MODEL_REGISTRY.find((pm) => pm.provider === provider);
  return providerModels?.models || [];
}

/**
 * 根据 Provider 和 Model ID 获取模型配置
 * Get model config by provider and model ID
 */
export function getModelConfig(provider: string, modelId: string): ModelConfig | undefined {
  const models = getModelsByProvider(provider);
  return models.find((m) => m.id === modelId);
}

/**
 * 获取 Provider 的默认模型 ID
 * Get default model ID for a provider
 */
export function getDefaultModelId(provider: string): string | undefined {
  const providerModels = MODEL_REGISTRY.find((pm) => pm.provider === provider);
  return providerModels?.defaultModelId;
}

/**
 * 获取所有支持的 Provider 列表
 * Get all supported providers
 */
export function getAllProviders(): string[] {
  return MODEL_REGISTRY.map((pm) => pm.provider);
}
