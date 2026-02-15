/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 邮件服务 - 发送各类邮件
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// 邮件配置
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@hivemind.com';
const FROM_NAME = process.env.FROM_NAME || 'HiveMind';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * 初始化邮件传输器
   */
  private initializeTransporter(): void {
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn('[邮件服务] SMTP 未配置 - 邮件功能将不可用');
      console.warn('[邮件服务] 请设置 SMTP_USER 和 SMTP_PASS 环境变量');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    console.log('[邮件服务] SMTP 传输器已初始化');
  }

  /**
   * 发送密码重置邮件
   */
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>密码重置请求</h1>
          </div>
          <div class="content">
            <p>您好，</p>
            <p>我们收到了您的密码重置请求。点击下面的按钮重置密码：</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">重置密码</a>
            </p>
            <p>或复制以下链接到浏览器：</p>
            <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 4px;">
              ${resetUrl}
            </p>
            <div class="warning">
              <strong>⚠️ 重要提示：</strong>
              <ul>
                <li>此链接将在 <strong>1 小时</strong>后失效</li>
                <li>如果您没有请求重置密码，请忽略此邮件</li>
                <li>请勿将此链接分享给他人</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>此邮件由 HiveMind 系统自动发送，请勿回复。</p>
            <p>&copy; 2025 HiveMind. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: '密码重置请求 - HiveMind',
      html,
    });
  }

  /**
   * 发送欢迎邮件
   */
  async sendWelcomeEmail(to: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .features li { margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 欢迎加入 HiveMind！</h1>
          </div>
          <div class="content">
            <p>您好，<strong>${username}</strong>！</p>
            <p>感谢您注册 HiveMind。我们很高兴您能加入我们！</p>
            <div class="features">
              <h3>您现在可以：</h3>
              <ul>
                <li>🤖 与多个 AI 助手对话</li>
                <li>💬 创建和管理对话</li>
                <li>🔐 启用双因素认证保护账户</li>
                <li>🌐 使用 OAuth 快速登录</li>
              </ul>
            </div>
            <p style="text-align: center;">
              <a href="${FRONTEND_URL}" class="button">开始使用</a>
            </p>
          </div>
          <div class="footer">
            <p>如有任何问题，请随时联系我们。</p>
            <p>&copy; 2025 HiveMind. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: '欢迎加入 HiveMind！',
      html,
    });
  }

  /**
   * 发送邮箱验证邮件
   */
  async sendEmailVerification(to: string, verificationToken: string): Promise<boolean> {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✉️ 验证您的邮箱</h1>
          </div>
          <div class="content">
            <p>您好，</p>
            <p>请点击下面的按钮验证您的邮箱地址：</p>
            <p style="text-align: center;">
              <a href="${verifyUrl}" class="button">验证邮箱</a>
            </p>
            <p>或复制以下链接到浏览器：</p>
            <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 4px;">
              ${verifyUrl}
            </p>
          </div>
          <div class="footer">
            <p>此邮件由 HiveMind 系统自动发送，请勿回复。</p>
            <p>&copy; 2025 HiveMind. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: '验证您的邮箱 - HiveMind',
      html,
    });
  }

  /**
   * 发送 2FA 启用通知
   */
  async send2FAEnabledNotification(to: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .success { background: #D1FAE5; border-left: 4px solid #10B981; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 双因素认证已启用</h1>
          </div>
          <div class="content">
            <p>您好，<strong>${username}</strong>！</p>
            <div class="success">
              <strong>✅ 成功：</strong> 您的账户已启用双因素认证 (2FA)。
            </div>
            <p>从现在开始，登录时除了密码外，还需要输入 6 位验证码。</p>
            <p><strong>请妥善保管您的备用恢复代码，</strong>以防无法访问验证器应用时使用。</p>
            <p>如果这不是您本人的操作，请立即更改密码并联系我们。</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 HiveMind. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: '双因素认证已启用 - HiveMind',
      html,
    });
  }

  /**
   * 发送通用邮件
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      console.warn('[邮件服务] 传输器未初始化 - 邮件未发送');
      console.log('[邮件服务] 模拟发送邮件:');
      console.log('  收件人:', options.to);
      console.log('  主题:', options.subject);
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log('[邮件服务] 邮件已发送:', info.messageId);
      return true;
    } catch (error) {
      console.error('[邮件服务] 发送失败:', error);
      return false;
    }
  }

  /**
   * 验证 SMTP 连接
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('[邮件服务] SMTP 连接验证成功');
      return true;
    } catch (error) {
      console.error('[邮件服务] SMTP 连接验证失败:', error);
      return false;
    }
  }
}
