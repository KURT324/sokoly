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
  // Inline viewer for PDF / DOC / VIDEO
  const [selected, setSelected] = useState<MaterialRecord | null>(null);
  // ProtectedViewer for IMAGE (watermark)
  const [imageViewer, setImageViewer] = useState<{ url: string; title: string } | null>(null);
  // Cache of converted docx HTML keyed by storage_path
  const [docHtmlCache, setDocHtmlCache] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!dayId) return;
    daysApi.getDay(dayId)
      .then((r) => {
        setDay(r.data);
        setMaterials(r.data.materials ?? []);
      })
      .catch(() => navigate('/student/dashboard', { replace: true }));
  }, [dayId]);

  const isLocked = day !== null && day.status !== 'OPEN';

  const handleOpen = async (material: MaterialRecord) => {
    if (material.type === MaterialType.LINK) {
      const viewUrl = daysApi.getMaterialViewUrl(dayId!, material.id);
      const res = await client.get<{ url: string }>(viewUrl);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (material.type === MaterialType.IMAGE) {
      const viewUrl = daysApi.getMaterialViewUrl(dayId!, material.id);
      setImageViewer({ url: viewUrl, title: material.title });
      setSelected(null);
      return;
    }

    // PDF / DOC / VIDEO — toggle inline viewer
    setSelected((prev) => (prev?.id === material.id ? null : material));
    setImageViewer(null);

    // Preload docx HTML if not cached
    if (material.type === MaterialType.DOC && material.storage_path && !docHtmlCache[material.storage_path]) {
      fetch(`/api/materials/file/${material.storage_path}/html`)
        .then((r) => r.text())
        .then((html) => setDocHtmlCache((prev) => ({ ...prev, [material.storage_path!]: html })))
        .catch(() => {});
    }
  };

  if (!day) return (
    <Layout>
      <div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/student/dashboard')}
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 mb-3 inline-flex items-center gap-1 py-1"
        >
          ← Назад
        </button>

        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4 md:mb-6">
          День {day.day_number}
        </h1>

        {isLocked ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
            <div className="text-3xl mb-3">🔒</div>
            <p className="text-amber-800 dark:text-amber-300 font-medium">Материалы будут доступны когда инструктор откроет день</p>
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-700 rounded-xl p-8 text-center text-gray-400 dark:text-slate-500">
            Материалы ещё не загружены
          </div>
        ) : (
          <div className="space-y-3">
            {materials.map((m) => {
              const isOpen = selected?.id === m.id;
              return (
                <div key={m.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  {/* Material row */}
                  <button
                    onClick={() => handleOpen(m)}
                    className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${
                      isOpen
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-2xl shrink-0">{TYPE_ICONS[m.type]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-800 dark:text-slate-100 truncate">{m.title}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-500">{TYPE_LABELS[m.type]}</div>
                    </div>
                    {m.type !== MaterialType.LINK && m.type !== MaterialType.IMAGE && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">
                        {isOpen ? 'Свернуть ↑' : 'Открыть ↓'}
                      </span>
                    )}
                    {(m.type === MaterialType.LINK || m.type === MaterialType.IMAGE) && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">Открыть →</span>
                    )}
                  </button>

                  {/* Inline viewer */}
                  {isOpen && m.storage_path && (
                    <div className="bg-gray-50 dark:bg-slate-900/50">
                      {m.type === MaterialType.PDF && (
                        <iframe
                          src={`/api/materials/view/${m.id}`}
                          title={m.title}
                          className="w-full border-0"
                          style={{ height: '90svh', minHeight: '500px' }}
                        />
                      )}

                      {m.type === MaterialType.DOC && (
                        <div className="p-4 md:p-6 overflow-auto" style={{ maxHeight: '80vh', overflowX: 'hidden', maxWidth: '100%', wordBreak: 'break-word' }}>
                          <style>{`
                            .docx-content img { max-width: 100% !important; height: auto !important; }
                            .docx-content table { max-width: 100% !important; overflow-x: auto; display: block; }
                          `}</style>
                          {docHtmlCache[m.storage_path] ? (
                            <div
                              className="docx-content prose prose-sm dark:prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: docHtmlCache[m.storage_path] }}
                            />
                          ) : (
                            <div className="text-center text-gray-400 dark:text-slate-500 py-8">Загрузка документа...</div>
                          )}
                        </div>
                      )}

                      {m.type === MaterialType.VIDEO && (
                        <div className="p-4">
                          <video
                            src={`/api/materials/view/${m.id}`}
                            controls
                            controlsList="nodownload"
                            disablePictureInPicture
                            onContextMenu={(e) => e.preventDefault()}
                            className="w-full rounded-lg"
                            style={{ maxHeight: '70vh' }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ProtectedViewer used only for watermarked images */}
      {imageViewer && (
        <ProtectedViewer
          url={imageViewer.url}
          type="IMAGE"
          title={imageViewer.title}
          onClose={() => setImageViewer(null)}
        />
      )}
    </Layout>
  );
}
