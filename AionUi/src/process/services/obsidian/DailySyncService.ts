/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TMessage } from '@/common/chatLib';
import type { TChatConversation } from '@/common/storage';
import { getDatabase } from '@process/database';
import { Cron } from 'croner';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface DailySyncStatus {
  enabled: boolean;
  running: boolean;
  schedule: string;
  nextRunAt?: number;
  lastRunAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  vault: string;
}

export interface DailySyncRunResult {
  success: boolean;
  appended: boolean;
  vault: string;
  date: string;
  summary?: string;
  error?: string;
}

interface DailySyncConversationSummary {
  id: string;
  name: string;
  totalTextMessages: number;
  userMessages: number;
  assistantMessages: number;
  latestUserMessage?: string;
  latestAssistantMessage?: string;
}

class DailySyncService {
  private readonly scheduleExpr = '0 23 * * *';
  private readonly vaultName = process.env.HIVEMIND_OBSIDIAN_VAULT || 'Knowledge-Hub';
  private timer: Cron | null = null;
  private initialized = false;
  private running = false;
  private lastRunAt: number | undefined;
  private lastSuccessAt: number | undefined;
  private lastError: string | undefined;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.timer = new Cron(this.scheduleExpr, async () => {
      await this.runDailySync();
    });
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (this.timer) {
      this.timer.stop();
      this.timer = null;
    }
    this.initialized = false;
  }

  getStatus(): DailySyncStatus {
    const nextRun = this.timer?.nextRun();
    return {
      enabled: this.initialized,
      running: this.running,
      schedule: this.scheduleExpr,
      nextRunAt: nextRun ? nextRun.getTime() : undefined,
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      vault: this.vaultName,
    };
  }

  async runNow(): Promise<DailySyncRunResult> {
    return this.runDailySync(true);
  }

  private async runDailySync(force = false): Promise<DailySyncRunResult> {
    if (this.running) {
      return {
        success: false,
        appended: false,
        vault: this.vaultName,
        date: this.formatDate(new Date()),
        error: 'Daily sync is already running',
      };
    }

    this.running = true;
    this.lastRunAt = Date.now();
    this.lastError = undefined;

    try {
      const now = new Date();
      const dateText = this.formatDate(now);
      const start = this.startOfDayMs(now);
      const end = this.endOfDayMs(now);

      const summaries = this.collectConversationSummaries(start, end);
      const markdown = this.buildDailyMarkdown({ dateText, summaries, force });

      if (!markdown.trim()) {
        return {
          success: true,
          appended: false,
          vault: this.vaultName,
          date: dateText,
          summary: 'No summary content generated',
        };
      }

      await this.appendToObsidianDaily(markdown);
      this.lastSuccessAt = Date.now();

      return {
        success: true,
        appended: true,
        vault: this.vaultName,
        date: dateText,
        summary: `Synced ${summaries.length} conversations`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      return {
        success: false,
        appended: false,
        vault: this.vaultName,
        date: this.formatDate(new Date()),
        error: message,
      };
    } finally {
      this.running = false;
    }
  }

  private collectConversationSummaries(startMs: number, endMs: number): DailySyncConversationSummary[] {
    const db = getDatabase();
    const conversations = db.getUserConversations(undefined, 0, 400).data || [];

    const result: DailySyncConversationSummary[] = [];

    for (const conversation of conversations) {
      const row = this.summarizeConversation(conversation, startMs, endMs);
      if (row && row.totalTextMessages > 0) {
        result.push(row);
      }
    }

    result.sort((a, b) => b.totalTextMessages - a.totalTextMessages);
    return result;
  }

  private summarizeConversation(conversation: TChatConversation, startMs: number, endMs: number): DailySyncConversationSummary | null {
    const db = getDatabase();
    const page = db.getConversationMessages(conversation.id, 0, 500, 'DESC');
    const messages = page.data || [];

    let totalTextMessages = 0;
    let userMessages = 0;
    let assistantMessages = 0;
    let latestUserMessage: string | undefined;
    let latestAssistantMessage: string | undefined;

    for (const message of messages) {
      const createdAt = Number(message.createdAt || 0);
      if (createdAt < startMs || createdAt > endMs) {
        continue;
      }

      const text = this.extractText(message);
      if (!text) {
        continue;
      }

      totalTextMessages += 1;

      if (message.position === 'right') {
        userMessages += 1;
        if (!latestUserMessage) {
          latestUserMessage = text;
        }
      } else if (message.position === 'left') {
        assistantMessages += 1;
        if (!latestAssistantMessage) {
          latestAssistantMessage = text;
        }
      }
    }

    if (totalTextMessages === 0) {
      return null;
    }

    return {
      id: conversation.id,
      name: conversation.name,
      totalTextMessages,
      userMessages,
      assistantMessages,
      latestUserMessage,
      latestAssistantMessage,
    };
  }

  private buildDailyMarkdown(params: { dateText: string; summaries: DailySyncConversationSummary[]; force: boolean }): string {
    const { dateText, summaries, force } = params;

    const topSummaries = summaries.slice(0, 10);
    const totalMessages = summaries.reduce((acc, row) => acc + row.totalTextMessages, 0);
    const totalUser = summaries.reduce((acc, row) => acc + row.userMessages, 0);
    const totalAssistant = summaries.reduce((acc, row) => acc + row.assistantMessages, 0);

    const header = ['', `## HiveMind Daily Sync (${dateText})`, '', `- Generated At: ${new Date().toLocaleString()}`, `- Conversations Active Today: ${summaries.length}`, `- Text Messages: ${totalMessages} (User ${totalUser} / Assistant ${totalAssistant})`, `- Trigger: ${force ? 'manual' : 'scheduled (23:00)'}`, '', '### Conversation Highlights', ''];

    if (topSummaries.length === 0) {
      header.push('- No conversation activity detected today.', '');
      return header.join('\n');
    }

    const body: string[] = [];
    for (const row of topSummaries) {
      body.push(`- **${row.name}** (${row.userMessages} user / ${row.assistantMessages} assistant)`);
      if (row.latestUserMessage) {
        body.push(`  - Latest User: ${this.toOneLine(row.latestUserMessage, 160)}`);
      }
      if (row.latestAssistantMessage) {
        body.push(`  - Latest Assistant: ${this.toOneLine(row.latestAssistantMessage, 220)}`);
      }
    }

    body.push('');
    return [...header, ...body].join('\n');
  }

  private async appendToObsidianDaily(markdown: string): Promise<void> {
    await execFileAsync('obsidian-cli', ['daily', '--vault', this.vaultName, '--append', markdown], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
  }

  private extractText(message: TMessage): string | undefined {
    if (message.type !== 'text') {
      return undefined;
    }

    const content = message.content as { content?: unknown };
    const text = typeof content?.content === 'string' ? content.content : '';
    return text.trim() || undefined;
  }

  private toOneLine(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private startOfDayMs(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
  }

  private endOfDayMs(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
  }
}

export const dailySyncService = new DailySyncService();
