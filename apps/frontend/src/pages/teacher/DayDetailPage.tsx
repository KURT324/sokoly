import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { daysApi, DayRecord, MaterialRecord } from '../../api/days';
import { materialLibraryApi, LibraryItem } from '../../api/materialLibrary';
import { MaterialType } from '@eduplatform/shared';
import { Layout } from '../../components/Layout';

const TYPE_ICONS: Record<MaterialType, string> = {
  [MaterialType.PDF]: '📄',
  [MaterialType.DOC]: '📝',
  [MaterialType.IMAGE]: '🖼️',
  [MaterialType.LINK]: '🔗',
  [MaterialType.VIDEO]: '🎬',
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

  // Inline preview
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [docHtmlCache, setDocHtmlCache] = useState<Record<string, string>>({});

  const handlePreview = (m: MaterialRecord) => {
    if (m.type === MaterialType.LINK) {
      window.open(m.url!, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreviewId((prev) => (prev === m.id ? null : m.id));
    if (m.type === MaterialType.DOC && m.storage_path && !docHtmlCache[m.storage_path]) {
      fetch(`/api/materials/file/${m.storage_path}/html`)
        .then((r) => r.text())
        .then((html) => setDocHtmlCache((prev) => ({ ...prev, [m.storage_path!]: html })))
        .catch(() => {});
    }
  };

  // Library modal
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [attaching, setAttaching] = useState<string | null>(null);

  const load = () => {
    if (!dayId) return;
    daysApi.getDay(dayId).then((r) => {
      setDay(r.data);
      setMaterials(r.data.materials ?? []);
    });
  };

  useEffect(() => { load(); }, [dayId]);

  const openLibrary = () => {
    setShowLibrary(true);
    setLibrarySearch('');
    materialLibraryApi.getLibrary().then((r) => setLibraryItems(r.data));
  };

  const handleAttach = async (item: LibraryItem) => {
    if (!dayId || attaching) return;
    setAttaching(item.id);
    try {
      await materialLibraryApi.attachToDay(item.id, dayId);
      load();
      setShowLibrary(false);
    } finally {
      setAttaching(null);
    }
  };

  // Group library items by folder for the modal
  const libraryGrouped = useMemo(() => {
    const filtered = librarySearch
      ? libraryItems.filter((i) =>
          i.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
          (i.folder ?? '').toLowerCase().includes(librarySearch.toLowerCase()),
        )
      : libraryItems;
    const map = new Map<string, LibraryItem[]>();
    for (const item of filtered) {
      const key = item.folder || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    const sorted = [...map.keys()].sort((a, b) => {
      if (a === '' && b !== '') return 1;
      if (a !== '' && b === '') return -1;
      return a.localeCompare(b, 'ru');
    });
    return sorted.map((k) => [k, map.get(k)!] as [string, LibraryItem[]]);
  }, [libraryItems, librarySearch]);

  const handleFileUpload = async (file: File) => {
    if (!dayId) return;
    const videoTypes = ['video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/x-matroska'];
    const docTypes = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp'];
    const isVideo = videoTypes.includes(file.type) || /\.(mp4|avi|mov|mkv)$/i.test(file.name);
    const allowed = [...docTypes, ...videoTypes];
    if (!allowed.includes(file.type) && !isVideo) {
      return setError('Неподдерживаемый формат. Разрешены: PDF, DOC, DOCX, JPG, PNG, WEBP, MP4, AVI, MOV, MKV');
    }
    const maxSize = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return setError(isVideo ? 'Видео слишком большое. Максимум 500 МБ' : 'Файл слишком большой. Максимум 50 МБ');
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
          {day.status !== 'ARCHIVED' && (
            <button
              onClick={async () => {
                const r = await daysApi.toggleDay(dayId!);
                setDay(r.data);
              }}
              className={`ml-auto text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                day.status === 'OPEN'
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800'
              }`}
            >
              {day.status === 'OPEN' ? 'Закрыть день' : 'Открыть день'}
            </button>
          )}
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
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">PDF, DOCX, JPG, PNG, WEBP — до 50 МБ &nbsp;|&nbsp; MP4, AVI, MOV, MKV — до 500 МБ</p>
              <div className="flex gap-2 justify-center flex-wrap">
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
                <button
                  onClick={openLibrary}
                  className="border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-sm px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  📚 Из библиотеки
                </button>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.mp4,.avi,.mov,.mkv"
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
              {materials.map((m) => {
                const isOpen = previewId === m.id;
                const canPreview = m.type !== MaterialType.LINK && m.storage_path;
                return (
                  <div key={m.id} className="overflow-hidden">
                    <div className={`flex items-center justify-between px-4 py-3 ${isOpen ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
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
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {m.type === MaterialType.LINK ? (
                          <a
                            href={m.url!}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Открыть →
                          </a>
                        ) : canPreview && (
                          <button
                            onClick={() => handlePreview(m)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {isOpen ? 'Свернуть ↑' : 'Открыть ↓'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(m.id, m.title)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>

                    {isOpen && m.storage_path && (
                      <div className="bg-gray-50 dark:bg-slate-900/50">
                        {m.type === MaterialType.PDF && (
                          <iframe
                            src={`/api/materials/view/${m.id}`}
                            title={m.title}
                            className="w-full border-0"
                            style={{ height: '80vh' }}
                          />
                        )}
                        {m.type === MaterialType.DOC && (
                          <div className="p-6 overflow-auto" style={{ maxHeight: '80vh' }}>
                            {docHtmlCache[m.storage_path] ? (
                              <div
                                className="prose prose-sm dark:prose-invert max-w-none"
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
                        {m.type === MaterialType.IMAGE && (
                          <div className="p-4 flex justify-center">
                            <img
                              src={daysApi.getMaterialViewUrl(dayId!, m.id)}
                              alt={m.title}
                              className="max-w-full rounded-lg"
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

      </div>

      {/* Library modal */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLibrary(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700 shrink-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Библиотека материалов</h2>
              <button onClick={() => setShowLibrary(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 shrink-0">
              <input
                type="text"
                placeholder="Поиск по названию или папке..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Items */}
            <div className="overflow-y-auto flex-1 px-2 py-2">
              {libraryGrouped.length === 0 ? (
                <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">
                  {libraryItems.length === 0 ? 'Библиотека пуста' : 'Ничего не найдено'}
                </p>
              ) : (
                <div className="space-y-3">
                  {libraryGrouped.map(([folder, groupItems]) => (
                    <div key={folder || '__ungrouped__'}>
                      <div className="flex items-center gap-1.5 px-3 py-1">
                        <span className="text-sm">📂</span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                          {folder || 'Без папки'}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {groupItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleAttach(item)}
                            disabled={attaching === item.id}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 text-left transition-colors disabled:opacity-50"
                          >
                            <span className="text-xl shrink-0">{
                              item.type === 'PDF' ? '📄' :
                              item.type === 'DOC' ? '📝' :
                              item.type === 'IMAGE' ? '🖼️' :
                              item.type === 'LINK' ? '🔗' : '🎬'
                            }</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{item.title}</div>
                              {item.size_bytes && (
                                <div className="text-xs text-gray-400 dark:text-slate-500">
                                  {item.size_bytes < 1024 * 1024
                                    ? `${(item.size_bytes / 1024).toFixed(0)} КБ`
                                    : `${(item.size_bytes / (1024 * 1024)).toFixed(1)} МБ`}
                                </div>
                              )}
                            </div>
                            {attaching === item.id ? (
                              <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">...</span>
                            ) : (
                              <span className="text-xs text-indigo-600 dark:text-indigo-400 shrink-0 font-medium">Прикрепить</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
