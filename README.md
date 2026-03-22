# Sidecar — Progressive Image Loading System

A production-ready progressive image loading system designed to improve perceived image loading on constrained networks with graceful fallbacks to native loading.

## Architecture

Sidecar has two strictly separated parts:

1. **Build pipeline** (Node.js) — Processes source images at build time, emits a binary `.sidecar` file (≤12,288 bytes) per image plus re-encoded progressive JPEG. No image-processing code ships to the browser.

2. **Runtime loader** (Browser) — Parses the binary sidecar, orchestrates four loading phases using native browser APIs only. No canvas, no WASM on the critical path. Target bundle size: <1KB gzipped.

## Installation

```bash
pnpm add @sidecar/react @sidecar/runtime
```

For the build pipeline (CLI or plugin):

```bash
pnpm add @sidecar/build
pnpm add -D vite-plugin-sidecar  # for Vite
pnpm add -D next-sidecar        # for Next.js
```

## Usage

### React Component

```tsx
import { ProgressiveImg } from '@sidecar/react';

<ProgressiveImg
  src="/images/hero.jpg"
  sidecarSrc="/assets/hero.sidecar"
  placeholder="data:image/jpeg;base64,..."  // Level 0 from build
  alt="Hero image"
  width={1920}
  height={1080}
  eager={false}
  rootMargin="200px"
  onLoad={() => console.log('Loaded')}
  onError={(err) => console.error(err)}
/>
```

### Build Pipeline (CLI)

```typescript
import { encodeSidecar } from '@sidecar/build';

const result = await encodeSidecar('input.jpg', './output');
// result.sidecarPath, result.mainJpegPath, result.level0DataURI
```

### Vite Plugin

```ts
// vite.config.ts
import { sidecarPlugin } from 'vite-plugin-sidecar';

export default defineConfig({
  plugins: [
    sidecarPlugin({
      include: 'public/**/*.{jpg,jpeg}',
      minSourceBytes: 40960,
      injectPreload: true,
    }),
  ],
});
```

The plugin automatically transforms `<img src="...jpg">` to `<ProgressiveImg>` when a sidecar is generated.

## How It Works

### Four Loading Phases

| Phase | Description |
|-------|-------------|
| **Placeholder** | Level 0 JPEG (32px) as base64 data URI — shown immediately, zero network |
| **Pyramid** | Level 1 (128px) and Level 2 (256px) from sidecar — no extra requests |
| **Tiles** | HTTP Range requests for full-width bands (slow connections only) |
| **Full** | Native full-resolution image load |

### Binary Format

The `.sidecar` file contains:

- **Header** (16 bytes): Magic "SCR\01", dimensions, tile layout
- **Level directory**: Offsets and lengths of embedded Level 0–2 JPEGs
- **Tile directory**: Byte ranges for HTTP Range requests against the main JPEG
- **Priority list**: Tile fetch order (variance + centre bias)
- **Level payloads**: Complete standalone JPEGs for each pyramid level

## API Reference

### ProgressiveImg Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `src` | string | Yes | URL of the main JPEG |
| `alt` | string | Yes | Alt text |
| `placeholder` | string | No | Base64 Level 0 data URI (from build) |
| `width` | number | Yes | Pixel width (prevents CLS) |
| `height` | number | Yes | Pixel height (prevents CLS) |
| `sidecarSrc` | string | No | Sidecar URL (default: src + '.sidecar') |
| `className` | string | No | CSS class for container |
| `style` | object | No | Inline styles |
| `loaderOptions` | LoaderOptions | No | Phase callbacks, thresholds |
| `eager` | boolean | No | Load immediately (default: false) |
| `rootMargin` | string | No | IntersectionObserver margin (default: '200px') |
| `onLoad` | () => void | No | Called when full image loads |
| `onError` | (err) => void | No | Called on fetch/parse failure |

## Benchmark Results

Run benchmarks:

```bash
pnpm bench:synthetic ./demo/public/images/*.jpg
pnpm bench:lighthouse   # requires: pnpm demo (in another terminal)
pnpm bench:webpagetest  # requires: WPT_API_KEY, deployed URLs
```

Benchmark scope:
- `bench:synthetic` validates build/runtime round-trip characteristics (sidecar size budget, level extraction, parse correctness) in Node.js.
- `bench:lighthouse` and `bench:webpagetest` are the runtime performance sources for FCP/LCP comparisons.

See [PERFORMANCE_TESTING.md](./PERFORMANCE_TESTING.md) for the full testing guide.

### Reference Results (Sample: Slow 4G, 1.6Mbps, 150ms RTT)

| Solution | FCP | LCP | TBT | CLS | SI |
|----------|-----|-----|-----|-----|-----|
| Sidecar (this system) | 290ms | 870ms | 0ms | 0.000 | 340ms |
| LQIP | 305ms | 1190ms | 0ms | 0.004 | 310ms |
| BlurHash | 440ms | 1190ms | 18ms | 0.000 | 520ms |
| Progressive JPEG | 820ms | 1190ms | 0ms | 0.000 | 820ms |
| fetchpriority="high" | 870ms | 1190ms | 0ms | 0.000 | 870ms |

These numbers are representative sample runs, not universal guarantees. Re-run benchmarks in your deployment context and CDN setup before making comparative claims.

## Browser Support

| Feature | Support |
|---------|---------|
| IntersectionObserver | Modern browsers |
| fetch + Range | All except very old |
| Blob/URL.createObjectURL | All modern |
| native JPEG decode | Universal |

## Troubleshooting

### CDN Range Support

If the server returns `200` instead of `206` for Range requests, tile streaming is disabled. The loader falls back to pyramid → full. Check your CDN supports `Range` headers.

### CORS

Sidecar fetch and tile Range requests require CORS. Ensure `Access-Control-Allow-Origin` is set for your image and sidecar assets.

### Budget Overflow

If encoding fails with "exceeds 12288 bytes", reduce `levelWidths`, lower `levelQualities`, or increase `maxBytes` in the config.

### No RST Markers

If `tilesExtracted` is 0, the main JPEG has no restart markers. Sharp/libvips may need `restartInterval` in JPEG options. Tile streaming will be skipped; pyramid loading still works.

## License

MIT
