/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';

// Force node-gyp-build to skip build/ directory and use prebuilds/ only in production
// This prevents loading wrong architecture binaries from development environment
// Only apply in packaged app to allow development builds to use build/Release/
if (app.isPackaged) {
  process.env.PREBUILDS_ONLY = '1';
}
import initStorage from './initStorage';
import './initBridge';
import './i18n'; // Initialize i18n for main process
import { dailySyncService } from './services/obsidian/DailySyncService';
import { getChannelManager } from '@/channels';

export const initializeProcess = async () => {
  await initStorage();

  // Initialize Daily Sync scheduler for Obsidian
  try {
    await dailySyncService.init();
  } catch (error) {
    console.error('[Process] Failed to initialize DailySyncService:', error);
  }

  // Initialize Channel subsystem
  try {
    await getChannelManager().initialize();
  } catch (error) {
    console.error('[Process] Failed to initialize ChannelManager:', error);
    // Don't fail app startup if channel fails to initialize
  }
};
