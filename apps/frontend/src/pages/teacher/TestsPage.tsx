import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { testsApi, Test, CohortStudent } from '../../api/tests';

type Tab = 'library' | 'assignments';

export function TeacherTestsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('library');
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  // Assignment modal state
  const [assigningTest, setAssigningTest] = useState<Test | null>(null);
  const [assignVariantId, setAssignVariantId] = useState('');
  const [assignMode, setAssignMode] = useState<'cohort' | 'students'>('cohort');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [cohortStudents, setCohortStudents] = useState<CohortStudent[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Assignments tab filter
  const [assignmentTestId, setAssignmentTestId] = useState('');

  const load = () =>
    testsApi.getTests().then((r) => setTests(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить тест "${title}"?`)) return;
    await testsApi.deleteTest(id);
    setTests((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleOpen = async (id: string) => {
    const r = await testsApi.toggleOpen(id);
    setTests((prev) => prev.map((t) => t.id === id ? { ...t, is_open: r.data.is_open } : t));
  };

  const openAssignModal = (test: Test) => {
    setAssigningTest(test);
    setAssignVariantId(test.variants?.[0]?.id ?? '');
    setAssignMode('cohort');
    setSelectedStudentIds([]);
    setAssignError('');
    if (test.cohort_id) {
      testsApi.getCohortStudents(test.cohort_id).then((r) => setCohortStudents(r.data));
    }
  };

  const closeAssignModal = () => {
    setAssigningTest(null);
    setCohortStudents([]);
  };

  const handleAssign = async () => {
    if (!assigningTest || !assignVariantId) return;
    setAssigning(true);
    setAssignError('');
    try {
      if (assignMode === 'cohort') {
        await testsApi.assignTest(assigningTest.id, {
          variant_id: assignVariantId,
          cohort_id: assigningTest.cohort_id,
        });
      } else {
        if (selectedStudentIds.length === 0) {
          setAssignError('Выберите хотя бы одного курсанта');
          return;
        }
        await testsApi.assignTest(assigningTest.id, {
          assignments: [{ variant_id: assignVariantId, student_ids: selectedStudentIds }],
        });
      }
      await load();
      closeAssignModal();
    } catch {
      setAssignError('Ошибка при назначении');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (testId: string, studentId: string) => {
    await testsApi.unassignStudent(testId, studentId);
    load();
  };

  const toggleStudent = (id: string) =>
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  // Assignments tab data
  const selectedTest = tests.find((t) => t.id === assignmentTestId);
  const flatAssignments = useMemo(() => {
    if (!selectedTest) return [];
    return (selectedTest.variants ?? []).flatMap((v) =>
      (v.assignments ?? []).map((a) => ({
        studentId: a.student?.id ?? a.student_id,
        callsign: a.student?.callsign ?? '—',
        variantName: v.name,
        variantId: v.id,
      })),
    );
  }, [selectedTest]);

  const submittedIds = useMemo(
    () => new Set((selectedTest?.submissions ?? []).map((s) => s.student_id)),
    [selectedTest],
  );

  // Already assigned student IDs for the modal
  const alreadyAssignedIds = useMemo(() => {
    if (!assigningTest) return new Set<string>();
    return new Set(
      (assigningTest.variants ?? []).flatMap((v) =>
        (v.assignments ?? []).map((a) => a.student_id),
      ),
    );
  }, [assigningTest]);

  const totalAssigned = useMemo(
    () => tests.reduce((sum, t) =>
      sum + (t.variants ?? []).reduce((s, v) => s + (v.assignments?.length ?? v._count?.assignments ?? 0), 0), 0),
    [tests],
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Тесты</h1>
          {tab === 'library' && (
            <button
              onClick={() => navigate('/teacher/tests/create')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + Создать тест
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          {(['library', 'assignments'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {t === 'library' ? 'Библиотека' : `Назначения${totalAssigned > 0 ? ` (${totalAssigned})` : ''}`}
            </button>
          ))}
        </div>

        {/* ─── Library tab ─────────────────────────────────────────────── */}
        {tab === 'library' && (
          <>
            {loading ? (
              <div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div>
            ) : tests.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-slate-500 py-12">Тестов пока нет</div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Название</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Группа</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Назначено</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Прошли</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Доступ</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map((test) => {
                      const assigned = (test.variants ?? []).reduce(
                        (s, v) => s + (v.assignments?.length ?? v._count?.assignments ?? 0), 0,
                      );
                      return (
                        <tr key={test.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{test.title}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{test.cohort?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-center text-gray-500 dark:text-slate-400">{assigned}</td>
                          <td className="px-4 py-3 text-center text-gray-500 dark:text-slate-400">
                            {test._count?.submissions ?? 0}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleOpen(test.id)}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                                test.is_open
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${test.is_open ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {test.is_open ? 'Открыт' : 'Закрыт'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => openAssignModal(test)}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 text-xs font-medium"
                              >
                                Назначить
                              </button>
                              <Link
                                to={`/teacher/tests/${test.id}/results`}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 text-xs font-medium"
                              >
                                Результаты
                              </Link>
                              <button
                                onClick={() => handleDelete(test.id, test.title)}
                                className="text-red-500 hover:text-red-700 text-xs font-medium"
                              >
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ─── Assignments tab ─────────────────────────────────────────── */}
        {tab === 'assignments' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select
                value={assignmentTestId}
                onChange={(e) => setAssignmentTestId(e.target.value)}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
              >
                <option value="">Выберите тест...</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.cohort?.name})</option>
                ))}
              </select>
              {selectedTest && (
                <button
                  onClick={() => openAssignModal(selectedTest)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
                >
                  + Назначить
                </button>
              )}
            </div>

            {!assignmentTestId ? (
              <div className="text-center text-gray-400 dark:text-slate-500 py-12 text-sm">
                Выберите тест чтобы увидеть назначения
              </div>
            ) : flatAssignments.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-slate-500 py-12 text-sm">
                Нет назначений для этого теста
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Курсант</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Вариант</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Статус</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {flatAssignments.map((a) => (
                      <tr key={a.studentId} className="border-b border-gray-100 dark:border-slate-700">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{a.callsign}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{a.variantName}</td>
                        <td className="px-4 py-3">
                          {submittedIds.has(a.studentId) ? (
                            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                              Сдан
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                              Не сдан
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleUnassign(selectedTest!.id, a.studentId)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Убрать
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Assign modal ────────────────────────────────────────────────── */}
      {assigningTest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                Назначить: {assigningTest.title}
              </h2>
              <button onClick={closeAssignModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-xl">×</button>
            </div>

            {/* Variant selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Вариант</label>
              <select
                value={assignVariantId}
                onChange={(e) => setAssignVariantId(e.target.value)}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(assigningTest.variants ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-3">
              {(['cohort', 'students'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setAssignMode(m)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    assignMode === m
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {m === 'cohort' ? 'Вся группа' : 'Выбрать курсантов'}
                </button>
              ))}
            </div>

            {/* Students list (specific mode) */}
            {assignMode === 'students' && (
              <div>
                {cohortStudents.length === 0 ? (
                  <div className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">Загрузка...</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 dark:border-slate-700 rounded-lg p-2">
                    {cohortStudents.map((s) => {
                      const alreadyIn = alreadyAssignedIds.has(s.id);
                      const selected = selectedStudentIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            alreadyIn
                              ? 'opacity-50 cursor-not-allowed'
                              : selected
                              ? 'bg-indigo-50 dark:bg-indigo-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={alreadyIn}
                            onChange={() => !alreadyIn && toggleStudent(s.id)}
                            className="accent-indigo-600"
                          />
                          <span className="text-sm text-gray-800 dark:text-slate-100">{s.callsign}</span>
                          {alreadyIn && <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">назначен</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  Выбрано: {selectedStudentIds.length}
                </p>
              </div>
            )}

            {assignError && (
              <p className="text-sm text-red-600 dark:text-red-400">{assignError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={closeAssignModal}
                className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                Отмена
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg"
              >
                {assigning ? 'Назначение...' : 'Назначить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
