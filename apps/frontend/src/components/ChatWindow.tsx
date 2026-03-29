import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAuthStore } from '../store/authStore';
import { useSocketEvent } from '../hooks/useSocket';
import { useChatStore } from '../store/chatStore';
import { chatsApi, ChatMessage, Chat } from '../api/chats';
import { ChatInput } from './ChatInput';

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function isImage(mime: string) {
  return mime.startsWith('image/');
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

interface TypingState { userId: string; userName: string }

interface Props {
  chat: Chat;
}

export function ChatWindow({ chat }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const clearUnread = useChatStore((s) => s.clearUnread);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState<TypingState[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  // Load messages and mark read
  useEffect(() => {
    if (!chat.id) return;
    setLoading(true);
    setMessages([]);
    chatsApi.getMessages(chat.id).then((r) => {
      setMessages(r.data.messages);
      setLoading(false);
      // Scroll to bottom
      setTimeout(() => {
        virtualizer.scrollToIndex(r.data.messages.length - 1, { behavior: 'auto' });
      }, 50);
    });
    chatsApi.markRead(chat.id).then(() => clearUnread(chat.id));
  }, [chat.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => virtualizer.scrollToIndex(messages.length - 1, { behavior: 'smooth' }), 50);
    }
  }, [messages.length]);

  // Incoming message event
  useSocketEvent<{ chatId: string; message: any }>('chat:message', (data) => {
    if (data.chatId !== chat.id) return;
    // Build ChatMessage shape from socket data
    const msg: ChatMessage = {
      id: data.message.id,
      chat_id: data.chatId,
      sender_id: data.message.senderId,
      content: data.message.content,
      attachments_json: data.message.attachments ?? [],
      is_read: false,
      created_at: data.message.createdAt,
      sender: { id: data.message.senderId, callsign: data.message.senderName, role: '' },
    };
    setMessages((prev) => {
      if (prev.find((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    if (msg.sender_id !== currentUser?.id) {
      chatsApi.markRead(chat.id);
      clearUnread(chat.id);
    }
  });

  // Typing indicator
  useSocketEvent<{ chatId: string; userId: string; userName: string; isTyping: boolean }>('chat:typing', (data) => {
    if (data.chatId !== chat.id) return;
    if (data.isTyping) {
      setTyping((prev) => {
        if (prev.find((t) => t.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, userName: data.userName }];
      });
      if (typingTimersRef.current[data.userId]) clearTimeout(typingTimersRef.current[data.userId]);
      typingTimersRef.current[data.userId] = setTimeout(() => {
        setTyping((prev) => prev.filter((t) => t.userId !== data.userId));
      }, 4000);
    } else {
      setTyping((prev) => prev.filter((t) => t.userId !== data.userId));
    }
  });

  const handleSend = async (content: string, files: File[]) => {
    await chatsApi.sendMessage(chat.id, content, files.length > 0 ? files : undefined);
    // Message will arrive via socket
  };

  const items = virtualizer.getVirtualItems();

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={parentRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {loading ? (
          <div className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Загрузка...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Сообщений пока нет</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {items.map((item) => {
              const msg = messages[item.index];
              const isOwn = msg.sender_id === currentUser?.id;
              return (
                <div
                  key={msg.id}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
                  className={`flex gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isOwn ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 dark:text-slate-400'}`}>
                    {initials(msg.sender.callsign)}
                  </div>
                  <div className={`max-w-xs space-y-1 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!isOwn && (
                      <span className="text-xs text-gray-400 dark:text-slate-500">{msg.sender.callsign}</span>
                    )}
                    {msg.content && (
                      <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${isOwn ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                    )}
                    {msg.attachments_json?.map((att, i) => (
                      <div key={i} className={`rounded-xl overflow-hidden border ${isOwn ? 'border-blue-300' : 'border-gray-200 dark:border-slate-700'}`}>
                        {isImage(att.mime_type) ? (
                          <img
                            src={chatsApi.getFileUrl(att.storage_path)}
                            alt={att.filename}
                            className="max-w-48 max-h-48 object-cover block"
                          />
                        ) : (
                          <a
                            href={chatsApi.getFileUrl(att.storage_path)}
                            download={att.filename}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700/30 hover:bg-gray-100 dark:hover:bg-slate-600 text-sm text-blue-600"
                          >
                            <span>📎</span>
                            <span className="truncate max-w-40">{att.filename}</span>
                            <span className="text-gray-400 dark:text-slate-500 text-xs shrink-0">↓</span>
                          </a>
                        )}
                      </div>
                    ))}
                    <span className="text-xs text-gray-400 dark:text-slate-500">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {typing.length > 0 && (
        <div className="px-4 pb-1 text-xs text-gray-400 dark:text-slate-500 italic">
          {typing.map((t) => t.userName).join(', ')} {typing.length === 1 ? 'печатает' : 'печатают'}...
        </div>
      )}

      <ChatInput chatId={chat.id} onSend={handleSend} />
    </div>
  );
}
