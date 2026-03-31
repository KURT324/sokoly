import { useEffect, useRef, useState } from 'react';
import { Layout } from '../../components/Layout';
import { CardCanvas } from '../../components/CardCanvas';
import { cardTasksApi, CardTask } from '../../api/cardTasks';

const STATUS_LABELS = {
  PENDING: 'Ожидает выполнения',
  AWAITING_REVIEW: 'На проверке',
  RETURNED: 'Возвращена',
  COMPLETED: 'Выполнена',
};

const STATUS_COLORS = {
  PENDING: 'text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700',
  AWAITING_REVIEW: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  RETURNED: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  COMPLETED: 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
};

export function StudentCardsPage() {
  const [tasks, setTasks] = useState<CardTask[] | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [hasDrawing, setHasDrawing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const getDataUrlRef = useRef<(() => string) | null>(null);

  const loadTasks = () => {
    cardTasksApi.getMyTasks().then((r) => {
      setTasks(r.data);
      // Auto-select first active task
      if (!selectedId) {
        const active = r.data.find((t) => t.status === 'PENDING' || t.status === 'RETURNED');
        setSelectedId(active?.id ?? r.data[0]?.id ?? null);
      }
    });
  };

  useEffect(() => { loadTasks(); }, []);

  const selected = tasks?.find((t) => t.id === selectedId) ?? null;

  const handleSelectTask = (id: string) => {
    setSelectedId(id);
    setComment('');
    setHasDrawing(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (!selected || !hasDrawing || !comment.trim() || !getDataUrlRef.current) return;
    setSubmitting(true);
    setError('');
    try {
      const dataUrl = getDataUrlRef.current();
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const form = new FormData();
      form.append('annotation', blob, 'annotation.png');
      form.append('student_comment', comment.trim());
      await cardTasksApi.submitAttempt(selected.id, form);
      setComment('');
      setHasDrawing(false);
      loadTasks();
    } catch {
      setError('Ошибка при отправке. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  if (tasks === undefined) {
    return <Layout><div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Карточки</h1>

        {tasks.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-700 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 dark:text-slate-400">Заданий пока нет. Инструктор скоро отправит карточку.</p>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Task list sidebar */}
            <div className="w-56 shrink-0 space-y-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleSelectTask(task.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl border transition-colors ${
                    selectedId === task.id
                      ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <img
                      src={cardTasksApi.getImageUrl(task.image_path)}
                      alt=""
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-1">
                    {new Date(task.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </button>
              ))}
            </div>

            {/* Task detail */}
            {selected && (
              <div className="flex-1 space-y-5">
                {selected.status === 'COMPLETED' && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
                    <div className="text-4xl mb-3">✓</div>
                    <h2 className="text-xl font-semibold text-green-800 dark:text-green-400 mb-1">Задание выполнено!</h2>
                    <p className="text-green-700 dark:text-green-400 text-sm">Понадобилось попыток: {selected.attempts.length}</p>
                  </div>
                )}

                {selected.status === 'AWAITING_REVIEW' && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
                    <div className="text-3xl mb-2">⏳</div>
                    <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-1">Ожидает проверки инструктора</h2>
                    <p className="text-amber-600 dark:text-amber-400 text-sm">Попытка #{selected.attempts.length} отправлена</p>
                    {selected.attempts[selected.attempts.length - 1] && (
                      <div className="mt-4">
                        <img
                          src={cardTasksApi.getStudentAnnotationUrl(
                            selected.attempts[selected.attempts.length - 1].annotation_path,
                          )}
                          alt="Ваша аннотация"
                          className="mx-auto max-h-64 rounded border border-amber-200 dark:border-amber-800 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}

                {(selected.status === 'PENDING' || selected.status === 'RETURNED') && (
                  <div className="space-y-4">
                    {selected.status === 'RETURNED' && (() => {
                      const lastAttempt = selected.attempts[selected.attempts.length - 1];
                      return lastAttempt?.teacher_comment ? (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Комментарий инструктора:</p>
                          <p className="text-sm text-red-600 dark:text-red-400">{lastAttempt.teacher_comment}</p>
                        </div>
                      ) : null;
                    })()}

                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-1">Инструкция:</p>
                        <p className="text-sm text-gray-600 dark:text-slate-400">{selected.instructions}</p>
                      </div>

                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Обведите найденную ошибку на изображении:
                      </p>

                      <CardCanvas
                        key={selected.id + selected.attempts.length}
                        backgroundUrl={cardTasksApi.getImageUrl(selected.image_path)}
                        onHasDrawing={setHasDrawing}
                        onExport={(fn) => { getDataUrlRef.current = fn; }}
                      />

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                          Ваш комментарий <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Опишите, что вы нашли..."
                          rows={3}
                          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-slate-800"
                        />
                      </div>

                      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                      <button
                        onClick={handleSubmit}
                        disabled={!hasDrawing || !comment.trim() || submitting}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                      >
                        {submitting ? 'Отправка...' : 'Отправить'}
                      </button>

                      {(!hasDrawing || !comment.trim()) && (
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {!hasDrawing ? 'Нарисуйте обводку на изображении' : 'Введите комментарий'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
