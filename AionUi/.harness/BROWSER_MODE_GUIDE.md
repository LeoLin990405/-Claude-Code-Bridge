# HiveMind Browser Mode Guide

Complete guide for running HiveMind as a standalone web application (non-Electron).

## Overview

HiveMind can now run in two modes:

1. **Electron Mode** (Desktop): Traditional desktop application
2. **Browser Mode** (Web): Standalone web application accessible via browser

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser Mode (Port 3000)                       │
│  ┌──────────────────────────────────────────┐   │
│  │  React Frontend (Vite Dev Server)        │   │
│  │  - All UI components                     │   │
│  │  - Unified API Client                    │   │
│  │  - WebSocket Manager                     │   │
│  └────────────┬─────────────────────────────┘   │
│               │ HTTP/WebSocket                   │
│               ▼                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Backend Server (Port 8765)              │   │
│  │  - Express REST API                      │   │
│  │  - WebSocket Server                      │   │
│  │  - PostgreSQL Database                   │   │
│  │  - File Upload/Storage                   │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start Backend Server

```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Start the backend server
npm run webui
```

The backend will start on `http://localhost:8765`

### 2. Start Frontend Dev Server

```bash
# In a new terminal
npm run dev:web
```

The frontend will start on `http://localhost:3000` with hot module replacement (HMR).

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## Environment Configuration

### Development (.env.development)

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:8765
VITE_WS_BASE_URL=ws://localhost:8765

# Development Server
VITE_DEV_PORT=3000
VITE_DEV_HOST=localhost

# Feature Flags
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_DEBUG_LOGS=true
```

### Production (.env.production)

```bash
# API Configuration (relative URLs for flexibility)
VITE_API_BASE_URL=/api
VITE_WS_BASE_URL=

# Feature Flags
VITE_ENABLE_DEVTOOLS=false
VITE_ENABLE_DEBUG_LOGS=false
```

## Build for Production

### 1. Build Frontend

```bash
npm run build:web
```

This creates an optimized production build in `dist/web/`.

### 2. Preview Production Build

```bash
npm run preview:web
```

### 3. Deploy

The `dist/web/` directory contains static files that can be:

1. **Served by the backend**: Place in backend's `public/` directory
2. **Deployed to CDN**: Upload to Netlify, Vercel, AWS S3, etc.
3. **Served by Nginx**: Configure reverse proxy to backend

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve frontend
    location / {
        root /path/to/dist/web;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests
    location /api {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy WebSocket
    location /socket.io {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## API Client Usage

The unified API client automatically detects the environment:

```typescript
import { api } from '@/renderer/services/api';

// Automatically uses HTTP in browser mode
const status = await api.http.get('/webui/status');

// WebSocket connection
api.ws.connect();
api.ws.on('message:new', (data) => {
  console.log('New message:', data);
});
```

## Feature Comparison

| Feature | Electron Mode | Browser Mode |
|---------|---------------|--------------|
| **UI Components** | ✅ Full | ✅ Full |
| **API Communication** | IPC + HTTP | HTTP only |
| **WebSocket** | ✅ Yes | ✅ Yes |
| **File Upload** | Local paths | Server upload |
| **Settings Persistence** | Local DB | Server DB |
| **Desktop Integration** | ✅ Yes | ❌ No |
| **Auto Updates** | ✅ Yes | ❌ No |
| **System Tray** | ✅ Yes | ❌ No |

## Differences from Electron Mode

### 1. File Handling

**Electron Mode:**
- Uses local file paths
- Direct file system access
- `window.electronAPI.getPathForFile()`

**Browser Mode:**
- Uploads files to server
- Server-managed file storage
- Uses File API and FormData

### 2. Authentication

**Electron Mode:**
- Optional (local-only mode)
- Can bypass login

**Browser Mode:**
- Required (JWT-based)
- Must login to access features

### 3. Settings Storage

**Electron Mode:**
- SQLite database (local)
- User-specific data directory

**Browser Mode:**
- PostgreSQL database (server)
- Shared database with isolation

## Available NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev:web` | Start Vite dev server with HMR |
| `npm run build:web` | Build for production |
| `npm run preview:web` | Preview production build |
| `npm start` | Start Electron desktop app |
| `npm run webui` | Start backend server only |

## Troubleshooting

### Port Conflicts

If port 3000 is in use:

```bash
# Change in .env.development
VITE_DEV_PORT=3001
```

### API Connection Failed

1. Ensure backend is running: `npm run webui`
2. Check backend URL in `.env.development`
3. Verify CORS is enabled in backend

### WebSocket Connection Failed

1. Check WebSocket URL in `.env.development`
2. Ensure backend supports WebSocket
3. Check browser console for errors

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Clear Vite cache
rm -rf node_modules/.vite
```

## Development Workflow

### Recommended Setup

**Terminal 1: Backend**
```bash
npm run webui
```

**Terminal 2: Frontend**
```bash
npm run dev:web
```

**Terminal 3: Database (if needed)**
```bash
docker-compose up postgres
```

### Hot Module Replacement (HMR)

Vite provides instant feedback when you edit files:

- React components reload instantly
- CSS updates without page refresh
- State is preserved during updates

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Migration Status

| Component | Status |
|-----------|--------|
| API Client | ✅ Complete |
| WebSocket | ✅ Complete |
| Authentication | ✅ Complete |
| WebUI Settings | ✅ Complete |
| File Upload | ⏳ Partial |
| All Features | ⏳ In Progress |

## Next Steps

1. **Complete File Upload Migration**
   - Update `useWorkspaceDragImport.ts`
   - Handle File objects in browser mode
   - Upload to `/api/v1/upload` endpoint

2. **Test All Features**
   - Conversation management
   - Message sending
   - Settings pages
   - File attachments

3. **Performance Optimization**
   - Code splitting
   - Lazy loading
   - Asset optimization

4. **Production Deployment**
   - Set up CI/CD
   - Configure CDN
   - SSL certificates

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [API Client README](../src/renderer/services/api/README.md)
- [Migration Guide](../src/api/v1/routes/WEBUI_MIGRATION.md)

---

**Last Updated**: 2026-02-15
**Version**: 1.11.1
**Status**: 🟡 In Development
