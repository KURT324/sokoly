import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, CardTaskStatus } from '@prisma/client';
import { prisma } from '../../db';
import { authGuard, roleGuard } from '../../middleware/authGuard';

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
  // GET /api/card-tasks/students — list of students (for teacher assign form)
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

  // GET /api/card-tasks/annotations/:filename — serve annotation image (teacher only)
  app.get('/annotations/:filename', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    return serveImage(reply, 'annotations', filename);
  });

  // GET /api/card-tasks/student-annotations/:filename — serve annotation for the owning student
  app.get('/student-annotations/:filename', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { filename } = request.params as { filename: string };

    if (user.role !== UserRole.STUDENT) {
      return serveImage(reply, 'annotations', filename);
    }

    // Students can only see their own annotations
    const attempt = await prisma.cardAttempt.findFirst({
      where: { annotation_path: filename, task: { student_id: user.id } },
    });
    if (!attempt) return reply.status(403).send({ error: 'Forbidden' });
    return serveImage(reply, 'annotations', filename);
  });

  // POST /api/card-tasks — teacher creates a task
  app.post('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const parts = request.parts();
    let student_id = '';
    let day_id = '';
    let instructions = '';
    let imagePath: string | null = null;

    for await (const part of parts) {
      if (part.type === 'field') {
        if (part.fieldname === 'student_id') student_id = part.value as string;
        else if (part.fieldname === 'day_id') day_id = part.value as string;
        else if (part.fieldname === 'instructions') instructions = part.value as string;
      } else if (part.type === 'file' && part.fieldname === 'image') {
        const ext = path.extname(part.filename).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          await part.file.resume();
          return reply.status(400).send({ error: 'Image files only' });
        }
        await fs.mkdir(path.join(STORAGE_PATH, 'cards'), { recursive: true });
        const filename = `${uuidv4()}${ext}`;
        await pipeline(part.file, fsSync.createWriteStream(path.join(STORAGE_PATH, 'cards', filename)));
        imagePath = filename;
      }
    }

    if (!student_id || !day_id || !imagePath || !instructions) {
      return reply.status(400).send({ error: 'student_id, day_id, image and instructions are required' });
    }

    const task = await prisma.cardTask.create({
      data: {
        student_id,
        day_id,
        image_path: imagePath,
        instructions,
        created_by_id: request.user!.id,
        status: CardTaskStatus.PENDING,
      },
      include: { student: { select: { id: true, callsign: true } } },
    });

    return reply.status(201).send(task);
  });

  // GET /api/card-tasks/my — student's active task
  app.get('/my', {
    preHandler: roleGuard(UserRole.STUDENT),
  }, async (request) => {
    const student_id = request.user!.id;
    const task = await prisma.cardTask.findFirst({
      where: { student_id, status: { not: CardTaskStatus.COMPLETED } },
      include: {
        attempts: { orderBy: { attempt_number: 'desc' } },
        day: { select: { id: true, day_number: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return task ?? null;
  });

  // GET /api/card-tasks — teacher: tasks awaiting review
  app.get('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async () => {
    return prisma.cardTask.findMany({
      where: { status: CardTaskStatus.AWAITING_REVIEW },
      include: {
        student: { select: { id: true, callsign: true } },
        attempts: { orderBy: { attempt_number: 'desc' }, take: 1 },
      },
      orderBy: { created_at: 'asc' },
    });
  });

  // GET /api/card-tasks/:id — teacher: task detail + all attempts
  app.get('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await prisma.cardTask.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, callsign: true, email: true } },
        attempts: { orderBy: { attempt_number: 'asc' } },
        day: { select: { id: true, day_number: true } },
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
        const filename = `${uuidv4()}.png`;
        await pipeline(part.file, fsSync.createWriteStream(path.join(STORAGE_PATH, 'annotations', filename)));
        annotationPath = filename;
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
        data: {
          is_correct,
          teacher_comment: teacher_comment ?? null,
          reviewed_at: new Date(),
        },
      }),
      prisma.cardTask.update({
        where: { id },
        data: { status: newStatus },
      }),
    ]);

    return updatedAttempt;
  });
}
