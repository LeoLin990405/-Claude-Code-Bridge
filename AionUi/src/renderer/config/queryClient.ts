/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * React Query (TanStack Query) Configuration
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { Message } from '@arco-design/web-react';

/**
 * Global error handler for queries
 */
const queryErrorHandler = (error: Error | unknown) => {
  const message =
    error instanceof Error ? error.message : 'An error occurred while fetching data';

  console.error('[Query Error]', message, error);

  // Show user-friendly error notification
  Message.error({
    content: message,
    duration: 3000,
  });
};

/**
 * Global error handler for mutations
 */
const mutationErrorHandler = (error: Error | unknown) => {
  const message =
    error instanceof Error ? error.message : 'An error occurred while performing the operation';

  console.error('[Mutation Error]', message, error);

  // Show user-friendly error notification
  Message.error({
    content: message,
    duration: 3000,
  });
};

/**
 * Create Query Client with global configuration
 */
export const createQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: queryErrorHandler,
    }),
    mutationCache: new MutationCache({
      onError: mutationErrorHandler,
    }),
    defaultOptions: {
      queries: {
        // Caching configuration
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)

        // Retry configuration
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors
          if (error instanceof Error && 'status' in error) {
            const status = (error as any).status;
            if (status >= 400 && status < 500) {
              return false;
            }
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Refetch configuration
        refetchOnWindowFocus: false, // Don't refetch on window focus (performance)
        refetchOnReconnect: true, // Refetch when reconnecting
        refetchOnMount: true, // Refetch when component mounts

        // Network mode
        networkMode: 'online', // Only run queries when online
      },
      mutations: {
        // Retry configuration for mutations
        retry: false, // Don't retry mutations by default
        networkMode: 'online',
      },
    },
  });

/**
 * Query Keys for consistent cache management
 */
export const queryKeys = {
  // Auth
  auth: {
    me: () => ['auth', 'me'] as const,
    session: () => ['auth', 'session'] as const,
  },

  // Users
  users: {
    all: () => ['users'] as const,
    lists: () => ['users', 'list'] as const,
    list: (filters: Record<string, any>) => ['users', 'list', filters] as const,
    details: () => ['users', 'detail'] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },

  // Conversations
  conversations: {
    all: () => ['conversations'] as const,
    lists: () => ['conversations', 'list'] as const,
    list: (filters: Record<string, any>) => ['conversations', 'list', filters] as const,
    details: () => ['conversations', 'detail'] as const,
    detail: (id: string) => ['conversations', 'detail', id] as const,
    messages: (conversationId: string) => ['conversations', 'messages', conversationId] as const,
  },

  // Messages
  messages: {
    all: () => ['messages'] as const,
    lists: () => ['messages', 'list'] as const,
    list: (filters: Record<string, any>) => ['messages', 'list', filters] as const,
    details: () => ['messages', 'detail'] as const,
    detail: (id: string) => ['messages', 'detail', id] as const,
  },

  // Skills
  skills: {
    all: () => ['skills'] as const,
    lists: () => ['skills', 'list'] as const,
    list: (filters: Record<string, any>) => ['skills', 'list', filters] as const,
    details: () => ['skills', 'detail'] as const,
    detail: (id: string) => ['skills', 'detail', id] as const,
  },

  // AI Tools
  aiTools: {
    all: () => ['aiTools'] as const,
    lists: () => ['aiTools', 'list'] as const,
    list: (filters: Record<string, any>) => ['aiTools', 'list', filters] as const,
    details: () => ['aiTools', 'detail'] as const,
    detail: (id: string) => ['aiTools', 'detail', id] as const,
  },

  // MCP Servers
  mcpServers: {
    all: () => ['mcpServers'] as const,
    lists: () => ['mcpServers', 'list'] as const,
    list: (filters: Record<string, any>) => ['mcpServers', 'list', filters] as const,
    details: () => ['mcpServers', 'detail'] as const,
    detail: (id: string) => ['mcpServers', 'detail', id] as const,
    status: (id: string) => ['mcpServers', 'status', id] as const,
  },

  // Settings
  settings: {
    all: () => ['settings'] as const,
    user: () => ['settings', 'user'] as const,
    system: () => ['settings', 'system'] as const,
  },

  // Cron Jobs
  cronJobs: {
    all: () => ['cronJobs'] as const,
    lists: () => ['cronJobs', 'list'] as const,
    list: (filters: Record<string, any>) => ['cronJobs', 'list', filters] as const,
    details: () => ['cronJobs', 'detail'] as const,
    detail: (id: string) => ['cronJobs', 'detail', id] as const,
  },
};
