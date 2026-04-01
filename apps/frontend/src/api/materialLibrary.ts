import client from './client';
import { MaterialType } from '@eduplatform/shared';
import { MaterialRecord } from './days';

export interface LibraryItem {
  id: string;
  type: MaterialType;
  title: string;
  folder: string | null;
  storage_path: string | null;
  url: string | null;
  size_bytes: number | null;
  created_by_id: string;
  created_at: string;
}

export const materialLibraryApi = {
  getLibrary: () =>
    client.get<LibraryItem[]>('/material-library'),

  uploadFile: (file: File, title: string, folder: string, onProgress?: (p: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    if (folder) form.append('folder', folder);
    return client.post<LibraryItem>('/material-library', form, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
  },

  addLink: (url: string, title: string, folder: string) =>
    client.post<LibraryItem>('/material-library', { url, title, folder: folder || undefined }),

  deleteItem: (id: string) =>
    client.delete(`/material-library/${id}`),

  attachToDay: (libId: string, dayId: string) =>
    client.post<MaterialRecord>(`/material-library/${libId}/attach`, { day_id: dayId }),

  getViewUrl: (id: string) => `/api/material-library/${id}/view`,
};
