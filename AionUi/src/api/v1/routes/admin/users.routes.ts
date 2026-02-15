/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 管理员 - 用户管理路由
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import { UserService } from '../../../../database/services/user.service';
import { PasswordResetService } from '../../../../database/services/passwordReset.service';
import { db } from '../../../../database/db';
import { users } from '../../../../database/schema/users';
import { desc, sql, eq } from 'drizzle-orm';

const router = Router();
const userService = new UserService();
const passwordResetService = new PasswordResetService();

// 所有管理员路由都需要 admin 角色
router.use(authenticateJWT, requireRole('admin'));

/**
 * GET /api/v1/admin/users
 * 获取所有用户列表（分页）
 */
router.get(
  '/',
  validateRequest({
    query: z.object({
      page: z.string().transform(Number).pipe(z.number().min(1)).optional().default('1'),
      limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default('20'),
      search: z.string().optional(),
      role: z.enum(['admin', 'user']).optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, search, role } = req.query as any;
      const offset = (page - 1) * limit;

      // 构建查询
      let query = db.select().from(users);

      if (role) {
        query = query.where(eq(users.role, role)) as any;
      }

      // TODO: 添加搜索功能（username, email）

      const allUsers = await query.orderBy(desc(users.createdAt)).limit(limit).offset(offset);

      // 获取总数
      const totalResult = await db.select({ count: sql<number>`count(*)` }).from(users);
      const total = Number(totalResult[0].count);

      res.json({
        success: true,
        data: {
          users: allUsers.map((user) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            displayName: user.displayName,
            avatar: user.avatar,
            emailVerified: user.emailVerified,
            twoFactorEnabled: user.twoFactorEnabled,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
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
 * GET /api/v1/admin/users/:id
 * 获取指定用户详细信息
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await userService.getUserById(id);

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
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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
 * PATCH /api/v1/admin/users/:id
 * 更新用户信息（管理员）
 */
router.patch(
  '/:id',
  validateRequest({
    body: z.object({
      email: z.string().email().optional(),
      role: z.enum(['admin', 'user']).optional(),
      displayName: z.string().optional(),
      emailVerified: z.boolean().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const updatedUser = await db
        .update(users)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser.length) {
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
          id: updatedUser[0].id,
          username: updatedUser[0].username,
          email: updatedUser[0].email,
          role: updatedUser[0].role,
          displayName: updatedUser[0].displayName,
          emailVerified: updatedUser[0].emailVerified,
          updatedAt: updatedUser[0].updatedAt,
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
 * DELETE /api/v1/admin/users/:id
 * 删除用户（软删除或硬删除）
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 硬删除用户（级联删除所有关联数据）
    const deletedUser = await db.delete(users).where(eq(users.id, id)).returning();

    if (!deletedUser.length) {
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
      data: { message: 'User deleted successfully' },
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
 * POST /api/v1/admin/users/:id/reset-password
 * 管理员重置用户密码
 */
router.post('/:id/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await userService.getUserById(id);

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

    // 生成密码重置 token
    const token = await passwordResetService.createResetToken(user.email);

    if (!token) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'TOKEN_GENERATION_FAILED',
          message: 'Failed to generate reset token',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    }

    // TODO: 发送密码重置邮件
    console.log(`[管理员密码重置] Token: ${token} for user ${user.email}`);

    res.json({
      success: true,
      data: {
        message: 'Password reset email sent to user',
        resetToken: token, // 仅开发环境返回（生产环境应该只发邮件）
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

export default router;
