/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IAITool, ISkill, ISkillDetail, ISkillToolMappingView, ISyncResult } from '@/common/ipcBridge';

const ensureSuccess = <T>(response: { success: boolean; data?: T; msg?: string }, fallbackMessage: string): T => {
  if (!response.success || response.data === undefined) {
    throw new Error(response.msg || fallbackMessage);
  }
  return response.data;
};

export const skillsApi = {
  listSkills: async (category?: string): Promise<ISkill[]> => {
    const response = await ipcBridge.skills.list.invoke(category ? { category } : {});
    return ensureSuccess(response, 'Failed to load skills');
  },

  getSkill: async (id: string): Promise<ISkillDetail> => {
    const response = await ipcBridge.skills.get.invoke({ id });
    return ensureSuccess(response, 'Failed to load skill');
  },

  createSkill: async (payload: { name: string; category: string; description?: string; content: string; manifest?: Record<string, unknown>; enabled_tools?: string[]; tags?: string[] }): Promise<ISkillDetail> => {
    const response = await ipcBridge.skills.create.invoke(payload);
    return ensureSuccess(response, 'Failed to create skill');
  },

  updateSkill: async (id: string, updates: { description?: string | null; content?: string; manifest?: Record<string, unknown> | null; enabled_tools?: string[]; tags?: string[] }): Promise<ISkillDetail> => {
    const response = await ipcBridge.skills.update.invoke({ id, updates });
    return ensureSuccess(response, 'Failed to update skill');
  },

  deleteSkill: async (id: string): Promise<void> => {
    const response = await ipcBridge.skills.delete.invoke({ id });
    ensureSuccess(response, 'Failed to delete skill');
  },

  detectTools: async (): Promise<IAITool[]> => {
    const response = await ipcBridge.tools.detect.invoke(undefined as any);
    return ensureSuccess(response, 'Failed to detect tools');
  },

  listTools: async (): Promise<IAITool[]> => {
    const response = await ipcBridge.tools.list.invoke(undefined as any);
    return ensureSuccess(response, 'Failed to load tools');
  },

  setToolEnabled: async (toolId: string, enabled: boolean): Promise<void> => {
    const response = await ipcBridge.tools.setEnabled.invoke({ tool_id: toolId, enabled });
    ensureSuccess(response, 'Failed to update tool setting');
  },

  addTool: async (payload: { name: string; display_name?: string; skills_path: string; config_path?: string }): Promise<IAITool> => {
    const response = await ipcBridge.tools.add.invoke(payload);
    return ensureSuccess(response, 'Failed to add tool');
  },

  syncAll: async (): Promise<ISyncResult[]> => {
    const response = await ipcBridge.sync.executeAll.invoke(undefined as any);
    return ensureSuccess(response, 'Failed to sync all');
  },

  syncOne: async (skillId: string, toolId: string): Promise<ISyncResult> => {
    const response = await ipcBridge.sync.executeOne.invoke({ skill_id: skillId, tool_id: toolId });
    return ensureSuccess(response, 'Failed to sync');
  },

  unsync: async (skillId: string, toolId: string): Promise<void> => {
    const response = await ipcBridge.sync.unsync.invoke({ skill_id: skillId, tool_id: toolId });
    ensureSuccess(response, 'Failed to unsync');
  },

  syncStatus: async (): Promise<{ totalSkills: number; syncedSkills: number; errors: number }> => {
    const response = await ipcBridge.sync.status.invoke(undefined as any);
    return ensureSuccess(response, 'Failed to load sync status');
  },

  getMappingsForSkill: async (skillId: string): Promise<ISkillToolMappingView[]> => {
    const response = await ipcBridge.sync.getMappingsForSkill.invoke({ skill_id: skillId });
    return ensureSuccess(response, 'Failed to load mappings');
  },

  setMappingEnabled: async (skillId: string, toolId: string, enabled: boolean): Promise<void> => {
    const response = await ipcBridge.sync.setMappingEnabled.invoke({ skill_id: skillId, tool_id: toolId, enabled });
    ensureSuccess(response, 'Failed to update mapping');
  },
};
