import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { daysApi, DayRecord } from '../../api/days';
import { testsApi, Test } from '../../api/tests';
import { DayStatus } from '@eduplatform/shared';
import { Layout } from '../../components/Layout';

export function StudentDashboardPage() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [days,    setDays]    = useState<DayRecord[]>([]);
  const [tests,   setTests]   = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([daysApi.getDays(), testsApi.getTests()])
      .then(([daysR, testsR]) => { setDays(daysR.data); setTests(testsR.data); })
      .finally(() => setLoading(false));
  }, []);

  const openDays   = days.filter((d) => d.status === DayStatus.OPEN);
  const lockedDays = days.filter((d) => d.status !== DayStatus.OPEN);

  return (
    <Layout>
      <div className="max-w-3xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[#111827] dark:text-slate-100">
            Добро пожаловать, {user?.callsign}
          </h1>
          <p className="text-[#6b7280] dark:text-slate-400 text-sm mt-1">Учебный курс</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#6b7280] dark:text-slate-400 text-sm">
            <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Загрузка...
          </div>
        ) : (
          <>
            {/* Days */}
            <div className="card overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#111827] dark:text-slate-100">Учебные дни</h2>
                <span className="text-xs text-[#6b7280] dark:text-slate-400">{openDays.length} из {days.length} открыто</span>
              </div>

              {days.length === 0 ? (
                <EmptyState
                  icon={<IconCalendar />}
                  title="Дни ещё не открыты"
                  desc="Инструктор откроет учебные дни по расписанию"
                />
              ) : (
                <div className="p-4 md:p-6 grid grid-cols-5 sm:grid-cols-6 gap-2 md:gap-2.5">
                  {days.map((day) => (
                    <DayCell
                      key={day.id}
                      day={day}
                      onClick={() => day.status === DayStatus.OPEN && navigate(`/student/days/${day.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Tests */}
            {tests.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 md:px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-[#111827] dark:text-slate-100">Тесты</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {tests.map((test) => (
                    <TestRow
                      key={test.id}
                      test={test}
                      onClick={() => navigate(`/student/tests/${test.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {tests.length === 0 && lockedDays.length === 0 && days.length === 0 && (
              <EmptyState
                icon={<IconBook />}
                title="Нет доступных материалов"
                desc="Материалы появятся, когда инструктор их откроет"
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayCell({ day, onClick }: { day: DayRecord; onClick: () => void }) {
  const isOpen = day.status === DayStatus.OPEN;
  return (
    <button
      onClick={onClick}
      disabled={!isOpen}
      title={isOpen ? `День ${day.day_number}` : `День ${day.day_number} — закрыт`}
      className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-center transition-all text-sm font-medium ${
        isOpen
          ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm cursor-pointer'
          : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
      }`}
    >
      <span className="text-base font-semibold leading-none">{day.day_number}</span>
      <span className="text-[10px] leading-none opacity-80">{isOpen ? 'открыт' : 'закрыт'}</span>
    </button>
  );
}

function TestRow({ test, onClick }: { test: Test; onClick: () => void }) {
  const submission = test.submissions?.[0];

  const getStatus = () => {
    if (!submission)                                         return { label: 'Не пройден',  cls: 'badge-gray'   };
    if (submission.manual_score != null || submission.auto_score != null)
                                                             return { label: 'Пройден',      cls: 'badge-green'  };
    return                                                          { label: 'На проверке', cls: 'badge-yellow' };
  };

  const { label, cls } = getStatus();
  const canTake = !submission;

  return (
    <button
      onClick={canTake ? onClick : undefined}
      disabled={!canTake}
      className={`w-full text-left px-4 md:px-6 py-4 flex items-center justify-between transition-colors ${
        canTake ? 'hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 text-[#6b7280] dark:text-slate-400 flex items-center justify-center shrink-0">
          <IconClipboard />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#111827] dark:text-slate-100 truncate">{test.title}</p>
          {test.time_limit_min && (
            <p className="text-xs text-[#6b7280] dark:text-slate-400 mt-0.5">{test.time_limit_min} мин</p>
          )}
        </div>
      </div>
      <span className={cls}>{label}</span>
    </button>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm font-medium text-[#374151]">{title}</p>
      <p className="text-xs text-[#6b7280] dark:text-slate-400 mt-1 max-w-[220px]">{desc}</p>
    </div>
  );
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
    </svg>
  );
}
