import client from './client';
import { DayStatus, MaterialType } from '@eduplatform/shared';

export interface DayRecord {
  id: string;
  day_number: number;
  cohort_id: string;
  status: DayStatus;
  opened_at: string | null;
  opened_by_id: string | null;
  cohort?: { id: string; name: string };
  materials?: MaterialRecord[];
}

export interface MaterialRecord {
  id: string;
  day_id: string;
  type: MaterialType;
  title: string;
  storage_path: string | null;
  url: string | null;
  size_bytes: number | null;
  created_at: string;
}

export const daysApi = {
  getDays: (cohort_id?: string) =>
    client.get<DayRecord[]>('/days', { params: cohort_id ? { cohort_id } : undefined }),

  getDay: (id: string) =>
    client.get<DayRecord>(`/days/${id}`),

  openDay: (id: string) =>
    client.patch(`/days/${id}/open`),

  uploadMaterial: (dayId: string, file: File, title: string, onProgress?: (p: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    return client.post<MaterialRecord>(`/days/${dayId}/materials`, form, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
  },

  addLink: (dayId: string, url: string, title: string) =>
    client.post<MaterialRecord>(`/days/${dayId}/materials`, { url, title }),

  toggleDay: (id: string) =>
    client.patch<DayRecord>(`/days/${id}/toggle`),

  deleteMaterial: (dayId: string, matId: string) =>
    client.delete(`/days/${dayId}/materials/${matId}`),

  getMaterialViewUrl: (dayId: string, matId: string) =>
    `/api/days/${dayId}/materials/${matId}/view`,
};
