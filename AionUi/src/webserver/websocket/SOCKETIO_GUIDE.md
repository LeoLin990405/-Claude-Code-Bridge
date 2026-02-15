# Socket.IO Implementation Guide

Complete guide for using Socket.IO in HiveMind for real-time communication.

## Overview

HiveMind uses Socket.IO for enhanced real-time communication between clients and server. Socket.IO provides:

- **Automatic Reconnection**: Clients reconnect automatically on disconnect
- **Room Support**: Group users into rooms for targeted messaging
- **Namespaces**: Separate communication channels for different features
- **Message Acknowledgments**: Confirm message delivery with callbacks
- **Type Safety**: Full TypeScript support with type-safe events

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Client (Browser/Electron)                      │
│  ┌──────────────────────────────────────────┐   │
│  │  WebSocketManager (Socket.IO client)     │   │
│  │  - Auto-reconnect                         │   │
│  │  - Event subscriptions                    │   │
│  │  - Token management                       │   │
│  └────────────┬─────────────────────────────┘   │
└────────────────┼─────────────────────────────────┘
                 │ Socket.IO Protocol
                 ▼
┌─────────────────────────────────────────────────┐
│  Server (Node.js/Express)                       │
│  ┌──────────────────────────────────────────┐   │
│  │  SocketIOManager                          │   │
│  │  - JWT Authentication                     │   │
│  │  - Room Management                        │   │
│  │  - Event Routing                          │   │
│  │  - Heartbeat Monitoring                   │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# .env or .env.production
USE_SOCKET_IO=true    # Use Socket.IO (default: true)
# USE_SOCKET_IO=false # Use native WebSocket (ws)
```

### Server Initialization

Socket.IO is automatically initialized when the server starts:

```typescript
// src/webserver/index.ts
if (useSocketIO) {
  initSocketIOAdapter(server);  // Socket.IO
} else {
  initWebAdapter(wss);          // Native ws
}
```

## Event System

### Event Categories

1. **Connection Events**: connect, disconnect, auth-expired
2. **Message Events**: message:new, message:send, message:edit
3. **Conversation Events**: conversation:join, conversation:leave
4. **Typing Events**: typing:start, typing:stop
5. **User Status**: status:online, status:offline
6. **File Events**: file:uploaded, file:progress
7. **System Events**: system:notification, system:error

### Type-Safe Events

All events are type-safe with TypeScript:

```typescript
// Server-side type definition
interface ServerToClientEvents {
  'message:new': (data: MessageEvent) => void;
  'typing:start': (data: TypingEvent) => void;
  // ... more events
}

// Client-side type definition
interface ClientToServerEvents {
  'message:send': (data: SendMessageRequest, callback: MessageResponse) => void;
  // ... more events
}
```

## Client Usage

### Basic Connection

```typescript
import { api } from '@/renderer/services/api';

// Connect to WebSocket server
api.ws.connect();

// Subscribe to events
const unsubscribe = api.ws.subscribe('message:new', (data) => {
  console.log('New message:', data);
});

// Unsubscribe when done
unsubscribe();
```

### Sending Messages

```typescript
// Emit event (no acknowledgment)
api.ws.emit('typing:start', {
  conversationId: 'conv123'
});

// For acknowledgments, use the socket directly
const socket = api.ws.getSocket();
socket?.emit('message:send', {
  conversationId: 'conv123',
  content: 'Hello World'
}, (response) => {
  if (response.success) {
    console.log('Message sent:', response.messageId);
  }
});
```

### Joining Rooms

```typescript
// Join a conversation room
api.ws.emit('conversation:join', {
  conversationId: 'conv123'
});

// Leave a conversation room
api.ws.emit('conversation:leave', {
  conversationId: 'conv123'
});
```

### Handling Events

```typescript
// Message events
api.ws.subscribe('message:new', (data) => {
  console.log('New message:', data.content);
});

api.ws.subscribe('message:update', (data) => {
  console.log('Message updated:', data.messageId);
});

// Typing indicators
api.ws.subscribe('status:typing', (data) => {
  if (data.isTyping) {
    console.log(`${data.username} is typing...`);
  }
});

// User presence
api.ws.subscribe('status:online', (data) => {
  console.log(`${data.username} is now online`);
});

api.ws.subscribe('status:offline', (data) => {
  console.log(`${data.username} went offline`);
});

// Auth expiration
api.ws.subscribe('auth-expired', (data) => {
  console.warn('Auth expired:', data.message);
  // Redirect to login
});
```

## Server Usage

### Broadcasting Events

```typescript
import { getCurrentManager } from '@/webserver/adapter';

const manager = getCurrentManager();

// Broadcast to all connected clients
manager?.broadcast('system:notification', {
  id: 'notif123',
  type: 'info',
  title: 'Server Update',
  message: 'System will restart in 5 minutes',
  timestamp: Date.now()
});

// Broadcast to specific user
manager?.broadcastToUser('user123', 'system:notification', data);

// Broadcast to specific room
manager?.broadcastToRoom('conversation:conv123', 'message:new', message);
```

### Room Management

```typescript
import { ROOMS } from '@/webserver/websocket/types';

// Users automatically join rooms on connect:
// - user:{userId}        (personal room)
// - all-users            (global room)

// Users manually join conversation rooms:
socket.on('conversation:join', (data) => {
  socket.join(ROOMS.conversation(data.conversationId));
});

// Get all clients in a room
const socketIOManager = manager as SocketIOManager;
const clients = await socketIOManager.getRoomClients('conversation:conv123');
console.log('Users in conversation:', clients);
```

### Custom Event Handlers

```typescript
// In SocketIOManager.setupEventHandlers()
socket.on('custom:event', (data, callback) => {
  try {
    // Process event
    const result = processCustomEvent(data);

    // Send acknowledgment
    callback({ success: true, data: result });

    // Broadcast to others in room
    socket.to(ROOMS.conversation(data.conversationId))
      .emit('custom:event:broadcast', result);
  } catch (error) {
    callback({ success: false, error: error.message });
  }
});
```

## Authentication

### JWT Token Flow

```typescript
// 1. Client connects with token
const socket = io(baseURL, {
  auth: {
    token: accessToken
  }
});

// 2. Server validates token in middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!TokenMiddleware.validateWebSocketToken(token)) {
    return next(new Error('Invalid token'));
  }

  // Decode and store user data
  const user = TokenMiddleware.decodeToken(token);
  socket.data.userId = user.userId;
  socket.data.username = user.username;
  socket.data.role = user.role;

  next();
});

// 3. Server checks token periodically
setInterval(() => {
  sockets.forEach((socket) => {
    if (!TokenMiddleware.validateWebSocketToken(socket.data.token)) {
      socket.emit('auth-expired', { message: 'Token expired' });
      socket.disconnect();
    }
  });
}, HEARTBEAT_INTERVAL);
```

### Token Refresh

```typescript
// Client refreshes token
api.ws.emit('auth:refresh', {
  refreshToken: newRefreshToken
});

// Server updates stored token
socket.on('auth:refresh', (data) => {
  if (TokenMiddleware.validateWebSocketToken(data.refreshToken)) {
    socket.data.token = data.refreshToken;
  } else {
    socket.emit('auth-expired', { message: 'Invalid refresh token' });
    socket.disconnect();
  }
});
```

## Rooms and Namespaces

### Available Namespaces

```typescript
export const NAMESPACES = {
  DEFAULT: '/',               // Main namespace
  CONVERSATIONS: '/conversations',  // Conversation-specific
  NOTIFICATIONS: '/notifications',  // System notifications
  ADMIN: '/admin'            // Admin-only namespace
};
```

### Room Naming Convention

```typescript
export const ROOMS = {
  conversation: (id) => `conversation:${id}`,
  user: (id) => `user:${id}`,
  admin: 'admin-room',
  all: 'all-users'
};
```

### Using Namespaces

```typescript
// Server-side: Different namespaces
const conversationsNS = io.of('/conversations');
conversationsNS.on('connection', (socket) => {
  // Handle conversation-specific events
});

// Client-side: Connect to namespace
const convSocket = io('/conversations', {
  auth: { token }
});
```

## Monitoring

### Connection Status

```typescript
// Get connected client count
const count = manager?.getConnectedClientsCount();
console.log(`Connected clients: ${count}`);

// Get clients in specific room
const clients = await socketIOManager.getRoomClients('conversation:conv123');
console.log(`Users in conversation: ${clients.length}`);
```

### Event Logging

```typescript
// Log all events (in development)
if (process.env.NODE_ENV === 'development') {
  io.on('connection', (socket) => {
    socket.onAny((eventName, ...args) => {
      console.log(`[Socket.IO] ${eventName}:`, args);
    });
  });
}
```

## Best Practices

### 1. Always Use Acknowledgments for Critical Events

```typescript
// ✅ Good: Use acknowledgment for important events
socket.emit('message:send', data, (response) => {
  if (response.success) {
    console.log('Message delivered');
  } else {
    console.error('Message failed:', response.error);
  }
});

// ❌ Bad: No confirmation of delivery
socket.emit('message:send', data);
```

### 2. Use Rooms for Targeted Messaging

```typescript
// ✅ Good: Send to specific room
io.to(ROOMS.conversation('conv123')).emit('message:new', data);

// ❌ Bad: Broadcast to everyone
io.emit('message:new', data);
```

### 3. Handle Reconnection Gracefully

```typescript
// ✅ Good: Subscribe to connection status
api.ws.onStatusChange((status) => {
  if (status === ConnectionStatus.RECONNECTING) {
    showReconnectingIndicator();
  } else if (status === ConnectionStatus.CONNECTED) {
    hideReconnectingIndicator();
    reloadMissedMessages();
  }
});
```

### 4. Clean Up Subscriptions

```typescript
// ✅ Good: Unsubscribe when component unmounts
useEffect(() => {
  const unsubscribe = api.ws.subscribe('message:new', handleMessage);
  return () => unsubscribe();
}, []);

// ❌ Bad: Memory leak
api.ws.subscribe('message:new', handleMessage);
```

## Troubleshooting

### Connection Fails

**Problem**: Client cannot connect to Socket.IO server

**Solutions**:
1. Check server is running: `npm run webui`
2. Verify USE_SOCKET_IO=true in .env
3. Check CORS configuration in server
4. Verify token is valid and not expired
5. Check browser console for errors

### Events Not Received

**Problem**: Client subscribed but not receiving events

**Solutions**:
1. Verify event name matches exactly (case-sensitive)
2. Check if client is in the correct room
3. Verify server is emitting to correct room
4. Check browser DevTools > Network > WS tab

### Token Expired Loop

**Problem**: Client keeps getting disconnected with "auth-expired"

**Solutions**:
1. Implement token refresh before expiration
2. Check token expiration time (should be > connection time)
3. Verify refresh token endpoint works
4. Handle auth-expired event to redirect to login

## Migration from Native ws

If migrating from native WebSocket (ws):

```typescript
// Before (ws)
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const parsed = JSON.parse(data);
    // Handle message
  });
});

// After (Socket.IO)
io.on('connection', (socket) => {
  socket.on('message:send', (data, callback) => {
    // Handle message
    callback({ success: true });
  });
});
```

## Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Type Definitions](./types.ts)
- [Socket.IO Manager](./SocketIOManager.ts)
- [Client Manager](../../renderer/services/api/websocket-manager.ts)

---

**Last Updated**: 2026-02-15
**Version**: 4.8.3
**Status**: ✅ Production Ready
