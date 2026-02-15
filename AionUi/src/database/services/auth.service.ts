/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authentication service - handles complete auth flows
 */

import { UserService } from './user.service';
import { EmailService } from './email.service';
import {
  generateTokenPair,
  verifyRefreshToken,
  getRefreshTokenExpiration,
  generateRandomToken,
  type JWTPayload,
} from '../utils/jwt.util';
import type { User } from '../schema';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'user';
    displayName: string | null;
    createdAt: Date;
  };
}

export class AuthService {
  private userService: UserService;
  private emailService: EmailService;

  constructor() {
    this.userService = new UserService();
    this.emailService = new EmailService();
  }

  /**
   * Register new user and return auth tokens
   */
  async register(data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }): Promise<AuthResult> {
    // Create user
    const user = await this.userService.register(data);

    // Generate tokens
    const tokenPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Store refresh token in database
    const refreshTokenExpiry = getRefreshTokenExpiration();
    await this.userService.createRefreshToken(user.id, tokens.refreshToken, refreshTokenExpiry);

    // Send welcome email (async, don't wait)
    this.emailService.sendWelcomeEmail(user.email, user.username).catch((err) => {
      console.error('[AuthService] Failed to send welcome email:', err);
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Login user and return auth tokens (支持 2FA)
   */
  async login(data: {
    usernameOrEmail: string;
    password: string;
    twoFactorToken?: string;
  }): Promise<AuthResult | { requiresTwoFactor: true; userId: string } | null> {
    // Authenticate user
    const user = await this.userService.authenticate(data.usernameOrEmail, data.password);
    if (!user) {
      return null;
    }

    // 检查是否启用了 2FA
    if (user.twoFactorEnabled) {
      if (!data.twoFactorToken) {
        // 需要 2FA 验证码，返回特殊响应
        return {
          requiresTwoFactor: true,
          userId: user.id,
        };
      }

      // 验证 2FA token
      const { TwoFactorService } = await import('./twoFactor.service');
      const twoFactorService = new TwoFactorService();
      const isValid = await twoFactorService.verifyUserToken(user.id, data.twoFactorToken);

      if (!isValid) {
        // 2FA token 无效
        return null;
      }
    }

    // Generate tokens
    const tokenPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const tokens = generateTokenPair(tokenPayload);

    // Store refresh token in database
    const refreshTokenExpiry = getRefreshTokenExpiration();
    await this.userService.createRefreshToken(user.id, tokens.refreshToken, refreshTokenExpiry);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Refresh access token using refresh token
   * Implements token rotation for security
   */
  async refreshToken(refreshToken: string): Promise<Omit<AuthResult, 'user'> | null> {
    // Verify refresh token JWT signature
    let payload: JWTPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      return null;
    }

    // Validate refresh token in database
    const storedToken = await this.userService.validateRefreshToken(refreshToken);
    if (!storedToken) {
      return null;
    }

    // Revoke old refresh token (rotation)
    await this.userService.revokeRefreshToken(refreshToken);

    // Generate new token pair
    const tokenPayload: JWTPayload = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    };

    const newTokens = generateTokenPair(tokenPayload);

    // Store new refresh token in database
    const refreshTokenExpiry = getRefreshTokenExpiration();
    await this.userService.createRefreshToken(payload.userId, newTokens.refreshToken, refreshTokenExpiry);

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresIn: newTokens.expiresIn,
    };
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(refreshToken: string): Promise<boolean> {
    return this.userService.revokeRefreshToken(refreshToken);
  }

  /**
   * Logout user from all devices
   */
  async logoutAll(userId: string): Promise<number> {
    return this.userService.revokeAllUserTokens(userId);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.userService.getUserById(userId);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      avatar?: string;
      bio?: string;
    }
  ): Promise<User | null> {
    return this.userService.updateProfile(userId, data);
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    return this.userService.changePassword(userId, oldPassword, newPassword);
  }

  /**
   * Sanitize user object for API response (remove sensitive fields)
   */
  private sanitizeUser(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role as 'admin' | 'user',
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }
}
