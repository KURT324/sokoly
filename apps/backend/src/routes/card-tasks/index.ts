import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, CardTaskStatus } from '@prisma/client';
import { prisma } from '../../db';
import { authGuard, roleGuard } from '../../middleware/authGuard';
import { processImageFile } from '../../services/imageProcessor';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';

async function serveImage(reply: any, dir: string, filename: string) {
  const filePath = path.join(STORAGE_PATH, dir, filename);
  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return reply.header('Content-Type', mime).header('Cache-Control', 'no-store').send(buf);
  } catch {
    return reply.status(404).send({ error: 'Not Found' });
  }
}

export async function cardTasksRoutes(app: FastifyInstance) {
  // ── Library ──────────────────────────────────────────────────────────────────

  // GET /api/card-tasks/library
  app.get('/library', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async () => {
    return prisma.cardLibrary.findMany({
      include: {
        created_by: { select: { id: true, callsign: true } },
        folder: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  });

  // POST /api/card-tasks/library — upload card to library
  app.post('/library', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const parts = request.parts();
    let title = '';
    let instructions = '';
    let imagePath: string | null = null;

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'title') title = part.value as string;
        else if (part.fieldname === 'instructions') instructions = part.value as string;
      } else if (part.type === 'file' && part.fieldname === 'image') {
        const ext = path.extname(part.filename).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          await part.file.resume();
          return reply.status(400).send({ error: 'Image files only' });
        }
        await fs.mkdir(path.join(STORAGE_PATH, 'cards'), { recursive: true });
        const rawName = `${uuidv4()}${ext}`;
        const rawPath = path.join(STORAGE_PATH, 'cards', rawName);
        await pipeline(part.file, fsSync.createWriteStream(rawPath));
        const processed = await processImageFile(rawPath);
        imagePath = path.basename(processed.outputPath);
      }
    }

    if (!title.trim() || !instructions.trim() || !imagePath) {
      return reply.status(400).send({ error: 'title, instructions and image are required' });
    }

    const card = await prisma.cardLibrary.create({
      data: {
        title: title.trim(),
        instructions: instructions.trim(),
        image_path: imagePath,
        created_by_id: request.user!.id,
      },
      include: { created_by: { select: { id: true, callsign: true } } },
    });

    return reply.status(201).send(card);
  });

  // DELETE /api/card-tasks/library/:libId
  app.delete('/library/:libId', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { libId } = request.params as { libId: string };
    const card = await prisma.cardLibrary.findUnique({ where: { id: libId } });
    if (!card) return reply.status(404).send({ error: 'Not found' });

    await prisma.cardTask.updateMany({ where: { library_id: libId }, data: { library_id: null } });
    await prisma.cardLibrary.delete({ where: { id: libId } });
    try { await fs.unlink(path.join(STORAGE_PATH, 'cards', card.image_path)); } catch {}

    return reply.send({ ok: true });
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────

  // GET /api/card-tasks/students
  app.get('/students', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async () => {
    return prisma.user.findMany({
      where: { role: UserRole.STUDENT, is_active: true },
      select: { id: true, callsign: true, email: true, cohort_id: true },
      orderBy: { callsign: 'asc' },
    });
  });

  // GET /api/card-tasks/images/:filename — serve card image
  app.get('/images/:filename', { preHandler: authGuard }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    return serveImage(reply, 'cards', filename);
  });

  // GET /api/card-tasks/annotations/:filename — serve annotation (teacher only)
  app.get('/annotations/:filename', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    return serveImage(reply, 'annotations', filename);
  });

  // GET /api/card-tasks/student-annotations/:filename — student sees own annotations only
  app.get('/student-annotations/:filename', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { filename } = request.params as { filename: string };

    if (user.role !== UserRole.STUDENT) {
      return serveImage(reply, 'annotations', filename);
    }

    const attempt = await prisma.cardAttempt.findFirst({
      where: { annotation_path: filename, task: { student_id: user.id } },
    });
    if (!attempt) return reply.status(403).send({ error: 'Forbidden' });
    return serveImage(reply, 'annotations', filename);
  });

  // ── Assignments ───────────────────────────────────────────────────────────────

  // POST /api/card-tasks — assign library card to student (JSON body)
  app.post('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { library_id, student_id, instructions } = request.body as {
      library_id: string;
      student_id: string;
      instructions?: string;
    };

    if (!library_id || !student_id) {
      return reply.status(400).send({ error: 'library_id and student_id are required' });
    }

    const libCard = await prisma.cardLibrary.findUnique({ where: { id: library_id } });
    if (!libCard) return reply.status(404).send({ error: 'Library card not found' });

    const task = await prisma.cardTask.create({
      data: {
        student_id,
        library_id,
        image_path: libCard.image_path,
        instructions: instructions?.trim() || libCard.instructions,
        created_by_id: request.user!.id,
        status: CardTaskStatus.PENDING,
      },
      include: { student: { select: { id: true, callsign: true } } },
    });

    return reply.status(201).send(task);
  });

  // GET /api/card-tasks/my — student: all their tasks
  app.get('/my', {
    preHandler: roleGuard(UserRole.STUDENT),
  }, async (request) => {
    const student_id = request.user!.id;
    return prisma.cardTask.findMany({
      where: { student_id },
      include: { attempts: { orderBy: { attempt_number: 'asc' } } },
      orderBy: { created_at: 'desc' },
    });
  });

  // GET /api/card-tasks — teacher: all assignments (optional ?status= filter)
  app.get('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request) => {
    const { status } = request.query as { status?: string };
    return prisma.cardTask.findMany({
      where: status ? { status: status as CardTaskStatus } : undefined,
      include: {
        student: { select: { id: true, callsign: true } },
        library: { select: { id: true, title: true } },
        attempts: { orderBy: { attempt_number: 'desc' }, take: 1 },
      },
      orderBy: { created_at: 'desc' },
    });
  });

  // GET /api/card-tasks/:id — task detail
  app.get('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await prisma.cardTask.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, callsign: true, email: true } },
        library: { select: { id: true, title: true } },
        attempts: { orderBy: { attempt_number: 'asc' } },
      },
    });
    if (!task) return reply.status(404).send({ error: 'Not Found' });
    return task;
  });

  // POST /api/card-tasks/:id/attempt — student submits annotation
  app.post('/:id/attempt', {
    preHandler: roleGuard(UserRole.STUDENT),
  }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const task = await prisma.cardTask.findUnique({ where: { id } });
    if (!task) return reply.status(404).send({ error: 'Not Found' });
    if (task.student_id !== user.id) return reply.status(403).send({ error: 'Forbidden' });
    if (task.status === CardTaskStatus.AWAITING_REVIEW)
      return reply.status(400).send({ error: 'Already awaiting review' });
    if (task.status === CardTaskStatus.COMPLETED)
      return reply.status(400).send({ error: 'Task already completed' });

    const parts = request.parts();
    let student_comment = '';
    let annotationPath: string | null = null;

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'student_comment') {
        student_comment = part.value as string;
      } else if (part.type === 'file' && part.fieldname === 'annotation') {
        await fs.mkdir(path.join(STORAGE_PATH, 'annotations'), { recursive: true });
        const rawName = `${uuidv4()}.png`;
        const rawPath = path.join(STORAGE_PATH, 'annotations', rawName);
        await pipeline(part.file, fsSync.createWriteStream(rawPath));
        const processed = await processImageFile(rawPath);
        annotationPath = path.basename(processed.outputPath);
      }
    }

    if (!annotationPath || !student_comment.trim()) {
      return reply.status(400).send({ error: 'annotation and student_comment are required' });
    }

    const attemptCount = await prisma.cardAttempt.count({ where: { task_id: id } });

    const [attempt] = await prisma.$transaction([
      prisma.cardAttempt.create({
        data: {
          task_id: id,
          attempt_number: attemptCount + 1,
          annotation_path: annotationPath,
          student_comment,
        },
      }),
      prisma.cardTask.update({
        where: { id },
        data: { status: CardTaskStatus.AWAITING_REVIEW },
      }),
    ]);

    return reply.status(201).send(attempt);
  });

  // PATCH /api/card-tasks/:id/attempts/:attId/review — teacher reviews attempt
  app.patch('/:id/attempts/:attId/review', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id, attId } = request.params as { id: string; attId: string };
    const { is_correct, teacher_comment } = request.body as {
      is_correct: boolean;
      teacher_comment?: string;
    };

    const attempt = await prisma.cardAttempt.findUnique({ where: { id: attId } });
    if (!attempt) return reply.status(404).send({ error: 'Not Found' });

    const newStatus = is_correct ? CardTaskStatus.COMPLETED : CardTaskStatus.RETURNED;

    const [updatedAttempt] = await prisma.$transaction([
      prisma.cardAttempt.update({
        where: { id: attId },
        data: { is_correct, teacher_comment: teacher_comment ?? null, reviewed_at: new Date() },
      }),
      prisma.cardTask.update({
        where: { id },
        data: { status: newStatus },
      }),
    ]);

    return updatedAttempt;
  });
}
