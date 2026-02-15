/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Electron API Client Implementation (Backward Compatibility)
 */

import type {
  APIClient,
  APIRequestOptions,
  EventCallback,
  UnsubscribeFn,
  ConnectionStatus,
} from './types';

// Extend window interface
declare global {
  interface Window {
    electronAPI?: {
      emit: (name: string, data: any) => Promise<any>;
      on: (callback: (data: any) => void) => () => void;
      getPathForFile?: (file: File) => string;
      webuiGetStatus?: () => Promise<any>;
      webuiChangePassword?: (newPassword: string) => Promise<any>;
      webuiGenerateQRToken?: () => Promise<any>;
      webuiResetPassword?: () => Promise<any>;
    };
  }
}

/**
 * Electron-based API client (wraps window.electronAPI)
 */
export class ElectronAPIClient implements APIClient {
  private eventUnsubscribers = new Map<string, UnsubscribeFn>();

  constructor() {
    if (!window.electronAPI) {
      throw new Error('ElectronAPI is not available. Running in web mode?');
    }
  }

  /**
   * Make an API call using Electron IPC
   */
  async call<T = any>(method: string, data?: any, _options?: APIRequestOptions): Promise<T> {
    if (!window.electronAPI) {
      throw new Error('ElectronAPI is not available');
    }

    try {
      const response = await window.electronAPI.emit(method, data);
      return response as T;
    } catch (error) {
      console.error('Electron IPC call error:', error);
      throw error;
    }
  }

  /**
   * Subscribe to Electron IPC events
   */
  subscribe<T = any>(event: string, callback: EventCallback<T>): UnsubscribeFn {
    if (!window.electronAPI) {
      console.warn('ElectronAPI is not available');
      return () => {};
    }

    // Electron's on() method returns an unsubscribe function
    const unsubscribe = window.electronAPI.on((data: any) => {
      // Filter events by name if needed
      if (data.event === event || !data.event) {
        callback(data.value || data);
      }
    });

    this.eventUnsubscribers.set(event, unsubscribe);

    return () => {
      unsubscribe();
      this.eventUnsubscribers.delete(event);
    };
  }

  /**
   * Get connection status
   * Note: Electron is always "connected" if electronAPI exists
   */
  getConnectionStatus(): ConnectionStatus {
    return window.electronAPI ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // Unsubscribe from all events
    this.eventUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.eventUnsubscribers.clear();
  }

  /**
   * Helper: Get file path (Electron-specific)
   */
  getPathForFile(file: File): string | null {
    if (window.electronAPI?.getPathForFile) {
      return window.electronAPI.getPathForFile(file);
    }
    return null;
  }

  /**
   * Helper: WebUI get status (Electron-specific)
   */
  async webuiGetStatus(): Promise<any> {
    if (window.electronAPI?.webuiGetStatus) {
      return window.electronAPI.webuiGetStatus();
    }
    throw new Error('webuiGetStatus not available');
  }

  /**
   * Helper: WebUI change password (Electron-specific)
   */
  async webuiChangePassword(newPassword: string): Promise<any> {
    if (window.electronAPI?.webuiChangePassword) {
      return window.electronAPI.webuiChangePassword(newPassword);
    }
    throw new Error('webuiChangePassword not available');
  }

  /**
   * Helper: WebUI generate QR token (Electron-specific)
   */
  async webuiGenerateQRToken(): Promise<any> {
    if (window.electronAPI?.webuiGenerateQRToken) {
      return window.electronAPI.webuiGenerateQRToken();
    }
    throw new Error('webuiGenerateQRToken not available');
  }

  /**
   * Helper: WebUI reset password (Electron-specific)
   */
  async webuiResetPassword(): Promise<any> {
    if (window.electronAPI?.webuiResetPassword) {
      return window.electronAPI.webuiResetPassword();
    }
    throw new Error('webuiResetPassword not available');
  }
}

/**
 * Check if running in Electron environment
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
}
