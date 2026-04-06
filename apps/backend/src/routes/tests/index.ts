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
  student_ids: string[];
};

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

  // POST /api/tests/parse-docx — parse Word file into questions array (does not save)
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

    const questions = await parseDocxBuffer(buffer);

    if (questions.length === 0) {
      return reply.status(400).send({
        error: 'No questions found. Make sure the file matches the template format.',
      });
    }

    return { questions };
  });

  // GET /api/tests/cohort-students/:cohortId — list students in cohort (for variant assignment)
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

  // POST /api/tests — create test with variants
  app.post('/', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { title, day_id, cohort_id, time_limit_min, show_result_immediately, variants } =
      request.body as {
        title: string;
        day_id?: string;
        cohort_id: string;
        time_limit_min?: number;
        show_result_immediately?: boolean;
        variants: VariantInput[];
      };

    const test = await prisma.test.create({
      data: {
        title,
        day_id: day_id || null,
        cohort_id,
        time_limit_min: time_limit_min || null,
        show_result_immediately: show_result_immediately ?? true,
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

    // Create variant assignments (after variants are created with their IDs)
    for (let i = 0; i < variants.length; i++) {
      const variant = test.variants[i];
      if (variants[i].student_ids?.length) {
        await prisma.testVariantAssignment.createMany({
          data: variants[i].student_ids.map((student_id) => ({
            variant_id: variant.id,
            test_id: test.id,
            student_id,
          })),
          skipDuplicates: true,
        });
      }
    }

    return reply.status(201).send(test);
  });

  // PATCH /api/tests/:id/toggle-open — teacher: toggle is_open
  app.patch('/:id/toggle-open', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const test = await prisma.test.findUnique({ where: { id }, select: { is_open: true } });
    if (!test) return reply.status(404).send({ error: 'Not Found' });
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

  // GET /api/tests/:id/activity — toggle history
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
      if (!user.cohort_id) return reply.status(400).send({ error: 'No cohort' });
      const tests = await prisma.test.findMany({
        where: { cohort_id: user.cohort_id, is_open: true },
        include: {
          _count: { select: { submissions: true } },
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
        cohort: { select: { id: true, name: true } },
        day: { select: { id: true, day_number: true } },
        variants: { select: { id: true, name: true, _count: { select: { assignments: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });
    return tests;
  });

  // GET /api/tests/:id — get test detail
  app.get('/:id', { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    if (user.role === UserRole.STUDENT) {
      const test = await prisma.test.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          cohort_id: true,
          time_limit_min: true,
          show_result_immediately: true,
          created_at: true,
        },
      });

      if (!test) return reply.status(404).send({ error: 'Not Found' });
      if (test.cohort_id !== user.cohort_id) return reply.status(403).send({ error: 'Forbidden' });

      // Find which variant this student is assigned to
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

      // Strip is_correct from answers
      const variant = {
        ...assignment.variant,
        questions: assignment.variant.questions.map((q) => ({
          ...q,
          answers: q.answers.map(({ is_correct: _ic, ...a }) => a),
        })),
      };

      return { ...test, assigned: true, variant };
    }

    // Teacher / Admin: full data
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

  // PUT /api/tests/:id — update test (full replace of variants + assignments)
  app.put('/:id', {
    preHandler: roleGuard(UserRole.TEACHER, UserRole.ADMIN),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title, day_id, cohort_id, time_limit_min, show_result_immediately, variants } =
      request.body as {
        title: string;
        day_id?: string;
        cohort_id: string;
        time_limit_min?: number;
        show_result_immediately?: boolean;
        variants: VariantInput[];
      };

    // Delete all existing variants (cascades to questions, answers, assignments)
    await prisma.testVariant.deleteMany({ where: { test_id: id } });

    const test = await prisma.test.update({
      where: { id },
      data: {
        title,
        day_id: day_id || null,
        cohort_id,
        time_limit_min: time_limit_min || null,
        show_result_immediately: show_result_immediately ?? true,
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

    // Recreate assignments
    for (let i = 0; i < variants.length; i++) {
      const variant = test.variants[i];
      if (variants[i].student_ids?.length) {
        await prisma.testVariantAssignment.createMany({
          data: variants[i].student_ids.map((student_id) => ({
            variant_id: variant.id,
            test_id: id,
            student_id,
          })),
          skipDuplicates: true,
        });
      }
    }

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
    const { answers, variant_id } = request.body as {
      answers: Array<{
        question_id: string;
        answer_ids?: string[];
        text?: string;
        drawing_data?: string;
      }>;
      variant_id: string;
    };

    const test = await prisma.test.findUnique({
      where: { id },
      select: { id: true, cohort_id: true, show_result_immediately: true },
    });

    if (!test) return reply.status(404).send({ error: 'Not Found' });
    if (test.cohort_id !== user.cohort_id) return reply.status(403).send({ error: 'Forbidden' });

    // Verify student is assigned to this variant
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

    if (test.show_result_immediately) {
      return {
        submission,
        show_result: true,
        auto_score: autoScore,
        answers_detail: answersJson,
        questions: variant.questions.map((q) => ({
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
      include: {
        student: { select: { id: true, callsign: true, email: true } },
        variant: { select: { id: true, name: true } },
      },
      orderBy: { submitted_at: 'asc' },
    });
    return submissions;
  });

  // GET /api/tests/:id/results/my — student own result
  app.get('/:id/results/my', {
    preHandler: roleGuard(UserRole.STUDENT),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const test = await prisma.test.findUnique({ where: { id }, select: { cohort_id: true } });
    if (!test) return reply.status(404).send({ error: 'Not Found' });
    if (test.cohort_id !== request.user!.cohort_id) return reply.status(403).send({ error: 'Forbidden' });
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
