import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { UserRole } from '@eduplatform/shared';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';
import { useChatStore } from '../store/chatStore';
import { chatsApi } from '../api/chats';
import { useTheme } from '../hooks/useTheme';

// ─── Logo ────────────────────────────────────────────────────────────────────

function FallbackIcon({ size }: { size: number }) {
  return (
    <div
      className="bg-indigo-500 rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    </div>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  const [hasCustom, setHasCustom] = useState<boolean | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHasCustom(true);
    img.onerror = () => setHasCustom(false);
    img.src = '/logo.png';
  }, []);
  if (hasCustom === null) return <div style={{ width: size, height: size }} className="shrink-0" />;
  if (hasCustom) return <img src="/logo.png" alt="logo" style={{ width: size, height: size }} className="rounded-lg object-contain shrink-0" />;
  return <FallbackIcon size={size} />;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  );
}
function IconMessage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function IconHash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  );
}
function IconLogOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconSun() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1"  x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
    >
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

// ─── Nav config ──────────────────────────────────────────────────────────────

interface NavItem { label: string; to: string; icon: React.ReactNode; chatType?: string }

const MAIN_NAV: Record<UserRole, NavItem[]> = {
  [UserRole.ADMIN]: [
    { label: 'Дашборд',      to: '/admin/dashboard',   icon: <IconDashboard /> },
    { label: 'Пользователи', to: '/admin/users',        icon: <IconUsers /> },
    { label: 'Группы',       to: '/admin/cohorts',      icon: <IconLayers /> },
    { label: 'Учебные дни',  to: '/teacher/days',       icon: <IconCalendar /> },
    { label: 'Тесты',        to: '/teacher/tests',      icon: <IconClipboard /> },
    { label: 'Карточки',     to: '/teacher/cards',      icon: <IconCard /> },
    { label: 'Аналитика',    to: '/admin/analytics',    icon: <IconChart /> },
  ],
  [UserRole.TEACHER]: [
    { label: 'Дашборд',     to: '/teacher/dashboard',  icon: <IconDashboard /> },
    { label: 'Учебные дни', to: '/teacher/days',        icon: <IconCalendar /> },
    { label: 'Тесты',       to: '/teacher/tests',       icon: <IconClipboard /> },
    { label: 'Карточки',    to: '/teacher/cards',       icon: <IconCard /> },
    { label: 'Аналитика',   to: '/teacher/analytics',   icon: <IconChart /> },
  ],
  [UserRole.STUDENT]: [
    { label: 'Дашборд',       to: '/student/dashboard', icon: <IconDashboard /> },
    { label: 'Мои материалы', to: '/student/dashboard', icon: <IconBook /> },
    { label: 'Карточки',      to: '/student/cards',     icon: <IconCard /> },
  ],
};

const CHAT_NAV: Record<UserRole, NavItem[]> = {
  [UserRole.ADMIN]: [
    { label: 'Общий чат', to: '/chat/group',   icon: <IconHash />, chatType: 'GROUP' },
    { label: 'Курсанты',  to: '/chat/teacher', icon: <IconHash />, chatType: 'STUDENT_TEACHER' },
    { label: 'Личные',    to: '/chat/admin',   icon: <IconHash />, chatType: 'STUDENT_ADMIN' },
  ],
  [UserRole.TEACHER]: [
    { label: 'Общий чат', to: '/chat/group',   icon: <IconHash />, chatType: 'GROUP' },
    { label: 'Курсанты',  to: '/chat/teacher', icon: <IconHash />, chatType: 'STUDENT_TEACHER' },
  ],
  [UserRole.STUDENT]: [
    { label: 'Общий чат',     to: '/chat/group',   icon: <IconHash />, chatType: 'GROUP' },
    { label: 'Инструктор', to: '/chat/teacher', icon: <IconHash />, chatType: 'STUDENT_TEACHER' },
    { label: 'Администратор', to: '/chat/admin',   icon: <IconHash />, chatType: 'STUDENT_ADMIN' },
  ],
};

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]:   'Администратор',
  [UserRole.TEACHER]: 'Инструктор',
  [UserRole.STUDENT]: 'Курсант',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Layout ──────────────────────────────────────────────────────────────────

interface LayoutProps { children: React.ReactNode }

export function Layout({ children }: LayoutProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, clear } = useAuthStore();
  const { unread, setUnread } = useChatStore();
  const { isDark, toggle: toggleTheme } = useTheme();

  const [chatsOpen, setChatsOpen] = useState(() =>
    ['/chat/group', '/chat/teacher', '/chat/admin'].some(p => location.pathname.startsWith(p))
  );

  useEffect(() => {
    if (!user) return;
    chatsApi.getChats().then((r) => {
      r.data.forEach((c) => { if (c.unread > 0) setUnread(c.id, c.unread); });
    }).catch(() => {});
  }, [user?.id]);

  const handleLogout = async () => {
    await authApi.logout();
    clear();
    navigate('/login', { replace: true });
  };

  const mainNav     = user ? MAIN_NAV[user.role]  : [];
  const chatNav     = user ? CHAT_NAV[user.role]   : [];
  const totalUnread = Object.values(unread).reduce((s, v) => s + v, 0);
  const isActive    = (to: string) => location.pathname === to;

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white dark:bg-slate-800 border-r border-gray-100 dark:border-slate-700 flex flex-col z-30 select-none">

        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5">
          <LogoMark size={28} />
          <span className="font-semibold text-[15px] text-[#111827] dark:text-slate-100 tracking-tight">
            Соколы Хоруса
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto pb-4">
          <ul className="space-y-0.5">
            {mainNav.map((item) => (
              <li key={item.to + item.label}>
                <Link
                  to={item.to}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive(item.to)
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-medium'
                      : 'text-[#6b7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span className={isActive(item.to) ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500'}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Chats section */}
          {chatNav.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setChatsOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-[#6b7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-gray-400 dark:text-slate-500"><IconMessage /></span>
                  <span>Чаты</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {totalUnread > 0 && !chatsOpen && (
                    <span className="bg-indigo-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                  <span className="text-gray-400 dark:text-slate-500"><IconChevron open={chatsOpen} /></span>
                </span>
              </button>

              {chatsOpen && (
                <ul className="mt-0.5 space-y-0.5">
                  {chatNav.map((item) => (
                    <li key={item.to + item.label}>
                      <Link
                        to={item.to}
                        className={`flex items-center pl-9 pr-3 py-1.5 rounded-lg text-sm transition-colors ${
                          isActive(item.to)
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-medium'
                            : 'text-[#6b7280] dark:text-slate-400 hover:text-[#111827] dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <span className="text-gray-400 dark:text-slate-500 mr-2">{item.icon}</span>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="px-3 py-3 border-t border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
            {/* Avatar */}
            <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold">
              {user ? getInitials(user.callsign) : '?'}
            </div>
            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#111827] dark:text-slate-100 truncate leading-tight">
                {user?.callsign}
              </p>
              <p className="text-[11px] text-[#6b7280] dark:text-slate-500 leading-tight">
                {user ? ROLE_LABELS[user.role] : ''}
              </p>
            </div>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              className="text-gray-400 dark:text-slate-500 hover:text-[#111827] dark:hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 shrink-0"
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Выйти"
              className="text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
            >
              <IconLogOut />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 ml-60 min-h-screen bg-[#fafafa] dark:bg-slate-950">
        <main className="px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
