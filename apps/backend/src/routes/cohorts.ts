import { FastifyInstance } from 'fastify';
import { UserRole } from '@prisma/client';
import { prisma } from '../db';
import { roleGuard } from '../middleware/authGuard';
import { cache } from '../services/cache';

const COHORTS_KEY = 'cache:cohorts';
const COHORTS_TTL = 300; // 5 minutes

export async function cohortsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN) }, async () => {
    const cached = await cache.get(COHORTS_KEY);
    if (cached) return cached;

    const cohorts = await prisma.cohort.findMany({
      where: { is_active: true },
      include: { days: { select: { id: true, day_number: true, status: true }, orderBy: { day_number: 'asc' } } },
      orderBy: { started_at: 'desc' },
    });

    await cache.set(COHORTS_KEY, cohorts, COHORTS_TTL);
    return cohorts;
  });

  // GET /api/cohorts/:id/students — roster with per-student stats
  app.get('/:id/students', { preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const cohort = await prisma.cohort.findUnique({ where: { id } });
    if (!cohort) return reply.status(404).send({ error: 'Not Found' });

    const [students, days, tests, submissions, cardTasks] = await Promise.all([
      prisma.user.findMany({
        where: { cohort_id: id, role: UserRole.STUDENT, is_active: true },
        select: { id: true, callsign: true, email: true, last_login_at: true },
        orderBy: { callsign: 'asc' },
      }),
      prisma.day.findMany({
        where: { cohort_id: id },
        select: { id: true, status: true },
      }),
      prisma.test.findMany({
        where: { cohort_id: id },
        select: { id: true },
      }),
      prisma.testSubmission.findMany({
        where: { test: { cohort_id: id } },
        select: { student_id: true, test_id: true },
      }),
      prisma.cardTask.findMany({
        where: { student: { cohort_id: id } },
        select: { student_id: true, status: true },
      }),
    ]);

    const totalDays = days.length;
    const openDays = days.filter((d) => d.status === 'OPEN' || d.status === 'ARCHIVED').length;
    const totalTests = tests.length;

    const roster = students.map((s) => {
      const testsSubmitted = submissions.filter((sub) => sub.student_id === s.id).length;
      const myCards = cardTasks.filter((c) => c.student_id === s.id);
      const cardsCompleted = myCards.filter((c) => c.status === 'COMPLETED').length;
      const cardsTotal = myCards.length;

      return {
        id: s.id,
        callsign: s.callsign,
        email: s.email,
        last_login_at: s.last_login_at,
        testsSubmitted,
        cardsCompleted,
        cardsTotal,
      };
    });

    return {
      cohort: { id: cohort.id, name: cohort.name },
      totalDays,
      openDays,
      totalTests,
      students: roster,
    };
  });
}
