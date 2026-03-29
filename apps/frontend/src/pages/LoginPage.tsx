import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@eduplatform/shared';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { LogoMark } from '../components/Layout';

const ROLE_DASHBOARDS: Record<UserRole, string> = {
  [UserRole.ADMIN]:   '/admin/dashboard',
  [UserRole.TEACHER]: '/teacher/dashboard',
  [UserRole.STUDENT]: '/student/dashboard',
};

export function LoginPage() {
  const navigate  = useNavigate();
  const setUser   = useAuthStore((s) => s.setUser);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await authApi.login(email, password);
      const user = res.data;
      setUser(user);
      if (user.must_change_password) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(ROLE_DASHBOARDS[user.role], { replace: true });
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Неверный email или пароль';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <LogoMark size={44} />
          </div>
          <h1 className="text-xl font-semibold text-[#111827] dark:text-slate-100 tracking-tight">Соколы Хоруса</h1>
          <p className="text-sm text-[#6b7280] dark:text-slate-400 mt-1">Войдите в свой аккаунт</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 rounded-lg px-4 py-3 text-sm">
                <svg className="shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Вход...
                </span>
              ) : 'Войти'}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
}
