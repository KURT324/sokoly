import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './db';
import { UserRole } from '@prisma/client';

interface SocketUser {
  id: string;
  callsign: string;
  role: string;
  cohort_id: string | null;
}

async function getUserChats(user: SocketUser) {
  if (user.role === UserRole.STUDENT && user.cohort_id) {
    return prisma.chat.findMany({ where: { cohort_id: user.cohort_id } });
  }
  if (user.role === UserRole.TEACHER || user.role === UserRole.ADMIN) {
    return prisma.chat.findMany();
  }
  return [];
}

export function setupSocket(io: SocketIOServer) {
  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie ?? '';
      const match = cookie.match(/token=([^;]+)/);
      if (!match) return next(new Error('Unauthorized'));

      const payload = jwt.verify(match[1], process.env.JWT_SECRET || 'secret') as { sub: string };
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, callsign: true, role: true, cohort_id: true, is_active: true },
      });
      if (!user || !user.is_active) return next(new Error('Unauthorized'));

      (socket as any).user = user as SocketUser;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const user: SocketUser = (socket as any).user;

    // Join chat rooms
    const chats = await getUserChats(user);
    for (const chat of chats) {
      socket.join(`chat:${chat.id}`);
    }

    // Join cohort room (for day:opened notifications)
    if (user.cohort_id) {
      socket.join(`cohort:${user.cohort_id}`);
    }
    // Teachers/Admins join all cohort rooms
    if (user.role === UserRole.TEACHER || user.role === UserRole.ADMIN) {
      const cohorts = await prisma.cohort.findMany({ select: { id: true } });
      for (const c of cohorts) socket.join(`cohort:${c.id}`);
    }

    socket.on('chat:typing:start', ({ chatId }: { chatId: string }) => {
      socket.to(`chat:${chatId}`).emit('chat:typing', {
        chatId, userId: user.id, userName: user.callsign, isTyping: true,
      });
    });

    socket.on('chat:typing:stop', ({ chatId }: { chatId: string }) => {
      socket.to(`chat:${chatId}`).emit('chat:typing', {
        chatId, userId: user.id, userName: user.callsign, isTyping: false,
      });
    });
  });
}
