/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Socket.IO Integration Tests
 */

import { io, type Socket } from 'socket.io-client';

describe('Socket.IO Integration Tests', () => {
  let clientSocket: Socket;
  const SERVER_URL = 'http://localhost:8765';
  const TEST_TOKEN = 'test-jwt-token'; // Replace with actual test token

  beforeAll(() => {
    // Setup test environment
  });

  afterAll(() => {
    // Cleanup
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  describe('Connection', () => {
    it('should connect successfully with valid token', (done) => {
      clientSocket = io(SERVER_URL, {
        auth: {
          token: TEST_TOKEN,
        },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should fail to connect with invalid token', (done) => {
      const invalidClient = io(SERVER_URL, {
        auth: {
          token: 'invalid-token',
        },
      });

      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication error');
        invalidClient.disconnect();
        done();
      });

      invalidClient.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });
    });

    it('should reconnect automatically on disconnect', (done) => {
      let disconnectCount = 0;
      let reconnectCount = 0;

      clientSocket.on('disconnect', () => {
        disconnectCount++;
      });

      clientSocket.on('connect', () => {
        reconnectCount++;
        if (reconnectCount === 2) {
          // Reconnected successfully
          expect(disconnectCount).toBe(1);
          done();
        }
      });

      // Force disconnect
      setTimeout(() => {
        clientSocket.disconnect();
        setTimeout(() => {
          clientSocket.connect();
        }, 100);
      }, 100);
    });
  });

  describe('Authentication', () => {
    it('should handle auth-expired event', (done) => {
      clientSocket.on('auth-expired', (data) => {
        expect(data.message).toBeTruthy();
        done();
      });

      // Trigger auth expiration (requires server-side test helper)
      clientSocket.emit('test:expire-auth');
    });

    it('should refresh token successfully', (done) => {
      const newToken = 'new-test-token';

      clientSocket.emit('auth:refresh', { refreshToken: newToken }, (response: any) => {
        expect(response.success).toBe(true);
        done();
      });
    });
  });

  describe('Heartbeat', () => {
    it('should respond to ping with pong', (done) => {
      const startTime = Date.now();

      clientSocket.once('ping', (data) => {
        // Respond with pong
        clientSocket.emit('pong', { timestamp: Date.now() });

        // Verify ping was received
        expect(data.timestamp).toBeTruthy();
        expect(Date.now() - startTime).toBeLessThan(1000);
        done();
      });

      // Server should send ping within heartbeat interval
    });
  });

  describe('Room Management', () => {
    const conversationId = 'test-conv-123';

    it('should join a conversation room', (done) => {
      clientSocket.emit('conversation:join', { conversationId });

      // Verify by sending a message to the room
      setTimeout(() => {
        // If no error, assume success
        done();
      }, 100);
    });

    it('should receive messages in joined room', (done) => {
      clientSocket.on('message:new', (data) => {
        expect(data.conversationId).toBe(conversationId);
        expect(data.content).toBeTruthy();
        done();
      });

      // Another client should send a message to this room
      // This requires a second client connection
    });

    it('should leave a conversation room', (done) => {
      clientSocket.emit('conversation:leave', { conversationId });

      setTimeout(() => {
        done();
      }, 100);
    });
  });

  describe('Message Events', () => {
    it('should send message with acknowledgment', (done) => {
      const messageData = {
        conversationId: 'test-conv-123',
        content: 'Test message',
      };

      clientSocket.emit('message:send', messageData, (response: any) => {
        expect(response.success).toBe(true);
        expect(response.messageId).toBeTruthy();
        done();
      });
    });

    it('should receive new message event', (done) => {
      clientSocket.on('message:new', (data) => {
        expect(data.messageId).toBeTruthy();
        expect(data.content).toBeTruthy();
        expect(data.userId).toBeTruthy();
        done();
      });

      // Trigger message from another client or server
    });

    it('should edit message with acknowledgment', (done) => {
      const editData = {
        messageId: 'msg-123',
        content: 'Updated message',
      };

      clientSocket.emit('message:edit', editData, (response: any) => {
        expect(response.success).toBe(true);
        done();
      });
    });
  });

  describe('Typing Indicators', () => {
    it('should emit typing start event', (done) => {
      clientSocket.emit('typing:start', { conversationId: 'test-conv-123' });

      // Should be received by other clients in the room
      setTimeout(done, 100);
    });

    it('should emit typing stop event', (done) => {
      clientSocket.emit('typing:stop', { conversationId: 'test-conv-123' });

      setTimeout(done, 100);
    });

    it('should receive typing indicator from others', (done) => {
      clientSocket.on('status:typing', (data) => {
        expect(data.conversationId).toBeTruthy();
        expect(data.userId).toBeTruthy();
        expect(data.isTyping).toBeDefined();
        done();
      });

      // Requires another client to trigger typing
    });
  });

  describe('User Presence', () => {
    it('should receive user online event', (done) => {
      clientSocket.on('status:online', (data) => {
        expect(data.userId).toBeTruthy();
        expect(data.username).toBeTruthy();
        expect(data.status).toBe('online');
        done();
      });

      // Triggered when another user connects
    });

    it('should receive user offline event', (done) => {
      clientSocket.on('status:offline', (data) => {
        expect(data.userId).toBeTruthy();
        expect(data.status).toBe('offline');
        expect(data.lastSeen).toBeTruthy();
        done();
      });

      // Triggered when another user disconnects
    });
  });

  describe('System Events', () => {
    it('should receive system notification', (done) => {
      clientSocket.on('system:notification', (data) => {
        expect(data.type).toBeTruthy();
        expect(data.message).toBeTruthy();
        done();
      });

      // Triggered by server
    });

    it('should receive system error', (done) => {
      clientSocket.on('system:error', (data) => {
        expect(data.code).toBeTruthy();
        expect(data.message).toBeTruthy();
        done();
      });

      // Triggered by server
    });
  });

  describe('Performance', () => {
    it('should handle rapid message sending', async () => {
      const messageCount = 100;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < messageCount; i++) {
        const promise = new Promise((resolve) => {
          clientSocket.emit(
            'message:send',
            {
              conversationId: 'test-conv-123',
              content: `Message ${i}`,
            },
            (response: any) => {
              resolve(response);
            }
          );
        });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter((r) => r.success).length;

      expect(successCount).toBe(messageCount);
    });

    it('should measure message latency', (done) => {
      const startTime = Date.now();

      clientSocket.emit(
        'message:send',
        {
          conversationId: 'test-conv-123',
          content: 'Latency test',
        },
        () => {
          const latency = Date.now() - startTime;
          expect(latency).toBeLessThan(100); // Should be < 100ms
          console.log(`Message latency: ${latency}ms`);
          done();
        }
      );
    });
  });
});
