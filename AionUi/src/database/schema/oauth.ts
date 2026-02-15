/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * OAuth 账户和密码重置 Schema
 */

import { pgTable, uuid, varchar, text, timestamp, index, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { users } from './users';

/**
 * OAuth 账户表 - 存储 Google、GitHub 等第三方登录信息
 */
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(), // 'google', 'github'
    providerId: varchar('provider_id', { length: 255 }).notNull(), // OAuth provider 的用户 ID
    email: varchar('email', { length: 255 }),
    displayName: varchar('display_name', { length: 200 }),
    avatar: text('avatar'),
    accessToken: text('access_token'), // OAuth access token（加密存储）
    refreshToken: text('refresh_token'), // OAuth refresh token（加密存储）
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    raw: text('raw'), // 原始 OAuth profile JSON
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('oauth_accounts_user_id_idx').on(table.userId),
    providerIdx: index('oauth_accounts_provider_idx').on(table.provider, table.providerId),
  })
);

/**
 * 密码重置 token 表
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    used: boolean('used').notNull().default(false),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('password_reset_tokens_user_id_idx').on(table.userId),
    tokenIdx: index('password_reset_tokens_token_idx').on(table.token),
  })
);

// Zod schemas
export const insertOAuthAccountSchema = createInsertSchema(oauthAccounts);
export const selectOAuthAccountSchema = createSelectSchema(oauthAccounts);

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens);
export const selectPasswordResetTokenSchema = createSelectSchema(passwordResetTokens);

// Types
export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
