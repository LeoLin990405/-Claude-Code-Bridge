/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * WebSocket Monitoring Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { getCurrentManager } from '@/webserver/adapter';
import type { SocketIOManager } from '@/webserver/websocket/SocketIOManager';
import crypto from 'crypto';

const router = Router();

/**
 * Require admin role middleware
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }
  next();
}

/**
 * GET /api/v1/websocket/stats
 * Get WebSocket connection statistics
 */
router.get('/stats', authenticateJWT, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manager = getCurrentManager();

    if (!manager) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'WebSocket manager not initialized',
        },
      });
    }

    const connectedClients = manager.getConnectedClientsCount();

    // Get room information if using Socket.IO
    let rooms: any[] = [];
    if ('getRoomClients' in manager) {
      const socketIOManager = manager as SocketIOManager;
      const io = socketIOManager.getIO();

      if (io) {
        // Get all rooms
        const allRooms = io.sockets.adapter.rooms;

        for (const [roomName, socketIds] of allRooms.entries()) {
          // Skip user-specific rooms (they match socket IDs)
          if (io.sockets.sockets.has(roomName)) {
            continue;
          }

          rooms.push({
            name: roomName,
            memberCount: socketIds.size,
            members: Array.from(socketIds),
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        connectedClients,
        rooms,
        roomCount: rooms.length,
        timestamp: new Date().toISOString(),
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
 * GET /api/v1/websocket/rooms/:roomName
 * Get clients in a specific room
 */
router.get('/rooms/:roomName', authenticateJWT, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomName } = req.params;
    const manager = getCurrentManager();

    if (!manager || !('getRoomClients' in manager)) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Socket.IO manager not available',
        },
      });
    }

    const socketIOManager = manager as SocketIOManager;
    const clients = await socketIOManager.getRoomClients(roomName);

    res.json({
      success: true,
      data: {
        roomName,
        clients,
        clientCount: clients.length,
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
 * POST /api/v1/websocket/broadcast
 * Broadcast a message to all connected clients (admin only)
 */
router.post('/broadcast', authenticateJWT, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Event name is required',
        },
      });
    }

    const manager = getCurrentManager();

    if (!manager) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'WebSocket manager not initialized',
        },
      });
    }

    manager.broadcast(event, data);

    res.json({
      success: true,
      data: {
        message: 'Broadcast sent successfully',
        event,
        recipientCount: manager.getConnectedClientsCount(),
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
 * POST /api/v1/websocket/broadcast/user/:userId
 * Broadcast a message to a specific user (admin only)
 */
router.post('/broadcast/user/:userId', authenticateJWT, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Event name is required',
        },
      });
    }

    const manager = getCurrentManager();

    if (!manager || !('broadcastToUser' in manager)) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Socket.IO manager not available',
        },
      });
    }

    const socketIOManager = manager as SocketIOManager;
    socketIOManager.broadcastToUser(userId, event, data);

    res.json({
      success: true,
      data: {
        message: 'Broadcast sent to user successfully',
        event,
        userId,
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
 * POST /api/v1/websocket/broadcast/room/:roomName
 * Broadcast a message to a specific room (admin only)
 */
router.post('/broadcast/room/:roomName', authenticateJWT, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomName } = req.params;
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Event name is required',
        },
      });
    }

    const manager = getCurrentManager();

    if (!manager || !('broadcastToRoom' in manager)) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Socket.IO manager not available',
        },
      });
    }

    const socketIOManager = manager as SocketIOManager;
    socketIOManager.broadcastToRoom(roomName, event, data);

    res.json({
      success: true,
      data: {
        message: 'Broadcast sent to room successfully',
        event,
        roomName,
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
 * GET /api/v1/websocket/health
 * WebSocket health check
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const manager = getCurrentManager();

    const isHealthy = manager !== null;
    const connectedClients = manager?.getConnectedClientsCount() ?? 0;

    res.json({
      success: true,
      data: {
        healthy: isHealthy,
        connectedClients,
        timestamp: new Date().toISOString(),
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
