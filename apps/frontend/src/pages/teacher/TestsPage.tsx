import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { testsApi, Test } from '../../api/tests';

export function TeacherTestsPage() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testsApi.getTests().then((r) => setTests(r.data)).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить тест "${title}"?`)) return;
    await testsApi.deleteTest(id);
    setTests((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Тесты</h1>
          <button
            onClick={() => navigate('/teacher/tests/create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Создать тест
          </button>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div>
        ) : tests.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-slate-500 py-12">Тестов пока нет</div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Название</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Группа</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">День</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Прошли</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Действия</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => (
                  <tr key={test.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">{test.title}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{test.cohort?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                      {test.day ? `День ${test.day.day_number}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{test._count?.submissions ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/teacher/tests/${test.id}/results`}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 text-xs font-medium"
                        >
                          Результаты
                        </Link>
                        <button
                          onClick={() => handleDelete(test.id, test.title)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
