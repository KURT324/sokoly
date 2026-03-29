import { FastifyInstance } from 'fastify';
import { UserRole } from '@eduplatform/shared';
import { prisma } from '../db';
import { roleGuard } from '../middleware/authGuard';

export async function cohortsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN) }, async () => {
    return prisma.cohort.findMany({
      where: { is_active: true },
      include: { days: { select: { id: true, day_number: true, status: true }, orderBy: { day_number: 'asc' } } },
      orderBy: { started_at: 'desc' },
    });
  });
}
