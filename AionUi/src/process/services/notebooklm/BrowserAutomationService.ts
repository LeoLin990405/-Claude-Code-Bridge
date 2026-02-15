/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

export interface NotebookLMAutomationStatus {
  available: boolean;
  installed: boolean;
  initialized: boolean;
  authenticated: boolean;
  headless: boolean;
  currentUrl?: string;
  lastError?: string;
}

export interface NotebookLMAutomationAuthResult {
  success: boolean;
  authenticated: boolean;
  url?: string;
  requiresInteractive?: boolean;
  message?: string;
  error?: string;
}

export interface NotebookLMAutomationQueryResult {
  success: boolean;
  answer?: string;
  notebookId?: string;
  references: Array<{ title?: string; url?: string }>;
  requiresInteractive?: boolean;
  url?: string;
  error?: string;
}

type NotebookLMBrowserModule = {
  chromium: {
    launch: (options?: Record<string, unknown>) => Promise<any>;
  };
};

const NOTEBOOKLM_HOME = 'https://notebooklm.google.com/';

class BrowserAutomationService {
  private browser: any | null = null;
  private context: any | null = null;
  private page: any | null = null;
  private playwright: NotebookLMBrowserModule | null = null;
  private initialized = false;
  private headless = true;
  private lastError: string | undefined;

  private get stateDir(): string {
    return path.join(app.getPath('userData'), 'notebooklm-automation');
  }

  private get storageStatePath(): string {
    return path.join(this.stateDir, 'storage-state.json');
  }

  private async loadPlaywright(): Promise<NotebookLMBrowserModule | null> {
    if (this.playwright) {
      return this.playwright;
    }

    try {
      const loaded = (await import('playwright')) as NotebookLMBrowserModule;
      this.playwright = loaded;
      return loaded;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  private async ensureStateDir(): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
  }

  private async loadStorageState(): Promise<string | undefined> {
    try {
      await fs.access(this.storageStatePath);
      return this.storageStatePath;
    } catch {
      return undefined;
    }
  }

  private async saveStorageState(): Promise<void> {
    if (!this.context) {
      return;
    }

    await this.ensureStateDir();
    await this.context.storageState({ path: this.storageStatePath });
  }

  private async initBrowser(options?: { headless?: boolean; forceRelaunch?: boolean }): Promise<void> {
    const nextHeadless = options?.headless ?? this.headless;
    const forceRelaunch = options?.forceRelaunch ?? false;

    if (this.initialized && !forceRelaunch && this.browser && this.context && this.page && this.headless === nextHeadless) {
      return;
    }

    const playwright = await this.loadPlaywright();
    if (!playwright) {
      throw new Error('Playwright is not installed. Run `npm install playwright` in HiveMind.');
    }

    await this.shutdown();
    await this.ensureStateDir();

    const storageState = await this.loadStorageState();

    this.browser = await playwright.chromium.launch({
      headless: nextHeadless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    this.context = await this.browser.newContext({
      storageState,
      viewport: { width: 1440, height: 900 },
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(30000);

    this.headless = nextHeadless;
    this.initialized = true;
    this.lastError = undefined;
  }

  private async ensurePageAt(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('NotebookLM browser page is not initialized');
    }

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  private async detectAuthenticated(): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    const currentUrl = this.page.url() || '';
    if (currentUrl.includes('accounts.google.com')) {
      return false;
    }

    if (!currentUrl.includes('notebooklm.google.com')) {
      return false;
    }

    const signInVisible = await this.page
      .locator('text=/sign in/i')
      .first()
      .isVisible({ timeout: 800 })
      .catch(() => false);

    return !signInVisible;
  }

  private getNotebookUrl(notebookId?: string): string {
    if (!notebookId) {
      return NOTEBOOKLM_HOME;
    }
    return `${NOTEBOOKLM_HOME}notebook/${encodeURIComponent(notebookId)}`;
  }

  private async findQuestionInput(): Promise<any | null> {
    if (!this.page) {
      return null;
    }

    const selectors = ['textarea[placeholder*="Ask"]', 'textarea[aria-label*="Ask"]', 'textarea', '[contenteditable="true"]'];

    for (const selector of selectors) {
      const locator = this.page.locator(selector).first();
      const visible = await locator.isVisible({ timeout: 1200 }).catch(() => false);
      if (visible) {
        return locator;
      }
    }

    return null;
  }

  private async readAnswerFallback(): Promise<string | undefined> {
    if (!this.page) {
      return undefined;
    }

    const selectors = ['main [data-testid="answer"]', 'main article:last-child', 'main [role="article"]:last-child', 'main div[aria-live="polite"]'];

    for (const selector of selectors) {
      const text = await this.page
        .locator(selector)
        .first()
        .innerText({ timeout: 4000 })
        .catch(() => '');
      if (text?.trim()) {
        return text.trim();
      }
    }

    const mainText = await this.page
      .locator('main')
      .first()
      .innerText({ timeout: 2000 })
      .catch(() => '');

    if (!mainText?.trim()) {
      return undefined;
    }

    return mainText.slice(-2400).trim();
  }

  async getStatus(): Promise<NotebookLMAutomationStatus> {
    const installed = !!this.loadPlaywright();
    let authenticated = false;

    if (this.page) {
      authenticated = await this.detectAuthenticated();
    } else {
      const storageExists = await this.loadStorageState();
      authenticated = Boolean(storageExists);
    }

    return {
      available: installed,
      installed,
      initialized: this.initialized,
      authenticated,
      headless: this.headless,
      currentUrl: this.page?.url(),
      lastError: this.lastError,
    };
  }

  async ensureAuthenticated(options?: { interactive?: boolean; timeoutMs?: number }): Promise<NotebookLMAutomationAuthResult> {
    try {
      const interactive = options?.interactive ?? true;
      const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000;

      await this.initBrowser({ headless: !interactive, forceRelaunch: interactive && this.headless });
      await this.ensurePageAt(NOTEBOOKLM_HOME);

      const alreadyAuthenticated = await this.detectAuthenticated();
      if (alreadyAuthenticated) {
        await this.saveStorageState();
        return {
          success: true,
          authenticated: true,
          url: this.page?.url(),
          message: 'NotebookLM authentication is ready.',
        };
      }

      if (!interactive) {
        return {
          success: false,
          authenticated: false,
          requiresInteractive: true,
          url: this.page?.url(),
          error: 'NotebookLM authentication required. Please run interactive auth once.',
        };
      }

      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const authenticated = await this.detectAuthenticated();
        if (authenticated) {
          await this.saveStorageState();
          return {
            success: true,
            authenticated: true,
            url: this.page?.url(),
            message: 'NotebookLM authentication completed.',
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      return {
        success: false,
        authenticated: false,
        requiresInteractive: true,
        url: this.page?.url(),
        error: 'Authentication timed out. Keep browser open and try again.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      return {
        success: false,
        authenticated: false,
        error: message,
      };
    }
  }

  async openNotebook(options?: { notebookId?: string; interactive?: boolean }): Promise<NotebookLMAutomationAuthResult> {
    try {
      const interactive = options?.interactive ?? true;
      await this.initBrowser({ headless: !interactive, forceRelaunch: interactive && this.headless });
      await this.ensurePageAt(this.getNotebookUrl(options?.notebookId));

      const authenticated = await this.detectAuthenticated();
      if (authenticated) {
        await this.saveStorageState();
      }

      return {
        success: true,
        authenticated,
        url: this.page?.url(),
        requiresInteractive: !authenticated,
        message: authenticated ? 'Notebook opened successfully.' : 'Opened NotebookLM. Please sign in first.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      return {
        success: false,
        authenticated: false,
        error: message,
      };
    }
  }

  async query(params: { question: string; notebookId?: string; interactive?: boolean }): Promise<NotebookLMAutomationQueryResult> {
    const question = params.question?.trim();
    if (!question) {
      return {
        success: false,
        references: [],
        error: 'Question cannot be empty.',
      };
    }

    try {
      const interactive = params.interactive ?? false;
      await this.initBrowser({ headless: !interactive, forceRelaunch: interactive && this.headless });
      await this.ensurePageAt(this.getNotebookUrl(params.notebookId));

      const authenticated = await this.detectAuthenticated();
      if (!authenticated) {
        return {
          success: false,
          references: [],
          requiresInteractive: true,
          url: this.page?.url(),
          error: 'NotebookLM authentication required before querying.',
        };
      }

      const input = await this.findQuestionInput();
      if (!input) {
        return {
          success: false,
          references: [],
          url: this.page?.url(),
          error: 'Cannot locate NotebookLM input box. UI may have changed.',
        };
      }

      const usesContentEditable = await input.evaluate((el: Element) => el.getAttribute('contenteditable') === 'true').catch(() => false);

      if (usesContentEditable) {
        await input.click();
        await this.page?.keyboard.press('Meta+A').catch(async () => this.page?.keyboard.press('Control+A'));
        await this.page?.keyboard.type(question);
        await this.page?.keyboard.press('Enter');
      } else {
        await input.fill(question);
        await input.press('Enter');
      }

      await this.page?.waitForTimeout(4500);
      const answer = await this.readAnswerFallback();

      if (!answer) {
        return {
          success: false,
          references: [],
          url: this.page?.url(),
          notebookId: params.notebookId,
          error: 'Question sent but answer extraction failed. Open interactive mode for manual verification.',
        };
      }

      await this.saveStorageState();
      return {
        success: true,
        answer,
        notebookId: params.notebookId,
        references: [],
        url: this.page?.url(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      return {
        success: false,
        references: [],
        error: message,
      };
    }
  }

  async shutdown(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
      }
    } catch {
      // ignore
    }

    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch {
      // ignore
    }

    this.browser = null;
    this.context = null;
    this.page = null;
    this.initialized = false;
  }
}

export const notebookLMBrowserAutomationService = new BrowserAutomationService();
