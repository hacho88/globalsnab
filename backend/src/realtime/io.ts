import { Server as SocketIOServer } from 'socket.io';

const userSockets = new Map<string, Set<string>>();
let io: SocketIOServer | null = null;

export const setIo = (nextIo: SocketIOServer) => {
  io = nextIo;
};

export const registerSocket = (userId: string, socketId: string) => {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(socketId);
};

export const unregisterSocket = (userId: string, socketId: string) => {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(userId);
};

export const emitToUser = (toUserId: string, event: string, payload: any) => {
  if (!io) return;
  const sockets = userSockets.get(toUserId);
  if (!sockets || sockets.size === 0) return;
  for (const sid of sockets) {
    io.to(sid).emit(event, payload);
  }
};
