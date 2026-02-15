/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 双因素认证 (2FA) 服务 - 基于 TOTP
 */

import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { UserService } from './user.service';
import { EmailService } from './email.service';

export interface TwoFactorSetup {
  secret: string; // Base32 编码的密钥
  qrCode: string; // Data URL 格式的二维码
  backupCodes: string[]; // 备用恢复代码
}

export class TwoFactorService {
  private userService: UserService;
  private emailService: EmailService;

  constructor() {
    this.userService = new UserService();
    this.emailService = new EmailService();
  }

  /**
   * 生成 2FA 密钥和二维码
   */
  async setupTwoFactor(userId: string, username: string): Promise<TwoFactorSetup> {
    // 生成密钥
    const secret = speakeasy.generateSecret({
      name: `HiveMind (${username})`,
      issuer: 'HiveMind',
      length: 32,
    });

    // 生成二维码（用户可以用 Google Authenticator 扫描）
    const qrCode = await qrcode.toDataURL(secret.otpauth_url!);

    // 生成备用恢复代码（10 个 8 位数字）
    const backupCodes = this.generateBackupCodes(10);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  }

  /**
   * 验证 TOTP 代码
   */
  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // 允许前后 2 个时间窗口（60秒误差）
    });
  }

  /**
   * 启用用户的 2FA
   */
  async enableTwoFactor(userId: string, secret: string, token: string): Promise<boolean> {
    // 验证用户提供的 token
    const isValid = this.verifyToken(secret, token);
    if (!isValid) {
      return false;
    }

    // 获取用户信息
    const user = await this.userService.getUserById(userId);
    if (!user) {
      return false;
    }

    // 保存密钥到数据库
    await this.userService.enableTwoFactor(userId, secret);

    // 发送 2FA 启用通知邮件（异步）
    this.emailService.send2FAEnabledNotification(user.email, user.username).catch((err) => {
      console.error('[TwoFactorService] Failed to send 2FA notification:', err);
    });

    return true;
  }

  /**
   * 禁用用户的 2FA
   */
  async disableTwoFactor(userId: string, token: string): Promise<boolean> {
    // 获取用户
    const user = await this.userService.getUserById(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    // 验证 token
    const isValid = this.verifyToken(user.twoFactorSecret, token);
    if (!isValid) {
      return false;
    }

    // 禁用 2FA
    await this.userService.disableTwoFactor(userId);
    return true;
  }

  /**
   * 验证用户登录时的 2FA token
   */
  async verifyUserToken(userId: string, token: string): Promise<boolean> {
    const user = await this.userService.getUserById(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    return this.verifyToken(user.twoFactorSecret, token);
  }

  /**
   * 生成备用恢复代码
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // 生成 8 位随机数字
      const code = Math.floor(10000000 + Math.random() * 90000000).toString();
      codes.push(code);
    }
    return codes;
  }
}
