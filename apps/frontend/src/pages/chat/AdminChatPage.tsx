import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { ChatWindow } from '../../components/ChatWindow';
import { chatsApi, Chat } from '../../api/chats';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { UserRole } from '@eduplatform/shared';

export function AdminChatPage() {
  const user = useAuthStore((s) => s.user);
  const setUnread = useChatStore((s) => s.setUnread);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selected, setSelected] = useState<Chat | null>(null);

  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    chatsApi.getChats().then((r) => {
      const sa = r.data.filter((c) => c.type === 'STUDENT_ADMIN');
      sa.forEach((c) => setUnread(c.id, c.unread));
      if (isAdmin) {
        setChats(sa);
      } else {
        setSelected(sa[0] ?? null);
      }
    });
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
          {isAdmin ? 'Чаты студентов с администратором' : 'Чат с администратором'}
        </h1>

        {isAdmin ? (
          <div className="flex-1 flex gap-4 min-h-0">
            <div className="w-56 shrink-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-y-auto">
              {chats.length === 0 && (
                <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-8">Нет чатов</p>
              )}
              {chats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-slate-700 transition-colors ${selected?.id === c.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{c.name}</p>
                  {c.unread > 0 && (
                    <span className="ml-2 text-xs bg-red-50 dark:bg-red-900/200 text-white rounded-full px-1.5 py-0.5">{c.unread}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col min-h-0">
              {selected ? (
                <ChatWindow key={selected.id} chat={selected} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
                  Выберите студента
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col min-h-0">
            {selected ? (
              <ChatWindow chat={selected} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">Загрузка...</div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
