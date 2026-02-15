/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { notebookLMBrowserAutomationService } from '../services/notebooklm/BrowserAutomationService';

export function initNotebookLMBridge(): void {
  ipcBridge.notebooklmAutomation.status.provider(async () => {
    return notebookLMBrowserAutomationService.getStatus();
  });

  ipcBridge.notebooklmAutomation.ensureAuth.provider(async ({ interactive = true, timeoutMs }) => {
    return notebookLMBrowserAutomationService.ensureAuthenticated({ interactive, timeoutMs });
  });

  ipcBridge.notebooklmAutomation.openNotebook.provider(async ({ notebookId, interactive = true }) => {
    return notebookLMBrowserAutomationService.openNotebook({ notebookId, interactive });
  });

  ipcBridge.notebooklmAutomation.query.provider(async ({ question, notebookId, interactive = false }) => {
    return notebookLMBrowserAutomationService.query({
      question,
      notebookId,
      interactive,
    });
  });
}
