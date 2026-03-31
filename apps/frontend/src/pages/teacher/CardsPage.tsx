import { useEffect, useRef, useState } from 'react';
import { Layout } from '../../components/Layout';
import { cardTasksApi, CardLibrary, CardTask, CardTaskStatus, StudentInfo } from '../../api/cardTasks';

type Tab = 'library' | 'assignments';

const STATUS_LABELS: Record<CardTaskStatus, string> = {
  PENDING: 'Ожидает',
  AWAITING_REVIEW: 'На проверке',
  RETURNED: 'Возвращена',
  COMPLETED: 'Выполнена',
};

const STATUS_COLORS: Record<CardTaskStatus, string> = {
  PENDING: 'text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700',
  AWAITING_REVIEW: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  RETURNED: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  COMPLETED: 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
};

export function TeacherCardsPage() {
  const [tab, setTab] = useState<Tab>('library');

  // Library state
  const [library, setLibrary] = useState<CardLibrary[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadInstructions, setUploadInstructions] = useState('');
  const [uploadImage, setUploadImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assign panel state
  const [assignCard, setAssignCard] = useState<CardLibrary | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');

  // Assignments state
  const [assignments, setAssignments] = useState<CardTask[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CardTaskStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<CardTask | null>(null);
  const [teacherComment, setTeacherComment] = useState('');
  const [showCommentField, setShowCommentField] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [expandedAttempts, setExpandedAttempts] = useState(false);

  const loadLibrary = () => {
    setLoadingLib(true);
    cardTasksApi.getLibrary()
      .then((r) => setLibrary(r.data))
      .finally(() => setLoadingLib(false));
  };

  const loadAssignments = () => {
    setLoadingAssign(true);
    cardTasksApi.getAllAssignments()
      .then((r) => setAssignments(r.data))
      .finally(() => setLoadingAssign(false));
  };

  useEffect(() => {
    loadLibrary();
    loadAssignments();
    cardTasksApi.getStudents().then((r) => setStudents(r.data));
  }, []);

  const handleUpload = async () => {
    setUploadError('');
    if (!uploadTitle.trim()) return setUploadError('Введите название');
    if (!uploadInstructions.trim()) return setUploadError('Введите инструкцию');
    if (!uploadImage) return setUploadError('Загрузите изображение');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('title', uploadTitle.trim());
      form.append('instructions', uploadInstructions.trim());
      form.append('image', uploadImage);
      await cardTasksApi.uploadToLibrary(form);
      setUploadTitle('');
      setUploadInstructions('');
      setUploadImage(null);
      setShowUpload(false);
      loadLibrary();
    } catch {
      setUploadError('Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFromLibrary = async (id: string) => {
    if (!confirm('Удалить карточку из библиотеки?')) return;
    await cardTasksApi.deleteFromLibrary(id);
    loadLibrary();
    if (assignCard?.id === id) setAssignCard(null);
  };

  const openAssign = (card: CardLibrary) => {
    setAssignCard(card);
    setAssignStudentId('');
    setAssignInstructions(card.instructions);
    setAssignMsg('');
  };

  const handleAssign = async () => {
    if (!assignCard || !assignStudentId) return;
    setAssigning(true);
    setAssignMsg('');
    try {
      await cardTasksApi.assignTask(assignCard.id, assignStudentId, assignInstructions || undefined);
      setAssignMsg('Карточка назначена!');
      setAssignStudentId('');
      loadAssignments();
    } catch {
      setAssignMsg('Ошибка назначения');
    } finally {
      setAssigning(false);
    }
  };

  const handleSelectAssignment = async (task: CardTask) => {
    const r = await cardTasksApi.getTask(task.id);
    setSelected(r.data);
    setTeacherComment('');
    setShowCommentField(false);
    setExpandedAttempts(false);
  };

  const handleReview = async (is_correct: boolean) => {
    if (!selected) return;
    const latest = selected.attempts[selected.attempts.length - 1];
    if (!latest) return;
    if (!is_correct && !teacherComment.trim()) {
      setShowCommentField(true);
      return;
    }
    setReviewing(true);
    try {
      await cardTasksApi.reviewAttempt(selected.id, latest.id, is_correct, is_correct ? undefined : teacherComment);
      setSelected(null);
      loadAssignments();
    } finally {
      setReviewing(false);
    }
  };

  const filteredAssignments = statusFilter === 'ALL'
    ? assignments
    : assignments.filter((t) => t.status === statusFilter);

  const pendingCount = assignments.filter((t) => t.status === 'AWAITING_REVIEW').length;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Карточки</h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          {([['library', 'Библиотека'], ['assignments', 'Назначения']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {label}
              {t === 'assignments' && pendingCount > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Library Tab ─────────────────────────────────────────────────────── */}
        {tab === 'library' && (
          <div className="space-y-5">
            {/* Upload toggle */}
            <div className="flex justify-end">
              <button
                onClick={() => { setShowUpload((v) => !v); setUploadError(''); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {showUpload ? 'Отмена' : '+ Добавить карточку'}
              </button>
            </div>

            {/* Upload form */}
            {showUpload && (
              <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-3 max-w-lg">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Новая карточка</h3>
                <input
                  type="text"
                  placeholder="Название *"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                />
                <textarea
                  placeholder="Инструкция для курсанта *"
                  value={uploadInstructions}
                  onChange={(e) => setUploadInstructions(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                />
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setUploadImage(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200"
                  >
                    {uploadImage ? uploadImage.name : 'Выбрать изображение *'}
                  </button>
                  {uploadImage && (
                    <img
                      src={URL.createObjectURL(uploadImage)}
                      alt="preview"
                      className="mt-2 h-32 rounded border border-gray-200 dark:border-slate-700 object-contain"
                    />
                  )}
                </div>
                {uploadError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
                )}
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {uploading ? 'Загрузка...' : 'Сохранить в библиотеку'}
                </button>
              </div>
            )}

            {/* Library grid + assign panel */}
            <div className="flex gap-6">
              {/* Grid */}
              <div className="flex-1">
                {loadingLib ? (
                  <p className="text-gray-400 dark:text-slate-500 text-sm">Загрузка...</p>
                ) : library.length === 0 ? (
                  <div className="text-center text-gray-400 dark:text-slate-500 py-16 text-sm">
                    Библиотека пуста. Добавьте первую карточку.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {library.map((card) => (
                      <div
                        key={card.id}
                        className={`bg-white dark:bg-slate-800 border rounded-xl overflow-hidden transition-all ${
                          assignCard?.id === card.id
                            ? 'border-blue-400 dark:border-blue-600 shadow-md'
                            : 'border-gray-200 dark:border-slate-700'
                        }`}
                      >
                        <img
                          src={cardTasksApi.getImageUrl(card.image_path)}
                          alt={card.title}
                          className="w-full h-36 object-cover"
                        />
                        <div className="p-3 space-y-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{card.title}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{card.instructions}</p>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => openAssign(card)}
                              className="flex-1 text-xs py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                              Назначить
                            </button>
                            <button
                              onClick={() => handleDeleteFromLibrary(card.id)}
                              className="text-xs py-1.5 px-2 text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign side panel */}
              {assignCard && (
                <div className="w-72 shrink-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3 self-start">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Назначить курсанту</h3>
                    <button onClick={() => setAssignCard(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-lg leading-none">×</button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{assignCard.title}</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Курсант *</label>
                    <select
                      value={assignStudentId}
                      onChange={(e) => setAssignStudentId(e.target.value)}
                      className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Выберите...</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.callsign}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Инструкция (можно изменить)</label>
                    <textarea
                      value={assignInstructions}
                      onChange={(e) => setAssignInstructions(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                  {assignMsg && (
                    <p className={`text-xs ${assignMsg.startsWith('Ошибка') ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                      {assignMsg}
                    </p>
                  )}
                  <button
                    onClick={handleAssign}
                    disabled={assigning || !assignStudentId}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    {assigning ? 'Назначение...' : 'Назначить'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Assignments Tab ──────────────────────────────────────────────────── */}
        {tab === 'assignments' && (
          <div className="flex gap-6">
            {/* Left: list */}
            <div className="w-72 shrink-0 space-y-3">
              {/* Status filter */}
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'AWAITING_REVIEW', 'PENDING', 'RETURNED', 'COMPLETED'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      statusFilter === s
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {s === 'ALL' ? 'Все' : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {loadingAssign ? (
                <p className="text-gray-400 dark:text-slate-500 text-sm">Загрузка...</p>
              ) : filteredAssignments.length === 0 ? (
                <div className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Нет назначений</div>
              ) : (
                filteredAssignments.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleSelectAssignment(task)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      selected?.id === task.id
                        ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="font-medium text-sm text-gray-900 dark:text-slate-100 truncate">{task.student?.callsign}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[task.status]}`}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </div>
                    {task.library && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{task.library.title}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {new Date(task.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Right: review panel */}
            {selected ? (
              <div className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-slate-100">{selected.student?.callsign}</h2>
                    {selected.library && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">{selected.library.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[selected.status]}`}>
                      {STATUS_LABELS[selected.status]}
                    </span>
                    <span className="text-sm text-gray-400 dark:text-slate-500">Попыток: {selected.attempts.length}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-slate-400">
                  <span className="font-medium text-gray-700 dark:text-slate-200">Инструкция:</span> {selected.instructions}
                </p>

                {/* Latest attempt */}
                {(() => {
                  const latest = selected.attempts[selected.attempts.length - 1];
                  if (!latest) return (
                    <p className="text-sm text-gray-400 dark:text-slate-500">Попыток ещё не было</p>
                  );
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
                          <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">
                            Аннотация (попытка #{latest.attempt_number}):
                          </p>
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

                {/* Review buttons — only for AWAITING_REVIEW */}
                {selected.status === 'AWAITING_REVIEW' && (
                  <div className="border-t border-gray-100 dark:border-slate-700 pt-4 space-y-3">
                    {showCommentField && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                          Комментарий для курсанта <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={teacherComment}
                          onChange={(e) => setTeacherComment(e.target.value)}
                          placeholder="Объясните, что не так..."
                          rows={2}
                          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-slate-800"
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
                        onClick={() => showCommentField ? handleReview(false) : setShowCommentField(true)}
                        disabled={reviewing}
                        className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        ✗ Неверно
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
                Выберите назначение из списка
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
