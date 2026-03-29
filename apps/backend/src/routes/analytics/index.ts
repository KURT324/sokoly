import { FastifyInstance } from 'fastify';
import { UserRole } from '@eduplatform/shared';
import { prisma } from '../../db';
import { roleGuard } from '../../middleware/authGuard';

export async function analyticsRoutes(app: FastifyInstance) {
  const teacherOrAdmin = { preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN) };
  const adminOnly = { preHandler: roleGuard(UserRole.ADMIN) };

  // GET /api/analytics/cohorts/:id/tests
  // Returns: array of students with their scores per test + average
  app.get('/cohorts/:id/tests', teacherOrAdmin, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [students, tests, submissions] = await Promise.all([
      prisma.user.findMany({
        where: { cohort_id: id, role: UserRole.STUDENT, is_active: true },
        select: { id: true, callsign: true, email: true },
        orderBy: { callsign: 'asc' },
      }),
      prisma.test.findMany({
        where: { cohort_id: id },
        select: { id: true, title: true, created_at: true },
        orderBy: { created_at: 'asc' },
      }),
      prisma.testSubmission.findMany({
        where: { test: { cohort_id: id } },
        select: { student_id: true, test_id: true, auto_score: true, manual_score: true },
      }),
    ]);

    const rows = students.map((student) => {
      const scores: Record<string, number | null | 'pending'> = {};
      let totalScore = 0;
      let scoredCount = 0;

      for (const test of tests) {
        const sub = submissions.find((s) => s.student_id === student.id && s.test_id === test.id);
        if (!sub) {
          scores[test.id] = null;
        } else if (sub.manual_score != null) {
          scores[test.id] = sub.manual_score;
          totalScore += sub.manual_score;
          scoredCount++;
        } else if (sub.auto_score != null) {
          scores[test.id] = sub.auto_score;
          totalScore += sub.auto_score;
          scoredCount++;
        } else {
          scores[test.id] = 'pending';
        }
      }

      return {
        student,
        scores,
        average: scoredCount > 0 ? totalScore / scoredCount : null,
      };
    });

    // Column averages
    const columnAverages: Record<string, number | null> = {};
    for (const test of tests) {
      const numericScores = rows
        .map((r) => r.scores[test.id])
        .filter((s): s is number => typeof s === 'number');
      columnAverages[test.id] = numericScores.length > 0
        ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length
        : null;
    }

    return { tests, rows, columnAverages };
  });

  // GET /api/analytics/cohorts/:id/cards
  app.get('/cohorts/:id/cards', teacherOrAdmin, async (request, reply) => {
    const { id } = request.params as { id: string };

    const students = await prisma.user.findMany({
      where: { cohort_id: id, role: UserRole.STUDENT, is_active: true },
      select: { id: true, callsign: true },
      orderBy: { callsign: 'asc' },
    });

    const tasks = await prisma.cardTask.findMany({
      where: { student: { cohort_id: id } },
      include: { attempts: { select: { attempt_number: true, is_correct: true } } },
    });

    const rows = students.map((student) => {
      const studentTasks = tasks.filter((t) => t.student_id === student.id);
      const totalTasks = studentTasks.length;
      const totalAttempts = studentTasks.reduce((sum, t) => sum + t.attempts.length, 0);
      const completedTasks = studentTasks.filter((t) => t.status === 'COMPLETED');
      const firstAttemptSuccess = completedTasks.filter(
        (t) => t.attempts.find((a) => a.is_correct)?.attempt_number === 1,
      ).length;
      const firstAttemptPct = completedTasks.length > 0
        ? Math.round((firstAttemptSuccess / completedTasks.length) * 100)
        : null;

      const lastTask = studentTasks.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];

      return {
        student,
        totalTasks,
        totalAttempts,
        firstAttemptPct,
        avgAttempts: totalTasks > 0 ? +(totalAttempts / totalTasks).toFixed(1) : 0,
        lastStatus: lastTask?.status ?? null,
      };
    });

    return rows;
  });

  // GET /api/analytics/students/:id
  app.get('/students/:id', teacherOrAdmin, async (request, reply) => {
    const { id } = request.params as { id: string };

    const student = await prisma.user.findUnique({
      where: { id },
      select: { id: true, callsign: true, email: true, cohort_id: true },
    });
    if (!student) return reply.status(404).send({ error: 'Not Found' });

    const [submissions, cardTasks] = await Promise.all([
      prisma.testSubmission.findMany({
        where: { student_id: id },
        include: { test: { select: { id: true, title: true } } },
        orderBy: { submitted_at: 'asc' },
      }),
      prisma.cardTask.findMany({
        where: { student_id: id },
        include: { attempts: true, day: { select: { day_number: true } } },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    return { student, submissions, cardTasks };
  });

  // GET /api/analytics/overview — admin: all cohorts summary
  app.get('/overview', adminOnly, async () => {
    const cohorts = await prisma.cohort.findMany({
      where: { is_active: true },
      include: {
        _count: { select: { users: true } },
        users: { where: { role: UserRole.STUDENT }, select: { id: true } },
      },
      orderBy: { started_at: 'desc' },
    });

    const result = await Promise.all(
      cohorts.map(async (cohort) => {
        const studentIds = cohort.users.map((u) => u.id);

        const submissions = await prisma.testSubmission.findMany({
          where: { student_id: { in: studentIds }, test: { cohort_id: cohort.id } },
          select: { auto_score: true, manual_score: true },
        });

        const numericScores = submissions
          .map((s) => s.manual_score ?? s.auto_score)
          .filter((s): s is number => s != null);
        const avgTestScore = numericScores.length > 0
          ? +(numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(1)
          : null;

        const cardTasks = await prisma.cardTask.findMany({
          where: { student_id: { in: studentIds } },
          include: { attempts: { select: { attempt_number: true, is_correct: true } } },
        });

        const completedTasks = cardTasks.filter((t) => t.status === 'COMPLETED');
        const firstAttemptSuccess = completedTasks.filter(
          (t) => t.attempts.find((a) => a.is_correct)?.attempt_number === 1,
        ).length;
        const firstAttemptPct = completedTasks.length > 0
          ? Math.round((firstAttemptSuccess / completedTasks.length) * 100)
          : null;

        return {
          cohort: { id: cohort.id, name: cohort.name, started_at: cohort.started_at },
          studentCount: studentIds.length,
          avgTestScore,
          firstAttemptPct,
        };
      }),
    );

    // Global metrics
    const [totalStudents, totalTeachers, totalActiveCohorts] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.STUDENT, is_active: true } }),
      prisma.user.count({ where: { role: UserRole.TEACHER, is_active: true } }),
      prisma.cohort.count({ where: { is_active: true } }),
    ]);

    return { metrics: { totalStudents, totalTeachers, totalActiveCohorts }, cohorts: result };
  });

  // GET /api/analytics/export?format=csv — admin CSV export
  app.get('/export', adminOnly, async (request, reply) => {
    const activeCohorts = await prisma.cohort.findMany({
      where: { is_active: true },
      include: { users: { where: { role: UserRole.STUDENT, is_active: true }, select: { id: true, callsign: true, email: true } } },
    });

    const allStudentIds = activeCohorts.flatMap((c) => c.users.map((u) => u.id));

    const [allSubmissions, allCardTasks, allTests] = await Promise.all([
      prisma.testSubmission.findMany({
        where: { student_id: { in: allStudentIds } },
        include: { test: { select: { id: true, title: true, cohort_id: true } } },
      }),
      prisma.cardTask.findMany({
        where: { student_id: { in: allStudentIds } },
        include: { attempts: { select: { attempt_number: true } } },
      }),
      prisma.test.findMany({
        where: { cohort_id: { in: activeCohorts.map((c) => c.id) } },
        select: { id: true, title: true, cohort_id: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    // Build CSV
    const testTitles = allTests.map((t) => `"${t.title.replace(/"/g, '""')}"`);
    const header = ['Позывной', 'Email', 'Группа', ...testTitles.map((t) => t), 'Всего попыток карточек'].join(',');

    const dataRows = activeCohorts.flatMap((cohort) =>
      cohort.users.map((student) => {
        const cohortTests = allTests.filter((t) => t.cohort_id === cohort.id);
        const testScores = allTests.map((test) => {
          if (!cohortTests.find((t) => t.id === test.id)) return '';
          const sub = allSubmissions.find((s) => s.student_id === student.id && s.test_id === test.id);
          if (!sub) return '';
          const score = sub.manual_score ?? sub.auto_score;
          return score != null ? score.toFixed(1) : 'pending';
        });

        const cardAttempts = allCardTasks
          .filter((t) => t.student_id === student.id)
          .reduce((sum, t) => sum + t.attempts.length, 0);

        return [
          `"${student.callsign}"`,
          `"${student.email}"`,
          `"${cohort.name}"`,
          ...testScores,
          cardAttempts,
        ].join(',');
      }),
    );

    const csv = [header, ...dataRows].join('\n');

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="analytics.csv"')
      .send('\ufeff' + csv); // BOM for Excel
  });
}
