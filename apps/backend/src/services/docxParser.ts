import mammoth from 'mammoth';

export interface ParsedAnswer {
  answer_text: string;
  is_correct: boolean;
}

export interface ParsedQuestion {
  type: 'SINGLE' | 'MULTIPLE' | 'OPEN_TEXT';
  question_text: string;
  order_index: number;
  answers: ParsedAnswer[];
}

export async function parseDocxBuffer(buffer: Buffer): Promise<ParsedQuestion[]> {
  const { value: rawText } = await mammoth.extractRawText({ buffer });

  console.log('[parse-docx] raw text from mammoth:\n---\n' + rawText + '\n---');

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;

  for (const line of lines) {
    // Format 1 (explicit type): "1. [SINGLE] text" or "1) [MULTI] text"
    const qMatchTyped = line.match(/^\d+[.)]\s*\[(SINGLE|MULTI|OPEN|MATCH)\]\s*(.+)/i);
    // Format 2 (no type): "1) text" or "1. text" — type inferred from answers later
    const qMatchAuto = !qMatchTyped && line.match(/^\d+[.)]\s*(.+)/);

    if (qMatchTyped) {
      if (current) questions.push(current);
      const rawType = qMatchTyped[1].toUpperCase();
      const questionText = qMatchTyped[2].trim();

      if (rawType === 'SINGLE') {
        current = { type: 'SINGLE', question_text: questionText, order_index: 0, answers: [] };
      } else if (rawType === 'MULTI') {
        current = { type: 'MULTIPLE', question_text: questionText, order_index: 0, answers: [] };
      } else if (rawType === 'OPEN') {
        current = { type: 'OPEN_TEXT', question_text: questionText, order_index: 0, answers: [] };
      } else {
        // MATCH — stored as OPEN_TEXT; pairs are appended to question text
        current = {
          type: 'OPEN_TEXT',
          question_text: questionText + '\n\nПары для сопоставления:',
          order_index: 0,
          answers: [],
        };
      }
      continue;
    }

    if (qMatchAuto) {
      if (current) questions.push(current);
      // Type is 'SINGLE' as placeholder; will be resolved after answers are collected
      current = { type: 'SINGLE', question_text: qMatchAuto[1].trim(), order_index: 0, answers: [], _autoType: true } as any;
      continue;
    }

    if (!current) continue;

    const correctMatch = line.match(/^\+\s*(.+)/);
    const wrongMatch = line.match(/^-\s*(.+)/);
    const pairMatch = line.match(/^=\s*(.+?)\s*->\s*(.+)/);

    if (correctMatch) {
      current.answers.push({ answer_text: correctMatch[1].trim(), is_correct: true });
    } else if (wrongMatch) {
      current.answers.push({ answer_text: wrongMatch[1].trim(), is_correct: false });
    } else if (pairMatch) {
      current.question_text += `\n${pairMatch[1].trim()} → ${pairMatch[2].trim()}`;
    }
  }

  if (current) questions.push(current);

  // Resolve auto-detected types based on answer counts
  for (const q of questions as any[]) {
    if (q._autoType) {
      delete q._autoType;
      const correctCount = q.answers.filter((a: ParsedAnswer) => a.is_correct).length;
      if (q.answers.length === 0) {
        q.type = 'OPEN_TEXT';
      } else if (correctCount > 1) {
        q.type = 'MULTIPLE';
      } else {
        q.type = 'SINGLE';
      }
    }
  }

  questions.forEach((q, i) => { q.order_index = i; });

  return questions;
}
