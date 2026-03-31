import { FastifyInstance } from 'fastify';
import { UserRole } from '@prisma/client';
import { prisma } from '../../db';
import { roleGuard } from '../../middleware/authGuard';

export async function cardFoldersRoutes(app: FastifyInstance) {
  // GET /api/card-folders — list all folders
  app.get('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async () => {
    return prisma.cardFolder.findMany({
      include: {
        _count: { select: { cards: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  });

  // POST /api/card-folders — create folder
  app.post('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { name } = request.body as { name: string };
    if (!name?.trim()) return reply.status(400).send({ error: 'name is required' });

    const folder = await prisma.cardFolder.create({
      data: { name: name.trim(), created_by_id: request.user!.id },
      include: { _count: { select: { cards: true } } },
    });
    return reply.status(201).send(folder);
  });

  // PATCH /api/card-folders/:id — rename folder
  app.patch('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name: string };
    if (!name?.trim()) return reply.status(400).send({ error: 'name is required' });

    const folder = await prisma.cardFolder.update({
      where: { id },
      data: { name: name.trim() },
      include: { _count: { select: { cards: true } } },
    });
    return folder;
  });

  // DELETE /api/card-folders/:id — delete folder (moves cards to root first)
  app.delete('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { force } = request.query as { force?: string };

    const folder = await prisma.cardFolder.findUnique({
      where: { id },
      include: { _count: { select: { cards: true } } },
    });
    if (!folder) return reply.status(404).send({ error: 'Not found' });

    if (folder._count.cards > 0 && force !== 'true') {
      return reply.status(409).send({ error: 'Folder is not empty', count: folder._count.cards });
    }

    // Move all cards to root, then delete folder
    await prisma.$transaction([
      prisma.cardLibrary.updateMany({ where: { folder_id: id }, data: { folder_id: null } }),
      prisma.cardFolder.delete({ where: { id } }),
    ]);

    return reply.send({ ok: true });
  });

  // PATCH /api/card-folders/move-card/:cardId — move card to folder (or root)
  app.patch('/move-card/:cardId', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { cardId } = request.params as { cardId: string };
    const { folder_id } = request.body as { folder_id: string | null };

    const card = await prisma.cardLibrary.findUnique({ where: { id: cardId } });
    if (!card) return reply.status(404).send({ error: 'Not found' });

    const updated = await prisma.cardLibrary.update({
      where: { id: cardId },
      data: { folder_id: folder_id ?? null },
    });
    return updated;
  });
}
