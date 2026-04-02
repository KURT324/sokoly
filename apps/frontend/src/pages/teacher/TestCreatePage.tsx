import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Layout } from '../../components/Layout';
import { testsApi, CohortStudent, ParsedQuestion } from '../../api/tests';
import { cohortsApi, Cohort } from '../../api/cohorts';

type QuestionType = 'SINGLE' | 'MULTIPLE' | 'OPEN_TEXT' | 'DRAWING';

interface AnswerForm {
  localId: string;
  answer_text: string;
  is_correct: boolean;
}

interface QuestionForm {
  localId: string;
  type: QuestionType;
  question_text: string;
  image_path?: string;
  image_preview?: string;
  image_uploading?: boolean;
  answers: AnswerForm[];
}

interface VariantForm {
  localId: string;
  name: string;
  questions: QuestionForm[];
  student_ids: string[];
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

function defaultQuestion(type: QuestionType): QuestionForm {
  return {
    localId: makeId(),
    type,
    question_text: '',
    answers:
      type === 'SINGLE' || type === 'MULTIPLE'
        ? [
            { localId: makeId(), answer_text: '', is_correct: false },
            { localId: makeId(), answer_text: '', is_correct: false },
          ]
        : [],
  };
}

function defaultVariant(index: number): VariantForm {
  return { localId: makeId(), name: `Вариант ${index + 1}`, questions: [], student_ids: [] };
}

function typeLabel(t: QuestionType) {
  const labels: Record<QuestionType, string> = {
    SINGLE: 'Один ответ',
    MULTIPLE: 'Несколько ответов',
    OPEN_TEXT: 'Открытый ответ',
    DRAWING: 'Рисование',
  };
  return labels[t];
}

function SortableQuestion({
  question,
  index,
  onUpdate,
  onRemove,
}: {
  question: QuestionForm;
  index: number;
  onUpdate: (q: QuestionForm) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.localId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing text-gray-400 dark:text-slate-500 hover:text-gray-600 p-1"
          title="Перетащить"
        >
          ⠿
        </button>
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
              Вопрос {index + 1} — {typeLabel(question.type)}
            </span>
            <button onClick={onRemove} className="text-red-400 hover:text-red-600 dark:text-red-400 text-sm">
              Удалить
            </button>
          </div>
          <QuestionEditor question={question} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  );
}

function QuestionEditor({ question, onUpdate }: { question: QuestionForm; onUpdate: (q: QuestionForm) => void }) {
  const set = (patch: Partial<QuestionForm>) => onUpdate({ ...question, ...patch });

  const setAnswer = (localId: string, patch: Partial<AnswerForm>) =>
    set({ answers: question.answers.map((a) => (a.localId === localId ? { ...a, ...patch } : a)) });

  const addAnswer = () =>
    set({ answers: [...question.answers, { localId: makeId(), answer_text: '', is_correct: false }] });

  const removeAnswer = (localId: string) =>
    set({ answers: question.answers.filter((a) => a.localId !== localId) });

  const handleImageUpload = async (file: File) => {
    set({ image_uploading: true, image_preview: URL.createObjectURL(file) });
    try {
      const r = await testsApi.uploadImage(file);
      set({ image_path: r.data.image_path, image_uploading: false });
    } catch {
      set({ image_uploading: false, image_preview: undefined });
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={question.question_text}
        onChange={(e) => set({ question_text: e.target.value })}
        placeholder="Текст вопроса..."
        rows={2}
        className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />

      {(question.type === 'SINGLE' || question.type === 'MULTIPLE') && (
        <div className="space-y-2">
          {question.answers.map((ans) => (
            <div key={ans.localId} className="flex items-center gap-2">
              {question.type === 'SINGLE' ? (
                <input
                  type="radio"
                  name={`correct-${question.localId}`}
                  checked={ans.is_correct}
                  onChange={() =>
                    set({ answers: question.answers.map((a) => ({ ...a, is_correct: a.localId === ans.localId })) })
                  }
                  className="accent-blue-600"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={ans.is_correct}
                  onChange={(e) => setAnswer(ans.localId, { is_correct: e.target.checked })}
                  className="accent-blue-600"
                />
              )}
              <input
                type="text"
                value={ans.answer_text}
                onChange={(e) => setAnswer(ans.localId, { answer_text: e.target.value })}
                placeholder="Вариант ответа..."
                className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {question.answers.length > 2 && (
                <button onClick={() => removeAnswer(ans.localId)} className="text-gray-400 dark:text-slate-500 hover:text-red-500 text-sm">
                  ×
                </button>
              )}
            </div>
          ))}
          <button onClick={addAnswer} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 text-sm font-medium">
            + Добавить вариант
          </button>
        </div>
      )}

      {question.type === 'OPEN_TEXT' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
          Требует ручной проверки преподавателем
        </p>
      )}

      {question.type === 'DRAWING' && (
        <div className="space-y-2">
          <label className="block">
            <span className="text-sm text-gray-700 dark:text-slate-200 font-medium">Изображение-подложка *</span>
            <input
              type="file"
              accept="image/*"
              className="mt-1 block text-sm text-gray-500 dark:text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
          </label>
          {question.image_uploading && <p className="text-xs text-gray-400 dark:text-slate-500">Загрузка...</p>}
          {question.image_preview && (
            <img src={question.image_preview} alt="preview" className="h-24 rounded border border-gray-200 dark:border-slate-700 object-contain" />
          )}
          {question.image_path && !question.image_uploading && (
            <p className="text-xs text-green-600">✓ Изображение загружено</p>
          )}
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
            Требует ручной проверки преподавателем
          </p>
        </div>
      )}
    </div>
  );
}

export function TestCreatePage() {
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [title, setTitle] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [dayId, setDayId] = useState('');
  const [timeLimitMin, setTimeLimitMin] = useState('');
  const [showResultImmediately, setShowResultImmediately] = useState(true);
  const [variants, setVariants] = useState<VariantForm[]>([defaultVariant(0)]);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [cohortStudents, setCohortStudents] = useState<CohortStudent[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    cohortsApi.getCohorts().then((r) => {
      setCohorts(r.data);
      if (r.data.length === 1) setCohortId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!cohortId) { setCohortStudents([]); return; }
    testsApi.getCohortStudents(cohortId).then((r) => setCohortStudents(r.data));
  }, [cohortId]);

  const selectedCohort = cohorts.find((c) => c.id === cohortId);
  const activeVariant = variants[activeVariantIdx] ?? variants[0];

  const updateVariant = (localId: string, patch: Partial<VariantForm>) =>
    setVariants((prev) => prev.map((v) => (v.localId === localId ? { ...v, ...patch } : v)));

  const addVariant = () => {
    const newVariant = defaultVariant(variants.length);
    setVariants((prev) => [...prev, newVariant]);
    setActiveVariantIdx(variants.length);
  };

  const removeVariant = (localId: string) => {
    if (variants.length === 1) return;
    const idx = variants.findIndex((v) => v.localId === localId);
    setVariants((prev) => prev.filter((v) => v.localId !== localId));
    setActiveVariantIdx((prev) => Math.min(prev, variants.length - 2));
    // Free up students from removed variant — no action needed, they just won't be assigned
    void idx;
  };

  const addQuestion = (type: QuestionType) => {
    updateVariant(activeVariant.localId, {
      questions: [...activeVariant.questions, defaultQuestion(type)],
    });
  };

  const updateQuestion = (qLocalId: string, updated: QuestionForm) =>
    updateVariant(activeVariant.localId, {
      questions: activeVariant.questions.map((q) => (q.localId === qLocalId ? updated : q)),
    });

  const removeQuestion = (qLocalId: string) =>
    updateVariant(activeVariant.localId, {
      questions: activeVariant.questions.filter((q) => q.localId !== qLocalId),
    });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activeVariant.questions.findIndex((q) => q.localId === active.id);
      const newIndex = activeVariant.questions.findIndex((q) => q.localId === over.id);
      updateVariant(activeVariant.localId, {
        questions: arrayMove(activeVariant.questions, oldIndex, newIndex),
      });
    }
  };

  // Toggle student assignment: if student is in another variant, move them; if in this, remove; if unassigned, add
  const toggleStudent = (studentId: string) => {
    const currentVariantLocalId = activeVariant.localId;
    const inThisVariant = activeVariant.student_ids.includes(studentId);

    setVariants((prev) =>
      prev.map((v) => {
        if (v.localId === currentVariantLocalId) {
          return {
            ...v,
            student_ids: inThisVariant
              ? v.student_ids.filter((id) => id !== studentId)
              : [...v.student_ids, studentId],
          };
        }
        // Remove from other variants (one variant per student per test)
        return { ...v, student_ids: v.student_ids.filter((id) => id !== studentId) };
      }),
    );
  };

  const getStudentVariant = (studentId: string): string | null => {
    for (const v of variants) {
      if (v.student_ids.includes(studentId)) return v.localId;
    }
    return null;
  };

  const handleImportDocx = async (file: File) => {
    setImporting(true);
    setImportResult('');
    try {
      const r = await testsApi.importDocx(file);
      const imported: QuestionForm[] = r.data.questions.map((q: ParsedQuestion) => ({
        localId: makeId(),
        type: q.type as QuestionType,
        question_text: q.question_text,
        answers: q.answers.map((a) => ({ localId: makeId(), answer_text: a.answer_text, is_correct: a.is_correct })),
      }));
      updateVariant(activeVariant.localId, {
        questions: [...activeVariant.questions, ...imported],
      });
      setImportResult(`Импортировано вопросов: ${imported.length}`);
    } catch (e: any) {
      setImportResult(`Ошибка: ${e.response?.data?.error ?? 'не удалось разобрать файл'}`);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) return setError('Введите название теста');
    if (!cohortId) return setError('Выберите группу');
    if (variants.length === 0) return setError('Добавьте хотя бы один вариант');

    for (const v of variants) {
      if (!v.name.trim()) return setError('Введите название для каждого варианта');
      if (v.questions.length === 0) return setError(`Добавьте вопросы в вариант "${v.name}"`);
      for (const q of v.questions) {
        if (!q.question_text.trim()) return setError('Заполните текст всех вопросов');
        if ((q.type === 'SINGLE' || q.type === 'MULTIPLE') && q.answers.some((a) => !a.answer_text.trim()))
          return setError('Заполните все варианты ответов');
        if ((q.type === 'SINGLE' || q.type === 'MULTIPLE') && !q.answers.some((a) => a.is_correct))
          return setError(`Отметьте правильный ответ для вопроса: "${q.question_text.slice(0, 30)}..."`);
        if (q.type === 'DRAWING' && !q.image_path)
          return setError('Загрузите изображение для вопроса с рисованием');
      }
    }

    setSaving(true);
    try {
      await testsApi.createTest({
        title: title.trim(),
        cohort_id: cohortId,
        day_id: dayId || undefined,
        time_limit_min: timeLimitMin ? Number(timeLimitMin) : undefined,
        show_result_immediately: showResultImmediately,
        variants: variants.map((v) => ({
          name: v.name,
          student_ids: v.student_ids,
          questions: v.questions.map((q, i) => ({
            type: q.type,
            question_text: q.question_text,
            image_path: q.image_path,
            order_index: i,
            answers: q.type === 'SINGLE' || q.type === 'MULTIPLE'
              ? q.answers.map((a) => ({ answer_text: a.answer_text, is_correct: a.is_correct }))
              : undefined,
          })),
        })),
      });
      navigate('/teacher/tests');
    } catch {
      setError('Ошибка при сохранении теста');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Создать тест</h1>
          <button
            onClick={() => navigate('/teacher/tests')}
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700"
          >
            ← Назад
          </button>
        </div>

        {/* Settings */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Название *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название теста"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Группа *</label>
              <select
                value={cohortId}
                onChange={(e) => { setCohortId(e.target.value); setDayId(''); }}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите группу</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Учебный день (опционально)</label>
              <select
                value={dayId}
                onChange={(e) => setDayId(e.target.value)}
                disabled={!cohortId}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              >
                <option value="">Не привязан</option>
                {selectedCohort?.days.map((d) => (
                  <option key={d.id} value={d.id}>День {d.day_number}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Лимит времени (мин, опционально)</label>
              <input
                type="number"
                value={timeLimitMin}
                onChange={(e) => setTimeLimitMin(e.target.value)}
                placeholder="Без ограничений"
                min={1}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showResultImmediately}
                  onChange={(e) => setShowResultImmediately(e.target.checked)}
                  className="accent-blue-600 w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-slate-200">Показать результат сразу</span>
              </label>
            </div>
          </div>
        </div>

        {/* Variant tabs */}
        <div>
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {variants.map((v, idx) => (
              <button
                key={v.localId}
                onClick={() => setActiveVariantIdx(idx)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  idx === activeVariantIdx
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-300 dark:border-slate-600 hover:border-blue-400'
                }`}
              >
                {v.name}
                {v.questions.length > 0 && (
                  <span className={`ml-1.5 text-xs rounded-full px-1.5 ${idx === activeVariantIdx ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                    {v.questions.length}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={addVariant}
              className="px-3 py-2 rounded-lg text-sm border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              + Вариант
            </button>
          </div>

          {/* Active variant editor */}
          {activeVariant && (
            <div className="space-y-4">
              {/* Variant name */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={activeVariant.name}
                  onChange={(e) => updateVariant(activeVariant.localId, { name: e.target.value })}
                  className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Название варианта"
                />
                {variants.length > 1 && (
                  <button
                    onClick={() => removeVariant(activeVariant.localId)}
                    className="text-sm text-red-400 hover:text-red-600 whitespace-nowrap"
                  >
                    Удалить вариант
                  </button>
                )}
              </div>

              {/* Questions */}
              <div className="space-y-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={activeVariant.questions.map((q) => q.localId)} strategy={verticalListSortingStrategy}>
                    {activeVariant.questions.map((q, i) => (
                      <SortableQuestion
                        key={q.localId}
                        question={q}
                        index={i}
                        onUpdate={(updated) => updateQuestion(q.localId, updated)}
                        onRemove={() => removeQuestion(q.localId)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>

              {/* Add question */}
              <div className="bg-gray-50 dark:bg-slate-700/30 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl p-4">
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-3 font-medium">Добавить вопрос:</p>
                <div className="flex flex-wrap gap-2">
                  {(['SINGLE', 'MULTIPLE', 'OPEN_TEXT', 'DRAWING'] as QuestionType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => addQuestion(t)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      {typeLabel(t)}
                    </button>
                  ))}
                  <button
                    onClick={() => importInputRef.current?.click()}
                    disabled={importing}
                    className="px-3 py-1.5 text-sm rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50"
                  >
                    {importing ? 'Импорт...' : '📥 Импорт из Word'}
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportDocx(f); }}
                  />
                </div>
                {importResult && (
                  <p className={`mt-2 text-xs ${importResult.startsWith('Ошибка') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {importResult}
                  </p>
                )}
              </div>

              {/* Student assignment */}
              {cohortStudents.length > 0 && (
                <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">
                    Назначить курсантов на этот вариант
                  </h3>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {cohortStudents.map((s) => {
                      const assignedVariantLocalId = getStudentVariant(s.id);
                      const inThis = assignedVariantLocalId === activeVariant.localId;
                      const inOther = assignedVariantLocalId !== null && !inThis;
                      const otherVariant = inOther ? variants.find((v) => v.localId === assignedVariantLocalId) : null;
                      return (
                        <label key={s.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                          inThis
                            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-700/50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={inThis}
                            onChange={() => toggleStudent(s.id)}
                            className="accent-blue-600"
                          />
                          <span className="text-sm text-gray-800 dark:text-slate-100 flex-1 min-w-0 truncate">{s.callsign}</span>
                          {inOther && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">{otherVariant?.name}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                    {activeVariant.student_ids.length} из {cohortStudents.length} назначено
                  </p>
                </div>
              )}

              {!cohortId && (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-2">
                  Выберите группу выше, чтобы назначить курсантов на вариант
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить тест'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
