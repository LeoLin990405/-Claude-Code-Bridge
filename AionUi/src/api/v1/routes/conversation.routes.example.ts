/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * EXAMPLE: Conversation routes with database integration
 * This file shows how to integrate ConversationService
 * Copy the implementations below to replace TODO comments in conversation.routes.ts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createConversationRequestSchema,
  updateConversationRequestSchema,
  listConversationsQuerySchema,
  sendMessageRequestSchema,
} from '../schemas/conversation';
import { validateRequest } from '../middleware/validate';
import { authenticateJWT } from '../middleware/auth';
import { conversationService } from '../../../database/services';

const router = Router();

// All conversation routes require authentication
router.use(authenticateJWT);

/**
 * GET /api/v1/conversations
 * List all conversations with pagination
 */
router.get(
  '/',
  validateRequest({ query: listConversationsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const query = req.query as z.infer<typeof listConversationsQuerySchema>;
      const { page = 1, pageSize = 20 } = query;

      // Fetch conversations from database
      const conversations = await conversationService.getUserConversations(userId, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      // TODO: Implement total count for accurate pagination
      const totalItems = conversations.length;
      const totalPages = Math.ceil(totalItems / pageSize);

      res.json({
        success: true,
        data: conversations,
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
 * POST /api/v1/conversations
 * Create new conversation
 */
router.post(
  '/',
  validateRequest({ body: createConversationRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const data = req.body as z.infer<typeof createConversationRequestSchema>;

      // Create conversation in database
      const conversation = await conversationService.createConversation({
        userId,
        name: data.name,
        platform: data.platform,
        model: data.model,
        systemPrompt: data.systemPrompt,
        metadata: data.metadata,
      });

      res.status(201).json({
        success: true,
        data: conversation,
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
 * GET /api/v1/conversations/:id
 * Get conversation by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    const conversation = await conversationService.getConversation(conversationId, userId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found',
        },
      });
    }

    res.json({
      success: true,
      data: conversation,
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
 * PATCH /api/v1/conversations/:id
 * Update conversation
 */
router.patch(
  '/:id',
  validateRequest({ body: updateConversationRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const conversationId = req.params.id;
      const data = req.body as z.infer<typeof updateConversationRequestSchema>;

      const conversation = await conversationService.updateConversation(
        conversationId,
        userId,
        data
      );

      res.json({
        success: true,
        data: conversation,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/conversations/:id
 * Delete conversation
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    await conversationService.deleteConversation(conversationId, userId);

    res.json({
      success: true,
      data: {
        message: 'Conversation deleted successfully',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    });
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/conversations/:id/archive
 * Archive conversation
 */
router.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    const conversation = await conversationService.archiveConversation(conversationId, userId);

    res.json({
      success: true,
      data: conversation,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    });
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/conversations/:id/unarchive
 * Unarchive conversation
 */
router.post('/:id/unarchive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    const conversation = await conversationService.unarchiveConversation(conversationId, userId);

    res.json({
      success: true,
      data: conversation,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    });
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

/**
 * GET /api/v1/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;
    const { page = 1, pageSize = 100 } = req.query;

    const messages = await conversationService.getMessages(conversationId, userId, {
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
    });

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        totalItems: messages.length,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    });
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/conversations/:id/messages
 * Send message to conversation
 */
router.post(
  '/:id/messages',
  validateRequest({ body: sendMessageRequestSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const conversationId = req.params.id;
      const data = req.body as z.infer<typeof sendMessageRequestSchema>;

      const message = await conversationService.addMessage(conversationId, userId, {
        role: data.role,
        content: data.content,
        toolCalls: data.toolCalls,
        toolCallId: data.toolCallId,
        attachments: data.attachments,
        metadata: data.metadata,
      });

      res.status(201).json({
        success: true,
        data: message,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        },
      });
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }
);

/**
 * GET /api/v1/conversations/:id/stats
 * Get conversation statistics
 */
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const conversationId = req.params.id;

    const stats = await conversationService.getConversationStats(conversationId, userId);

    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    });
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

export default router;
