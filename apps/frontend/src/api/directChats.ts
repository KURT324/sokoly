import client from './client';

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

  sendMessage: (chatId: string, content: string) =>
    client.post<DirectMessage>(`/direct-chats/${chatId}/messages`, { content }),

  markRead: (chatId: string) => client.patch(`/direct-chats/${chatId}/read`),
};
