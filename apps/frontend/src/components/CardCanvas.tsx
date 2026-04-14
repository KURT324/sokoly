import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';

type Tool = 'rect' | 'ellipse' | 'brush' | 'eraser';
const RED = '#e53e3e';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;

interface Props {
  backgroundUrl: string;
  onHasDrawing: (has: boolean) => void;
  onExport: (getDataUrl: () => string) => void;
}

export function CardCanvas({ backgroundUrl, onHasDrawing, onExport }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [brushSize, setBrushSize] = useState(4);
  const [zoom, setZoom] = useState(1);
  // Triggers tool effect re-run once canvas is async-initialized
  const [canvasReady, setCanvasReady] = useState(false);

  // Keep latest tool in a ref for use inside key event handlers (avoid stale closure)
  const toolRef = useRef<Tool>('rect');
  useEffect(() => { toolRef.current = tool; }, [tool]);

  const isDrawingShapeRef = useRef(false);
  const originXRef = useRef(0);
  const originYRef = useRef(0);
  const activeShapeRef = useRef<fabric.Object | null>(null);

  // Panning state
  const isSpaceDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  const changeZoom = (delta: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const current = canvas.getZoom();
    const next = Math.min(Math.max(Math.round((current + delta) * 100) / 100, MIN_ZOOM), MAX_ZOOM);
    const center = new fabric.Point(canvas.width! / 2, canvas.height! / 2);
    canvas.zoomToPoint(center, next);
    setZoom(next);
  };

  const resetZoom = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
  };

  // ── Canvas initialization (async — waits for image probe) ──────────────────
  useEffect(() => {
    let cancelled = false;
    setCanvasReady(false);

    const containerWidth = containerRef.current?.offsetWidth || 800;
    const probe = new Image();
    probe.crossOrigin = 'anonymous';

    const init = (imgW: number, imgH: number) => {
      if (cancelled || !canvasElRef.current) return;

      const ratio = imgH / imgW;
      const canvasH = Math.round(containerWidth * Math.min(ratio, 1.5));

      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: containerWidth,
        height: canvasH,
      });
      fabricRef.current = canvas;

      fabric.Image.fromURL(backgroundUrl, (img: fabric.Image) => {
        if (cancelled) return;
        img.set({ selectable: false, evented: false });
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
          scaleX: canvas.width! / (img.width || imgW),
          scaleY: canvas.height! / (img.height || imgH),
        });
      }, { crossOrigin: 'anonymous' });

      const updateHas = () => onHasDrawing(canvas.getObjects().length > 0);
      canvas.on('object:added', updateHas);
      canvas.on('object:removed', updateHas);

      // Scroll-wheel zoom (zoom to pointer position)
      canvas.on('mouse:wheel', (opt) => {
        const e = opt.e as WheelEvent;
        e.preventDefault();
        e.stopPropagation();
        const cur = canvas.getZoom();
        const dir = e.deltaY < 0 ? 1 : -1;
        const next = Math.min(Math.max(Math.round((cur + dir * 0.1) * 100) / 100, MIN_ZOOM), MAX_ZOOM);
        canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), next);
        setZoom(next);
      });

      // Double-click → reset zoom
      (canvas as any).upperCanvasEl.addEventListener('dblclick', () => {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        setZoom(1);
      });

      // Export at zoom=1 so the full canvas is captured, not just the visible crop
      onExport(() => {
        const savedVpt = canvas.viewportTransform
          ? ([...canvas.viewportTransform] as [number, number, number, number, number, number])
          : ([1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number]);
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        const dataUrl = canvas.toDataURL({ format: 'png' });
        canvas.setViewportTransform(savedVpt);
        canvas.renderAll();
        return dataUrl;
      });

      setCanvasReady(true);
    };

    probe.onload = () => init(probe.naturalWidth, probe.naturalHeight);
    probe.onerror = () => init(4, 3);
    probe.src = backgroundUrl;

    return () => {
      cancelled = true;
      setCanvasReady(false);
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [backgroundUrl]);

  // ── Tool handlers — re-runs when canvas becomes ready OR tool/brush changes ─
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvasReady) return;

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    // Combined mouse:down — panning takes priority over drawing
    canvas.on('mouse:down', (opt) => {
      const e = opt.e as MouseEvent;

      // Middle-mouse pan
      if (e.button === 1) {
        e.preventDefault();
        isPanningRef.current = true;
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Space+left-click pan
      if (isSpaceDownRef.current) {
        isPanningRef.current = true;
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Eraser
      if (tool === 'eraser') {
        const objects = canvas.getObjects();
        if (objects.length > 0) {
          canvas.remove(objects[objects.length - 1]);
          canvas.renderAll();
        }
        return;
      }

      // Brush is handled by fabric's own isDrawingMode
      if (tool === 'brush') return;

      // Rect / Ellipse
      const ptr = canvas.getPointer(opt.e);
      isDrawingShapeRef.current = true;
      originXRef.current = ptr.x;
      originYRef.current = ptr.y;

      const shapeOpts = {
        left: ptr.x, top: ptr.y, width: 0, height: 0,
        fill: 'transparent', stroke: RED, strokeWidth: brushSize, selectable: false,
      };
      const shape = tool === 'rect'
        ? new fabric.Rect(shapeOpts)
        : new fabric.Ellipse({ ...shapeOpts, rx: 0, ry: 0 });
      canvas.add(shape);
      activeShapeRef.current = shape;
    });

    canvas.on('mouse:move', (opt) => {
      // Pan
      if (isPanningRef.current) {
        const e = opt.e as MouseEvent;
        const dx = e.clientX - lastPanPointRef.current.x;
        const dy = e.clientY - lastPanPointRef.current.y;
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        const vpt = canvas.viewportTransform!;
        vpt[4] += dx;
        vpt[5] += dy;
        canvas.requestRenderAll();
        return;
      }

      if (!isDrawingShapeRef.current || !activeShapeRef.current) return;
      const ptr = canvas.getPointer(opt.e);
      const w = Math.abs(ptr.x - originXRef.current);
      const h = Math.abs(ptr.y - originYRef.current);
      const left = Math.min(ptr.x, originXRef.current);
      const top = Math.min(ptr.y, originYRef.current);

      if (tool === 'rect') {
        (activeShapeRef.current as fabric.Rect).set({ left, top, width: w, height: h });
      } else {
        (activeShapeRef.current as fabric.Ellipse).set({ left, top, rx: w / 2, ry: h / 2 });
      }
      canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        return;
      }
      isDrawingShapeRef.current = false;
      activeShapeRef.current = null;
    });

    if (tool === 'brush') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = RED;
      canvas.freeDrawingBrush.width = brushSize;
    } else {
      canvas.isDrawingMode = false;
    }
    canvas.selection = false;
  }, [tool, brushSize, canvasReady]);

  // ── Space key: toggle pan mode, temporarily disabling brush drawing ─────────
  useEffect(() => {
    const upper = () => (fabricRef.current as any)?.upperCanvasEl as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      // Don't hijack space in text inputs
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' ||
          (e.target as HTMLElement).tagName === 'INPUT') return;
      e.preventDefault();
      isSpaceDownRef.current = true;
      if (fabricRef.current) fabricRef.current.isDrawingMode = false;
      const el = upper();
      if (el) el.style.cursor = 'grab';
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      isSpaceDownRef.current = false;
      isPanningRef.current = false;
      // Restore brush mode if needed
      if (fabricRef.current && toolRef.current === 'brush') {
        fabricRef.current.isDrawingMode = true;
      }
      const el = upper();
      if (el) el.style.cursor = '';
    };

    // Stop panning if mouse released outside canvas
    const onMouseUp = () => {
      if (isPanningRef.current) isPanningRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleUndo = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (objects.length > 0) {
      canvas.remove(objects[objects.length - 1]);
      canvas.renderAll();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Drawing tools */}
        <div className="flex gap-1">
          {(['rect', 'ellipse', 'brush', 'eraser'] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTool(t)}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                tool === t
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t === 'rect' ? 'Прямоугольник' : t === 'ellipse' ? 'Эллипс' : t === 'brush' ? 'Кисть' : 'Ластик'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Толщина:</span>
          <input
            type="range" min={1} max={20} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-xs text-gray-500">{brushSize}px</span>
        </div>

        <button
          type="button"
          onClick={handleUndo}
          className="px-3 py-1 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Undo
        </button>

        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-red-500 border border-red-700" />
          <span className="text-xs text-gray-500">Красный</span>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 text-base leading-none"
          >
            −
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={resetZoom}
            className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 min-w-[3.5rem] text-center"
            title="Сбросить масштаб (двойной клик на изображении)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 text-base leading-none"
          >
            +
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-slate-500">
        Пробел + перетаскивание или средняя кнопка мыши — перемещение по изображению
      </p>

      <div ref={containerRef} className="w-full border border-gray-300 dark:border-slate-600 rounded overflow-hidden">
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}
