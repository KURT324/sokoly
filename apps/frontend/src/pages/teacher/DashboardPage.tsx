import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { useAuthStore } from '../../store/authStore';

export function TeacherDashboardPage() {
  const user = useAuthStore((s) => s.user);

  const quickLinks = [
    { to: '/teacher/days',      title: 'Учебные дни',  desc: 'Добавить и открыть дни курса',         icon: <IconCalendar /> },
    { to: '/teacher/tests',     title: 'Тесты',        desc: 'Создать тест и посмотреть результаты', icon: <IconClipboard /> },
    { to: '/teacher/cards',     title: 'Карточки',     desc: 'Назначить и проверить аннотации',      icon: <IconCard /> },
    { to: '/teacher/analytics', title: 'Аналитика',    desc: 'Успеваемость группы',                  icon: <IconChart /> },
  ];

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#111827] dark:text-slate-100">
            Добро пожаловать, {user?.callsign}
          </h1>
          <p className="text-[#6b7280] dark:text-slate-400 text-sm mt-1">Панель инструктора</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="card px-5 py-4 flex items-center gap-4 hover:border-indigo-200 hover:shadow-sm transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-slate-700 text-[#6b7280] dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center justify-center transition-colors shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#111827] dark:text-slate-100">{item.title}</p>
                <p className="text-xs text-[#6b7280] dark:text-slate-400 mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
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
function IconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
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
