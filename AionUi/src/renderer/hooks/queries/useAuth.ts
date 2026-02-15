/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authentication React Query Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/renderer/config/queryClient';
import { api } from '@/renderer/services/api';

/**
 * User interface
 */
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  displayName?: string;
  avatar?: string;
  bio?: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Login request interface
 */
export interface LoginRequest {
  username: string;
  password: string;
  twoFactorToken?: string;
}

/**
 * Login response interface
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

/**
 * Fetch current user
 */
async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await api.call<{ success: boolean; data?: User }>('auth.me');
    return response.data || null;
  } catch (error) {
    console.error('Failed to fetch current user:', error);
    return null;
  }
}

/**
 * Login mutation function
 */
async function loginMutation(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await api.call<{ success: boolean; data: LoginResponse }>(
    'auth.login',
    credentials
  );

  if (!response.success || !response.data) {
    throw new Error('Login failed');
  }

  return response.data;
}

/**
 * Logout mutation function
 */
async function logoutMutation(params?: { all?: boolean }): Promise<void> {
  await api.call('auth.logout', params);
}

/**
 * Change password mutation function
 */
async function changePasswordMutation(params: {
  oldPassword: string;
  newPassword: string;
}): Promise<void> {
  const response = await api.call<{ success: boolean }>('auth.changePassword', params);

  if (!response.success) {
    throw new Error('Failed to change password');
  }
}

/**
 * Hook: Get current user
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: false, // Don't retry on auth failures
  });
}

/**
 * Hook: Login mutation
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginMutation,
    onSuccess: (data) => {
      // Update current user cache
      queryClient.setQueryData(queryKeys.auth.me(), data.user);
      // Invalidate session
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
    },
  });
}

/**
 * Hook: Logout mutation
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutMutation,
    onSuccess: () => {
      // Clear all queries on logout
      queryClient.clear();
    },
  });
}

/**
 * Hook: Change password mutation
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: changePasswordMutation,
  });
}

/**
 * Hook: Combined auth state (similar to legacy useAuth)
 */
export function useAuthState() {
  const {
    data: user,
    isLoading,
    isError,
    refetch,
  } = useCurrentUser();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !isError,
    isUnauthenticated: !user && !isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    refresh: refetch,
    status: isLoading ? 'checking' : user ? 'authenticated' : 'unauthenticated',
  };
}
