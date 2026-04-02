import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Layout } from '../../components/Layout';
import { analyticsApi, TestAnalytics, CardAnalyticsRow } from '../../api/analytics';
import { cohortsApi, Cohort } from '../../api/cohorts';

const CARD_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает',
  AWAITING_REVIEW: 'На проверке',
  RETURNED: 'Возвращено',
  COMPLETED: 'Выполнено',
};

function cardStatusLabel(status: string | null): string {
  if (!status) return '—';
  return CARD_STATUS_LABELS[status] ?? status;
}

function scoreColor(score: number | null | 'pending'): string {
  if (score === null) return '';
  if (score === 'pending') return 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500';
  if (score < 50) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  if (score < 80) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
}

function scoreLabel(score: number | null | 'pending', questionCount?: number | null): string {
  if (score === null) return '—';
  if (score === 'pending') return '⏳';
  if (questionCount != null && questionCount > 0) {
    const correct = Math.round((score / 100) * questionCount);
    return `${correct} из ${questionCount}`;
  }
  return `${score.toFixed(0)}%`;
}

export function TeacherAnalyticsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [testData, setTestData] = useState<TestAnalytics | null>(null);
  const [cardData, setCardData] = useState<CardAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cohortsApi.getCohorts().then((r) => {
      setCohorts(r.data);
      if (r.data.length > 0) setSelectedCohortId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedCohortId) return;
    setLoading(true);
    Promise.all([
      analyticsApi.getCohortTests(selectedCohortId),
      analyticsApi.getCohortCards(selectedCohortId),
    ])
      .then(([tR, cR]) => {
        setTestData(tR.data);
        setCardData(cR.data);
      })
      .finally(() => setLoading(false));
  }, [selectedCohortId]);

  const barChartData = cardData.map((r) => ({
    name: r.student.callsign,
    avgAttempts: r.avgAttempts,
  }));

  // Students needing attention: no completed tasks AND totalTasks > 0
  const needAttention = cardData.filter((r) => r.totalTasks > 0 && r.lastStatus !== 'COMPLETED');

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Аналитика</h1>
          <select
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {loading && <div className="text-gray-400 dark:text-slate-500 text-sm">Загрузка...</div>}

        {/* Block 1: Test scores */}
        {testData && testData.tests.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">Результаты тестов</h2>
            <div className="overflow-x-auto">
              <table className="text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden w-full">
                <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-slate-400 w-40">Курсант</th>
                    {testData.tests.map((t) => (
                      <th key={t.id} className="text-center px-3 py-2 font-medium text-gray-600 dark:text-slate-400 max-w-28">
                        <span className="block truncate text-xs" title={t.title}>{t.title}</span>
                      </th>
                    ))}
                    <th className="text-center px-3 py-2 font-medium text-gray-600 dark:text-slate-400">Среднее</th>
                  </tr>
                </thead>
                <tbody>
                  {testData.rows.map((row) => (
                    <tr key={row.student.id} className="border-b border-gray-100 dark:border-slate-700">
                      <td className="px-4 py-2 font-medium text-gray-800 dark:text-slate-100 text-sm">{row.student.callsign}</td>
                      {testData.tests.map((t) => {
                        const score = row.scores[t.id];
                        return (
                          <td key={t.id} className="px-3 py-2 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded ${scoreColor(score)}`}>
                              {scoreLabel(score, t.questionCount)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${scoreColor(row.average)}`}>
                          {row.average != null ? `${row.average.toFixed(0)}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Column averages row */}
                  <tr className="bg-gray-50 dark:bg-slate-700/30 border-t-2 border-gray-200 dark:border-slate-700">
                    <td className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400">Средн. по тесту</td>
                    {testData.tests.map((t) => {
                      const avg = testData.columnAverages[t.id];
                      return (
                        <td key={t.id} className="px-3 py-2 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${scoreColor(avg)}`}>
                            {scoreLabel(avg, t.questionCount)}
                          </span>
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {testData && testData.tests.length === 0 && !loading && (
          <p className="text-gray-400 dark:text-slate-500 text-sm">Тестов для этой группы ещё нет.</p>
        )}

        {/* Block 2: Cards */}
        {cardData.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Статистика карточек</h2>
            <div className="overflow-x-auto">
              <table className="text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden w-full">
                <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-slate-400">Курсант</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600 dark:text-slate-400">Заданий</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600 dark:text-slate-400">Попыток</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600 dark:text-slate-400">% с 1-й попытки</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600 dark:text-slate-400">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {cardData.map((row) => (
                    <tr key={row.student.id} className="border-b border-gray-100 dark:border-slate-700">
                      <td className="px-4 py-2 font-medium text-gray-800 dark:text-slate-100">{row.student.callsign}</td>
                      <td className="px-3 py-2 text-center text-gray-600 dark:text-slate-400">{row.totalTasks}</td>
                      <td className="px-3 py-2 text-center text-gray-600 dark:text-slate-400">{row.totalAttempts}</td>
                      <td className="px-3 py-2 text-center">
                        {row.firstAttemptPct != null ? (
                          <span className={`text-xs px-2 py-0.5 rounded ${row.firstAttemptPct >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : row.firstAttemptPct >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                            {row.firstAttemptPct}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          row.lastStatus === 'COMPLETED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          row.lastStatus === 'AWAITING_REVIEW' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                          row.lastStatus === 'RETURNED' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                        }`}>
                          {cardStatusLabel(row.lastStatus)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bar chart */}
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200 mb-4">Среднее кол-во попыток на курсанта</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [`${v} попыток`]} />
                  <Bar dataKey="avgAttempts" radius={[4, 4, 0, 0]}>
                    {barChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.avgAttempts <= 1 ? '#38a169' : entry.avgAttempts <= 2 ? '#d69e2e' : '#e53e3e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Block 3: Need attention */}
        {needAttention.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">Требуют внимания</h2>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-1">
              {needAttention.map((r) => (
                <div key={r.student.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-800 dark:text-slate-100">{r.student.callsign}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.lastStatus === 'AWAITING_REVIEW' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {cardStatusLabel(r.lastStatus)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
