import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { ChatWindow } from '../../components/ChatWindow';
import { chatsApi, Chat } from '../../api/chats';
import { useChatStore } from '../../store/chatStore';

export function GroupChatPage() {
  const [chat, setChat] = useState<Chat | null>(null);
  const setUnread = useChatStore((s) => s.setUnread);

  useEffect(() => {
    chatsApi.getChats().then((r) => {
      const group = r.data.find((c) => c.type === 'GROUP');
      if (group) {
        setChat(group);
        setUnread(group.id, group.unread);
      }
    });
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">Общий чат группы</h1>
        {chat ? (
          <div className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col min-h-0">
            <ChatWindow chat={chat} />
          </div>
        ) : (
          <div className="text-gray-400 dark:text-slate-500 text-sm py-8">Загрузка...</div>
        )}
      </div>
    </Layout>
  );
}
