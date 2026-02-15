/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { ipcBridge } from '../../common';
import { dailySyncService } from '../services/obsidian/DailySyncService';

const execAsync = promisify(exec);

export function initObsidianBridge(): void {
  /**
   * Open a note in Obsidian using obsidian-cli
   */
  ipcBridge.obsidian.open.provider(async ({ vault, path }) => {
    try {
      const command = `obsidian-cli open --vault "${vault}" --path "${path}"`;
      await execAsync(command);
      return { success: true };
    } catch (error: any) {
      console.error('[ObsidianBridge] Failed to open note:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Search content in Obsidian vault using obsidian-cli
   */
  ipcBridge.obsidian.searchContent.provider(async ({ vault, query, limit = 50 }) => {
    try {
      const command = `obsidian-cli search-content --vault "${vault}" --query "${query}"`;
      const { stdout } = await execAsync(command);

      // Parse the output (assuming it's line-separated file paths)
      const results = stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim() !== '')
        .slice(0, limit)
        .map((filePath) => ({ path: filePath }));

      return { success: true, results };
    } catch (error: any) {
      console.error('[ObsidianBridge] Search failed:', error);
      return { success: false, error: error.message, results: [] };
    }
  });

  /**
   * Move/rename a note in Obsidian vault using obsidian-cli
   * This automatically updates all links
   */
  ipcBridge.obsidian.move.provider(async ({ vault, oldPath, newPath }) => {
    try {
      const command = `obsidian-cli move --vault "${vault}" "${oldPath}" "${newPath}"`;
      await execAsync(command);
      return { success: true };
    } catch (error: any) {
      console.error('[ObsidianBridge] Failed to move note:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Create or open a daily note
   */
  ipcBridge.obsidian.daily.provider(async ({ vault, append }) => {
    try {
      let command = `obsidian-cli daily --vault "${vault}"`;
      if (append) {
        command += ` --append "${append.replace(/"/g, '\\"')}"`;
      }
      await execAsync(command);
      return { success: true };
    } catch (error: any) {
      console.error('[ObsidianBridge] Failed to access daily note:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Set frontmatter metadata on a note
   */
  ipcBridge.obsidian.setFrontmatter.provider(async ({ vault, path, key, value }) => {
    try {
      const command = `obsidian-cli frontmatter set --vault "${vault}" --path "${path}" --key "${key}" --value "${value}"`;
      await execAsync(command);
      return { success: true };
    } catch (error: any) {
      console.error('[ObsidianBridge] Failed to set frontmatter:', error);
      return { success: false, error: error.message };
    }
  });

  // Daily sync status and manual trigger
  ipcBridge.obsidianDailySync.status.provider(async () => {
    return dailySyncService.getStatus();
  });

  ipcBridge.obsidianDailySync.runNow.provider(async () => {
    return dailySyncService.runNow();
  });
}
