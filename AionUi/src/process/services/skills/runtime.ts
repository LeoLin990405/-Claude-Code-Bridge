/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from '@process/database';
import { AIToolDetector } from './AIToolDetector';
import { getSkillsRootPath } from './pathUtils';
import { SkillsService } from './SkillsService';
import { SymlinkManager } from './SymlinkManager';
import { SyncService } from './SyncService';

const nativeDb = getDatabase().getNativeDatabase();
const skillsRootPath = getSkillsRootPath();

export const skillsService = new SkillsService(nativeDb, skillsRootPath);
export const toolDetector = new AIToolDetector();
export const symlinkManager = new SymlinkManager();
export const syncService = new SyncService(nativeDb, skillsService.getRootPath(), symlinkManager);
