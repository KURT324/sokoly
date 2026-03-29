import client from './client';

export interface ChatAttachment {
  filename: string;
  storage_path: string;
  mime_type: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  attachments_json: ChatAttachment[];
  is_read: boolean;
  created_at: string;
  sender: { id: string; callsign: string; role: string };
}

export interface Chat {
  id: string;
  type: 'GROUP' | 'STUDENT_TEACHER' | 'STUDENT_ADMIN';
  name: string;
  cohort_id: string;
  cohort?: { id: string; name: string };
  unread: number;
}

export interface MessagesPage {
  messages: ChatMessage[];
  total: number;
  page: number;
  limit: number;
}

export const chatsApi = {
  getChats: () => client.get<Chat[]>('/chats'),

  getMessages: (chatId: string, page = 1, limit = 50) =>
    client.get<MessagesPage>(`/chats/${chatId}/messages`, { params: { page, limit } }),

  sendMessage: (chatId: string, content: string, files?: File[]) => {
    if (files && files.length > 0) {
      const form = new FormData();
      form.append('content', content);
      files.forEach((f) => form.append('files', f));
      return client.post<ChatMessage>(`/chats/${chatId}/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return client.post<ChatMessage>(`/chats/${chatId}/messages`, { content });
  },

  markRead: (chatId: string) => client.patch(`/chats/${chatId}/read`),

  getFileUrl: (storage_path: string) => `/api/chats/files/${storage_path}`,
};
