/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 管理员路由入口
 */

import { Router } from 'express';
import usersRoutes from './users.routes';

const router = Router();

// 挂载子路由
router.use('/users', usersRoutes);

export default router;
