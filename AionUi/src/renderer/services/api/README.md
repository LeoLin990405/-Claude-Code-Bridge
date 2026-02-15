## API Client Documentation

Unified API client abstraction layer that works in both Electron and browser environments.

## Features

- ✅ **Environment Agnostic**: Automatically detects and uses Electron IPC or HTTP/WebSocket
- ✅ **Type-Safe**: Full TypeScript support with interfaces and generics
- ✅ **Token Management**: Automatic JWT token handling with refresh
- ✅ **Real-time**: WebSocket support for event subscriptions
- ✅ **Error Handling**: Consistent error handling across all transports
- ✅ **Reconnection**: Automatic WebSocket reconnection with exponential backoff

## Usage

### Basic Usage

```typescript
import { api } from '@/services/api';

// Make an API call
const data = await api.call('conversations/list', { page: 1 });

// Subscribe to real-time events
const unsubscribe = api.subscribe('message:new', (data) => {
  console.log('New message:', data);
});

// Unsubscribe later
unsubscribe();
```

### Using HTTP Client Directly

```typescript
import { getUnifiedClient } from '@/services/api';

const client = getUnifiedClient();

// REST methods
const user = await client.http.get('/auth/me');
const conversation = await client.http.post('/conversations', {
  name: 'New Chat',
  model: 'claude-sonnet-4.5',
});
await client.http.put('/conversations/123', { name: 'Updated' });
await client.http.delete('/conversations/123');
```

### WebSocket Events

```typescript
import { getWebSocketManager } from '@/services/api';

const ws = getWebSocketManager();

// Connect
ws.connect();

// Subscribe to events
ws.subscribe('conversation:updated', (data) => {
  console.log('Conversation updated:', data);
});

// Emit events
ws.emit('typing:start', { conversationId: '123' });

// Monitor connection status
ws.onStatusChange((status) => {
  console.log('Connection status:', status);
});

// Disconnect
ws.disconnect();
```

### Token Management

```typescript
import { tokenStorage } from '@/services/api';

// Store tokens after login
tokenStorage.setAccessToken(accessToken);
tokenStorage.setRefreshToken(refreshToken);

// Get tokens
const token = tokenStorage.getAccessToken();

// Clear tokens on logout
tokenStorage.clearTokens();
```

### Custom Client Configuration

```typescript
import { createAPIClient } from '@/services/api';

const client = createAPIClient({
  baseURL: 'https://api.hivemind.com',
  forceHTTP: true, // Force HTTP mode even in Electron
});

const data = await client.call('some-method', { param: 'value' });
```

### Electron-Specific Methods

```typescript
import { api } from '@/services/api';

if (api.electron) {
  // Get file path for drag & drop
  const path = api.electron.getPathForFile(file);

  // WebUI methods
  const status = await api.electron.webuiGetStatus();
  await api.electron.webuiChangePassword('newPassword');
  const qrToken = await api.electron.webuiGenerateQRToken();
}
```

## Architecture

```
┌──────────────────────────────────────┐
│     Application Code                 │
│  (React Components, Services)        │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│   Unified API Client                 │
│  (Automatic environment detection)   │
└─────────┬──────────────┬─────────────┘
          │              │
          ▼              ▼
┌─────────────────┐  ┌──────────────────┐
│  HTTP Client    │  │ Electron Client  │
│  (axios)        │  │ (IPC)            │
└────────┬────────┘  └──────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  WebSocket Manager                  │
│  (Socket.IO with auto-reconnect)    │
└─────────────────────────────────────┘
```

## Environment Detection

The client automatically detects the environment:

```typescript
// In Electron
if (typeof window.electronAPI !== 'undefined') {
  // Use ElectronAPIClient
}

// In Browser
else {
  // Use HTTPAPIClient + WebSocketManager
}
```

## Token Refresh Flow

```
1. API call fails with 401
   ↓
2. Check if refresh token exists
   ↓
3. Call /api/v1/auth/refresh
   ↓
4. Update access token in storage
   ↓
5. Retry original request
   ↓
6. If refresh fails → redirect to login
```

## Error Handling

```typescript
try {
  const data = await api.call('some-method', params);
} catch (error) {
  if (error.message.includes('UNAUTHORIZED')) {
    // Handle auth error
  } else if (error.message.includes('VALIDATION_ERROR')) {
    // Handle validation error
  } else {
    // Handle other errors
  }
}
```

## Migration from Electron IPC

### Before (Electron IPC)

```typescript
const result = await window.electronAPI.emit('conversation-list', { page: 1 });
```

### After (Unified Client)

```typescript
const result = await api.call('conversation/list', { page: 1 });
```

The client automatically uses the right transport:
- In Electron: Uses `window.electronAPI.emit()`
- In Browser: Uses `axios.post('/api/v1/conversation/list')`

## Testing

```typescript
import { MemoryTokenStorage, createAPIClient } from '@/services/api';

// Use memory storage for tests
const tokenStorage = new MemoryTokenStorage();
const client = createAPIClient({
  baseURL: 'http://localhost:3000',
});

// Mock responses
// ...
```

## Configuration

### Environment Variables

```bash
# .env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

### Vite Proxy (Development)

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

## API

### Types

```typescript
interface APIClient {
  call<T>(method: string, data?: any, options?: APIRequestOptions): Promise<T>;
  subscribe<T>(event: string, callback: EventCallback<T>): UnsubscribeFn;
  getConnectionStatus(): ConnectionStatus;
  disconnect(): void;
}

interface APIRequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
  retry?: { attempts?: number; delay?: number };
  signal?: AbortSignal;
}

enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}
```

### HTTP Client Methods

```typescript
class HTTPAPIClient {
  get<T>(endpoint: string, params?: any, options?: APIRequestOptions): Promise<T>;
  post<T>(endpoint: string, data?: any, options?: APIRequestOptions): Promise<T>;
  put<T>(endpoint: string, data?: any, options?: APIRequestOptions): Promise<T>;
  delete<T>(endpoint: string, options?: APIRequestOptions): Promise<T>;
}
```

### WebSocket Manager Methods

```typescript
class WebSocketManager {
  connect(): void;
  disconnect(): void;
  subscribe<T>(event: string, callback: EventCallback<T>): UnsubscribeFn;
  emit(event: string, data?: any): void;
  onStatusChange(callback: (status: ConnectionStatus) => void): UnsubscribeFn;
  getStatus(): ConnectionStatus;
  isConnected(): boolean;
}
```

## Best Practices

1. **Use the unified client** (`api`) for most cases
2. **Clean up subscriptions** to prevent memory leaks
3. **Handle token expiration** gracefully
4. **Monitor connection status** for real-time features
5. **Use TypeScript generics** for type-safe API calls

```typescript
// Good: Type-safe API call
interface User {
  id: string;
  username: string;
  email: string;
}

const user = await api.call<User>('auth/me');
// user.id is typed as string

// Good: Clean up subscriptions
useEffect(() => {
  const unsubscribe = api.subscribe('event', handler);
  return () => unsubscribe(); // Cleanup
}, []);
```

## Troubleshooting

### "ElectronAPI is not available"

You're trying to use Electron client in browser mode. Use:

```typescript
import { createAPIClient } from '@/services/api';
const client = createAPIClient({ forceHTTP: true });
```

### WebSocket connection fails

Check CORS and ensure backend WebSocket server is running:

```bash
# Check backend
curl http://localhost:3000/api/v1/health

# Check WebSocket
wscat -c ws://localhost:3000
```

### Token refresh loop

Clear tokens and re-login:

```typescript
import { tokenStorage } from '@/services/api';
tokenStorage.clearTokens();
window.location.href = '/login';
```

## Next Steps

1. Migrate existing IPC calls to use `api.call()`
2. Replace event listeners with `api.subscribe()`
3. Update WebUI methods to use REST endpoints
4. Test in both Electron and browser modes
