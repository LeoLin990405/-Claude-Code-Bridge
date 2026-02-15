/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 双因素认证 (2FA) 路由
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { twoFactorRateLimiter } from '../middleware/rateLimiter';
import { TwoFactorService } from '../../../database/services/twoFactor.service';

const router = Router();
const twoFactorService = new TwoFactorService();

/**
 * POST /api/v1/2fa/setup
 * 设置 2FA（生成密钥和二维码）
 */
router.post('/setup', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const username = req.user!.username;

    const setup = await twoFactorService.setupTwoFactor(userId, username);

    res.json({
      success: true,
      data: {
        secret: setup.secret,
        qrCode: setup.qrCode,
        backupCodes: setup.backupCodes,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/2fa/enable
 * 启用 2FA（验证 token 并保存密钥）
 */
router.post(
  '/enable',
  authenticateJWT,
  twoFactorRateLimiter,
  validateRequest({
    body: z.object({
      secret: z.string(),
      token: z.string().length(6),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { secret, token } = req.body;
      const userId = req.user!.userId;

      const success = await twoFactorService.enableTwoFactor(userId, secret, token);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid 2FA token',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }

      res.json({
        success: true,
        data: { message: '2FA enabled successfully' },
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
 * POST /api/v1/2fa/disable
 * 禁用 2FA（需要提供当前 token 验证）
 */
router.post(
  '/disable',
  authenticateJWT,
  validateRequest({
    body: z.object({
      token: z.string().length(6),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      const userId = req.user!.userId;

      const success = await twoFactorService.disableTwoFactor(userId, token);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid 2FA token or 2FA not enabled',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }

      res.json({
        success: true,
        data: { message: '2FA disabled successfully' },
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
 * POST /api/v1/2fa/verify
 * 验证 2FA token（用于登录流程）
 */
router.post(
  '/verify',
  authenticateJWT,
  twoFactorRateLimiter,
  validateRequest({
    body: z.object({
      token: z.string().length(6),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      const userId = req.user!.userId;

      const isValid = await twoFactorService.verifyUserToken(userId, token);

      res.json({
        success: true,
        data: { valid: isValid },
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
