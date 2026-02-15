/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * API Client - Unified Export and Factory
 */

import { HTTPAPIClient } from './http-client';
import { ElectronAPIClient, isElectron } from './electron-client';
import { WebSocketManager, getWebSocketManager } from './websocket-manager';
import { tokenStorage, LocalStorageTokenStorage, MemoryTokenStorage } from './token-storage';
import type { APIClient } from './types';

// Re-export types
export type {
  APIClient,
  APIRequestOptions,
  APIResponse,
  EventCallback,
  UnsubscribeFn,
  ConnectionStatus,
  WebSocketOptions,
  TokenStorage,
} from './types';

// Re-export classes
export { HTTPAPIClient } from './http-client';
export { ElectronAPIClient, isElectron } from './electron-client';
export { WebSocketManager, getWebSocketManager } from './websocket-manager';
export { tokenStorage, LocalStorageTokenStorage, MemoryTokenStorage } from './token-storage';
export { ConnectionStatus } from './types';

/**
 * Create an API client instance
 * Automatically selects between Electron and HTTP client
 */
export function createAPIClient(
  options: {
    baseURL?: string;
    forceHTTP?: boolean;
  } = {}
): APIClient {
  const { baseURL, forceHTTP = false } = options;

  // Use Electron client if available and not forcing HTTP
  if (!forceHTTP && isElectron()) {
    console.log('Using Electron API client');
    return new ElectronAPIClient();
  }

  // Use HTTP client for web mode
  console.log('Using HTTP API client');
  return new HTTPAPIClient(baseURL, tokenStorage);
}

/**
 * Singleton API client instance
 */
let apiClientInstance: APIClient | null = null;

/**
 * Get the API client singleton
 */
export function getAPIClient(): APIClient {
  if (!apiClientInstance) {
    apiClientInstance = createAPIClient();
  }
  return apiClientInstance;
}

/**
 * Reset the API client singleton (useful for testing)
 */
export function resetAPIClient(): void {
  if (apiClientInstance) {
    apiClientInstance.disconnect();
    apiClientInstance = null;
  }
}

/**
 * Combined API + WebSocket client with unified interface
 */
export class UnifiedAPIClient {
  private apiClient: APIClient;
  private wsManager: WebSocketManager;

  constructor(options: { baseURL?: string; forceHTTP?: boolean } = {}) {
    this.apiClient = createAPIClient(options);
    this.wsManager = getWebSocketManager();

    // Auto-connect WebSocket in HTTP mode
    if (!isElectron()) {
      this.wsManager.connect();
    }
  }

  /**
   * Make an API call
   */
  async call<T = any>(method: string, data?: any, options?: any): Promise<T> {
    return this.apiClient.call<T>(method, data, options);
  }

  /**
   * Subscribe to real-time events
   */
  subscribe<T = any>(event: string, callback: (data: T) => void): () => void {
    // In HTTP mode, use WebSocket
    if (!isElectron()) {
      return this.wsManager.subscribe(event, callback);
    }
    // In Electron mode, use IPC
    return this.apiClient.subscribe(event, callback);
  }

  /**
   * Emit an event (WebSocket only)
   */
  emit(event: string, data?: any): void {
    if (!isElectron()) {
      this.wsManager.emit(event, data);
    } else {
      console.warn('emit() not supported in Electron mode, use call() instead');
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    if (!isElectron()) {
      return this.wsManager.getStatus();
    }
    return this.apiClient.getConnectionStatus();
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.apiClient.disconnect();
    if (!isElectron()) {
      this.wsManager.disconnect();
    }
  }

  /**
   * Get the HTTP client (for direct REST calls)
   */
  get http(): HTTPAPIClient {
    if (this.apiClient instanceof HTTPAPIClient) {
      return this.apiClient;
    }
    throw new Error('HTTP client not available in Electron mode');
  }

  /**
   * Get the WebSocket manager
   */
  get ws(): WebSocketManager {
    return this.wsManager;
  }

  /**
   * Get the Electron client (for Electron-specific methods)
   */
  get electron(): ElectronAPIClient | null {
    if (this.apiClient instanceof ElectronAPIClient) {
      return this.apiClient;
    }
    return null;
  }
}

/**
 * Singleton unified client
 */
let unifiedClientInstance: UnifiedAPIClient | null = null;

/**
 * Get the unified API client singleton
 */
export function getUnifiedClient(): UnifiedAPIClient {
  if (!unifiedClientInstance) {
    unifiedClientInstance = new UnifiedAPIClient();
  }
  return unifiedClientInstance;
}

// Default export
export const api = getUnifiedClient();
