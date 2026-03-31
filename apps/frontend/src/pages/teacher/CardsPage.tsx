import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Layout } from '../../components/Layout';
import {
  cardTasksApi,
  CardFolder,
  CardLibrary,
  CardTask,
  CardTaskStatus,
  StudentInfo,
} from '../../api/cardTasks';

type Tab = 'library' | 'assignments';

const STATUS_LABELS: Record<CardTaskStatus, string> = {
  PENDING: 'Ожидает',
  AWAITING_REVIEW: 'На проверке',
  RETURNED: 'Возвращена',
  COMPLETED: 'Выполнена',
};

const STATUS_COLORS: Record<CardTaskStatus, string> = {
  PENDING: 'text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-700',
  AWAITING_REVIEW: 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  RETURNED: 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  COMPLETED: 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
};

// ─── Draggable card tile ──────────────────────────────────────────────────────
function DraggableCard({
  card,
  onAssign,
  onDelete,
  isAssignTarget,
}: {
  card: CardLibrary;
  onAssign: (card: CardLibrary) => void;
  onDelete: (card: CardLibrary) => void;
  isAssignTarget: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card-${card.id}`,
    data: { type: 'card', card },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-slate-800 border rounded-xl overflow-hidden transition-all ${
        isAssignTarget
          ? 'border-blue-400 dark:border-blue-600 shadow-md'
          : 'border-gray-200 dark:border-slate-700'
      }`}
    >
      {/* Drag handle = image */}
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <img
          src={cardTasksApi.getImageUrl(card.image_path)}
          alt={card.title}
          className="w-full h-36 object-cover pointer-events-none"
          draggable={false}
        />
      </div>
      <div className="p-3 space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{card.title}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{card.instructions}</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAssign(card)}
            className="flex-1 text-xs py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Назначить
          </button>
          <button
            onClick={() => onDelete(card)}
            className="text-xs py-1.5 px-2 text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Droppable folder tile ────────────────────────────────────────────────────
function FolderTile({
  folder,
  onClick,
  onRename,
  onDelete,
}: {
  folder: CardFolder & { _count: { cards: number } };
  onClick: () => void;
  onRename: (folder: CardFolder & { _count: { cards: number } }) => void;
  onDelete: (folder: CardFolder & { _count: { cards: number } }) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder-${folder.id}`, data: { type: 'folder', folderId: folder.id } });

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer select-none ${
        isOver
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 hover:border-gray-400 dark:hover:border-slate-500'
      }`}
      style={{ minHeight: '168px' }}
      onClick={onClick}
      onDoubleClick={(e) => { e.stopPropagation(); onRename(folder); }}
    >
      <span className="text-4xl">📁</span>
      <p className="text-sm font-medium text-gray-800 dark:text-slate-100 text-center truncate w-full px-2">
        {folder.name}
      </p>
      <p className="text-xs text-gray-400 dark:text-slate-500">{folder._count.cards} карточек</p>
      <div className="flex gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onRename(folder)}
          className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2 py-0.5 border border-gray-200 dark:border-slate-600 rounded"
        >
          Переименовать
        </button>
        <button
          onClick={() => onDelete(folder)}
          className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 border border-red-200 dark:border-red-800 rounded"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}

// ─── Root droppable zone (for dragging out of folder) ────────────────────────
function RootDropZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'root', data: { type: 'root' } });
  if (!visible) return null;
  return (
    <div
      ref={setNodeRef}
      className={`col-span-full border-2 border-dashed rounded-xl py-4 text-center text-sm transition-all ${
        isOver
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
          : 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500'
      }`}
    >
      Перетащите сюда, чтобы убрать из папки
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function TeacherCardsPage() {
  const [tab, setTab] = useState<Tab>('library');

  // Library + folders
  const [library, setLibrary] = useState<CardLibrary[]>([]);
  const [folders, setFolders] = useState<(CardFolder & { _count: { cards: number } })[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null); // null = root view

  // Upload form
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadInstructions, setUploadInstructions] = useState('');
  const [uploadImage, setUploadImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folder create/rename
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<CardFolder | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Assign panel
  const [assignCard, setAssignCard] = useState<CardLibrary | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');

  // Assign folder panel
  const [assignFolderTarget, setAssignFolderTarget] = useState<CardFolder | null>(null);
  const [assignFolderStudentId, setAssignFolderStudentId] = useState('');
  const [assigningFolder, setAssigningFolder] = useState(false);
  const [assignFolderMsg, setAssignFolderMsg] = useState('');

  // Assignments tab
  const [assignments, setAssignments] = useState<CardTask[]>([]);
  const [loadingAssign, setLoadingAssign] = useState(true);
  const [statusFilter, setStatusFilter] = useState<CardTaskStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<CardTask | null>(null);
  const [teacherComment, setTeacherComment] = useState('');
  const [showCommentField, setShowCommentField] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [expandedAttempts, setExpandedAttempts] = useState(false);

  // DnD
  const [draggingCard, setDraggingCard] = useState<CardLibrary | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadLibrary = () => {
    setLoadingLib(true);
    Promise.all([cardTasksApi.getLibrary(), cardTasksApi.getFolders()]).then(([libR, foldR]) => {
      setLibrary(libR.data);
      setFolders(foldR.data as any);
      setLoadingLib(false);
    });
  };

  const loadAssignments = () => {
    setLoadingAssign(true);
    cardTasksApi.getAllAssignments().then((r) => setAssignments(r.data)).finally(() => setLoadingAssign(false));
  };

  useEffect(() => {
    loadLibrary();
    loadAssignments();
    cardTasksApi.getStudents().then((r) => setStudents(r.data));
  }, []);

  // ── Library actions ─────────────────────────────────────────────────────────
  const handleUpload = async () => {
    setUploadError('');
    if (!uploadTitle.trim()) return setUploadError('Введите название');
    if (!uploadInstructions.trim()) return setUploadError('Введите инструкцию');
    if (!uploadImage) return setUploadError('Загрузите изображение');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('title', uploadTitle.trim());
      form.append('instructions', uploadInstructions.trim());
      form.append('image', uploadImage);
      await cardTasksApi.uploadToLibrary(form);
      setUploadTitle(''); setUploadInstructions(''); setUploadImage(null);
      setShowUpload(false);
      loadLibrary();
    } catch { setUploadError('Ошибка загрузки'); }
    finally { setUploading(false); }
  };

  const handleDeleteCard = async (card: CardLibrary) => {
    if (!confirm(`Удалить карточку "${card.title}"?`)) return;
    await cardTasksApi.deleteFromLibrary(card.id);
    loadLibrary();
    if (assignCard?.id === card.id) setAssignCard(null);
  };

  // ── Folder actions ──────────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await cardTasksApi.createFolder(newFolderName.trim());
    setNewFolderName(''); setShowNewFolder(false);
    loadLibrary();
  };

  const handleRenameFolder = async () => {
    if (!renamingFolder || !renameValue.trim()) return;
    await cardTasksApi.renameFolder(renamingFolder.id, renameValue.trim());
    setRenamingFolder(null); setRenameValue('');
    loadLibrary();
  };

  const handleDeleteFolder = async (folder: CardFolder & { _count: { cards: number } }) => {
    if (folder._count.cards === 0) {
      await cardTasksApi.deleteFolder(folder.id);
    } else {
      if (!confirm(`Папка содержит ${folder._count.cards} карточек. Они будут перемещены в корень. Удалить папку?`)) return;
      await cardTasksApi.deleteFolder(folder.id, true);
    }
    if (openFolderId === folder.id) setOpenFolderId(null);
    loadLibrary();
  };

  // ── Assign card ─────────────────────────────────────────────────────────────
  const openAssign = (card: CardLibrary) => {
    setAssignCard(card);
    setAssignStudentId(''); setAssignInstructions(card.instructions); setAssignMsg('');
    setAssignFolderTarget(null);
  };

  const handleAssign = async () => {
    if (!assignCard || !assignStudentId) return;
    setAssigning(true); setAssignMsg('');
    try {
      await cardTasksApi.assignTask(assignCard.id, assignStudentId, assignInstructions || undefined);
      setAssignMsg('Назначено!'); setAssignStudentId(''); loadAssignments();
    } catch { setAssignMsg('Ошибка назначения'); }
    finally { setAssigning(false); }
  };

  // ── Assign whole folder ─────────────────────────────────────────────────────
  const openAssignFolder = (folder: CardFolder) => {
    setAssignFolderTarget(folder);
    setAssignFolderStudentId(''); setAssignFolderMsg('');
    setAssignCard(null);
  };

  const handleAssignFolder = async () => {
    if (!assignFolderTarget || !assignFolderStudentId) return;
    const folderCards = library.filter((c) => c.folder_id === assignFolderTarget.id);
    if (folderCards.length === 0) { setAssignFolderMsg('Папка пуста'); return; }
    setAssigningFolder(true); setAssignFolderMsg('');
    try {
      await Promise.all(folderCards.map((c) =>
        cardTasksApi.assignTask(c.id, assignFolderStudentId)
      ));
      setAssignFolderMsg(`Назначено ${folderCards.length} карточек!`);
      setAssignFolderStudentId(''); loadAssignments();
    } catch { setAssignFolderMsg('Ошибка назначения'); }
    finally { setAssigningFolder(false); }
  };

  // ── DnD ────────────────────────────────────────────────────────────────────
  const handleDragStart = (e: DragStartEvent) => {
    if (e.active.data.current?.type === 'card') {
      setDraggingCard(e.active.data.current.card);
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggingCard(null);
    const { active, over } = e;
    if (!over || !active.data.current?.card) return;
    const card: CardLibrary = active.data.current.card;
    const overType = over.data.current?.type;

    if (overType === 'folder') {
      const folderId: string = over.data.current!.folderId;
      if (card.folder_id === folderId) return;
      await cardTasksApi.moveCard(card.id, folderId);
      loadLibrary();
    } else if (overType === 'root') {
      if (card.folder_id === null) return;
      await cardTasksApi.moveCard(card.id, null);
      loadLibrary();
    }
  };

  // ── Review actions ──────────────────────────────────────────────────────────
  const handleSelectAssignment = async (task: CardTask) => {
    const r = await cardTasksApi.getTask(task.id);
    setSelected(r.data); setTeacherComment(''); setShowCommentField(false); setExpandedAttempts(false);
  };

  const handleReview = async (is_correct: boolean) => {
    if (!selected) return;
    const latest = selected.attempts[selected.attempts.length - 1];
    if (!latest) return;
    if (!is_correct && !teacherComment.trim()) { setShowCommentField(true); return; }
    setReviewing(true);
    try {
      await cardTasksApi.reviewAttempt(selected.id, latest.id, is_correct, is_correct ? undefined : teacherComment);
      setSelected(null); loadAssignments();
    } finally { setReviewing(false); }
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const openFolder = folders.find((f) => f.id === openFolderId) ?? null;
  const visibleCards = openFolderId
    ? library.filter((c) => c.folder_id === openFolderId)
    : library.filter((c) => !c.folder_id);
  const visibleFolders = openFolderId ? [] : folders;
  const filteredAssignments = statusFilter === 'ALL' ? assignments : assignments.filter((t) => t.status === statusFilter);
  const pendingCount = assignments.filter((t) => t.status === 'AWAITING_REVIEW').length;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Карточки</h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          {(['library', 'assignments'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {t === 'library' ? 'Библиотека' : 'Назначения'}
              {t === 'assignments' && pendingCount > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══ Library Tab ══════════════════════════════════════════════════════ */}
        {tab === 'library' && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Breadcrumb */}
                {openFolderId ? (
                  <button
                    onClick={() => { setOpenFolderId(null); setAssignCard(null); setAssignFolderTarget(null); }}
                    className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
                  >
                    ← Библиотека
                  </button>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-slate-400">Библиотека</span>
                )}

                {openFolder && (
                  <>
                    <span className="text-gray-300 dark:text-slate-600">/</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-100">{openFolder.name}</span>
                  </>
                )}

                <div className="ml-auto flex gap-2">
                  {/* Assign whole folder */}
                  {openFolder && (
                    <button
                      onClick={() => openAssignFolder(openFolder)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Назначить всю папку
                    </button>
                  )}

                  {/* New folder — root only */}
                  {!openFolderId && (
                    <button
                      onClick={() => { setShowNewFolder((v) => !v); setNewFolderName(''); }}
                      className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      + Папка
                    </button>
                  )}

                  <button
                    onClick={() => { setShowUpload((v) => !v); setUploadError(''); }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {showUpload ? 'Отмена' : '+ Карточка'}
                  </button>
                </div>
              </div>

              {/* New folder inline input */}
              {showNewFolder && !openFolderId && (
                <div className="flex gap-2 items-center max-w-sm">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Название папки"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                    className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                  />
                  <button onClick={handleCreateFolder} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                    Создать
                  </button>
                </div>
              )}

              {/* Rename modal */}
              {renamingFolder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRenamingFolder(null)}>
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-5 space-y-3 w-72 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Переименовать папку</h3>
                    <input
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(); if (e.key === 'Escape') setRenamingFolder(null); }}
                      className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleRenameFolder} className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                        Сохранить
                      </button>
                      <button onClick={() => setRenamingFolder(null)} className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        Отмена
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload form */}
              {showUpload && (
                <div className="bg-gray-50 dark:bg-slate-700/30 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-3 max-w-lg">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Новая карточка</h3>
                  <input
                    type="text" placeholder="Название *" value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                  />
                  <textarea
                    placeholder="Инструкция для курсанта *" value={uploadInstructions}
                    onChange={(e) => setUploadInstructions(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                  />
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => setUploadImage(e.target.files?.[0] ?? null)} />
                    <button onClick={() => fileInputRef.current?.click()}
                      className="text-sm px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200">
                      {uploadImage ? uploadImage.name : 'Выбрать изображение *'}
                    </button>
                    {uploadImage && (
                      <img src={URL.createObjectURL(uploadImage)} alt="preview"
                        className="mt-2 h-32 rounded border border-gray-200 dark:border-slate-700 object-contain" />
                    )}
                  </div>
                  {uploadError && <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
                  <button onClick={handleUpload} disabled={uploading}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                    {uploading ? 'Загрузка...' : 'Сохранить в библиотеку'}
                  </button>
                </div>
              )}

              {/* Grid + Assign panel */}
              <div className="flex gap-6">
                <div className="flex-1">
                  {loadingLib ? (
                    <p className="text-gray-400 dark:text-slate-500 text-sm">Загрузка...</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Root drop zone — shown when inside a folder */}
                      <RootDropZone visible={!!openFolderId} />

                      {/* Folders (root only) */}
                      {visibleFolders.map((folder) => (
                        <FolderTile
                          key={folder.id}
                          folder={folder}
                          onClick={() => { setOpenFolderId(folder.id); setAssignCard(null); setAssignFolderTarget(null); }}
                          onRename={(f) => { setRenamingFolder(f); setRenameValue(f.name); }}
                          onDelete={handleDeleteFolder}
                        />
                      ))}

                      {/* Cards */}
                      {visibleCards.map((card) => (
                        <DraggableCard
                          key={card.id}
                          card={card}
                          onAssign={openAssign}
                          onDelete={handleDeleteCard}
                          isAssignTarget={assignCard?.id === card.id}
                        />
                      ))}

                      {visibleFolders.length === 0 && visibleCards.length === 0 && (
                        <div className="col-span-full text-center text-gray-400 dark:text-slate-500 py-16 text-sm">
                          {openFolderId ? 'Папка пуста. Перетащите сюда карточки.' : 'Библиотека пуста. Добавьте первую карточку.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Assign card panel */}
                {assignCard && (
                  <div className="w-72 shrink-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3 self-start">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Назначить курсанту</h3>
                      <button onClick={() => setAssignCard(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-lg leading-none">×</button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{assignCard.title}</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Курсант *</label>
                      <select value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)}
                        className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Выберите...</option>
                        {students.map((s) => <option key={s.id} value={s.id}>{s.callsign}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Инструкция</label>
                      <textarea value={assignInstructions} onChange={(e) => setAssignInstructions(e.target.value)} rows={3}
                        className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
                    </div>
                    {assignMsg && (
                      <p className={`text-xs ${assignMsg.startsWith('Ошибка') ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{assignMsg}</p>
                    )}
                    <button onClick={handleAssign} disabled={assigning || !assignStudentId}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                      {assigning ? 'Назначение...' : 'Назначить'}
                    </button>
                  </div>
                )}

                {/* Assign folder panel */}
                {assignFolderTarget && !assignCard && (
                  <div className="w-72 shrink-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3 self-start">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Назначить всю папку</h3>
                      <button onClick={() => setAssignFolderTarget(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-lg leading-none">×</button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      📁 {assignFolderTarget.name} — {library.filter((c) => c.folder_id === assignFolderTarget.id).length} карточек
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Курсант *</label>
                      <select value={assignFolderStudentId} onChange={(e) => setAssignFolderStudentId(e.target.value)}
                        className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Выберите...</option>
                        {students.map((s) => <option key={s.id} value={s.id}>{s.callsign}</option>)}
                      </select>
                    </div>
                    {assignFolderMsg && (
                      <p className={`text-xs ${assignFolderMsg.startsWith('Ошибка') ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{assignFolderMsg}</p>
                    )}
                    <button onClick={handleAssignFolder} disabled={assigningFolder || !assignFolderStudentId}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                      {assigningFolder ? 'Назначение...' : 'Назначить всё'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* DragOverlay — ghost card while dragging */}
            <DragOverlay>
              {draggingCard && (
                <div className="bg-white dark:bg-slate-800 border border-blue-400 rounded-xl overflow-hidden shadow-xl w-48 opacity-90 rotate-2">
                  <img src={cardTasksApi.getImageUrl(draggingCard.image_path)} alt="" className="w-full h-28 object-cover" draggable={false} />
                  <div className="px-3 py-2">
                    <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{draggingCard.title}</p>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* ══ Assignments Tab ══════════════════════════════════════════════════ */}
        {tab === 'assignments' && (
          <div className="flex gap-6">
            <div className="w-72 shrink-0 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'AWAITING_REVIEW', 'PENDING', 'RETURNED', 'COMPLETED'] as const).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      statusFilter === s
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}>
                    {s === 'ALL' ? 'Все' : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              {loadingAssign ? (
                <p className="text-gray-400 dark:text-slate-500 text-sm">Загрузка...</p>
              ) : filteredAssignments.length === 0 ? (
                <div className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Нет назначений</div>
              ) : filteredAssignments.map((task) => (
                <button key={task.id} onClick={() => handleSelectAssignment(task)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    selected?.id === task.id
                      ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="font-medium text-sm text-gray-900 dark:text-slate-100 truncate">{task.student?.callsign}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[task.status]}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </div>
                  {task.library && <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{task.library.title}</p>}
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{new Date(task.created_at).toLocaleDateString('ru-RU')}</p>
                </button>
              ))}
            </div>

            {selected ? (
              <div className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-slate-100">{selected.student?.callsign}</h2>
                    {selected.library && <p className="text-xs text-gray-400 dark:text-slate-500">{selected.library.title}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[selected.status]}`}>
                      {STATUS_LABELS[selected.status]}
                    </span>
                    <span className="text-sm text-gray-400 dark:text-slate-500">Попыток: {selected.attempts.length}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-slate-400">
                  <span className="font-medium text-gray-700 dark:text-slate-200">Инструкция:</span> {selected.instructions}
                </p>

                {(() => {
                  const latest = selected.attempts[selected.attempts.length - 1];
                  if (!latest) return <p className="text-sm text-gray-400 dark:text-slate-500">Попыток ещё не было</p>;
                  return (
                    <div className="space-y-3">
                      <div className="flex gap-4 flex-wrap">
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Оригинал:</p>
                          <img src={cardTasksApi.getImageUrl(selected.image_path)} alt="original"
                            className="h-48 rounded border border-gray-200 dark:border-slate-700 object-contain" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Аннотация (попытка #{latest.attempt_number}):</p>
                          <img src={cardTasksApi.getAnnotationUrl(latest.annotation_path)} alt="annotation"
                            className="h-48 rounded border border-gray-200 dark:border-slate-700 object-contain" />
                        </div>
                      </div>
                      <p className="text-sm bg-gray-50 dark:bg-slate-700/30 rounded-lg px-3 py-2">
                        <span className="font-medium text-gray-700 dark:text-slate-200">Комментарий курсанта:</span>{' '}
                        <span className="text-gray-600 dark:text-slate-400">{latest.student_comment}</span>
                      </p>
                    </div>
                  );
                })()}

                {selected.attempts.length > 1 && (
                  <div>
                    <button onClick={() => setExpandedAttempts((v) => !v)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800">
                      {expandedAttempts ? '▾ Скрыть' : '▸ История попыток'} ({selected.attempts.length - 1} предыдущих)
                    </button>
                    {expandedAttempts && (
                      <div className="mt-3 space-y-3 border-t border-gray-100 dark:border-slate-700 pt-3">
                        {selected.attempts.slice(0, -1).map((att) => (
                          <div key={att.id} className="flex gap-3 items-start">
                            <img src={cardTasksApi.getAnnotationUrl(att.annotation_path)} alt={`attempt ${att.attempt_number}`}
                              className="h-24 rounded border border-gray-200 dark:border-slate-700 object-contain" />
                            <div className="text-sm space-y-1">
                              <p className="text-gray-500 dark:text-slate-400">Попытка #{att.attempt_number}</p>
                              <p className="text-gray-700 dark:text-slate-200">{att.student_comment}</p>
                              {att.teacher_comment && <p className="text-red-600 dark:text-red-400 text-xs">Комментарий: {att.teacher_comment}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selected.status === 'AWAITING_REVIEW' && (
                  <div className="border-t border-gray-100 dark:border-slate-700 pt-4 space-y-3">
                    {showCommentField && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                          Комментарий для курсанта <span className="text-red-500">*</span>
                        </label>
                        <textarea value={teacherComment} onChange={(e) => setTeacherComment(e.target.value)}
                          placeholder="Объясните, что не так..." rows={2}
                          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-slate-800" />
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => handleReview(true)} disabled={reviewing}
                        className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        ✓ Верно
                      </button>
                      <button onClick={() => showCommentField ? handleReview(false) : setShowCommentField(true)} disabled={reviewing}
                        className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                        ✗ Неверно
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
                Выберите назначение из списка
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
