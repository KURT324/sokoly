import client from './client';

export interface DirectChatAttachment {
  filename: string;
  storage_path: string;
  mime_type: string;
  size: number;
}

export interface DirectChatUser {
  id: string;
  callsign: string;
  role?: string;
}

export interface DirectMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender: { id: string; callsign: string };
  content: string;
  attachments_json: DirectChatAttachment[];
  is_read: boolean;
  created_at: string;
}

export interface DirectChat {
  id: string;
  partner: DirectChatUser;
  last_message: { content: string; created_at: string; sender_id: string } | null;
  created_at: string;
}

export const directChatsApi = {
  getUsers: () => client.get<DirectChatUser[]>('/direct-chats/users'),

  getChats: () => client.get<DirectChat[]>('/direct-chats'),

  openChat: (userId: string) =>
    client.post<{ id: string; partner: DirectChatUser; created_at: string }>('/direct-chats', { userId }),

  getMessages: (chatId: string) =>
    client.get<DirectMessage[]>(`/direct-chats/${chatId}/messages`),

  sendMessage: (chatId: string, content: string, files?: File[]) => {
    if (files && files.length > 0) {
      const form = new FormData();
      form.append('content', content);
      files.forEach((f) => form.append('files', f));
      return client.post<DirectMessage>(`/direct-chats/${chatId}/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return client.post<DirectMessage>(`/direct-chats/${chatId}/messages`, { content });
  },

  markRead: (chatId: string) => client.patch(`/direct-chats/${chatId}/read`),

  getFileUrl: (storage_path: string) => `/api/direct-chats/files/${storage_path}`,
};
