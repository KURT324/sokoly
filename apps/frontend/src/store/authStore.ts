import { create } from 'zustand';
import { UserRole } from '@eduplatform/shared';

export interface AuthUser {
  id: string;
  email: string;
  callsign: string;
  role: UserRole;
  cohort_id: string | null;
  must_change_password: boolean;
}

interface AuthStore {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (v: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ user: null, isLoading: false }),
}));
