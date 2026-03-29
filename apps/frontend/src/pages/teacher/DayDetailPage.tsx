import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { daysApi, DayRecord, MaterialRecord } from '../../api/days';
import { MaterialType } from '@eduplatform/shared';
import { Layout } from '../../components/Layout';

const TYPE_ICONS: Record<MaterialType, string> = {
  [MaterialType.PDF]: '📄',
  [MaterialType.DOC]: '📝',
  [MaterialType.IMAGE]: '🖼️',
  [MaterialType.LINK]: '🔗',
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function TeacherDayDetailPage() {
  const { dayId } = useParams<{ dayId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [day, setDay] = useState<DayRecord | null>(null);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    if (!dayId) return;
    daysApi.getDay(dayId).then((r) => {
      setDay(r.data);
      setMaterials(r.data.materials ?? []);
    });
  };

  useEffect(() => { load(); }, [dayId]);

  const handleFileUpload = async (file: File) => {
    if (!dayId) return;
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return setError('Неподдерживаемый формат. Разрешены: PDF, DOC, DOCX, JPG, PNG, WEBP');
    }
    if (file.size > 50 * 1024 * 1024) {
      return setError('Файл слишком большой. Максимум 50 МБ');
    }
    setError('');
    setUploading(true);
    setProgress(0);
    try {
      await daysApi.uploadMaterial(dayId, file, file.name, setProgress);
      load();
    } catch {
      setError('Ошибка загрузки файла');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleAddLink = async () => {
    if (!dayId || !linkUrl || !linkTitle) return;
    await daysApi.addLink(dayId, linkUrl, linkTitle);
    setLinkUrl('');
    setLinkTitle('');
    setShowLinkForm(false);
    load();
  };

  const handleDelete = async (matId: string, title: string) => {
    if (!dayId || !confirm(`Удалить "${title}"?`)) return;
    await daysApi.deleteMaterial(dayId, matId);
    load();
  };

  if (!day) return (
    <Layout>
      <div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/teacher/days')} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
          ← Назад к дням
        </button>

        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">День {day.day_number}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            day.status === 'OPEN' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
          }`}>
            {day.status === 'OPEN' ? 'Открыт' : day.status === 'LOCKED' ? 'Закрыт' : 'Архив'}
          </span>
          {day.cohort && <span className="text-sm text-gray-500 dark:text-slate-400">{day.cohort.name}</span>}
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-colors ${
            dragging ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-slate-600 hover:border-gray-400'
          }`}
        >
          {uploading ? (
            <div>
              <div className="text-sm text-gray-600 dark:text-slate-400 mb-3">Загрузка... {progress}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">📁</div>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">Перетащите файл или нажмите для выбора</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">PDF, DOCX, JPG, PNG, WEBP — до 50 МБ</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Выбрать файл
                </button>
                <button
                  onClick={() => setShowLinkForm(true)}
                  className="border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  + Добавить ссылку
                </button>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Link form */}
        {showLinkForm && (
          <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-200">Добавить ссылку</h3>
            <input
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Описание ссылки"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={handleAddLink} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors">
                Добавить
              </button>
              <button onClick={() => setShowLinkForm(false)} className="border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Materials list */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-200">Материалы ({materials.length})</h2>
          </div>
          {materials.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 dark:text-slate-500 text-sm">Материалы не загружены</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {materials.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{TYPE_ICONS[m.type]}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{m.title}</div>
                      {m.size_bytes && (
                        <div className="text-xs text-gray-400 dark:text-slate-500">{formatBytes(m.size_bytes)}</div>
                      )}
                      {m.url && (
                        <div className="text-xs text-gray-400 dark:text-slate-500 truncate">{m.url}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(m.id, m.title)}
                    className="text-xs text-red-500 hover:text-red-700 ml-4 shrink-0"
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
