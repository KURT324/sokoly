import { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Use local worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ProtectedViewerProps {
  url: string;
  type: 'IMAGE' | 'PDF' | 'LINK' | 'DOC' | 'VIDEO' | 'APK';
  title: string;
  onClose: () => void;
}

export function ProtectedViewer({ url, type, title, onClose }: ProtectedViewerProps) {
  const [obscured, setObscured] = useState(false);
  const [numPages, setNumPages] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Block keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 's') ||
        (e.ctrlKey && e.key === 'p') ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, []);

  // Obscure on tab hide
  useEffect(() => {
    const handleVisibility = () => setObscured(document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Block context menu globally while open
  useEffect(() => {
    const handleCtxMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleCtxMenu);
    return () => document.removeEventListener('contextmenu', handleCtxMenu);
  }, []);

  const containerStyle: React.CSSProperties = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <span className="text-white text-sm font-medium truncate max-w-[70%]">{title}</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-md hover:bg-gray-700 transition-colors"
        >
          ✕ Закрыть
        </button>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4 relative"
        style={containerStyle}
        onContextMenu={(e) => e.preventDefault()}
      >
        {obscured && (
          <div className="absolute inset-0 bg-black/90 z-10 flex items-center justify-center">
            <span className="text-gray-400 text-sm">Вернитесь на вкладку для просмотра</span>
          </div>
        )}

        {type === 'IMAGE' && (
          <img
            src={url}
            alt={title}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="max-w-full h-auto rounded select-none"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {type === 'PDF' && (
          <div className="w-full max-w-4xl">
            <Document
              file={url}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<div className="text-gray-400 text-sm py-8 text-center">Загрузка PDF...</div>}
              error={<div className="text-red-400 text-sm py-8 text-center">Ошибка загрузки PDF</div>}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={i + 1}
                  pageNumber={i + 1}
                  width={Math.min(900, window.innerWidth - 48)}
                  className="mb-4 shadow-lg"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              ))}
            </Document>
          </div>
        )}

        {type === 'LINK' && (
          <div className="text-center py-16">
            <p className="text-gray-300 mb-4">Ссылка откроется в новой вкладке</p>
            <button
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Открыть ссылку
            </button>
          </div>
        )}

        {type === 'DOC' && (
          <div className="text-center py-16">
            <p className="text-gray-300 mb-4">Документ доступен только для просмотра</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors inline-block"
            >
              Открыть документ
            </a>
          </div>
        )}

        {type === 'VIDEO' && (
          <div
            className="w-full max-w-4xl"
            onContextMenu={(e) => e.preventDefault()}
          >
            <video
              src={url}
              controls
              controlsList="nodownload"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
              className="w-full rounded-lg"
              style={{ userSelect: 'none' }}
            />
          </div>
        )}

        {type === 'APK' && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📱</div>
            <p className="text-gray-300 mb-2 font-medium">APK</p>
            <p className="text-gray-400 text-sm mb-6">{title}</p>
            <a
              href={url}
              download
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors inline-block"
            >
              Скачать APK
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
