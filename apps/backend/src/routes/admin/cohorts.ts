import { FastifyInstance } from 'fastify';
import { UserRole, ChatType, DayStatus } from '@prisma/client';
import { prisma } from '../../db';
import { roleGuard } from '../../middleware/authGuard';

export async function adminCohortsRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: roleGuard(UserRole.ADMIN) };

  // GET /api/admin/cohorts
  app.get('/', adminOnly, async () => {
    const cohorts = await prisma.cohort.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      started_at: c.started_at,
      is_active: c.is_active,
      created_at: c.created_at,
      student_count: c._count.users,
      _count: c._count,
    }));
  });

  // POST /api/admin/cohorts
  app.post('/', adminOnly, async (request, reply) => {
    const { name, started_at } = request.body as { name: string; started_at: string };

    if (!name || !started_at) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and started_at required' });
    }

    const cohort = await prisma.cohort.create({
      data: {
        name,
        started_at: new Date(started_at),
        is_active: true,
      },
    });

    // Auto-create 11 days
    await prisma.day.createMany({
      data: Array.from({ length: 11 }, (_, i) => ({
        day_number: i + 1,
        cohort_id: cohort.id,
        status: DayStatus.LOCKED,
      })),
    });

    // Auto-create 3 chats
    await prisma.chat.createMany({
      data: [
        { type: ChatType.GROUP, cohort_id: cohort.id, name: 'Общий чат группы' },
        { type: ChatType.STUDENT_TEACHER, cohort_id: cohort.id, name: 'Чат с преподавателем' },
        { type: ChatType.STUDENT_ADMIN, cohort_id: cohort.id, name: 'Чат с администратором' },
      ],
    });

    return reply.status(201).send(cohort);
  });

  // DELETE /api/admin/cohorts/:id
  app.delete('/:id', adminOnly, async (request, reply) => {
    const { id } = request.params as { id: string };

    const cohort = await prisma.cohort.findUnique({ where: { id } });
    if (!cohort) return reply.status(404).send({ error: 'Not Found' });

    // Delete in order to respect FK constraints:
    // 1. Chat messages
    await prisma.chatMessage.deleteMany({ where: { chat: { cohort_id: id } } });
    // 2. Chats
    await prisma.chat.deleteMany({ where: { cohort_id: id } });
    // 3. Card attempts → card tasks
    const days = await prisma.day.findMany({ where: { cohort_id: id }, select: { id: true } });
    const dayIds = days.map((d) => d.id);
    await prisma.cardAttempt.deleteMany({ where: { task: { day_id: { in: dayIds } } } });
    await prisma.cardTask.deleteMany({ where: { day_id: { in: dayIds } } });
    // 4. Test submissions → tests
    await prisma.testSubmission.deleteMany({ where: { test: { cohort_id: id } } });
    await prisma.testAnswer.deleteMany({ where: { question: { test: { cohort_id: id } } } });
    await prisma.testQuestion.deleteMany({ where: { test: { cohort_id: id } } });
    await prisma.test.deleteMany({ where: { cohort_id: id } });
    // 5. Materials → days
    await prisma.material.deleteMany({ where: { day: { cohort_id: id } } });
    await prisma.day.deleteMany({ where: { cohort_id: id } });
    // 6. Students
    await prisma.user.deleteMany({ where: { cohort_id: id, role: 'STUDENT' } });
    // 7. Cohort
    await prisma.cohort.delete({ where: { id } });

    return { success: true };
  });
}
