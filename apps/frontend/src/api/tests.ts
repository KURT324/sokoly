import client from './client';

export type QuestionType = 'SINGLE' | 'MULTIPLE' | 'OPEN_TEXT' | 'DRAWING';

export interface TestAnswer {
  id: string;
  answer_text: string;
  is_correct?: boolean;
}

export interface TestQuestion {
  id: string;
  type: QuestionType;
  question_text: string;
  image_path?: string | null;
  order_index: number;
  answers: TestAnswer[];
}

export interface Test {
  id: string;
  title: string;
  day_id?: string | null;
  cohort_id: string;
  time_limit_min?: number | null;
  show_result_immediately: boolean;
  created_at: string;
  questions: TestQuestion[];
  _count?: { submissions: number };
  submissions?: Array<{ id: string; auto_score?: number | null; manual_score?: number | null; submitted_at: string }>;
  cohort?: { id: string; name: string };
  day?: { id: string; day_number: number } | null;
}

export interface TestSubmission {
  id: string;
  test_id: string;
  student_id: string;
  answers_json: any;
  auto_score?: number | null;
  manual_score?: number | null;
  submitted_at: string;
  student?: { id: string; callsign: string; email: string };
}

export interface SubmitResult {
  submission: TestSubmission;
  show_result: boolean;
  auto_score?: number | null;
  answers_detail?: Array<{ question_id: string; answer_ids?: string[]; is_correct?: boolean; text?: string; drawing_path?: string | null }>;
  questions?: Array<{ id: string; question_text: string; type: QuestionType; correct_answer_ids?: string[] }>;
}

export const testsApi = {
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post<{ image_path: string }>('/tests/upload-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getQuestionImageUrl: (image_path: string) => `/api/tests/question-images/${image_path}`,
  getDrawingUrl: (filename: string) => `/api/tests/submission-drawings/${filename}`,

  getTests: () => client.get<Test[]>('/tests'),
  getTest: (id: string) => client.get<Test>(`/tests/${id}`),
  createTest: (data: any) => client.post<Test>('/tests', data),
  updateTest: (id: string, data: any) => client.put<Test>(`/tests/${id}`, data),
  deleteTest: (id: string) => client.delete(`/tests/${id}`),

  submitTest: (id: string, answers: any[]) =>
    client.post<SubmitResult>(`/tests/${id}/submit`, { answers }),

  getResults: (id: string) => client.get<TestSubmission[]>(`/tests/${id}/results`),
  getMyResult: (id: string) => client.get<TestSubmission>(`/tests/${id}/results/my`),

  updateScore: (testId: string, subId: string, manual_score: number) =>
    client.patch<TestSubmission>(`/tests/${testId}/submissions/${subId}/score`, { manual_score }),
};
