/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  registerRequestSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  updateUserRequestSchema,
} from '../schemas/auth';
import { validateRequest } from '../middleware/validate';
import { authenticateJWT } from '../middleware/auth';
import { strictRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter';
import { AuthService } from '../../../database/services/auth.service';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/v1/auth/register
 * Register new user
 */
router.post(
  '/register',
  strictRateLimiter,
  validateRequest({ body: registerRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password } = req.body;

      const result = await authService.register({
        username,
        email,
        password,
        displayName: username,
      });

      res.status(201).json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error: any) {
      // Handle duplicate user error
      if (error.message?.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: error.message,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/login
 * Login with credentials
 */
router.post(
  '/login',
  strictRateLimiter,
  validateRequest({ body: loginRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, twoFactorToken } = req.body;

      const result = await authService.login({
        usernameOrEmail: username,
        password,
        twoFactorToken,
      });

      if (!result) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: twoFactorToken
              ? 'Invalid username, password, or 2FA token'
              : 'Invalid username or password',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }

      // 检查是否需要 2FA
      if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
        return res.status(200).json({
          success: true,
          data: {
            requiresTwoFactor: true,
            message: 'Please provide your 2FA token',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }

      res.json({
        success: true,
        data: result,
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
 * POST /api/v1/auth/logout
 * Logout (invalidate token)
 */
router.post('/logout', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken, all } = req.body;

    if (all === true) {
      // Logout from all devices
      await authService.logoutAll(req.user!.userId);
    } else if (refreshToken) {
      // Logout from current device
      await authService.logout(refreshToken);
    }

    res.json({
      success: true,
      data: { message: all ? 'Logged out from all devices' : 'Logged out successfully' },
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
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  validateRequest({ body: refreshTokenRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      const result = await authService.refreshToken(refreshToken);

      if (!result) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }

      res.json({
        success: true,
        data: result,
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
 * GET /api/v1/auth/me
 * Get current user
 */
router.get('/me', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
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
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
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
 * PATCH /api/v1/auth/me
 * Update current user
 */
router.patch(
  '/me',
  authenticateJWT,
  validateRequest({ body: updateUserRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      // Handle password change separately
      if (password) {
        // For password change, we need old password for verification
        // This should be handled by a separate endpoint
        return res.status(400).json({
          success: false,
          error: {
            code: 'USE_PASSWORD_CHANGE_ENDPOINT',
            message: 'Use POST /api/v1/auth/change-password to change password',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }

      const updatedUser = await authService.updateProfile(req.user!.userId, {
        ...(email && { email }), // Only include if provided
      });

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
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
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          displayName: updatedUser.displayName,
          avatar: updatedUser.avatar,
          bio: updatedUser.bio,
          createdAt: updatedUser.createdAt.toISOString(),
          updatedAt: updatedUser.updatedAt.toISOString(),
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
 * POST /api/v1/auth/change-password
 * Change password (requires old password)
 */
router.post(
  '/change-password',
  authenticateJWT,
  validateRequest({
    body: z.object({
      oldPassword: z.string(),
      newPassword: z.string().min(8).max(100),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body;

      const success = await authService.changePassword(req.user!.userId, oldPassword, newPassword);

      if (!success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PASSWORD_CHANGE_FAILED',
            message: 'Failed to change password',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }

      res.json({
        success: true,
        data: { message: 'Password changed successfully' },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error: any) {
      if (error.message?.includes('Invalid old password')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OLD_PASSWORD',
            message: error.message,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }
      next(error);
    }
  }
);

export default router;
