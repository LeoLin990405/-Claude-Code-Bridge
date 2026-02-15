/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Server as HTTPServer } from 'http';
import type { WebSocketServer } from 'ws';
import { registerWebSocketBroadcaster, getBridgeEmitter } from '../adapter/main';
import { WebSocketManager } from './websocket/WebSocketManager';
import { SocketIOManager } from './websocket/SocketIOManager';
import { EVENTS } from './websocket/types';

// 存储管理器实例和取消注册函数
// Store manager instance and unregister function for cleanup
let currentManager: WebSocketManager | SocketIOManager | null = null;
let unregisterBroadcaster: (() => void) | null = null;

/**
 * 初始化 Web 适配器 - 建立 WebSocket 与 bridge 的通信桥梁 (原生 ws)
 * Initialize Web Adapter - Bridge communication between WebSocket and platform bridge (native ws)
 *
 * 注意：不再调用 bridge.adapter()，而是注册到主适配器
 * Note: No longer calling bridge.adapter(), instead registering with main adapter
 * 这样可以避免覆盖 Electron IPC 适配器
 * This avoids overwriting the Electron IPC adapter
 */
export function initWebAdapter(wss: WebSocketServer): void {
  const wsManager = new WebSocketManager(wss);
  wsManager.initialize();
  currentManager = wsManager;

  // 注册 WebSocket 广播函数到主适配器
  // Register WebSocket broadcast function to main adapter
  unregisterBroadcaster = registerWebSocketBroadcaster((name, data) => {
    wsManager.broadcast(name, data);
  });

  // 设置 WebSocket 消息处理器，将消息转发到 bridge emitter
  // Setup WebSocket message handler to forward messages to bridge emitter
  wsManager.setupConnectionHandler((name, data, _ws) => {
    const emitter = getBridgeEmitter();
    if (emitter) {
      emitter.emit(name, data);
    }
  });

  console.log('[WebAdapter] Initialized with native WebSocket (ws)');
}

/**
 * 初始化 Socket.IO 适配器 - 使用 Socket.IO 进行实时通信
 * Initialize Socket.IO Adapter - Use Socket.IO for real-time communication
 */
export function initSocketIOAdapter(httpServer: HTTPServer): void {
  const socketIOManager = new SocketIOManager();
  socketIOManager.initialize(httpServer);
  currentManager = socketIOManager;

  // 注册 Socket.IO 广播函数到主适配器
  // Register Socket.IO broadcast function to main adapter
  unregisterBroadcaster = registerWebSocketBroadcaster((name, data) => {
    socketIOManager.broadcast(name, data);
  });

  // Socket.IO 事件处理 - 将事件转发到 bridge emitter
  // Socket.IO event handling - forward events to bridge emitter
  const io = socketIOManager.getIO();
  if (io) {
    // 监听所有自定义事件并转发到 bridge
    // Listen to all custom events and forward to bridge
    io.on('connection', (socket) => {
      const emitter = getBridgeEmitter();
      if (!emitter) return;

      // 文件选择事件 (Electron specific)
      socket.on(EVENTS.SUBSCRIBE_SHOW_OPEN, (data) => {
        emitter.emit(EVENTS.SUBSCRIBE_SHOW_OPEN, data);
      });

      // 其他需要转发到 bridge 的事件可以在这里添加
      // Add other events that need to be forwarded to bridge here
    });
  }

  console.log('[WebAdapter] Initialized with Socket.IO');
}

/**
 * 获取当前管理器实例
 * Get current manager instance
 */
export function getCurrentManager(): WebSocketManager | SocketIOManager | null {
  return currentManager;
}

/**
 * 清理 Web 适配器（服务器停止时调用）
 * Cleanup Web Adapter (called when server stops)
 */
export function cleanupWebAdapter(): void {
  if (unregisterBroadcaster) {
    unregisterBroadcaster();
    unregisterBroadcaster = null;
  }

  if (currentManager) {
    currentManager.destroy();
    currentManager = null;
  }

  console.log('[WebAdapter] Cleaned up');
}
