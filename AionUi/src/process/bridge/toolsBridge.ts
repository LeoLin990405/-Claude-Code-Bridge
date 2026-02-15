/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getDatabase } from '@process/database';
import { toolDetector } from '@process/services/skills';
import type { IAITool } from '@/common/ipcBridge';

const ok = <T>(data?: T) => ({ success: true, data });
const fail = (msg: string) => ({ success: false, msg });

const createId = (): string => `tool_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export function initToolsBridge(): void {
  const db = getDatabase().getNativeDatabase();

  ipcBridge.tools.list.provider(async () => {
    try {
      const rows = db.prepare('SELECT * FROM ai_tools ORDER BY name ASC').all() as any[];
      return ok(rows as IAITool[]);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.tools.detect.provider(async () => {
    try {
      const detected = await toolDetector.detectAll();
      const now = Date.now();

      for (const tool of detected) {
        db.prepare(
          `
          UPDATE ai_tools
          SET detected = ?, last_detected_at = ?, updated_at = ?
          WHERE id = ?
        `
        ).run(tool.detected, now, now, tool.id);
      }

      const rows = db.prepare('SELECT * FROM ai_tools ORDER BY name ASC').all() as any[];
      return ok(rows as IAITool[]);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.tools.setEnabled.provider(async ({ tool_id, enabled }) => {
    try {
      db.prepare('UPDATE ai_tools SET enabled = ?, updated_at = ? WHERE id = ?').run(enabled ? 1 : 0, Date.now(), tool_id);
      return ok({ success: true });
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });

  ipcBridge.tools.add.provider(async ({ name, display_name, skills_path, config_path }) => {
    try {
      const id = createId();
      const now = Date.now();
      db.prepare(
        `
        INSERT INTO ai_tools (
          id, name, type, display_name, skills_path, config_path, icon_url,
          enabled, detected, last_detected_at, created_at, updated_at
        ) VALUES (?, ?, 'custom', ?, ?, ?, NULL, 1, 0, NULL, ?, ?)
      `
      ).run(id, name, display_name || name, skills_path, config_path || null, now, now);

      const row = db.prepare('SELECT * FROM ai_tools WHERE id = ?').get(id) as any;
      return ok(row as IAITool);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  });
}
