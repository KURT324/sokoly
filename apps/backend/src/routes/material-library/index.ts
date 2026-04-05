import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, MaterialType } from '@prisma/client';
import { prisma } from '../../db';
import { roleGuard } from '../../middleware/authGuard';
import { processImageFile } from '../../services/imageProcessor';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';
const VIDEO_MAX_SIZE = 500 * 1024 * 1024;

const EXT_TO_TYPE: Record<string, MaterialType> = {
  '.pdf': MaterialType.PDF,
  '.doc': MaterialType.DOC,
  '.docx': MaterialType.DOC,
  '.jpg': MaterialType.IMAGE,
  '.jpeg': MaterialType.IMAGE,
  '.png': MaterialType.IMAGE,
  '.webp': MaterialType.IMAGE,
  '.mp4': MaterialType.VIDEO,
  '.avi': MaterialType.VIDEO,
  '.mov': MaterialType.VIDEO,
  '.mkv': MaterialType.VIDEO,
};

const VIDEO_EXTS = new Set(['.mp4', '.avi', '.mov', '.mkv']);
const VIDEO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
};

export async function materialLibraryRoutes(app: FastifyInstance) {
  // GET /api/material-library — list all library items
  app.get('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async () => {
    return prisma.materialLibrary.findMany({
      orderBy: [{ folder: 'asc' }, { created_at: 'desc' }],
    });
  });

  // POST /api/material-library — upload file or add link
  app.post('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const contentType = request.headers['content-type'] ?? '';

    if (!contentType.includes('multipart')) {
      const { url, title, folder } = request.body as { url: string; title: string; folder?: string };
      if (!url || !title) return reply.status(400).send({ error: 'url and title required' });

      const item = await prisma.materialLibrary.create({
        data: {
          type: MaterialType.LINK,
          title,
          folder: folder || null,
          url,
          created_by_id: request.user!.id,
        },
      });
      return reply.status(201).send(item);
    }

    const data = await request.file({ limits: { fileSize: VIDEO_MAX_SIZE } });
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    const ext = path.extname(data.filename).toLowerCase();
    const type = EXT_TO_TYPE[ext];
    if (!type) {
      return reply.status(400).send({ error: 'Unsupported file type. Allowed: PDF, DOC, DOCX, JPG, PNG, WEBP, MP4, AVI, MOV, MKV' });
    }

    await fs.mkdir(STORAGE_PATH, { recursive: true });
    let storedName = `${uuidv4()}${ext}`;
    let storedPath = path.join(STORAGE_PATH, storedName);
    await pipeline(data.file, fsSync.createWriteStream(storedPath));

    const processed = await processImageFile(storedPath);
    storedPath = processed.outputPath;
    storedName = path.basename(processed.outputPath);

    const stat = { size: processed.sizeBytes };
    const title = data.fields?.title
      ? (data.fields.title as { value: string }).value
      : data.filename;
    const folder = data.fields?.folder
      ? (data.fields.folder as { value: string }).value || null
      : null;

    const item = await prisma.materialLibrary.create({
      data: {
        type,
        title,
        folder,
        storage_path: storedName,
        size_bytes: stat.size,
        created_by_id: request.user!.id,
      },
    });

    return reply.status(201).send(item);
  });

  // DELETE /api/material-library/:id
  app.delete('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = await prisma.materialLibrary.findUnique({ where: { id } });
    if (!item) return reply.status(404).send({ error: 'Not Found' });

    if (item.storage_path) {
      await fs.unlink(path.join(STORAGE_PATH, item.storage_path)).catch(() => null);
    }

    await prisma.materialLibrary.delete({ where: { id } });
    return { success: true };
  });

  // POST /api/material-library/:id/attach — copy item to a day
  app.post('/:id/attach', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { day_id } = request.body as { day_id: string };

    if (!day_id) return reply.status(400).send({ error: 'day_id required' });

    const [item, day] = await Promise.all([
      prisma.materialLibrary.findUnique({ where: { id } }),
      prisma.day.findUnique({ where: { id: day_id } }),
    ]);

    if (!item) return reply.status(404).send({ error: 'Library item not found' });
    if (!day) return reply.status(404).send({ error: 'Day not found' });

    // Copy file on disk if it has one
    let newStoragePath: string | null = null;
    if (item.storage_path) {
      const srcPath = path.join(STORAGE_PATH, item.storage_path);
      const ext = path.extname(item.storage_path);
      const destName = `${uuidv4()}${ext}`;
      const destPath = path.join(STORAGE_PATH, destName);
      await fs.copyFile(srcPath, destPath);
      newStoragePath = destName;
    }

    const material = await prisma.material.create({
      data: {
        day_id,
        library_id: item.id,
        type: item.type,
        title: item.title,
        storage_path: newStoragePath,
        url: item.url,
        size_bytes: item.size_bytes,
      },
    });

    return reply.status(201).send(material);
  });

  // GET /api/material-library/:id/view — serve file for preview (teacher only)
  app.get('/:id/view', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = await prisma.materialLibrary.findUnique({ where: { id } });
    if (!item) return reply.status(404).send({ error: 'Not Found' });

    if (item.type === MaterialType.LINK) return { url: item.url };
    if (!item.storage_path) return reply.status(404).send({ error: 'File not found' });

    const filePath = path.join(STORAGE_PATH, item.storage_path);
    try { await fs.access(filePath); } catch {
      return reply.status(404).send({ error: 'File not found on disk' });
    }

    const ext = path.extname(item.storage_path).toLowerCase();

    if (VIDEO_EXTS.has(ext)) {
      const stat = await fs.stat(filePath);
      const fileSize = stat.size;
      const mimeType = VIDEO_MIME[ext] || 'video/mp4';
      const range = request.headers.range;

      reply
        .header('Content-Type', mimeType)
        .header('Content-Disposition', 'inline')
        .header('Cache-Control', 'no-store')
        .header('Accept-Ranges', 'bytes');

      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        const stream = fsSync.createReadStream(filePath, { start, end });
        return reply
          .status(206)
          .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
          .header('Content-Length', String(end - start + 1))
          .send(stream);
      }

      return reply
        .header('Content-Length', String(fileSize))
        .send(fsSync.createReadStream(filePath));
    }

    const buf = await fs.readFile(filePath);
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.webp': 'image/webp',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const mime = mimeMap[ext] || 'application/octet-stream';

    return reply
      .header('Content-Type', mime)
      .header('Content-Disposition', 'inline')
      .header('Cache-Control', 'no-store')
      .send(buf);
  });
}
