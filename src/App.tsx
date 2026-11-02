import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { CANVAS_H, CANVAS_W } from './lib/createVerticalImage';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PADDING = 200;

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [padding, setPadding] = useState(50);
  const [showOriginal, setShowOriginal] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const paddingRef = useRef(padding);
  paddingRef.current = padding;

  // One worker per app lifetime; it holds the decoded image.
  useEffect(() => {
    const worker = new Worker(new URL('./lib/render.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'loaded') {
        setReady(true);
        requestId.current++;
        worker.postMessage({ type: 'render', id: requestId.current, padding: paddingRef.current });
      } else if (msg.type === 'result') {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.putImageData(new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height), 0, 0);
      } else if (msg.type === 'error') {
        setError(msg.message);
        setFile(null);
        setReady(false);
      }
    };
    return () => worker.terminate();
  }, []);

  useEffect(() => () => { if (originalUrl) URL.revokeObjectURL(originalUrl); }, [originalUrl]);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) return setError('Please choose an image file.');
    if (f.size > MAX_BYTES) return setError('Image must be under 10MB.');
    setError(null);
    setReady(false);
    setShowOriginal(false);
    setFile(f);
    setOriginalUrl(URL.createObjectURL(f));
    workerRef.current?.postMessage({ type: 'load', file: f });
  }, []);

  const onPadding = (value: number) => {
    setPadding(value);
    if (!ready) return;
    requestId.current++;
    workerRef.current?.postMessage({ type: 'render', id: requestId.current, padding: value });
  };

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'instagram-reel-cropped.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  const reset = () => {
    setFile(null);
    setOriginalUrl(null);
    setReady(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const input = (
    <input ref={inputRef} type="file" accept="image/*" onChange={onInput} className="hidden" />
  );

  return (
    <div className="h-dvh flex flex-col bg-neutral-950 text-white overflow-hidden pt-safe">
      <header className="flex items-center justify-between px-4 h-12 shrink-0">
        <h1 className="text-sm font-semibold tracking-tight">Reel Cropper</h1>
        {file && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white active:text-white py-2 pl-3"
          >
            <RotateCcw className="w-4 h-4" /> New
          </button>
        )}
      </header>

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-950 text-red-200 text-sm flex justify-between gap-3" role="alert">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline shrink-0">Dismiss</button>
        </div>
      )}

      {!file ? (
        <main className="flex-1 flex items-center justify-center p-4 min-h-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            className={`w-full max-w-md aspect-[4/3] max-h-full rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors ${
              dragging ? 'border-blue-400 bg-blue-500/10' : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
            }`}
          >
            <Upload className="w-9 h-9 text-neutral-400" />
            <span className="text-base font-medium">Choose an image</span>
            <span className="text-sm text-neutral-500">or drop it here</span>
          </button>
          {input}
        </main>
      ) : (
        <>
          <main className="flex-1 min-h-0 flex items-center justify-center px-4 pb-3">
            <div
              className="relative h-full max-w-full rounded-2xl overflow-hidden bg-neutral-900 ring-1 ring-white/10"
              style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className={`absolute inset-0 w-full h-full ${showOriginal ? 'invisible' : ''}`}
              />
              {showOriginal && originalUrl && (
                <img src={originalUrl} alt="Original" className="absolute inset-0 w-full h-full object-contain bg-neutral-900" />
              )}
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </main>

          <footer className="shrink-0 px-4 pt-3 pb-safe bg-neutral-900 border-t border-white/10 rounded-t-3xl">
            <div className="max-w-md mx-auto space-y-4 pb-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <label htmlFor="padding" className="text-neutral-300">Side padding</label>
                  <span className="tabular-nums text-neutral-400">{padding}px</span>
                </div>
                <input
                  id="padding"
                  type="range"
                  min={0}
                  max={MAX_PADDING}
                  value={padding}
                  onChange={(e) => onPadding(Number(e.target.value))}
                  className="slider w-full"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  role="switch"
                  aria-checked={showOriginal}
                  onClick={() => setShowOriginal((v) => !v)}
                  className="flex items-center gap-2 text-sm text-neutral-300 h-12 pr-1"
                >
                  <span className={`relative w-10 h-6 rounded-full transition-colors ${showOriginal ? 'bg-blue-600' : 'bg-neutral-700'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showOriginal ? 'translate-x-4' : ''}`} />
                  </span>
                  Original
                </button>
                <button
                  onClick={download}
                  disabled={!ready}
                  className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 font-semibold flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" /> Download
                </button>
              </div>
            </div>
            {input}
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
