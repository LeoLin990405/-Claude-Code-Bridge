/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 密码重置服务
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { passwordResetTokens } from '../schema/oauth';
import { UserRepository } from '../repositories/user.repository';
import { EmailService } from './email.service';
import { eq, and } from 'drizzle-orm';

const BCRYPT_SALT_ROUNDS = 12;
const TOKEN_EXPIRY_HOURS = 1; // 密码重置 token 1 小时过期

export class PasswordResetService {
  private userRepo: UserRepository;
  private emailService: EmailService;

  constructor() {
    this.userRepo = new UserRepository();
    this.emailService = new EmailService();
  }

  /**
   * 创建密码重置 token 并发送邮件
   */
  async createResetToken(email: string): Promise<string | null> {
    // 查找用户
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // 为了安全，不透露用户是否存在
      return null;
    }

    // 生成随机 token
    const token = crypto.randomBytes(32).toString('hex');

    // 计算过期时间（1 小时后）
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // 保存到数据库
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
      used: false,
    });

    // 发送密码重置邮件
    await this.emailService.sendPasswordResetEmail(email, token);

    return token;
  }

  /**
   * 验证密码重置 token
   */
  async verifyResetToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    const results = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false)
        )
      )
      .limit(1);

    const resetToken = results[0];

    if (!resetToken) {
      return { valid: false };
    }

    // 检查是否过期
    if (resetToken.expiresAt < new Date()) {
      return { valid: false };
    }

    return { valid: true, userId: resetToken.userId };
  }

  /**
   * 使用 token 重置密码
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // 验证 token
    const verification = await this.verifyResetToken(token);
    if (!verification.valid || !verification.userId) {
      return false;
    }

    // 哈希新密码
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // 更新密码
    await this.userRepo.updatePassword(verification.userId, passwordHash);

    // 标记 token 为已使用
    await db
      .update(passwordResetTokens)
      .set({
        used: true,
        usedAt: new Date(),
      })
      .where(eq(passwordResetTokens.token, token));

    // 撤销用户的所有刷新 token（强制重新登录）
    await this.userRepo.deleteUserTokens(verification.userId);

    return true;
  }

  /**
   * 清理过期的密码重置 token
   */
  async cleanupExpiredTokens(): Promise<number> {
    const results = await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.expiresAt, new Date()))
      .returning();

    return results.length;
  }
}
