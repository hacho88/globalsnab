import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (socket) return socket;

  const auth = useAuthStore();

  socket = io({
    transports: ['websocket'],
    auth: auth.accessToken ? { token: auth.accessToken } : {},
  });

  // Handle Service Worker notification actions when app is open.
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const data: any = event.data;
      if (data?.type === 'call:decline' && data?.fromUserId && data?.callId) {
        socket?.emit('call:reject', { toUserId: data.fromUserId, callId: data.callId });
      }
    });
  }

  return socket;
};

export const updateSocketAuth = (token: string | null) => {
  if (!socket) return;
  (socket as any).auth = token ? { token } : {};
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};
