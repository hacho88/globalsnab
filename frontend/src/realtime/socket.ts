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
