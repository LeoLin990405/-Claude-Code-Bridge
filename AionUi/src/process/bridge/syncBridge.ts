/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ISkillToolMappingView } from '@/common/ipcBridge';
import { syncService } from '@process/services/skills';

const ok = <T>(data?: T) => ({ success: true, data });
const fail = (msg: string) => ({ success: false, msg });

export function initSyncBridge(): void {
  ipcBridge.sync.executeAll.provider(async () => {
    try {
      const results = await syncService.executeAll();
      return ok(results);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.sync.executeOne.provider(async ({ skill_id, tool_id }) => {
    try {
      const result = await syncService.executeOne(skill_id, tool_id);
      return ok(result);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.sync.unsync.provider(async ({ skill_id, tool_id }) => {
    try {
      await syncService.unsync(skill_id, tool_id);
      return ok({ success: true });
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.sync.status.provider(async () => {
    try {
      return ok(syncService.status());
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.sync.getMappingsForSkill.provider(async ({ skill_id }) => {
    try {
      const mappings = syncService.getMappingsForSkill(skill_id) as unknown as ISkillToolMappingView[];
      return ok(mappings);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.sync.setMappingEnabled.provider(async ({ skill_id, tool_id, enabled }) => {
    try {
      await syncService.setMappingEnabled(skill_id, tool_id, enabled);
      return ok({ success: true });
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });
}
