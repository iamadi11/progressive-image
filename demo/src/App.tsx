import { useState, useRef, useCallback } from 'react';
import { ProgressiveImg } from '@sidecar/react';

const PICSUM = (id: number, w: number, h: number) =>
  `https://picsum.photos/id/${id}/${w}/${h}`;

const DEMO_IMAGES = [
  { id: 237, w: 800, h: 600, label: 'Landscape 1' },
  { id: 238, w: 800, h: 600, label: 'Landscape 2' },
  { id: 239, w: 800, h: 600, label: 'Landscape 3' },
  { id: 433, w: 600, h: 800, label: 'Portrait 1' },
  { id: 434, w: 600, h: 800, label: 'Portrait 2' },
  { id: 435, w: 600, h: 800, label: 'Portrait 3' },
];

let fetchDelay = 0;
const originalFetch = window.fetch.bind(window);
window.fetch = function (
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  if (fetchDelay > 0) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        originalFetch(...args).then(resolve).catch(reject);
      }, fetchDelay);
    });
  }
  return originalFetch(...args);
};

export function App() {
  const [throttleMs, setThrottleMs] = useState(0);
  const [comparisonKey, setComparisonKey] = useState(0);
  const [metrics, setMetrics] = useState<{
    ttfp: number;
    ttfr: number;
    ttff: number;
    phaseBytes: Record<string, number>;
  } | null>(null);
  const metricsRef = useRef<Record<string, number>>({});

  const updateThrottle = useCallback((ms: number) => {
    fetchDelay = ms;
    setThrottleMs(ms);
  }, []);

  const handleLoad = useCallback(() => {
    setMetrics({
      ttfp: metricsRef.current['placeholder'] ?? 0,
      ttfr: metricsRef.current['pyramid'] ?? 0,
      ttff: metricsRef.current['full'] ?? 0,
      phaseBytes: { ...metricsRef.current },
    });
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1>Sidecar Progressive Image Demo</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>Network Throttle</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label>
            Simulated delay per request (ms):
            <input
              type="range"
              min={0}
              max={1000}
              step={50}
              value={throttleMs}
              onChange={(e) => updateThrottle(Number(e.target.value))}
            />
          </label>
          <span>{throttleMs}ms</span>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Image Grid</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {DEMO_IMAGES.map((img) => (
            <div key={img.id}>
              <ProgressiveImg
                src={PICSUM(img.id, img.w, img.h)}
                alt={img.label}
                width={img.w}
                height={img.h}
                loaderOptions={{
                  onPhase: (p) => {
                    metricsRef.current[p] = performance.now();
                  },
                  onFrame: (f) => {
                    metricsRef.current[f.phase] = f.elapsed;
                  },
                }}
                onLoad={handleLoad}
              />
              <p style={{ fontSize: 12, marginTop: 4 }}>{img.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Side-by-Side Comparison</h2>
        <p>
          <button onClick={() => setComparisonKey((k: number) => k + 1)}>Load Both</button>
        </p>
        <div
          key={comparisonKey}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}
        >
          <div>
            <h3>ProgressiveImg (Sidecar)</h3>
            <ProgressiveImg
              src={PICSUM(237, 600, 400)}
              alt="Sidecar"
              width={600}
              height={400}
              eager={comparisonKey > 0}
              loaderOptions={{
                onPhase: (p) => {
                  metricsRef.current[`sidecar_${p}`] = performance.now();
                },
              }}
            />
          </div>
          <div>
            <h3>Native img (fetchpriority=high)</h3>
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                width: 600,
                height: 400,
              }}
            >
              {comparisonKey > 0 && (
                <img
                  src={PICSUM(237, 600, 400)}
                  alt="Native"
                  width={600}
                  height={400}
                  fetchPriority="high"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Live Metrics</h2>
        <pre
          style={{
            background: '#222',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
          {metrics
            ? `Time to first pixel: ${metrics.ttfp?.toFixed(0) ?? '-'}ms
Time to recognisable: ${metrics.ttfr?.toFixed(0) ?? '-'}ms
Time to full: ${metrics.ttff?.toFixed(0) ?? '-'}ms`
            : 'Load an image to see metrics'}
        </pre>
      </section>
    </div>
  );
}
