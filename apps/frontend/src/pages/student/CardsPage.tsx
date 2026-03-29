import { useEffect, useRef, useState } from 'react';
import { Layout } from '../../components/Layout';
import { CardCanvas } from '../../components/CardCanvas';
import { cardTasksApi, CardTask } from '../../api/cardTasks';

export function StudentCardsPage() {
  const [task, setTask] = useState<CardTask | null | undefined>(undefined); // undefined = loading
  const [comment, setComment] = useState('');
  const [hasDrawing, setHasDrawing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const getDataUrlRef = useRef<(() => string) | null>(null);

  const loadTask = () => {
    cardTasksApi.getMyTask().then((r) => setTask(r.data));
  };

  useEffect(() => { loadTask(); }, []);

  const handleSubmit = async () => {
    if (!task || !hasDrawing || !comment.trim() || !getDataUrlRef.current) return;
    setSubmitting(true);
    setError('');
    try {
      const dataUrl = getDataUrlRef.current();
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const form = new FormData();
      form.append('annotation', blob, 'annotation.png');
      form.append('student_comment', comment.trim());
      await cardTasksApi.submitAttempt(task.id, form);
      setComment('');
      setHasDrawing(false);
      loadTask();
    } catch {
      setError('Ошибка при отправке. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  if (task === undefined) {
    return <Layout><div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Карточки</h1>

        {task === null && (
          <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-700 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 dark:text-slate-400">Заданий пока нет. Преподаватель скоро отправит карточку.</p>
          </div>
        )}

        {task?.status === 'COMPLETED' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-10 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-semibold text-green-800 mb-2">Задание выполнено!</h2>
            <p className="text-green-700 dark:text-green-400">Понадобилось попыток: {task.attempts.length}</p>
          </div>
        )}

        {task && task.status === 'AWAITING_REVIEW' && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
            <div className="text-3xl mb-2">⏳</div>
            <h2 className="text-lg font-semibold text-amber-800 mb-1">Ожидает проверки преподавателя</h2>
            <p className="text-amber-600 dark:text-amber-400 text-sm">Попытка #{task.attempts.length} отправлена</p>
            {task.attempts[task.attempts.length - 1] && (
              <div className="mt-4">
                <img
                  src={cardTasksApi.getStudentAnnotationUrl(task.attempts[task.attempts.length - 1].annotation_path)}
                  alt="Ваша аннотация"
                  className="mx-auto max-h-64 rounded border border-amber-200 object-contain"
                />
              </div>
            )}
          </div>
        )}

        {task && (task.status === 'PENDING' || task.status === 'RETURNED') && (
          <div className="space-y-5">
            {task.status === 'RETURNED' && (() => {
              const lastAttempt = task.attempts[task.attempts.length - 1];
              return lastAttempt?.teacher_comment ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  <p className="text-sm font-semibold text-red-700 mb-1">Ошибка не найдена:</p>
                  <p className="text-sm text-red-600 dark:text-red-400">{lastAttempt.teacher_comment}</p>
                </div>
              ) : null;
            })()}

            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-1">Инструкция:</p>
                <p className="text-sm text-gray-600 dark:text-slate-400">{task.instructions}</p>
              </div>

              <p className="text-sm text-gray-500 dark:text-slate-400">
                Обведите найденную ошибку на изображении:
              </p>

              <CardCanvas
                key={task.id + task.attempts.length}
                backgroundUrl={cardTasksApi.getImageUrl(task.image_path)}
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
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

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
    </Layout>
  );
}
