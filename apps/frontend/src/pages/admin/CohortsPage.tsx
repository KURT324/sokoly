import { useEffect, useState } from 'react';
import { adminApi, CohortRecord } from '../../api/admin';
import { Layout } from '../../components/Layout';

export function AdminCohortsPage() {
  const [cohorts, setCohorts] = useState<CohortRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCohorts = () => {
    adminApi.getCohorts().then((res) => {
      setCohorts(res.data);
      setLoading(false);
    });
  };

  useEffect(() => { fetchCohorts(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить группу "${name}"? Все студенты этой группы будут удалены.`)) return;
    await adminApi.deleteCohort(id);
    fetchCohorts();
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Группы</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Создать группу
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-slate-500">Загрузка...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Название</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Дата начала</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Студентов</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Статус</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-slate-400">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {cohorts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                      {new Date(c.started_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{c._count.users}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                      }`}>
                        {c.is_active ? 'Активна' : 'Архив'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
                {cohorts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                      Группы не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <CreateCohortModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchCohorts(); }}
        />
      )}
    </Layout>
  );
}

function CreateCohortModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [startedAt, setStartedAt] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminApi.createCohort({ name, started_at: startedAt });
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">Новая группа</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Название</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Группа №1 / Апрель 2026"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Дата начала курса</label>
            <input
              type="date"
              required
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400">
            Автоматически будут созданы 11 учебных дней и 3 чата для группы.
          </p>

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
