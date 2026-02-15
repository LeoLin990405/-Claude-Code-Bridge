/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * API Client Types and Interfaces
 */

/**
 * Unsubscribe function returned by event subscriptions
 */
export type UnsubscribeFn = () => void;

/**
 * Event callback function
 */
export type EventCallback<T = any> = (data: T) => void;

/**
 * API request options
 */
export interface APIRequestOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Retry configuration */
  retry?: {
    attempts?: number;
    delay?: number;
  };
  /** Signal for request cancellation */
  signal?: AbortSignal;
}

/**
 * API response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * WebSocket connection options
 */
export interface WebSocketOptions {
  /** Automatically reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Authentication token */
  token?: string;
}

/**
 * WebSocket connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Main API Client interface
 */
export interface APIClient {
  /**
   * Make an API call
   * @param method - API method/endpoint
   * @param data - Request data
   * @param options - Request options
   */
  call<T = any>(method: string, data?: any, options?: APIRequestOptions): Promise<T>;

  /**
   * Subscribe to real-time events
   * @param event - Event name
   * @param callback - Event handler
   */
  subscribe<T = any>(event: string, callback: EventCallback<T>): UnsubscribeFn;

  /**
   * Get connection status
   */
  getConnectionStatus(): ConnectionStatus;

  /**
   * Disconnect and cleanup
   */
  disconnect(): void;
}

/**
 * Auth token storage interface
 */
export interface TokenStorage {
  getAccessToken(): string | null;
  setAccessToken(token: string): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string): void;
  clearTokens(): void;
}
