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

export interface TestVariant {
  id: string;
  test_id: string;
  name: string;
  questions?: TestQuestion[];
  assignments?: Array<{ student_id: string; student?: { id: string; callsign: string } }>;
  _count?: { assignments: number };
}

export interface CohortStudent {
  id: string;
  callsign: string;
  email: string;
}

export interface Test {
  id: string;
  title: string;
  day_id?: string | null;
  cohort_id: string;
  time_limit_min?: number | null;
  show_result_immediately: boolean;
  is_open: boolean;
  created_at: string;
  variants: TestVariant[];
  _count?: { submissions: number };
  submissions?: Array<{ id: string; auto_score?: number | null; manual_score?: number | null; submitted_at: string }>;
  variant_assignments?: Array<{ id: string; variant_id: string }>;
  cohort?: { id: string; name: string };
  day?: { id: string; day_number: number } | null;
}

// Response from GET /tests/:id for a student
export interface StudentTestDetail {
  id: string;
  title: string;
  cohort_id: string;
  time_limit_min?: number | null;
  show_result_immediately: boolean;
  created_at: string;
  assigned: boolean;
  variant?: TestVariant;
}

export interface TestSubmission {
  id: string;
  test_id: string;
  variant_id?: string | null;
  student_id: string;
  answers_json: any;
  auto_score?: number | null;
  manual_score?: number | null;
  submitted_at: string;
  student?: { id: string; callsign: string; email: string };
  variant?: { id: string; name: string } | null;
}

export interface SubmitResult {
  submission: TestSubmission;
  show_result: boolean;
  auto_score?: number | null;
  answers_detail?: Array<{ question_id: string; answer_ids?: string[]; is_correct?: boolean; text?: string; drawing_path?: string | null }>;
  questions?: Array<{ id: string; question_text: string; type: QuestionType; correct_answer_ids?: string[] }>;
}

export interface ParsedQuestion {
  type: QuestionType;
  question_text: string;
  order_index: number;
  answers: Array<{ answer_text: string; is_correct: boolean }>;
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

  getCohortStudents: (cohortId: string) =>
    client.get<CohortStudent[]>(`/tests/cohort-students/${cohortId}`),

  getTests: () => client.get<Test[]>('/tests'),
  getTest: (id: string) => client.get<Test>(`/tests/${id}`),
  getStudentTest: (id: string) => client.get<StudentTestDetail>(`/tests/${id}`),
  createTest: (data: any) => client.post<Test>('/tests', data),
  updateTest: (id: string, data: any) => client.put<Test>(`/tests/${id}`, data),
  deleteTest: (id: string) => client.delete(`/tests/${id}`),
  toggleOpen: (id: string) => client.patch<{ id: string; is_open: boolean }>(`/tests/${id}/toggle-open`),
  submitTest: (id: string, answers: any[], variant_id: string) =>
    client.post<SubmitResult>(`/tests/${id}/submit`, { answers, variant_id }),

  getResults: (id: string) => client.get<TestSubmission[]>(`/tests/${id}/results`),
  getMyResult: (id: string) => client.get<TestSubmission>(`/tests/${id}/results/my`),

  updateScore: (testId: string, subId: string, manual_score: number) =>
    client.patch<TestSubmission>(`/tests/${testId}/submissions/${subId}/score`, { manual_score }),

  importDocx: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post<{ questions: ParsedQuestion[] }>('/tests/parse-docx', form);
  },
};
