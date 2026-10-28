# Instagram Reel Cropper

Turns a screenshot (or any image) into a 1080×1920 Instagram Reel-ready image.
The image is centred with configurable horizontal padding on a background
filled with its dominant colour.

Everything runs in the browser. There is no backend, and images never leave
the user's device.

## How it works

`src/lib/createVerticalImage.ts` is a port of the original Python/Pillow
implementation:

1. Find the dominant (most common) colour.
2. Clean the four 50×50 corners by replacing non-black pixels with that colour.
3. Resize the image to fit the 1080×1920 canvas minus padding, using Lanczos.
4. Centre it on a canvas filled with the dominant colour and export a PNG.

The resize uses `src/lib/lanczos.ts`, a port of Pillow's `Resample.c`, so the
output is pixel-identical to the old Python backend.

## Development

```bash
pnpm install
pnpm dev
```

```bash
pnpm build
```

```bash
pnpm lint
```

Pushes to `master` are deployed to GitHub Pages by `.github/workflows/gh-pages.yml`.
