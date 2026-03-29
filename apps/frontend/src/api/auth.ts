import client from './client';
import { User } from '@eduplatform/shared';

export const authApi = {
  login: (email: string, password: string) =>
    client.post<User & { must_change_password: boolean }>('/auth/login', { email, password }),

  logout: () => client.post('/auth/logout'),

  me: () => client.get<User & { must_change_password: boolean }>('/auth/me'),

  changePassword: (new_password: string, old_password?: string) =>
    client.post('/auth/change-password', { new_password, old_password }),
};
