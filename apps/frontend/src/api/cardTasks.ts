import client from './client';

export type CardTaskStatus = 'PENDING' | 'AWAITING_REVIEW' | 'RETURNED' | 'COMPLETED';

export interface CardAttempt {
  id: string;
  task_id: string;
  attempt_number: number;
  annotation_path: string;
  student_comment: string;
  teacher_comment?: string | null;
  is_correct?: boolean | null;
  submitted_at: string;
  reviewed_at?: string | null;
}

export interface CardTask {
  id: string;
  student_id: string;
  day_id: string;
  image_path: string;
  instructions: string;
  status: CardTaskStatus;
  created_at: string;
  student?: { id: string; callsign: string; email?: string };
  day?: { id: string; day_number: number };
  attempts: CardAttempt[];
}

export interface StudentInfo {
  id: string;
  callsign: string;
  email: string;
  cohort_id?: string | null;
}

export const cardTasksApi = {
  getStudents: () => client.get<StudentInfo[]>('/card-tasks/students'),

  getImageUrl: (filename: string) => `/api/card-tasks/images/${filename}`,
  getAnnotationUrl: (filename: string) => `/api/card-tasks/annotations/${filename}`,
  getStudentAnnotationUrl: (filename: string) => `/api/card-tasks/student-annotations/${filename}`,

  createTask: (data: FormData) =>
    client.post<CardTask>('/card-tasks', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getMyTask: () => client.get<CardTask | null>('/card-tasks/my'),

  getPendingTasks: () => client.get<CardTask[]>('/card-tasks'),

  getTask: (id: string) => client.get<CardTask>(`/card-tasks/${id}`),

  submitAttempt: (id: string, data: FormData) =>
    client.post<CardAttempt>(`/card-tasks/${id}/attempt`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  reviewAttempt: (taskId: string, attId: string, is_correct: boolean, teacher_comment?: string) =>
    client.patch(`/card-tasks/${taskId}/attempts/${attId}/review`, { is_correct, teacher_comment }),
};
