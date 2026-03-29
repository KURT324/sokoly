import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../hooks/useSocket';

interface Props {
  chatId: string;
  onSend: (content: string, files: File[]) => Promise<void>;
  disabled?: boolean;
}

export function ChatInput({ chatId, onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const emitTyping = (typing: boolean) => {
    const s = getSocket();
    if (typing && !isTypingRef.current) {
      isTypingRef.current = true;
      s.emit('chat:typing:start', { chatId });
    } else if (!typing && isTypingRef.current) {
      isTypingRef.current = false;
      s.emit('chat:typing:stop', { chatId });
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && files.length === 0) || sending) return;
    emitTyping(false);
    setSending(true);
    try {
      await onSend(text.trim(), files);
      setText('');
      setFiles([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } finally {
      setSending(false);
    }
  };

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    emitTyping(false);
  }, [chatId]);

  return (
    <div className="border-t border-gray-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded px-2 py-1 text-xs">
              <span className="truncate max-w-32">{f.name}</span>
              <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 dark:text-slate-500 hover:text-red-500">×</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="cursor-pointer text-gray-400 dark:text-slate-500 hover:text-gray-600 p-1 shrink-0">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
          />
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </label>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение... (Enter — отправить, Shift+Enter — перенос)"
          disabled={disabled || sending}
          rows={1}
          className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden disabled:bg-gray-50 dark:disabled:bg-slate-800"
          style={{ minHeight: '38px' }}
        />
        <button
          onClick={handleSend}
          disabled={(!text.trim() && files.length === 0) || sending || disabled}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 shrink-0"
        >
          {sending ? '...' : '→'}
        </button>
      </div>
    </div>
  );
}
