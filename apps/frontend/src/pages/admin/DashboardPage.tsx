import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { UserRole } from '@eduplatform/shared';
import { Layout } from '../../components/Layout';

export function AdminDashboardPage() {
  const [stats, setStats] = useState({ cohorts: 0, teachers: 0, students: 0 });

  useEffect(() => {
    Promise.all([
      adminApi.getCohorts(),
      adminApi.getUsers({ role: UserRole.TEACHER }),
      adminApi.getUsers({ role: UserRole.STUDENT }),
    ]).then(([cohorts, teachers, students]) => {
      setStats({
        cohorts:  cohorts.data.filter((c) => c.is_active).length,
        teachers: teachers.data.filter((u) => u.is_active).length,
        students: students.data.filter((u) => u.is_active).length,
      });
    });
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#111827] dark:text-slate-100">Дашборд</h1>
          <p className="text-[#6b7280] dark:text-slate-400 text-sm mt-1">Общая статистика платформы</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Активных групп"
            value={stats.cohorts}
            icon={<IconLayers />}
            color="indigo"
          />
          <StatCard
            label="Преподавателей"
            value={stats.teachers}
            icon={<IconUsers />}
            color="emerald"
          />
          <StatCard
            label="Студентов"
            value={stats.students}
            icon={<IconGraduation />}
            color="amber"
          />
        </div>

        {/* Quick links */}
        <div>
          <p className="text-xs font-medium text-[#6b7280] dark:text-slate-500 uppercase tracking-wider mb-3">Быстрый доступ</p>
          <div className="grid grid-cols-2 gap-3">
            <QuickLink to="/admin/users"    title="Пользователи"  desc="Учётные записи студентов и преподавателей" icon={<IconUsers />} />
            <QuickLink to="/admin/cohorts"  title="Группы"        desc="Управление учебными группами"              icon={<IconLayers />} />
            <QuickLink to="/admin/analytics" title="Аналитика"    desc="Успеваемость и активность студентов"       icon={<IconChart />} />
            <QuickLink to="/teacher/days"   title="Учебные дни"   desc="Контент и материалы курса"                 icon={<IconCalendar />} />
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type Color = 'indigo' | 'emerald' | 'amber' | 'rose';

const colorMap: Record<Color, { bg: string; text: string; icon: string }> = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  icon: 'text-indigo-500'  },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   icon: 'text-amber-500'   },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    icon: 'text-rose-500'    },
};

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: Color }) {
  const c = colorMap[color];
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-semibold text-[#111827] dark:text-slate-100">{value}</p>
          <p className="text-sm text-[#6b7280] dark:text-slate-400 mt-1">{label}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.icon} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, title, desc, icon }: { to: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <Link to={to} className="card px-5 py-4 flex items-center gap-4 hover:border-indigo-200 hover:shadow-sm transition-all group">
      <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-slate-700 text-[#6b7280] dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-center transition-colors shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#111827] dark:text-slate-100">{title}</p>
        <p className="text-xs text-[#6b7280] dark:text-slate-400 mt-0.5 truncate">{desc}</p>
      </div>
    </Link>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  );
}
function IconGraduation() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
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
