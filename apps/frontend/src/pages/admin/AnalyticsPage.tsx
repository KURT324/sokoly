import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { analyticsApi, OverviewData, StudentAnalytics } from '../../api/analytics';

export function AdminAnalyticsPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<Record<string, StudentAnalytics>>({});
  const [loadingCohort, setLoadingCohort] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    analyticsApi.getOverview()
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handleExpandCohort = async (cohortId: string) => {
    if (expanded === cohortId) { setExpanded(null); return; }
    setExpanded(cohortId);
    if (!studentDetails[cohortId]) {
      setLoadingCohort(cohortId);
      try {
        const [testsR, cardsR] = await Promise.all([
          analyticsApi.getCohortTests(cohortId),
          analyticsApi.getCohortCards(cohortId),
        ]);
        // Build a combined view per student
        const combined = testsR.data.rows.map((row) => {
          const cardRow = cardsR.data.find((c) => c.student.id === row.student.id);
          return { student: row.student, average: row.average, cardStats: cardRow };
        });
        setStudentDetails((prev) => ({ ...prev, [cohortId]: { student: null as any, submissions: combined as any, cardTasks: [] } }));
      } finally {
        setLoadingCohort(null);
      }
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await analyticsApi.exportCsv();
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analytics.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Layout><div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Аналитика платформы</h1>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {exporting ? 'Экспорт...' : '↓ Экспорт CSV'}
          </button>
        </div>

        {/* Global metrics */}
        {data && (
          <div className="grid grid-cols-3 gap-4">
            <MetricCard label="Активных групп" value={data.metrics.totalActiveCohorts} color="blue" />
            <MetricCard label="Студентов" value={data.metrics.totalStudents} color="green" />
            <MetricCard label="Преподавателей" value={data.metrics.totalTeachers} color="purple" />
          </div>
        )}

        {/* Cohorts table */}
        {data && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">Группы</h2>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Группа</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-slate-400">Студентов</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-slate-400">Средний балл (тесты)</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-slate-400">% карточек с 1-й попытки</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-slate-400">Дата начала</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cohorts.map((row) => (
                    <>
                      <tr
                        key={row.cohort.id}
                        onClick={() => handleExpandCohort(row.cohort.id)}
                        className="border-b border-gray-100 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">
                          <span className="mr-2 text-gray-400 dark:text-slate-500">{expanded === row.cohort.id ? '▾' : '▸'}</span>
                          {row.cohort.name}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600 dark:text-slate-400">{row.studentCount}</td>
                        <td className="px-3 py-3 text-center">
                          {row.avgTestScore != null ? (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${row.avgTestScore >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : row.avgTestScore >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                              {row.avgTestScore.toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.firstAttemptPct != null ? (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${row.firstAttemptPct >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : row.firstAttemptPct >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                              {row.firstAttemptPct}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-500 dark:text-slate-400 text-xs">
                          {new Date(row.cohort.started_at).toLocaleDateString('ru-RU')}
                        </td>
                      </tr>

                      {/* Expanded student detail */}
                      {expanded === row.cohort.id && (
                        <tr key={`${row.cohort.id}-detail`} className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                          <td colSpan={5} className="px-8 py-4">
                            {loadingCohort === row.cohort.id ? (
                              <p className="text-gray-400 dark:text-slate-500 text-sm">Загрузка...</p>
                            ) : studentDetails[row.cohort.id] ? (
                              <StudentDetailTable rows={studentDetails[row.cohort.id].submissions as any} />
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>

              {data.cohorts.length === 0 && (
                <div className="text-center text-gray-400 dark:text-slate-500 py-8">Нет активных групп</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'green' | 'purple' }) {
  const colors = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    green:  'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-700 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-400',
  };
  return (
    <div className={`border rounded-xl p-5 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  );
}

function StudentDetailTable({ rows }: { rows: Array<{ student: { id: string; callsign: string }; average: number | null; cardStats: any }> }) {
  if (!rows || rows.length === 0) return <p className="text-gray-400 dark:text-slate-500 text-sm">Нет студентов</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-gray-500 dark:text-slate-400 text-xs">
          <th className="text-left py-1 pr-4">Студент</th>
          <th className="text-center py-1 pr-4">Средний балл</th>
          <th className="text-center py-1 pr-4">Попыток карточек</th>
          <th className="text-center py-1">% с 1-й попытки</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r: any) => (
          <tr key={r.student.id} className="border-t border-gray-100 dark:border-slate-700">
            <td className="py-1.5 pr-4 text-gray-800 dark:text-slate-100">{r.student.callsign}</td>
            <td className="py-1.5 pr-4 text-center">
              {r.average != null ? (
                <span className={`text-xs px-2 py-0.5 rounded ${r.average >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : r.average >= 50 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                  {r.average.toFixed(0)}%
                </span>
              ) : '—'}
            </td>
            <td className="py-1.5 pr-4 text-center text-gray-500 dark:text-slate-400">{r.cardStats?.totalAttempts ?? 0}</td>
            <td className="py-1.5 text-center text-gray-500 dark:text-slate-400">{r.cardStats?.firstAttemptPct != null ? `${r.cardStats.firstAttemptPct}%` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
