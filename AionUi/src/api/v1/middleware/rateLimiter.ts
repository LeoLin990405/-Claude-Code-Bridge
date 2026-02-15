/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 速率限制中间件 - 防止暴力破解和滥用
 */

import rateLimit from 'express-rate-limit';

/**
 * 严格速率限制 - 用于登录、注册等敏感操作
 * 15 分钟内最多 5 次请求
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 最多 5 次请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '请求过于频繁，请稍后再试',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  },
  standardHeaders: true, // 返回 RateLimit-* headers
  legacyHeaders: false, // 禁用 X-RateLimit-* headers
  skipSuccessfulRequests: false, // 成功的请求也计数
});

/**
 * 中等速率限制 - 用于密码重置请求
 * 15 分钟内最多 3 次请求
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 3, // 最多 3 次请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '密码重置请求过于频繁，请稍后再试',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 只有失败的请求计数
});

/**
 * 2FA 验证速率限制 - 防止暴力破解验证码
 * 5 分钟内最多 5 次请求
 */
export const twoFactorRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分钟
  max: 5, // 最多 5 次请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '验证码尝试次数过多，请稍后再试',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * 通用 API 速率限制
 * 15 分钟内最多 100 次请求
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 最多 100 次请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'API 请求过于频繁，请稍后再试',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * OAuth 回调速率限制
 * 1 分钟内最多 10 次请求
 */
export const oauthRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 分钟
  max: 10, // 最多 10 次请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'OAuth 请求过于频繁',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
