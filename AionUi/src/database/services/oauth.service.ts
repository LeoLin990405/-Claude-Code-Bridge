/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * OAuth 服务 - 处理第三方登录（Google、GitHub）
 */

import { db } from '../db';
import { oauthAccounts, type OAuthAccount } from '../schema/oauth';
import { users, type User } from '../schema/users';
import { eq, and } from 'drizzle-orm';
import { generateTokenPair, getRefreshTokenExpiration, type JWTPayload } from '../utils/jwt.util';
import { UserService } from './user.service';
import type { AuthResult } from './auth.service';

export interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  displayName?: string;
  avatar?: string;
  raw?: any; // 原始 profile 数据
}

export class OAuthService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * 通过 OAuth 登录或注册
   */
  async loginOrRegister(profile: OAuthProfile): Promise<AuthResult> {
    // 查找是否存在 OAuth 账户
    let oauthAccount = await this.findOAuthAccount(profile.provider, profile.providerId);

    let user: User;

    if (oauthAccount) {
      // 已存在的 OAuth 账户，获取关联的用户
      user = await this.userService.getUserById(oauthAccount.userId);
      if (!user) {
        throw new Error('User not found for OAuth account');
      }

      // 更新 OAuth 账户信息
      await this.updateOAuthAccount(oauthAccount.id, {
        email: profile.email,
        displayName: profile.displayName,
        avatar: profile.avatar,
        raw: JSON.stringify(profile.raw),
        updatedAt: new Date(),
      });
    } else {
      // 新的 OAuth 账户，查找是否存在相同邮箱的用户
      const existingUser = await this.userService.getUserByEmail(profile.email);

      if (existingUser) {
        // 用户存在，关联 OAuth 账户
        user = existingUser;
        await this.createOAuthAccount({
          userId: user.id,
          provider: profile.provider,
          providerId: profile.providerId,
          email: profile.email,
          displayName: profile.displayName,
          avatar: profile.avatar,
          raw: JSON.stringify(profile.raw),
        });
      } else {
        // 创建新用户
        user = await this.userService.register({
          username: this.generateUsername(profile),
          email: profile.email,
          password: this.generateRandomPassword(), // OAuth 用户随机密码
          displayName: profile.displayName || profile.email.split('@')[0],
        });

        // 创建 OAuth 账户关联
        await this.createOAuthAccount({
          userId: user.id,
          provider: profile.provider,
          providerId: profile.providerId,
          email: profile.email,
          displayName: profile.displayName,
          avatar: profile.avatar,
          raw: JSON.stringify(profile.raw),
        });

        // 自动验证邮箱（OAuth 提供商已验证）
        await this.userService.verifyEmail(user.id);
      }
    }

    // 生成 JWT tokens
    const tokenPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const tokens = generateTokenPair(tokenPayload);

    // 存储 refresh token
    const refreshTokenExpiry = getRefreshTokenExpiration();
    await this.userService.createRefreshToken(user.id, tokens.refreshToken, refreshTokenExpiry);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role as 'admin' | 'user',
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * 查找 OAuth 账户
   */
  private async findOAuthAccount(provider: string, providerId: string): Promise<OAuthAccount | null> {
    const results = await db
      .select()
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerId, providerId)))
      .limit(1);

    return results[0] || null;
  }

  /**
   * 创建 OAuth 账户
   */
  private async createOAuthAccount(data: {
    userId: string;
    provider: string;
    providerId: string;
    email: string;
    displayName?: string;
    avatar?: string;
    raw?: string;
  }): Promise<OAuthAccount> {
    const results = await db.insert(oauthAccounts).values(data).returning();
    return results[0];
  }

  /**
   * 更新 OAuth 账户
   */
  private async updateOAuthAccount(
    id: string,
    data: {
      email?: string;
      displayName?: string;
      avatar?: string;
      raw?: string;
      updatedAt?: Date;
    }
  ): Promise<void> {
    await db.update(oauthAccounts).set(data).where(eq(oauthAccounts.id, id));
  }

  /**
   * 获取用户的所有 OAuth 账户
   */
  async getUserOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
    return db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, userId));
  }

  /**
   * 解除 OAuth 账户关联
   */
  async unlinkOAuthAccount(userId: string, provider: string): Promise<boolean> {
    const results = await db
      .delete(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)))
      .returning();

    return results.length > 0;
  }

  /**
   * 生成唯一用户名（从邮箱或 providerId）
   */
  private generateUsername(profile: OAuthProfile): string {
    const base = profile.email.split('@')[0] || profile.providerId;
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${base}_${random}`;
  }

  /**
   * 生成随机密码（OAuth 用户不使用密码登录）
   */
  private generateRandomPassword(): string {
    return Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
  }
}
