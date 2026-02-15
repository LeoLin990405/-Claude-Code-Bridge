/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

/**
 * Auth schemas
 */

// Register request
export const registerRequestSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

// Login request
export const loginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
  twoFactorToken: z.string().length(6).optional(), // 可选的 2FA 验证码
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

// Auth response
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: z.object({
    id: z.string().uuid(),
    username: z.string(),
    email: z.string().email(),
    role: z.enum(['admin', 'user']),
    createdAt: z.string().datetime(),
  }),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Refresh token request
export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;

// Password reset request
export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

// Password reset confirm
export const passwordResetConfirmSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(100),
});

export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;

// Update user request
export const updateUserRequestSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).max(100).optional(),
});

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
