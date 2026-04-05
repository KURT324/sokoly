import { useEffect, useRef, useState } from 'react';
import { Layout } from '../../components/Layout';
import { ChatInput } from '../../components/ChatInput';
import { directChatsApi, DirectChat, DirectMessage, DirectChatUser } from '../../api/directChats';
import { useAuthStore } from '../../store/authStore';
import { useSocketEvent } from '../../hooks/useSocket';

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function isImage(mime: string) {
  return mime.startsWith('image/');
}

export function DirectChatsPage() {
  const user = useAuthStore((s) => s.user);
  const myId = user?.id ?? '';

  const [users, setUsers] = useState<DirectChatUser[]>([]);
  const [chats, setChats] = useState<DirectChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<DirectChat | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    directChatsApi.getChats().then((r) => setChats(r.data)).catch(() => {});
    directChatsApi.getUsers().then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedChat) return;
    directChatsApi.getMessages(selectedChat.id).then((r) => {
      setMessages(r.data);
      directChatsApi.markRead(selectedChat.id).catch(() => {});
    }).catch(() => {});
  }, [selectedChat?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useSocketEvent<{ chatId: string; message: DirectMessage }>('direct:message', (payload) => {
    if (payload.chatId === selectedChat?.id) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        directChatsApi.markRead(payload.chatId).catch(() => {});
        return [...prev, payload.message];
      });
    }
    setChats((prev) =>
      prev.map((c) =>
        c.id === payload.chatId
          ? {
              ...c,
              last_message: {
                content: payload.message.content,
                created_at: payload.message.created_at,
                sender_id: payload.message.sender_id,
              },
            }
          : c
      )
    );
  });

  const handleSelectUser = async (u: DirectChatUser) => {
    setShowNewChat(false);
    const r = await directChatsApi.openChat(u.id);
    const newChat: DirectChat = { id: r.data.id, partner: r.data.partner, last_message: null, created_at: r.data.created_at };
    setChats((prev) => {
      if (prev.some((c) => c.id === newChat.id)) return prev;
      return [newChat, ...prev];
    });
    setSelectedChat(newChat);
  };

  const handleSelectChat = (chat: DirectChat) => {
    setSelectedChat(chat);
    setShowNewChat(false);
  };

  const handleSend = async (content: string, files: File[]) => {
    if (!selectedChat) return;
    const r = await directChatsApi.sendMessage(selectedChat.id, content, files.length > 0 ? files : undefined);
    setMessages((prev) => {
      if (prev.some((m) => m.id === r.data.id)) return prev;
      return [...prev, r.data];
    });
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">
          Личные сообщения
        </h1>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* ─── Chat list panel ─────────────────────────────────────────── */}
          <div className="w-60 shrink-0 flex flex-col bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
              <button
                onClick={() => setShowNewChat((o) => !o)}
                className="w-full text-sm py-1.5 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-medium"
              >
                + Новый чат
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {showNewChat && (
                <div className="border-b border-gray-100 dark:border-slate-700">
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 px-3 py-1.5 font-medium uppercase tracking-wide">
                    Выберите инструктора
                  </p>
                  {users.length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-slate-500 px-3 py-2">Нет доступных</p>
                  )}
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-gray-800 dark:text-slate-200"
                    >
                      {u.callsign}
                    </button>
                  ))}
                </div>
              )}

              {chats.length === 0 && !showNewChat && (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">
                  Нет чатов
                </p>
              )}
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 dark:border-slate-700/50 transition-colors ${
                    selectedChat?.id === chat.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/50'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm font-medium truncate ${selectedChat?.id === chat.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-900 dark:text-slate-100'}`}>
                      {chat.partner.callsign}
                    </p>
                    {chat.last_message && (
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 shrink-0">
                        {formatTime(chat.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  {chat.last_message && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">
                      {chat.last_message.sender_id === myId ? 'Вы: ' : ''}
                      {chat.last_message.content || '📎 Файл'}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Message panel ───────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden min-h-0">
            {!selectedChat ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
                Выберите чат или создайте новый
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 shrink-0">
                  <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">
                    {selectedChat.partner.callsign}
                  </p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 min-h-0">
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === myId;
                    return (
                      <div key={msg.id} className={`flex gap-2 mb-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isMe ? 'bg-indigo-500 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300'}`}>
                          {msg.sender.callsign.slice(0, 2).toUpperCase()}
                        </div>
                        <div className={`max-w-xs space-y-1 flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {msg.content && (
                            <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                              isMe
                                ? 'bg-indigo-500 text-white rounded-tr-sm'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded-tl-sm'
                            }`}>
                              {msg.content}
                            </div>
                          )}
                          {msg.attachments_json?.map((att, i) => (
                            <div key={i} className={`rounded-xl overflow-hidden border ${isMe ? 'border-indigo-300' : 'border-gray-200 dark:border-slate-700'}`}>
                              {isImage(att.mime_type) ? (
                                <img
                                  src={directChatsApi.getFileUrl(att.storage_path)}
                                  alt={att.filename}
                                  className="max-w-48 max-h-48 object-cover block"
                                />
                              ) : (
                                <a
                                  href={directChatsApi.getFileUrl(att.storage_path)}
                                  download={att.filename}
                                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700/30 hover:bg-gray-100 dark:hover:bg-slate-600 text-sm text-blue-600 dark:text-blue-400"
                                >
                                  <span>📎</span>
                                  <span className="truncate max-w-40">{att.filename}</span>
                                  <span className="text-gray-400 dark:text-slate-500 text-xs shrink-0">↓</span>
                                </a>
                              )}
                            </div>
                          ))}
                          <span className="text-xs text-gray-400 dark:text-slate-500">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <ChatInput chatId={selectedChat.id} onSend={handleSend} />
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
