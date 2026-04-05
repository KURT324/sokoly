import { FastifyInstance } from 'fastify';
import { UserRole } from '@prisma/client';
import { prisma } from '../../db';
import { roleGuard } from '../../middleware/authGuard';

const guard = { preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN) };

export async function directChatsRoutes(app: FastifyInstance) {
  // GET /api/direct-chats/users — list all other teachers/admins (for new chat)
  app.get('/users', guard, async (request) => {
    const myId = request.user!.id;
    return prisma.user.findMany({
      where: { role: { in: [UserRole.TEACHER, UserRole.ADMIN] }, is_active: true, id: { not: myId } },
      select: { id: true, callsign: true, role: true },
      orderBy: { callsign: 'asc' },
    });
  });

  // GET /api/direct-chats — list my direct chats with last message
  app.get('/', guard, async (request) => {
    const myId = request.user!.id;
    const chats = await prisma.directChat.findMany({
      where: { OR: [{ user1_id: myId }, { user2_id: myId }] },
      include: {
        user1: { select: { id: true, callsign: true } },
        user2: { select: { id: true, callsign: true } },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return chats.map((chat) => {
      const partner = chat.user1_id === myId ? chat.user2 : chat.user1;
      const last = chat.messages[0] ?? null;
      return {
        id: chat.id,
        partner,
        last_message: last
          ? { content: last.content, created_at: last.created_at, sender_id: last.sender_id }
          : null,
        created_at: chat.created_at,
      };
    });
  });

  // POST /api/direct-chats — find or create chat with { userId }
  app.post('/', guard, async (request, reply) => {
    const myId = request.user!.id;
    const { userId } = request.body as { userId: string };

    if (!userId || userId === myId) {
      return reply.status(400).send({ error: 'Invalid userId' });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, callsign: true, is_active: true },
    });
    if (!target || !target.is_active ||
        (target.role !== UserRole.TEACHER && target.role !== UserRole.ADMIN)) {
      return reply.status(400).send({ error: 'Target user not found or not a teacher/admin' });
    }

    // Normalize pair order so unique constraint is deterministic
    const [user1_id, user2_id] = [myId, userId].sort();

    const chat = await prisma.directChat.upsert({
      where: { user1_id_user2_id: { user1_id, user2_id } },
      update: {},
      create: { user1_id, user2_id },
      include: {
        user1: { select: { id: true, callsign: true } },
        user2: { select: { id: true, callsign: true } },
      },
    });

    const partner = chat.user1_id === myId ? chat.user2 : chat.user1;
    return { id: chat.id, partner, created_at: chat.created_at };
  });

  // GET /api/direct-chats/:id/messages — message history
  app.get('/:id/messages', guard, async (request, reply) => {
    const myId = request.user!.id;
    const { id } = request.params as { id: string };

    const chat = await prisma.directChat.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: 'Not Found' });
    if (chat.user1_id !== myId && chat.user2_id !== myId) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    return prisma.directMessage.findMany({
      where: { chat_id: id },
      include: { sender: { select: { id: true, callsign: true } } },
      orderBy: { created_at: 'asc' },
    });
  });

  // POST /api/direct-chats/:id/messages — send message
  app.post('/:id/messages', guard, async (request, reply) => {
    const myId = request.user!.id;
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };

    if (!content?.trim()) {
      return reply.status(400).send({ error: 'content is required' });
    }

    const chat = await prisma.directChat.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: 'Not Found' });
    if (chat.user1_id !== myId && chat.user2_id !== myId) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const message = await prisma.directMessage.create({
      data: { chat_id: id, sender_id: myId, content: content.trim() },
      include: { sender: { select: { id: true, callsign: true } } },
    });

    // Broadcast to both participants via personal rooms
    const { io } = await import('../../index');
    io.to(`user:${chat.user1_id}`).to(`user:${chat.user2_id}`).emit('direct:message', {
      chatId: id,
      message: {
        id: message.id,
        chat_id: id,
        sender_id: message.sender_id,
        sender: message.sender,
        content: message.content,
        is_read: message.is_read,
        created_at: message.created_at,
      },
    });

    return reply.status(201).send(message);
  });

  // PATCH /api/direct-chats/:id/read — mark messages as read
  app.patch('/:id/read', guard, async (request, reply) => {
    const myId = request.user!.id;
    const { id } = request.params as { id: string };

    const chat = await prisma.directChat.findUnique({ where: { id } });
    if (!chat) return reply.status(404).send({ error: 'Not Found' });
    if (chat.user1_id !== myId && chat.user2_id !== myId) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await prisma.directMessage.updateMany({
      where: { chat_id: id, sender_id: { not: myId }, is_read: false },
      data: { is_read: true },
    });

    return { success: true };
  });
}
