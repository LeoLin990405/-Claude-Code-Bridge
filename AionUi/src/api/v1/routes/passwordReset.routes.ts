/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 密码重置路由
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate';
import { passwordResetRateLimiter } from '../middleware/rateLimiter';
import { PasswordResetService } from '../../../database/services/passwordReset.service';

const router = Router();
const passwordResetService = new PasswordResetService();

/**
 * POST /api/v1/password-reset/request
 * 请求密码重置（发送重置链接到邮箱）
 */
router.post(
  '/request',
  passwordResetRateLimiter,
  validateRequest({
    body: z.object({
      email: z.string().email(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      const token = await passwordResetService.createResetToken(email);

      // 注意：为了安全，即使邮箱不存在也返回成功
      // 避免泄露用户是否存在

      if (token) {
        // TODO: 发送重置邮件
        // await emailService.sendPasswordResetEmail(email, token);
        console.log(`[密码重置] Token: ${token} for ${email}`);
        console.log(`[密码重置] 重置链接: /reset-password?token=${token}`);
      }

      res.json({
        success: true,
        data: {
          message: 'If the email exists, a password reset link has been sent',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/password-reset/verify
 * 验证密码重置 token 是否有效
 */
router.post(
  '/verify',
  validateRequest({
    body: z.object({
      token: z.string(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;

      const verification = await passwordResetService.verifyResetToken(token);

      res.json({
        success: true,
        data: { valid: verification.valid },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/password-reset/confirm
 * 确认密码重置（使用 token 设置新密码）
 */
router.post(
  '/confirm',
  validateRequest({
    body: z.object({
      token: z.string(),
      newPassword: z.string().min(8).max(100),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body;

      const success = await passwordResetService.resetPassword(token, newPassword);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired password reset token',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Password has been reset successfully. Please login with your new password.',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
