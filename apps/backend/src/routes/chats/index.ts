import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '@eduplatform/shared';
import { prisma } from '../../db';
import { authGuard } from '../../middleware/authGuard';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';

async function canAccessChat(userId: string, userRole: string, userCohortId: string | null, chatId: string): Promise<boolean> {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) return false;
  if (userRole === UserRole.ADMIN) return true;
  if (userRole === UserRole.TEACHER) return true;
  // Student: only their cohort's chats
  return chat.cohort_id === userCohortId;
}

export async function chatsRoutes(app: FastifyInstance) {
  // Serve chat file attachments
  app.get('/files/:filename', { preHandler: authGuard }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = path.join(STORAGE_PATH, 'chat-files', filename);
    try {
      const buf = await fs.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.pdf': 'application/pdf', '.png': 'image/png',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const mime = mimeMap[ext] ?? 'application/octet-stream';
      return reply
        .header('Content-Type', mime)
        .header('Cache-Control', 'private, max-age=86400')
        .send(buf);
    } catch {
      return reply.status(404).send({ error: 'Not Found' });
    }
  });

  // GET /api/chats — list user's chats with unread count
  app.get('/', { preHandler: authGuard }, async (request) => {
    const user = request.user!;
    let chats;

    if (user.role === UserRole.STUDENT) {
      if (!user.cohort_id) return [];
      chats = await prisma.chat.findMany({
        where: { cohort_id: user.cohort_id },
        include: {
          messages: {
            where: { sender_id: { not: user.id }, is_read: false },
            select: { id: true },
          },
        },
        orderBy: { created_at: 'asc' },
      });
    } else {
      chats = await prisma.chat.findMany({
        include: {
          messages: {
            where: { sender_id: { not: user.id }, is_read: false },
            select: { id: true },
          },
          cohort: { select: { id: true, name: true } },
        },
        orderBy: [{ cohort_id: 'asc' }, { type: 'asc' }],
      });
    }

    return chats.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      cohort_id: c.cohort_id,
      cohort: (c as any).cohort,
      unread: c.messages.length,
    }));
  });

  // GET /api/chats/:id/messages — paginated history
  app.get('/:id/messages', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { page = '1', limit = '50' } = request.query as { page?: string; limit?: string };

    if (!(await canAccessChat(user.id, user.role, user.cohort_id ?? null, id)))
      return reply.status(403).send({ error: 'Forbidden' });

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { chat_id: id },
        include: { sender: { select: { id: true, callsign: true, role: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.chatMessage.count({ where: { chat_id: id } }),
    ]);

    return { messages: messages.reverse(), total, page: pageNum, limit: limitNum };
  });

  // POST /api/chats/:id/messages — send message
  app.post('/:id/messages', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    if (!(await canAccessChat(user.id, user.role, user.cohort_id ?? null, id)))
      return reply.status(403).send({ error: 'Forbidden' });

    const contentType = request.headers['content-type'] ?? '';
    let content = '';
    const attachments: Array<{ filename: string; storage_path: string; mime_type: string; size: number }> = [];

    if (contentType.includes('multipart')) {
      const parts = request.parts({ limits: { fileSize: 10 * 1024 * 1024 } });
      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'content') {
          content = part.value as string;
        } else if (part.type === 'file') {
          await fs.mkdir(path.join(STORAGE_PATH, 'chat-files'), { recursive: true });
          const ext = path.extname(part.filename).toLowerCase();
          const storedName = `${uuidv4()}${ext}`;
          await pipeline(part.file, fsSync.createWriteStream(path.join(STORAGE_PATH, 'chat-files', storedName)));
          const stat = await fs.stat(path.join(STORAGE_PATH, 'chat-files', storedName));
          attachments.push({
            filename: part.filename,
            storage_path: storedName,
            mime_type: part.mimetype,
            size: stat.size,
          });
        }
      }
    } else {
      const body = request.body as { content: string };
      content = body.content ?? '';
    }

    if (!content.trim() && attachments.length === 0)
      return reply.status(400).send({ error: 'content or file required' });

    const message = await prisma.chatMessage.create({
      data: {
        chat_id: id,
        sender_id: user.id,
        content: content.trim(),
        attachments_json: attachments,
      },
      include: { sender: { select: { id: true, callsign: true, role: true } } },
    });

    // Broadcast via Socket.IO
    const { io } = await import('../../index');
    io.to(`chat:${id}`).emit('chat:message', {
      chatId: id,
      message: {
        id: message.id,
        senderId: message.sender_id,
        senderName: message.sender.callsign,
        content: message.content,
        attachments: message.attachments_json,
        createdAt: message.created_at,
      },
    });

    return reply.status(201).send(message);
  });

  // PATCH /api/chats/:id/read — mark all as read
  app.patch('/:id/read', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    if (!(await canAccessChat(user.id, user.role, user.cohort_id ?? null, id)))
      return reply.status(403).send({ error: 'Forbidden' });

    await prisma.chatMessage.updateMany({
      where: { chat_id: id, sender_id: { not: user.id }, is_read: false },
      data: { is_read: true },
    });

    return { success: true };
  });
}
