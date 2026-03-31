import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { daysApi, DayRecord } from '../../api/days';
import { adminApi, CohortRecord } from '../../api/admin';
import { DayStatus } from '@eduplatform/shared';
import { Layout } from '../../components/Layout';

const STATUS_STYLES: Record<DayStatus, string> = {
  [DayStatus.LOCKED]: 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400',
  [DayStatus.OPEN]: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  [DayStatus.ARCHIVED]: 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500',
};

const STATUS_LABELS: Record<DayStatus, string> = {
  [DayStatus.LOCKED]: 'Закрыт',
  [DayStatus.OPEN]: 'Открыт',
  [DayStatus.ARCHIVED]: 'Архив',
};

export function TeacherDaysPage() {
  const user = useAuthStore((s) => s.user);
  const [days, setDays] = useState<DayRecord[]>([]);
  const [cohorts, setCohorts] = useState<CohortRecord[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin) {
      adminApi.getCohorts().then((r) => {
        setCohorts(r.data);
        if (r.data.length > 0) setSelectedCohort(r.data[0].id);
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    daysApi.getDays(isAdmin ? selectedCohort || undefined : undefined)
      .then((r) => setDays(r.data))
      .finally(() => setLoading(false));
  }, [selectedCohort, isAdmin]);

  const handleOpen = async (day: DayRecord) => {
    if (!confirm(`Открыть День ${day.day_number}? Курсанты сразу получат доступ к материалам.`)) return;
    await daysApi.openDay(day.id);
    setDays((prev) => prev.map((d) => d.id === day.id ? { ...d, status: DayStatus.OPEN } : d));
  };

  const grouped = days.reduce<Record<string, DayRecord[]>>((acc, d) => {
    const key = d.cohort?.name ?? d.cohort_id;
    (acc[key] = acc[key] || []).push(d);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Учебные дни</h1>
          {isAdmin && cohorts.length > 0 && (
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Все группы</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div>
        ) : (
          Object.entries(grouped).map(([groupName, groupDays]) => (
            <div key={groupName} className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">{groupName}</h2>
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {groupDays.map((day, idx) => (
                  <div
                    key={day.id}
                    className={`flex items-center justify-between px-4 py-3 ${idx < groupDays.length - 1 ? 'border-b border-gray-100 dark:border-slate-700' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold text-gray-700 dark:text-slate-200 w-8">#{day.day_number}</span>
                      <span className="text-gray-600 dark:text-slate-400 text-sm">День {day.day_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[day.status]}`}>
                        {STATUS_LABELS[day.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {day.status === DayStatus.LOCKED && (
                        <button
                          onClick={() => handleOpen(day)}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          Открыть день
                        </button>
                      )}
                      <Link
                        to={`/teacher/days/${day.id}`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:bg-blue-900/20 transition-colors"
                      >
                        Материалы →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
