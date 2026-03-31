import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { testsApi, Test, TestSubmission } from '../../api/tests';

type StatusFilter = 'all' | 'checked' | 'pending';

function isChecked(sub: TestSubmission) {
  return sub.manual_score != null || sub.auto_score != null;
}

function finalScore(sub: TestSubmission) {
  if (sub.manual_score != null) return sub.manual_score.toFixed(1);
  if (sub.auto_score != null) return sub.auto_score.toFixed(1);
  return '—';
}

function isQuestionCorrect(ans: any, question: any): boolean {
  if (!question) return true;
  if (question.type === 'SINGLE' || question.type === 'MULTIPLE') {
    const chosen: string[] = ans.answer_ids ?? [];
    const correct = question.answers.filter((a: any) => a.is_correct).map((a: any) => a.id);
    return (
      chosen.length === correct.length &&
      correct.every((id: string) => chosen.includes(id))
    );
  }
  // OPEN_TEXT and DRAWING are always shown (manual grading)
  return false;
}

export function TeacherTestResultsPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [selected, setSelected] = useState<TestSubmission | null>(null);
  const [manualScores, setManualScores] = useState<Record<string, string>>({});
  const [savingScore, setSavingScore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Detail panel: show only wrong answers by default
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  useEffect(() => {
    if (!testId) return;
    Promise.all([testsApi.getTest(testId), testsApi.getResults(testId)])
      .then(([testR, subR]) => {
        setTest(testR.data);
        setSubmissions(subR.data);
      })
      .finally(() => setLoading(false));
  }, [testId]);

  // Reset showAll when switching students
  useEffect(() => { setShowAllQuestions(false); }, [selected?.id]);

  const handleSaveScore = async (subId: string) => {
    if (!testId) return;
    const score = parseFloat(manualScores[subId] ?? '');
    if (isNaN(score)) return;
    setSavingScore(subId);
    try {
      const r = await testsApi.updateScore(testId, subId, score);
      setSubmissions((prev) => prev.map((s) => (s.id === subId ? r.data : s)));
      if (selected?.id === subId) setSelected(r.data);
    } finally {
      setSavingScore(null);
    }
  };

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const matchSearch = !search || (s.student?.callsign ?? '').toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'checked' && isChecked(s)) ||
        (statusFilter === 'pending' && !isChecked(s));
      return matchSearch && matchStatus;
    });
  }, [submissions, search, statusFilter]);

  // Correct/total counter for selected submission
  const scoreStats = useMemo(() => {
    if (!selected || !test) return null;
    const answers: any[] = Array.isArray(selected.answers_json) ? selected.answers_json : [];
    const autoGradable = test.questions.filter((q) => q.type === 'SINGLE' || q.type === 'MULTIPLE');
    if (autoGradable.length === 0) return null;
    const correct = autoGradable.filter((q) => {
      const ans = answers.find((a) => a.question_id === q.id);
      return ans && isQuestionCorrect(ans, q);
    }).length;
    return { correct, total: autoGradable.length };
  }, [selected, test]);

  // Questions to display in detail panel
  const visibleAnswers = useMemo(() => {
    if (!selected || !test) return [];
    const answers: any[] = Array.isArray(selected.answers_json) ? selected.answers_json : [];
    return test.questions
      .map((q) => ({ question: q, ans: answers.find((a) => a.question_id === q.id) }))
      .filter(({ question, ans }) => {
        if (!ans) return showAllQuestions;
        if (showAllQuestions) return true;
        // Always show manual-grading questions and wrong answers
        if (question.type === 'OPEN_TEXT' || question.type === 'DRAWING') return true;
        return !isQuestionCorrect(ans, question);
      });
  }, [selected, test, showAllQuestions]);

  if (loading) return <Layout><div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div></Layout>;

  const statusCounts = {
    all: submissions.length,
    checked: submissions.filter(isChecked).length,
    pending: submissions.filter((s) => !isChecked(s)).length,
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/teacher/tests')} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
            ← Назад
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{test?.title} — результаты</h1>
          <span className="text-sm text-gray-400 dark:text-slate-500">{submissions.length} ответов</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Поиск по позывному..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>

          {/* Status tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden text-sm">
            {(['all', 'pending', 'checked'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {s === 'all' ? 'Все' : s === 'checked' ? 'Проверены' : 'На проверке'}
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${statusFilter === s ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                  {statusCounts[s]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-5 items-start">
          {/* Left: submissions table */}
          <div className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-slate-500 py-12 text-sm">
                {submissions.length === 0 ? 'Никто ещё не прошёл тест' : 'Нет совпадений'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Курсант</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Авто</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Итог</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => (
                    <tr
                      key={sub.id}
                      onClick={() => setSelected(sub)}
                      className={`border-b border-gray-100 dark:border-slate-700 cursor-pointer transition-colors ${
                        selected?.id === sub.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/40'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={`font-medium ${selected?.id === sub.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-slate-100'}`}>
                          {sub.student?.callsign}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                        {sub.auto_score != null ? `${sub.auto_score.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">{finalScore(sub)}</td>
                      <td className="px-4 py-3">
                        {isChecked(sub)
                          ? <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Проверен</span>
                          : <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">На проверке</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Right: detail panel */}
          {selected && test ? (
            <div className="w-[420px] shrink-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {/* Detail header */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-slate-100">{selected.student?.callsign}</h2>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {new Date(selected.submitted_at).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-lg leading-none shrink-0"
                  >
                    ×
                  </button>
                </div>

                {/* Score stats */}
                <div className="flex items-center gap-3 flex-wrap">
                  {scoreStats && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
                      scoreStats.correct === scoreStats.total
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : scoreStats.correct / scoreStats.total >= 0.5
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      ✓ {scoreStats.correct} из {scoreStats.total} верно
                    </span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    Итог: <strong className="text-gray-900 dark:text-slate-100">{finalScore(selected)}</strong>
                  </span>
                </div>

                {/* Show all toggle */}
                <button
                  onClick={() => setShowAllQuestions((v) => !v)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {showAllQuestions ? 'Показать только ошибки' : 'Показать все вопросы'}
                </button>
              </div>

              {/* Questions list */}
              <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
                {visibleAnswers.length === 0 && (
                  <p className="text-sm text-green-600 dark:text-green-400 py-4 text-center">
                    Все ответы верны
                  </p>
                )}

                {visibleAnswers.map(({ question, ans }) => {
                  const correct = ans ? isQuestionCorrect(ans, question) : false;
                  const needsManual = question.type === 'OPEN_TEXT' || question.type === 'DRAWING';
                  return (
                    <div key={question.id} className={`border-l-2 pl-3 space-y-2 ${
                      needsManual ? 'border-amber-400 dark:border-amber-500' :
                      correct ? 'border-green-400 dark:border-green-600' : 'border-red-400 dark:border-red-500'
                    }`}>
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{question.question_text}</p>

                      {(question.type === 'SINGLE' || question.type === 'MULTIPLE') && ans && (
                        <div className="space-y-1">
                          {question.answers.map((a: any) => {
                            const chosen = (ans.answer_ids ?? []).includes(a.id);
                            return (
                              <div
                                key={a.id}
                                className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                                  chosen && a.is_correct ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' :
                                  chosen && !a.is_correct ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' :
                                  !chosen && a.is_correct ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' :
                                  'text-gray-500 dark:text-slate-400'
                                }`}
                              >
                                <span className="shrink-0">{chosen ? '●' : '○'}</span>
                                <span>{a.answer_text}</span>
                                {a.is_correct && <span className="ml-auto shrink-0 text-green-600 dark:text-green-400">✓</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {question.type === 'OPEN_TEXT' && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700 dark:text-slate-200 bg-gray-50 dark:bg-slate-700/30 rounded p-2">
                            {ans?.text || '(пусто)'}
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number" min={0} max={100}
                              value={manualScores[selected.id] ?? selected.manual_score ?? ''}
                              onChange={(e) => setManualScores((prev) => ({ ...prev, [selected.id]: e.target.value }))}
                              placeholder="Балл"
                              className="w-20 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                            />
                            <button
                              onClick={() => handleSaveScore(selected.id)}
                              disabled={savingScore === selected.id}
                              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {savingScore === selected.id ? '...' : 'Сохранить'}
                            </button>
                          </div>
                        </div>
                      )}

                      {question.type === 'DRAWING' && (
                        <div className="space-y-2">
                          <div className="flex gap-2 flex-wrap">
                            {question.image_path && (
                              <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Оригинал:</p>
                                <img src={testsApi.getQuestionImageUrl(question.image_path)} alt="original" className="h-28 rounded border border-gray-200 dark:border-slate-700 object-contain" />
                              </div>
                            )}
                            {ans?.drawing_path && (
                              <div>
                                <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Ответ курсанта:</p>
                                <img src={testsApi.getDrawingUrl(ans.drawing_path)} alt="drawing" className="h-28 rounded border border-gray-200 dark:border-slate-700 object-contain" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number" min={0} max={100}
                              value={manualScores[selected.id] ?? selected.manual_score ?? ''}
                              onChange={(e) => setManualScores((prev) => ({ ...prev, [selected.id]: e.target.value }))}
                              placeholder="Балл"
                              className="w-20 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                            />
                            <button
                              onClick={() => handleSaveScore(selected.id)}
                              disabled={savingScore === selected.id}
                              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {savingScore === selected.id ? '...' : 'Сохранить'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="w-[420px] shrink-0 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-sm text-gray-400 dark:text-slate-500 py-16">
              Выберите курсанта слева
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
