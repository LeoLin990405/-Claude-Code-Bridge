/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * OAuth 路由（Google、GitHub）
 */

import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport.config';
import type { AuthResult } from '../../../database/services/auth.service';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * GET /api/v1/auth/google
 * 启动 Google OAuth 流程
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

/**
 * GET /api/v1/auth/google/callback
 * Google OAuth 回调
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
  (req: Request, res: Response) => {
    const authResult = req.user as AuthResult;

    // 重定向到前端，携带 tokens
    const redirectUrl = `${FRONTEND_URL}/auth/callback?` +
      `access_token=${authResult.accessToken}&` +
      `refresh_token=${authResult.refreshToken}&` +
      `expires_in=${authResult.expiresIn}`;

    res.redirect(redirectUrl);
  }
);

/**
 * GET /api/v1/auth/github
 * 启动 GitHub OAuth 流程
 */
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));

/**
 * GET /api/v1/auth/github/callback
 * GitHub OAuth 回调
 */
router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
  (req: Request, res: Response) => {
    const authResult = req.user as AuthResult;

    // 重定向到前端，携带 tokens
    const redirectUrl = `${FRONTEND_URL}/auth/callback?` +
      `access_token=${authResult.accessToken}&` +
      `refresh_token=${authResult.refreshToken}&` +
      `expires_in=${authResult.expiresIn}`;

    res.redirect(redirectUrl);
  }
);

export default router;
