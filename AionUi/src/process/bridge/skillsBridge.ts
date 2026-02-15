/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ISkill, ISkillDetail, ISkillToolMappingView } from '@/common/ipcBridge';
import { skillsService, syncService } from '@process/services/skills';

const ok = <T>(data?: T) => ({ success: true, data });
const fail = (msg: string) => ({ success: false, msg });

const getEnabledTools = (skillId: string): string[] => {
  const mappings = syncService.getMappingsForSkill(skillId);
  return mappings.filter((row) => row.enabled).map((row) => row.tool_id);
};

export function initSkillsBridge(): void {
  ipcBridge.skills.list.provider(async ({ category } = {}) => {
    try {
      const skills = skillsService.listSkills({ category });
      return ok(skills as ISkill[]);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.skills.get.provider(async ({ id }) => {
    try {
      const skill = skillsService.getSkillById(id);
      if (!skill) {
        return fail('Skill not found');
      }

      const detail: ISkillDetail = {
        ...(skill as any),
        enabled_tools: getEnabledTools(skill.id),
      };

      return ok(detail);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.skills.create.provider(async (params) => {
    try {
      await skillsService.ensureRootDir();
      const skill = await skillsService.createSkill({
        name: params.name,
        category: params.category,
        description: params.description,
        content: params.content,
        manifest: params.manifest,
        tags: params.tags,
      });

      const tools = syncService.listTools();
      const enabledTools = new Set(params.enabled_tools || []);
      for (const tool of tools) {
        await syncService.setMappingEnabled(skill.id, tool.id, enabledTools.has(tool.id));
      }

      const detail: ISkillDetail = {
        ...(skill as any),
        enabled_tools: getEnabledTools(skill.id),
      };

      return ok(detail);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.skills.update.provider(async ({ id, updates }) => {
    try {
      const skill = await skillsService.updateSkill(id, {
        description: updates.description,
        content: updates.content,
        manifest: updates.manifest,
        tags: updates.tags,
      });

      if (updates.enabled_tools) {
        const tools = syncService.listTools();
        const enabledTools = new Set(updates.enabled_tools);
        for (const tool of tools) {
          await syncService.setMappingEnabled(skill.id, tool.id, enabledTools.has(tool.id));
        }
      }

      const detail: ISkillDetail = {
        ...(skill as any),
        enabled_tools: getEnabledTools(skill.id),
      };

      return ok(detail);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.skills.delete.provider(async ({ id }) => {
    try {
      const mappings: ISkillToolMappingView[] = syncService.getMappingsForSkill(id) as any;
      for (const mapping of mappings) {
        if (mapping.symlink_path) {
          await syncService.unsync(id, mapping.tool_id);
        }
      }

      await skillsService.deleteSkill(id);
      return ok({ success: true });
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });
}
