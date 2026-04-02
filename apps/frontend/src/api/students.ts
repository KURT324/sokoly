import client from './client';

export interface StudentRow {
  id: string;
  callsign: string;
  email: string;
  last_login_at: string | null;
  testsSubmitted: number;
  cardsCompleted: number;
  cardsTotal: number;
}

export interface StudentsRoster {
  cohort: { id: string; name: string };
  totalDays: number;
  openDays: number;
  totalTests: number;
  students: StudentRow[];
}

export const studentsApi = {
  getRoster: (cohortId: string) =>
    client.get<StudentsRoster>(`/cohorts/${cohortId}/students`),
};
