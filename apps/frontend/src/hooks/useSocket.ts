import { useEffect, useRef } from 'react';
import { io as socketIo, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = socketIo('/', {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const s = getSocket();
    const listener = (data: T) => handlerRef.current(data);
    s.on(event, listener);
    return () => { s.off(event, listener); };
  }, [event]);
}
