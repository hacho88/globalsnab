import mongoose from 'mongoose';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { verifyAccessToken } from './utils/jwt';
import { emitToUser, getLastSeen, getOnlineUserIds, registerSocket, setIo, unregisterSocket } from './realtime/io';
import { MessageModel } from './models/Message';
import { sendPushToUser } from './utils/push';
import { PendingCallInviteModel } from './models/PendingCallInvite';

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

      // If the user was offline/asleep, deliver any pending call invites (TTL).
      PendingCallInviteModel.find({ toUserId: userId })
        .lean()
        .then((invites) => {
          for (const inv of invites) {
            socket.emit('call:incoming', {
              fromUserId: inv.fromUserId,
              callId: inv.callId,
              kind: inv.kind,
            });
          }
        })
        .catch(() => {});

      socket.emit('presence:snapshot', {
        onlineUserIds: getOnlineUserIds(),
        lastSeen: getLastSeen(),
      });

      socket.on('call:invite', (data: { toUserId: string; callId: string; kind: 'audio' | 'video' }) => {
        PendingCallInviteModel.findOneAndUpdate(
          { toUserId: data.toUserId, callId: data.callId },
          { toUserId: data.toUserId, callId: data.callId, fromUserId: userId, kind: data.kind },
          { upsert: true, new: true }
        ).catch(() => {});

        emitToUser(data.toUserId, 'call:incoming', {
          fromUserId: userId,
          callId: data.callId,
          kind: data.kind,
        });
        sendPushToUser(data.toUserId, {
          title: data.kind === 'video' ? 'Входящий видеозвонок' : 'Входящий звонок',
          body: 'Нажми чтобы ответить',
          tag: 'call-' + data.callId,
          url: `/calls?callId=${encodeURIComponent(data.callId)}`,
          kind: data.kind,
          callId: data.callId,
          fromUserId: userId,
          type: 'incoming_call',
        }).catch(() => {});
      });

      socket.on('call:accept', (data: { toUserId: string; callId: string }) => {
        PendingCallInviteModel.deleteOne({ toUserId: userId, callId: data.callId }).catch(() => {});
        emitToUser(data.toUserId, 'call:accepted', { fromUserId: userId, callId: data.callId });
      });

      socket.on('call:reject', (data: { toUserId: string; callId: string }) => {
        PendingCallInviteModel.deleteOne({ toUserId: userId, callId: data.callId }).catch(() => {});
        emitToUser(data.toUserId, 'call:rejected', { fromUserId: userId, callId: data.callId });
      });

      socket.on('call:hangup', (data: { toUserId: string; callId: string }) => {
        PendingCallInviteModel.deleteOne({ toUserId: userId, callId: data.callId }).catch(() => {});
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

      socket.on('message:send', async (data: { toUserId: string; text: string }) => {
        const toUserId = String(data?.toUserId || '').trim();
        const text = String(data?.text || '').trim();
        if (!toUserId || !text) return;

        const conversationId = [userId, toUserId].sort().join(':');
        const msg = await MessageModel.create({
          conversationId,
          fromUserId: userId,
          toUserId,
          text,
        });

        const payload = {
          id: String(msg._id),
          conversationId,
          fromUserId: userId,
          toUserId,
          text,
          createdAt: msg.createdAt,
        };

        emitToUser(toUserId, 'message:new', payload);
        // also echo to sender for multi-device sync
        emitToUser(userId, 'message:new', payload);
        sendPushToUser(toUserId, {
          title: 'Новое сообщение',
          body: text.length > 80 ? text.slice(0, 80) + '…' : text,
          tag: 'msg-' + conversationId,
          url: '/messages',
        }).catch(() => {});
      });

      socket.on('typing:start', (data: { toUserId: string }) => {
        const toId = String(data?.toUserId || '').trim();
        if (toId) emitToUser(toId, 'typing:start', { fromUserId: userId });
      });

      socket.on('typing:stop', (data: { toUserId: string }) => {
        const toId = String(data?.toUserId || '').trim();
        if (toId) emitToUser(toId, 'typing:stop', { fromUserId: userId });
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
