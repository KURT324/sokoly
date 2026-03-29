import { useEffect, useState } from 'react';
import { adminApi, UserRecord, CohortRecord } from '../../api/admin';
import { UserRole } from '@eduplatform/shared';
import { Layout } from '../../components/Layout';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Администратор',
  [UserRole.TEACHER]: 'Преподаватель',
  [UserRole.STUDENT]: 'Студент',
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [cohorts, setCohorts] = useState<CohortRecord[]>([]);
  const [filterRole, setFilterRole] = useState('');
  const [filterCohort, setFilterCohort] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    const params: Record<string, string> = {};
    if (filterRole) params.role = filterRole;
    if (filterCohort) params.cohort_id = filterCohort;
    adminApi.getUsers(params).then((res) => {
      setUsers(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    adminApi.getCohorts().then((res) => setCohorts(res.data));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [filterRole, filterCohort]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить пользователя ${name}?`)) return;
    await adminApi.deleteUser(id);
    fetchUsers();
  };

  const handleToggleActive = async (user: UserRecord) => {
    await adminApi.updateUser(user.id, { is_active: !user.is_active });
    fetchUsers();
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Пользователи</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Добавить
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все роли</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            value={filterCohort}
            onChange={(e) => setFilterCohort(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все группы</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-slate-500">Загрузка...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Позывной</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Роль</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Группа</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Статус</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Создан</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{u.callsign}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === UserRole.ADMIN ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                        u.role === UserRole.TEACHER ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                        'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{u.cohort?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                          u.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {u.is_active ? 'Активен' : 'Заблокирован'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                      {new Date(u.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(u.id, u.callsign)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                      Пользователи не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <CreateUserModal
          cohorts={cohorts}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchUsers(); }}
        />
      )}
    </Layout>
  );
}

function CreateUserModal({
  cohorts,
  onClose,
  onCreated,
}: {
  cohorts: CohortRecord[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    callsign: '',
    email: '',
    role: UserRole.STUDENT as UserRole,
    cohort_id: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminApi.createUser({
        ...form,
        cohort_id: form.role === UserRole.STUDENT ? form.cohort_id : undefined,
      });
      onCreated();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message || 'Ошибка создания';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">Новый пользователь</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Позывной">
            <input
              required
              value={form.callsign}
              onChange={(e) => setForm({ ...form, callsign: e.target.value })}
              className={inputCls}
              placeholder="Позывной пользователя"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
              placeholder="user@edu.local"
            />
          </Field>

          <Field label="Роль">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className={inputCls}
            >
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>

          {form.role === UserRole.STUDENT && (
            <Field label="Группа">
              <select
                required
                value={form.cohort_id}
                onChange={(e) => setForm({ ...form, cohort_id: e.target.value })}
                className={inputCls}
              >
                <option value="">Выберите группу</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Пароль">
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputCls}
              placeholder="Временный пароль"
            />
          </Field>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">{label}</label>
      {children}
    </div>
  );
}
