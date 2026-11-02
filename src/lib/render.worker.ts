import { prepareImage, renderPrepared, decode, type PreparedImage } from './createVerticalImage';

// Messages: { type: 'load', file } then { type: 'render', id, padding }.
// Rendering is latest-wins: while a render is running only the newest
// requested padding is kept, so dragging the slider never builds a backlog.
const ctx = self as unknown as { postMessage(msg: unknown, transfer?: Transferable[]): void };
let prepared: PreparedImage | null = null;
let pending: { id: number; padding: number } | null = null;
let busy = false;

async function pump() {
  if (busy) return;
  busy = true;
  while (pending && prepared) {
    const { id, padding } = pending;
    pending = null;
    const { data, width, height } = renderPrepared(prepared, padding);
    const buffer = data.buffer as ArrayBuffer;
    ctx.postMessage({ type: 'result', id, buffer, width, height }, [buffer]);
    // Yield so newly arrived messages can replace `pending`.
    await new Promise((r) => setTimeout(r, 0));
  }
  busy = false;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  try {
    if (msg.type === 'load') {
      prepared = null;
      pending = null;
      prepared = prepareImage(await decode(msg.file));
      ctx.postMessage({ type: 'loaded' });
    } else if (msg.type === 'render') {
      pending = { id: msg.id, padding: msg.padding };
      void pump();
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : 'Failed to process image' });
  }
};
