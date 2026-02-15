/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Conversations React Query Hooks
 */

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys } from '@/renderer/config/queryClient';
import { api } from '@/renderer/services/api';

/**
 * Conversation interface
 */
export interface Conversation {
  id: string;
  title: string;
  userId: string;
  agentId?: string | null;
  status: 'active' | 'archived' | 'deleted';
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
}

/**
 * Message interface
 */
export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * List conversations filters
 */
export interface ListConversationsFilters {
  page?: number;
  limit?: number;
  status?: 'active' | 'archived' | 'deleted';
  agentId?: string;
  search?: string;
}

/**
 * List conversations response
 */
export interface ListConversationsResponse {
  conversations: Conversation[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Create conversation request
 */
export interface CreateConversationRequest {
  title?: string;
  agentId?: string;
  metadata?: Record<string, any>;
}

/**
 * Update conversation request
 */
export interface UpdateConversationRequest {
  title?: string;
  status?: 'active' | 'archived' | 'deleted';
  metadata?: Record<string, any>;
}

/**
 * Fetch conversations list
 */
async function fetchConversations(
  filters: ListConversationsFilters = {}
): Promise<ListConversationsResponse> {
  const response = await api.call<{ success: boolean; data: ListConversationsResponse }>(
    'conversations.list',
    filters
  );

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch conversations');
  }

  return response.data;
}

/**
 * Fetch conversation by ID
 */
async function fetchConversation(id: string): Promise<Conversation> {
  const response = await api.call<{ success: boolean; data: Conversation }>(
    'conversations.get',
    { id }
  );

  if (!response.success || !response.data) {
    throw new Error('Conversation not found');
  }

  return response.data;
}

/**
 * Fetch conversation messages
 */
async function fetchConversationMessages(conversationId: string): Promise<Message[]> {
  const response = await api.call<{ success: boolean; data: Message[] }>(
    'conversations.messages',
    { conversationId }
  );

  if (!response.success || !response.data) {
    throw new Error('Failed to fetch messages');
  }

  return response.data;
}

/**
 * Create conversation
 */
async function createConversation(data: CreateConversationRequest): Promise<Conversation> {
  const response = await api.call<{ success: boolean; data: Conversation }>(
    'conversations.create',
    data
  );

  if (!response.success || !response.data) {
    throw new Error('Failed to create conversation');
  }

  return response.data;
}

/**
 * Update conversation
 */
async function updateConversation(
  id: string,
  data: UpdateConversationRequest
): Promise<Conversation> {
  const response = await api.call<{ success: boolean; data: Conversation }>(
    'conversations.update',
    { id, ...data }
  );

  if (!response.success || !response.data) {
    throw new Error('Failed to update conversation');
  }

  return response.data;
}

/**
 * Delete conversation
 */
async function deleteConversation(id: string): Promise<void> {
  const response = await api.call<{ success: boolean }>('conversations.delete', { id });

  if (!response.success) {
    throw new Error('Failed to delete conversation');
  }
}

/**
 * Hook: List conversations
 */
export function useConversations(filters: ListConversationsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.conversations.list(filters),
    queryFn: () => fetchConversations(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook: Get conversation by ID
 */
export function useConversation(id: string) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(id),
    queryFn: () => fetchConversation(id),
    enabled: !!id,
  });
}

/**
 * Hook: Get conversation messages
 */
export function useConversationMessages(conversationId: string) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: () => fetchConversationMessages(conversationId),
    enabled: !!conversationId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook: Create conversation
 */
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConversation,
    onSuccess: (newConversation) => {
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.lists() });
      // Set the new conversation in cache
      queryClient.setQueryData(queryKeys.conversations.detail(newConversation.id), newConversation);
    },
  });
}

/**
 * Hook: Update conversation
 */
export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateConversationRequest }) =>
      updateConversation(id, data),
    onSuccess: (updatedConversation) => {
      // Update conversation in cache
      queryClient.setQueryData(
        queryKeys.conversations.detail(updatedConversation.id),
        updatedConversation
      );
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.lists() });
    },
  });
}

/**
 * Hook: Delete conversation
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.conversations.detail(deletedId) });
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.lists() });
    },
  });
}
