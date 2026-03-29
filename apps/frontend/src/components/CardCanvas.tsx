import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';

type Tool = 'rect' | 'ellipse' | 'brush' | 'eraser';
const RED = '#e53e3e';

interface Props {
  backgroundUrl: string;
  onHasDrawing: (has: boolean) => void;
  onExport: (getDataUrl: () => string) => void;
}

export function CardCanvas({ backgroundUrl, onHasDrawing, onExport }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [brushSize, setBrushSize] = useState(4);

  const isDrawingShapeRef = useRef(false);
  const originXRef = useRef(0);
  const originYRef = useRef(0);
  const activeShapeRef = useRef<fabric.Object | null>(null);

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasElRef.current!, { width: 600, height: 400 });
    fabricRef.current = canvas;

    fabric.Image.fromURL(backgroundUrl, (img: fabric.Image) => {
      img.set({ selectable: false, evented: false });
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        scaleX: canvas.width! / (img.width || 600),
        scaleY: canvas.height! / (img.height || 400),
      });
    }, { crossOrigin: 'anonymous' });

    const updateHas = () => onHasDrawing(canvas.getObjects().length > 0);
    canvas.on('object:added', updateHas);
    canvas.on('object:removed', updateHas);

    onExport(() => canvas.toDataURL({ format: 'png' }));

    return () => {
      canvas.dispose();
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
      // Eraser = delete last object on click
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
      </div>

      <div className="border border-gray-300 rounded overflow-hidden inline-block">
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}
