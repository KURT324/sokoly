import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@eduplatform/shared';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { LogoMark } from '../components/Layout';

const ROLE_DASHBOARDS: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/admin/dashboard',
  [UserRole.TEACHER]: '/teacher/dashboard',
  [UserRole.STUDENT]: '/student/dashboard',
};

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      return setError('Пароль должен содержать не менее 8 символов');
    }
    if (!/\d/.test(newPassword)) {
      return setError('Пароль должен содержать хотя бы одну цифру');
    }
    if (newPassword !== confirm) {
      return setError('Пароли не совпадают');
    }

    setLoading(true);
    try {
      await authApi.changePassword(newPassword);
      if (user) {
        setUser({ ...user, must_change_password: false });
        navigate(ROLE_DASHBOARDS[user.role], { replace: true });
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Ошибка смены пароля';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">

        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <LogoMark size={44} />
          </div>
          <h1 className="text-xl font-semibold text-[#111827] dark:text-slate-100 tracking-tight">Смена пароля</h1>
          <p className="text-sm text-[#6b7280] dark:text-slate-400 mt-1">Установите новый пароль для входа</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm p-8">
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-lg px-4 py-3 text-sm mb-6">
            <svg className="shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Для продолжения необходимо сменить временный пароль
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="newPassword">Новый пароль</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                className="input"
                placeholder="Минимум 8 символов, одна цифра"
              />
            </div>

            <div>
              <label className="label" htmlFor="confirm">Подтверждение пароля</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="input"
                placeholder="Повторите пароль"
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
              {loading ? 'Сохранение...' : 'Сменить пароль'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
