import client from './client';

export interface CohortDay {
  id: string;
  day_number: number;
  status: string;
}

export interface Cohort {
  id: string;
  name: string;
  started_at: string;
  days: CohortDay[];
}

export const cohortsApi = {
  getCohorts: () => client.get<Cohort[]>('/cohorts'),
};
