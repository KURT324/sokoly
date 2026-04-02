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

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;

  for (const line of lines) {
    // Question line: "1. [SINGLE] text" or "1) [MULTI] text" (case-insensitive)
    const qMatch = line.match(/^\d+[.)]\s*\[(SINGLE|MULTI|OPEN|MATCH)\]\s*(.+)/i);

    if (qMatch) {
      if (current) questions.push(current);
      const rawType = qMatch[1].toUpperCase();
      const questionText = qMatch[2].trim();

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

    if (!current) continue;

    const correctMatch = line.match(/^\+\s*(.+)/);
    const wrongMatch = line.match(/^-\s*(.+)/);
    const pairMatch = line.match(/^=\s*(.+?)\s*->\s*(.+)/);

    if (correctMatch && (current.type === 'SINGLE' || current.type === 'MULTIPLE')) {
      current.answers.push({ answer_text: correctMatch[1].trim(), is_correct: true });
    } else if (wrongMatch && (current.type === 'SINGLE' || current.type === 'MULTIPLE')) {
      current.answers.push({ answer_text: wrongMatch[1].trim(), is_correct: false });
    } else if (pairMatch) {
      // Append pair to question text
      current.question_text += `\n${pairMatch[1].trim()} → ${pairMatch[2].trim()}`;
    }
  }

  if (current) questions.push(current);

  questions.forEach((q, i) => { q.order_index = i; });

  return questions;
}
