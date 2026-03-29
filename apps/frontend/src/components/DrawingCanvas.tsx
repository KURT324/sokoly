import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';

type Tool = 'brush' | 'rect' | 'ellipse';
const COLORS = ['#e53e3e', '#3182ce', '#38a169'];

interface Props {
  backgroundUrl?: string;
  onChange: (dataUrl: string) => void;
}

export function DrawingCanvas({ backgroundUrl, onChange }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(4);

  // Track drawing state for rect/ellipse
  const isDrawingShapeRef = useRef(false);
  const originXRef = useRef(0);
  const originYRef = useRef(0);
  const activeShapeRef = useRef<fabric.Object | null>(null);

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasElRef.current!, { width: 600, height: 400 });
    fabricRef.current = canvas;

    if (backgroundUrl) {
      fabric.Image.fromURL(backgroundUrl, (img: fabric.Image) => {
        img.set({ selectable: false, evented: false, lockMovementX: true, lockMovementY: true });
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
          scaleX: canvas.width! / (img.width || 600),
          scaleY: canvas.height! / (img.height || 400),
        });
      }, { crossOrigin: 'anonymous' });
    }

    const emitChange = () => onChange(canvas.toDataURL({ format: 'png' }));
    canvas.on('object:added', emitChange);
    canvas.on('object:modified', emitChange);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [backgroundUrl]);

  // Apply tool/color/brushSize
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Remove shape listeners first
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    if (tool === 'brush') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = brushSize;
      return;
    }

    canvas.isDrawingMode = false;
    canvas.selection = false;

    canvas.on('mouse:down', (opt) => {
      const ptr = canvas.getPointer(opt.e);
      isDrawingShapeRef.current = true;
      originXRef.current = ptr.x;
      originYRef.current = ptr.y;

      const opts = { left: ptr.x, top: ptr.y, width: 0, height: 0, fill: 'transparent', stroke: color, strokeWidth: brushSize, selectable: false };
      const shape = tool === 'rect' ? new fabric.Rect(opts) : new fabric.Ellipse({ ...opts, rx: 0, ry: 0 });
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
      if (!isDrawingShapeRef.current) return;
      isDrawingShapeRef.current = false;
      activeShapeRef.current = null;
      onChange(canvas.toDataURL({ format: 'png' }));
    });
  }, [tool, color, brushSize]);

  const handleUndo = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (objects.length > 0) {
      canvas.remove(objects[objects.length - 1]);
      canvas.renderAll();
      onChange(canvas.toDataURL({ format: 'png' }));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Tool */}
        <div className="flex gap-1">
          {(['brush', 'rect', 'ellipse'] as Tool[]).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`px-3 py-1 text-sm rounded border transition-colors ${tool === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {t === 'brush' ? 'Кисть' : t === 'rect' ? 'Прямоугольник' : 'Эллипс'}
            </button>
          ))}
        </div>

        {/* Color */}
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ background: c }}
              className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
            />
          ))}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Толщина:</span>
          <input
            type="range" min={1} max={20} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-xs text-gray-500">{brushSize}px</span>
        </div>

        {/* Undo */}
        <button
          onClick={handleUndo}
          className="px-3 py-1 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Undo
        </button>
      </div>

      <div className="border border-gray-300 rounded overflow-hidden inline-block">
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
}
