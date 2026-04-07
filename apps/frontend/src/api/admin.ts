import client from './client';
import { UserRole } from '@eduplatform/shared';

export interface UserRecord {
  id: string;
  email: string;
  callsign: string;
  role: UserRole;
  cohort_id: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
  cohort?: { id: string; name: string } | null;
}

export interface CohortRecord {
  id: string;
  name: string;
  started_at: string;
  is_active: boolean;
  created_at: string;
  _count: { users: number };
}

export const adminApi = {
  // Users
  getUsers: (params?: { role?: string; cohort_id?: string }) =>
    client.get<UserRecord[]>('/admin/users', { params }),

  createUser: (data: {
    email: string;
    callsign: string;
    role: UserRole;
    cohort_id?: string;
    password: string;
  }) => client.post<UserRecord>('/admin/users', data),

  updateUser: (id: string, data: Partial<{ callsign: string; email: string; cohort_id: string | null; is_active: boolean }>) =>
    client.patch<UserRecord>(`/admin/users/${id}`, data),

  deleteUser: (id: string) => client.delete(`/admin/users/${id}`),

  resetPassword: (id: string, password: string) =>
    client.patch(`/admin/users/${id}/password`, { password }),

  // Cohorts
  getCohorts: () => client.get<CohortRecord[]>('/admin/cohorts'),

  createCohort: (data: { name: string; started_at: string }) =>
    client.post<CohortRecord>('/admin/cohorts', data),

  deleteCohort: (id: string) => client.delete(`/admin/cohorts/${id}`),
};
