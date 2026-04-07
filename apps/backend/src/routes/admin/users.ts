import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '@prisma/client';
import { prisma } from '../../db';
import { roleGuard } from '../../middleware/authGuard';

export async function adminUsersRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: roleGuard(UserRole.ADMIN) };

  // GET /api/admin/users
  app.get('/', adminOnly, async (request) => {
    const { role, cohort_id } = request.query as { role?: string; cohort_id?: string };

    const where: Record<string, unknown> = {};
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }
    if (cohort_id) where.cohort_id = cohort_id;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        callsign: true,
        role: true,
        cohort_id: true,
        is_active: true,
        must_change_password: true,
        created_at: true,
        last_login_at: true,
        cohort: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return users;
  });

  // POST /api/admin/users
  app.post('/', adminOnly, async (request, reply) => {
    const { email, callsign, role, cohort_id, password } = request.body as {
      email: string;
      callsign: string;
      role: UserRole;
      cohort_id?: string;
      password: string;
    };

    if (!email || !callsign || !role || !password) {
      return reply.status(400).send({ error: 'Bad Request', message: 'email, callsign, role, password required' });
    }

    if (!Object.values(UserRole).includes(role)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid role' });
    }

    if (role === UserRole.STUDENT && !cohort_id) {
      return reply.status(400).send({ error: 'Bad Request', message: 'cohort_id required for students' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: 'Conflict', message: 'Email already in use' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        callsign,
        role,
        cohort_id: role === UserRole.STUDENT ? cohort_id : null,
        password_hash,
        must_change_password: true,
        watermark_id: role === UserRole.STUDENT ? uuidv4() : null,
      },
      select: {
        id: true,
        email: true,
        callsign: true,
        role: true,
        cohort_id: true,
        is_active: true,
        must_change_password: true,
        created_at: true,
      },
    });

    return reply.status(201).send(user);
  });

  // PATCH /api/admin/users/:id
  app.patch('/:id', adminOnly, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { callsign, email, cohort_id, is_active } = request.body as {
      callsign?: string;
      email?: string;
      cohort_id?: string | null;
      is_active?: boolean;
    };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.status(404).send({ error: 'Not Found' });

    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return reply.status(409).send({ error: 'Conflict', message: 'Email already in use' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(callsign !== undefined && { callsign }),
        ...(email !== undefined && { email }),
        ...(cohort_id !== undefined && { cohort_id }),
        ...(is_active !== undefined && { is_active }),
      },
      select: {
        id: true,
        email: true,
        callsign: true,
        role: true,
        cohort_id: true,
        is_active: true,
        must_change_password: true,
        created_at: true,
      },
    });

    return updated;
  });

  // PATCH /api/admin/users/:id/password
  app.patch('/:id/password', adminOnly, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { password } = request.body as { password?: string };

    if (!password || password.length < 6) {
      return reply.status(400).send({ error: 'Bad Request', message: 'password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.status(404).send({ error: 'Not Found' });

    const password_hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id },
      data: { password_hash, must_change_password: false },
    });

    return { success: true };
  });

  // DELETE /api/admin/users/:id
  app.delete('/:id', adminOnly, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (id === request.user!.id) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Cannot delete yourself' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.status(404).send({ error: 'Not Found' });

    await prisma.$transaction(async (tx) => {
      // 1. CardAttempt (references CardTask, no cascade)
      await tx.cardAttempt.deleteMany({
        where: { task: { student_id: id } },
      });
      // 2. CardTask (student_id FK, no cascade)
      await tx.cardTask.deleteMany({ where: { student_id: id } });
      // 3. TestSubmission (student_id FK, no cascade)
      await tx.testSubmission.deleteMany({ where: { student_id: id } });
      // 4. ChatMessage (sender_id FK, no cascade)
      await tx.chatMessage.deleteMany({ where: { sender_id: id } });
      // 5. DirectMessage — all messages in chats where user is a participant
      const directChats = await tx.directChat.findMany({
        where: { OR: [{ user1_id: id }, { user2_id: id }] },
        select: { id: true },
      });
      const directChatIds = directChats.map((c) => c.id);
      await tx.directMessage.deleteMany({ where: { chat_id: { in: directChatIds } } });
      // 6. DirectChat (user1_id/user2_id FKs, no cascade)
      await tx.directChat.deleteMany({ where: { OR: [{ user1_id: id }, { user2_id: id }] } });
      // 7. ActivityLog (actor_id FK, no cascade)
      await tx.activityLog.deleteMany({ where: { actor_id: id } });
      // 8. TestVariantAssignment (has onDelete: Cascade but be explicit)
      await tx.testVariantAssignment.deleteMany({ where: { student_id: id } });
      // 9. User
      await tx.user.delete({ where: { id } });
    });

    return { success: true };
  });
}
