/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Socket.IO Manager - Enhanced WebSocket management with Socket.IO
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { TokenMiddleware } from '../auth/middleware/TokenMiddleware';
import { WEBSOCKET_CONFIG } from '../config/constants';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  SendMessageRequest,
  EditMessageRequest,
  MessageResponse,
  TypingEvent,
  FileSelectionRequest,
} from './types';
import { NAMESPACES, ROOMS, EVENTS } from './types';

/**
 * Type-safe Socket.IO Server
 */
type TypedSocketIOServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Type-safe Socket
 */
type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Socket.IO Manager
 * Manages real-time communication with enhanced features
 */
export class SocketIOManager {
  private io: TypedSocketIOServer | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer: HTTPServer): void {
    // Create Socket.IO server with CORS configuration
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      },
      pingInterval: WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL,
      pingTimeout: WEBSOCKET_CONFIG.HEARTBEAT_TIMEOUT,
      transports: ['websocket', 'polling'],
    });

    // Set up middleware
    this.setupMiddleware();

    // Set up connection handlers
    this.setupConnectionHandler();

    // Start heartbeat monitoring
    this.startHeartbeat();

    console.log('[SocketIOManager] Initialized');
  }

  /**
   * Set up authentication middleware
   */
  private setupMiddleware(): void {
    if (!this.io) return;

    // Authentication middleware
    this.io.use((socket: TypedSocket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication error: No token provided'));
      }

      // Validate token
      if (!TokenMiddleware.validateWebSocketToken(token)) {
        return next(new Error('Authentication error: Invalid or expired token'));
      }

      // Decode token to get user info
      try {
        const payload = TokenMiddleware.decodeToken(token);

        // Store user data in socket
        socket.data.userId = payload.userId;
        socket.data.username = payload.username;
        socket.data.role = payload.role;
        socket.data.token = token;
        socket.data.connectedAt = Date.now();

        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token payload'));
      }
    });

    console.log('[SocketIOManager] Middleware configured');
  }

  /**
   * Set up connection handler
   */
  private setupConnectionHandler(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: TypedSocket) => {
      const { userId, username } = socket.data;

      console.log(`[SocketIOManager] Client connected: ${username} (${userId})`);

      // Join user-specific room
      socket.join(ROOMS.user(userId));

      // Join 'all users' room
      socket.join(ROOMS.all);

      // Set up event handlers
      this.setupEventHandlers(socket);

      // Notify user is online
      this.broadcastUserStatus(socket, 'online');

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`[SocketIOManager] Client disconnected: ${username} (${reason})`);
        this.broadcastUserStatus(socket, 'offline');
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error('[SocketIOManager] Socket error:', error);
      });
    });
  }

  /**
   * Set up event handlers for a socket
   */
  private setupEventHandlers(socket: TypedSocket): void {
    // Heartbeat
    socket.on(EVENTS.PONG, (data) => {
      // Client responded to ping - connection is healthy
      socket.data.connectedAt = Date.now();
    });

    // Auth refresh
    socket.on('auth:refresh', async (data) => {
      try {
        // Validate new token
        if (!TokenMiddleware.validateWebSocketToken(data.refreshToken)) {
          socket.emit(EVENTS.AUTH_EXPIRED, { message: 'Invalid refresh token' });
          socket.disconnect();
          return;
        }

        // Update stored token
        socket.data.token = data.refreshToken;
        console.log(`[SocketIOManager] Token refreshed for ${socket.data.username}`);
      } catch (error) {
        socket.emit(EVENTS.AUTH_EXPIRED, { message: 'Token refresh failed' });
        socket.disconnect();
      }
    });

    // Message events
    socket.on(EVENTS.MESSAGE_SEND, (data: SendMessageRequest, callback) => {
      this.handleSendMessage(socket, data, callback);
    });

    socket.on(EVENTS.MESSAGE_EDIT, (data: EditMessageRequest, callback) => {
      this.handleEditMessage(socket, data, callback);
    });

    // Conversation events
    socket.on(EVENTS.CONVERSATION_JOIN, (data) => {
      const roomName = ROOMS.conversation(data.conversationId);
      socket.join(roomName);
      console.log(`[SocketIOManager] ${socket.data.username} joined conversation ${data.conversationId}`);
    });

    socket.on(EVENTS.CONVERSATION_LEAVE, (data) => {
      const roomName = ROOMS.conversation(data.conversationId);
      socket.leave(roomName);
      console.log(`[SocketIOManager] ${socket.data.username} left conversation ${data.conversationId}`);
    });

    // Typing indicators
    socket.on(EVENTS.TYPING_START, (data) => {
      this.handleTypingIndicator(socket, data.conversationId, true);
    });

    socket.on(EVENTS.TYPING_STOP, (data) => {
      this.handleTypingIndicator(socket, data.conversationId, false);
    });

    // File upload events
    socket.on(EVENTS.FILE_UPLOAD_START, (data) => {
      console.log(`[SocketIOManager] File upload started: ${data.filename}`);
      // TODO: Implement file upload handling
    });

    // File selection (Electron specific)
    socket.on(EVENTS.SUBSCRIBE_SHOW_OPEN, (data: FileSelectionRequest) => {
      this.handleFileSelection(socket, data);
    });
  }

  /**
   * Handle send message event
   */
  private handleSendMessage(
    socket: TypedSocket,
    data: SendMessageRequest,
    callback: (response: MessageResponse) => void
  ): void {
    try {
      // Validate data
      if (!data.conversationId || !data.content) {
        callback({ success: false, error: 'Missing required fields' });
        return;
      }

      // Create message event
      const messageEvent = {
        messageId: `msg_${Date.now()}_${socket.data.userId}`,
        conversationId: data.conversationId,
        userId: socket.data.userId,
        username: socket.data.username,
        content: data.content,
        timestamp: Date.now(),
        metadata: data.metadata,
      };

      // Broadcast to conversation room
      const roomName = ROOMS.conversation(data.conversationId);
      this.io!.to(roomName).emit(EVENTS.MESSAGE_NEW, messageEvent);

      // Send acknowledgment
      callback({ success: true, messageId: messageEvent.messageId });

      console.log(`[SocketIOManager] Message sent in conversation ${data.conversationId}`);
    } catch (error) {
      console.error('[SocketIOManager] Error sending message:', error);
      callback({ success: false, error: 'Failed to send message' });
    }
  }

  /**
   * Handle edit message event
   */
  private handleEditMessage(
    socket: TypedSocket,
    data: EditMessageRequest,
    callback: (response: MessageResponse) => void
  ): void {
    try {
      // TODO: Implement message edit logic
      // For now, just acknowledge
      callback({ success: true, messageId: data.messageId });

      console.log(`[SocketIOManager] Message ${data.messageId} edited`);
    } catch (error) {
      console.error('[SocketIOManager] Error editing message:', error);
      callback({ success: false, error: 'Failed to edit message' });
    }
  }

  /**
   * Handle typing indicator
   */
  private handleTypingIndicator(socket: TypedSocket, conversationId: string, isTyping: boolean): void {
    const typingEvent: TypingEvent = {
      conversationId,
      userId: socket.data.userId,
      username: socket.data.username,
      isTyping,
    };

    // Broadcast to conversation room (except sender)
    const roomName = ROOMS.conversation(conversationId);
    socket.to(roomName).emit(EVENTS.STATUS_TYPING, typingEvent);
  }

  /**
   * Handle file selection request
   */
  private handleFileSelection(socket: TypedSocket, data: FileSelectionRequest): void {
    // Extract properties from nested data structure
    const actualData = data.data || data;
    const properties = actualData.properties;

    // Determine if this is file selection mode
    const isFileMode = properties && properties.includes('openFile') && !properties.includes('openDirectory');

    // Send file selection request to client with isFileMode flag
    socket.emit(EVENTS.SHOW_OPEN_REQUEST, { ...data, isFileMode });
  }

  /**
   * Broadcast user status
   */
  private broadcastUserStatus(socket: TypedSocket, status: 'online' | 'offline'): void {
    const statusEvent = {
      userId: socket.data.userId,
      username: socket.data.username,
      status,
      lastSeen: status === 'offline' ? Date.now() : undefined,
    };

    // Broadcast to all users except sender
    socket.broadcast.emit(
      status === 'online' ? EVENTS.STATUS_ONLINE : EVENTS.STATUS_OFFLINE,
      statusEvent
    );
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.checkClients();
    }, WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL);

    console.log('[SocketIOManager] Heartbeat monitoring started');
  }

  /**
   * Check all clients for health and token validity
   */
  private checkClients(): void {
    if (!this.io) return;

    const sockets = this.io.sockets.sockets;

    sockets.forEach((socket: TypedSocket) => {
      // Check if token is still valid
      if (!TokenMiddleware.validateWebSocketToken(socket.data.token)) {
        console.log(`[SocketIOManager] Token expired for ${socket.data.username}, closing connection`);
        socket.emit(EVENTS.AUTH_EXPIRED, { message: 'Token expired, please login again' });
        socket.disconnect(true);
      }
    });
  }

  /**
   * Broadcast message to a specific room
   */
  broadcastToRoom(room: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(room).emit(event as any, data);
  }

  /**
   * Broadcast message to a specific user
   */
  broadcastToUser(userId: string, event: string, data: any): void {
    if (!this.io) return;
    const roomName = ROOMS.user(userId);
    this.io.to(roomName).emit(event as any, data);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(event: string, data: any): void {
    if (!this.io) return;
    this.io.to(ROOMS.all).emit(event as any, data);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    if (!this.io) return 0;
    return this.io.sockets.sockets.size;
  }

  /**
   * Get clients in a specific room
   */
  async getRoomClients(room: string): Promise<string[]> {
    if (!this.io) return [];
    const sockets = await this.io.in(room).fetchSockets();
    return sockets.map((socket) => socket.data.userId);
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): TypedSocketIOServer | null {
    return this.io;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.io) {
      this.io.close();
      this.io = null;
    }

    console.log('[SocketIOManager] Destroyed');
  }
}

export default SocketIOManager;
