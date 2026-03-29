import client from './client';

export interface TestAnalyticsRow {
  student: { id: string; callsign: string; email: string };
  scores: Record<string, number | null | 'pending'>;
  average: number | null;
}

export interface TestAnalytics {
  tests: Array<{ id: string; title: string; created_at: string }>;
  rows: TestAnalyticsRow[];
  columnAverages: Record<string, number | null>;
}

export interface CardAnalyticsRow {
  student: { id: string; callsign: string };
  totalTasks: number;
  totalAttempts: number;
  firstAttemptPct: number | null;
  avgAttempts: number;
  lastStatus: string | null;
}

export interface StudentAnalytics {
  student: { id: string; callsign: string; email: string; cohort_id: string | null };
  submissions: Array<{
    id: string; auto_score: number | null; manual_score: number | null;
    submitted_at: string; test: { id: string; title: string };
  }>;
  cardTasks: Array<{
    id: string; status: string; created_at: string;
    attempts: Array<{ attempt_number: number }>;
    day: { day_number: number } | null;
  }>;
}

export interface OverviewData {
  metrics: { totalStudents: number; totalTeachers: number; totalActiveCohorts: number };
  cohorts: Array<{
    cohort: { id: string; name: string; started_at: string };
    studentCount: number;
    avgTestScore: number | null;
    firstAttemptPct: number | null;
  }>;
}

export const analyticsApi = {
  getCohortTests: (cohortId: string) =>
    client.get<TestAnalytics>(`/analytics/cohorts/${cohortId}/tests`),

  getCohortCards: (cohortId: string) =>
    client.get<CardAnalyticsRow[]>(`/analytics/cohorts/${cohortId}/cards`),

  getStudent: (studentId: string) =>
    client.get<StudentAnalytics>(`/analytics/students/${studentId}`),

  getOverview: () => client.get<OverviewData>('/analytics/overview'),

  exportCsv: () =>
    client.get('/analytics/export', { params: { format: 'csv' }, responseType: 'blob' }),
};
