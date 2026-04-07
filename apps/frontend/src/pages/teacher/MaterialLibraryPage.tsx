import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../../components/Layout';
import { materialLibraryApi, LibraryItem } from '../../api/materialLibrary';
import { MaterialType } from '@eduplatform/shared';

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

export function MaterialLibraryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  // Upload form state
  const [uploadFolder, setUploadFolder] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkFolder, setLinkFolder] = useState('');

  const load = () =>
    materialLibraryApi.getLibrary().then((r) => setItems(r.data)).finally(() => setLoading(false));

  // Navigation / search / rename
  const [openFolder, setOpenFolder] = useState<string | null>(null); // null = root grid
  const [search, setSearch] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Inline preview state
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [docHtmlCache, setDocHtmlCache] = useState<Record<string, string>>({});

  const handlePreview = (item: LibraryItem) => {
    if (item.type === MaterialType.LINK) {
      window.open(item.url!, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreviewId((prev) => (prev === item.id ? null : item.id));
    if (item.type === MaterialType.DOC && item.storage_path && !docHtmlCache[item.storage_path]) {
      fetch(`/api/materials/file/${item.storage_path}/html`)
        .then((r) => r.text())
        .then((html) => setDocHtmlCache((prev) => ({ ...prev, [item.storage_path!]: html })))
        .catch(() => {});
    }
  };

  useEffect(() => { load(); }, []);

  // Pre-fill upload folder when entering a folder
  useEffect(() => {
    if (openFolder !== null) setUploadFolder(openFolder);
  }, [openFolder]);

  // Collect all unique folder names for autocomplete suggestions
  const allFolders = useMemo(
    () => [...new Set(items.map((i) => i.folder).filter(Boolean) as string[])].sort(),
    [items],
  );

  // Folder list with file counts for root grid
  const folderList = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = item.folder ?? '';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === '' && b !== '') return 1;
        if (a !== '' && b === '') return -1;
        const numA = parseInt(a.match(/\d+/)?.[0] ?? '', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] ?? '', 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return a.localeCompare(b, 'ru');
      })
      .map(([name, count]) => ({ name, count }));
  }, [items]);

  // Items inside the open folder, filtered by search
  const visibleItems = useMemo(() => {
    if (openFolder === null) return [];
    return items
      .filter((i) => (i.folder ?? '') === openFolder)
      .filter((i) => !search || i.title.toLowerCase().includes(search.toLowerCase()));
  }, [items, openFolder, search]);

  const handleFilesUpload = async (files: File[]) => {
    if (files.length === 0) return;
    const videoTypes = ['video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/x-matroska'];
    for (const file of files) {
      const isVideo = videoTypes.includes(file.type) || /\.(mp4|avi|mov|mkv)$/i.test(file.name);
      const maxSize = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
      if (file.size > maxSize) {
        return setError(isVideo
          ? `«${file.name}»: видео слишком большое. Максимум 500 МБ`
          : `«${file.name}»: файл слишком большой. Максимум 50 МБ`);
      }
    }
    setError('');
    setUploading(true);
    setUploadTotal(files.length);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadCurrent(i + 1);
        setProgress(0);
        await materialLibraryApi.uploadFile(files[i], files[i].name, uploadFolder, setProgress);
      }
      setUploadFolder('');
      load();
    } catch {
      setError('Ошибка загрузки файла');
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadCurrent(0);
      setUploadTotal(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFilesUpload(files);
  };

  const handleAddLink = async () => {
    if (!linkUrl || !linkTitle) return;
    await materialLibraryApi.addLink(linkUrl, linkTitle, linkFolder);
    setLinkUrl('');
    setLinkTitle('');
    setLinkFolder('');
    setShowLinkForm(false);
    load();
  };

  const handleRenameFolder = async () => {
    if (!renamingFolder || !renameValue.trim() || renameValue.trim() === renamingFolder) {
      setRenamingFolder(null);
      return;
    }
    setRenaming(true);
    try {
      await materialLibraryApi.renameFolder(renamingFolder, renameValue.trim());
      if (openFolder === renamingFolder) setOpenFolder(renameValue.trim());
      load();
    } finally {
      setRenaming(false);
      setRenamingFolder(null);
      setRenameValue('');
    }
  };

  const handleDelete = async (item: LibraryItem) => {
    if (!confirm(`Удалить "${item.title}" из библиотеки?`)) return;
    await materialLibraryApi.deleteItem(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Библиотека материалов</h1>

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragging ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-slate-600 hover:border-gray-400'
          }`}
        >
          {uploading ? (
            <div>
              <div className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                {uploadTotal > 1
                  ? `Загружается ${uploadCurrent} из ${uploadTotal}... ${progress}%`
                  : `Загрузка... ${progress}%`}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">📁</div>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Перетащите файл или нажмите для выбора</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">PDF, DOCX, JPG, PNG, WEBP — до 50 МБ &nbsp;|&nbsp; MP4, AVI, MOV, MKV — до 500 МБ</p>

              {/* Folder for upload */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <input
                    type="text"
                    list="folder-suggestions"
                    value={uploadFolder}
                    onChange={(e) => setUploadFolder(e.target.value)}
                    placeholder="Папка (напр. «День 1»)"
                    className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
                  />
                  <datalist id="folder-suggestions">
                    {allFolders.map((f) => <option key={f} value={f} />)}
                  </datalist>
                </div>
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium"
                >
                  Выбрать файлы
                </button>
                <button
                  onClick={() => setShowLinkForm(true)}
                  className="border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-700/50"
                >
                  + Ссылка
                </button>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.mp4,.avi,.mov,.mkv"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) handleFilesUpload(files);
              e.target.value = '';
            }}
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Link form */}
        {showLinkForm && (
          <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-200">Добавить ссылку</h3>
            <input
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
            />
            <input
              type="text"
              placeholder="Описание ссылки"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
            />
            <input
              type="text"
              list="folder-suggestions-link"
              placeholder="Папка (напр. «День 1»)"
              value={linkFolder}
              onChange={(e) => setLinkFolder(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
            />
            <datalist id="folder-suggestions-link">
              {allFolders.map((f) => <option key={f} value={f} />)}
            </datalist>
            <div className="flex gap-2">
              <button onClick={handleAddLink} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium">
                Добавить
              </button>
              <button onClick={() => setShowLinkForm(false)} className="border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Library */}
        {loading ? (
          <div className="text-center text-gray-400 dark:text-slate-500 py-8">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-slate-500 py-8 text-sm">Библиотека пуста</div>
        ) : openFolder === null ? (
          /* ── Root: folder cards grid ─────────────────────────────────── */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {folderList.map(({ name, count }) => (
              <div
                key={name || '__ungrouped__'}
                onDoubleClick={() => { if (name) { setRenamingFolder(name); setRenameValue(name); } }}
                className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all select-none"
                onClick={() => { if (renamingFolder !== name) { setOpenFolder(name); setSearch(''); setPreviewId(null); } }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-4xl">📁</span>
                  {name && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingFolder(name); setRenameValue(name); }}
                      className="text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400 text-sm leading-none p-1 -m-1"
                      title="Переименовать"
                    >
                      ✏️
                    </button>
                  )}
                </div>

                {renamingFolder === name ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFolder();
                        if (e.key === 'Escape') { setRenamingFolder(null); setRenameValue(''); }
                      }}
                      className="w-full border border-blue-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleRenameFolder}
                        disabled={renaming}
                        className="flex-1 text-xs py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                      >
                        {renaming ? '...' : 'OK'}
                      </button>
                      <button
                        onClick={() => { setRenamingFolder(null); setRenameValue(''); }}
                        className="flex-1 text-xs py-1 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">
                      {name || 'Без папки'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{count} {count === 1 ? 'файл' : count < 5 ? 'файла' : 'файлов'}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* ── Folder view ─────────────────────────────────────────────── */
          <div className="space-y-4">
            {/* Breadcrumb + search */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => { setOpenFolder(null); setSearch(''); setPreviewId(null); setUploadFolder(''); }}
                className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white font-medium"
              >
                ← Назад
              </button>
              <span className="text-gray-300 dark:text-slate-600">/</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                📂 {openFolder || 'Без папки'}
              </span>
              <div className="ml-auto">
                <input
                  type="text"
                  placeholder="Поиск по названию..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                />
              </div>
            </div>

            {/* Items list */}
            {visibleItems.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-slate-500 py-8 text-sm">
                {search ? 'Ничего не найдено' : 'Папка пуста'}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                  {visibleItems.map((item) => {
                    const isOpen = previewId === item.id;
                    return (
                      <div key={item.id} className="overflow-hidden">
                        <div className={`flex items-center justify-between px-4 py-3 ${isOpen ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xl shrink-0">{TYPE_ICONS[item.type]}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{item.title}</div>
                              {item.size_bytes && (
                                <div className="text-xs text-gray-400 dark:text-slate-500">{formatBytes(item.size_bytes)}</div>
                              )}
                              {item.url && (
                                <div className="text-xs text-gray-400 dark:text-slate-500 truncate">{item.url}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4 shrink-0">
                            {item.type === MaterialType.LINK ? (
                              <a href={item.url!} target="_blank" rel="noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                Открыть →
                              </a>
                            ) : item.storage_path && (
                              <button onClick={() => handlePreview(item)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                {isOpen ? 'Свернуть ↑' : 'Открыть ↓'}
                              </button>
                            )}
                            <button onClick={() => handleDelete(item)}
                              className="text-xs text-red-500 hover:text-red-700">
                              Удалить
                            </button>
                          </div>
                        </div>

                        {isOpen && item.storage_path && (
                          <div className="bg-gray-50 dark:bg-slate-900/50">
                            {item.type === MaterialType.PDF && (
                              <iframe src={`/api/materials/file/${item.storage_path}`} title={item.title}
                                className="w-full border-0" style={{ height: '80vh' }} />
                            )}
                            {item.type === MaterialType.DOC && (
                              <div className="p-6 overflow-auto" style={{ maxHeight: '80vh' }}>
                                {docHtmlCache[item.storage_path] ? (
                                  <div className="prose prose-sm dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: docHtmlCache[item.storage_path] }} />
                                ) : (
                                  <div className="text-center text-gray-400 dark:text-slate-500 py-8">Загрузка документа...</div>
                                )}
                              </div>
                            )}
                            {item.type === MaterialType.VIDEO && (
                              <div className="p-4">
                                <video src={`/api/materials/file/${item.storage_path}`} controls
                                  controlsList="nodownload" disablePictureInPicture
                                  onContextMenu={(e) => e.preventDefault()}
                                  className="w-full rounded-lg" style={{ maxHeight: '70vh' }} />
                              </div>
                            )}
                            {item.type === MaterialType.IMAGE && (
                              <div className="p-4 flex justify-center">
                                <img src={materialLibraryApi.getViewUrl(item.id)} alt={item.title}
                                  className="max-w-full rounded-lg" style={{ maxHeight: '70vh' }} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
