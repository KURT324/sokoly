import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, MaterialType } from '@prisma/client';
import { prisma } from '../../db';
import { authGuard, roleGuard } from '../../middleware/authGuard';
import { applyImageWatermark, applyPdfWatermark } from '../../services/watermark';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;

const EXT_TO_TYPE: Record<string, MaterialType> = {
  '.pdf': MaterialType.PDF,
  '.doc': MaterialType.DOC,
  '.docx': MaterialType.DOC,
  '.jpg': MaterialType.IMAGE,
  '.jpeg': MaterialType.IMAGE,
  '.png': MaterialType.IMAGE,
  '.webp': MaterialType.IMAGE,
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export async function daysRoutes(app: FastifyInstance) {
  // GET /api/days — list days
  app.get('/', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;

    if (user.role === UserRole.STUDENT) {
      if (!user.cohort_id) return reply.status(400).send({ error: 'No cohort assigned' });
      const days = await prisma.day.findMany({
        where: { cohort_id: user.cohort_id },
        orderBy: { day_number: 'asc' },
      });
      return days;
    }

    // Teacher / Admin — all days, optionally filtered by cohort
    const { cohort_id } = request.query as { cohort_id?: string };
    const days = await prisma.day.findMany({
      where: cohort_id ? { cohort_id } : undefined,
      include: { cohort: { select: { id: true, name: true } } },
      orderBy: [{ cohort_id: 'asc' }, { day_number: 'asc' }],
    });
    return days;
  });

  // GET /api/days/:id — day detail
  app.get('/:id', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const day = await prisma.day.findUnique({
      where: { id },
      include: {
        materials: { orderBy: { created_at: 'asc' } },
        cohort: { select: { id: true, name: true } },
      },
    });

    if (!day) return reply.status(404).send({ error: 'Not Found' });

    if (user.role === UserRole.STUDENT) {
      if (day.cohort_id !== user.cohort_id)
        return reply.status(403).send({ error: 'Forbidden' });
      if (day.status !== 'OPEN')
        return reply.status(403).send({ error: 'Forbidden', message: 'Day is not open' });
    }

    return day;
  });

  // PATCH /api/days/:id/open — open day
  app.patch('/:id/open', { preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const day = await prisma.day.findUnique({ where: { id } });
    if (!day) return reply.status(404).send({ error: 'Not Found' });
    if (day.status !== 'LOCKED')
      return reply.status(400).send({ error: 'Bad Request', message: 'Day is already open or archived' });

    const updated = await prisma.day.update({
      where: { id },
      data: { status: 'OPEN', opened_at: new Date(), opened_by_id: request.user!.id },
    });

    // Notify students via Socket.IO
    const { io } = await import('../../index');
    io.to(`cohort:${day.cohort_id}`).emit('day:opened', { dayId: id, dayNumber: day.day_number });

    return updated;
  });

  // POST /api/days/:id/materials — upload file
  app.post('/:id/materials', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const day = await prisma.day.findUnique({ where: { id } });
    if (!day) return reply.status(404).send({ error: 'Not Found' });

    // Handle link type
    const contentType = request.headers['content-type'] ?? '';

    if (!contentType.includes('multipart')) {
      const { url, title } = request.body as { url: string; title: string };
      if (!url || !title) return reply.status(400).send({ error: 'url and title required' });

      const material = await prisma.material.create({
        data: { day_id: id, type: MaterialType.LINK, title, url },
      });
      return reply.status(201).send(material);
    }

    const data = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    const ext = path.extname(data.filename).toLowerCase();
    const type = EXT_TO_TYPE[ext];
    if (!type) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Unsupported file type' });
    }

    // Ensure storage directory exists
    await fs.mkdir(STORAGE_PATH, { recursive: true });

    const storedName = `${uuidv4()}${ext}`;
    const storedPath = path.join(STORAGE_PATH, storedName);

    await pipeline(data.file, fsSync.createWriteStream(storedPath));

    const stat = await fs.stat(storedPath);
    const title = data.fields?.title
      ? (data.fields.title as { value: string }).value
      : data.filename;

    const material = await prisma.material.create({
      data: {
        day_id: id,
        type,
        title,
        storage_path: storedName,
        size_bytes: stat.size,
      },
    });

    return reply.status(201).send(material);
  });

  // DELETE /api/days/:id/materials/:matId
  app.delete('/:id/materials/:matId', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { matId } = request.params as { id: string; matId: string };

    const material = await prisma.material.findUnique({ where: { id: matId } });
    if (!material) return reply.status(404).send({ error: 'Not Found' });

    if (material.storage_path) {
      const filePath = path.join(STORAGE_PATH, material.storage_path);
      await fs.unlink(filePath).catch(() => null);
    }

    await prisma.material.delete({ where: { id: matId } });
    return { success: true };
  });

  // GET /api/days/:id/materials/:matId/view — protected file with watermark
  app.get('/:id/materials/:matId/view', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { matId } = request.params as { id: string; matId: string };

    const material = await prisma.material.findUnique({
      where: { id: matId },
      include: { day: true },
    });

    if (!material) return reply.status(404).send({ error: 'Not Found' });

    // Students: check cohort + day open
    if (user.role === UserRole.STUDENT) {
      if (material.day.cohort_id !== user.cohort_id)
        return reply.status(403).send({ error: 'Forbidden' });
      if (material.day.status !== 'OPEN')
        return reply.status(403).send({ error: 'Forbidden', message: 'Day is not open' });
    }

    // Link type — return url
    if (material.type === MaterialType.LINK) {
      return { url: material.url };
    }

    if (!material.storage_path)
      return reply.status(404).send({ error: 'File not found' });

    const filePath = path.join(STORAGE_PATH, material.storage_path);
    try {
      await fs.access(filePath);
    } catch {
      return reply.status(404).send({ error: 'File not found on disk' });
    }

    const ext = path.extname(material.storage_path).toLowerCase();
    const fullUserRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { callsign: true, watermark_id: true },
    });
    const fullName = fullUserRecord?.callsign ?? user.callsign;
    const watermarkId = fullUserRecord?.watermark_id ?? user.id.slice(0, 8);

    let fileBuffer: Buffer;
    let mimeType: string;

    if (IMAGE_EXTS.has(ext)) {
      fileBuffer = await applyImageWatermark(filePath, fullName, watermarkId);
      mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    } else if (ext === '.pdf') {
      fileBuffer = await applyPdfWatermark(filePath, fullName, watermarkId);
      mimeType = 'application/pdf';
    } else {
      // DOC/DOCX — serve as-is (no watermark for doc files)
      fileBuffer = await fs.readFile(filePath);
      mimeType = 'application/octet-stream';
    }

    reply
      .header('Content-Type', mimeType)
      .header('Content-Disposition', 'inline')
      .header('Cache-Control', 'no-store, no-cache')
      .header('X-Content-Type-Options', 'nosniff');

    return reply.send(fileBuffer);
  });
}
