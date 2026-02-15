/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Passport OAuth 配置
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { OAuthService } from '../../../database/services/oauth.service';
import type { OAuthProfile } from '../../../database/services/oauth.service';

const oauthService = new OAuthService();

// Google OAuth 配置
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8765/api/v1/auth/google/callback';

// GitHub OAuth 配置
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:8765/api/v1/auth/github/callback';

/**
 * 配置 Google OAuth 策略
 */
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const oauthProfile: OAuthProfile = {
            provider: 'google',
            providerId: profile.id,
            email: profile.emails?.[0]?.value || '',
            displayName: profile.displayName,
            avatar: profile.photos?.[0]?.value,
            raw: profile,
          };

          const authResult = await oauthService.loginOrRegister(oauthProfile);
          done(null, authResult);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
} else {
  console.warn('[OAuth] Google OAuth 未配置 - 缺少 GOOGLE_CLIENT_ID 或 GOOGLE_CLIENT_SECRET');
}

/**
 * 配置 GitHub OAuth 策略
 */
if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: GITHUB_CALLBACK_URL,
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          const oauthProfile: OAuthProfile = {
            provider: 'github',
            providerId: profile.id,
            email: profile.emails?.[0]?.value || `${profile.username}@github.com`,
            displayName: profile.displayName || profile.username,
            avatar: profile.photos?.[0]?.value,
            raw: profile,
          };

          const authResult = await oauthService.loginOrRegister(oauthProfile);
          done(null, authResult);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
} else {
  console.warn('[OAuth] GitHub OAuth 未配置 - 缺少 GITHUB_CLIENT_ID 或 GITHUB_CLIENT_SECRET');
}

export default passport;
