// Enums
export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export enum DayStatus {
  LOCKED = 'LOCKED',
  OPEN = 'OPEN',
  ARCHIVED = 'ARCHIVED',
}

export enum MaterialType {
  PDF = 'PDF',
  DOC = 'DOC',
  IMAGE = 'IMAGE',
  LINK = 'LINK',
  VIDEO = 'VIDEO',
}

export enum QuestionType {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
  OPEN_TEXT = 'OPEN_TEXT',
  DRAWING = 'DRAWING',
}

export enum CardTaskStatus {
  PENDING = 'PENDING',
  AWAITING_REVIEW = 'AWAITING_REVIEW',
  RETURNED = 'RETURNED',
  COMPLETED = 'COMPLETED',
}

export enum ChatType {
  GROUP = 'GROUP',
  STUDENT_TEACHER = 'STUDENT_TEACHER',
  STUDENT_ADMIN = 'STUDENT_ADMIN',
}

// Interfaces
export interface User {
  id: string;
  email: string;
  callsign: string;
  role: UserRole;
  watermark_id?: string | null;
  cohort_id?: string | null;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface Cohort {
  id: string;
  name: string;
  started_at: string;
  is_active: boolean;
  created_at: string;
}

export interface Day {
  id: string;
  day_number: number;
  cohort_id: string;
  status: DayStatus;
  opened_at?: string | null;
  opened_by_id?: string | null;
}

export interface Material {
  id: string;
  day_id: string;
  type: MaterialType;
  title: string;
  storage_path?: string | null;
  url?: string | null;
  size_bytes?: number | null;
  created_at: string;
}

export interface Test {
  id: string;
  title: string;
  day_id?: string | null;
  cohort_id: string;
  time_limit_min?: number | null;
  show_result_immediately: boolean;
  created_by_id: string;
  created_at: string;
}

export interface TestQuestion {
  id: string;
  test_id: string;
  type: QuestionType;
  question_text: string;
  image_path?: string | null;
  order_index: number;
}

export interface TestAnswer {
  id: string;
  question_id: string;
  answer_text: string;
  is_correct: boolean;
}

export interface TestSubmission {
  id: string;
  test_id: string;
  student_id: string;
  answers_json: Record<string, unknown>;
  auto_score?: number | null;
  manual_score?: number | null;
  submitted_at: string;
}

export interface CardTask {
  id: string;
  student_id: string;
  day_id: string;
  image_path: string;
  instructions: string;
  status: CardTaskStatus;
  created_by_id: string;
  created_at: string;
}

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

export interface Chat {
  id: string;
  type: ChatType;
  cohort_id: string;
  name: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  attachments_json: string[];
  is_read: boolean;
  created_at: string;
}

// API response types
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
