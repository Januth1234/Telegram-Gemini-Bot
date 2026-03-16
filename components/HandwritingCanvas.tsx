import React, { useRef, useEffect, useState, useCallback } from 'react';

interface HandwritingCanvasProps {
  onRecognize: (imageDataUrl: string, mimeType: string, base64Data: string) => void;
  onClose: () => void;
  isRecognizing?: boolean;
}

const STROKE_COLOR = '#1e293b';
const STROKE_WIDTH = 2.5;
const BG_COLOR = '#ffffff';

export const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({
  onRecognize,
  onClose,
  isRecognizing = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const getPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const draw = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pt = getPoint(e);
    if (pt) {
      lastPoint.current = pt;
      setIsDrawing(true);
    }
  }, [getPoint]);

  const moveDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pt = getPoint(e);
    if (pt && lastPoint.current) {
      draw(lastPoint.current, pt);
      lastPoint.current = pt;
    }
  }, [isDrawing, getPoint, draw]);

  const endDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPoint.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const recognize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1] || '';
    onRecognize(dataUrl, 'image/png', base64);
  }, [onRecognize]);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <i className="fa-solid fa-pencil text-indigo-500" />
            Draw equation (finger or mouse)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/5"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="p-4">
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 touch-none">
            <canvas
              ref={canvasRef}
              className="w-full h-64 block rounded-lg cursor-crosshair"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={moveDrawing}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              onTouchStart={startDrawing}
              onTouchMove={moveDrawing}
              onTouchEnd={endDrawing}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            Draw your equation clearly. Then tap Recognize to convert to LaTeX.
          </p>
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button
            type="button"
            onClick={clear}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-white/5"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={recognize}
            disabled={isRecognizing}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRecognizing ? (
              <span className="inline-flex items-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin" /> Recognizing…
              </span>
            ) : (
              'Recognize'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HandwritingCanvas;
