/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Socket.IO Event Types and Interfaces
 */

/**
 * Server to Client Events
 * Events sent from server to client
 */
export interface ServerToClientEvents {
  // Connection events
  'auth-expired': (data: { message: string }) => void;
  ping: (data: { timestamp: number }) => void;

  // Message events
  'message:new': (data: MessageEvent) => void;
  'message:update': (data: MessageEvent) => void;
  'message:delete': (data: { messageId: string }) => void;

  // Conversation events
  'conversation:new': (data: ConversationEvent) => void;
  'conversation:update': (data: ConversationEvent) => void;
  'conversation:delete': (data: { conversationId: string }) => void;

  // Status events
  'status:typing': (data: TypingEvent) => void;
  'status:online': (data: UserStatusEvent) => void;
  'status:offline': (data: UserStatusEvent) => void;

  // File events
  'file:uploaded': (data: FileEvent) => void;
  'file:progress': (data: FileProgressEvent) => void;

  // System events
  'system:notification': (data: NotificationEvent) => void;
  'system:error': (data: ErrorEvent) => void;

  // File selection (Electron specific)
  'show-open-request': (data: FileSelectionRequest) => void;
}

/**
 * Client to Server Events
 * Events sent from client to server
 */
export interface ClientToServerEvents {
  // Connection events
  pong: (data: { timestamp: number }) => void;
  'auth:refresh': (data: { refreshToken: string }) => void;

  // Message events
  'message:send': (data: SendMessageRequest, callback: (response: MessageResponse) => void) => void;
  'message:edit': (data: EditMessageRequest, callback: (response: MessageResponse) => void) => void;

  // Conversation events
  'conversation:join': (data: { conversationId: string }) => void;
  'conversation:leave': (data: { conversationId: string }) => void;

  // Typing indicators
  'typing:start': (data: { conversationId: string }) => void;
  'typing:stop': (data: { conversationId: string }) => void;

  // File operations
  'file:upload:start': (data: FileUploadStartRequest) => void;
  'file:upload:chunk': (data: FileChunkData) => void;
  'file:upload:complete': (data: { uploadId: string }) => void;

  // Subscription events
  'subscribe-show-open': (data: FileSelectionRequest) => void;
}

/**
 * Inter-Server Events
 * Events for server-to-server communication (for future clustering)
 */
export interface InterServerEvents {
  'cluster:sync': (data: { nodeId: string; timestamp: number }) => void;
}

/**
 * Socket Data
 * Custom data stored in socket.data
 */
export interface SocketData {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  token: string;
  connectedAt: number;
}

/**
 * Message Event Data
 */
export interface MessageEvent {
  messageId: string;
  conversationId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Conversation Event Data
 */
export interface ConversationEvent {
  conversationId: string;
  name: string;
  participants: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

/**
 * Typing Event Data
 */
export interface TypingEvent {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

/**
 * User Status Event Data
 */
export interface UserStatusEvent {
  userId: string;
  username: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: number;
}

/**
 * File Event Data
 */
export interface FileEvent {
  fileId: string;
  filename: string;
  size: number;
  mimetype: string;
  uploadedBy: string;
  uploadedAt: number;
  url: string;
}

/**
 * File Progress Event Data
 */
export interface FileProgressEvent {
  uploadId: string;
  filename: string;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

/**
 * Notification Event Data
 */
export interface NotificationEvent {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Error Event Data
 */
export interface ErrorEvent {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

/**
 * Send Message Request
 */
export interface SendMessageRequest {
  conversationId: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Edit Message Request
 */
export interface EditMessageRequest {
  messageId: string;
  content: string;
}

/**
 * Message Response
 */
export interface MessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * File Upload Start Request
 */
export interface FileUploadStartRequest {
  filename: string;
  size: number;
  mimetype: string;
  conversationId?: string;
}

/**
 * File Chunk Data
 */
export interface FileChunkData {
  uploadId: string;
  chunk: Buffer | string;
  offset: number;
  isLast: boolean;
}

/**
 * File Selection Request
 */
export interface FileSelectionRequest {
  properties?: string[];
  isFileMode?: boolean;
  data?: any;
}

/**
 * Socket.IO Namespace Names
 */
export const NAMESPACES = {
  DEFAULT: '/',
  CONVERSATIONS: '/conversations',
  NOTIFICATIONS: '/notifications',
  ADMIN: '/admin',
} as const;

/**
 * Room Names
 */
export const ROOMS = {
  // Conversation rooms: conversation:{conversationId}
  conversation: (conversationId: string) => `conversation:${conversationId}`,

  // User rooms: user:{userId}
  user: (userId: string) => `user:${userId}`,

  // Admin room
  admin: 'admin-room',

  // Global broadcast
  all: 'all-users',
} as const;

/**
 * Event Names
 */
export const EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTH_EXPIRED: 'auth-expired',

  // Heartbeat
  PING: 'ping',
  PONG: 'pong',

  // Messages
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  MESSAGE_SEND: 'message:send',
  MESSAGE_EDIT: 'message:edit',

  // Conversations
  CONVERSATION_NEW: 'conversation:new',
  CONVERSATION_UPDATE: 'conversation:update',
  CONVERSATION_DELETE: 'conversation:delete',
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',

  // Typing
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  STATUS_TYPING: 'status:typing',

  // User Status
  STATUS_ONLINE: 'status:online',
  STATUS_OFFLINE: 'status:offline',

  // Files
  FILE_UPLOADED: 'file:uploaded',
  FILE_PROGRESS: 'file:progress',
  FILE_UPLOAD_START: 'file:upload:start',
  FILE_UPLOAD_CHUNK: 'file:upload:chunk',
  FILE_UPLOAD_COMPLETE: 'file:upload:complete',

  // System
  SYSTEM_NOTIFICATION: 'system:notification',
  SYSTEM_ERROR: 'system:error',

  // Special
  SHOW_OPEN_REQUEST: 'show-open-request',
  SUBSCRIBE_SHOW_OPEN: 'subscribe-show-open',
} as const;
