# Performance Testing Guide — Sidecar Progressive Image System

How to prove this system outperforms competing approaches with reproducible numbers.

---

## 1. Synthetic Node.js Benchmark

Runs against local images. No browser required. Verifiable in CI.

```bash
pnpm bench:synthetic ./demo/public/images/*.jpg
# Or with glob:
pnpm bench:synthetic "./**/*.jpg"
```

**Expected output:**
```
=== Sidecar Build Benchmark ===

File                           Source  Sidecar  Budget%     L0     L1     L2   Tiles   Build   RT
──────────────────────────────────────────────────────────────────────────────────────────────────
test.jpg                       124.0K    8.7K    70.8%    380B   1.4K   6.9K      40    312ms    ✓

Images processed: 1
Over budget:      0  ← must be 0
Average budget:   70.4%
Total build time: 312ms
```

---

## 2. Lighthouse CI Comparison

Runs Lighthouse with Slow 4G throttling against five test routes.

**Prerequisites:** Demo running at `http://localhost:5173`

```bash
pnpm demo          # Terminal 1
pnpm bench:lighthouse  # Terminal 2
```

Test routes (must be deployed or served locally):

| Route | Strategy |
|-------|----------|
| `/test/sidecar` | ProgressiveImg (this system) |
| `/test/native` | `<img fetchpriority="high">` |
| `/test/blurhash` | Blur placeholder + full img swap |
| `/test/lqip` | LQIP (inline JPEG) + full img swap |
| `/test/progressive-jpeg` | Native progressive JPEG, no JS |

---

## 3. WebPageTest (Real Devices)

Uses WebPageTest public API for real mobile hardware and networks.

```bash
WPT_API_KEY=your_key pnpm bench:webpagetest
```

Set env vars for your deployed demo URLs:
- `SIDECAR_URL`, `NATIVE_URL`, `BLURHASH_URL`, `LQIP_URL`

---

## 4. In-Browser Performance Tracker

Use `SidecarPerfTracker` for real-world analytics:

```typescript
import { SidecarPerfTracker } from './perf-tracker';

const tracker = new SidecarPerfTracker(imageURL);

<ProgressiveImg
  loaderOptions={{
    onPhase: (p) => {
      tracker.mark(p === 'pyramid' ? 'pyramid-done' : p);
      if (p === 'tiles') tracker.mark('tiles');
      if (p === 'full') tracker.mark('tiles-done');
    },
  }}
  onLoad={() => {
    const report = tracker.report();
    // Send to analytics: report.timeToFirstPixel, report.timeToFull, etc.
  }}
/>
```

---

## 5. Chrome DevTools Manual Verification

### Verify Level 0 paints before network
1. Network tab → Slow 3G
2. Performance → Record → Hard refresh
3. First non-grey frame timestamp should be before first completed request

### Verify CLS = 0
1. Performance → Layout Shift Regions
2. No blue flash over image area
3. Lighthouse CLS must be 0.000

### Verify Range requests
1. Network → Filter Fetch/XHR
2. Tile requests should show status 206 (Partial Content)

### Verify object URL cleanup
1. Memory → Heap snapshot before/after load
2. Filter "Blob URL" → zero after Phase 3

### Verify 404 degradation
1. Block sidecar request URL
2. Image still loads (Level 0 → full)
3. No JS errors

---

## 6. What to Claim

**Accurate:**
- First real photo pixels before any network request
- LCP faster than progressive JPEG on slow connections
- CLS exactly 0 (build-time dimension locking)
- Zero JS on critical path for Phases 0–1
- Under 1KB gzipped runtime
- Graceful degradation when sidecar unavailable

**Do not claim:**
- Faster on fast connections (>20Mbps)
- Works without server control (RST markers required)
- Better image quality than native
- Faster LCP on small images (<40KB)
