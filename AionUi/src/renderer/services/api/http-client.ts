/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * HTTP API Client Implementation
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
  APIClient,
  APIRequestOptions,
  APIResponse,
  EventCallback,
  UnsubscribeFn,
  ConnectionStatus,
  TokenStorage,
} from './types';
import { tokenStorage as defaultTokenStorage } from './token-storage';

/**
 * HTTP-based API client using axios
 */
export class HTTPAPIClient implements APIClient {
  private axiosInstance: AxiosInstance;
  private tokenStorage: TokenStorage;
  private baseURL: string;
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    baseURL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000',
    tokenStorage: TokenStorage = defaultTokenStorage
  ) {
    this.baseURL = baseURL;
    this.tokenStorage = tokenStorage;

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: `${baseURL}/api/v1`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.tokenStorage.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<APIResponse>) => {
        const originalRequest = error.config;

        // If 401 and not already retrying, try to refresh token
        if (error.response?.status === 401 && originalRequest && !(originalRequest as any)._retry) {
          (originalRequest as any)._retry = true;

          try {
            const newToken = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            // Refresh failed, clear tokens and redirect to login
            this.tokenStorage.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<string> {
    // Prevent multiple simultaneous refresh requests
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const refreshToken = this.tokenStorage.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post<APIResponse<{ accessToken: string }>>(
          `${this.baseURL}/api/v1/auth/refresh`,
          { refreshToken }
        );

        if (!response.data.success || !response.data.data) {
          throw new Error('Token refresh failed');
        }

        const { accessToken } = response.data.data;
        this.tokenStorage.setAccessToken(accessToken);

        return accessToken;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Make an API call
   */
  async call<T = any>(method: string, data?: any, options?: APIRequestOptions): Promise<T> {
    try {
      const response = await this.axiosInstance.post<APIResponse<T>>(
        `/${method}`,
        data,
        {
          timeout: options?.timeout,
          headers: options?.headers,
          signal: options?.signal,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'API call failed');
      }

      return response.data.data as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error;
        throw new Error(apiError?.message || error.message);
      }
      throw error;
    }
  }

  /**
   * Subscribe to real-time events
   * Note: HTTP doesn't support real-time events, use WebSocket manager instead
   */
  subscribe<T = any>(_event: string, _callback: EventCallback<T>): UnsubscribeFn {
    console.warn('HTTP client does not support event subscription. Use WebSocket manager.');
    return () => {};
  }

  /**
   * Get connection status
   * Note: HTTP is stateless, always returns CONNECTED
   */
  getConnectionStatus(): ConnectionStatus {
    return ConnectionStatus.CONNECTED;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    // Nothing to cleanup for HTTP client
  }

  /**
   * Helper method for GET requests
   */
  async get<T = any>(endpoint: string, params?: any, options?: APIRequestOptions): Promise<T> {
    try {
      const response = await this.axiosInstance.get<APIResponse<T>>(endpoint, {
        params,
        timeout: options?.timeout,
        headers: options?.headers,
        signal: options?.signal,
      });

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'GET request failed');
      }

      return response.data.data as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error;
        throw new Error(apiError?.message || error.message);
      }
      throw error;
    }
  }

  /**
   * Helper method for POST requests
   */
  async post<T = any>(endpoint: string, data?: any, options?: APIRequestOptions): Promise<T> {
    try {
      const response = await this.axiosInstance.post<APIResponse<T>>(endpoint, data, {
        timeout: options?.timeout,
        headers: options?.headers,
        signal: options?.signal,
      });

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'POST request failed');
      }

      return response.data.data as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error;
        throw new Error(apiError?.message || error.message);
      }
      throw error;
    }
  }

  /**
   * Helper method for PUT requests
   */
  async put<T = any>(endpoint: string, data?: any, options?: APIRequestOptions): Promise<T> {
    try {
      const response = await this.axiosInstance.put<APIResponse<T>>(endpoint, data, {
        timeout: options?.timeout,
        headers: options?.headers,
        signal: options?.signal,
      });

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'PUT request failed');
      }

      return response.data.data as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error;
        throw new Error(apiError?.message || error.message);
      }
      throw error;
    }
  }

  /**
   * Helper method for DELETE requests
   */
  async delete<T = any>(endpoint: string, options?: APIRequestOptions): Promise<T> {
    try {
      const response = await this.axiosInstance.delete<APIResponse<T>>(endpoint, {
        timeout: options?.timeout,
        headers: options?.headers,
        signal: options?.signal,
      });

      if (!response.data.success) {
        throw new Error(response.data.error?.message || 'DELETE request failed');
      }

      return response.data.data as T;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error;
        throw new Error(apiError?.message || error.message);
      }
      throw error;
    }
  }
}
