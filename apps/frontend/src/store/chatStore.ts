import { create } from 'zustand';

interface ChatStore {
  unread: Record<string, number>; // chatId -> count
  setUnread: (chatId: string, count: number) => void;
  incrementUnread: (chatId: string) => void;
  clearUnread: (chatId: string) => void;
  totalUnread: () => number;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  unread: {},
  setUnread: (chatId, count) =>
    set((s) => ({ unread: { ...s.unread, [chatId]: count } })),
  incrementUnread: (chatId) =>
    set((s) => ({ unread: { ...s.unread, [chatId]: (s.unread[chatId] ?? 0) + 1 } })),
  clearUnread: (chatId) =>
    set((s) => { const u = { ...s.unread }; delete u[chatId]; return { unread: u }; }),
  totalUnread: () => Object.values(get().unread).reduce((a, b) => a + b, 0),
}));
