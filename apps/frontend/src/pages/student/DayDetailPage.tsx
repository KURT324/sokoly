import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { daysApi, DayRecord, MaterialRecord } from '../../api/days';
import { MaterialType } from '@eduplatform/shared';
import { Layout } from '../../components/Layout';
import { ProtectedViewer } from '../../components/ProtectedViewer';
import client from '../../api/client';

const TYPE_ICONS: Record<MaterialType, string> = {
  [MaterialType.PDF]: '📄',
  [MaterialType.DOC]: '📝',
  [MaterialType.IMAGE]: '🖼️',
  [MaterialType.LINK]: '🔗',
  [MaterialType.VIDEO]: '🎬',
};

const TYPE_LABELS: Record<MaterialType, string> = {
  [MaterialType.PDF]: 'PDF',
  [MaterialType.DOC]: 'Документ',
  [MaterialType.IMAGE]: 'Изображение',
  [MaterialType.LINK]: 'Ссылка',
  [MaterialType.VIDEO]: 'Видео',
};

export function StudentDayDetailPage() {
  const { dayId } = useParams<{ dayId: string }>();
  const navigate = useNavigate();
  const [day, setDay] = useState<DayRecord | null>(null);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [viewer, setViewer] = useState<{ url: string; type: MaterialType; title: string } | null>(null);

  useEffect(() => {
    if (!dayId) return;
    daysApi.getDay(dayId)
      .then((r) => {
        setDay(r.data);
        setMaterials(r.data.materials ?? []);
      })
      .catch(() => navigate('/student/dashboard', { replace: true }));
  }, [dayId]);

  const handleOpen = async (material: MaterialRecord) => {
    const viewUrl = daysApi.getMaterialViewUrl(dayId!, material.id);

    if (material.type === MaterialType.LINK) {
      const res = await client.get<{ url: string }>(viewUrl);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
      return;
    }

    setViewer({ url: viewUrl, type: material.type, title: material.title });
  };

  if (!day) return (
    <Layout>
      <div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/student/dashboard')} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
          ← Назад
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">День {day.day_number}</h1>

        {materials.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-700 rounded-xl p-8 text-center text-gray-400 dark:text-slate-500">
            Материалы ещё не загружены
          </div>
        ) : (
          <div className="space-y-2">
            {materials.map((m) => (
              <button
                key={m.id}
                onClick={() => handleOpen(m)}
                className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-blue-300 hover:shadow-sm rounded-xl px-4 py-3 text-left transition-all"
              >
                <span className="text-2xl shrink-0">{TYPE_ICONS[m.type]}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-800 dark:text-slate-100 truncate">{m.title}</div>
                  <div className="text-xs text-gray-400 dark:text-slate-500">{TYPE_LABELS[m.type]}</div>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">Открыть →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {viewer && (
        <ProtectedViewer
          url={viewer.url}
          type={viewer.type as 'IMAGE' | 'PDF' | 'LINK' | 'DOC' | 'VIDEO'}
          title={viewer.title}
          onClose={() => setViewer(null)}
        />
      )}
    </Layout>
  );
}
