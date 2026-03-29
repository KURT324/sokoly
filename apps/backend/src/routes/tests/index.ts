import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, QuestionType } from '@eduplatform/shared';
import { prisma } from '../../db';
import { authGuard, roleGuard } from '../../middleware/authGuard';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';

export async function testsRoutes(app: FastifyInstance) {
  // POST /api/tests/upload-image — upload drawing background image
  app.post('/upload-image', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: 'No file' });

    const ext = path.extname(data.filename).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext))
      return reply.status(400).send({ error: 'Image files only' });

    await fs.mkdir(path.join(STORAGE_PATH, 'questions'), { recursive: true });
    const filename = `${uuidv4()}${ext}`;
    await pipeline(data.file, fsSync.createWriteStream(path.join(STORAGE_PATH, 'questions', filename)));

    return { image_path: filename };
  });

  // GET /api/tests/question-images/:filename — serve drawing background
  app.get('/question-images/:filename', { preHandler: authGuard }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = path.join(STORAGE_PATH, 'questions', filename);
    try {
      const buf = await fs.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      return reply.header('Content-Type', mime).header('Cache-Control', 'no-store').send(buf);
    } catch {
      return reply.status(404).send({ error: 'Not Found' });
    }
  });

  // GET /api/tests/submission-drawings/:filename — serve student drawing (teacher only)
  app.get('/submission-drawings/:filename', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = path.join(STORAGE_PATH, 'drawings', filename);
    try {
      const buf = await fs.readFile(filePath);
      return reply.header('Content-Type', 'image/png').header('Cache-Control', 'no-store').send(buf);
    } catch {
      return reply.status(404).send({ error: 'Not Found' });
    }
  });

  // POST /api/tests — create test
  app.post('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { title, day_id, cohort_id, time_limit_min, show_result_immediately, questions } =
      request.body as {
        title: string;
        day_id?: string;
        cohort_id: string;
        time_limit_min?: number;
        show_result_immediately?: boolean;
        questions: Array<{
          type: QuestionType;
          question_text: string;
          image_path?: string;
          order_index: number;
          answers?: Array<{ answer_text: string; is_correct: boolean }>;
        }>;
      };

    const test = await prisma.test.create({
      data: {
        title,
        day_id: day_id || null,
        cohort_id,
        time_limit_min: time_limit_min || null,
        show_result_immediately: show_result_immediately ?? true,
        created_by_id: request.user!.id,
        questions: {
          create: questions.map((q) => ({
            type: q.type,
            question_text: q.question_text,
            image_path: q.image_path || null,
            order_index: q.order_index,
            answers: q.answers?.length
              ? { create: q.answers.map((a) => ({ answer_text: a.answer_text, is_correct: a.is_correct })) }
              : undefined,
          })),
        },
      },
      include: { questions: { include: { answers: true }, orderBy: { order_index: 'asc' } } },
    });

    return reply.status(201).send(test);
  });

  // GET /api/tests — list
  app.get('/', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;

    if (user.role === UserRole.STUDENT) {
      if (!user.cohort_id) return reply.status(400).send({ error: 'No cohort' });
      const tests = await prisma.test.findMany({
        where: { cohort_id: user.cohort_id },
        include: {
          _count: { select: { submissions: true } },
          submissions: {
            where: { student_id: user.id },
            select: { id: true, auto_score: true, manual_score: true, submitted_at: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });
      return tests;
    }

    const tests = await prisma.test.findMany({
      include: {
        _count: { select: { submissions: true } },
        cohort: { select: { id: true, name: true } },
        day: { select: { id: true, day_number: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return tests;
  });

  // GET /api/tests/:id — get test detail
  app.get('/:id', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        questions: {
          include: { answers: true },
          orderBy: { order_index: 'asc' },
        },
      },
    });

    if (!test) return reply.status(404).send({ error: 'Not Found' });

    if (user.role === UserRole.STUDENT) {
      if (test.cohort_id !== user.cohort_id)
        return reply.status(403).send({ error: 'Forbidden' });

      // Strip is_correct from answers
      return {
        ...test,
        questions: test.questions.map((q) => ({
          ...q,
          answers: q.answers.map(({ is_correct: _ic, ...a }) => a),
        })),
      };
    }

    return test;
  });

  // PUT /api/tests/:id — update test (full replace)
  app.put('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title, day_id, cohort_id, time_limit_min, show_result_immediately, questions } =
      request.body as any;

    // Delete existing questions (cascade deletes answers)
    await prisma.testQuestion.deleteMany({ where: { test_id: id } });

    const test = await prisma.test.update({
      where: { id },
      data: {
        title,
        day_id: day_id || null,
        cohort_id,
        time_limit_min: time_limit_min || null,
        show_result_immediately: show_result_immediately ?? true,
        questions: {
          create: questions.map((q: any) => ({
            type: q.type,
            question_text: q.question_text,
            image_path: q.image_path || null,
            order_index: q.order_index,
            answers: q.answers?.length
              ? { create: q.answers.map((a: any) => ({ answer_text: a.answer_text, is_correct: a.is_correct })) }
              : undefined,
          })),
        },
      },
      include: { questions: { include: { answers: true }, orderBy: { order_index: 'asc' } } },
    });

    return test;
  });

  // DELETE /api/tests/:id
  app.delete('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.test.delete({ where: { id } });
    return { success: true };
  });

  // POST /api/tests/:id/submit
  app.post('/:id/submit', {
    preHandler: roleGuard(UserRole.STUDENT),
  }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { answers } = request.body as {
      answers: Array<{
        question_id: string;
        answer_ids?: string[];
        text?: string;
        drawing_data?: string; // base64 data URL
      }>;
    };

    const test = await prisma.test.findUnique({
      where: { id },
      include: { questions: { include: { answers: true } } },
    });

    if (!test) return reply.status(404).send({ error: 'Not Found' });
    if (test.cohort_id !== user.cohort_id)
      return reply.status(403).send({ error: 'Forbidden' });

    const existing = await prisma.testSubmission.findUnique({
      where: { test_id_student_id: { test_id: id, student_id: user.id } },
    });
    if (existing) return reply.status(400).send({ error: 'Already submitted' });

    let totalAutoScore = 0;
    const answersJson: any[] = [];

    for (const q of test.questions) {
      const studentAnswer = answers.find((a) => a.question_id === q.id);

      if (q.type === QuestionType.SINGLE || q.type === QuestionType.MULTIPLE) {
        const correctIds = new Set(q.answers.filter((a) => a.is_correct).map((a) => a.id));
        const selectedIds = new Set(studentAnswer?.answer_ids ?? []);

        let isCorrect = false;
        if (q.type === QuestionType.SINGLE) {
          isCorrect = selectedIds.size === 1 && correctIds.has([...selectedIds][0]);
        } else {
          isCorrect =
            selectedIds.size === correctIds.size &&
            [...selectedIds].every((sid) => correctIds.has(sid));
        }

        if (isCorrect) totalAutoScore++;
        answersJson.push({ question_id: q.id, answer_ids: studentAnswer?.answer_ids ?? [], is_correct: isCorrect });
      } else if (q.type === QuestionType.OPEN_TEXT) {
        answersJson.push({ question_id: q.id, text: studentAnswer?.text ?? '' });
      } else if (q.type === QuestionType.DRAWING) {
        let drawing_path: string | null = null;
        if (studentAnswer?.drawing_data) {
          await fs.mkdir(path.join(STORAGE_PATH, 'drawings'), { recursive: true });
          const base64 = studentAnswer.drawing_data.replace(/^data:image\/\w+;base64,/, '');
          const buf = Buffer.from(base64, 'base64');
          const filename = `${uuidv4()}.png`;
          await fs.writeFile(path.join(STORAGE_PATH, 'drawings', filename), buf);
          drawing_path = filename;
        }
        answersJson.push({ question_id: q.id, drawing_path });
      }
    }

    const autoScorableCount = test.questions.filter(
      (q) => q.type === QuestionType.SINGLE || q.type === QuestionType.MULTIPLE,
    ).length;

    const autoScore =
      autoScorableCount > 0
        ? (totalAutoScore / test.questions.length) * 100
        : null;

    const submission = await prisma.testSubmission.create({
      data: { test_id: id, student_id: user.id, answers_json: answersJson, auto_score: autoScore },
    });

    if (test.show_result_immediately) {
      return {
        submission,
        show_result: true,
        auto_score: autoScore,
        answers_detail: answersJson,
        questions: test.questions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          type: q.type,
          correct_answer_ids:
            q.type === QuestionType.SINGLE || q.type === QuestionType.MULTIPLE
              ? q.answers.filter((a) => a.is_correct).map((a) => a.id)
              : undefined,
        })),
      };
    }

    return { submission, show_result: false };
  });

  // GET /api/tests/:id/results — teacher: all submissions
  app.get('/:id/results', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const submissions = await prisma.testSubmission.findMany({
      where: { test_id: id },
      include: { student: { select: { id: true, callsign: true, email: true } } },
      orderBy: { submitted_at: 'asc' },
    });
    return submissions;
  });

  // GET /api/tests/:id/results/my — student own result
  app.get('/:id/results/my', {
    preHandler: roleGuard(UserRole.STUDENT),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const submission = await prisma.testSubmission.findUnique({
      where: { test_id_student_id: { test_id: id, student_id: request.user!.id } },
    });
    if (!submission) return reply.status(404).send({ error: 'Not Found' });
    return submission;
  });

  // PATCH /api/tests/:id/submissions/:subId/score — teacher manual score
  app.patch('/:id/submissions/:subId/score', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { subId } = request.params as { id: string; subId: string };
    const { manual_score } = request.body as { manual_score: number };

    const updated = await prisma.testSubmission.update({
      where: { id: subId },
      data: { manual_score },
    });

    return updated;
  });
}
