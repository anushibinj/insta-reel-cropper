// Port of Pillow's libImaging/Resample.c (8 bits per channel, LANCZOS filter).
// It mirrors Pillow's fixed-point maths and two-pass order (horizontal first,
// clipped to 8 bits in between), so the output is bit-identical to
// Image.resize(size, Image.Resampling.LANCZOS) for RGB images.

const PRECISION_BITS = 32 - 8 - 2;
const PRECISION_SCALE = 1 << PRECISION_BITS;
const LANCZOS_SUPPORT = 3;

function sinc(x: number): number {
  if (x === 0) return 1;
  x = x * Math.PI;
  return Math.sin(x) / x;
}

function lanczos(x: number): number {
  return -LANCZOS_SUPPORT <= x && x < LANCZOS_SUPPORT ? sinc(x) * sinc(x / LANCZOS_SUPPORT) : 0;
}

interface Coeffs {
  ksize: number;
  kk: Int32Array;
  bounds: Int32Array;
}

// precompute_coeffs() + normalize_coeffs_8bpc()
function precomputeCoeffs(inSize: number, outSize: number): Coeffs {
  const scale = inSize / outSize;
  const filterscale = scale < 1 ? 1 : scale;
  const support = LANCZOS_SUPPORT * filterscale;
  const ksize = Math.ceil(support) * 2 + 1;
  const ss = 1 / filterscale;
  const kk = new Int32Array(outSize * ksize);
  const bounds = new Int32Array(outSize * 2);
  const k = new Float64Array(ksize);

  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let ww = 0;
    let xmin = Math.trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    xmax -= xmin;
    for (let x = 0; x < xmax; x++) {
      const w = lanczos((x + xmin - center + 0.5) * ss);
      k[x] = w;
      ww += w;
    }
    for (let x = 0; x < xmax; x++) {
      const v = ww !== 0 ? k[x] / ww : k[x];
      kk[xx * ksize + x] = v < 0 ? Math.trunc(-0.5 + v * PRECISION_SCALE) : Math.trunc(0.5 + v * PRECISION_SCALE);
    }
    bounds[xx * 2] = xmin;
    bounds[xx * 2 + 1] = xmax;
  }
  return { ksize, kk, bounds };
}

function clip8(v: number): number {
  if (v >= PRECISION_SCALE * 256) return 255;
  if (v <= 0) return 0;
  return Math.floor(v / PRECISION_SCALE);
}

// Resizes an RGBA buffer (alpha is ignored and written as 255).
export function resizeLanczos(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  toWidth: number,
  toHeight: number,
): Uint8ClampedArray {
  const needHorizontal = toWidth !== width;
  const needVertical = toHeight !== height;
  if (!needHorizontal && !needVertical) return new Uint8ClampedArray(src);

  const horiz = precomputeCoeffs(width, toWidth);
  const vert = precomputeCoeffs(height, toHeight);
  const init = 1 << (PRECISION_BITS - 1);

  // First and last source rows used by the vertical pass.
  const yFirst = vert.bounds[0];
  const yLast = vert.bounds[toHeight * 2 - 2] + vert.bounds[toHeight * 2 - 1];

  let img = src;
  let imgWidth = width;

  if (needHorizontal) {
    const yOffset = needVertical ? yFirst : 0;
    const tempHeight = needVertical ? yLast - yFirst : height;
    if (needVertical) {
      for (let i = 0; i < toHeight; i++) vert.bounds[i * 2] -= yFirst;
    }
    const temp = new Uint8ClampedArray(toWidth * tempHeight * 4);
    for (let yy = 0; yy < tempHeight; yy++) {
      const row = (yy + yOffset) * width;
      for (let xx = 0; xx < toWidth; xx++) {
        const xmin = horiz.bounds[xx * 2];
        const xmax = horiz.bounds[xx * 2 + 1];
        const kb = xx * horiz.ksize;
        let s0 = init;
        let s1 = init;
        let s2 = init;
        for (let x = 0; x < xmax; x++) {
          const p = (row + x + xmin) * 4;
          const k = horiz.kk[kb + x];
          s0 += src[p] * k;
          s1 += src[p + 1] * k;
          s2 += src[p + 2] * k;
        }
        const o = (yy * toWidth + xx) * 4;
        temp[o] = clip8(s0);
        temp[o + 1] = clip8(s1);
        temp[o + 2] = clip8(s2);
        temp[o + 3] = 255;
      }
    }
    if (!needVertical) return temp;
    img = temp;
    imgWidth = toWidth;
  }

  const out = new Uint8ClampedArray(imgWidth * toHeight * 4);
  for (let yy = 0; yy < toHeight; yy++) {
    const ymin = vert.bounds[yy * 2];
    const ymax = vert.bounds[yy * 2 + 1];
    const kb = yy * vert.ksize;
    for (let xx = 0; xx < imgWidth; xx++) {
      let s0 = init;
      let s1 = init;
      let s2 = init;
      for (let y = 0; y < ymax; y++) {
        const p = ((y + ymin) * imgWidth + xx) * 4;
        const k = vert.kk[kb + y];
        s0 += img[p] * k;
        s1 += img[p + 1] * k;
        s2 += img[p + 2] * k;
      }
      const o = (yy * imgWidth + xx) * 4;
      out[o] = clip8(s0);
      out[o + 1] = clip8(s1);
      out[o + 2] = clip8(s2);
      out[o + 3] = 255;
    }
  }
  return out;
}
