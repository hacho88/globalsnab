import mongoose from 'mongoose';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { verifyAccessToken } from './utils/jwt';
import { emitToUser, registerSocket, setIo, unregisterSocket } from './realtime/io';

const start = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.log('[DB] Connected to MongoDB');

    const app = createApp();

    const httpServer = http.createServer(app);

    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    setIo(io);

    io.use((socket, next) => {
      const authToken = (socket.handshake.auth as any)?.token;
      const header = socket.handshake.headers.authorization;
      const authHeader = Array.isArray(header) ? header[0] : header;

      const token =
        typeof authToken === 'string' && authToken.trim()
          ? authToken.trim()
          : authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : '';

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      try {
        const payload = verifyAccessToken(token);
        (socket.data as any).userId = payload.sub;
        return next();
      } catch {
        return next(new Error('Unauthorized'));
      }
    });

    io.on('connection', (socket) => {
      const userId = String((socket.data as any).userId || '');
      if (!userId) {
        socket.disconnect(true);
        return;
      }

      registerSocket(userId, socket.id);

      socket.on('call:invite', (data: { toUserId: string; callId: string; kind: 'audio' | 'video' }) => {
        emitToUser(data.toUserId, 'call:incoming', {
          fromUserId: userId,
          callId: data.callId,
          kind: data.kind,
        });
      });

      socket.on('call:accept', (data: { toUserId: string; callId: string }) => {
        emitToUser(data.toUserId, 'call:accepted', { fromUserId: userId, callId: data.callId });
      });

      socket.on('call:reject', (data: { toUserId: string; callId: string }) => {
        emitToUser(data.toUserId, 'call:rejected', { fromUserId: userId, callId: data.callId });
      });

      socket.on('call:hangup', (data: { toUserId: string; callId: string }) => {
        emitToUser(data.toUserId, 'call:hangup', { fromUserId: userId, callId: data.callId });
      });

      socket.on('webrtc:offer', (data: { toUserId: string; callId: string; sdp: any }) => {
        emitToUser(data.toUserId, 'webrtc:offer', { fromUserId: userId, callId: data.callId, sdp: data.sdp });
      });

      socket.on('webrtc:answer', (data: { toUserId: string; callId: string; sdp: any }) => {
        emitToUser(data.toUserId, 'webrtc:answer', { fromUserId: userId, callId: data.callId, sdp: data.sdp });
      });

      socket.on('webrtc:ice', (data: { toUserId: string; callId: string; candidate: any }) => {
        emitToUser(data.toUserId, 'webrtc:ice', {
          fromUserId: userId,
          callId: data.callId,
          candidate: data.candidate,
        });
      });

      socket.on('disconnect', () => {
        unregisterSocket(userId, socket.id);
      });
    });

    httpServer.listen(env.port, () => {
      console.log(`[Server] Listening on port ${env.port}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start', err);
    process.exit(1);
  }
};

start();
