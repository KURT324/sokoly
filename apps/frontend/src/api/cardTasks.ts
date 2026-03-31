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

export interface CardFolder {
  id: string;
  name: string;
  created_at: string;
  _count?: { cards: number };
}

export interface CardLibrary {
  id: string;
  title: string;
  instructions: string;
  image_path: string;
  folder_id?: string | null;
  folder?: { id: string; name: string } | null;
  created_at: string;
  created_by?: { id: string; callsign: string };
}

export interface CardTask {
  id: string;
  student_id: string;
  library_id?: string | null;
  image_path: string;
  instructions: string;
  status: CardTaskStatus;
  created_at: string;
  student?: { id: string; callsign: string; email?: string };
  library?: { id: string; title: string } | null;
  attempts: CardAttempt[];
}

export interface StudentInfo {
  id: string;
  callsign: string;
  email: string;
  cohort_id?: string | null;
}

export const cardTasksApi = {
  // Library
  getLibrary: () => client.get<CardLibrary[]>('/card-tasks/library'),
  uploadToLibrary: (data: FormData) =>
    client.post<CardLibrary>('/card-tasks/library', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteFromLibrary: (libId: string) => client.delete(`/card-tasks/library/${libId}`),

  // Folders
  getFolders: () => client.get<CardFolder[]>('/card-folders'),
  createFolder: (name: string) => client.post<CardFolder>('/card-folders', { name }),
  renameFolder: (id: string, name: string) => client.patch<CardFolder>(`/card-folders/${id}`, { name }),
  deleteFolder: (id: string, force = false) =>
    client.delete(`/card-folders/${id}${force ? '?force=true' : ''}`),
  moveCard: (cardId: string, folder_id: string | null) =>
    client.patch(`/card-folders/move-card/${cardId}`, { folder_id }),

  // Students list for assign form
  getStudents: () => client.get<StudentInfo[]>('/card-tasks/students'),

  // Image / annotation URLs
  getImageUrl: (filename: string) => `/api/card-tasks/images/${filename}`,
  getAnnotationUrl: (filename: string) => `/api/card-tasks/annotations/${filename}`,
  getStudentAnnotationUrl: (filename: string) => `/api/card-tasks/student-annotations/${filename}`,

  // Assignments
  assignTask: (library_id: string, student_id: string, instructions?: string) =>
    client.post<CardTask>('/card-tasks', { library_id, student_id, instructions }),

  getMyTasks: () => client.get<CardTask[]>('/card-tasks/my'),
  getAllAssignments: (status?: string) =>
    client.get<CardTask[]>('/card-tasks', { params: status ? { status } : undefined }),
  getTask: (id: string) => client.get<CardTask>(`/card-tasks/${id}`),

  submitAttempt: (id: string, data: FormData) =>
    client.post<CardAttempt>(`/card-tasks/${id}/attempt`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  reviewAttempt: (taskId: string, attId: string, is_correct: boolean, teacher_comment?: string) =>
    client.patch(`/card-tasks/${taskId}/attempts/${attId}/review`, { is_correct, teacher_comment }),
};
