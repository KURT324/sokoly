import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { cardTasksApi, CardTask, StudentInfo } from '../../api/cardTasks';
import { cohortsApi, Cohort } from '../../api/cohorts';

type Tab = 'review' | 'assign';

export function TeacherCardsPage() {
  const [tab, setTab] = useState<Tab>('review');
  const [tasks, setTasks] = useState<CardTask[]>([]);
  const [selected, setSelected] = useState<CardTask | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Assign form state
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignDayId, setAssignDayId] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assignImage, setAssignImage] = useState<File | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState('');
  const [assignError, setAssignError] = useState('');

  // Review state
  const [teacherComment, setTeacherComment] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [showCommentFor, setShowCommentFor] = useState<'incorrect' | null>(null);
  const [expandedAttempts, setExpandedAttempts] = useState(false);

  const loadTasks = () => {
    setLoadingTasks(true);
    cardTasksApi.getPendingTasks()
      .then((r) => setTasks(r.data))
      .finally(() => setLoadingTasks(false));
  };

  useEffect(() => {
    loadTasks();
    Promise.all([cardTasksApi.getStudents(), cohortsApi.getCohorts()]).then(([sR, cR]) => {
      setStudents(sR.data);
      setCohorts(cR.data);
    });
  }, []);

  const handleSelectTask = async (task: CardTask) => {
    const r = await cardTasksApi.getTask(task.id);
    setSelected(r.data);
    setTeacherComment('');
    setShowCommentFor(null);
    setExpandedAttempts(false);
  };

  const handleReview = async (is_correct: boolean) => {
    if (!selected) return;
    const latestAttempt = selected.attempts[selected.attempts.length - 1];
    if (!latestAttempt) return;

    if (!is_correct && !teacherComment.trim()) {
      setShowCommentFor('incorrect');
      return;
    }

    setReviewing(true);
    try {
      await cardTasksApi.reviewAttempt(
        selected.id,
        latestAttempt.id,
        is_correct,
        is_correct ? undefined : teacherComment,
      );
      setSelected(null);
      loadTasks();
    } finally {
      setReviewing(false);
    }
  };

  const handleAssign = async () => {
    setAssignError('');
    setAssignSuccess('');
    if (!assignStudentId) return setAssignError('Выберите курсанта');
    if (!assignDayId) return setAssignError('Выберите день');
    if (!assignImage) return setAssignError('Загрузите изображение');
    if (!assignInstructions.trim()) return setAssignError('Введите инструкцию');

    setAssignSubmitting(true);
    try {
      const form = new FormData();
      form.append('student_id', assignStudentId);
      form.append('day_id', assignDayId);
      form.append('instructions', assignInstructions);
      form.append('image', assignImage);
      await cardTasksApi.createTask(form);
      setAssignSuccess('Карточка отправлена курсанту!');
      setAssignStudentId('');
      setAssignDayId('');
      setAssignInstructions('');
      setAssignImage(null);
    } catch {
      setAssignError('Ошибка при отправке');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const selectedStudent = students.find((s) => s.id === assignStudentId);
  const cohortDays = selectedStudent?.cohort_id
    ? cohorts.find((c) => c.id === selectedStudent.cohort_id)?.days ?? []
    : cohorts.flatMap((c) => c.days);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Карточки</h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          {([['review', 'На проверке'], ['assign', 'Назначить карточку']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}
            >
              {label}
              {t === 'review' && tasks.length > 0 && (
                <span className="ml-2 bg-red-50 dark:bg-red-900/200 text-white text-xs rounded-full px-1.5 py-0.5">
                  {tasks.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Review tab */}
        {tab === 'review' && (
          <div className="flex gap-6">
            {/* Task list */}
            <div className="w-72 shrink-0 space-y-2">
              {loadingTasks ? (
                <p className="text-gray-400 dark:text-slate-500 text-sm">Загрузка...</p>
              ) : tasks.length === 0 ? (
                <div className="text-center text-gray-400 dark:text-slate-500 py-8 text-sm">
                  Нет карточек на проверке
                </div>
              ) : (
                tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleSelectTask(task)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      selected?.id === task.id
                        ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-900 dark:text-slate-100">{task.student?.callsign}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      Попытка #{task.attempts[0]?.attempt_number ?? '?'} ·{' '}
                      {new Date(task.attempts[0]?.submitted_at ?? task.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Review panel */}
            {selected ? (
              <div className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-slate-100">{selected.student?.callsign}</h2>
                  <span className="text-sm text-gray-400 dark:text-slate-500">Попыток: {selected.attempts.length}</span>
                </div>

                <p className="text-sm text-gray-600 dark:text-slate-400"><span className="font-medium">Инструкция:</span> {selected.instructions}</p>

                {/* Latest attempt */}
                {(() => {
                  const latest = selected.attempts[selected.attempts.length - 1];
                  if (!latest) return null;
                  return (
                    <div className="space-y-3">
                      <div className="flex gap-4 flex-wrap">
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Оригинал:</p>
                          <img
                            src={cardTasksApi.getImageUrl(selected.image_path)}
                            alt="original"
                            className="h-48 rounded border border-gray-200 dark:border-slate-700 object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Аннотация курсанта (попытка #{latest.attempt_number}):</p>
                          <img
                            src={cardTasksApi.getAnnotationUrl(latest.annotation_path)}
                            alt="annotation"
                            className="h-48 rounded border border-gray-200 dark:border-slate-700 object-contain"
                          />
                        </div>
                      </div>
                      <p className="text-sm bg-gray-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                        <span className="font-medium text-gray-700 dark:text-slate-200">Комментарий курсанта:</span>{' '}
                        <span className="text-gray-600 dark:text-slate-400">{latest.student_comment}</span>
                      </p>
                    </div>
                  );
                })()}

                {/* Previous attempts */}
                {selected.attempts.length > 1 && (
                  <div>
                    <button
                      onClick={() => setExpandedAttempts((v) => !v)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800"
                    >
                      {expandedAttempts ? '▾ Скрыть' : '▸ История попыток'} ({selected.attempts.length - 1} предыдущих)
                    </button>
                    {expandedAttempts && (
                      <div className="mt-3 space-y-3 border-t border-gray-100 dark:border-slate-700 pt-3">
                        {selected.attempts.slice(0, -1).map((att) => (
                          <div key={att.id} className="flex gap-3 items-start">
                            <img
                              src={cardTasksApi.getAnnotationUrl(att.annotation_path)}
                              alt={`attempt ${att.attempt_number}`}
                              className="h-24 rounded border border-gray-200 dark:border-slate-700 object-contain"
                            />
                            <div className="text-sm space-y-1">
                              <p className="text-gray-500 dark:text-slate-400">Попытка #{att.attempt_number}</p>
                              <p className="text-gray-700 dark:text-slate-200">{att.student_comment}</p>
                              {att.teacher_comment && (
                                <p className="text-red-600 dark:text-red-400 text-xs">Комментарий: {att.teacher_comment}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Review buttons */}
                <div className="border-t border-gray-100 dark:border-slate-700 pt-4 space-y-3">
                  {showCommentFor === 'incorrect' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                        Комментарий для курсанта <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={teacherComment}
                        onChange={(e) => setTeacherComment(e.target.value)}
                        placeholder="Объясните, что не так..."
                        rows={2}
                        className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReview(true)}
                      disabled={reviewing}
                      className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      ✓ Верно
                    </button>
                    <button
                      onClick={() => {
                        if (showCommentFor !== 'incorrect') {
                          setShowCommentFor('incorrect');
                        } else {
                          handleReview(false);
                        }
                      }}
                      disabled={reviewing}
                      className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      ✗ Неверно
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
                Выберите карточку для проверки
              </div>
            )}
          </div>
        )}

        {/* Assign tab */}
        {tab === 'assign' && (
          <div className="max-w-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Курсант *</label>
              <select
                value={assignStudentId}
                onChange={(e) => { setAssignStudentId(e.target.value); setAssignDayId(''); }}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите курсанта</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.callsign}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Учебный день *</label>
              <select
                value={assignDayId}
                onChange={(e) => setAssignDayId(e.target.value)}
                disabled={!assignStudentId}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              >
                <option value="">Выберите день</option>
                {cohortDays.map((d) => (
                  <option key={d.id} value={d.id}>День {d.day_number}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Фото карточки *</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAssignImage(e.target.files?.[0] ?? null)}
                className="block text-sm text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:bg-blue-900/20 file:text-blue-700 hover:file:bg-blue-100"
              />
              {assignImage && (
                <img
                  src={URL.createObjectURL(assignImage)}
                  alt="preview"
                  className="mt-2 h-32 rounded border border-gray-200 dark:border-slate-700 object-contain"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Инструкция *</label>
              <textarea
                value={assignInstructions}
                onChange={(e) => setAssignInstructions(e.target.value)}
                placeholder="Что должен сделать курсант..."
                rows={3}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {assignError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2">{assignError}</p>
            )}
            {assignSuccess && (
              <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-2">{assignSuccess}</p>
            )}

            <button
              onClick={handleAssign}
              disabled={assignSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {assignSubmitting ? 'Отправка...' : 'Отправить курсанту'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
