import { resizeLanczos } from './lanczos';

// Browser port of the former Python image_utils.py (Pillow + numpy).
// Every step mirrors the Python implementation so the output matches it.

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
const CORNER_SIZE = 50;
const BRIGHTNESS_THRESHOLD = 1;

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

type Rgb = [number, number, number];

// Equivalent of Counter(map(tuple, pixels)).most_common(1): ties go to the
// colour seen first in row-major order.
export function dominantColor(img: RgbaImage): Rgb {
  const { data } = img;
  const counts = new Map<number, number>();
  let best = 0;
  let bestCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return [(best >> 16) & 0xff, (best >> 8) & 0xff, best & 0xff];
}

// Replaces "bright" pixels (mean of RGB > threshold) in each corner with the
// dominant colour, in place.
export function cleanCorners(img: RgbaImage, cornerSize = CORNER_SIZE, threshold = BRIGHTNESS_THRESHOLD) {
  const { data, width: w, height: h } = img;
  const [dr, dg, db] = dominantColor(img);
  const cw = Math.min(cornerSize, w);
  const ch = Math.min(cornerSize, h);
  const corners: [number, number, number, number][] = [
    [0, ch, 0, cw], // top-left
    [0, ch, w - cw, w], // top-right
    [h - ch, h, 0, cw], // bottom-left
    [h - ch, h, w - cw, w], // bottom-right
  ];

  for (const [rStart, rEnd, cStart, cEnd] of corners) {
    for (let y = rStart; y < rEnd; y++) {
      for (let x = cStart; x < cEnd; x++) {
        const i = (y * w + x) * 4;
        if ((data[i] + data[i + 1] + data[i + 2]) / 3 > threshold) {
          data[i] = dr;
          data[i + 1] = dg;
          data[i + 2] = db;
        }
      }
    }
  }
}

// Python's round(): halves go to the nearest even integer.
function roundHalfEven(n: number): number {
  const r = Math.round(n);
  return Math.abs(n % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

// Same size computation as PIL.ImageOps.contain.
export function containSize(w: number, h: number, boxW: number, boxH: number): [number, number] {
  const imRatio = w / h;
  const destRatio = boxW / boxH;
  if (imRatio > destRatio) return [boxW, Math.max(1, roundHalfEven((h / w) * boxW))];
  if (imRatio < destRatio) return [Math.max(1, roundHalfEven((w / h) * boxH)), boxH];
  return [boxW, boxH];
}

// Pure pixel pipeline: clean corners, resize (Pillow LANCZOS) and centre the image on
// a CANVAS_W x CANVAS_H background of the dominant colour.
export function renderVertical(input: RgbaImage, padding: number): RgbaImage {
  const src: RgbaImage = { ...input, data: new Uint8ClampedArray(input.data) };
  for (let i = 3; i < src.data.length; i += 4) src.data[i] = 255;

  cleanCorners(src);
  const [br, bg, bb] = dominantColor(src);

  const innerW = Math.max(1, CANVAS_W - 2 * padding);
  const innerH = CANVAS_H;
  const [rw, rh] = containSize(src.width, src.height, innerW, innerH);

  const resized = resizeLanczos(src.data, src.width, src.height, rw, rh);

  const out = new Uint8ClampedArray(CANVAS_W * CANVAS_H * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = br;
    out[i + 1] = bg;
    out[i + 2] = bb;
    out[i + 3] = 255;
  }

  // Pillow paste() clips to the canvas, so do the same.
  const x0 = padding + Math.floor((innerW - rw) / 2);
  const y0 = Math.floor((innerH - rh) / 2);
  for (let y = 0; y < rh; y++) {
    const oy = y0 + y;
    if (oy < 0 || oy >= CANVAS_H) continue;
    for (let x = 0; x < rw; x++) {
      const ox = x0 + x;
      if (ox < 0 || ox >= CANVAS_W) continue;
      const si = (y * rw + x) * 4;
      const oi = (oy * CANVAS_W + ox) * 4;
      out[oi] = resized[si];
      out[oi + 1] = resized[si + 1];
      out[oi + 2] = resized[si + 2];
    }
  }

  return { data: out, width: CANVAS_W, height: CANVAS_H };
}

// Decodes the file without EXIF rotation or colour management, like Pillow's
// Image.open(...).convert("RGB").
async function decode(file: Blob): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'none',
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}

export async function createVerticalImage(file: Blob, padding: number): Promise<Blob> {
  const result = renderVertical(await decode(file), padding);
  const canvas = new OffscreenCanvas(result.width, result.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(result.data), result.width, result.height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}
