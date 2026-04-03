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

    // Collect student IDs upfront — needed for student-keyed FK deletes
    const students = await prisma.user.findMany({
      where: { cohort_id: id, role: 'STUDENT' },
      select: { id: true },
    });
    const studentIds = students.map((s) => s.id);

    // Delete in order to respect FK constraints:
    // 1. Chat messages (by cohort chats)
    await prisma.chatMessage.deleteMany({ where: { chat: { cohort_id: id } } });
    // 2. Chats
    await prisma.chat.deleteMany({ where: { cohort_id: id } });
    // 3. CardAttempt → CardTask by student_id (day_id is optional — can't filter by day alone)
    await prisma.cardAttempt.deleteMany({ where: { task: { student_id: { in: studentIds } } } });
    await prisma.cardTask.deleteMany({ where: { student_id: { in: studentIds } } });
    // 4. TestVariantAssignment by student_id
    await prisma.testVariantAssignment.deleteMany({ where: { student_id: { in: studentIds } } });
    // 5. TestSubmission by student_id
    await prisma.testSubmission.deleteMany({ where: { student_id: { in: studentIds } } });
    // 6. Test structure (answers → questions → variants → tests)
    await prisma.testAnswer.deleteMany({ where: { question: { variant: { test: { cohort_id: id } } } } });
    await prisma.testQuestion.deleteMany({ where: { variant: { test: { cohort_id: id } } } });
    await prisma.test.deleteMany({ where: { cohort_id: id } });
    // 7. Materials → days
    await prisma.material.deleteMany({ where: { day: { cohort_id: id } } });
    await prisma.day.deleteMany({ where: { cohort_id: id } });
    // 8. Students
    await prisma.user.deleteMany({ where: { cohort_id: id, role: 'STUDENT' } });
    // 9. Cohort
    await prisma.cohort.delete({ where: { id } });

    return { success: true };
  });
}
