/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 认证流程集成测试
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Mock API base URL
const API_BASE_URL = process.env.API_URL || 'http://localhost:8765/api/v1';

describe('认证流程集成测试', () => {
  let accessToken: string;
  let refreshToken: string;
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'Test1234!@#$',
  };

  describe('用户注册', () => {
    test('应该成功注册新用户', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser),
      });

      const data = await response.json();
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
      expect(data.data.user.username).toBe(testUser.username);

      accessToken = data.data.accessToken;
      refreshToken = data.data.refreshToken;
    });

    test('应该拒绝重复的用户名', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser),
      });

      const data = await response.json();
      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('USER_EXISTS');
    });
  });

  describe('用户登录', () => {
    test('应该成功登录', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUser.username,
          password: testUser.password,
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBeDefined();
    });

    test('应该拒绝错误的密码', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUser.username,
          password: 'wrongpassword',
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('获取当前用户', () => {
    test('应该返回当前用户信息', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.username).toBe(testUser.username);
      expect(data.data.email).toBe(testUser.email);
    });

    test('应该拒绝无效的 token', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('Token 刷新', () => {
    test('应该成功刷新 token', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();

      // 更新 token
      accessToken = data.data.accessToken;
      refreshToken = data.data.refreshToken;
    });

    test('应该拒绝无效的 refresh token', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'invalid-token' }),
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('密码修改', () => {
    const newPassword = 'NewPass1234!@#$';

    test('应该成功修改密码', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          oldPassword: testUser.password,
          newPassword,
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('应该能用新密码登录', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUser.username,
          password: newPassword,
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('2FA 流程', () => {
    let twoFactorSecret: string;

    test('应该生成 2FA 设置信息', async () => {
      const response = await fetch(`${API_BASE_URL}/2fa/setup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.secret).toBeDefined();
      expect(data.data.qrCode).toBeDefined();
      expect(data.data.backupCodes).toHaveLength(10);

      twoFactorSecret = data.data.secret;
    });

    // 注意：实际验证需要 TOTP token，这里只是测试流程
    test.skip('应该能启用 2FA', async () => {
      // 需要从 TOTP 生成器获取实际的 6 位验证码
      const token = '123456'; // 模拟的验证码

      const response = await fetch(`${API_BASE_URL}/2fa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          secret: twoFactorSecret,
          token,
        }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('登出', () => {
    test('应该成功登出', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('已登出的 refresh token 应该无效', async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('速率限制', () => {
    test('应该在多次失败登录后触发速率限制', async () => {
      // 连续 6 次失败登录（超过 5 次限制）
      for (let i = 0; i < 6; i++) {
        await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'nonexistent',
            password: 'wrongpassword',
          }),
        });
      }

      // 第 7 次应该被限制
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'nonexistent',
          password: 'wrongpassword',
        }),
      });

      expect(response.status).toBe(429); // Too Many Requests
    });
  });
});

describe('密码重置流程', () => {
  test('应该接受密码重置请求', async () => {
    const response = await fetch(`${API_BASE_URL}/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // 为了安全，即使邮箱不存在也返回成功
  });

  test.skip('应该能用 token 重置密码', async () => {
    // 这需要从数据库获取实际的 reset token
    const resetToken = 'mock-token';
    const newPassword = 'NewPassword123!';

    const response = await fetch(`${API_BASE_URL}/password-reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, newPassword }),
    });

    const data = await response.json();
    // 实际测试需要有效的 token
    expect([200, 400]).toContain(response.status);
  });
});
