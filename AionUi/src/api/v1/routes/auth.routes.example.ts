/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * EXAMPLE: Auth routes with database integration
 * This file shows how to integrate UserService into auth.routes.ts
 * Copy the implementations below to replace TODO comments in auth.routes.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  registerRequestSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
} from '../schemas/auth';
import { validateRequest } from '../middleware/validate';
import { authenticateJWT } from '../middleware/auth';
import { userService } from '../../../database/services';
import {
  generateTokenPair,
  generateRandomToken,
  getRefreshTokenExpiration,
  verifyRefreshToken,
} from '../../../database/utils/jwt.util';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register new user
 */
router.post(
  '/register',
  validateRequest({ body: registerRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password, displayName } = req.body;

      // Create user using service
      const user = await userService.register({
        username,
        email,
        password,
        displayName,
      });

      // Generate JWT tokens
      const { accessToken, refreshToken: jwtRefreshToken, expiresIn } = generateTokenPair({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      // Generate and store refresh token hash
      const refreshTokenHash = generateRandomToken();
      await userService.createRefreshToken(
        user.id,
        refreshTokenHash,
        getRefreshTokenExpiration()
      );

      res.status(201).json({
        success: true,
        data: {
          accessToken,
          refreshToken: refreshTokenHash,
          expiresIn,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            displayName: user.displayName,
            createdAt: user.createdAt,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error: any) {
      // Handle duplicate username/email
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: error.message,
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
  validateRequest({ body: loginRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body;

      // Authenticate user
      const user = await userService.authenticate(username, password);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password',
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        });
      }

      // Generate JWT tokens
      const { accessToken, refreshToken: jwtRefreshToken, expiresIn } = generateTokenPair({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      // Generate and store refresh token hash
      const refreshTokenHash = generateRandomToken();
      await userService.createRefreshToken(
        user.id,
        refreshTokenHash,
        getRefreshTokenExpiration()
      );

      res.json({
        success: true,
        data: {
          accessToken,
          refreshToken: refreshTokenHash,
          expiresIn,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          },
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
 * POST /api/v1/auth/logout
 * Logout (invalidate refresh token)
 */
router.post(
  '/logout',
  authenticateJWT,
  validateRequest({ body: refreshTokenRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      // Revoke refresh token
      await userService.revokeRefreshToken(refreshToken);

      res.json({
        success: true,
        data: {
          message: 'Logged out successfully',
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
 * POST /api/v1/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  validateRequest({ body: refreshTokenRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      // Validate refresh token
      const storedToken = await userService.validateRefreshToken(refreshToken);

      if (!storedToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token',
          },
        });
      }

      // Get user
      const user = await userService.getUserById(storedToken.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      // Generate new access token
      const { accessToken, expiresIn } = generateTokenPair({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      res.json({
        success: true,
        data: {
          accessToken,
          expiresIn,
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
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get('/me', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Don't expose password hash
    const { passwordHash, twoFactorSecret, ...safeUser } = user;

    res.json({
      success: true,
      data: safeUser,
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
 * Update current user profile
 */
router.patch('/me', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { displayName, avatarUrl, bio, preferences } = req.body;

    const user = await userService.updateProfile(req.user!.userId, {
      displayName,
      avatarUrl,
      bio,
      preferences,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Don't expose password hash
    const { passwordHash, twoFactorSecret, ...safeUser } = user;

    res.json({
      success: true,
      data: safeUser,
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
 * POST /api/v1/auth/change-password
 * Change user password
 */
router.post(
  '/change-password',
  authenticateJWT,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body;

      await userService.changePassword(req.user!.userId, oldPassword, newPassword);

      res.json({
        success: true,
        data: {
          message: 'Password changed successfully',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error: any) {
      if (error.message === 'Invalid old password') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }
);

export default router;
