import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { studentsApi, StudentsRoster } from '../../api/students';
import type { StudentRow } from '../../api/students';
import { adminApi, CohortRecord } from '../../api/admin';
import { Layout } from '../../components/Layout';

function formatLastLogin(dateStr: string | null): string {
  if (!dateStr) return 'Никогда';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} д назад`;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function StatBadge({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? value / total : 0;
  const color =
    pct === 1 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
    pct >= 0.5 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
    pct > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
    'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400';
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {value} из {total} {label}
    </span>
  );
}

export function TeacherStudentsPage() {
  const user = useAuthStore((s) => s.user);
  const teacherCohortId = user?.cohort_id ?? null;

  const [cohorts, setCohorts] = useState<CohortRecord[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [roster, setRoster] = useState<StudentsRoster | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // For admin / teacher without cohort_id — load cohort list
  useEffect(() => {
    if (!teacherCohortId) {
      adminApi.getCohorts().then((r) => {
        setCohorts(r.data);
        if (r.data.length > 0) setSelectedCohortId(r.data[0].id);
      });
    } else {
      setSelectedCohortId(teacherCohortId);
    }
  }, [teacherCohortId]);

  useEffect(() => {
    if (!selectedCohortId) return;
    setLoading(true);
    studentsApi
      .getRoster(selectedCohortId)
      .then((r) => setRoster(r.data))
      .finally(() => setLoading(false));
  }, [selectedCohortId]);

  const filtered = (roster?.students ?? []).filter(
    (s) =>
      !search ||
      s.callsign.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Курсанты</h1>
            {roster && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{roster.cohort.name}</p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Cohort selector for admin / teacher without assigned cohort */}
            {!teacherCohortId && cohorts.length > 0 && (
              <select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <input
              type="text"
              placeholder="Поиск по позывному..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>
        </div>

        {/* Summary cards */}
        {roster && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Курсантов</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{roster.students.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Дней открыто</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {roster.openDays}
                <span className="text-sm font-normal text-gray-400 dark:text-slate-500 ml-1">из {roster.totalDays}</span>
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Тестов в группе</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{roster.totalTests}</p>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center text-gray-400 dark:text-slate-500 py-16">Загрузка...</div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-slate-500 py-16 text-sm">
                {roster?.students.length === 0 ? 'В группе нет курсантов' : 'Нет совпадений'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Позывной</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Последний вход</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Прогресс дней</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Тесты</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Карточки</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {filtered.map((s) => (
                    <StudentRow key={s.id} student={s} roster={roster!} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function StudentRow({ student, roster }: { student: StudentRow; roster: StudentsRoster }) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 dark:text-slate-100">{student.callsign}</div>
        <div className="text-xs text-gray-400 dark:text-slate-500">{student.email}</div>
      </td>
      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-sm">
        {formatLastLogin(student.last_login_at)}
      </td>
      <td className="px-4 py-3">
        <StatBadge value={roster.openDays} total={roster.totalDays} label="дней" />
      </td>
      <td className="px-4 py-3">
        {roster.totalTests > 0
          ? <StatBadge value={student.testsSubmitted} total={roster.totalTests} label="тестов" />
          : <span className="text-xs text-gray-400 dark:text-slate-500">—</span>
        }
      </td>
      <td className="px-4 py-3">
        {student.cardsTotal > 0
          ? <StatBadge value={student.cardsCompleted} total={student.cardsTotal} label="карточек" />
          : <span className="text-xs text-gray-400 dark:text-slate-500">—</span>
        }
      </td>
    </tr>
  );
}
