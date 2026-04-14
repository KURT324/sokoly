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

  const isDrawingShapeRef = useRef(false);
  const originXRef = useRef(0);
  const originYRef = useRef(0);
  const activeShapeRef = useRef<fabric.Object | null>(null);

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

  useEffect(() => {
    let cancelled = false;

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

      // Mouse wheel zoom
      canvas.on('mouse:wheel', (opt) => {
        const e = opt.e as WheelEvent;
        e.preventDefault();
        e.stopPropagation();
        const currentZoom = canvas.getZoom();
        const direction = e.deltaY < 0 ? 1 : -1;
        const next = Math.min(
          Math.max(Math.round((currentZoom + direction * 0.1) * 100) / 100, MIN_ZOOM),
          MAX_ZOOM,
        );
        canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), next);
        setZoom(next);
      });

      // Double-click to reset zoom
      canvas.upperCanvasEl.addEventListener('dblclick', () => {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        setZoom(1);
      });

      // Export at zoom=1 so the full image is captured
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
    };

    probe.onload = () => init(probe.naturalWidth, probe.naturalHeight);
    probe.onerror = () => init(4, 3);
    probe.src = backgroundUrl;

    return () => {
      cancelled = true;
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [backgroundUrl]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    if (tool === 'brush') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = RED;
      canvas.freeDrawingBrush.width = brushSize;
      canvas.selection = false;
      return;
    }

    if (tool === 'eraser') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.on('mouse:down', () => {
        const objects = canvas.getObjects();
        if (objects.length > 0) {
          canvas.remove(objects[objects.length - 1]);
          canvas.renderAll();
        }
      });
      return;
    }

    canvas.isDrawingMode = false;
    canvas.selection = false;

    canvas.on('mouse:down', (opt) => {
      const ptr = canvas.getPointer(opt.e);
      isDrawingShapeRef.current = true;
      originXRef.current = ptr.x;
      originYRef.current = ptr.y;

      const opts = {
        left: ptr.x, top: ptr.y, width: 0, height: 0,
        fill: 'transparent', stroke: RED, strokeWidth: brushSize, selectable: false,
      };
      const shape = tool === 'rect'
        ? new fabric.Rect(opts)
        : new fabric.Ellipse({ ...opts, rx: 0, ry: 0 });
      canvas.add(shape);
      activeShapeRef.current = shape;
    });

    canvas.on('mouse:move', (opt) => {
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
      isDrawingShapeRef.current = false;
      activeShapeRef.current = null;
    });
  }, [tool, brushSize]);

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
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 text-base leading-none"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 min-w-[3.5rem] text-center"
            title="Сбросить масштаб (или двойной клик на изображении)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            className="w-7 h-7 flex items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 text-base leading-none"
          >
            +
          </button>
        </div>
      </div>

      <div ref={containerRef} className="w-full border border-gray-300 rounded overflow-hidden">
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}
