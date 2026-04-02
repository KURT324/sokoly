import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { prisma } from '../../db';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';

const ALLOWED_EXTS = new Set(['.pdf', '.doc', '.docx', '.mp4', '.avi', '.mov', '.mkv']);

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
};

const VIDEO_EXTS = new Set(['.mp4', '.avi', '.mov', '.mkv']);

export async function materialsPublicRoutes(app: FastifyInstance) {
  // GET /api/materials/file/:filename — public file serving (DOC/PDF/VIDEO only, no auth, no watermark)
  app.get('/file/:filename', async (request, reply) => {
    const raw = (request.params as { filename: string }).filename;
    // Sanitize: strip any path separators to prevent directory traversal
    const filename = path.basename(raw);
    const ext = path.extname(filename).toLowerCase();

    if (!ALLOWED_EXTS.has(ext)) {
      return reply.status(403).send({ error: 'File type not allowed via public endpoint' });
    }

    const filePath = path.join(STORAGE_PATH, filename);
    try {
      await fs.access(filePath);
    } catch {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const mime = MIME[ext] ?? 'application/octet-stream';

    if (VIDEO_EXTS.has(ext)) {
      const stat = await fs.stat(filePath);
      const fileSize = stat.size;
      const range = request.headers.range;

      reply
        .header('Content-Type', mime)
        .header('Content-Disposition', 'inline')
        .header('Cache-Control', 'no-store')
        .header('Accept-Ranges', 'bytes');

      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        return reply
          .status(206)
          .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
          .header('Content-Length', String(end - start + 1))
          .send(fsSync.createReadStream(filePath, { start, end }));
      }

      return reply
        .header('Content-Length', String(fileSize))
        .send(fsSync.createReadStream(filePath));
    }

    // PDF / DOC — serve as buffer
    const buf = await fs.readFile(filePath);
    return reply
      .header('Content-Type', mime)
      .header('Content-Disposition', 'inline')
      .header('Cache-Control', 'no-store')
      .send(buf);
  });

  // GET /api/materials/view/:materialId — public PDF/DOC/VIDEO serving by DB record ID (no auth)
  app.get('/view/:materialId', async (request, reply) => {
    const { materialId } = request.params as { materialId: string };

    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: { storage_path: true, type: true },
    });
    if (!material || !material.storage_path) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const filename = path.basename(material.storage_path);
    const ext = path.extname(filename).toLowerCase();

    if (!ALLOWED_EXTS.has(ext)) {
      return reply.status(403).send({ error: 'File type not allowed' });
    }

    const filePath = path.join(STORAGE_PATH, filename);
    try {
      await fs.access(filePath);
    } catch {
      return reply.status(404).send({ error: 'File not found on disk' });
    }

    const mime = MIME[ext] ?? 'application/octet-stream';

    if (VIDEO_EXTS.has(ext)) {
      const stat = await fs.stat(filePath);
      const fileSize = stat.size;
      const range = request.headers.range;

      reply
        .header('Content-Type', mime)
        .header('Content-Disposition', 'inline')
        .header('Cache-Control', 'no-store')
        .header('Accept-Ranges', 'bytes');

      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        return reply
          .status(206)
          .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
          .header('Content-Length', String(end - start + 1))
          .send(fsSync.createReadStream(filePath, { start, end }));
      }

      return reply
        .header('Content-Length', String(fileSize))
        .send(fsSync.createReadStream(filePath));
    }

    const buf = await fs.readFile(filePath);
    return reply
      .header('Content-Type', mime)
      .header('Content-Disposition', 'inline')
      .header('Cache-Control', 'no-store')
      .send(buf);
  });

  // GET /api/materials/file/:filename/html — convert .docx to HTML via mammoth
  app.get('/file/:filename/html', async (request, reply) => {
    const raw = (request.params as { filename: string }).filename;
    const filename = path.basename(raw);
    const ext = path.extname(filename).toLowerCase();

    if (ext !== '.docx' && ext !== '.doc') {
      return reply.status(400).send({ error: 'Only .doc/.docx supported' });
    }

    const filePath = path.join(STORAGE_PATH, filename);
    try {
      await fs.access(filePath);
    } catch {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const buf = await fs.readFile(filePath);
    const result = await mammoth.convertToHtml({ buffer: buf });
    return reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .send(result.value);
  });
}
