import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, QuestionType } from '@prisma/client';
import { prisma } from '../../db';
import { authGuard, roleGuard } from '../../middleware/authGuard';
import { parseDocxBuffer } from '../../services/docxParser';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/storage';

type VariantInput = {
  name: string;
  questions: Array<{
    type: QuestionType;
    question_text: string;
    image_path?: string;
    order_index: number;
    answers?: Array<{ answer_text: string; is_correct: boolean }>;
  }>;
};

export async function testsRoutes(app: FastifyInstance) {
  // POST /api/tests/upload-image
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

  // GET /api/tests/question-images/:filename
  app.get('/question-images/:filename', { preHandler: authGuard }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = path.join(STORAGE_PATH, 'questions', path.basename(filename));
    try {
      const buf = await fs.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      return reply.header('Content-Type', mime).header('Cache-Control', 'no-store').send(buf);
    } catch {
      return reply.status(404).send({ error: 'Not Found' });
    }
  });

  // GET /api/tests/submission-drawings/:filename
  app.get('/submission-drawings/:filename', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = path.join(STORAGE_PATH, 'drawings', path.basename(filename));
    try {
      const buf = await fs.readFile(filePath);
      return reply.header('Content-Type', 'image/png').header('Cache-Control', 'no-store').send(buf);
    } catch {
      return reply.status(404).send({ error: 'Not Found' });
    }
  });

  // POST /api/tests/parse-docx
  app.post('/parse-docx', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const data = await request.file({ limits: { fileSize: 20 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    const ext = path.extname(data.filename).toLowerCase();
    if (ext !== '.docx') return reply.status(400).send({ error: 'Only .docx files are supported' });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    console.log(`[parse-docx] filename="${data.filename}" size=${buffer.length} bytes`);

    const questions = await parseDocxBuffer(buffer);
    console.log(`[parse-docx] parsed ${questions.length} question(s):`, JSON.stringify(questions, null, 2));

    if (questions.length === 0) {
      return reply.status(400).send({
        error: 'No questions found. Make sure the file matches the template format.',
      });
    }

    return { questions };
  });

  // GET /api/tests/cohort-students/:cohortId
  app.get('/cohort-students/:cohortId', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request) => {
    const { cohortId } = request.params as { cohortId: string };
    return prisma.user.findMany({
      where: { role: UserRole.STUDENT, cohort_id: cohortId, is_active: true },
      select: { id: true, callsign: true, email: true },
      orderBy: { callsign: 'asc' },
    });
  });

  // POST /api/tests — create test (library entry, no cohort, no day, no show_result)
  app.post('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { title, time_limit_min, variants } = request.body as {
      title: string;
      time_limit_min?: number;
      variants: VariantInput[];
    };

    const test = await prisma.test.create({
      data: {
        title,
        time_limit_min: time_limit_min || null,
        show_result_immediately: false,
        created_by_id: request.user!.id,
        variants: {
          create: variants.map((v) => ({
            name: v.name,
            questions: {
              create: v.questions.map((q) => ({
                type: q.type,
                question_text: q.question_text,
                image_path: q.image_path || null,
                order_index: q.order_index,
                answers: q.answers?.length
                  ? { create: q.answers.map((a) => ({ answer_text: a.answer_text, is_correct: a.is_correct })) }
                  : undefined,
              })),
            },
          })),
        },
      },
      include: {
        variants: {
          include: {
            questions: { include: { answers: true }, orderBy: { order_index: 'asc' } },
          },
        },
      },
    });

    return reply.status(201).send(test);
  });

  // POST /api/tests/:id/assign — assign variants to students or whole cohort
  app.post('/:id/assign', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { assignments, variant_id, cohort_id } = request.body as {
      assignments?: Array<{ variant_id: string; student_ids: string[] }>;
      variant_id?: string;
      cohort_id?: string;
    };

    const test = await prisma.test.findUnique({
      where: { id },
      select: { id: true, created_by_id: true },
    });
    if (!test) return reply.status(404).send({ error: 'Not Found' });
    if (request.user!.role === UserRole.TEACHER && test.created_by_id !== request.user!.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    if (variant_id && cohort_id) {
      const students = await prisma.user.findMany({
        where: { role: UserRole.STUDENT, cohort_id, is_active: true },
        select: { id: true },
      });
      await prisma.testVariantAssignment.createMany({
        data: students.map((s) => ({ variant_id, test_id: id, student_id: s.id })),
        skipDuplicates: true,
      });
      return { success: true, count: students.length };
    }

    if (assignments?.length) {
      for (const a of assignments) {
        await prisma.testVariantAssignment.createMany({
          data: a.student_ids.map((sid) => ({ variant_id: a.variant_id, test_id: id, student_id: sid })),
          skipDuplicates: true,
        });
      }
      return { success: true };
    }

    return reply.status(400).send({ error: 'Provide assignments or variant_id+cohort_id' });
  });

  // DELETE /api/tests/:id/assignments/:studentId — remove a student's assignment
  app.delete('/:id/assignments/:studentId', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id, studentId } = request.params as { id: string; studentId: string };

    const test = await prisma.test.findUnique({ where: { id }, select: { created_by_id: true } });
    if (!test) return reply.status(404).send({ error: 'Not Found' });
    if (request.user!.role === UserRole.TEACHER && test.created_by_id !== request.user!.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await prisma.testVariantAssignment.deleteMany({ where: { test_id: id, student_id: studentId } });
    return { success: true };
  });

  // PATCH /api/tests/:id/toggle-open
  app.patch('/:id/toggle-open', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const test = await prisma.test.findUnique({ where: { id }, select: { is_open: true, created_by_id: true } });
    if (!test) return reply.status(404).send({ error: 'Not Found' });
    if (request.user!.role === UserRole.TEACHER && test.created_by_id !== request.user!.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const updated = await prisma.test.update({
      where: { id },
      data: { is_open: !test.is_open },
      select: { id: true, is_open: true },
    });
    await prisma.activityLog.create({
      data: {
        entity_type: 'TEST',
        entity_id: id,
        action: !test.is_open ? 'OPENED' : 'CLOSED',
        actor_id: request.user!.id,
      },
    });
    return updated;
  });

  // GET /api/tests/:id/activity
  app.get('/:id/activity', { preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const test = await prisma.test.findUnique({ where: { id }, select: { id: true } });
    if (!test) return reply.status(404).send({ error: 'Not Found' });

    return prisma.activityLog.findMany({
      where: { entity_type: 'TEST', entity_id: id },
      include: { actor: { select: { id: true, callsign: true } } },
      orderBy: { created_at: 'desc' },
    });
  });

  // GET /api/tests — list
  app.get('/', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;

    if (user.role === UserRole.STUDENT) {
      const tests = await prisma.test.findMany({
        where: {
          is_open: true,
          variant_assignments: { some: { student_id: user.id } },
        },
        include: {
          submissions: {
            where: { student_id: user.id },
            select: { id: true, auto_score: true, manual_score: true, submitted_at: true },
          },
          variant_assignments: {
            where: { student_id: user.id },
            select: { id: true, variant_id: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });
      return tests;
    }

    const tests = await prisma.test.findMany({
      include: {
        _count: { select: { submissions: true } },
        variants: {
          select: {
            id: true,
            name: true,
            _count: { select: { assignments: true, questions: true } },
            assignments: {
              include: {
                student: { select: { id: true, callsign: true } },
              },
            },
          },
        },
        submissions: {
          select: { student_id: true, auto_score: true, manual_score: true, submitted_at: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return tests;
  });

  // GET /api/tests/:id — detail
  app.get('/:id', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    if (user.role === UserRole.STUDENT) {
      const test = await prisma.test.findUnique({
        where: { id },
        select: { id: true, title: true, time_limit_min: true, created_at: true },
      });

      if (!test) return reply.status(404).send({ error: 'Not Found' });

      const assignment = await prisma.testVariantAssignment.findUnique({
        where: { test_id_student_id: { test_id: id, student_id: user.id } },
        include: {
          variant: {
            include: {
              questions: {
                include: { answers: true },
                orderBy: { order_index: 'asc' },
              },
            },
          },
        },
      });

      if (!assignment) {
        return { ...test, assigned: false };
      }

      const variant = {
        ...assignment.variant,
        questions: assignment.variant.questions.map((q) => ({
          ...q,
          answers: q.answers.map(({ is_correct: _ic, ...a }) => a),
        })),
      };

      return { ...test, assigned: true, variant };
    }

    const test = await prisma.test.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            questions: { include: { answers: true }, orderBy: { order_index: 'asc' } },
            assignments: { include: { student: { select: { id: true, callsign: true } } } },
          },
        },
      },
    });

    if (!test) return reply.status(404).send({ error: 'Not Found' });
    return test;
  });

  // PUT /api/tests/:id — full replace of variants
  app.put('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title, time_limit_min, variants } = request.body as {
      title: string;
      time_limit_min?: number;
      variants: VariantInput[];
    };

    const existingTest = await prisma.test.findUnique({ where: { id }, select: { created_by_id: true } });
    if (!existingTest) return reply.status(404).send({ error: 'Not Found' });
    if (request.user!.role === UserRole.TEACHER && existingTest.created_by_id !== request.user!.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await prisma.testVariant.deleteMany({ where: { test_id: id } });

    const test = await prisma.test.update({
      where: { id },
      data: {
        title,
        time_limit_min: time_limit_min || null,
        variants: {
          create: variants.map((v) => ({
            name: v.name,
            questions: {
              create: v.questions.map((q) => ({
                type: q.type,
                question_text: q.question_text,
                image_path: q.image_path || null,
                order_index: q.order_index,
                answers: q.answers?.length
                  ? { create: q.answers.map((a) => ({ answer_text: a.answer_text, is_correct: a.is_correct })) }
                  : undefined,
              })),
            },
          })),
        },
      },
      include: {
        variants: {
          include: {
            questions: { include: { answers: true }, orderBy: { order_index: 'asc' } },
          },
        },
      },
    });

    return test;
  });

  // DELETE /api/tests/:id
  app.delete('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const test = await prisma.test.findUnique({ where: { id }, select: { created_by_id: true } });
    if (!test) return reply.status(404).send({ error: 'Not Found' });
    if (request.user!.role === UserRole.TEACHER && test.created_by_id !== request.user!.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    await prisma.test.delete({ where: { id } });
    return { success: true };
  });

  // POST /api/tests/:id/submit
  app.post('/:id/submit', {
    preHandler: roleGuard(UserRole.STUDENT),
  }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { answers, variant_id } = request.body as {
      answers: Array<{
        question_id: string;
        answer_ids?: string[];
        text?: string;
        drawing_data?: string;
      }>;
      variant_id: string;
    };

    const test = await prisma.test.findUnique({ where: { id }, select: { id: true } });
    if (!test) return reply.status(404).send({ error: 'Not Found' });

    const assignment = await prisma.testVariantAssignment.findUnique({
      where: { test_id_student_id: { test_id: id, student_id: user.id } },
    });
    if (!assignment || assignment.variant_id !== variant_id) {
      return reply.status(403).send({ error: 'Not assigned to this variant' });
    }

    const variant = await prisma.testVariant.findUnique({
      where: { id: variant_id },
      include: { questions: { include: { answers: true } } },
    });
    if (!variant) return reply.status(404).send({ error: 'Variant not found' });

    const existing = await prisma.testSubmission.findUnique({
      where: { test_id_student_id: { test_id: id, student_id: user.id } },
    });
    if (existing) return reply.status(400).send({ error: 'Already submitted' });

    let totalAutoScore = 0;
    const answersJson: any[] = [];

    for (const q of variant.questions) {
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
          if (base64.length > 14_000_000) {
            return reply.status(400).send({ error: 'Drawing data too large (max 10 MB)' });
          }
          const buf = Buffer.from(base64, 'base64');
          const filename = `${uuidv4()}.png`;
          await fs.writeFile(path.join(STORAGE_PATH, 'drawings', filename), buf);
          drawing_path = filename;
        }
        answersJson.push({ question_id: q.id, drawing_path });
      }
    }

    const autoScorableCount = variant.questions.filter(
      (q) => q.type === QuestionType.SINGLE || q.type === QuestionType.MULTIPLE,
    ).length;

    const autoScore =
      autoScorableCount > 0
        ? (totalAutoScore / variant.questions.length) * 100
        : null;

    const submission = await prisma.testSubmission.create({
      data: {
        test_id: id,
        variant_id,
        student_id: user.id,
        answers_json: answersJson,
        auto_score: autoScore,
      },
    });

    return { submission, show_result: false };
  });

  // GET /api/tests/:id/results
  app.get('/:id/results', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const submissions = await prisma.testSubmission.findMany({
      where: { test_id: id },
      include: {
        student: { select: { id: true, callsign: true, email: true } },
        variant: { select: { id: true, name: true } },
      },
      orderBy: { submitted_at: 'asc' },
    });
    return submissions;
  });

  // PATCH /api/tests/:id/submissions/:subId/score
  app.patch('/:id/submissions/:subId/score', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id, subId } = request.params as { id: string; subId: string };
    const { manual_score } = request.body as { manual_score: number };

    const submission = await prisma.testSubmission.findUnique({ where: { id: subId }, select: { test_id: true } });
    if (!submission) return reply.status(404).send({ error: 'Not Found' });
    if (submission.test_id !== id) return reply.status(404).send({ error: 'Not Found' });

    const updated = await prisma.testSubmission.update({
      where: { id: subId },
      data: { manual_score },
    });

    return updated;
  });
}
