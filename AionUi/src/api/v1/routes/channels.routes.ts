/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { paginationQuerySchema } from '../schemas/common';
import { validateRequest } from '../middleware/validate';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// All channels routes require authentication
router.use(authenticateJWT);

/**
 * GET /api/v1/channels
 * List all communication channels
 */
router.get(
  '/',
  validateRequest({
    query: paginationQuerySchema.extend({
      type: z.enum(['agent', 'broadcast', 'direct']).optional(),
      active: z.coerce.boolean().optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, type, active } = req.query as any;

      // TODO: Fetch from channels service
      // const channels = await channelsService.list({ type, active }, page, pageSize)

      // Mock data
      const mockChannels = [
        {
          id: crypto.randomUUID(),
          name: 'gemini-codex-sync',
          displayName: 'Gemini ↔ Codex Sync',
          description: 'Synchronize context between Gemini and Codex agents',
          type: 'agent' as const,
          participants: [
            { id: crypto.randomUUID(), name: 'gemini', type: 'agent' },
            { id: crypto.randomUUID(), name: 'codex', type: 'agent' },
          ],
          active: true,
          messageCount: 1247,
          lastMessageAt: new Date(Date.now() - 600000).toISOString(), // 10 min ago
          createdAt: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
          updatedAt: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          name: 'system-broadcast',
          displayName: 'System Broadcast',
          description: 'System-wide announcements and updates',
          type: 'broadcast' as const,
          participants: [
            { id: crypto.randomUUID(), name: 'system', type: 'system' },
            { id: crypto.randomUUID(), name: 'all-agents', type: 'group' },
          ],
          active: true,
          messageCount: 42,
          lastMessageAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          createdAt: new Date(Date.now() - 7776000000).toISOString(), // 90 days ago
          updatedAt: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          name: 'acp-team-coordination',
          displayName: 'ACP Team Coordination',
          description: 'Multi-agent task coordination for complex projects',
          type: 'agent' as const,
          participants: [
            { id: crypto.randomUUID(), name: 'acp-1', type: 'agent' },
            { id: crypto.randomUUID(), name: 'acp-2', type: 'agent' },
            { id: crypto.randomUUID(), name: 'acp-3', type: 'agent' },
          ],
          active: true,
          messageCount: 567,
          lastMessageAt: new Date(Date.now() - 300000).toISOString(), // 5 min ago
          createdAt: new Date(Date.now() - 604800000).toISOString(), // 7 days ago
          updatedAt: new Date().toISOString(),
        },
      ];

      const totalItems = mockChannels.length;
      const totalPages = Math.ceil(totalItems / pageSize);

      res.json({
        success: true,
        data: mockChannels,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalItems,
          hasNext: page < totalPages,
          hasPrev: page > 1,
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
 * POST /api/v1/channels
 * Create new communication channel
 */
router.post(
  '/',
  validateRequest({
    body: z.object({
      name: z.string().min(1).max(100),
      displayName: z.string().min(1).max(200),
      description: z.string().optional(),
      type: z.enum(['agent', 'broadcast', 'direct']),
      participants: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          type: z.enum(['agent', 'user', 'system', 'group']),
        })
      ),
      metadata: z.record(z.any()).optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      // TODO: Create channel in service
      // const channel = await channelsService.create(data)

      // Mock response
      const channel = {
        id: crypto.randomUUID(),
        ...data,
        active: true,
        messageCount: 0,
        lastMessageAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      res.status(201).json({
        success: true,
        data: channel,
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
 * GET /api/v1/channels/:id
 * Get channel details
 */
router.get(
  '/:id',
  validateRequest({ params: z.object({ id: z.string().uuid() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // TODO: Fetch from service
      // const channel = await channelsService.getById(id)

      // Mock data
      const channel = {
        id,
        name: 'gemini-codex-sync',
        displayName: 'Gemini ↔ Codex Sync',
        description: 'Synchronize context between Gemini and Codex agents',
        type: 'agent' as const,
        participants: [
          { id: crypto.randomUUID(), name: 'gemini', type: 'agent', status: 'online' },
          { id: crypto.randomUUID(), name: 'codex', type: 'agent', status: 'online' },
        ],
        active: true,
        messageCount: 1247,
        lastMessageAt: new Date(Date.now() - 600000).toISOString(),
        metadata: {
          syncInterval: 300000, // 5 min
          autoReconnect: true,
        },
        createdAt: new Date(Date.now() - 2592000000).toISOString(),
        updatedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: channel,
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
 * PATCH /api/v1/channels/:id
 * Update channel configuration
 */
router.patch(
  '/:id',
  validateRequest({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      displayName: z.string().optional(),
      description: z.string().optional(),
      active: z.boolean().optional(),
      participants: z
        .array(
          z.object({
            id: z.string().uuid(),
            name: z.string(),
            type: z.enum(['agent', 'user', 'system', 'group']),
          })
        )
        .optional(),
      metadata: z.record(z.any()).optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // TODO: Update channel in service
      // const channel = await channelsService.update(id, updates)

      // Mock response
      const channel = {
        id,
        name: 'gemini-codex-sync',
        displayName: updates.displayName || 'Gemini ↔ Codex Sync',
        description: updates.description || 'Synchronize context between Gemini and Codex agents',
        type: 'agent' as const,
        participants:
          updates.participants || [
            { id: crypto.randomUUID(), name: 'gemini', type: 'agent' },
            { id: crypto.randomUUID(), name: 'codex', type: 'agent' },
          ],
        active: updates.active ?? true,
        messageCount: 1247,
        lastMessageAt: new Date(Date.now() - 600000).toISOString(),
        metadata: updates.metadata,
        createdAt: new Date(Date.now() - 2592000000).toISOString(),
        updatedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: channel,
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
 * DELETE /api/v1/channels/:id
 * Delete channel
 */
router.delete(
  '/:id',
  validateRequest({ params: z.object({ id: z.string().uuid() }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // TODO: Delete channel and clean up messages
      // await channelsService.delete(id)

      res.json({
        success: true,
        data: { id, deleted: true },
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
 * POST /api/v1/channels/:id/message
 * Send message to channel
 */
router.post(
  '/:id/message',
  validateRequest({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      content: z.string().min(1),
      senderId: z.string().uuid(),
      senderName: z.string(),
      senderType: z.enum(['agent', 'user', 'system']),
      metadata: z.record(z.any()).optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content, senderId, senderName, senderType, metadata, priority } = req.body;

      // TODO: Send message via channels service
      // const message = await channelsService.sendMessage(id, { content, senderId, ... })

      // Mock response
      const message = {
        id: crypto.randomUUID(),
        channelId: id,
        content,
        senderId,
        senderName,
        senderType,
        metadata,
        priority,
        status: 'delivered' as const,
        sentAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        readBy: [],
      };

      res.status(201).json({
        success: true,
        data: message,
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
 * GET /api/v1/channels/:id/messages
 * Get messages from channel
 */
router.get(
  '/:id/messages',
  validateRequest({
    params: z.object({ id: z.string().uuid() }),
    query: paginationQuerySchema.extend({
      since: z.string().datetime().optional(),
      senderType: z.enum(['agent', 'user', 'system']).optional(),
    }),
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { page, pageSize, since, senderType } = req.query as any;

      // TODO: Fetch messages from service
      // const messages = await channelsService.getMessages(id, { since, senderType }, page, pageSize)

      // Mock data
      const messages = [
        {
          id: crypto.randomUUID(),
          channelId: id,
          content: 'Task completed: analyzed 150 files',
          senderId: crypto.randomUUID(),
          senderName: 'gemini',
          senderType: 'agent' as const,
          priority: 'normal' as const,
          status: 'delivered' as const,
          sentAt: new Date(Date.now() - 600000).toISOString(),
          deliveredAt: new Date(Date.now() - 600000).toISOString(),
          readBy: [crypto.randomUUID()],
        },
        {
          id: crypto.randomUUID(),
          channelId: id,
          content: 'Synchronizing context with new conversation',
          senderId: crypto.randomUUID(),
          senderName: 'codex',
          senderType: 'agent' as const,
          priority: 'high' as const,
          status: 'delivered' as const,
          sentAt: new Date(Date.now() - 300000).toISOString(),
          deliveredAt: new Date(Date.now() - 300000).toISOString(),
          readBy: [],
        },
      ];

      const totalItems = messages.length;
      const totalPages = Math.ceil(totalItems / pageSize);

      res.json({
        success: true,
        data: messages,
        pagination: {
          page,
          pageSize,
          totalPages,
          totalItems,
          hasNext: page < totalPages,
          hasPrev: page > 1,
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

export default router;
